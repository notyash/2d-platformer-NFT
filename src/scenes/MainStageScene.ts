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
    private lastRPressTime: number = 0;
    private escKey!: Phaser.Input.Keyboard.Key;
    private rKey!: Phaser.Input.Keyboard.Key;
    private cKey!: Phaser.Input.Keyboard.Key;

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
        this.load.spritesheet('pipe-monster', 'assets/sprites/monsters/Devil_42x30_Red_Walk1_L_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.image('jump-pad-img', 'assets/sprites/jump-pad.png');
        this.load.spritesheet('coin', 'assets/sprites/collectibles/Coin_24x24_Anim.png', { frameWidth: 24, frameHeight: 24 });
        
        // Bullet spritesheet (16x16 grid from All_Fire_Bullet_Pixel_16x16_04.png)
        this.load.spritesheet('fire-bullets', 'assets/sprites/All_Fire_Bullet_Pixel_16x16_04.png', { frameWidth: 16, frameHeight: 16 });

        // Mob Sprites (Bug, Devil, Hedgehog, Bonsai Gripper, Pumpkin Bat, Sandal)
        this.load.spritesheet('mob-bug-green-l', 'assets/sprites/monsters/Bug_42x30_Green_Walk_L_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-bug-green-r', 'assets/sprites/monsters/Bug_42x30_Green_Walk_R_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-bug-yellow-l', 'assets/sprites/monsters/Bug_42x30_Yellow_Walk_L_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-bug-yellow-r', 'assets/sprites/monsters/Bug_42x30_Yellow_Walk_R_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-devil-l', 'assets/sprites/monsters/Devil_42x30_Red_Walk1_L_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-devil-r', 'assets/sprites/monsters/Devil_42x30_Red_Walk1_R_Anim.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-hedgehog-l', 'assets/sprites/monsters/Hedgehog_42x30_Purple_Walk_L.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-hedgehog-r', 'assets/sprites/monsters/Hedgehog_42x30_Purple_Walk_R.png', { frameWidth: 42, frameHeight: 30 });
        this.load.spritesheet('mob-bonsai-gripper', 'assets/sprites/monsters/Bonsai Gripper.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-pumpkin-bat', 'assets/sprites/monsters/Pumpkin Bat.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-sandal-l', 'assets/sprites/monsters/Sandal-Mob-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-sandal-r', 'assets/sprites/monsters/Sandal-Mob-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-lava-kappa', 'assets/sprites/monsters/Lava Kappa.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('mob-shiro-onna', 'assets/sprites/monsters/Shiro Onna.png');

        // Collectibles (Totem & Gun)
        this.load.image('totem', 'assets/sprites/collectibles/frog doll totem.png');
        this.load.image('gun-powerup', 'assets/sprites/collectibles/gun sprite.png');

        const particleSvg = `data:image/svg+xml;charset=utf8,<svg width="8" height="8" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="4" fill="%23FFFFFF"/></svg>`;
        const fireballSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="%23FF4500"/><circle cx="8" cy="8" r="5" fill="%23FF8C00"/><circle cx="8" cy="8" r="3" fill="%23FFFF00"/></svg>`;
        const enemyBulletSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="%23DC2626"/><circle cx="8" cy="8" r="5" fill="%23F87171"/><circle cx="8" cy="8" r="2.5" fill="%23FFFFFF"/></svg>`;
        const windParticleSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="6" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="1" width="16" height="4" rx="2" fill="%23BAE6FD"/></svg>`;

        this.load.image('particle', particleSvg);
        this.load.image('fireball', fireballSvg);
        this.load.image('enemy-bullet', enemyBulletSvg);
        this.load.image('wind-particle', windParticleSvg);

        // Player Sprites
        this.load.image('idle-r', 'assets/sprites/player/Main-Sprite-Standing-R.png');
        this.load.image('idle-l', 'assets/sprites/player/Main-Sprite-Standing-L.png');
        this.load.spritesheet('idle-wind-r', 'assets/sprites/player/Main-Sprite-Idle-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('idle-wind-l', 'assets/sprites/player/Main-Sprite-Idle-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-shoot', 'assets/sprites/player/Sprite-Shoot.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-jump-fall', 'assets/sprites/player/Main-Sprite-Jump-Fall.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('jump-r', 'assets/sprites/player/Melissa_Jump1_R.png');
        this.load.image('jump-l', 'assets/sprites/player/Melissa_Jump1_L.png');
        this.load.image('fall-r', 'assets/sprites/player/Melissa_Fall2_R.png');
        this.load.image('fall-l', 'assets/sprites/player/Melissa_Fall2_L.png');
        this.load.spritesheet('walk-r', 'assets/sprites/player/Main-Sprite-Walk-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('walk-l', 'assets/sprites/player/Main-Sprite-Walk-L.png', { frameWidth: 32, frameHeight: 32 });
    }

    create() {
        const map = this.make.tilemap({ key: 'stage1' });
        this.createLayers(map);
        this.createAnimations();

        // Enforce clean nearest-neighbor pixel sampling on mob textures to prevent edge bleeding
        const mobTextureKeys = [
            'mob-sandal-l', 'mob-sandal-r', 'mob-bonsai-gripper', 'pipe-monster',
            'mob-pumpkin-bat', 'mob-lava-kappa', 'mob-shiro-onna', 'mob-bug-green-l',
            'mob-bug-green-r', 'mob-bug-yellow-l', 'mob-bug-yellow-r', 'mob-devil-l',
            'mob-devil-r', 'mob-hedgehog-l', 'mob-hedgehog-r', 'coin'
        ];
        mobTextureKeys.forEach(key => {
            if (this.textures.exists(key)) {
                this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
        });

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
        this.uiManager.createHUD(
            () => {
                if (this.isGamePaused) {
                    this.resumeGame();
                } else {
                    this.pauseGame();
                }
            },
            () => {
                this.restartFullRun();
            }
        );

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

        // ESC, R, and C Key listeners
        if (this.input.keyboard) {
            this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
            this.escKey.on('down', () => {
                if (this.isGamePaused) {
                    this.resumeGame();
                } else {
                    this.pauseGame();
                }
            });

            this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
            this.rKey.on('down', () => {
                const now = Date.now();
                if (now - this.lastRPressTime <= 650) {
                    this.lastRPressTime = 0;
                    this.restartFullRun();
                } else {
                    this.lastRPressTime = now;
                    this.uiManager.showFloatingText(
                        this.player.x, 
                        this.player.y - 25, 
                        'PRESS [R] AGAIN TO RESTART', 
                        '#F87171', 
                        800, 
                        25
                    );
                }
            });

            this.cKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
            this.cKey.on('down', () => {
                if (this.envManager.hasActiveCheckpoint()) {
                    this.respawnAtActiveCheckpoint();
                } else {
                    this.uiManager.showFloatingText(
                        this.player.x, 
                        this.player.y - 25, 
                        'NO CHECKPOINT ACTIVE', 
                        '#94A3B8', 
                        800, 
                        25
                    );
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
        if (this.isGamePaused) {
            this.resumeGame();
        }
        this.uiManager.hideDeathScreen();
        this.uiManager.hidePauseMenu();
        this.totalDeaths++;
        this.player.setPosition(this.player.activeSpawnX, this.player.activeSpawnY);
        this.player.setVelocity(0, 0);
        const idleKey = this.player.facing === 'right' ? 'idle-r-anim' : 'idle-l-anim';
        if (this.anims.exists(idleKey)) {
            this.player.anims.play(idleKey, true);
        } else {
            this.player.anims.stop();
            this.player.setTexture(this.player.facing === 'right' ? 'idle-r' : 'idle-l');
        }
        this.player.enforceKeyLift();

        this.collectiblesManager.rollbackToCheckpoint();
        this.enemyManager.rollbackToCheckpoint();
        this.inventoryManager.rollbackToCheckpoint();
        this.player.bullets.clear(true, true);

        this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'RESPAWNED AT CHECKPOINT', '#38BDF8', 1200);
        this.soundManager?.playPowerup();
    }

    private restartFullRun() {
        if (this.isGamePaused) {
            this.resumeGame();
        }
        this.uiManager.hideDeathScreen();
        this.uiManager.hidePauseMenu();
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
        this.anims.create({ key: 'idle-r-anim', frames: this.anims.generateFrameNumbers('idle-wind-r', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'idle-l-anim', frames: this.anims.generateFrameNumbers('idle-wind-l', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'shoot-l-anim', frames: this.anims.generateFrameNumbers('player-shoot', { start: 0, end: 1 }), frameRate: 8, repeat: 0 });
        this.anims.create({ key: 'shoot-r-anim', frames: [{ key: 'player-shoot', frame: 3 }, { key: 'player-shoot', frame: 2 }], frameRate: 8, repeat: 0 });
        this.anims.create({ key: 'walk-r-anim', frames: this.anims.generateFrameNumbers('walk-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-l-anim', frames: this.anims.generateFrameNumbers('walk-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'coin-spin', frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
        
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

        // Bonsai Gripper, Pumpkin Bat, Sandal Mob
        this.anims.create({ key: 'mob-bonsai-gripper-walk-l', frames: this.anims.generateFrameNumbers('mob-bonsai-gripper', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-bonsai-gripper-walk-r', frames: this.anims.generateFrameNumbers('mob-bonsai-gripper', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-gripper-walk-l', frames: this.anims.generateFrameNumbers('mob-bonsai-gripper', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-gripper-walk-r', frames: this.anims.generateFrameNumbers('mob-bonsai-gripper', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });

        // Pumpkin Bat: 6 frames total - 0..2 Left fly, 3..5 Right fly
        this.anims.create({ key: 'mob-pumpkin-bat-walk-l', frames: this.anims.generateFrameNumbers('mob-pumpkin-bat', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-pumpkin-bat-walk-r', frames: this.anims.generateFrameNumbers('mob-pumpkin-bat', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-bat-walk-l', frames: this.anims.generateFrameNumbers('mob-pumpkin-bat', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-bat-walk-r', frames: this.anims.generateFrameNumbers('mob-pumpkin-bat', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });

        // Sandal Mob: 4 frames each
        this.anims.create({ key: 'mob-sandal-walk-l', frames: this.anims.generateFrameNumbers('mob-sandal-l', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-sandal-walk-r', frames: this.anims.generateFrameNumbers('mob-sandal-r', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-sandal-mob-walk-l', frames: this.anims.generateFrameNumbers('mob-sandal-l', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-sandal-mob-walk-r', frames: this.anims.generateFrameNumbers('mob-sandal-r', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });

        // Lava Kappa: 8 frames total - 0..3 Left walk, 4..7 Right walk
        this.anims.create({ key: 'mob-lava-kappa-walk-l', frames: this.anims.generateFrameNumbers('mob-lava-kappa', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-lava-kappa-walk-r', frames: this.anims.generateFrameNumbers('mob-lava-kappa', { start: 4, end: 7 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-kappa-walk-l', frames: this.anims.generateFrameNumbers('mob-lava-kappa', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-kappa-walk-r', frames: this.anims.generateFrameNumbers('mob-lava-kappa', { start: 4, end: 7 }), frameRate: 8, repeat: -1 });

        // Pipe Monster (Devil)
        this.anims.create({ key: 'pipe-monster-anim', frames: this.anims.generateFrameNumbers('pipe-monster', { start: 0, end: 5 }), frameRate: 6, repeat: -1 });
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
