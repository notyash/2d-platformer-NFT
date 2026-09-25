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
    private bossLimitZone?: Phaser.Geom.Rectangle;
    private bossRespawnPoint?: { x: number, y: number };
    private initialSpawn: { x: number, y: number };
    private gravityOrbs: Phaser.GameObjects.Sprite[] = [];
    private tempClouds: Phaser.Physics.Arcade.Sprite[] = [];
    private collectedOrbs: number = 0;
    
    // State Tracking
    private bossState: 'idle' | 'memory-telegraph' | 'vanished' | 'striking' | 'patrolling' | 'summoning' = 'idle';
    
    // Attack Properties
    private currentSequence: number[] = [];
    private thunderTiles: Map<number, Phaser.Tilemaps.Tile[]> = new Map();
    private summonThresholds = [35, 15];
    private orbsOfRageGroup: Phaser.Physics.Arcade.Group;
    private dotBlocks: Phaser.Physics.Arcade.StaticGroup;

    // Movement
    private patrolDirection: number = 1;
    private patrolSpeed: number = 60; // Slow/Medium speed
    private flyTarget?: { x: number, y: number };

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
        body.setSize(64, 64); // 64x64 hitbox
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

            if (pBody.bottom <= cBody.top + 6 && pBody.velocity.y >= 0) {
                playerSprite.isOnPlatform = true;
                this.triggerCloudFade(cloudSprite);
            }
        });
        
        // Initial setup for Phase 1
        this.startPhase1();

        this.scene.events.on('player-respawn', () => {
            if (this.hasStarted && !this.isDead) {
                this.startPhase1();
            }
            this.tempClouds.forEach(cloud => {
                if (!cloud.active) return;
                cloud.setVisible(true);
                cloud.setFrame(3);
                const cB = cloud.body as Phaser.Physics.Arcade.Body;
                if (cB) cB.setEnable(true);
                cloud.setData('state', 'idle');
            });
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

        if (!this.scene.anims.exists('lightning-strike')) {
            this.scene.anims.create({
                key: 'lightning-strike',
                frames: [
                    { key: 'cloud-attack-1' },
                    { key: 'cloud-attack-2' },
                    { key: 'cloud-attack-3' },
                    { key: 'cloud-attack-4' },
                    { key: 'cloud-attack-5' }
                ],
                frameRate: 12,
                repeat: 0
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
        const zoneObj = rawMapObjects.find(o => o.name === 'BossArenaZone');
        if (zoneObj) {
            this.arenaZone = new Phaser.Geom.Rectangle(zoneObj.x, zoneObj.y, zoneObj.width, zoneObj.height);
        }

        // Find BossLimit
        const limitObj = rawMapObjects.find(o => o.name === 'BossLimit') || zoneObj;
        if (limitObj) {
            this.bossLimitZone = new Phaser.Geom.Rectangle(limitObj.x, limitObj.y, limitObj.width, limitObj.height);
        }

        // Find BossFightRespawn
        const respawnObj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'bossfightrespawn' || nameLower === 'bossrespawn';
        });
        if (respawnObj && respawnObj.x !== undefined && respawnObj.y !== undefined) {
            this.bossRespawnPoint = { x: respawnObj.x, y: respawnObj.y };
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
                cBody.checkCollision.down = false;
                cBody.checkCollision.left = false;
                cBody.checkCollision.right = false;
                cBody.checkCollision.up = true;
                cBody.setSize(64, 24);
                cBody.setOffset(0, 4);
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
                    cBody.setVelocityY(speed * direction);
                } else {
                    cloud.setData('minX', direction === -1 ? posX - distance : posX);
                    cloud.setData('maxX', direction === -1 ? posX : posX + distance);
                    cBody.setVelocityX(speed * direction);
                }
            }

            this.tempClouds.push(cloud);
        });

        // Find GravityOrbs
        const orbObjs = rawMapObjects.filter(o => o.name === 'GravityOrb');
        orbObjs.forEach(o => {
            const orb = this.scene.physics.add.sprite(o.x, o.y, 'particle').setTint(0x8B5CF6).setScale(2);
            (orb.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            this.gravityOrbs.push(orb);

            // Overlap to collect
            this.scene.physics.add.overlap(this.player, orb, () => {
                orb.destroy();
                this.collectedOrbs++;
                this.uiManager.showFloatingText(orb.x, orb.y - 10, 'ORB COLLECTED', '#8B5CF6');
                if (this.collectedOrbs >= 10 && this.phase === 1) {
                    this.transitionToPhase2();
                }
            });
        });

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
                const texKey = tileset?.name || '32 files dungeon';

                // Render solid block sprite (origin bottom-left in Tiled)
                const sprite = this.dotBlocks.create(o.x, o.y, texKey, localFrame) as Phaser.Physics.Arcade.Sprite;
                sprite.setOrigin(0, 1);
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

    private startPhase1() {
        this.phase = 1;
        this.isInvulnerable = true;
        this.bossState = 'idle';
        this.setFrame(0);
        this.setPosition(this.initialSpawn.x, this.initialSpawn.y);
    }

    private queueNextThunderSequence() {
        if (this.phase !== 1 && this.phase !== 2) return;
        if (this.isDead || !this.hasStarted) return;

        this.bossState = 'idle';
        this.scene.time.delayedCall(3000, () => {
            this.playThunderTelegraph();
        });
    }

    private playThunderTelegraph() {
        if (this.isDead) return;
        this.bossState = 'memory-telegraph';
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        
        // Generate random sequence from 1..5 (random length 3 to 5, all combinations possible)
        const length = Phaser.Math.Between(3, 5);
        const shuffled = Phaser.Utils.Array.Shuffle([1, 2, 3, 4, 5]);
        this.currentSequence = shuffled.slice(0, length);

        // Step through each drum in the sequence displaying its specific frame for 1 second
        let step = 0;
        const playNextDrum = () => {
            if (this.isDead || this.bossState !== 'memory-telegraph') return;

            if (step < this.currentSequence.length) {
                const drumNumber = this.currentSequence[step];
                // Frame 1 corresponds to Drum 1, Frame 5 to Drum 5
                this.setFrame(drumNumber);
                step++;
                this.scene.time.delayedCall(1000, playNextDrum);
            } else {
                // Return to idle frame 0 before vanishing
                this.setFrame(0);
                this.scene.time.delayedCall(300, () => {
                    this.vanishAndStrike();
                });
            }
        };

        playNextDrum();
    }

    private vanishAndStrike() {
        if (this.isDead) return;
        this.bossState = 'vanished';
        this.setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).setEnable(false);

        // Disappear for 3-4 seconds, then strike
        this.scene.time.delayedCall(Phaser.Math.Between(3000, 4000), () => {
            this.executeThunderStrikes();
        });
    }

    private executeThunderStrikes() {
        if (this.isDead) return;
        this.bossState = 'striking';

        // Strike the tiles in sequence
        let delay = 0;
        this.currentSequence.forEach(dotNumber => {
            this.scene.time.delayedCall(delay, () => {
                const tiles = this.thunderTiles.get(dotNumber) || [];
                tiles.forEach(tile => {
                    const tileX = tile.pixelX !== undefined ? tile.pixelX : (tile as any).x;
                    const tileY = tile.pixelY !== undefined ? tile.pixelY : (tile as any).y;
                    const tileW = tile.width || 32;
                    const tileH = tile.height || 32;

                    // Play cloud & lightning animation striking down on the tile
                    const cloudEffect = this.scene.add.sprite(tileX + tileW / 2, tileY, 'cloud-attack-1');
                    cloudEffect.setOrigin(0.5, 1);
                    cloudEffect.setDepth(12);
                    cloudEffect.play('lightning-strike');

                    // Physics body on the lightning sprite to detect contact anywhere in the air/beam
                    this.scene.physics.add.existing(cloudEffect);
                    const cBody = cloudEffect.body as Phaser.Physics.Arcade.Body;
                    if (cBody) {
                        cBody.setAllowGravity(false);
                        cBody.setSize(cloudEffect.width * 0.75, cloudEffect.height);
                    }

                    const strikeCollider = this.scene.physics.add.overlap(this.player, cloudEffect, () => {
                        this.player.die('electric');
                    });

                    // Also check ground tile bounds immediately
                    const pBounds = this.player.getBounds();
                    const tBounds = new Phaser.Geom.Rectangle(tileX, tileY - 4, tileW, tileH + 8);
                    if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, tBounds)) {
                        this.player.die('electric');
                    }

                    this.scene.time.delayedCall(600, () => {
                        if (strikeCollider) strikeCollider.destroy();
                        if (cloudEffect && cloudEffect.active) cloudEffect.destroy();
                    });
                });
            });
            delay += 400; // Stagger each strike so the player can see them clearly
        });

        // Return to normal
        this.scene.time.delayedCall(delay + 1000, () => {
            this.setVisible(true);
            this.setFrame(0);
            (this.body as Phaser.Physics.Arcade.Body).setEnable(true);
            
            if (this.phase === 1) {
                this.setPosition(this.initialSpawn.x, this.initialSpawn.y);
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
        if (this.arenaZone) {
            this.setPosition(this.x, this.arenaZone.bottom - 48);
        }
        (this.body as Phaser.Physics.Arcade.Body).setVelocityX(this.patrolSpeed * this.patrolDirection);
    }

    private fireOrbOfRage() {
        const orb = this.orbsOfRageGroup.create(this.x, this.y, 'fireball') as Phaser.Physics.Arcade.Sprite;
        orb.setScale(2);
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.player.x, this.player.y);
        const speed = 150; // Medium speed
        const orbBody = orb.body as Phaser.Physics.Arcade.Body;
        if (orbBody) {
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
            const orbOfVictory = this.scene.physics.add.sprite(this.x, this.y, 'particle').setTint(0xFFD700).setScale(4);
            (orbOfVictory.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            
            this.scene.physics.add.overlap(this.player, orbOfVictory, () => {
                orbOfVictory.destroy();
                this.spawnVictoryPortal();
            });
        });
    }

    private spawnVictoryPortal() {
        // Find VictoryPortalSpawn from environment manager or raw map objects
        // We will do a generic portal for now
        const portal = this.scene.physics.add.sprite(this.x, this.y - 50, 'fireball').setTint(0xFFFFFF).setScale(3);
        (portal.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        
        this.scene.physics.add.overlap(this.player, portal, () => {
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

        // Activation & Respawn Point trigger
        if (this.arenaZone) {
            const pBounds = this.player.getBounds();
            if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, this.arenaZone)) {
                if (this.bossRespawnPoint) {
                    this.player.activeSpawnX = this.bossRespawnPoint.x;
                    this.player.activeSpawnY = this.bossRespawnPoint.y;
                }
                if (!this.hasStarted) {
                    this.hasStarted = true;
                    this.queueNextThunderSequence();
                }
            }
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

        // Hover logic for Phase 1
        if (this.phase === 1 && this.bossState === 'idle' && this.bossLimitZone) {
            if (!this.flyTarget || Phaser.Math.Distance.Between(this.x, this.y, this.flyTarget.x, this.flyTarget.y) < 10) {
                this.flyTarget = {
                    x: Phaser.Math.Between(this.bossLimitZone.left + 32, this.bossLimitZone.right - 32),
                    y: Phaser.Math.Between(this.bossLimitZone.top + 32, this.bossLimitZone.bottom - 32)
                };
            }
            this.scene.physics.moveTo(this, this.flyTarget.x, this.flyTarget.y, 60); // fly around slowly
        } else if (this.phase === 1 && this.bossState !== 'idle') {
            (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        }

        // Patrol logic for Phase 2
        if (this.phase === 2 && this.bossState === 'patrolling' && this.arenaZone) {
            const body = this.body as Phaser.Physics.Arcade.Body;
            if (this.x <= this.arenaZone.left + 32) {
                this.patrolDirection = 1;
                body.setVelocityX(this.patrolSpeed);
            } else if (this.x >= this.arenaZone.right - 32) {
                this.patrolDirection = -1;
                body.setVelocityX(-this.patrolSpeed);
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
