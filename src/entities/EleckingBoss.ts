import Phaser from 'phaser';
import { Player } from './Player';
import { UIManager } from '../managers/UIManager';
import { EnemyManager } from '../managers/EnemyManager';
import { EnvironmentManager } from '../managers/EnvironmentManager';
import { SoundManager } from '../managers/SoundManager';

export class EleckingBoss extends Phaser.Physics.Arcade.Sprite {
    private player: Player;
    private uiManager: UIManager;
    private enemyManager: EnemyManager;
    private soundManager?: SoundManager;

    private hasStarted: boolean = false;
    private hp: number = 50;
    private phase: number = 1;
    public isDead: boolean = false;
    private isInvulnerable: boolean = true;

    // Tiled Properties & Objects
    private arenaZone?: Phaser.Geom.Rectangle;
    private arenaCover?: Phaser.GameObjects.TileSprite;
    private bossLimitZone?: Phaser.Geom.Rectangle;
    private bossEntranceZone?: Phaser.Geom.Rectangle;
    private bossRespawnPoint?: { x: number, y: number };
    private victoryPortalPoint?: { x: number, y: number };
    private initialSpawn: { x: number, y: number };
    private gravityOrbs: Phaser.GameObjects.Sprite[] = [];
    private rawGravityOrbData: { x: number, y: number }[] = [];
    private tempClouds: Phaser.Physics.Arcade.Sprite[] = [];
    private collectedOrbs: number = 0;
    private victoryOrb?: Phaser.Physics.Arcade.Sprite;
    private victoryPortal?: Phaser.Physics.Arcade.Sprite;
    
    // State Tracking
    private bossState: 'idle' | 'memory-telegraph' | 'vanished' | 'striking' | 'patrolling' | 'summoning' = 'idle';
    
    // Attack Properties
    private currentSequence: number[] = [];
    private thunderTiles: Map<number, Phaser.Tilemaps.Tile[]> = new Map();
    private summonThresholds = [35, 15];
    private orbsOfRageGroup: Phaser.Physics.Arcade.Group;
    private dotBlocks: Phaser.Physics.Arcade.StaticGroup;

    // Movement
    private patrolSpeed: number = 60; // Slow/Medium speed
    private flyTarget?: { x: number, y: number };
    private flyTowardsPlayer: boolean = false;

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        player: Player, 
        uiManager: UIManager, 
        enemyManager: EnemyManager, 
        _envManager: EnvironmentManager,
        soundManager: SoundManager,
        rawMapObjects: any[],
        map: Phaser.Tilemaps.Tilemap
    ) {
        super(scene, x, y, 'elecking-power', 0);
        this.player = player;
        this.uiManager = uiManager;
        this.enemyManager = enemyManager;
        this.soundManager = soundManager;
        this.initialSpawn = { x, y };

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setSize(81, 91); // Exact non-transparent pixel hitbox (96x96 sprite: 81x91 at offset 12,0)
        body.setOffset(12, 0);
        body.setImmovable(true);

        scene.physics.add.overlap(this.player.bullets, this as unknown as Phaser.GameObjects.GameObject, (bulletObj) => {
            const bullet = bulletObj as Phaser.GameObjects.GameObject;
            bullet.destroy();
            this.takeDamage();
        });

        this.setDepth(15);
        this.orbsOfRageGroup = scene.physics.add.group({ allowGravity: false });
        this.dotBlocks = scene.physics.add.staticGroup();
        scene.physics.add.collider(this.player, this.dotBlocks);
        scene.physics.add.collider(this.enemyManager.groundMobs, this.dotBlocks);

        this.setupAnimations();
        this.parseMapObjects(rawMapObjects, map);

        scene.physics.add.collider(this.player, this.tempClouds, (_p, _c) => {
            const playerSprite = _p as Player;
            const cloudSprite = _c as Phaser.Physics.Arcade.Sprite;
            const pBody = playerSprite.body as Phaser.Physics.Arcade.Body;
            const cBody = cloudSprite.body as Phaser.Physics.Arcade.Body;

            if (pBody.bottom <= cBody.top + 8 && (pBody.velocity.y >= 0 || pBody.blocked.down || pBody.touching.down)) {
                playerSprite.isOnPlatform = true;
                this.triggerCloudFade(cloudSprite);
            }
        });
        
        // Initial setup for Phase 1 - starts frozen until player crosses BossFightEntrance
        this.startPhase1(false);

        this.scene.events.on('player-respawn', () => {
            if (this.hasStarted && !this.isDead) {
                // When player respawns inside boss arena, boss and arena objects retain their position and state
                if (this.phase === 1 && this.bossState === 'idle') {
                    this.flyTarget = undefined;
                } else if (this.phase === 2 && this.bossState === 'patrolling') {
                    const bBody = this.body as Phaser.Physics.Arcade.Body;
                    if (bBody) {
                        const dir = this.player.x > this.x ? 1 : -1;
                        bBody.setVelocityX(this.patrolSpeed * dir);
                    }
                }
            }
        });
    }

    private setupAnimations() {
        if (!this.scene.anims.exists('elecking-drum')) {
            this.scene.anims.create({
                key: 'elecking-drum',
                frames: this.scene.anims.generateFrameNumbers('elecking-power', { start: 1, end: 5 }),
                frameRate: 1, // 1 second delay per user spec
                repeat: 0
            });
        }

        if (!this.scene.anims.exists('elecking-powerup-anim')) {
            this.scene.anims.create({
                key: 'elecking-powerup-anim',
                frames: this.scene.anims.generateFrameNumbers('elecking-powerup', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: 0
            });
        }

        if (!this.scene.anims.exists('cloud-thunder-strike')) {
            this.scene.anims.create({
                key: 'cloud-thunder-strike',
                frames: this.scene.anims.generateFrameNumbers('cloud-thunder-attack', { start: 0, end: 4 }),
                frameRate: 10,
                repeat: 0
            });
        }
        if (!this.scene.anims.exists('lightning-strike')) {
            this.scene.anims.create({
                key: 'lightning-strike',
                frames: this.scene.anims.generateFrameNumbers('cloud-thunder-attack', { start: 0, end: 4 }),
                frameRate: 10,
                repeat: 0
            });
        }

        if (!this.scene.anims.exists('attack-orb-anim')) {
            this.scene.anims.create({
                key: 'attack-orb-anim',
                frames: this.scene.anims.generateFrameNumbers('attack-orb', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            });
        }
        if (!this.scene.anims.exists('victory-orb-anim')) {
            this.scene.anims.create({
                key: 'victory-orb-anim',
                frames: this.scene.anims.generateFrameNumbers('victory-orb', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            });
        }
        if (!this.scene.anims.exists('gravity-orb-anim')) {
            this.scene.anims.create({
                key: 'gravity-orb-anim',
                frames: this.scene.anims.generateFrameNumbers('gravity-orb', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            });
        }
    }

    private getProp(obj: any, keys: string[]): any {
        if (!obj) return undefined;
        const lookup = keys.map(k => k.toLowerCase());

        if (Array.isArray(obj.properties)) {
            const found = obj.properties.find((p: any) => p && p.name && lookup.includes(p.name.toLowerCase()));
            if (found && found.value !== undefined && found.value !== null && String(found.value).trim() !== '') {
                return found.value;
            }
        }

        if (obj.properties && typeof obj.properties === 'object' && !Array.isArray(obj.properties)) {
            for (const k of Object.keys(obj.properties)) {
                if (lookup.includes(k.toLowerCase()) && obj.properties[k] !== undefined && obj.properties[k] !== null && String(obj.properties[k]).trim() !== '') {
                    return obj.properties[k];
                }
            }
        }

        for (const k of Object.keys(obj)) {
            if (lookup.includes(k.toLowerCase()) && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
                return obj[k];
            }
        }

        return undefined;
    }

    private parseMapObjects(rawMapObjects: any[], map: Phaser.Tilemaps.Tilemap) {
        // Find BossArenaZone
        const zoneObj = rawMapObjects.find(o => {
            const n = (o.name || '').toLowerCase();
            return n === 'bossarenazone' || n === 'bossarena' || n === 'bossfightzone';
        });
        if (zoneObj) {
            this.arenaZone = new Phaser.Geom.Rectangle(zoneObj.x, zoneObj.y, zoneObj.width || 800, zoneObj.height || 600);
        }

        // Find BossLimit
        const limitObj = rawMapObjects.find(o => {
            const n = (o.name || '').toLowerCase();
            return n === 'bosslimit';
        });
        if (limitObj) {
            this.bossLimitZone = new Phaser.Geom.Rectangle(limitObj.x, limitObj.y, limitObj.width, limitObj.height);
        } else {
            this.bossLimitZone = this.arenaZone;
        }

        if (!this.arenaZone) {
            this.arenaZone = this.bossLimitZone || new Phaser.Geom.Rectangle(this.x - 500, this.y - 400, 1000, 800);
        }

        if (this.arenaZone) {
            const texKey = this.scene.textures.exists('plainGround') ? 'plainGround' : (this.scene.textures.exists('plain-ground') ? 'plain-ground' : 'blocks/plainGround');
            this.arenaCover = this.scene.add.tileSprite(
                this.arenaZone.x,
                this.arenaZone.y,
                this.arenaZone.width,
                this.arenaZone.height,
                texKey
            );
            this.arenaCover.setOrigin(0, 0);
            this.arenaCover.setDepth(20);
            this.arenaCover.setVisible(true);
        }

        // Find BossFightEntrance
        const entranceObj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'bossfightentrance' || nameLower === 'bossentrance';
        });
        if (entranceObj && entranceObj.x !== undefined && entranceObj.y !== undefined) {
            this.bossEntranceZone = new Phaser.Geom.Rectangle(
                entranceObj.x, 
                entranceObj.y, 
                entranceObj.width || 64, 
                entranceObj.height || 96
            );
        }

        // Find BossFightRespawn
        const respawnObj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'bossfightrespawn' || nameLower === 'bossrespawn';
        });
        if (respawnObj && respawnObj.x !== undefined && respawnObj.y !== undefined) {
            this.bossRespawnPoint = { x: respawnObj.x, y: respawnObj.y };
        }

        // Find VictoryPortalSpawn
        const portalObj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'victoryportalspawn' || nameLower === 'victoryportal';
        });
        if (portalObj && portalObj.x !== undefined && portalObj.y !== undefined) {
            this.victoryPortalPoint = {
                x: portalObj.x + (portalObj.width || 0) / 2,
                y: portalObj.y + (portalObj.height || 0) / 2
            };
        }

        // Find TemporaryClouds
        const cloudObjs = rawMapObjects.filter(o => o.name === 'TemporaryCloud');
        cloudObjs.forEach(c => {
            const posX = c.gid 
                ? c.x + (c.width || 64) / 2 
                : c.x + (c.width || 64) / 2;
            const posY = c.gid 
                ? c.y - (c.height || 32) / 2 
                : c.y + (c.height || 32) / 2;

            const cloud = this.scene.physics.add.sprite(posX, posY, 'temp-platforms', 3);
            cloud.setDepth(6);
            cloud.setOrigin(0.5, 0.5);

            const cBody = cloud.body as Phaser.Physics.Arcade.Body;
            if (cBody) {
                cBody.setAllowGravity(false);
                cBody.setImmovable(true);
                cBody.checkCollision.none = false;
                cBody.checkCollision.down = true;
                cBody.checkCollision.left = true;
                cBody.checkCollision.right = true;
                cBody.checkCollision.up = true;
                cBody.setSize(c.width || 64, c.height || 32);
                cBody.setOffset(0, 0);
            }

            // Custom Properties for Fading & Movement
            const fadeVal = this.getProp(c, ['fade', 'canFade', 'canfade', 'isTemporary', 'temporary']);
            const canFade = fadeVal !== undefined ? Boolean(fadeVal) : true;

            let standDuration = Number(this.getProp(c, ['fadeDurationMs', 'standDurationMs', 'standduration', 'fadeduration', 'duration', 'fadetime'])) || 1600;
            if (standDuration > 0 && standDuration <= 20) standDuration = Math.round(standDuration * 1000); // allow seconds (e.g. 1.8 -> 1800ms)

            let respawnDelay = Number(this.getProp(c, ['respawnDelayMs', 'respawndelay', 'respawntime', 'respawn'])) || 2500;
            if (respawnDelay > 0 && respawnDelay <= 20) respawnDelay = Math.round(respawnDelay * 1000); // allow seconds (e.g. 2.5 -> 2500ms)

            const distance = Number(this.getProp(c, ['distance', 'platDistance', 'travelDistance', 'range'])) || 0;
            let speed = Number(this.getProp(c, ['speed', 'platSpeed', 'moveSpeed'])) || 0;
            if (distance > 0 && speed === 0) speed = 50; // default medium-slow speed if distance is set

            const axis = String(this.getProp(c, ['axis', 'directionAxis', 'moveAxis']) || 'x').toLowerCase();
            const direction = Number(this.getProp(c, ['direction', 'dir'])) || 1;

            cloud.setData('state', 'idle');
            cloud.setData('canFade', canFade);
            cloud.setData('standDurationMs', standDuration);
            cloud.setData('respawnDelayMs', respawnDelay);
            cloud.setData('speed', speed);
            cloud.setData('distance', distance);
            cloud.setData('axis', axis);
            cloud.setData('direction', direction);
            cloud.setData('startX', posX);
            cloud.setData('startY', posY);

            if (speed > 0 && distance > 0) {
                if (axis === 'y') {
                    cloud.setData('minY', direction === -1 ? posY - distance : posY);
                    cloud.setData('maxY', direction === -1 ? posY : posY + distance);
                } else {
                    cloud.setData('minX', direction === -1 ? posX - distance : posX);
                    cloud.setData('maxX', direction === -1 ? posX : posX + distance);
                }
                cBody.setVelocity(0, 0); // Initially frozen until encounter is activated
            }

            this.tempClouds.push(cloud);
        });

        // Find GravityOrbs
        const orbObjs = rawMapObjects.filter(o => o.name === 'GravityOrb');
        this.rawGravityOrbData = orbObjs.map(o => ({ x: o.x, y: o.y }));
        this.spawnGravityOrbs();

        // Find Hazard tiles with dotNumber from Object Layer & Tile Layers
        // 1. From rawMapObjects (Tiled tile objects placed in Object Layer)
        const dotObjects = rawMapObjects.filter((o: any) => {
            const val = this.getProp(o, ['dotNumber', 'dotnumber', 'dot']);
            return val !== undefined && val !== null;
        });

        dotObjects.forEach((o: any) => {
            const dot = Number(this.getProp(o, ['dotNumber', 'dotnumber', 'dot']));
            if (!this.thunderTiles.has(dot)) this.thunderTiles.set(dot, []);

            if (o.gid) {
                const cleanGid = o.gid & 0x1FFFFFFF;
                const tileset = map.tilesets.find((t: any) => cleanGid >= t.firstgid && cleanGid < t.firstgid + t.total);
                const localFrame = tileset ? cleanGid - tileset.firstgid : 0;
                let texKey = 'attack-tiles';
                if (tileset && tileset.name && this.scene.textures.exists(tileset.name)) {
                    texKey = tileset.name;
                } else if (this.scene.textures.exists('attack-tiles')) {
                    texKey = 'attack-tiles';
                } else if (this.scene.textures.exists('attack tiles')) {
                    texKey = 'attack tiles';
                }

                // Render solid block sprite (origin bottom-left in Tiled)
                const sprite = this.dotBlocks.create(o.x, o.y, texKey, localFrame) as Phaser.Physics.Arcade.Sprite;
                sprite.setOrigin(0, 1);
                sprite.setDisplaySize(o.width || 32, o.height || 32);
                sprite.refreshBody();
                sprite.setDepth(2);

                this.thunderTiles.get(dot)!.push({
                    pixelX: o.x,
                    pixelY: o.y - (o.height || 32),
                    width: o.width || 32,
                    height: o.height || 32
                } as any);
            } else {
                const block = this.scene.add.rectangle(o.x + (o.width || 32)/2, o.y + (o.height || 32)/2, o.width || 32, o.height || 32, 0x000000, 0);
                this.scene.physics.add.existing(block, true);
                this.dotBlocks.add(block);

                this.thunderTiles.get(dot)!.push({
                    pixelX: o.x,
                    pixelY: o.y,
                    width: o.width || 32,
                    height: o.height || 32
                } as any);
            }
        });

        // 2. From Ground tilelayer
        const groundLayer = map.getLayer('Ground')?.tilemapLayer;
        if (groundLayer) {
            groundLayer.forEachTile(tile => {
                if (tile.properties && (tile.properties.dotNumber || tile.properties.dot)) {
                    const dot = Number(tile.properties.dotNumber || tile.properties.dot);
                    if (!this.thunderTiles.has(dot)) this.thunderTiles.set(dot, []);
                    this.thunderTiles.get(dot)!.push(tile);
                }
            });
        }
    }

    private spawnGravityOrbs() {
        this.gravityOrbs.forEach(orb => {
            if (orb && orb.active) orb.destroy();
        });
        this.gravityOrbs = [];
        this.rawGravityOrbData.forEach(pos => {
            const orb = this.scene.physics.add.sprite(pos.x, pos.y, 'gravity-orb');
            orb.play('gravity-orb-anim');
            orb.setDepth(10);
            const orbBody = orb.body as Phaser.Physics.Arcade.Body;
            if (orbBody) {
                orbBody.setAllowGravity(false);
                orbBody.setSize(24, 24);
                orbBody.setOffset(4, 4);
            }
            this.gravityOrbs.push(orb);

            // Overlap to collect
            this.scene.physics.add.overlap(this.player, orb, () => {
                orb.destroy();
                this.collectedOrbs++;
                this.uiManager.showFloatingText(orb.x, orb.y - 10, `ORB ${this.collectedOrbs}/10`, '#38BDF8');
                if (this.collectedOrbs >= 10 && this.phase === 1) {
                    this.transitionToPhase2();
                }
            });
        });
    }

    public isPlayerInArena(): boolean {
        if (!this.arenaZone || !this.player) return false;
        const px = this.player.x;
        const py = this.player.y;
        if (Phaser.Geom.Rectangle.Contains(this.arenaZone, px, py)) return true;
        if (this.bossLimitZone && Phaser.Geom.Rectangle.Contains(this.bossLimitZone, px, py)) return true;
        if (this.player.activeSpawnX && this.player.activeSpawnY && this.bossRespawnPoint) {
            if (this.player.activeSpawnX === this.bossRespawnPoint.x && this.player.activeSpawnY === this.bossRespawnPoint.y) {
                return true;
            }
        }
        return false;
    }

    public activateEncounter() {
        if (this.hasStarted) return;
        this.hasStarted = true;
        if (this.arenaCover) {
            this.arenaCover.setVisible(false);
        }

        // Unfreeze and start moving all TemporaryCloud platforms
        this.tempClouds.forEach(cloud => {
            const speed = cloud.getData('speed') as number;
            const distance = cloud.getData('distance') as number;
            if (speed > 0 && distance > 0) {
                const axis = cloud.getData('axis') || 'x';
                const direction = (cloud.getData('direction') as number) || 1;
                const cBody = cloud.body as Phaser.Physics.Arcade.Body;
                if (cBody) {
                    if (axis === 'y') {
                        cBody.setVelocityY(speed * direction);
                    } else {
                        cBody.setVelocityX(speed * direction);
                    }
                }
            }
        });

        this.startPhase1(false);
    }

    public resetAll() {
        this.hasStarted = false;
        this.isDead = false;
        this.phase = 1;
        this.hp = 50;
        this.isInvulnerable = true;
        this.bossState = 'idle';
        this.summonThresholds = [35, 15];
        this.flyTarget = undefined;
        this.flyTowardsPlayer = false;
        this.collectedOrbs = 0;

        // Clear all boss projectiles
        this.orbsOfRageGroup.clear(true, true);

        // Clear victory items
        if (this.victoryOrb && this.victoryOrb.active) {
            this.victoryOrb.destroy();
            this.victoryOrb = undefined;
        }
        if (this.victoryPortal && this.victoryPortal.active) {
            this.victoryPortal.destroy();
            this.victoryPortal = undefined;
        }

        // Clean up boss minion mobs in enemyManager
        const minionMobs = this.enemyManager.groundMobs.getChildren().filter((m: any) => m.getData('isBossMinion'));
        minionMobs.forEach((m: any) => m.destroy());

        // Reset gravity orbs to full 10
        this.spawnGravityOrbs();

        // Reset moving platforms to start positions and freeze them
        this.tempClouds.forEach(cloud => {
            if (!cloud.active) return;
            cloud.setVisible(true);
            cloud.setFrame(3);
            cloud.setData('state', 'idle');
            cloud.setPosition(cloud.getData('startX'), cloud.getData('startY'));
            const cBody = cloud.body as Phaser.Physics.Arcade.Body;
            if (cBody) {
                cBody.setEnable(true);
                cBody.setVelocity(0, 0);
            }
        });

        // Reset boss sprite and body to initial spawn
        this.setTexture('elecking-power');
        this.setBossFrame(0);
        this.setVisible(true);
        this.setPosition(this.initialSpawn.x, this.initialSpawn.y);
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
            body.setVelocity(0, 0);
        }

        // Reset arena cover
        if (this.arenaCover) {
            this.arenaCover.setVisible(true);
        }
    }

    private static readonly FRAME_HITBOXES: Record<number, { width: number, height: number, offsetX: number, offsetY: number }> = {
        0: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        1: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        2: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        3: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        4: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        5: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
    };

    public setBossFrame(frameIndex: number | string) {
        this.setFrame(frameIndex);
        const idx = typeof frameIndex === 'number' ? frameIndex : parseInt(frameIndex, 10) || 0;
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            const box = EleckingBoss.FRAME_HITBOXES[idx] || EleckingBoss.FRAME_HITBOXES[0];
            body.setSize(box.width, box.height);
            body.setOffset(box.offsetX, box.offsetY);
        }
    }

    private startPhase1(retainPosition: boolean = false) {
        this.phase = 1;
        this.isInvulnerable = true;
        this.bossState = 'idle';
        this.setTexture('elecking-power');
        this.setBossFrame(0);
        this.setVisible(true);
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
            body.setVelocity(0, 0);
        }
        if (!retainPosition) {
            this.setPosition(this.initialSpawn.x, this.initialSpawn.y);
        }
        if (this.hasStarted && this.isPlayerInArena()) {
            this.queueNextThunderSequence();
        }
    }

    private queueNextThunderSequence() {
        if (this.phase !== 1 && this.phase !== 2) return;
        if (this.isDead || !this.hasStarted) return;

        this.bossState = 'idle';
        this.scene.time.delayedCall(3000, () => {
            if (this.isPlayerInArena() && !this.isDead) {
                this.playThunderTelegraph();
            }
        });
    }

    private playThunderTelegraph() {
        if (this.isDead || !this.isPlayerInArena()) return;
        this.bossState = 'memory-telegraph';
        this.anims.stop();
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        
        // Pick exactly 3 random distinct drums in a randomized sequence (e.g. [1, 3, 5], [3, 5, 1], [2, 1, 4])
        const available = [1, 2, 3, 4, 5];
        this.currentSequence = Phaser.Utils.Array.Shuffle(available).slice(0, 3);

        // Step through each drum in the sequence displaying its specific frame sequentially for 1 second each
        let step = 0;
        const playNextDrum = () => {
            if (this.isDead || !this.isPlayerInArena() || this.bossState !== 'memory-telegraph') return;

            if (step < this.currentSequence.length) {
                const drumNumber = this.currentSequence[step];
                // Frame 1 corresponds to Drum 1, Frame 5 to Drum 5
                this.setTexture('elecking-power');
                this.setBossFrame(drumNumber);
                this.soundManager?.playEnemyShoot();
                step++;
                this.scene.time.delayedCall(1000, playNextDrum);
            } else {
                // Play "Elecking Powerup 96.png" from left frame to right before disappearing for thunder attack
                this.setTexture('elecking-powerup');
                const pBody = this.body as Phaser.Physics.Arcade.Body;
                if (pBody) {
                    pBody.setSize(81, 91);
                    pBody.setOffset(12, 0);
                }
                this.play('elecking-powerup-anim');
                this.soundManager?.playEnemyShoot();
                this.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'elecking-powerup-anim', () => {
                    this.vanishAndStrike();
                });
            }
        };

        playNextDrum();
    }

    private vanishAndStrike() {
        if (this.isDead || !this.isPlayerInArena()) return;
        this.bossState = 'vanished';
        this.setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).setEnable(false);

        // Disappear for 3-4 seconds, then strike
        this.scene.time.delayedCall(Phaser.Math.Between(3000, 4000), () => {
            if (this.isPlayerInArena() && !this.isDead) {
                this.executeThunderStrikes();
            }
        });
    }

    private executeThunderStrikes() {
        if (this.isDead || !this.isPlayerInArena()) return;
        this.bossState = 'striking';

        // Strike the tiles matching the boss's telegraphed pattern in sequence
        let delay = 0;
        this.currentSequence.forEach(dotNumber => {
            this.scene.time.delayedCall(delay, () => {
                const tiles = this.thunderTiles.get(dotNumber) || [];
                tiles.forEach(tile => {
                    const tileX = tile.pixelX !== undefined ? tile.pixelX : (tile as any).x;
                    const tileY = tile.pixelY !== undefined ? tile.pixelY : (tile as any).y;
                    const tileW = tile.width || 32;
                    const tileH = tile.height || 32;

                    // Play cloud & lightning animation striking down onto the 32x32 ground tile from the sky
                    const cloudEffect = this.scene.add.sprite(tileX + tileW / 2, tileY, 'cloud-thunder-attack', 0);
                    cloudEffect.setOrigin(0.5, 1);
                    cloudEffect.setDepth(12);
                    cloudEffect.play('cloud-thunder-strike');

                    // Physics body covering the entire 32x240 column from cloud top down to ground
                    this.scene.physics.add.existing(cloudEffect);
                    const cBody = cloudEffect.body as Phaser.Physics.Arcade.Body;
                    if (cBody) {
                        cBody.setAllowGravity(false);
                        cBody.setImmovable(true);
                        cBody.setSize(24, 240);
                        cBody.setOffset(4, 0);
                    }

                    // Touching any pixels from cloud down through the lightning beam kills the player
                    const strikeCollider = this.scene.physics.add.overlap(this.player, cloudEffect, () => {
                        this.player.die('electric');
                    });

                    // Stepping on or touching the targeted 32x32 ground tile while struck kills the player
                    const groundCheckTimer = this.scene.time.addEvent({
                        delay: 40,
                        repeat: 12,
                        callback: () => {
                            if (!this.player || this.player.isDying) return;
                            const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                            if (pBody) {
                                const pRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
                                const tRect = new Phaser.Geom.Rectangle(tileX, tileY - 4, tileW, tileH + 8);
                                if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, tRect)) {
                                    this.player.die('electric');
                                }
                            }
                        }
                    });

                    this.soundManager?.playEnemyShoot();

                    this.scene.time.delayedCall(550, () => {
                        if (strikeCollider) strikeCollider.destroy();
                        if (groundCheckTimer) groundCheckTimer.destroy();
                        if (cloudEffect && cloudEffect.active) cloudEffect.destroy();
                    });
                });
            });
            delay += 400; // Stagger each strike so the player can see them clearly
        });

        // Return to normal
        this.scene.time.delayedCall(delay + 1000, () => {
            this.setTexture('elecking-power');
            this.setVisible(true);
            this.setBossFrame(0);
            (this.body as Phaser.Physics.Arcade.Body).setEnable(true);
            
            if (this.phase === 1) {
                this.flyTarget = undefined;
                this.queueNextThunderSequence();
            } else if (this.phase === 2) {
                this.startGroundedPatrol();
            }
        });
    }

    private transitionToPhase2() {
        this.phase = 2;
        this.isInvulnerable = false;
        
        // Show health bar
        this.uiManager.showFloatingText(this.x, this.y - 40, 'PHASE 2 - VULNERABLE', '#FF0000');
        
        // Descend to ground
        this.startGroundedPatrol();
        
        // Start ground thunder loop
        this.scene.time.addEvent({
            delay: 15000, // 15 seconds
            loop: true,
            callback: () => {
                if (this.phase === 2 && this.bossState === 'patrolling') {
                    this.playThunderTelegraph();
                }
            }
        });

        // Start shooting Orbs of Rage
        this.scene.time.addEvent({
            delay: 2000,
            loop: true,
            callback: () => {
                if (this.phase === 2 && this.bossState === 'patrolling' && !this.isDead) {
                    this.fireOrbOfRage();
                }
            }
        });
    }

    private startGroundedPatrol() {
        this.bossState = 'patrolling';
        // Position just above ground
        const zone = this.bossLimitZone || this.arenaZone;
        if (zone) {
            this.setPosition(this.x, zone.bottom - 48);
        }
        const dir = this.player.x > this.x ? 1 : -1;
        (this.body as Phaser.Physics.Arcade.Body).setVelocityX(this.patrolSpeed * dir);
    }

    private fireOrbOfRage() {
        const orb = this.orbsOfRageGroup.create(this.x, this.y, 'attack-orb') as Phaser.Physics.Arcade.Sprite;
        orb.play('attack-orb-anim');
        orb.setDepth(14);
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.player.x, this.player.y);
        const speed = 150; // Medium speed
        const orbBody = orb.body as Phaser.Physics.Arcade.Body;
        if (orbBody) {
            orbBody.setSize(20, 20);
            orbBody.setOffset(6, 6);
            this.scene.physics.velocityFromRotation(angle, speed, orbBody.velocity);
        }
    }

    public takeDamage() {
        if (this.isInvulnerable || this.isDead || this.bossState === 'vanished') return;

        this.hp -= 1;
        this.setTint(0xFF0000);
        this.scene.time.delayedCall(100, () => this.clearTint());

        // Update health bar UI (implement in UIManager if needed)
        this.uiManager.showFloatingText(this.x, this.y - 20, `${this.hp} HP`, '#FF0000');

        // Check summoning thresholds
        if (this.summonThresholds.includes(this.hp)) {
            this.summonThresholds = this.summonThresholds.filter(t => t !== this.hp);
            this.summonMinions();
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    private summonMinions() {
        this.bossState = 'summoning';
        (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0); // Pause patrol
        
        // Summon 2-3 Sandal Mobs at boss location
        const count = Phaser.Math.Between(2, 3);
        for (let i = 0; i < count; i++) {
            const offsetX = Phaser.Math.Between(-30, 30);
            const initialDir = offsetX > 0 ? 1 : -1;
            
            // Sandal mob uses specific texture frame according to EnemyManager
            const minion = this.enemyManager.groundMobs.create(this.x + offsetX, this.y, 'walk-r', 0) as Phaser.Physics.Arcade.Sprite;
            minion.setDepth(4).setOrigin(0.5, 1);
            
            const body = minion.body as Phaser.Physics.Arcade.Body;
            body.setSize(22, 22);
            body.setOffset(5, 10);
            body.setCollideWorldBounds(true);
            
            const animKey = initialDir === 1 ? 'walk-r' : 'walk-l';
            if (this.scene.anims.exists(animKey)) {
                minion.play(animKey);
            }
            
            minion.setData('uniqueKey', `boss_minion_${this.scene.time.now}_${i}`);
            minion.setData('spawnX', this.x + offsetX);
            minion.setData('spawnY', this.y);
            minion.setData('direction', initialDir);
            minion.setData('speed', 60);
            minion.setData('stationary', false);
            minion.setData('type', 'sandal');
            minion.setData('canShoot', false);
            minion.setData('allowOneWay', true);
            minion.setData('isBossMinion', true);
        }

        this.uiManager.showFloatingText(this.x, this.y - 40, 'SUMMONING!', '#8B5CF6');
        
        this.scene.time.delayedCall(2000, () => {
            if (this.phase === 2 && !this.isDead) this.startGroundedPatrol();
        });
    }

    private die() {
        this.isDead = true;
        this.setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).setEnable(false);
        if (this.soundManager) this.soundManager.stopMusic();

        // Boss explosion
        for (let i = 0; i < 20; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.uiManager.spawnParticles(
                    this.x + Phaser.Math.Between(-50, 50),
                    this.y + Phaser.Math.Between(-50, 50),
                    0xFFD700
                );
            });
        }

        // Spawn Orb of Victory
        this.scene.time.delayedCall(2000, () => {
            if (this.victoryOrb && this.victoryOrb.active) this.victoryOrb.destroy();
            this.victoryOrb = this.scene.physics.add.sprite(this.x, this.y, 'victory-orb');
            this.victoryOrb.play('victory-orb-anim');
            this.victoryOrb.setDepth(15);
            const body = this.victoryOrb.body as Phaser.Physics.Arcade.Body;
            if (body) {
                body.setAllowGravity(false);
                body.setSize(24, 24);
                body.setOffset(4, 4);
            }
            
            this.scene.physics.add.overlap(this.player, this.victoryOrb, () => {
                if (this.victoryOrb) {
                    this.victoryOrb.destroy();
                    this.victoryOrb = undefined;
                }
                this.uiManager.showFloatingText(this.x, this.y - 15, 'VICTORY!', '#FFD700');
                this.spawnVictoryPortal();
            });
        });
    }

    private spawnVictoryPortal() {
        const portalX = this.victoryPortalPoint?.x ?? this.x;
        const portalY = this.victoryPortalPoint?.y ?? (this.y - 50);

        if (this.victoryPortal && this.victoryPortal.active) this.victoryPortal.destroy();
        this.victoryPortal = this.scene.physics.add.sprite(portalX, portalY, 'victory-orb');
        this.victoryPortal.play('victory-orb-anim');
        this.victoryPortal.setScale(2);
        this.victoryPortal.setDepth(15);
        (this.victoryPortal.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        
        this.uiManager.showFloatingText(portalX, portalY - 30, 'PORTAL OPEN', '#38BDF8');

        this.scene.physics.add.overlap(this.player, this.victoryPortal, () => {
            // Stage Clear & SurrealDB Integration
            if (typeof (this.scene as any).onStageComplete === 'function') {
                (this.scene as any).onStageComplete();
            }
        });
    }

    private triggerCloudFade(cloud: Phaser.Physics.Arcade.Sprite) {
        if (!cloud.active || cloud.getData('state') !== 'idle') return;
        if (cloud.getData('canFade') === false) return;

        cloud.setData('state', 'fading');
        const standDuration = cloud.getData('standDurationMs') || 1600;
        const stepTime = Math.floor(standDuration / 4);

        // Transition: Frame 3 (solid) -> Frame 2 -> Frame 1 -> Frame 0 -> vanish
        this.scene.time.delayedCall(stepTime, () => {
            if (!cloud.active || cloud.getData('state') !== 'fading') return;
            cloud.setFrame(2);
        });

        this.scene.time.delayedCall(stepTime * 2, () => {
            if (!cloud.active || cloud.getData('state') !== 'fading') return;
            cloud.setFrame(1);
        });

        this.scene.time.delayedCall(stepTime * 3, () => {
            if (!cloud.active || cloud.getData('state') !== 'fading') return;
            cloud.setFrame(0);
        });

        this.scene.time.delayedCall(standDuration, () => {
            if (!cloud.active || cloud.getData('state') !== 'fading') return;
            cloud.setData('state', 'vanished');
            cloud.setVisible(false);
            const cBody = cloud.body as Phaser.Physics.Arcade.Body;
            if (cBody) cBody.setEnable(false);

            const respawnDelay = cloud.getData('respawnDelayMs') || 2500;
            this.scene.time.delayedCall(respawnDelay, () => {
                if (!cloud.active) return;
                cloud.setFrame(3);
                cloud.setVisible(true);
                if (cBody) cBody.setEnable(true);
                cloud.setData('state', 'idle');
            });
        });
    }

    public update(_time: number, _delta: number) {
        if (this.isDead) return;

        // Frozen until player crosses BossFightEntrance or enters the arena
        if (!this.hasStarted) {
            const px = this.player.x;
            const py = this.player.y;
            const pRect = new Phaser.Geom.Rectangle(this.player.x - 16, this.player.y - 16, 32, 32);

            const crossedEntrance = this.bossEntranceZone && (
                Phaser.Geom.Rectangle.Contains(this.bossEntranceZone, px, py) ||
                Phaser.Geom.Intersects.RectangleToRectangle(this.bossEntranceZone, pRect)
            );
            const inArena = this.isPlayerInArena();

            if (crossedEntrance || inArena) {
                this.activateEncounter();
            } else {
                // Keep boss & all moving platforms completely frozen outside
                const bBody = this.body as Phaser.Physics.Arcade.Body;
                if (bBody) bBody.setVelocity(0, 0);

                this.tempClouds.forEach(cloud => {
                    const cBody = cloud.body as Phaser.Physics.Arcade.Body;
                    if (cBody) cBody.setVelocity(0, 0);
                });
                if (this.arenaCover) {
                    this.arenaCover.setVisible(true);
                }
                return;
            }
        }

        const inArena = this.isPlayerInArena();

        if (this.arenaCover) {
            this.arenaCover.setVisible(false);
        }

        if (!inArena) {
            // Freeze boss and moving platforms completely when outside arena
            const bBody = this.body as Phaser.Physics.Arcade.Body;
            if (bBody) bBody.setVelocity(0, 0);

            this.tempClouds.forEach(cloud => {
                const cBody = cloud.body as Phaser.Physics.Arcade.Body;
                if (cBody) cBody.setVelocity(0, 0);
            });
            return;
        }

        // When inside arena:
        if (this.bossRespawnPoint) {
            this.player.activeSpawnX = this.bossRespawnPoint.x;
            this.player.activeSpawnY = this.bossRespawnPoint.y;
        }

        // Lethal Body Contact
        if (this.bossState !== 'vanished' && this.scene.physics.overlap(this.player, this as unknown as Phaser.GameObjects.GameObject)) {
            this.player.die();
        }

        // Projectile overlap
        this.scene.physics.overlap(this.player, this.orbsOfRageGroup, (_player, orbObj) => {
            const orb = orbObj as Phaser.GameObjects.GameObject;
            orb.destroy();
            this.player.die();
        });

        // Hover & Air Flight logic for Phase 1 (fly towards player direction and back, not very close to the ground)
        if (this.phase === 1 && this.bossState === 'idle') {
            const zone = this.bossLimitZone || this.arenaZone;
            if (zone) {
                const arenaTop = zone.top;
                const arenaBottom = zone.bottom;
                const minY = arenaTop + 32;
                const maxY = Math.min(arenaTop + 140, arenaBottom - 180);
                const safeMaxY = maxY > minY ? maxY : minY + 40;

                const minX = zone.left + 48;
                const maxX = zone.right - 48;

                if (!this.flyTarget || Phaser.Math.Distance.Between(this.x, this.y, this.flyTarget.x, this.flyTarget.y) < 16) {
                    this.flyTowardsPlayer = !this.flyTowardsPlayer;
                    let targetX: number;
                    if (this.flyTowardsPlayer) {
                        // Fly towards player direction with gentle variance
                        targetX = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-60, 60), minX, maxX);
                    } else {
                        // Fly back / away in the opposite direction
                        const dirAway = this.player.x > this.x ? -1 : 1;
                        targetX = Phaser.Math.Clamp(this.x + dirAway * Phaser.Math.Between(120, 240), minX, maxX);
                    }
                    const targetY = Phaser.Math.Between(minY, safeMaxY);
                    this.flyTarget = { x: targetX, y: targetY };
                }

                this.scene.physics.moveTo(this, this.flyTarget.x, this.flyTarget.y, 65);
            }
        } else if (this.phase === 1 && this.bossState !== 'idle') {
            (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        }

        // Ground Patrol & Player Following for Phase 2
        if (this.phase === 2 && this.bossState === 'patrolling') {
            const zone = this.bossLimitZone || this.arenaZone;
            const body = this.body as Phaser.Physics.Arcade.Body;
            if (zone && body) {
                this.setY(zone.bottom - 48);

                const minX = zone.left + 32;
                const maxX = zone.right - 32;

                const dx = this.player.x - this.x;
                if (Math.abs(dx) > 10) {
                    const dir = dx > 0 ? 1 : -1;
                    body.setVelocityX(this.patrolSpeed * dir);
                }

                if (this.x <= minX && body.velocity.x < 0) {
                    body.setVelocityX(0);
                    this.setX(minX);
                } else if (this.x >= maxX && body.velocity.x > 0) {
                    body.setVelocityX(0);
                    this.setX(maxX);
                }
            }
        }

        // Moving Cloud Platforms Patrol
        this.tempClouds.forEach(cloud => {
            if (!cloud.active || cloud.getData('state') === 'vanished') return;
            const speed = cloud.getData('speed') as number;
            const distance = cloud.getData('distance') as number;
            if (!speed || !distance) return;

            const axis = cloud.getData('axis') || 'x';
            const cBody = cloud.body as Phaser.Physics.Arcade.Body;
            if (!cBody) return;

            if (axis === 'y') {
                const minY = cloud.getData('minY') as number;
                const maxY = cloud.getData('maxY') as number;
                if (cloud.y >= maxY) {
                    cBody.setVelocityY(-speed);
                } else if (cloud.y <= minY) {
                    cBody.setVelocityY(speed);
                }
            } else {
                const minX = cloud.getData('minX') as number;
                const maxX = cloud.getData('maxX') as number;
                if (cloud.x >= maxX) {
                    cBody.setVelocityX(-speed);
                } else if (cloud.x <= minX) {
                    cBody.setVelocityX(speed);
                }
            }
        });
    }
}
