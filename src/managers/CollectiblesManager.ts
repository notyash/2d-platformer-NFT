// src/managers/CollectiblesManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';

export class CollectiblesManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;

    public coinsCollected: number = 0;
    public checkpointTimer?: Phaser.Time.TimerEvent;

    constructor(scene: Phaser.Scene, player: Player, uiManager: UIManager) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
    }

    setupCollectibles(map: Phaser.Tilemaps.Tilemap) {
        this.setupGroup(map, 'Coin', 'coin', 'coin-spin', (c) => {
            this.uiManager.showFloatingText(c.x, c.y - 10, '+1', '#FFD700');
            this.uiManager.spawnParticles(c.x, c.y, 0xFFD700);
            this.coinsCollected++;
        });

        this.setupGroup(map, 'TempCheckpoint', 'temp-checkpoint', 'cp-anim', (c) => {
            this.uiManager.showFloatingText(c.x, c.y - 10, 'CHECKPOINT!', '#D15FEE');
            this.uiManager.spawnParticles(c.x, c.y, 0xD15FEE);
            this.scene.cameras.main.shake(200, 0.01); 
            
            this.player.activeSpawnX = c.x; 
            this.player.activeSpawnY = c.y; 
            
            if (this.checkpointTimer) this.checkpointTimer.remove();
            this.checkpointTimer = this.scene.time.delayedCall(7000, () => { 
                this.player.activeSpawnX = this.player.spawnX; 
                this.player.activeSpawnY = this.player.spawnY; 
            });
        });

        this.setupGroup(map, 'GunPowerup', 'gun-powerup', 'gun-anim', (g) => {
            this.uiManager.showFloatingText(g.x, g.y - 10, 'GUN ACTIVE!', '#00FFFF');
            this.uiManager.spawnParticles(g.x, g.y, 0x00FFFF);
            this.scene.cameras.main.shake(200, 0.01);
            
            this.player.hasGun = true; 
            this.player.setTint(0x00ffff); 
            
            if (this.player.gunTimer) this.player.gunTimer.remove();
            this.player.gunTimer = this.scene.time.delayedCall(10000, () => { 
                this.player.hasGun = false; 
                if (!this.player.hasTotem) this.player.clearTint(); 
            });
        });

        this.setupGroup(map, 'Totem', 'totem', 'totem-anim', (t) => {
            this.uiManager.showFloatingText(t.x, t.y - 10, 'SHIELD!', '#FFD700');
            this.uiManager.spawnParticles(t.x, t.y, 0xFFD700);
            this.scene.cameras.main.shake(200, 0.01);
            
            this.player.hasTotem = true; 
            this.player.setTint(0xffd700); 
        });
    }

    private setupGroup(map: Phaser.Tilemaps.Tilemap, name: string, key: string, anim: string, onCollect: (obj: Phaser.GameObjects.Sprite) => void) {
        const objects = map.createFromObjects('Objects', { name, key });
        objects.forEach((obj: any) => {
            this.scene.physics.add.existing(obj, true);
            obj.setDepth(4);
            if (anim) obj.play(anim);
            this.addHoverTween(obj);

            this.scene.physics.add.overlap(this.player, obj, () => {
                onCollect(obj);
                obj.destroy();
            });
        });
    }

    private addHoverTween(obj: any) {
        const body = obj.body as Phaser.Physics.Arcade.Body;
        const startY = obj.y;
        this.scene.tweens.add({ 
            targets: obj, y: startY - 4, duration: 1000 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            onUpdate: () => { if (body) body.y = obj.y - (obj.height * obj.originY); }
        });
    }
}