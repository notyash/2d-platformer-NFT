// src/entities/Player.ts
import Phaser from 'phaser';
import type { Facing } from '../types';

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

    public gunTimer?: Phaser.Time.TimerEvent;
    public bullets: Phaser.Physics.Arcade.Group;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'idle-r');
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
            }
        } else {
            this.canJump = true;
        }

        if (this.isNormalJump && !this.cursors.up.isDown && body.velocity.y < shortHopCap) {
            this.setVelocityY(shortHopCap); 
            this.isNormalJump = false; 
        }

        if (this.hasGun && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.shootBullet();
        }

        this.updateAnimationState(isGrounded);
        
        // Reset states that need to be re-evaluated each frame
        this.isOnPlatform = false; 
        this.isNearDoor = false; 
    }

    private shootBullet() {
        const bullet = this.bullets.create(this.x, this.y, 'bullet') as Phaser.Physics.Arcade.Sprite;
        bullet.body!.setSize(10, 10);
        bullet.setVelocityX(this.facing === 'right' ? 500 : -500);
        this.scene.time.delayedCall(1500, () => { if (bullet.active) bullet.destroy(); });
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

        if (this.hasTotem) {
            this.hasTotem = false; 
            this.isInvincible = true;
            this.setPosition(this.lastSafeX, this.lastSafeY); 
            this.setVelocity(0, 0); 
            this.setTint(0xffaa00); 
            this.scene.time.delayedCall(2000, () => {
                this.isInvincible = false;
                if (this.hasGun) this.setTint(0x00ffff); 
                else this.clearTint();
            });
            return;
        }

        this.setPosition(this.activeSpawnX, this.activeSpawnY); 
        this.setVelocity(0, 0);
        this.anims.stop(); 
        this.setTexture(this.facing === 'right' ? 'idle-r' : 'idle-l');
        this.hasGun = false; 
        this.clearTint();
    }
}