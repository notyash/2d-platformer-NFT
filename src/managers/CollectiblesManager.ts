// src/managers/CollectiblesManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';
import { InventoryManager } from './InventoryManager';
import { SoundManager } from './SoundManager';

export class CollectiblesManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;
    private inventoryManager: InventoryManager;
    private soundManager?: SoundManager;
    private map!: Phaser.Tilemaps.Tilemap;

    private coinSprites: Phaser.GameObjects.Sprite[] = [];
    private cpSprites: Phaser.GameObjects.Sprite[] = [];
    private gunSprites: Phaser.GameObjects.Sprite[] = [];
    private totemSprites: Phaser.GameObjects.Sprite[] = [];

    public coinsCollected: number = 0;

    constructor(
        scene: Phaser.Scene, 
        player: Player, 
        uiManager: UIManager, 
        inventoryManager: InventoryManager,
        soundManager?: SoundManager
    ) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
        this.inventoryManager = inventoryManager;
        this.soundManager = soundManager;
    }

    setupCollectibles(map: Phaser.Tilemaps.Tilemap) {
        this.map = map;
        this.spawnAllCollectibles(true);
    }

    public spawnAllCollectibles(forceRespawnCP: boolean = true) {
        // Clear & Spawn Coins
        this.coinSprites.forEach(s => { if (s && s.active) s.destroy(); });
        this.coinSprites = this.createGroup('Coin', 'coin', 'coin-spin', (c) => {
            this.uiManager.showFloatingText(c.x, c.y - 10, '+1 COIN', '#FFD700');
            this.uiManager.spawnParticles(c.x, c.y, 0xFFD700);
            this.coinsCollected++;
            this.soundManager?.playCoin();
        });

        // Clear & Spawn Guns
        this.gunSprites.forEach(s => { if (s && s.active) s.destroy(); });
        this.gunSprites = this.createGroup('GunPowerup', 'gun-powerup', 'gun-anim', (g) => {
            this.uiManager.showFloatingText(g.x, g.y - 10, '+1 BLASTER [SLOT 1]', '#00FFFF');
            this.uiManager.spawnParticles(g.x, g.y, 0x00FFFF);
            this.scene.cameras.main.shake(150, 0.006);
            this.inventoryManager.addGun();
            this.soundManager?.playPowerup();
        });

        // Clear & Spawn Totems
        this.totemSprites.forEach(s => { if (s && s.active) s.destroy(); });
        this.totemSprites = this.createGroup('Totem', 'totem', 'totem-anim', (t) => {
            this.uiManager.showFloatingText(t.x, t.y - 10, '+1 SHIELD [SLOT 2]', '#FFD700');
            this.uiManager.spawnParticles(t.x, t.y, 0xFFD700);
            this.scene.cameras.main.shake(150, 0.006); 
            this.inventoryManager.addTotem();
            this.soundManager?.playPowerup();
        });

        // Spawn Checkpoints only if forced OR if temp checkpoint is not currently active
        if (forceRespawnCP || !this.inventoryManager.isTempCheckpointActive()) {
            this.cpSprites.forEach(s => { if (s && s.active) s.destroy(); });
            this.cpSprites = this.createGroup('TempCheckpoint', 'temp-checkpoint', 'cp-anim', (c) => {
                this.uiManager.showFloatingText(c.x, c.y - 10, '+1 CHECKPOINT [SLOT 3]', '#D15FEE');
                this.uiManager.spawnParticles(c.x, c.y, 0xD15FEE);
                this.scene.cameras.main.shake(150, 0.006); 
                this.inventoryManager.addCheckpoint();
                this.soundManager?.playPowerup();
            });
        }
    }

    public resetAll(forceRespawnCP: boolean = false) {
        this.coinsCollected = 0;
        if (this.map) {
            this.spawnAllCollectibles(forceRespawnCP);
        }
    }

    private createGroup(name: string, key: string, anim: string, onCollect: (obj: Phaser.GameObjects.Sprite) => void): Phaser.GameObjects.Sprite[] {
        const sprites: Phaser.GameObjects.Sprite[] = [];
        const objects = this.map.createFromObjects('Objects', { name, key });
        objects.forEach((obj: any) => {
            this.scene.physics.add.existing(obj, true);
            obj.setDepth(4);
            if (anim) obj.play(anim);
            this.addHoverTween(obj);
            sprites.push(obj);

            this.scene.physics.add.overlap(this.player, obj, () => {
                onCollect(obj);
                const idx = sprites.indexOf(obj);
                if (idx > -1) sprites.splice(idx, 1);
                obj.destroy();
            });
        });
        return sprites;
    }

    private addHoverTween(obj: any) {
        const body = obj.body as Phaser.Physics.Arcade.Body;
        const startY = obj.y;
        this.scene.tweens.add({ 
            targets: obj, y: startY - 4, duration: 1000 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            onUpdate: () => { if (body && obj.active) body.y = obj.y - (obj.height * obj.originY); }
        });
    }
}
