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
    private gunSprites: Phaser.GameObjects.Sprite[] = [];
    private totemSprites: Phaser.GameObjects.Sprite[] = [];

    public coinsCollected: number = 0;
    private collectedItemKeys: Set<string> = new Set();

    // Checkpoint Snapshots
    private savedCheckpointCollectedKeys: Set<string> = new Set();
    private savedCheckpointCoins: number = 0;

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

    public addCoins(amount: number = 1) {
        this.coinsCollected += amount;
    }

    setupCollectibles(map: Phaser.Tilemaps.Tilemap) {
        this.map = map;
        this.spawnAllCollectibles();
        this.saveCheckpointSnapshot();
    }

    public saveCheckpointSnapshot() {
        this.savedCheckpointCollectedKeys = new Set(this.collectedItemKeys);
        this.savedCheckpointCoins = this.coinsCollected;
    }

    public rollbackToCheckpoint() {
        this.collectedItemKeys = new Set(this.savedCheckpointCollectedKeys);
        this.coinsCollected = this.savedCheckpointCoins;
        if (this.map) {
            this.spawnAllCollectibles();
        }
    }

    public spawnAllCollectibles() {
        // Clear existing active sprites
        this.coinSprites.forEach(s => { if (s && s.active) s.destroy(); });
        this.gunSprites.forEach(s => { if (s && s.active) s.destroy(); });
        this.totemSprites.forEach(s => { if (s && s.active) s.destroy(); });

        this.coinSprites = this.createGroup('Coin', 'coin', 'coin-spin', (c) => {
            this.uiManager.showFloatingText(c.x, c.y - 10, '+1 COIN', '#FFD700');
            this.uiManager.spawnParticles(c.x, c.y, 0xFFD700);
            this.coinsCollected++;
            this.soundManager?.playCoin();
        });

        this.gunSprites = this.createGroup('GunPowerup', 'gun-powerup', 'gun-anim', (g) => {
            this.uiManager.showFloatingText(g.x, g.y - 10, '+1 BLASTER [SLOT 1]', '#00FFFF');
            this.uiManager.spawnParticles(g.x, g.y, 0x00FFFF);
            this.scene.cameras.main.shake(150, 0.006);
            this.inventoryManager.addGun();
            this.soundManager?.playPowerup();
        });

        this.totemSprites = this.createGroup('Totem', 'totem', 'totem-anim', (t) => {
            this.uiManager.showFloatingText(t.x, t.y - 10, '+1 SHIELD [SLOT 2]', '#FFD700');
            this.uiManager.spawnParticles(t.x, t.y, 0xFFD700);
            this.scene.cameras.main.shake(150, 0.006); 
            this.inventoryManager.addTotem();
            this.soundManager?.playPowerup();
        });
    }

    public resetAll() {
        this.coinsCollected = 0;
        this.savedCheckpointCoins = 0;
        this.collectedItemKeys.clear();
        this.savedCheckpointCollectedKeys.clear();
        if (this.map) {
            this.spawnAllCollectibles();
        }
    }

    private createGroup(name: string, key: string, anim: string, onCollect: (obj: Phaser.GameObjects.Sprite) => void): Phaser.GameObjects.Sprite[] {
        const sprites: Phaser.GameObjects.Sprite[] = [];
        const objects = this.map.createFromObjects('Objects', { name, key });

        objects.forEach((obj: any) => {
            const uniqueKey = `${name}_${Math.round(obj.x)}_${Math.round(obj.y)}`;

            // Skip items that were collected BEFORE the active checkpoint
            if (this.collectedItemKeys.has(uniqueKey)) {
                obj.destroy();
                return;
            }

            this.scene.physics.add.existing(obj, true);
            obj.setDepth(4);
            obj.setData('uniqueKey', uniqueKey);
            if (anim && this.scene.anims.exists(anim)) {
                obj.play(anim);
            }
            this.addHoverTween(obj);
            sprites.push(obj);

            this.scene.physics.add.overlap(this.player, obj, () => {
                this.collectedItemKeys.add(uniqueKey);
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
