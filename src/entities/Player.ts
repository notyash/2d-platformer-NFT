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

    // Spawns
    public spawnX: number = 100;
    public spawnY: number = 100;
    public activeSpawnX: number = 100;
    public activeSpawnY: number = 100;
    public lastSafeX: number = 100;
    public lastSafeY: number = 100;

    public bullets: Phaser.Physics.Arcade.Group;
    public soundManager?: SoundManager;

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

    constructor(scene: Phaser.Scene, x: number, y: number, soundManager?: SoundManager) {
        super(scene, x, y, 'idle-r');
        this.soundManager = soundManager;
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.setDepth(4);
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

    update() {
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

        if (!isGrounded) {
            const key = body.velocity.y < 0 ? (this.facing === 'right' ? 'jump-r' : 'jump-l') : (this.facing === 'right' ? 'fall-r' : 'fall-l');
            if (this.anims.isPlaying) this.anims.stop();
            if (this.texture.key !== key) this.setTexture(key);
            return;
        }
        
        if (isMovingHorizontally) {
            const key = this.facing === 'right' ? 'walk-r-anim' : 'walk-l-anim';
            if (this.anims.currentAnim?.key !== key) this.anims.play(key, true);
        } else {
            const key = this.facing === 'right' ? 'idle-r' : 'idle-l';
            if (this.anims.isPlaying) this.anims.stop();
            if (this.texture.key !== key) this.setTexture(key);
        }
    }

    die() {
        if (this.isInvincible) return;

        // If player has Totem Shield: absorb death without resetting stage
        if (this.hasTotem) {
            this.hasTotem = false; 
            this.isInvincible = true;
            this.setPosition(this.lastSafeX, this.lastSafeY); 
            this.setVelocity(0, 0); 
            this.setTint(0xffaa00); 
            this.soundManager?.playDeath();
            this.enforceKeyLift();
            this.scene.time.delayedCall(2000, () => {
                this.isInvincible = false;
                if (this.hasGun) this.setTint(0x00ffff); 
                else this.clearTint();
            });
            return;
        }

        // Full Death: Respawn at active checkpoint & reset stage
        this.setPosition(this.activeSpawnX, this.activeSpawnY); 
        this.setVelocity(0, 0);
        this.anims.stop(); 
        this.setTexture(this.facing === 'right' ? 'idle-r' : 'idle-l');
        this.hasGun = false; 
        this.clearTint();
        this.soundManager?.playDeath();
        this.enforceKeyLift();

        // Emit death event for collectibles & mobs reset
        this.scene.events.emit('player-death');
    }
}
