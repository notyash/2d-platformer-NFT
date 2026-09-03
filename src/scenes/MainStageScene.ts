// src/scenes/MainStageScene.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { EnvironmentManager } from '../managers/EnvironmentManager';
import { EnemyManager } from '../managers/EnemyManager';
import { CollectiblesManager } from '../managers/CollectiblesManager';
import { UIManager } from '../managers/UIManager';
import { InventoryManager } from '../managers/InventoryManager';
import { SoundManager } from '../managers/SoundManager';

export class MainStageScene extends Phaser.Scene {
    private player!: Player;
    private envManager!: EnvironmentManager;
    private enemyManager!: EnemyManager;
    private collectiblesManager!: CollectiblesManager;
    private uiManager!: UIManager;
    private inventoryManager!: InventoryManager;
    private soundManager!: SoundManager;

    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private oneWayLayer!: Phaser.Tilemaps.TilemapLayer;

    // Hardcore Speedrun & Death State
    private initialSpawnX: number = 100;
    private initialSpawnY: number = 100;
    private startTime: number = 0;
    private totalPausedTime: number = 0;
    private pauseStartTime: number = 0;
    public isGamePaused: boolean = false;
    public totalDeaths: number = 0;

    private escKey!: Phaser.Input.Keyboard.Key;

    constructor() {
        super('MainStageScene');
    }

    preload() {
        this.load.image('levelobjects', 'assets/tilesets/LevelObjectTiles.png');
        this.load.image('landtiles', 'assets/tilesets/LandTiles_32_32.png');
        this.load.image('sky', 'assets/tilesets/sky.png');
        this.load.image('clouds1', 'assets/tilesets/clouds1.png');
        this.load.image('smallTree', 'assets/tilesets/smallTree.png');
        this.load.image('largeTree', 'assets/tilesets/largeTree.png');
        this.load.image('grass', 'assets/tilesets/grass.png');
        this.load.image('cloud2', 'assets/tilesets/cloud2.png');
        this.load.tilemapTiledJSON('stage1', 'assets/tilemaps/harder-main-stage.json');

        // Tileset overlays
        this.load.image('plain-ground', 'assets/tilesets/plainGround.png');

        this.load.image('moving-platform-img', 'assets/sprites/moving-platform.png');
        this.load.image('pipe-monster', 'assets/sprites/monsters/Devil_Red_Stand_L.png');
        this.load.image('jump-pad-img', 'assets/sprites/jump-pad.png');
        this.load.spritesheet('coin', 'assets/sprites/Coin_24x24_Anim.png', { frameWidth: 24, frameHeight: 24 });
        
        // Bullet spritesheet (16x16 grid from All_Fire_Bullet_Pixel_16x16_04.png)
        this.load.spritesheet('fire-bullets', 'assets/sprites/All_Fire_Bullet_Pixel_16x16_04.png', { frameWidth: 16, frameHeight: 16 });

        // Placeholder Mobs (Bug, Devil, Hedgehog) - 42x30 frames
        this.load.spritesheet('mob-bug-green-l', 'assets/sprites/monsters/Bug_42x30_Green_Walk_L_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-bug-green-r', 'assets/sprites/monsters/Bug_42x30_Green_Walk_R_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-bug-yellow-l', 'assets/sprites/monsters/Bug_42x30_Yellow_Walk_L_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-bug-yellow-r', 'assets/sprites/monsters/Bug_42x30_Yellow_Walk_R_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-devil-l', 'assets/sprites/monsters/Devil_42x30_Red_Walk1_L_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-devil-r', 'assets/sprites/monsters/Devil_42x30_Red_Walk1_R_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-hedgehog-l', 'assets/sprites/monsters/Hedgehog_42x30_Purple_Walk_L.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-hedgehog-r', 'assets/sprites/monsters/Hedgehog_42x30_Purple_Walk_R.png', { frameWidth: 42, frameHeight: 30 });

        const totemSvg = `data:image/svg+xml;charset=utf8,<svg width="96" height="24" xmlns="http://www.w3.org/2000/svg"><g stroke="%23B8860B" stroke-width="2"><polygon fill="%23FFD700" points="12,2 22,12 12,22 2,12"/><polygon fill="%23FFEA00" points="36,4 42,12 36,20 30,12"/><polygon fill="%23FFFF00" points="60,6 62,12 60,18 58,12"/><polygon fill="%23FFEA00" points="84,4 90,12 84,20 78,12"/></g></svg>`;
        const gunSvg = `data:image/svg+xml;charset=utf8,<svg width="96" height="24" xmlns="http://www.w3.org/2000/svg"><g stroke="%23008B8B" stroke-width="2"><rect fill="%2300FFFF" x="4" y="6" width="16" height="12" rx="4"/><rect fill="%23E0FFFF" x="28" y="8" width="16" height="8" rx="2"/><rect fill="%23FFFFFF" x="52" y="10" width="16" height="4" rx="1"/><rect fill="%23E0FFFF" x="76" y="8" width="16" height="8" rx="2"/></g></svg>`;
        const particleSvg = `data:image/svg+xml;charset=utf8,<svg width="8" height="8" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="4" fill="%23FFFFFF"/></svg>`;
        const fireballSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="%23FF4500"/><circle cx="8" cy="8" r="5" fill="%23FF8C00"/><circle cx="8" cy="8" r="3" fill="%23FFFF00"/></svg>`;
        const enemyBulletSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="%23DC2626"/><circle cx="8" cy="8" r="5" fill="%23F87171"/><circle cx="8" cy="8" r="2.5" fill="%23FFFFFF"/></svg>`;
        const windParticleSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="6" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="1" width="16" height="4" rx="2" fill="%23BAE6FD"/></svg>`;

        this.load.spritesheet('totem', totemSvg, { frameWidth: 24, frameHeight: 24 });
        this.load.spritesheet('gun-powerup', gunSvg, { frameWidth: 24, frameHeight: 24 });
        this.load.image('particle', particleSvg);
        this.load.image('fireball', fireballSvg);
        this.load.image('enemy-bullet', enemyBulletSvg);
        this.load.image('wind-particle', windParticleSvg);

        this.load.image('idle-r', 'assets/sprites/player/Melissa_Stand_R.png');
        this.load.image('idle-l', 'assets/sprites/player/Melissa_Stand_L.png');
        this.load.image('jump-r', 'assets/sprites/player/Melissa_Jump1_R.png');
        this.load.image('jump-l', 'assets/sprites/player/Melissa_Jump1_L.png');
        this.load.image('fall-r', 'assets/sprites/player/Melissa_Fall2_R.png');
        this.load.image('fall-l', 'assets/sprites/player/Melissa_Fall2_L.png');
        this.load.spritesheet('walk-r', 'assets/sprites/player/Melissa_Walk_Anim_R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('walk-l', 'assets/sprites/player/new_player.png', { frameWidth: 32, frameHeight: 32 });
    }

    create() {
        const map = this.make.tilemap({ key: 'stage1' });
        this.createLayers(map);
        this.createAnimations();

        const rawMapObjects = map.getObjectLayer('Objects')?.objects || [];
        
        // Find initial spawn
        let spawnX = 100, spawnY = 100;
        const spawnObject = rawMapObjects.find(obj => obj.name === 'Spawn');
        if (spawnObject && spawnObject.x !== undefined && spawnObject.y !== undefined) {
            spawnX = spawnObject.x; 
            spawnY = spawnObject.y;
        }

        this.initialSpawnX = spawnX;
        this.initialSpawnY = spawnY;

        // Initialize Managers
        this.soundManager = new SoundManager(this);
        this.uiManager = new UIManager(this, this.soundManager);
        this.uiManager.createHUD(() => {
            if (this.isGamePaused) {
                this.resumeGame();
            } else {
                this.pauseGame();
            }
        });

        this.player = new Player(this, spawnX, spawnY, this.soundManager);
        this.player.spawnX = spawnX; this.player.spawnY = spawnY;
        this.player.activeSpawnX = spawnX; this.player.activeSpawnY = spawnY;
        this.player.lastSafeX = spawnX; this.player.lastSafeY = spawnY;

        this.inventoryManager = new InventoryManager(this, this.player, this.uiManager, this.soundManager);
        this.envManager = new EnvironmentManager(this, this.player, this.uiManager, this.inventoryManager, this.soundManager);
        this.collectiblesManager = new CollectiblesManager(this, this.player, this.uiManager, this.inventoryManager, this.soundManager);
        this.enemyManager = new EnemyManager(this, this.player, this.uiManager, this.collectiblesManager, this.soundManager);

        // Setup Entities & Level Objects
        this.enemyManager.setupGroundMobs(rawMapObjects, this.groundLayer, this.oneWayLayer);
        this.enemyManager.setupPipeMonsters(map, rawMapObjects);
        
        this.envManager.setupCheckpoints(rawMapObjects);
        this.envManager.setupFakeGround(rawMapObjects);
        this.envManager.setupWindZones(rawMapObjects);
        this.envManager.setupDoors(rawMapObjects);
        this.envManager.setupGunDisarmZones(rawMapObjects);
        this.envManager.setupMovingPlatforms(map, rawMapObjects);
        this.envManager.setupJumpPads(rawMapObjects);
        this.envManager.setupFirebars(rawMapObjects);
        this.envManager.setupSmashTriggers(map);
        
        this.collectiblesManager.setupCollectibles(map);

        // Checkpoint snapshot listener
        this.events.on('checkpoint-saved', () => {
            this.collectiblesManager.saveCheckpointSnapshot();
            this.enemyManager.saveCheckpointSnapshot();
            this.inventoryManager.saveCheckpointSnapshot();
        });

        // Player death event: rollback state to active checkpoint snapshot
        this.events.on('player-death', () => {
            this.totalDeaths++;
            this.collectiblesManager.rollbackToCheckpoint();
            this.enemyManager.rollbackToCheckpoint();
            this.inventoryManager.rollbackToCheckpoint();
            this.player.bullets.clear(true, true);
        });

        // ESC Key listener for Pause Menu
        if (this.input.keyboard) {
            this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
            this.escKey.on('down', () => {
                if (this.isGamePaused) {
                    this.resumeGame();
                } else {
                    this.pauseGame();
                }
            });
        }

        // Accidental Reload Guard (beforeunload event)
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
        });

        // World Colliders
        this.physics.add.collider(this.player, this.groundLayer);
        this.physics.add.collider(this.player, this.oneWayLayer, undefined, (_p, tile) => {
            const t = tile as Phaser.Tilemaps.Tile;
            if (t.index === -1) return false; 
            const body = this.player.body as Phaser.Physics.Arcade.Body;
            return body.velocity.y > 0 && body.bottom <= t.pixelY + 10;
        });

        // Bullets vs Ground / Walls
        this.physics.add.collider(this.player.bullets, this.groundLayer, (bulletObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            this.uiManager.spawnParticles(bullet.x, bullet.y, 0xFF8C00);
            bullet.destroy();
        });

        const smashLayer = map.getLayer('SmashGround')?.tilemapLayer;
        if (smashLayer) {
            this.physics.add.collider(this.player, smashLayer, undefined, (_p, tile) => {
                const t = tile as Phaser.Tilemaps.Tile;
                if (t.index === -1) return false;
                const body = this.player.body as Phaser.Physics.Arcade.Body;
                return body.velocity.y > 0 && body.bottom <= t.pixelY + 10 && !this.player.canSmash;
            });

            this.physics.add.collider(this.player.bullets, smashLayer, (bulletObj) => {
                const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                this.uiManager.spawnParticles(bullet.x, bullet.y, 0xFF8C00);
                bullet.destroy();
            });
        }

        const hazardsLayer = map.getLayer('Hazards')?.tilemapLayer;
        if (hazardsLayer) {
            this.physics.add.overlap(this.player, hazardsLayer, () => this.player.die(), (_p, tile) => (tile as Phaser.Tilemaps.Tile).index !== -1);
        }

        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.startFollow(this.player);
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.TILE_BIAS = 32;

        this.game.canvas.setAttribute('tabindex', '0');
        this.game.canvas.focus();
        this.input.on('pointerdown', () => this.game.canvas.focus());

        this.startTime = this.time.now;
        this.totalPausedTime = 0;
    }

    private beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
    };

    private pauseGame() {
        this.isGamePaused = true;
        this.pauseStartTime = this.time.now;
        this.physics.pause();
        this.player.anims.pause();
        this.soundManager.playMenuSelect();

        const formattedTime = this.getFormattedElapsedTime();
        const hasCheckpoint = this.envManager.hasActiveCheckpoint();

        this.uiManager.showPauseMenu(
            () => this.resumeGame(),
            () => this.respawnAtActiveCheckpoint(),
            () => this.restartFullRun(),
            {
                time: formattedTime,
                deaths: this.totalDeaths,
                coins: this.collectiblesManager.coinsCollected,
                kills: this.enemyManager.enemiesKilled,
                hasCheckpoint: hasCheckpoint
            }
        );
    }

    private resumeGame() {
        if (!this.isGamePaused) return;
        this.isGamePaused = false;
        this.totalPausedTime += (this.time.now - this.pauseStartTime);
        this.physics.resume();
        this.player.anims.resume();
        this.uiManager.hidePauseMenu();
        this.soundManager.playMenuSelect();
    }

    private respawnAtActiveCheckpoint() {
        this.resumeGame();
        this.totalDeaths++;
        this.player.setPosition(this.player.activeSpawnX, this.player.activeSpawnY);
        this.player.setVelocity(0, 0);
        this.player.anims.stop();
        this.player.setTexture(this.player.facing === 'right' ? 'idle-r' : 'idle-l');
        this.player.enforceKeyLift();

        this.collectiblesManager.rollbackToCheckpoint();
        this.enemyManager.rollbackToCheckpoint();
        this.inventoryManager.rollbackToCheckpoint();
        this.player.bullets.clear(true, true);

        this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'RESPAWNED AT CHECKPOINT', '#38BDF8', 1200);
        this.soundManager?.playPowerup();
    }

    private restartFullRun() {
        this.resumeGame();
        this.totalDeaths = 0;
        this.startTime = this.time.now;
        this.totalPausedTime = 0;

        // Reset spawn back to stage entrance (0%)
        this.player.spawnX = this.initialSpawnX;
        this.player.spawnY = this.initialSpawnY;
        this.player.activeSpawnX = this.initialSpawnX;
        this.player.activeSpawnY = this.initialSpawnY;
        this.player.lastSafeX = this.initialSpawnX;
        this.player.lastSafeY = this.initialSpawnY;
        this.player.setPosition(this.initialSpawnX, this.initialSpawnY);
        this.player.setVelocity(0, 0);
        this.player.hasGun = false;
        this.player.hasTotem = false;
        this.player.clearTint();
        this.player.bullets.clear(true, true);
        this.player.enforceKeyLift();

        this.collectiblesManager.resetAll();
        this.enemyManager.resetAll();
        this.inventoryManager.resetAll();
        this.envManager.resetAll();
        this.envManager.resetCheckpoints();

        this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'RUN RESTARTED', '#38BDF8', 1200);
        this.soundManager?.playPowerup();
    }

    private getFormattedElapsedTime(): string {
        const elapsedMs = Math.max(0, this.time.now - this.startTime - this.totalPausedTime);
        const minutes = Math.floor(elapsedMs / 60000);
        const seconds = Math.floor((elapsedMs % 60000) / 1000);
        const millis = Math.floor(elapsedMs % 1000);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    }

    private createLayers(map: Phaser.Tilemaps.Tilemap) {
        const levelObjectsTileset = map.addTilesetImage('LevelObjectTiles', 'levelobjects');
        const landTileset = map.addTilesetImage('LandTiles_32_32', 'landtiles');
        const skyTileset = map.addTilesetImage('sky', 'sky');
        const clouds1Tileset = map.addTilesetImage('clouds1', 'clouds1');
        const cloud2Tileset = map.addTilesetImage('cloud2', 'cloud2');
        const smallTreeTileset = map.addTilesetImage('smallTree', 'smallTree');
        const largeTreeTileset = map.addTilesetImage('largeTree', 'largeTree');
        const grassTileset = map.addTilesetImage('grass', 'grass');

        const allTilesets = [levelObjectsTileset, landTileset, skyTileset, clouds1Tileset, cloud2Tileset, smallTreeTileset, largeTreeTileset, grassTileset].filter(Boolean) as Phaser.Tilemaps.Tileset[];

        map.createLayer('Sky', allTilesets, 0, 0)?.setDepth(0);
        map.createLayer('Trees', allTilesets, 0, 0)?.setDepth(1);
        map.createLayer('Background', allTilesets, 0, 0)?.setDepth(2);
        
        const transparentLayer = map.createLayer('Transparent', allTilesets, 0, 0);
        if (transparentLayer) {
            transparentLayer.setDepth(2.7);
        }

        this.groundLayer = map.createLayer('Ground', allTilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
        this.groundLayer.setDepth(3);
        this.groundLayer.setCollisionByExclusion([-1]);

        this.oneWayLayer = map.createLayer('OneWayPlatforms', allTilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
        this.oneWayLayer.setDepth(4);
        this.oneWayLayer.setCollisionByExclusion([-1]);

        const smashLayer = map.createLayer('SmashGround', allTilesets, 0, 0);
        if (smashLayer) {
            smashLayer.setDepth(4);
            smashLayer.setCollisionByExclusion([-1]);
        }

        const hazardsLayer = map.createLayer('Hazards', allTilesets, 0, 0);
        if (hazardsLayer) {
            hazardsLayer.setDepth(5);
            hazardsLayer.setCollisionByExclusion([-1]);
        }

        map.createLayer('Foreground', allTilesets, 0, 0)?.setDepth(7);
    }

    private createAnimations() {
        this.anims.create({ key: 'walk-r-anim', frames: this.anims.generateFrameNumbers('walk-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-l-anim', frames: this.anims.generateFrameNumbers('walk-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'coin-spin', frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'totem-anim', frames: this.anims.generateFrameNumbers('totem', { start: 0, end: 3 }), frameRate: 8, yoyo: true, repeat: -1 });
        this.anims.create({ key: 'gun-anim', frames: this.anims.generateFrameNumbers('gun-powerup', { start: 0, end: 3 }), frameRate: 12, yoyo: true, repeat: -1 });
        
        // Bullet Fire Animation (4-frame spinning flame blast: frames 40-43 in 16x16 grid)
        this.anims.create({ key: 'fire-bullet-anim', frames: this.anims.generateFrameNumbers('fire-bullets', { start: 40, end: 43 }), frameRate: 14, repeat: -1 });

        // Bug (Green & Yellow) - 42x30 (4 frames)
        this.anims.create({ key: 'mob-bug-green-walk-l', frames: this.anims.generateFrameNumbers('mob-bug-green-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-bug-green-walk-r', frames: this.anims.generateFrameNumbers('mob-bug-green-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-bug-yellow-walk-l', frames: this.anims.generateFrameNumbers('mob-bug-yellow-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-bug-yellow-walk-r', frames: this.anims.generateFrameNumbers('mob-bug-yellow-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });

        // Devil - 42x30 (4 frames)
        this.anims.create({ key: 'mob-devil-walk-l', frames: this.anims.generateFrameNumbers('mob-devil-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-devil-walk-r', frames: this.anims.generateFrameNumbers('mob-devil-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });

        // Hedgehog - 42x30 (4 frames)
        this.anims.create({ key: 'mob-hedgehog-walk-l', frames: this.anims.generateFrameNumbers('mob-hedgehog-l', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-hedgehog-walk-r', frames: this.anims.generateFrameNumbers('mob-hedgehog-r', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
    }

    update() {
        if (this.isGamePaused) {
            this.uiManager.updatePauseMenu();
            return;
        }

        const formattedTime = this.getFormattedElapsedTime();

        this.uiManager.updateHUD(
            formattedTime, 
            this.collectiblesManager.coinsCollected, 
            this.enemyManager.enemiesKilled,
            this.totalDeaths
        );

        this.player.update();
        this.inventoryManager.update();
        this.enemyManager.update(this.groundLayer, this.oneWayLayer);
        this.envManager.update();
    }
}
