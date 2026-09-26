// src/scenes/MainStageScene.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { EnvironmentManager } from '../managers/EnvironmentManager';
import { EnemyManager } from '../managers/EnemyManager';
import { CollectiblesManager } from '../managers/CollectiblesManager';
import { UIManager } from '../managers/UIManager';
import { InventoryManager } from '../managers/InventoryManager';
import { SoundManager } from '../managers/SoundManager';
import { SecurityManager } from '../managers/SecurityManager';
import { LeaderboardManager } from '../managers/LeaderboardManager';
import { InputRecorder } from '../managers/InputRecorder';
import { SurrealService } from '../services/SurrealService';
import { EleckingBoss } from '../entities/EleckingBoss';

export class MainStageScene extends Phaser.Scene {
    private player!: Player;
    private envManager!: EnvironmentManager;
    private enemyManager!: EnemyManager;
    private collectiblesManager!: CollectiblesManager;
    private uiManager!: UIManager;
    private inventoryManager!: InventoryManager;
    private soundManager!: SoundManager;
    private eleckingBoss?: EleckingBoss;

    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private oneWayLayer!: Phaser.Tilemaps.TilemapLayer;
    private smashLayer?: Phaser.Tilemaps.TilemapLayer;
    private hazardsLayer?: Phaser.Tilemaps.TilemapLayer;
    private allTilesets: Phaser.Tilemaps.Tileset[] = [];

    // Hardcore Speedrun & Death State
    private initialSpawnX: number = 100;
    private initialSpawnY: number = 100;
    private activeRunTimeMs: number = 0;
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
        this.load.image('sky', 'assets/sprites/background/sky.png');
        this.load.image('clouds1', 'assets/sprites/background/clouds1.png');
        this.load.image('smallTree', 'assets/sprites/background/smallTree.png');
        this.load.image('largeTree', 'assets/sprites/background/largeTree.png');
        this.load.image('grass', 'assets/sprites/background/grass.png');
        this.load.image('cloud2', 'assets/sprites/background/cloud2.png');
        this.load.tilemapTiledJSON('stage1', 'assets/tilemaps/harder-main-stage.json');

        // Tileset overlays
        this.load.image('plain-ground', 'assets/sprites/blocks/plainGround.png');
        this.load.image('plainGround', 'assets/sprites/blocks/plainGround.png');
        this.load.image('plain-dungeon', 'assets/sprites/background/plainDungeon.png');
        this.load.image('plainDungeon', 'assets/sprites/background/plainDungeon.png');

        this.load.image('cherry blossom', 'assets/sprites/background/cherry blossom.png');
        this.load.image('cherry blossom tree', 'assets/sprites/background/cherry blossom tree.png');
        this.load.image('cherry blossom blocks', 'assets/sprites/blocks/cherry blossom blocks.png');
        this.load.image('grass template', 'assets/sprites/blocks/grass template.png');
        this.load.image('cb template', 'assets/sprites/blocks/cb template.png');
        this.load.image('DIRT AND GRASS REMADE', 'assets/sprites/blocks/DIRT AND GRASS REMADE.png');
        this.load.image('bridge extra', 'assets/sprites/misc/bridge extra.png');
        this.load.image('temp platforms', 'assets/sprites/boss/temp platforms.png');
        this.load.image('gravity orb', 'assets/sprites/boss/gravity orb.png');
        this.load.image('attack tiles', 'assets/sprites/boss/attack tiles.png');
        this.load.spritesheet('dandelion', 'assets/sprites/background/dandelion flower sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('well', 'assets/sprites/blocks/well.png');
        this.load.image('water', 'assets/sprites/blocks/water.png');
        this.load.image('lava', 'assets/sprites/blocks/lava.png');
        this.load.image('new lava', 'assets/sprites/blocks/new lava.png');
        this.load.image('bush', 'assets/sprites/background/bush.png');
        this.load.image('mountain', 'assets/sprites/background/mountain.png');
        this.load.spritesheet('32 files dungeon', 'assets/sprites/boss/32 files dungeon.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('64 files dungeon', 'assets/sprites/boss/64 files dungeon.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('cloud variation', 'assets/sprites/boss/cloud variation.png');
        this.load.image('moving-platform-img', 'assets/sprites/misc/wooden moving platform.png');
        this.load.image('wooden moving platform', 'assets/sprites/misc/wooden moving platform.png');
        this.load.image('spike', 'assets/sprites/misc/spike.png');
        this.load.image('misc/spike', 'assets/sprites/misc/spike.png');
        this.load.image('blocks/spike', 'assets/sprites/blocks/spike.png');
        this.load.spritesheet('jump-pad-img', 'assets/sprites/misc/jumppad sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('bridge-break', 'assets/sprites/misc/new bridge break sprite.png', { frameWidth: 96, frameHeight: 32 });
        this.load.spritesheet('coin', 'assets/sprites/collectibles/new coin sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('fire-bullets', 'assets/sprites/All_Fire_Bullet_Pixel_16x16_04.png', { frameWidth: 16, frameHeight: 16 });
        this.load.spritesheet('firebar-sprite', 'assets/sprites/misc/firebar sprite.png', { frameWidth: 32, frameHeight: 64 });
        this.load.spritesheet('enemy-fireball', 'assets/sprites/misc/fireball sprite.png', { frameWidth: 32, frameHeight: 32 });

        // Mob Sprites (Sandal, Lantern Spirit, Shapeshifter Fox, Bonsai Gripper, Pumpkin Bat, Lava Kappa, Shiro Onna)
        this.load.spritesheet('mob-sandal-l', 'assets/sprites/monsters/Sandal-Mob-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-sandal-r', 'assets/sprites/monsters/Sandal-Mob-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-lantern-spirit-l', 'assets/sprites/monsters/Lantern-Spirit-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-lantern-spirit-r', 'assets/sprites/monsters/Lantern-Spirit-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-shapeshifter-fox-l', 'assets/sprites/monsters/Shapeshifter-Fox-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-shapeshifter-fox-r', 'assets/sprites/monsters/Shapeshifter-Fox-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-bonsai-gripper', 'assets/sprites/monsters/Bonsai Gripper.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-pumpkin-bat', 'assets/sprites/monsters/Pumpkin Bat.png', { frameWidth: 32, frameHeight: 32 });
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
        this.load.image('idle-r', 'assets/sprites/player/Player-Standing-R.png');
        this.load.image('idle-l', 'assets/sprites/player/Player-Standing-L.png');
        this.load.spritesheet('idle-wind-r', 'assets/sprites/player/Player-Idle-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('idle-wind-l', 'assets/sprites/player/Player-Idle-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-jump', 'assets/sprites/player/Player-Jump.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-fall', 'assets/sprites/player/Player-Falling.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('walk-r', 'assets/sprites/player/Player-Walk-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('walk-l', 'assets/sprites/player/Player-Walk-L.png', { frameWidth: 32, frameHeight: 32 });

        // Effects
        this.load.spritesheet('electric-death', 'assets/sprites/effects/electric death sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('simple-death', 'assets/sprites/effects/simple death sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('lava-death-l', 'assets/sprites/effects/lava death sprite-l.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('lava-death-r', 'assets/sprites/effects/lava death sprite-r.png', { frameWidth: 32, frameHeight: 32 });

        // Boss Sprites
        this.load.spritesheet('elecking-power', 'assets/sprites/boss/Elecking Power Attack Sprite 96.png', { frameWidth: 96, frameHeight: 96 });
        this.load.spritesheet('elecking-powerup', 'assets/sprites/boss/Elecking Powerup 96.png', { frameWidth: 96, frameHeight: 96 });
        this.load.spritesheet('temp-platforms', 'assets/sprites/boss/temp platforms.png', { frameWidth: 64, frameHeight: 32 });
        this.load.spritesheet('cloud-thunder-attack', 'assets/sprites/boss/cloud thunder attack.png', { frameWidth: 32, frameHeight: 240 });
        this.load.spritesheet('attack-orb', 'assets/sprites/boss/attack orb.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('victory-orb', 'assets/sprites/boss/victory orb.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('gravity-orb', 'assets/sprites/boss/gravity orb.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('attack-tiles', 'assets/sprites/boss/attack tiles.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('attack tiles', 'assets/sprites/boss/attack tiles.png', { frameWidth: 32, frameHeight: 32 });

        // Auto-discover and preload unique image files in public/assets/ (once per file, zero duplicate network requests)
        const autoAssetModules = import.meta.glob<{ default?: string } | string>(
            '../../public/assets/**/*.{png,jpg,jpeg,svg,webp}', 
            { eager: true, query: '?url', import: 'default' }
        );

        const queuedUrls = new Set<string>();
        Object.entries(autoAssetModules).forEach(([path, urlValue]) => {
            const cleanRelPath = path.replace(/^.*\/public\//, '');
            const url = typeof urlValue === 'string' ? urlValue : (urlValue as any)?.default || cleanRelPath;
            if (!queuedUrls.has(url)) {
                queuedUrls.add(url);
                if (!this.textures.exists(cleanRelPath)) {
                    this.load.image(cleanRelPath, url);
                }
            }
        });
    }

    create() {
        // Fast in-memory alias mapping for auto-discovered textures (0 network overhead)
        const autoAssetModules = import.meta.glob<{ default?: string } | string>(
            '../../public/assets/**/*.{png,jpg,jpeg,svg,webp}', 
            { eager: true, query: '?url', import: 'default' }
        );
        Object.entries(autoAssetModules).forEach(([path]) => {
            const cleanRelPath = path.replace(/^.*\/public\//, '');
            if (this.textures.exists(cleanRelPath)) {
                const srcImage = this.textures.get(cleanRelPath).getSourceImage() as HTMLImageElement;
                if (srcImage) {
                    const fileName = cleanRelPath.split('/').pop() || '';
                    const baseName = fileName.replace(/\.[^/.]+$/, '');
                    const aliases = [
                        baseName,
                        fileName,
                        cleanRelPath.replace(/\.[^/.]+$/, ''),
                        cleanRelPath.replace(/^assets\//, ''),
                        cleanRelPath.replace(/^assets\//, '').replace(/\.[^/.]+$/, ''),
                        baseName.replace(/[-_]/g, ' '),
                        baseName.replace(/\s+/g, '-'),
                        baseName.replace(/\s+/g, '_')
                    ];
                    aliases.forEach(alias => {
                        if (alias && !this.textures.exists(alias)) {
                            this.textures.addImage(alias, srcImage);
                        }
                    });
                }
            }
        });

        // Apply atmospheric perspective processing to mountain texture before creating tilemap layers
        this.applyAtmosphericPerspectiveToMountainTexture();

        const map = this.make.tilemap({ key: 'stage1' });
        this.createLayers(map);
        this.createAnimations();

        // Enforce clean nearest-neighbor pixel sampling on all textures to prevent edge bleeding
        this.textures.getTextureKeys().forEach(key => {
            if (this.textures.exists(key)) {
                this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
        });

        const allObjectLayers = map.objects || [];
        const rawMapObjects = allObjectLayers.length > 0 
            ? allObjectLayers.flatMap(layer => layer.objects || [])
            : (map.getObjectLayer('Objects')?.objects || []);
        
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
        this.enemyManager = new EnemyManager(this, this.player, this.uiManager, this.collectiblesManager, this.soundManager, this.envManager);

        // Setup Level Environment Objects & Checkpoints
        this.envManager.setupCheckpoints(rawMapObjects);
        this.envManager.setupRevealTriggers(rawMapObjects);
        this.envManager.setupRevealTileLayers(map, this.allTilesets);
        this.envManager.setupWindZones(rawMapObjects);
        this.envManager.setupDoors(rawMapObjects);
        this.envManager.setupGunDisarmZones(rawMapObjects);
        this.envManager.setupMovingPlatforms(map, rawMapObjects);
        this.envManager.setupJumpPads(map, rawMapObjects);
        this.envManager.setupFirebars(rawMapObjects);
        this.envManager.setupSmashTriggers(map);
        this.envManager.setupBridges(map, rawMapObjects);
        this.envManager.setupDandelions(rawMapObjects);
        this.envManager.setupStartTutorialCues(rawMapObjects, spawnX, spawnY);

        // Setup Entities & Level Objects
        this.enemyManager.setupGroundMobs(rawMapObjects, this.groundLayer, this.oneWayLayer, this.hazardsLayer, this.smashLayer);
        this.enemyManager.setupPipeMonsters(map, rawMapObjects);

        const bossSpawnObj = rawMapObjects.find(o => o.name === 'BossSpawn');
        if (bossSpawnObj && bossSpawnObj.x !== undefined && bossSpawnObj.y !== undefined) {
            this.eleckingBoss = new EleckingBoss(
                this, 
                bossSpawnObj.x, 
                bossSpawnObj.y, 
                this.player, 
                this.uiManager, 
                this.enemyManager, 
                this.envManager, 
                this.soundManager, 
                rawMapObjects, 
                map
            );
        }

        // Ground mobs treat JumpPads and MovingPlatforms as solid obstacles to prevent getting stuck
        if (this.envManager.jumpPads.length > 0) {
            this.physics.add.collider(this.enemyManager.groundMobs, this.envManager.jumpPads, (mobObj, padObj) => {
                const mob = mobObj as Phaser.Physics.Arcade.Sprite;
                const pad = padObj as Phaser.Physics.Arcade.Sprite;
                const newDir = mob.x < pad.x ? -1 : 1;
                mob.setData('direction', newDir);
                mob.setVelocityX(((mob.getData('speed') as number) || 50) * newDir);
                mob.setData('lastTurnTime', this.time.now);
            });
        }
        if (this.envManager.movingPlatforms.length > 0) {
            this.physics.add.collider(this.enemyManager.groundMobs, this.envManager.movingPlatforms);
        }
        if (this.envManager.bridges.length > 0) {
            this.envManager.bridges.forEach(b => {
                this.physics.add.collider(this.enemyManager.groundMobs, b.sprite, undefined, () => !b.broken);
            });
        }
        
        this.collectiblesManager.setupCollectibles(map);

        // Security and SurrealDB backend session start
        SecurityManager.getInstance().startNewRun('stage1');
        InputRecorder.getInstance().start();
        SurrealService.getInstance().startRun();

        // Checkpoint snapshot listener
        this.events.on('checkpoint-saved', () => {
            this.collectiblesManager.saveCheckpointSnapshot();
            this.enemyManager.saveCheckpointSnapshot();
            this.inventoryManager.saveCheckpointSnapshot();
            this.envManager.saveCheckpointSnapshot();
            SecurityManager.getInstance().recordEvent('CHECKPOINT', { x: this.player.x, y: this.player.y });
        });

        // Player death event: rollback state to active checkpoint snapshot and pause run timer
        this.events.on('player-death', () => {
            this.totalDeaths++;
            SecurityManager.getInstance().recordDeath(this.totalDeaths);
            SecurityManager.getInstance().recordEvent('DEATH', { x: this.player.x, y: this.player.y, deaths: this.totalDeaths });
            
            const isInsideBossArena = Boolean(this.eleckingBoss?.isPlayerInArena());
            if (!isInsideBossArena) {
                this.collectiblesManager.rollbackToCheckpoint();
                this.enemyManager.rollbackToCheckpoint();
                this.inventoryManager.rollbackToCheckpoint();
                this.envManager.rollbackToCheckpoint();
                this.eleckingBoss?.resetAll();
            }
            this.player.bullets.clear(true, true);
        });

        // Player respawn event: resume timer after death animation completes
        this.events.on('player-respawn', () => {
            // Timer automatically resumes accumulating active time in update()
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

        // Accidental Reload Guard (beforeunload event) & Auto-Pause on Window Blur / Focus Loss
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
        window.addEventListener('blur', this.onWindowBlur);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        this.game.events.on(Phaser.Core.Events.BLUR, this.onWindowBlur);
        this.game.events.on(Phaser.Core.Events.HIDDEN, this.onWindowBlur);

        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            window.removeEventListener('blur', this.onWindowBlur);
            document.removeEventListener('visibilitychange', this.onVisibilityChange);
            this.game.events.off(Phaser.Core.Events.BLUR, this.onWindowBlur);
            this.game.events.off(Phaser.Core.Events.HIDDEN, this.onWindowBlur);
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

        if (this.smashLayer) {
            this.physics.add.collider(this.player, this.smashLayer, undefined, (_p, tile) => {
                const t = tile as Phaser.Tilemaps.Tile;
                if (t.index === -1) return false;
                const body = this.player.body as Phaser.Physics.Arcade.Body;
                return body.velocity.y > 0 && body.bottom <= t.pixelY + 10 && !this.player.canSmash;
            });

            this.physics.add.collider(this.player.bullets, this.smashLayer, (bulletObj) => {
                const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                this.uiManager.spawnParticles(bullet.x, bullet.y, 0xFF8C00);
                bullet.destroy();
            });
        }

        if (this.hazardsLayer) {
            this.physics.add.overlap(
                this.player, 
                this.hazardsLayer, 
                (_p, tile) => {
                    const t = tile as Phaser.Tilemaps.Tile;
                    const isLava = t.tileset?.name === 'lava' || t.tileset?.name === 'new lava' || (t.index >= 2663 && t.index <= 2665) || (t.index >= 4053 && t.index <= 4056) || (t.index >= 2730 && t.index <= 2732);
                    this.player.die(isLava ? 'lava' : 'default');
                }, 
                (_p, tile) => {
                    const t = tile as Phaser.Tilemaps.Tile;
                    if (t.index === -1) return false;

                    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                    if (!pBody) return false;

                    const isLava = t.tileset?.name === 'lava' || t.tileset?.name === 'new lava' || (t.index >= 2663 && t.index <= 2665) || (t.index >= 4053 && t.index <= 4056) || (t.index >= 2730 && t.index <= 2732);
                    const tileTop = t.pixelY;
                    const tileBottom = t.pixelY + t.height;
                    const tileLeft = t.pixelX;
                    const tileRight = t.pixelX + t.width;

                    if (isLava) {
                        // Lava: player must visibly fall inside the molten liquid (down at least 10px into the tile)
                        const isHorizontallyInLava = pBody.right > tileLeft + 3 && pBody.left < tileRight - 3;
                        const isVerticallyInLava = pBody.bottom >= tileTop + 10 && pBody.top <= tileBottom;
                        return isHorizontallyInLava && isVerticallyInLava;
                    } else if (t.index === 3596) {
                        // Up spike (pointing upwards from floor)
                        const isHorizontallyTouching = pBody.right >= tileLeft + 6 && pBody.left <= tileRight - 6;
                        const isVerticallyTouching = pBody.bottom >= tileTop + 8 && pBody.top <= tileBottom - 2;
                        return isHorizontallyTouching && isVerticallyTouching;
                    } else if (t.index === 3598) {
                        // Down spike (hanging downwards from ceiling)
                        const isHorizontallyTouching = pBody.right >= tileLeft + 6 && pBody.left <= tileRight - 6;
                        const isVerticallyTouching = pBody.top <= tileBottom - 8 && pBody.bottom >= tileTop + 2;
                        return isHorizontallyTouching && isVerticallyTouching;
                    } else if (t.index === 3597) {
                        // Right spike (pointing right from wall)
                        const isHorizontallyTouching = pBody.left <= tileRight - 8 && pBody.right >= tileLeft + 2;
                        const isVerticallyTouching = pBody.bottom >= tileTop + 6 && pBody.top <= tileBottom - 6;
                        return isHorizontallyTouching && isVerticallyTouching;
                    } else if (t.index === 3599) {
                        // Left spike (pointing left from wall)
                        const isHorizontallyTouching = pBody.right >= tileLeft + 8 && pBody.left <= tileRight - 2;
                        const isVerticallyTouching = pBody.bottom >= tileTop + 6 && pBody.top <= tileBottom - 6;
                        return isHorizontallyTouching && isVerticallyTouching;
                    } else {
                        // Spikes / other hazards fallback: pixel-accurate inner bounding box to prevent clipping air margins
                        const isHorizontallyTouching = pBody.right >= tileLeft + 6 && pBody.left <= tileRight - 6;
                        const isVerticallyTouching = pBody.bottom >= tileTop + 8 && pBody.top <= tileBottom - 4;
                        return isHorizontallyTouching && isVerticallyTouching;
                    }
                }
            );
        }

        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.startFollow(this.player);
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.TILE_BIAS = 32;

        this.game.canvas.setAttribute('tabindex', '0');
        this.game.canvas.focus();
        this.input.on('pointerdown', () => this.game.canvas.focus());

        this.activeRunTimeMs = 0;
    }

    private beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
    };

    private onWindowBlur = () => {
        if (!this.isGamePaused) {
            this.pauseGame();
        }
    };

    private onVisibilityChange = () => {
        if (document.hidden && !this.isGamePaused) {
            this.pauseGame();
        }
    };

    private pauseGame() {
        if (this.isGamePaused) return;
        this.isGamePaused = true;
        this.physics.pause();
        this.anims.pauseAll();
        this.tweens.pauseAll();
        this.time.paused = true;
        this.soundManager.pauseAll();
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
        this.physics.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();
        this.time.paused = false;
        this.soundManager.resumeAll();
        this.uiManager.hidePauseMenu();
        this.soundManager.playMenuSelect();
    }

    private respawnAtActiveCheckpoint() {
        if (this.isGamePaused) {
            this.resumeGame();
        }
        this.player.cancelDeathEffect();
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
        this.envManager.rollbackToCheckpoint();
        this.eleckingBoss?.resetAll();
        this.player.bullets.clear(true, true);

        this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'RESPAWNED AT CHECKPOINT', '#38BDF8', 1200);
        this.soundManager?.playPowerup();
    }

    private restartFullRun() {
        if (this.isGamePaused) {
            this.resumeGame();
        }
        this.player.cancelDeathEffect();
        this.uiManager.hideDeathScreen();
        this.uiManager.hidePauseMenu();
        this.totalDeaths = 0;
        this.activeRunTimeMs = 0;

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
        this.eleckingBoss?.resetAll();
        SecurityManager.getInstance().startNewRun('stage1');
        InputRecorder.getInstance().reset();
        SurrealService.getInstance().startRun();

        this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'RUN RESTARTED', '#38BDF8', 1200);
        this.soundManager?.playPowerup();
    }

    public getElapsedMilliseconds(): number {
        return this.activeRunTimeMs;
    }

    private getFormattedElapsedTime(): string {
        const elapsedMs = Math.round(this.activeRunTimeMs);
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
        const cherryBlossomTileset = map.addTilesetImage('cherry blossom', 'cherry blossom');
        const cherryBlossomBlocksTileset = map.addTilesetImage('cherry blossom blocks', 'cherry blossom blocks');
        const grassTemplateTileset = map.addTilesetImage('grass template', 'grass template');
        const cbTemplateTileset = map.addTilesetImage('cb template', 'cb template');
        const dirtAndGrassRemadeTileset = map.addTilesetImage('DIRT AND GRASS REMADE', 'DIRT AND GRASS REMADE');
        const bridgeExtraTileset = map.addTilesetImage('bridge extra', 'bridge extra');
        const wellTileset = map.addTilesetImage('well', 'well');
        const waterTileset = map.addTilesetImage('water', 'water');
        const lavaTileset = map.addTilesetImage('lava', 'lava');
        const bushTileset = map.addTilesetImage('bush', 'bush');
        const dandelionTileset = map.addTilesetImage('dandelion flower sprite', 'dandelion');
        const movingPlatformTileset = map.addTilesetImage('moving-platform', 'moving-platform');
        const woodenPlatformTileset = map.addTilesetImage('wooden moving platform', 'wooden moving platform');
        const jumpPadTileset = map.addTilesetImage('jump-pad', 'jump-pad-img') || map.addTilesetImage('jumppad sprite', 'jump-pad-img');
        const mountainTileset = map.addTilesetImage('mountain', 'mountain');
        const dungeon32Tileset = map.addTilesetImage('32 files dungeon', '32 files dungeon');
        const dungeon64Tileset = map.addTilesetImage('64 files dungeon', '64 files dungeon');
        const cloudVariationTileset = map.addTilesetImage('cloud variation', 'cloud variation');
        const tempPlatformsTileset = map.addTilesetImage('temp platforms', 'temp platforms');
        const gravityOrbTileset = map.addTilesetImage('gravity orb', 'gravity orb');
        const attackTilesTileset = map.addTilesetImage('attack tiles', 'attack tiles');
        const cherryBlossomTreeTileset = map.addTilesetImage('cherry blossom tree', 'cherry blossom tree');
        const newLavaTileset = map.addTilesetImage('new lava', 'new lava');
        const plainDungeonTileset = map.addTilesetImage('plainDungeon', 'plainDungeon') || map.addTilesetImage('plain-dungeon', 'plain-dungeon');
        const plainGroundTileset = map.addTilesetImage('plainGround', 'plainGround') || map.addTilesetImage('plain-ground', 'plain-ground');
        const spikeTileset = map.addTilesetImage('spike', 'spike');

        const allTilesets = [
            levelObjectsTileset,
            landTileset,
            skyTileset,
            clouds1Tileset,
            cloud2Tileset,
            smallTreeTileset,
            largeTreeTileset,
            grassTileset,
            cherryBlossomTileset,
            cherryBlossomTreeTileset,
            cherryBlossomBlocksTileset,
            grassTemplateTileset,
            cbTemplateTileset,
            dirtAndGrassRemadeTileset,
            bridgeExtraTileset,
            wellTileset,
            waterTileset,
            lavaTileset,
            newLavaTileset,
            bushTileset,
            dandelionTileset,
            movingPlatformTileset,
            woodenPlatformTileset,
            jumpPadTileset,
            mountainTileset,
            dungeon32Tileset,
            dungeon64Tileset,
            cloudVariationTileset,
            tempPlatformsTileset,
            gravityOrbTileset,
            attackTilesTileset,
            plainDungeonTileset,
            plainGroundTileset,
            spikeTileset
        ].filter(Boolean) as Phaser.Tilemaps.Tileset[];

        // Automatically link any tilesets referenced in map.tilesets that match loaded textures
        if (map.tilesets && map.tilesets.length > 0) {
            map.tilesets.forEach(ts => {
                if (!allTilesets.some(t => t.name === ts.name)) {
                    const cleanImg = (ts as any).image ? (ts as any).image.replace(/^(\.\.\/)+/, '').replace(/\.[^/.]+$/, '') : '';
                    const candidates = [
                        ts.name,
                        cleanImg,
                        cleanImg.replace(/^assets\//, ''),
                        cleanImg.replace(/^sprites\//, ''),
                        cleanImg.split('/').pop() || '',
                        ts.name.replace(/\.[^/.]+$/, ''),
                        ts.name.replace(/[-_]/g, ' '),
                        ts.name.replace(/\s+/g, '-'),
                        ts.name.replace(/\s+/g, '_'),
                        ts.name.split('/').pop() || '',
                        (ts.name.split('/').pop() || '').replace(/\.[^/.]+$/, '')
                    ];
                    const matchedKey = candidates.find(k => k && this.textures.exists(k));
                    if (matchedKey) {
                        const added = map.addTilesetImage(ts.name, matchedKey);
                        if (added) allTilesets.push(added);
                    }
                }
            });
        }

        this.allTilesets = allTilesets;

        // Dynamically create all tile layers from the stage JSON in their exact layer stack order
        const tileLayers = (map.layers || []).filter(l => !(l as any).type || (l as any).type === 'tilelayer');

        tileLayers.forEach((layerData, idx) => {
            const layerName = layerData.name;
            const lowerName = layerName.toLowerCase();

            const created = map.createLayer(layerName, allTilesets, 0, 0);
            if (!created) return;
            const layer = created as Phaser.Tilemaps.TilemapLayer;

            // Set visibility and opacity from stage JSON
            if (layerData.visible !== undefined) {
                layer.setVisible(layerData.visible);
            }
            if (layerData.alpha !== undefined) {
                layer.setAlpha(layerData.alpha);
            } else if ((layerData as any).opacity !== undefined) {
                layer.setAlpha((layerData as any).opacity);
            }

            // Depth calculation: Tiled custom property -> default order-aware depth
            const fallbackDepth = this.getDefaultLayerDepth(layerName, idx, map.layers);
            const depth = this.getTiledLayerDepth(map, layerName, fallbackDepth);
            layer.setDepth(depth);

            // Parallax scroll factor (Tiled properties -> default parallax for distant layers like Mountain)
            const scrollFactor = this.getLayerScrollFactor(map, layerData);
            if (scrollFactor.x !== 1 || scrollFactor.y !== 1) {
                layer.setScrollFactor(scrollFactor.x, scrollFactor.y);
                layer.setCullPadding(8, 8);
            }

            // Bind collision & core references
            if (lowerName === 'ground') {
                this.groundLayer = layer;
                this.groundLayer.setCollisionByExclusion([-1]);
            } else if (lowerName === 'smashground' || lowerName === 'smash') {
                this.smashLayer = layer;
                this.smashLayer.setCollisionByExclusion([-1]);
            } else if (lowerName === 'onewayplatforms' || lowerName === 'oneway') {
                this.oneWayLayer = layer;
                this.oneWayLayer.setCollisionByExclusion([-1]);
            } else if (lowerName === 'hazards' || lowerName === 'hazard') {
                this.hazardsLayer = layer;
                this.hazardsLayer.setCollisionByExclusion([-1]);
            }
        });

        // Initialize 2-frame automated animated lava tiles loop
        this.setupAnimatedLavaTiles(map);
    }

    private setupAnimatedLavaTiles(map: Phaser.Tilemaps.Tilemap) {
        const newLavaTileset = map.tilesets.find(t => t.name === 'new lava' || String((t as any).image || '').includes('new lava'));
        if (!newLavaTileset) return;

        const firstGid = newLavaTileset.firstgid;
        // Surface: row 1 (frames 0 & 1)
        const surfaceGid1 = firstGid;
        const surfaceGid2 = firstGid + 1;
        // Block: row 2 (frames 2 & 3)
        const blockGid1 = firstGid + 2;
        const blockGid2 = firstGid + 3;

        const layersWithLava: { surfaceTiles: Phaser.Tilemaps.Tile[], blockTiles: Phaser.Tilemaps.Tile[] }[] = [];

        map.layers.forEach(layerData => {
            const tilemapLayer = layerData.tilemapLayer;
            if (!tilemapLayer) return;

            const surfaceTiles: Phaser.Tilemaps.Tile[] = [];
            const blockTiles: Phaser.Tilemaps.Tile[] = [];

            tilemapLayer.forEachTile(tile => {
                if (tile.index === surfaceGid1 || tile.index === surfaceGid2) {
                    surfaceTiles.push(tile);
                } else if (tile.index === blockGid1 || tile.index === blockGid2) {
                    blockTiles.push(tile);
                }
            });

            if (surfaceTiles.length > 0 || blockTiles.length > 0) {
                layersWithLava.push({ surfaceTiles, blockTiles });
            }
        });

        if (layersWithLava.length === 0) return;

        this.time.addEvent({
            delay: 300,
            loop: true,
            callback: () => {
                layersWithLava.forEach(({ surfaceTiles, blockTiles }) => {
                    for (let i = 0; i < surfaceTiles.length; i++) {
                        const tile = surfaceTiles[i];
                        tile.index = (tile.index === surfaceGid1) ? surfaceGid2 : surfaceGid1;
                    }
                    for (let i = 0; i < blockTiles.length; i++) {
                        const tile = blockTiles[i];
                        tile.index = (tile.index === blockGid1) ? blockGid2 : blockGid1;
                    }
                });
            }
        });
    }

    private getDefaultLayerDepth(layerName: string, index: number, allLayers: any[]): number {
        const lowerName = layerName.toLowerCase();
        
        // Find index of main ground/gameplay layer in map.layers
        const groundIndex = allLayers.findIndex(l => l.name && l.name.toLowerCase() === 'ground');
        const effectiveGroundIndex = groundIndex > 0 ? groundIndex : 6;

        if (lowerName === 'ground') return 3.0;
        if (lowerName === 'smashground' || lowerName === 'smash') return 3.1;
        if (lowerName === 'onewayplatforms' || lowerName === 'oneway') return 3.2;
        if (lowerName === 'hazards' || lowerName === 'hazard') return 3.3;

        // Background layers (layers below ground stack)
        if (index < effectiveGroundIndex) {
            return (index / effectiveGroundIndex) * 2.85;
        }

        // Foreground / overlay layers (layers above ground stack)
        return 8.0 + (index - effectiveGroundIndex) * 0.1;
    }

    private getTiledLayerDepth(map: Phaser.Tilemaps.Tilemap, layerName: string, fallbackDepth: number): number {
        const layerData = map.layers.find(l => l.name === layerName);
        if (layerData) {
            const rawProps = (layerData as any).properties;
            if (rawProps && Array.isArray(rawProps)) {
                const depthProp = rawProps.find((p: any) => 
                    p.name && (
                        p.name.toLowerCase() === 'depth' || 
                        p.name.toLowerCase() === 'zindex' || 
                        p.name.toLowerCase() === 'z-index' || 
                        p.name.toLowerCase() === 'z_index' ||
                        p.name.toLowerCase() === 'layerdepth'
                    )
                );
                if (depthProp && depthProp.value !== undefined) {
                    return Number(depthProp.value);
                }
            }
        }
        return fallbackDepth;
    }

    private getLayerScrollFactor(_map: Phaser.Tilemaps.Tilemap, layerData: any): { x: number, y: number } {
        const name = (layerData.name || '').toLowerCase();
        
        // 1. Check native Tiled parallax properties
        let sx = layerData.parallaxx !== undefined ? Number(layerData.parallaxx) : undefined;
        let sy = layerData.parallaxy !== undefined ? Number(layerData.parallaxy) : undefined;

        // 2. Check custom properties from Tiled
        const rawProps = layerData.properties;
        if (rawProps && Array.isArray(rawProps)) {
            const pxProp = rawProps.find((p: any) => p.name && (
                p.name.toLowerCase() === 'parallaxx' || 
                p.name.toLowerCase() === 'scrollfactorx' ||
                p.name.toLowerCase() === 'parallax_x' ||
                p.name.toLowerCase() === 'scroll_factor_x'
            ));
            if (pxProp && pxProp.value !== undefined) sx = Number(pxProp.value);

            const pyProp = rawProps.find((p: any) => p.name && (
                p.name.toLowerCase() === 'parallaxy' || 
                p.name.toLowerCase() === 'scrollfactory' ||
                p.name.toLowerCase() === 'parallax_y' ||
                p.name.toLowerCase() === 'scroll_factor_y'
            ));
            if (pyProp && pyProp.value !== undefined) sy = Number(pyProp.value);

            const pAll = rawProps.find((p: any) => p.name && (
                p.name.toLowerCase() === 'parallax' || 
                p.name.toLowerCase() === 'scrollfactor'
            ));
            if (pAll && pAll.value !== undefined) {
                if (sx === undefined) sx = Number(pAll.value);
                if (sy === undefined) sy = Number(pAll.value);
            }
        }

        // 3. Sensible defaults if not explicitly set in Tiled
        if (name === 'mountain') {
            return { x: sx ?? 0.3, y: sy ?? 1 };
        }

        return { x: sx ?? 1, y: sy ?? 1 };
    }

    private applyAtmosphericPerspectiveToMountainTexture() {
        const mountainTextureKeys = ['mountain', 'assets/sprites/background/mountain.png'];
        const targetKey = mountainTextureKeys.find(k => this.textures.exists(k));
        if (!targetKey) return;

        const texture = this.textures.get(targetKey);
        const sourceImage = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        if (!sourceImage || !sourceImage.width || !sourceImage.height) return;

        // Create an offscreen canvas to process the pixels
        const canvas = document.createElement('canvas');
        canvas.width = sourceImage.width;
        canvas.height = sourceImage.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(sourceImage, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Atmospheric perspective parameters:
        // 1. Desaturate colors by ~25%
        // 2. Reduce contrast by ~15%
        // 3. Shift palette toward sky atmospheric blue (#8cb2d4 / [140, 178, 212]) by ~20%
        // 4. Preserve 100% opacity (no alpha fading)
        const skyR = 140, skyG = 178, skyB = 212;

        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a === 0) continue;

            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // 1. Desaturate ~25%
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            let nr = r * 0.75 + gray * 0.25;
            let ng = g * 0.75 + gray * 0.25;
            let nb = b * 0.75 + gray * 0.25;

            // 2. Reduce contrast ~15%
            nr = (nr - 128) * 0.85 + 128;
            ng = (ng - 128) * 0.85 + 128;
            nb = (nb - 128) * 0.85 + 128;

            // 3. Shift toward sky atmospheric blue ~20%
            nr = Math.min(255, Math.max(0, Math.round(nr * 0.80 + skyR * 0.20)));
            ng = Math.min(255, Math.max(0, Math.round(ng * 0.80 + skyG * 0.20)));
            nb = Math.min(255, Math.max(0, Math.round(nb * 0.80 + skyB * 0.20)));

            data[i] = nr;
            data[i + 1] = ng;
            data[i + 2] = nb;
            // Full opacity retained
        }

        ctx.putImageData(imgData, 0, 0);

        // Update texture in Phaser TextureManager
        mountainTextureKeys.forEach(k => {
            if (this.textures.exists(k)) {
                this.textures.remove(k);
            }
            this.textures.addCanvas(k, canvas);
        });
    }

    private createAnimations() {
        this.anims.create({ key: 'idle-r-anim', frames: this.anims.generateFrameNumbers('idle-wind-r', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'idle-l-anim', frames: this.anims.generateFrameNumbers('idle-wind-l', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'walk-r-anim', frames: this.anims.generateFrameNumbers('walk-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-l-anim', frames: this.anims.generateFrameNumbers('walk-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fall-l-anim', frames: this.anims.generateFrameNumbers('player-fall', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fall-r-anim', frames: this.anims.generateFrameNumbers('player-fall', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'coin-spin', frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });

        // Electric Death Effect (Right: top row 0..7 left-to-right; Left: bottom row 23..16 right-to-left)
        this.anims.create({
            key: 'electric-death-r-anim',
            frames: this.anims.generateFrameNumbers('electric-death', { start: 0, end: 7 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'electric-death-l-anim',
            frames: [
                { key: 'electric-death', frame: 23 },
                { key: 'electric-death', frame: 22 },
                { key: 'electric-death', frame: 21 },
                { key: 'electric-death', frame: 20 },
                { key: 'electric-death', frame: 19 },
                { key: 'electric-death', frame: 18 },
                { key: 'electric-death', frame: 17 },
                { key: 'electric-death', frame: 16 }
            ],
            frameRate: 12,
            repeat: 0
        });

        // Simple Death Effect (Right: top row 0..5 left-to-right; Left: bottom row 17..12 right-to-left)
        this.anims.create({
            key: 'simple-death-r-anim',
            frames: this.anims.generateFrameNumbers('simple-death', { start: 0, end: 5 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'simple-death-l-anim',
            frames: [
                { key: 'simple-death', frame: 17 },
                { key: 'simple-death', frame: 16 },
                { key: 'simple-death', frame: 15 },
                { key: 'simple-death', frame: 14 },
                { key: 'simple-death', frame: 13 },
                { key: 'simple-death', frame: 12 }
            ],
            frameRate: 12,
            repeat: 0
        });

        // Lava Death Effects (Right: frame 0 -> 5 from lava-death-r; Left: frame 5 -> 0 from lava-death-l)
        this.anims.create({
            key: 'lava-death-r-anim',
            frames: this.anims.generateFrameNumbers('lava-death-r', { start: 0, end: 5 }),
            frameRate: 14,
            repeat: 0
        });

        this.anims.create({
            key: 'lava-death-l-anim',
            frames: [
                { key: 'lava-death-l', frame: 5 },
                { key: 'lava-death-l', frame: 4 },
                { key: 'lava-death-l', frame: 3 },
                { key: 'lava-death-l', frame: 2 },
                { key: 'lava-death-l', frame: 1 },
                { key: 'lava-death-l', frame: 0 }
            ],
            frameRate: 14,
            repeat: 0
        });

        // Bullet Fire Animation (4-frame spinning flame blast: frames 40-43 in 16x16 grid)
        this.anims.create({ key: 'fire-bullet-anim', frames: this.anims.generateFrameNumbers('fire-bullets', { start: 40, end: 43 }), frameRate: 14, repeat: -1 });

        // Enemy Shooter Fireball (32x32: 0..3 Left, 4..7 Right)
        this.anims.create({ key: 'enemy-fireball-l', frames: this.anims.generateFrameNumbers('enemy-fireball', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'enemy-fireball-r', frames: this.anims.generateFrameNumbers('enemy-fireball', { start: 4, end: 7 }), frameRate: 10, repeat: -1 });

        // Lantern Spirit: 3 frames (0..2)
        this.anims.create({ key: 'mob-lantern-spirit-walk-l', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-l', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-lantern-spirit-walk-r', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-r', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-lantern-walk-l', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-l', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-lantern-walk-r', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-r', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-spirit-walk-l', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-l', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-spirit-walk-r', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-r', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });

        // Shapeshifter Fox: 4 frames (0..3)
        this.anims.create({ key: 'mob-shapeshifter-fox-walk-l', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-shapeshifter-fox-walk-r', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-shapeshifter-walk-l', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-shapeshifter-walk-r', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-fox-walk-l', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-fox-walk-r', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });

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

        // Firebar spinning fire animation (4 frames)
        this.anims.create({ key: 'firebar-spin', frames: this.anims.generateFrameNumbers('firebar-sprite', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });

        // Dandelion gentle sway animation (4 frames)
        this.anims.create({ key: 'dandelion-sway', frames: this.anims.generateFrameNumbers('dandelion', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });

        // Jump Pad spring bounce animation (4 frames: 0 -> 1 -> 2 -> 3)
        this.anims.create({
            key: 'jump-pad-spring',
            frames: this.anims.generateFrameNumbers('jump-pad-img', { start: 0, end: 3 }),
            frameRate: 16,
            repeat: 0
        });
        this.anims.create({
            key: 'jumppad-spring',
            frames: this.anims.generateFrameNumbers('jump-pad-img', { start: 0, end: 3 }),
            frameRate: 16,
            repeat: 0
        });

        // Bridge break shattering animation (4 frames: 0 -> 1 -> 2 -> 3)
        this.anims.create({
            key: 'bridge-break-anim',
            frames: this.anims.generateFrameNumbers('bridge-break', { start: 0, end: 3 }),
            frameRate: 6,
            repeat: 0
        });
    }

    update(_time: number, delta: number) {
        if (this.isGamePaused) {
            this.uiManager.updatePauseMenu();
            return;
        }

        // Only accumulate active run time when player is alive (strictly paused during all deaths)
        if (this.player && !this.player.isDying) {
            this.activeRunTimeMs += delta;
        }

        const formattedTime = this.getFormattedElapsedTime();

        this.uiManager.updateHUD(
            formattedTime, 
            this.collectiblesManager.coinsCollected, 
            this.enemyManager.enemiesKilled,
            this.totalDeaths
        );

        this.player.update();
        this.envManager.update(delta);
        this.inventoryManager.update();
        this.enemyManager.update(this.groundLayer, this.oneWayLayer, delta);
        if (this.eleckingBoss) this.eleckingBoss.update(_time, delta);
        SecurityManager.getInstance().logPlayerPosition(this.player.x, this.player.y);

        const currentFrame = Math.floor(this.activeRunTimeMs / 16.6667);
        InputRecorder.getInstance().logFrame(currentFrame, this.player.getActiveKeys());
    }

    public onStageComplete() {
        const netDurationMs = Math.round(this.getElapsedMilliseconds());
        const payload = SecurityManager.getInstance().finishRun(
            this.collectiblesManager.coinsCollected,
            this.enemyManager.enemiesKilled,
            this.totalDeaths,
            netDurationMs
        );
        LeaderboardManager.getInstance().submitRun(payload, 'Speedy Onion');
        LeaderboardManager.getInstance().showLeaderboardModal(this, this.soundManager);
    }
}
