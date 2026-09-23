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
    private smashLayer?: Phaser.Tilemaps.TilemapLayer;
    private hazardsLayer?: Phaser.Tilemaps.TilemapLayer;
    private allTilesets: Phaser.Tilemaps.Tileset[] = [];

    // Hardcore Speedrun & Death State
    private initialSpawnX: number = 100;
    private initialSpawnY: number = 100;
    private startTime: number = 0;
    private totalPausedTime: number = 0;
    private pauseStartTime: number = 0;
    private deathPauseStartTime: number = 0;
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
        this.load.image('plain-ground', 'assets/sprites/background/plainGround.png');
        this.load.image('plainGround', 'assets/sprites/background/plainGround.png');
        this.load.image('plain-dungeon', 'assets/sprites/background/plainDungeon.png');
        this.load.image('plainDungeon', 'assets/sprites/background/plainDungeon.png');

        this.load.image('cherry blossom', 'assets/sprites/background/cherry blossom.png');
        this.load.spritesheet('dandelion', 'assets/sprites/background/dandelion flower sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('well', 'assets/sprites/blocks/well.png');
        this.load.image('water', 'assets/sprites/blocks/water.png');
        this.load.image('lava', 'assets/sprites/blocks/lava.png');
        this.load.image('bush', 'assets/sprites/background/bush.png');
        this.load.image('mountain', 'assets/sprites/background/mountain.png');
        this.load.image('32 files dungeon', 'assets/sprites/boss/32 files dungeon.png');
        this.load.image('64 files dungeon', 'assets/sprites/boss/64 files dungeon.png');
        this.load.image('cloud variation', 'assets/sprites/boss/cloud variation.png');
        this.load.image('moving-platform-img', 'assets/sprites/misc/wooden moving platform.png');
        this.load.image('wooden moving platform', 'assets/sprites/misc/wooden moving platform.png');
        this.load.image('moving-platform', 'assets/sprites/misc/moving-platform.png');
        this.load.image('pipe-monster-l', 'assets/sprites/monsters/Devil_Red_Stand_L.png');
        this.load.image('pipe-monster-r', 'assets/sprites/monsters/Devil_Red_Stand_R.png');
        this.load.image('jump-pad-img', 'assets/sprites/misc/jump-pad.png');
        this.load.spritesheet('coin', 'assets/sprites/collectibles/new coin sprite.png', { frameWidth: 32, frameHeight: 32 });
        
        // Bullet spritesheet (16x16 grid from All_Fire_Bullet_Pixel_16x16_04.png)
        this.load.spritesheet('fire-bullets', 'assets/sprites/All_Fire_Bullet_Pixel_16x16_04.png', { frameWidth: 16, frameHeight: 16 });
        this.load.spritesheet('firebar-sprite', 'assets/sprites/misc/firebar sprite.png', { frameWidth: 32, frameHeight: 64 });
        this.load.spritesheet('enemy-fireball', 'assets/sprites/misc/fireball sprite.png', { frameWidth: 32, frameHeight: 32 });

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
        this.load.spritesheet('player-fall', 'assets/sprites/player/Main-Sprite-Falling.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('jump-r', 'assets/sprites/player/Melissa_Jump1_R.png');
        this.load.image('jump-l', 'assets/sprites/player/Melissa_Jump1_L.png');
        this.load.image('fall-r', 'assets/sprites/player/Melissa_Fall2_R.png');
        this.load.spritesheet('player-fall-gun-l', 'assets/sprites/player/Main-Sprite-Falling-With-Gun-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-fall-gun-r', 'assets/sprites/player/Main-Sprite-Falling-With-Gun-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('walk-r', 'assets/sprites/player/Main-Sprite-Walk-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('walk-l', 'assets/sprites/player/Main-Sprite-Walk-L.png', { frameWidth: 32, frameHeight: 32 });

        // Effects
        this.load.spritesheet('death-effect', 'assets/sprites/effects/black death effect sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('lava-death-l', 'assets/sprites/effects/lava death sprite-l.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('lava-death-r', 'assets/sprites/effects/lava death sprite-r.png', { frameWidth: 32, frameHeight: 32 });

        // Auto-discover and preload all images and sprites in public/assets/ (including sprites, blocks, misc, backgrounds, etc.)
        const autoAssetModules = import.meta.glob<{ default?: string } | string>(
            '../../public/assets/**/*.{png,jpg,jpeg,svg,webp}', 
            { eager: true, query: '?url', import: 'default' }
        );

        Object.entries(autoAssetModules).forEach(([path, urlValue]) => {
            const cleanRelPath = path.replace(/^.*\/public\//, '');
            const url = typeof urlValue === 'string' ? urlValue : (urlValue as any)?.default || cleanRelPath;
            const fileName = cleanRelPath.split('/').pop() || '';
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            
            const spritesSubpathMatch = cleanRelPath.match(/assets\/sprites\/(.+)\.[^/.]+$/);
            const spritesSubpath = spritesSubpathMatch ? spritesSubpathMatch[1] : '';

            const keys = new Set<string>([
                baseName,
                fileName,
                cleanRelPath,
                cleanRelPath.replace(/\.[^/.]+$/, ''),
                cleanRelPath.replace(/^assets\//, ''),
                cleanRelPath.replace(/^assets\//, '').replace(/\.[^/.]+$/, '')
            ]);

            if (spritesSubpath) {
                keys.add(spritesSubpath);
                keys.add(`sprites/${spritesSubpath}`);
                keys.add(`sprites/${fileName}`);
            }

            const extraKeys: string[] = [];
            keys.forEach(k => {
                extraKeys.push(k.replace(/[-_]/g, ' '));
                extraKeys.push(k.replace(/\s+/g, '-'));
                extraKeys.push(k.replace(/\s+/g, '_'));
            });
            extraKeys.forEach(k => keys.add(k));

            keys.forEach(key => {
                if (key && !this.textures.exists(key)) {
                    this.load.image(key, url || cleanRelPath);
                }
            });
        });
    }

    create() {
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
        this.envManager.setupFakeGround(rawMapObjects);
        this.envManager.setupFillGround(rawMapObjects);
        this.envManager.setupRevealTileLayers(map, this.allTilesets);
        this.envManager.setupWindZones(rawMapObjects);
        this.envManager.setupDoors(rawMapObjects);
        this.envManager.setupGunDisarmZones(rawMapObjects);
        this.envManager.setupMovingPlatforms(map, rawMapObjects);
        this.envManager.setupJumpPads(map, rawMapObjects);
        this.envManager.setupFirebars(rawMapObjects);
        this.envManager.setupSmashTriggers(map);
        this.envManager.setupDandelions(rawMapObjects);
        this.envManager.setupStartTutorialCues(rawMapObjects, spawnX, spawnY);

        // Setup Entities & Level Objects
        this.enemyManager.setupGroundMobs(rawMapObjects, this.groundLayer, this.oneWayLayer, this.hazardsLayer, this.smashLayer);
        this.enemyManager.setupPipeMonsters(map, rawMapObjects);

        // Ground mobs treat JumpPads and MovingPlatforms as solid obstacles to prevent getting stuck
        if (this.envManager.jumpPads.length > 0) {
            this.physics.add.collider(this.enemyManager.groundMobs, this.envManager.jumpPads);
        }
        if (this.envManager.movingPlatforms.length > 0) {
            this.physics.add.collider(this.enemyManager.groundMobs, this.envManager.movingPlatforms);
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
            this.deathPauseStartTime = this.time.now;
            this.totalDeaths++;
            SecurityManager.getInstance().recordDeath(this.totalDeaths);
            SecurityManager.getInstance().recordEvent('DEATH', { x: this.player.x, y: this.player.y, deaths: this.totalDeaths });
            this.collectiblesManager.rollbackToCheckpoint();
            this.enemyManager.rollbackToCheckpoint();
            this.inventoryManager.rollbackToCheckpoint();
            this.envManager.rollbackToCheckpoint();
            this.player.bullets.clear(true, true);
        });

        // Player respawn event: resume timer after death animation completes
        this.events.on('player-respawn', () => {
            if (this.deathPauseStartTime > 0) {
                this.totalPausedTime += (this.time.now - this.deathPauseStartTime);
                this.deathPauseStartTime = 0;
            }
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
                    const isLava = t.tileset?.name === 'lava' || (t.index >= 2730 && t.index <= 2732);
                    this.player.die(isLava ? 'lava' : 'default');
                }, 
                (_p, tile) => {
                    const t = tile as Phaser.Tilemaps.Tile;
                    if (t.index === -1) return false;

                    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                    if (!pBody) return false;

                    const isLava = t.tileset?.name === 'lava' || (t.index >= 2730 && t.index <= 2732);
                    const tileTop = t.pixelY;
                    const tileBottom = t.pixelY + t.height;
                    const tileLeft = t.pixelX;
                    const tileRight = t.pixelX + t.width;

                    if (isLava) {
                        // Lava: player must visibly fall inside the molten liquid (down at least 10px into the tile)
                        const isHorizontallyInLava = pBody.right > tileLeft + 3 && pBody.left < tileRight - 3;
                        const isVerticallyInLava = pBody.bottom >= tileTop + 10 && pBody.top <= tileBottom;
                        return isHorizontallyInLava && isVerticallyInLava;
                    } else {
                        // Spikes / other hazards: pixel-accurate inner bounding box to prevent clipping air margins
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

        this.startTime = this.time.now;
        this.totalPausedTime = 0;
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
        if (this.deathPauseStartTime > 0) {
            this.totalPausedTime += (this.time.now - this.deathPauseStartTime);
            this.deathPauseStartTime = 0;
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
        this.deathPauseStartTime = 0;
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
        SecurityManager.getInstance().startNewRun('stage1');
        InputRecorder.getInstance().reset();
        SurrealService.getInstance().startRun();

        this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'RUN RESTARTED', '#38BDF8', 1200);
        this.soundManager?.playPowerup();
    }

    public getElapsedMilliseconds(): number {
        const currentPauseOffset = this.isGamePaused ? (this.time.now - this.pauseStartTime) : 0;
        const currentDeathOffset = (this.player && this.player.isDying && this.deathPauseStartTime > 0) ? (this.time.now - this.deathPauseStartTime) : 0;
        return Math.max(0, this.time.now - this.startTime - this.totalPausedTime - currentPauseOffset - currentDeathOffset);
    }

    private getFormattedElapsedTime(): string {
        const elapsedMs = this.getElapsedMilliseconds();
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
        const wellTileset = map.addTilesetImage('well', 'well');
        const waterTileset = map.addTilesetImage('water', 'water');
        const lavaTileset = map.addTilesetImage('lava', 'lava');
        const bushTileset = map.addTilesetImage('bush', 'bush');
        const dandelionTileset = map.addTilesetImage('dandelion flower sprite', 'dandelion');
        const movingPlatformTileset = map.addTilesetImage('moving-platform', 'moving-platform');
        const woodenPlatformTileset = map.addTilesetImage('wooden moving platform', 'wooden moving platform');
        const jumpPadTileset = map.addTilesetImage('jump-pad', 'jump-pad-img');
        const mountainTileset = map.addTilesetImage('mountain', 'mountain');
        const dungeon32Tileset = map.addTilesetImage('32 files dungeon', '32 files dungeon');
        const dungeon64Tileset = map.addTilesetImage('64 files dungeon', '64 files dungeon');
        const cloudVariationTileset = map.addTilesetImage('cloud variation', 'cloud variation');
        const plainDungeonTileset = map.addTilesetImage('plainDungeon', 'plainDungeon') || map.addTilesetImage('plain-dungeon', 'plain-dungeon');
        const plainGroundTileset = map.addTilesetImage('plainGround', 'plainGround') || map.addTilesetImage('plain-ground', 'plain-ground');

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
            wellTileset,
            waterTileset,
            lavaTileset,
            bushTileset,
            dandelionTileset,
            movingPlatformTileset,
            woodenPlatformTileset,
            jumpPadTileset,
            mountainTileset,
            dungeon32Tileset,
            dungeon64Tileset,
            cloudVariationTileset,
            plainDungeonTileset,
            plainGroundTileset
        ].filter(Boolean) as Phaser.Tilemaps.Tileset[];

        // Automatically link any tilesets referenced in map.tilesets that match loaded textures
        if (map.tilesets && map.tilesets.length > 0) {
            map.tilesets.forEach(ts => {
                if (!allTilesets.some(t => t.name === ts.name)) {
                    const candidates = [
                        ts.name,
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

        map.createLayer('Sky', allTilesets, 0, 0)?.setDepth(this.getTiledLayerDepth(map, 'Sky', 0));
        map.createLayer('Trees', allTilesets, 0, 0)?.setDepth(this.getTiledLayerDepth(map, 'Trees', 1));
        map.createLayer('Background', allTilesets, 0, 0)?.setDepth(this.getTiledLayerDepth(map, 'Background', 2));
        
        const transparentLayer = map.createLayer('Transparent', allTilesets, 0, 0);
        if (transparentLayer) {
            transparentLayer.setDepth(this.getTiledLayerDepth(map, 'Transparent', 2.7));
        }

        this.groundLayer = map.createLayer('Ground', allTilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
        this.groundLayer.setDepth(this.getTiledLayerDepth(map, 'Ground', 3));
        this.groundLayer.setCollisionByExclusion([-1]);

        this.smashLayer = (map.createLayer('SmashGround', allTilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer) || undefined;
        if (this.smashLayer) {
            this.smashLayer.setDepth(this.getTiledLayerDepth(map, 'SmashGround', 3.1));
            this.smashLayer.setCollisionByExclusion([-1]);
        }

        this.oneWayLayer = map.createLayer('OneWayPlatforms', allTilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer;
        this.oneWayLayer.setDepth(this.getTiledLayerDepth(map, 'OneWayPlatforms', 3.2));
        this.oneWayLayer.setCollisionByExclusion([-1]);

        this.hazardsLayer = (map.createLayer('Hazards', allTilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer) || undefined;
        if (this.hazardsLayer) {
            this.hazardsLayer.setDepth(this.getTiledLayerDepth(map, 'Hazards', 3.3));
            this.hazardsLayer.setCollisionByExclusion([-1]);
        }

        map.createLayer('Foreground', allTilesets, 0, 0)?.setDepth(this.getTiledLayerDepth(map, 'Foreground', 8));
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

    private createAnimations() {
        this.anims.create({ key: 'idle-r-anim', frames: this.anims.generateFrameNumbers('idle-wind-r', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'idle-l-anim', frames: this.anims.generateFrameNumbers('idle-wind-l', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'shoot-l-anim', frames: this.anims.generateFrameNumbers('player-shoot', { start: 0, end: 1 }), frameRate: 8, repeat: 0 });
        this.anims.create({ key: 'shoot-r-anim', frames: [{ key: 'player-shoot', frame: 3 }, { key: 'player-shoot', frame: 2 }], frameRate: 8, repeat: 0 });
        this.anims.create({ key: 'walk-r-anim', frames: this.anims.generateFrameNumbers('walk-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-l-anim', frames: this.anims.generateFrameNumbers('walk-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fall-l-anim', frames: this.anims.generateFrameNumbers('player-fall', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fall-r-anim', frames: this.anims.generateFrameNumbers('player-fall', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fall-gun-l-anim', frames: this.anims.generateFrameNumbers('player-fall-gun-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fall-gun-r-anim', frames: this.anims.generateFrameNumbers('player-fall-gun-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'coin-spin', frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
        
        // Death Effect: play 32x32 frames from bottom to top (frame 2 -> 1 -> 0)
        this.anims.create({
            key: 'death-effect-anim',
            frames: [
                { key: 'death-effect', frame: 2 },
                { key: 'death-effect', frame: 1 },
                { key: 'death-effect', frame: 0 }
            ],
            frameRate: 10,
            repeat: 0
        });

        // Lava Death Effects (Left: frame 0 -> 5; Right: frame 5 -> 0)
        this.anims.create({
            key: 'lava-death-l-anim',
            frames: this.anims.generateFrameNumbers('lava-death-l', { start: 0, end: 5 }),
            frameRate: 14,
            repeat: 0
        });

        this.anims.create({
            key: 'lava-death-r-anim',
            frames: [
                { key: 'lava-death-r', frame: 5 },
                { key: 'lava-death-r', frame: 4 },
                { key: 'lava-death-r', frame: 3 },
                { key: 'lava-death-r', frame: 2 },
                { key: 'lava-death-r', frame: 1 },
                { key: 'lava-death-r', frame: 0 }
            ],
            frameRate: 14,
            repeat: 0
        });

        // Bullet Fire Animation (4-frame spinning flame blast: frames 40-43 in 16x16 grid)
        this.anims.create({ key: 'fire-bullet-anim', frames: this.anims.generateFrameNumbers('fire-bullets', { start: 40, end: 43 }), frameRate: 14, repeat: -1 });

        // Enemy Shooter Fireball (32x32: 0..3 Left, 4..7 Right)
        this.anims.create({ key: 'enemy-fireball-l', frames: this.anims.generateFrameNumbers('enemy-fireball', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'enemy-fireball-r', frames: this.anims.generateFrameNumbers('enemy-fireball', { start: 4, end: 7 }), frameRate: 10, repeat: -1 });

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

        // Firebar spinning fire animation (4 frames)
        this.anims.create({ key: 'firebar-spin', frames: this.anims.generateFrameNumbers('firebar-sprite', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });

        // Dandelion gentle sway animation (4 frames)
        this.anims.create({ key: 'dandelion-sway', frames: this.anims.generateFrameNumbers('dandelion', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
    }

    update(_time: number, delta: number) {
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
        this.envManager.update(delta);
        this.inventoryManager.update();
        this.enemyManager.update(this.groundLayer, this.oneWayLayer, delta);
        SecurityManager.getInstance().logPlayerPosition(this.player.x, this.player.y);

        const currentFrame = Math.floor((this.time.now - this.startTime) / 16.6667);
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
