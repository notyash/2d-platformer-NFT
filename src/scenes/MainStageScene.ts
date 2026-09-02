// src/scenes/MainStageScene.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { EnvironmentManager } from '../managers/EnvironmentManager';
import { EnemyManager } from '../managers/EnemyManager';
import { CollectiblesManager } from '../managers/CollectiblesManager';
import { UIManager } from '../managers/UIManager';

export class MainStageScene extends Phaser.Scene {
    private player!: Player;
    private envManager!: EnvironmentManager;
    private enemyManager!: EnemyManager;
    private collectiblesManager!: CollectiblesManager;
    private uiManager!: UIManager;

    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private oneWayLayer!: Phaser.Tilemaps.TilemapLayer;

    private startTime: number = 0;

    constructor() {
        super('MainStageScene');
    }

    preload() {
        // Keeps your exact original loading logic
        this.load.image('levelobjects', 'assets/tilesets/LevelObjectTiles.png');
        this.load.image('landtiles', 'assets/tilesets/LandTiles_32_32.png');
        this.load.image('sky', 'assets/tilesets/sky.png');
        this.load.image('clouds1', 'assets/tilesets/clouds1.png');
        this.load.image('smallTree', 'assets/tilesets/smallTree.png');
        this.load.image('largeTree', 'assets/tilesets/largeTree.png');
        this.load.image('grass', 'assets/tilesets/grass.png');
        this.load.image('cloud2', 'assets/tilesets/cloud2.png');
        this.load.tilemapTiledJSON('stage1', 'assets/tilemaps/harder-main-stage.json');

        this.load.image('moving-platform-img', 'assets/sprites/moving-platform.png');
        this.load.image('pipe-monster', 'assets/sprites/monsters/Devil_Red_Stand_L.png');
        this.load.image('jump-pad-img', 'assets/sprites/jump-pad.png');
        this.load.spritesheet('coin', 'assets/sprites/Coin_24x24_Anim.png', { frameWidth: 24, frameHeight: 24 });
        this.load.image('bullet', 'assets/sprites/bullet.png');

        this.load.spritesheet('mob-onion', 'assets/sprites/monsters/onion-sheet.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-slime', 'assets/sprites/monsters/slime-sheet.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-goblin', 'assets/sprites/monsters/goblin-sheet.png', { frameWidth: 32, frameHeight: 32 });

        const totemSvg = `data:image/svg+xml;charset=utf8,<svg width="96" height="24" xmlns="http://www.w3.org/2000/svg"><g stroke="%23B8860B" stroke-width="2"><polygon fill="%23FFD700" points="12,2 22,12 12,22 2,12"/><polygon fill="%23FFEA00" points="36,4 42,12 36,20 30,12"/><polygon fill="%23FFFF00" points="60,6 62,12 60,18 58,12"/><polygon fill="%23FFEA00" points="84,4 90,12 84,20 78,12"/></g></svg>`;
        const gunSvg = `data:image/svg+xml;charset=utf8,<svg width="96" height="24" xmlns="http://www.w3.org/2000/svg"><g stroke="%23008B8B" stroke-width="2"><rect fill="%2300FFFF" x="4" y="6" width="16" height="12" rx="4"/><rect fill="%23E0FFFF" x="28" y="8" width="16" height="8" rx="2"/><rect fill="%23FFFFFF" x="52" y="10" width="16" height="4" rx="1"/><rect fill="%23E0FFFF" x="76" y="8" width="16" height="8" rx="2"/></g></svg>`;
        const cpSvg = `data:image/svg+xml;charset=utf8,<svg width="96" height="24" xmlns="http://www.w3.org/2000/svg"><g stroke="%234B0082" stroke-width="2"><path fill="%239370DB" d="M 6 4 L 18 4 L 12 12 L 18 20 L 6 20 L 12 12 Z"/><path fill="%23AB82FF" d="M 32 6 L 40 6 L 36 12 L 40 18 L 32 18 L 36 12 Z"/><path fill="%23D15FEE" d="M 58 8 L 62 8 L 60 12 L 62 16 L 58 16 L 60 12 Z"/><path fill="%23AB82FF" d="M 80 6 L 88 6 L 84 12 L 88 18 L 80 18 L 84 12 Z"/></g></svg>`;
        const particleSvg = `data:image/svg+xml;charset=utf8,<svg width="8" height="8" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="4" fill="%23FFFFFF"/></svg>`;
        const fireballSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="%23FF4500"/><circle cx="8" cy="8" r="5" fill="%23FF8C00"/><circle cx="8" cy="8" r="3" fill="%23FFFF00"/></svg>`;
        
        this.load.spritesheet('totem', totemSvg, { frameWidth: 24, frameHeight: 24 });
        this.load.spritesheet('gun-powerup', gunSvg, { frameWidth: 24, frameHeight: 24 });
        this.load.spritesheet('temp-checkpoint', cpSvg, { frameWidth: 24, frameHeight: 24 });
        this.load.image('particle', particleSvg);
        this.load.image('fireball', fireballSvg);

        this.load.image('idle-r', 'assets/sprites/player/Melissa_Stand_R.png');
        this.load.image('idle-l', 'assets/sprites/player/Melissa_Stand_L.png');
        this.load.image('jump-r', 'assets/sprites/player/Melissa_Jump1_R.png');
        this.load.image('jump-l', 'assets/sprites/player/Melissa_Jump1_L.png');
        this.load.image('fall-r', 'assets/sprites/player/Melissa_Fall2_R.png');
        this.load.image('fall-l', 'assets/sprites/player/Melissa_Fall2_L.png');
        this.load.spritesheet('walk-r', 'assets/sprites/player/Melissa_Walk_Anim_R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('walk-l', 'assets/sprites/player/Melissa_Walk_Anim_L.png', { frameWidth: 32, frameHeight: 32 });
    }

    create() {
        const map = this.make.tilemap({ key: 'stage1' });
        this.createLayers(map);
        this.createAnimations();

        const rawMapObjects = map.getObjectLayer('Objects')?.objects || [];
        
        // Find spawn
        let spawnX = 100, spawnY = 100;
        const spawnObject = rawMapObjects.find(obj => obj.name === 'Spawn');
        if (spawnObject && spawnObject.x !== undefined && spawnObject.y !== undefined) {
            spawnX = spawnObject.x; 
            spawnY = spawnObject.y;
        }

        // Initialize Managers
        this.uiManager = new UIManager(this);
        this.uiManager.createHUD();

        this.player = new Player(this, spawnX, spawnY);
        this.player.spawnX = spawnX; this.player.spawnY = spawnY;
        this.player.activeSpawnX = spawnX; this.player.activeSpawnY = spawnY;
        this.player.lastSafeX = spawnX; this.player.lastSafeY = spawnY;

        this.envManager = new EnvironmentManager(this, this.player);
        this.enemyManager = new EnemyManager(this, this.player, this.uiManager);
        this.collectiblesManager = new CollectiblesManager(this, this.player, this.uiManager);

        // Setup Entities
        this.enemyManager.setupGroundMobs(rawMapObjects, this.groundLayer, this.oneWayLayer);
        this.enemyManager.setupPipeMonsters(map);
        
        this.envManager.setupDoors(rawMapObjects);
        this.envManager.setupMovingPlatforms(map, rawMapObjects);
        this.envManager.setupJumpPads(rawMapObjects);
        this.envManager.setupFirebars(rawMapObjects);
        this.envManager.setupSmashTriggers(map);
        
        this.collectiblesManager.setupCollectibles(map);

        // World Colliders
        this.physics.add.collider(this.player, this.groundLayer);
        this.physics.add.collider(this.player, this.oneWayLayer, undefined, (_p, tile) => {
            const t = tile as Phaser.Tilemaps.Tile;
            if (t.index === -1) return false; 
            const body = this.player.body as Phaser.Physics.Arcade.Body;
            return body.velocity.y > 0 && body.bottom <= t.pixelY + 10;
        });

        const smashLayer = map.getLayer('SmashGround')?.tilemapLayer;
        if (smashLayer) {
            this.physics.add.collider(this.player, smashLayer, undefined, (_p, tile) => {
                const t = tile as Phaser.Tilemaps.Tile;
                if (t.index === -1) return false;
                const body = this.player.body as Phaser.Physics.Arcade.Body;
                return body.velocity.y > 0 && body.bottom <= t.pixelY + 10 && !this.player.canSmash;
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
        this.anims.create({ key: 'cp-anim', frames: this.anims.generateFrameNumbers('temp-checkpoint', { start: 0, end: 3 }), frameRate: 8, yoyo: true, repeat: -1 });
        
        this.anims.create({ key: 'onion-walk', frames: this.anims.generateFrameNumbers('mob-onion', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'slime-walk', frames: this.anims.generateFrameNumbers('mob-slime', { start: 0, end: 3 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'goblin-walk', frames: this.anims.generateFrameNumbers('mob-goblin', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
    }

    update() {
        const elapsedSeconds = Math.floor((this.time.now - this.startTime) / 1000);
        
        this.uiManager.updateHUD(
            elapsedSeconds, 
            this.collectiblesManager.coinsCollected, 
            this.enemyManager.enemiesKilled, 
            this.player.gunTimer, 
            this.collectiblesManager.checkpointTimer
        );

        this.player.update();
        this.enemyManager.update(this.groundLayer, this.oneWayLayer);
        this.envManager.update();
    }
}