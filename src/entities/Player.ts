// src/entities/Player.ts
import Phaser from 'phaser';
import type { Facing } from '../types';
import { SoundManager } from '../managers/SoundManager';

export class Player extends Phaser.Physics.Arcade.Sprite {
    public cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    public spaceKey: Phaser.Input.Keyboard.Key;
    public enterKey: Phaser.Input.Keyboard.Key;
    public ctrlKey: Phaser.Input.Keyboard.Key;

    // WASD Controls
    public keyW!: Phaser.Input.Keyboard.Key;
    public keyA!: Phaser.Input.Keyboard.Key;
    public keyS!: Phaser.Input.Keyboard.Key;
    public keyD!: Phaser.Input.Keyboard.Key;
    public keyE!: Phaser.Input.Keyboard.Key;

    public facing: Facing = 'right';
    public canJump: boolean = true;
    public isNormalJump: boolean = false; 
    public ignoreGroundJumpUntil: number = 0;
    public isOnPlatform: boolean = false;
    public isNearDoor: boolean = false;
    public canSmash: boolean = false;

    // States
    public hasGun: boolean = false;
    public hasTotem: boolean = false;
    public isInvincible: boolean = false; 
    public isDying: boolean = false;
    private activeDeathSprite?: Phaser.GameObjects.Sprite;

    // Spawns
    public spawnX: number = 100;
    public spawnY: number = 100;
    public activeSpawnX: number = 100;
    public activeSpawnY: number = 100;
    public lastSafeX: number = 100;
    public lastSafeY: number = 100;

    public bullets: Phaser.Physics.Arcade.Group;
    public soundManager?: SoundManager;

    public shootRecoilUntil: number = 0;
    private lastMouseDown: boolean = false;
    private lastCtrlDown: boolean = false;

    // Key Lift on Respawn State (prevents held keys from triggering actions immediately on respawn)
    private requireKeyLift = {
        left: false,
        right: false,
        jump: false,
        mouse: false,
        ctrl: false
    };

    public getActiveKeys(): string[] {
        const keys: string[] = [];
        if (this.cursors.left?.isDown || this.keyA?.isDown) keys.push('LEFT');
        if (this.cursors.right?.isDown || this.keyD?.isDown) keys.push('RIGHT');
        if (this.cursors.up?.isDown || this.keyW?.isDown || this.spaceKey?.isDown) keys.push('JUMP');
        if (this.ctrlKey?.isDown) keys.push('SHOOT');
        if (this.keyE?.isDown) keys.push('ACTION');
        return keys;
    }

    constructor(scene: Phaser.Scene, x: number, y: number, soundManager?: SoundManager) {
        super(scene, x, y, 'idle-r');
        this.soundManager = soundManager;
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.setDepth(5);
        this.setBodySize(14, 24);
        this.setOffset(9, 8);
        (this.body as Phaser.Physics.Arcade.Body).setMaxVelocity(10000, 10000);

        this.cursors = scene.input.keyboard!.createCursorKeys();
        this.spaceKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.enterKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.ctrlKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);

        // Setup WASD
        this.keyW = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyA = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyS = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyD = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyE = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        this.bullets = scene.physics.add.group({ allowGravity: false });
    }

    public enforceKeyLift() {
        const rawLeft = this.cursors.left.isDown || (this.keyA && this.keyA.isDown);
        const rawRight = this.cursors.right.isDown || (this.keyD && this.keyD.isDown);
        const rawJump = this.cursors.up.isDown || (this.keyW && this.keyW.isDown) || this.spaceKey.isDown;
        const pointer = this.scene.input.activePointer;
        const rawMouse = Boolean(pointer && pointer.leftButtonDown());
        const rawCtrl = Boolean(this.ctrlKey && this.ctrlKey.isDown);

        this.requireKeyLift.left = rawLeft;
        this.requireKeyLift.right = rawRight;
        this.requireKeyLift.jump = rawJump;
        this.requireKeyLift.mouse = rawMouse;
        this.requireKeyLift.ctrl = rawCtrl;
        this.lastMouseDown = rawMouse;
        this.lastCtrlDown = rawCtrl;
    }

    public stompBounce(bounceVelocity: number = -380) {
        this.setVelocityY(bounceVelocity);
        this.isNormalJump = false;
        this.canJump = true;
    }

    update() {
        if (this.isDying) {
            this.setVelocity(0, 0);
            return;
        }

        const speed = 200, jumpSpeed = 400, shortHopCap = -150;
        const body = this.body as Phaser.Physics.Arcade.Body;
        const isGrounded = body.blocked.down || this.isOnPlatform;

        this.setVelocityX(0);

        const pointer = this.scene.input.activePointer;

        // 1. Evaluate Key Lift Releases (once lifted, the key/click is unlocked)
        const rawLeftDown = this.cursors.left.isDown || this.keyA.isDown;
        const rawRightDown = this.cursors.right.isDown || this.keyD.isDown;
        const rawJumpDown = this.cursors.up.isDown || this.keyW.isDown || this.spaceKey.isDown;
        const rawMouseDown = Boolean(pointer && pointer.leftButtonDown());
        const rawCtrlDown = Boolean(this.ctrlKey && this.ctrlKey.isDown);

        if (!rawLeftDown) this.requireKeyLift.left = false;
        if (!rawRightDown) this.requireKeyLift.right = false;
        if (!rawJumpDown) this.requireKeyLift.jump = false;
        if (!rawMouseDown) this.requireKeyLift.mouse = false;
        if (!rawCtrlDown) this.requireKeyLift.ctrl = false;

        // 2. Filter inputs through Key Lift guard
        const isLeftDown = rawLeftDown && !this.requireKeyLift.left;
        const isRightDown = rawRightDown && !this.requireKeyLift.right;
        const isJumpDown = rawJumpDown && !this.requireKeyLift.jump;

        if (isLeftDown) { 
            this.setVelocityX(-speed); 
            this.facing = 'left'; 
        } else if (isRightDown) { 
            this.setVelocityX(speed); 
            this.facing = 'right'; 
        }

        if (isGrounded && !this.isInvincible) {
            this.lastSafeX = this.x; 
            this.lastSafeY = this.y - 10; 
        }

        if (isGrounded) {
            if (isJumpDown && this.canJump && this.scene.time.now > this.ignoreGroundJumpUntil) {
                this.setVelocityY(-jumpSpeed); 
                this.canJump = false; 
                this.isNormalJump = true; 
                this.soundManager?.playJump();
            }
        } else {
            this.canJump = true;
        }

        // Variable Jump Height: releasing Space, Up, or W early cuts velocity into a short-hop
        if (this.isNormalJump && !isJumpDown && body.velocity.y < shortHopCap) {
            this.setVelocityY(shortHopCap); 
            this.isNormalJump = false; 
        }

        // 3. Left Mouse Click or Left Ctrl shoots Blaster
        const isMouseJustPressed = rawMouseDown && !this.lastMouseDown && !this.requireKeyLift.mouse;
        const isCtrlJustPressed = rawCtrlDown && !this.lastCtrlDown && !this.requireKeyLift.ctrl;
        this.lastMouseDown = rawMouseDown;
        this.lastCtrlDown = rawCtrlDown;

        if ((isMouseJustPressed || isCtrlJustPressed) && this.hasGun) {
            this.shootBullet();
        }

        this.updateAnimationState(isGrounded);
        
        // Reset per-frame platform evaluation
        this.isOnPlatform = false; 
    }

    private shootBullet() {
        const isRight = this.facing === 'right';
        this.shootRecoilUntil = this.scene.time.now + 160;
        const spawnX = isRight ? this.x + 12 : this.x - 12;
        const spawnY = this.y - 2;

        const bullet = this.bullets.create(spawnX, spawnY, 'fire-bullets') as Phaser.Physics.Arcade.Sprite;
        bullet.setDepth(5);
        bullet.setOrigin(0.5, 0.5);
        bullet.setFlipX(!isRight);

        const body = bullet.body as Phaser.Physics.Arcade.Body;
        body.setSize(12, 12);
        body.setOffset(2, 2);
        body.allowGravity = false;

        if (this.scene.anims.exists('fire-bullet-anim')) {
            bullet.play('fire-bullet-anim');
        }

        const bulletSpeed = 500;
        const bulletLifespanMs = 600;

        bullet.setVelocityX(isRight ? bulletSpeed : -bulletSpeed);
        this.soundManager?.playShoot();

        this.scene.time.delayedCall(bulletLifespanMs, () => { 
            if (bullet.active) {
                bullet.destroy(); 
            }
        });
    }

    private updateAnimationState(isGrounded: boolean) {
        const body = this.body as Phaser.Physics.Arcade.Body;
        const isMovingHorizontally = body.velocity.x !== 0;
        const isShootingRecoil = this.scene.time.now < this.shootRecoilUntil;

        // When shooting recoil is active, display muzzle flash frame
        if (isShootingRecoil) {
            const shootFrame = this.facing === 'right' ? 2 : 1;
            if (this.anims.isPlaying) this.anims.stop();
            if (this.texture.key !== 'player-shoot' || this.frame.name !== String(shootFrame)) {
                this.setTexture('player-shoot', shootFrame);
            }
            return;
        }

        if (!isGrounded) {
            if (body.velocity.y < 0) {
                // Jumping / Rising (Frame 1: Left Jump, Frame 2: Right Jump)
                if (this.anims.isPlaying) this.anims.stop();
                const frame = this.facing === 'right' ? 2 : 1;
                if (this.texture.key !== 'player-jump-fall' || this.frame.name !== String(frame)) {
                    this.setTexture('player-jump-fall', frame);
                }
            } else {
                // Falling / Descending
                if (this.hasGun) {
                    const fallGunAnimKey = this.facing === 'right' ? 'fall-gun-r-anim' : 'fall-gun-l-anim';
                    if (this.scene.anims.exists(fallGunAnimKey)) {
                        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== fallGunAnimKey) {
                            this.anims.play(fallGunAnimKey, true);
                        }
                    } else {
                        if (this.anims.isPlaying) this.anims.stop();
                        const key = this.facing === 'right' ? 'player-fall-gun-r' : 'player-fall-gun-l';
                        if (this.texture.key !== key) {
                            this.setTexture(key, 0);
                        }
                    }
                } else {
                    const fallAnimKey = this.facing === 'right' ? 'fall-r-anim' : 'fall-l-anim';
                    if (this.scene.anims.exists(fallAnimKey)) {
                        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== fallAnimKey) {
                            this.anims.play(fallAnimKey, true);
                        }
                    } else {
                        if (this.anims.isPlaying) this.anims.stop();
                        const frame = this.facing === 'right' ? 3 : 0;
                        if (this.texture.key !== 'player-fall' || this.frame.name !== String(frame)) {
                            this.setTexture('player-fall', frame);
                        }
                    }
                }
            }
            return;
        }
        
        if (isMovingHorizontally) {
            const key = this.facing === 'right' ? 'walk-r-anim' : 'walk-l-anim';
            if (!this.anims.isPlaying || this.anims.currentAnim?.key !== key) {
                this.anims.play(key, true);
            }
        } else {
            if (this.hasGun) {
                const gunHoldFrame = this.facing === 'right' ? 3 : 0;
                if (this.anims.isPlaying) this.anims.stop();
                if (this.texture.key !== 'player-shoot' || this.frame.name !== String(gunHoldFrame)) {
                    this.setTexture('player-shoot', gunHoldFrame);
                }
            } else {
                const idleAnimKey = this.facing === 'right' ? 'idle-r-anim' : 'idle-l-anim';
                if (this.scene.anims.exists(idleAnimKey)) {
                    if (!this.anims.isPlaying || this.anims.currentAnim?.key !== idleAnimKey) {
                        this.anims.play(idleAnimKey, true);
                    }
                } else {
                    const key = this.facing === 'right' ? 'idle-r' : 'idle-l';
                    if (this.anims.isPlaying) this.anims.stop();
                    if (this.texture.key !== key) this.setTexture(key);
                }
            }
        }
    }

    public cancelDeathEffect() {
        if (this.activeDeathSprite && this.activeDeathSprite.active) {
            this.scene.tweens.killTweensOf(this.activeDeathSprite);
            this.activeDeathSprite.destroy();
            this.activeDeathSprite = undefined;
        }
        this.isDying = false;
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
        }
        this.setVisible(true);
        this.setAlpha(1);
    }

    public finishRespawn() {
        this.isDying = false;
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
        }
        this.setPosition(this.activeSpawnX, this.activeSpawnY);
        this.setVelocity(0, 0);
        this.setVisible(true);
        this.setAlpha(1);

        const idleAnimKey = this.facing === 'right' ? 'idle-r-anim' : 'idle-l-anim';
        if (this.scene.anims.exists(idleAnimKey)) {
            this.anims.play(idleAnimKey, true);
        } else {
            this.anims.stop();
            this.setTexture(this.facing === 'right' ? 'idle-r' : 'idle-l');
        }
        this.hasGun = false;
        this.clearTint();
        this.enforceKeyLift();
        this.scene.events.emit('player-respawn');
    }

    die(reason: 'default' | 'lava' | 'electric' | 'lightning' | string = 'default') {
        if (this.isInvincible || this.isDying) return;

        // If player has Totem Shield: absorb death without resetting stage
        if (this.hasTotem) {
            this.hasTotem = false; 
            this.isInvincible = true;
            this.setPosition(this.lastSafeX, this.lastSafeY); 
            this.setVelocity(0, 0); 
            this.setTint(0xffaa00); 
            this.soundManager?.playDeath();
            this.enforceKeyLift();
            this.scene.time.delayedCall(3000, () => {
                this.isInvincible = false;
                this.clearTint();
            });
            return;
        }

        // Full Death: play death effect sprite, then smoothly respawn at spawn point
        this.isDying = true;
        const deathX = this.x;
        const deathY = this.y;

        this.setVelocity(0, 0);
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(false);
        }
        this.setVisible(false);
        this.hasGun = false;
        this.clearTint();
        this.soundManager?.playDeath();

        // Emit death event for collectibles & mobs reset
        this.scene.events.emit('player-death');

        const isRight = this.facing === 'right';

        if (reason === 'lava' || reason === 'fire') {
            const spriteKey = isRight ? 'lava-death-r' : 'lava-death-l';
            const animKey = isRight ? 'lava-death-r-anim' : 'lava-death-l-anim';
            const effectDuration = 520;

            if (this.scene.textures.exists(spriteKey)) {
                // Spawn inside the lava block
                const deathSprite = this.scene.add.sprite(deathX, deathY + 6, spriteKey, isRight ? 5 : 0);
                deathSprite.setDepth(10);
                deathSprite.setOrigin(0.5, 0.5);
                this.activeDeathSprite = deathSprite;

                if (this.scene.anims.exists(animKey)) {
                    deathSprite.play(animKey);
                }

                // Smoothly drown and sink deep into the molten lava block while melting away
                this.scene.tweens.add({
                    targets: deathSprite,
                    y: deathY + 24,
                    alpha: { from: 1, to: 0 },
                    duration: effectDuration,
                    ease: 'Sine.easeIn',
                    onComplete: () => {
                        if (deathSprite.active) deathSprite.destroy();
                        if (this.activeDeathSprite === deathSprite) this.activeDeathSprite = undefined;
                        this.finishRespawn();
                    }
                });
            } else {
                this.scene.time.delayedCall(effectDuration, () => {
                    this.finishRespawn();
                });
            }
        } else if (reason === 'electric' || reason === 'lightning' || reason === 'thunder') {
            // Electric death effect (electric death sprite: top row left-to-right looking right, bottom row right-to-left looking left)
            const spriteKey = 'electric-death';
            const animKey = isRight ? 'electric-death-r-anim' : 'electric-death-l-anim';
            const effectDuration = 650;

            if (this.scene.textures.exists(spriteKey)) {
                const deathSprite = this.scene.add.sprite(deathX, deathY, spriteKey, isRight ? 0 : 23);
                deathSprite.setDepth(10);
                deathSprite.setOrigin(0.5, 0.5);
                this.activeDeathSprite = deathSprite;

                if (this.scene.anims.exists(animKey)) {
                    deathSprite.play(animKey);
                }

                this.scene.tweens.add({
                    targets: deathSprite,
                    y: deathY - 12,
                    alpha: { from: 1, to: 0 },
                    duration: effectDuration,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        if (deathSprite.active) deathSprite.destroy();
                        if (this.activeDeathSprite === deathSprite) this.activeDeathSprite = undefined;
                        this.finishRespawn();
                    }
                });
            } else {
                this.scene.time.delayedCall(effectDuration, () => {
                    this.finishRespawn();
                });
            }
        } else {
            // Simple / normal death effect (simple death sprite: top row left-to-right looking right, bottom row right-to-left looking left)
            const spriteKey = 'simple-death';
            const animKey = isRight ? 'simple-death-r-anim' : 'simple-death-l-anim';
            const effectDuration = 550;

            if (this.scene.textures.exists(spriteKey)) {
                const deathSprite = this.scene.add.sprite(deathX, deathY, spriteKey, isRight ? 0 : 17);
                deathSprite.setDepth(10);
                deathSprite.setOrigin(0.5, 0.5);
                this.activeDeathSprite = deathSprite;

                if (this.scene.anims.exists(animKey)) {
                    deathSprite.play(animKey);
                }

                this.scene.tweens.add({
                    targets: deathSprite,
                    y: deathY - 24,
                    alpha: { from: 1, to: 0 },
                    duration: effectDuration,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        if (deathSprite.active) deathSprite.destroy();
                        if (this.activeDeathSprite === deathSprite) this.activeDeathSprite = undefined;
                        this.finishRespawn();
                    }
                });
            } else {
                this.scene.time.delayedCall(effectDuration, () => {
                    this.finishRespawn();
                });
            }
        }
    }
}
