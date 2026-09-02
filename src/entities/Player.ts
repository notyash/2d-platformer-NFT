// src/entities/Player.ts
import Phaser from 'phaser';
import type { Facing } from '../types';
import { SoundManager } from '../managers/SoundManager';

export class Player extends Phaser.Physics.Arcade.Sprite {
    public cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    public spaceKey: Phaser.Input.Keyboard.Key;
    public enterKey: Phaser.Input.Keyboard.Key;

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
    private lastEmptyShotTime: number = 0;

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

        this.bullets = scene.physics.add.group({ allowGravity: false });
    }

    update() {
        const speed = 200, jumpSpeed = 400, shortHopCap = -150;
        const body = this.body as Phaser.Physics.Arcade.Body;
        const isGrounded = body.blocked.down || this.isOnPlatform;

        this.setVelocityX(0);

        if (this.cursors.left.isDown) { 
            this.setVelocityX(-speed); 
            this.facing = 'left'; 
        } else if (this.cursors.right.isDown) { 
            this.setVelocityX(speed); 
            this.facing = 'right'; 
        }

        if (isGrounded && !this.isInvincible) {
            this.lastSafeX = this.x; 
            this.lastSafeY = this.y - 10; 
        }

        if (isGrounded) {
            if (this.cursors.up.isDown && this.canJump && this.scene.time.now > this.ignoreGroundJumpUntil) {
                this.setVelocityY(-jumpSpeed); 
                this.canJump = false; 
                this.isNormalJump = true; 
                this.soundManager?.playJump();
            }
        } else {
            this.canJump = true;
        }

        if (this.isNormalJump && !this.cursors.up.isDown && body.velocity.y < shortHopCap) {
            this.setVelocityY(shortHopCap); 
            this.isNormalJump = false; 
        }

        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            if (this.hasGun) {
                this.shootBullet();
            } else if (this.scene.time.now > this.lastEmptyShotTime + 500) {
                this.lastEmptyShotTime = this.scene.time.now;
                this.scene.events.emit('empty-gun-shot', this.x, this.y);
            }
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
        const bulletLifespanMs = 600; // ~300px travel range (~9-10 tiles)

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

        // Emit death event for collectibles & mobs reset
        this.scene.events.emit('player-death');
    }
}
