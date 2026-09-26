// src/managers/EnemyManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';
import { CollectiblesManager } from './CollectiblesManager';
import { SoundManager } from './SoundManager';
import { EnvironmentManager } from './EnvironmentManager';

export class EnemyManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;
    private collectiblesManager?: CollectiblesManager;
    private soundManager?: SoundManager;
    private envManager?: EnvironmentManager;

    public groundMobs!: Phaser.Physics.Arcade.Group;
    public flyingMobs!: Phaser.Physics.Arcade.Group;
    public pipeMonsters!: Phaser.Physics.Arcade.Group;
    public enemyBullets!: Phaser.Physics.Arcade.Group;
    public ignoreLOSZones: Phaser.Geom.Rectangle[] = [];

    public enemiesKilled: number = 0;
    private killedEnemyKeys: Set<string> = new Set();

    // Checkpoint Snapshots
    private savedCheckpointKilledKeys: Set<string> = new Set();
    private savedCheckpointKills: number = 0;

    private rawMapObjects: any[] = [];
    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private oneWayLayer!: Phaser.Tilemaps.TilemapLayer;
    private hazardsLayer?: Phaser.Tilemaps.TilemapLayer;
    private smashLayer?: Phaser.Tilemaps.TilemapLayer;
    private map!: Phaser.Tilemaps.Tilemap;
    private losLine = new Phaser.Geom.Line();

    constructor(
        scene: Phaser.Scene, 
        player: Player, 
        uiManager: UIManager, 
        collectiblesManager?: CollectiblesManager,
        soundManager?: SoundManager,
        envManager?: EnvironmentManager
    ) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
        this.collectiblesManager = collectiblesManager;
        this.soundManager = soundManager;
        this.envManager = envManager;

        this.groundMobs = this.scene.physics.add.group();
        this.flyingMobs = this.scene.physics.add.group({ allowGravity: false });
        this.pipeMonsters = this.scene.physics.add.group({ allowGravity: false, immovable: true });
        this.enemyBullets = this.scene.physics.add.group({ allowGravity: false });
    }

    public setEnvironmentManager(envManager: EnvironmentManager) {
        this.envManager = envManager;
    }

    public saveCheckpointSnapshot() {
        this.savedCheckpointKilledKeys = new Set(this.killedEnemyKeys);
        this.savedCheckpointKills = this.enemiesKilled;
    }

    public rollbackToCheckpoint() {
        this.killedEnemyKeys = new Set(this.savedCheckpointKilledKeys);
        this.enemiesKilled = this.savedCheckpointKills;
        this.clearBullets();
        if (this.rawMapObjects.length > 0 && this.groundLayer && this.oneWayLayer) {
            this.spawnGroundMobs();
            this.spawnFlyingMobs();
            if (this.map) {
                this.spawnPipeMonsters();
            }
        }
    }

    setupGroundMobs(
        rawMapObjects: any[], 
        groundLayer: Phaser.Tilemaps.TilemapLayer, 
        oneWayLayer: Phaser.Tilemaps.TilemapLayer, 
        hazardsLayer?: Phaser.Tilemaps.TilemapLayer,
        smashLayer?: Phaser.Tilemaps.TilemapLayer
    ) {
        this.rawMapObjects = rawMapObjects;
        this.groundLayer = groundLayer;
        this.oneWayLayer = oneWayLayer;
        this.hazardsLayer = hazardsLayer;
        this.smashLayer = smashLayer;

        // Parse Ignore Line-of-Sight Zones
        this.ignoreLOSZones = [];
        this.rawMapObjects.filter((o: any) => 
            o.name === 'IgnoreLOSZone' || 
            o.name === 'ShootThroughWallsZone' || 
            o.name === 'NoLOSZone' ||
            o.name === 'WallHackZone'
        ).forEach((obj: any) => {
            this.ignoreLOSZones.push(new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width || 32, obj.height || 32));
        });

        // Mobs vs Ground Layer collision
        this.scene.physics.add.collider(this.groundMobs, this.groundLayer);

        // Mobs vs Smash Ground collision
        if (this.smashLayer) {
            this.scene.physics.add.collider(this.groundMobs, this.smashLayer);
        }

        // Mobs vs One-Way Platforms collision
        this.scene.physics.add.collider(this.groundMobs, this.oneWayLayer, undefined, (mobObj, tile) => {
            const t = tile as Phaser.Tilemaps.Tile;
            if (t.index === -1) return false;
            const mBody = (mobObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
            return mBody.velocity.y > 0 && mBody.bottom <= t.pixelY + 10;
        });

        // Player vs Ground Mobs overlap (instant stomp detection & fatal side hits)
        this.scene.physics.add.overlap(this.player, this.groundMobs, this.handlePlayerMobCollision);

        // Player vs Flying Mobs overlap (instant stomp detection & fatal side hits)
        this.scene.physics.add.overlap(this.player, this.flyingMobs, this.handlePlayerFlyingMobCollision);

        // Player Bullets vs Ground Mobs & Flying Mobs overlap (kill mob with blaster)
        this.scene.physics.add.overlap(this.player.bullets, this.groundMobs, (bulletObj, mobObj) => {
            bulletObj.destroy();
            this.killMob(mobObj as Phaser.Physics.Arcade.Sprite, 'shoot');
        });
        this.scene.physics.add.overlap(this.player.bullets, this.flyingMobs, (bulletObj, mobObj) => {
            bulletObj.destroy();
            this.killMob(mobObj as Phaser.Physics.Arcade.Sprite, 'shoot');
        });

        // Player vs Enemy Bullets (Hazard)
        this.scene.physics.add.overlap(this.player, this.enemyBullets, (_playerObj, bulletObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            this.uiManager.spawnParticles(bullet.x, bullet.y, 0xEF4444);
            bullet.destroy();
            this.player.die();
        });

        // Player Bullets vs Enemy Bullets (Bullet Clash)
        this.scene.physics.add.overlap(this.player.bullets, this.enemyBullets, (pBulletObj, eBulletObj) => {
            const eBullet = eBulletObj as Phaser.Physics.Arcade.Sprite;
            this.uiManager.spawnParticles(eBullet.x, eBullet.y, 0xF59E0B);
            pBulletObj.destroy();
            eBullet.destroy();
            this.soundManager?.playStomp();
        });

        // Enemy Bullets vs Ground Layer (Process callback returns false to phase straight through walls inside IgnoreLOSZone)
        this.scene.physics.add.collider(
            this.enemyBullets, 
            this.groundLayer, 
            (bulletObj) => {
                const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                this.uiManager.spawnParticles(bullet.x, bullet.y, 0x94A3B8);
                bullet.destroy();
            },
            (bulletObj, tile) => {
                const t = tile as Phaser.Tilemaps.Tile;
                if (t.index === -1) return false;

                const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                const boundZone = bullet.getData('boundZone') as Phaser.Geom.Rectangle | undefined;
                const isInsideBoundZone = boundZone && Phaser.Geom.Rectangle.Contains(boundZone, bullet.x, bullet.y);
                const ignoreWalls = (bullet.getData('ignoreWalls') as boolean) || false;

                if (isInsideBoundZone || ignoreWalls) {
                    return false;
                }
                return true;
            }
        );

        if (this.smashLayer) {
            this.scene.physics.add.collider(
                this.enemyBullets, 
                this.smashLayer, 
                (bulletObj) => {
                    const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                    this.uiManager.spawnParticles(bullet.x, bullet.y, 0x94A3B8);
                    bullet.destroy();
                },
                (bulletObj, tile) => {
                    const t = tile as Phaser.Tilemaps.Tile;
                    if (t.index === -1) return false;

                    const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                    const boundZone = bullet.getData('boundZone') as Phaser.Geom.Rectangle | undefined;
                    const isInsideBoundZone = boundZone && Phaser.Geom.Rectangle.Contains(boundZone, bullet.x, bullet.y);
                    const ignoreWalls = (bullet.getData('ignoreWalls') as boolean) || false;

                    if (isInsideBoundZone || ignoreWalls) {
                        return false;
                    }
                    return true;
                }
            );
        }

        this.spawnGroundMobs();
        this.spawnFlyingMobs();
        this.saveCheckpointSnapshot();
    }

    private getProp(obj: any, keys: string[]): any {
        if (!obj) return undefined;
        const lookup = keys.map(k => k.toLowerCase());

        // 1. Check in obj.properties Array first (Custom Properties from Tiled)
        if (Array.isArray(obj.properties)) {
            const found = obj.properties.find((p: any) => p && p.name && lookup.includes(p.name.toLowerCase()));
            if (found && found.value !== undefined && found.value !== null && String(found.value).trim() !== '') {
                return found.value;
            }
        }

        // 2. Check in obj.properties Object (if key-value map)
        if (obj.properties && typeof obj.properties === 'object' && !Array.isArray(obj.properties)) {
            for (const k of Object.keys(obj.properties)) {
                if (lookup.includes(k.toLowerCase()) && obj.properties[k] !== undefined && obj.properties[k] !== null && String(obj.properties[k]).trim() !== '') {
                    return obj.properties[k];
                }
            }
        }

        // 3. Check direct property on obj (e.g. obj.type, obj.name, obj.class)
        for (const k of Object.keys(obj)) {
            if (lookup.includes(k.toLowerCase()) && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
                return obj[k];
            }
        }

        return undefined;
    }

    private normalizeMobType(rawType: string): string {
        const s = rawType.toLowerCase().trim().replace(/[\s_-]+/g, '-');
        if (s.includes('sandal')) return 'sandal';
        if (s.includes('lantern') || s.includes('spirit')) return 'lantern-spirit';
        if (s.includes('shapeshift') || s.includes('fox')) return 'shapeshifter-fox';
        if (s.includes('bat') || s.includes('pumpkin')) return 'pumpkin-bat';
        if (s.includes('bonsai') || s.includes('gripper')) return 'bonsai-gripper';
        if (s.includes('kappa') || s.includes('lava')) return 'lava-kappa';
        if (s.includes('shiro') || s.includes('onna') || s.includes('ghost') || s.includes('teleport')) return 'shiro-onna';
        return s;
    }

    private getMobTextureAndFrame(mobType: string, dir: number): { key: string; frame: number } {
        if (mobType === 'shiro-onna' || mobType === 'ghost') {
            return { key: 'mob-shiro-onna', frame: 0 };
        }
        if (mobType === 'lava-kappa' || mobType === 'kappa') {
            return { key: 'mob-lava-kappa', frame: dir === 1 ? 4 : 0 };
        }
        if (mobType === 'pumpkin-bat' || mobType === 'bat') {
            return { key: 'mob-pumpkin-bat', frame: dir === 1 ? 3 : 0 };
        }
        if (mobType === 'bonsai-gripper' || mobType === 'gripper') {
            return { key: 'mob-bonsai-gripper', frame: 0 };
        }
        if (mobType === 'lantern-spirit' || mobType === 'lantern' || mobType === 'spirit') {
            return { key: dir === 1 ? 'mob-lantern-spirit-r' : 'mob-lantern-spirit-l', frame: 0 };
        }
        if (mobType === 'shapeshifter-fox' || mobType === 'shapeshifter' || mobType === 'fox') {
            return { key: dir === 1 ? 'mob-shapeshifter-fox-r' : 'mob-shapeshifter-fox-l', frame: 0 };
        }
        if (mobType === 'sandal' || mobType === 'sandal-mob') {
            return { key: dir === 1 ? 'mob-sandal-r' : 'mob-sandal-l', frame: 0 };
        }
        return { key: dir === 1 ? `mob-${mobType}-r` : `mob-${mobType}-l`, frame: 0 };
    }

    private getMobAnimKey(mobType: string, dir: number): string {
        return dir === 1 ? `mob-${mobType}-walk-r` : `mob-${mobType}-walk-l`;
    }

    private spawnGroundMobs() {
        this.groundMobs.clear(true, true);

        const mobObjects = this.rawMapObjects.filter((o: any) => {
            const nameLower = (o.name || '').toLowerCase();
            const typeLower = (o.type || '').toLowerCase();
            const customType = String(this.getProp(o, ['type', 'mobtype', 'mob_type', 'monster', 'mob']) || '').toLowerCase();

            // Exclude zones, triggers, collectibles, platforms, environment hazards, etc.
            const isNonMob = (
                nameLower.includes('zone') || 
                nameLower.includes('trigger') || 
                nameLower.includes('fake') || 
                nameLower.includes('platform') || 
                nameLower.includes('checkpoint') || 
                nameLower.includes('door') || 
                nameLower.includes('pad') || 
                nameLower.includes('coin') || 
                nameLower.includes('powerup') || 
                nameLower.includes('totem') || 
                nameLower.includes('firebar') ||
                nameLower.includes('water') ||
                nameLower.includes('spawn') ||
                nameLower.includes('pipe')
            );
            if (isNonMob) return false;

            const isGroundName = (
                nameLower.includes('groundmob') || 
                nameLower.includes('ground_mob') || 
                nameLower === 'ground' ||
                nameLower === 'mob' || 
                nameLower === 'enemy' || 
                nameLower.includes('shooter') ||
                nameLower.includes('shooting') ||
                nameLower.includes('shiro') ||
                nameLower.includes('ghost') ||
                nameLower.includes('teleport') ||
                nameLower.includes('sandal') ||
                nameLower.includes('lantern') ||
                nameLower.includes('spirit') ||
                nameLower.includes('shapeshift') ||
                nameLower.includes('fox') ||
                nameLower.includes('kappa') ||
                nameLower.includes('gripper') ||
                nameLower.includes('bonsai') ||
                typeLower.includes('ghost') ||
                typeLower.includes('shiro') ||
                typeLower.includes('sandal') ||
                typeLower.includes('lantern') ||
                typeLower.includes('spirit') ||
                typeLower.includes('shapeshift') ||
                typeLower.includes('fox') ||
                typeLower.includes('kappa') ||
                typeLower.includes('gripper') ||
                typeLower.includes('shooter') ||
                customType.includes('ghost') ||
                customType.includes('shiro') ||
                customType.includes('sandal') ||
                customType.includes('lantern') ||
                customType.includes('spirit') ||
                customType.includes('shapeshift') ||
                customType.includes('fox') ||
                customType.includes('kappa') ||
                customType.includes('gripper') ||
                customType.includes('shooter')
            );
            if (!isGroundName) return false;
            
            const isFlying = Boolean(this.getProp(o, ['flying', 'isflying', 'air']));
            if (isFlying) return false;
            
            return true;
        });

        mobObjects.forEach((obj: any) => {
            const uniqueKey = `${obj.name}_${Math.round(obj.x)}_${Math.round(obj.y)}`;

            // Skip mobs that were killed BEFORE the active checkpoint
            if (this.killedEnemyKeys.has(uniqueKey)) {
                return;
            }

            let mobType = 'sandal';
            const customType = this.getProp(obj, ['type', 'mobtype', 'mob_type', 'monster', 'mob']);
            if (customType && String(customType).trim() !== '') {
                mobType = String(customType).trim();
            } else if (obj.type && typeof obj.type === 'string' && obj.type.trim() !== '') {
                mobType = obj.type.trim();
            } else if (obj.name && typeof obj.name === 'string' && obj.name.trim() !== '') {
                const n = obj.name.trim();
                if (n === 'ShooterMob' || n === 'ShootingMob') mobType = 'lava-kappa';
                else if (n === 'ShiroOnna' || n === 'GhostMob' || n === 'TeleportMob') mobType = 'shiro-onna';
                else if (n.toLowerCase().includes('sandal')) mobType = 'sandal';
                else if (n.toLowerCase().includes('lantern') || n.toLowerCase().includes('spirit')) mobType = 'lantern-spirit';
                else if (n.toLowerCase().includes('shapeshift') || n.toLowerCase().includes('fox')) mobType = 'shapeshifter-fox';
                else if (n !== 'GroundMob' && n !== 'Mob' && n !== 'Enemy') mobType = n;
            }

            let mobSpeed = 60;
            let isStationary = false;
            let canShoot = obj.name === 'ShooterMob' || obj.name === 'ShootingMob';
            let ignoreLOS = false;
            let shootInterval = 2200;
            let initialDelay = 300;
            let bulletSpeed = 220;
            let maxBulletSpeed = 220;
            let range = 380;
            let teleportInterval = 1100;
            let teleportRange = 480;
            let verticalTeleport = true;
            let verticalRange = 96; // default 3 tiles (96px)
            let verticalMode = 'any'; // 'any' | 'same' | 'up' | 'down'
            let allowOneWay = true;

            const speedProp = this.getProp(obj, ['speed']);
            if (speedProp !== undefined) {
                mobSpeed = Number(speedProp);
                if (mobSpeed === 0) isStationary = true;
            }

            const stationaryProp = this.getProp(obj, ['stationary', 'standstill', 'static', 'staystill']);
            if (stationaryProp !== undefined) {
                isStationary = Boolean(stationaryProp);
                if (isStationary) mobSpeed = 0;
            }

            const shootProp = this.getProp(obj, ['canshoot', 'shoots']);
            if (shootProp !== undefined) {
                canShoot = Boolean(shootProp);
            }

            const losProp = this.getProp(obj, ['ignorelos', 'ignorewalls', 'wallhack']);
            if (losProp !== undefined) {
                ignoreLOS = Boolean(losProp);
            }

            const intervalProp = this.getProp(obj, ['shootinterval', 'interval', 'cooldown', 'rate']);
            if (intervalProp !== undefined) {
                shootInterval = Number(intervalProp);
            }

            const delayProp = this.getProp(obj, ['initialdelay', 'activationtime', 'delay', 'firstshotdelay', 'warmup']);
            if (delayProp !== undefined) {
                initialDelay = Number(delayProp);
            }

            const bulletSpeedProp = this.getProp(obj, ['bulletspeed', 'minspeed']);
            if (bulletSpeedProp !== undefined) {
                bulletSpeed = Number(bulletSpeedProp);
                maxBulletSpeed = bulletSpeed;
            }

            const maxBulletSpeedProp = this.getProp(obj, ['maxbulletspeed', 'maxspeed', 'fastspeed']);
            if (maxBulletSpeedProp !== undefined) {
                maxBulletSpeed = Number(maxBulletSpeedProp);
            }

            const rangeProp = this.getProp(obj, ['range']);
            if (rangeProp !== undefined) {
                range = Number(rangeProp);
            }

            const tpIntervalProp = this.getProp(obj, ['teleportinterval', 'tpinterval']);
            if (tpIntervalProp !== undefined) {
                teleportInterval = Number(tpIntervalProp);
            }

            const tpRangeProp = this.getProp(obj, ['teleportrange', 'tprange']);
            if (tpRangeProp !== undefined) {
                teleportRange = Number(tpRangeProp);
            }

            const vTpProp = this.getProp(obj, ['verticalteleport', 'vertical', 'canvertical', 'canteleportvertically', 'isvertical']);
            if (vTpProp !== undefined) {
                verticalTeleport = Boolean(vTpProp);
            }

            const vRangeProp = this.getProp(obj, ['verticalrange', 'verticaldistance', 'maxvertical', 'vrange', 'vertical_range']);
            if (vRangeProp !== undefined && vRangeProp !== null && vRangeProp !== '') {
                const rawVal = Number(vRangeProp);
                if (!isNaN(rawVal)) {
                    verticalRange = rawVal <= 50 ? rawVal * 32 : rawVal;
                    if (rawVal === 0) verticalTeleport = false;
                }
            }

            const vModeProp = this.getProp(obj, ['verticalmode', 'verticaldirection', 'vmode']);
            if (vModeProp !== undefined) {
                verticalMode = String(vModeProp).toLowerCase().trim();
                if (verticalMode === 'same' || verticalMode === 'none' || verticalMode === 'horizontal') {
                    verticalTeleport = false;
                }
            }

            let horizontalRange: number | undefined = undefined;
            const hRangeProp = this.getProp(obj, ['horizontalrange', 'horizontal_range', 'hrange', 'maxhorizontal', 'maxh', 'horizontal']);
            if (hRangeProp !== undefined && hRangeProp !== null && hRangeProp !== '') {
                const rawH = Number(hRangeProp);
                if (!isNaN(rawH)) {
                    horizontalRange = rawH <= 50 ? rawH * 32 : rawH;
                }
            }

            const parseRangeVal = (val: any): number | undefined => {
                if (val === undefined || val === null || val === '') return undefined;
                const num = Number(val);
                if (isNaN(num)) return undefined;
                return Math.abs(num) <= 50 ? Math.abs(num) * 32 : Math.abs(num);
            };

            let rangeLeft = parseRangeVal(this.getProp(obj, ['rangeleft', 'range_left', 'leftrange', 'left_range', 'minx', '-x', 'negativex', 'negx']));
            let rangeRight = parseRangeVal(this.getProp(obj, ['rangeright', 'range_right', 'rightrange', 'right_range', 'maxx', '+x', 'positivex', 'posx']));
            let rangeUp = parseRangeVal(this.getProp(obj, ['rangeup', 'range_up', 'uprange', 'up_range', 'miny', '-y', 'maxup', 'negativey', 'negy', 'up']));
            let rangeDown = parseRangeVal(this.getProp(obj, ['rangedown', 'range_down', 'downrange', 'down_range', 'maxy', '+y', 'maxdown', 'positivey', 'posy', 'down']));

            if (horizontalRange !== undefined) {
                if (rangeLeft === undefined) rangeLeft = horizontalRange;
                if (rangeRight === undefined) rangeRight = horizontalRange;
            }
            if (verticalRange !== undefined) {
                if (rangeUp === undefined) rangeUp = (verticalMode === 'down' ? 0 : verticalRange);
                if (rangeDown === undefined) rangeDown = (verticalMode === 'up' ? 0 : verticalRange);
            }

            const owProp = this.getProp(obj, ['allowoneway', 'oneway']);
            if (owProp !== undefined) {
                allowOneWay = Boolean(owProp);
            }

            let spawnX = 0, spawnY = 0;
            if (obj.width && obj.height) {
                spawnX = obj.x + ((obj.width || 0) / 2);
                spawnY = obj.y + (obj.height || 0);
            } else {
                spawnX = obj.x;
                spawnY = obj.y;
            }

            let initialDir = 1;
            const dirProp = this.getProp(obj, ['direction', 'dir']);
            if (dirProp !== undefined) {
                const val = String(dirProp).toLowerCase().trim();
                if (val === 'left' || val === '-1') initialDir = -1;
                else if (val === 'right' || val === '1') initialDir = 1;
            }

            let mobScale = 1.0;
            const scaleProp = this.getProp(obj, ['scale', 'mobscale', 'size']);
            if (scaleProp !== undefined && scaleProp !== null && scaleProp !== '') {
                const s = Number(scaleProp);
                if (!isNaN(s) && s > 0) mobScale = s;
            }

            const normalizedType = this.normalizeMobType(mobType);
            const texInfo = this.getMobTextureAndFrame(normalizedType, initialDir);
            const initialAnim = this.getMobAnimKey(normalizedType, initialDir);

            const mob = this.groundMobs.create(spawnX, spawnY, texInfo.key, texInfo.frame) as Phaser.Physics.Arcade.Sprite;
            mob.setDepth(4).setOrigin(0.5, 1); 
            if (mobScale !== 1.0) {
                mob.setScale(mobScale);
            }
            
            const body = mob.body as Phaser.Physics.Arcade.Body;
            const texW = 32;
            const texH = 32;
            const baseW = 22;
            const baseH = normalizedType === 'sandal' ? 22 : 24;
            const baseOffX = (texW - baseW) / 2;
            const baseOffY = normalizedType === 'sandal' ? 9 : (texH - baseH);
            body.setSize(baseW, baseH);
            body.setOffset(baseOffX, baseOffY);
            body.setCollideWorldBounds(true);
            
            if (!isStationary && this.scene.anims.exists(initialAnim)) {
                mob.play(initialAnim);
            }
            
            mob.setData('uniqueKey', uniqueKey);
            mob.setData('spawnX', spawnX);
            mob.setData('spawnY', spawnY);
            mob.setData('scale', mobScale);
            if (horizontalRange !== undefined) {
                mob.setData('horizontalRange', horizontalRange);
            }
            mob.setData('rangeLeft', rangeLeft);
            mob.setData('rangeRight', rangeRight);
            mob.setData('rangeUp', rangeUp);
            mob.setData('rangeDown', rangeDown);
            mob.setData('direction', initialDir);
            mob.setData('speed', mobSpeed); 
            mob.setData('followSpeed', mobSpeed > 0 ? mobSpeed : 55);
            mob.setData('stationary', isStationary);
            mob.setData('type', normalizedType); 
            mob.setData('canShoot', canShoot);
            mob.setData('ignoreLOS', ignoreLOS);
            mob.setData('shootInterval', shootInterval);
            mob.setData('initialDelay', initialDelay);
            mob.setData('lastShootTime', this.scene.time.now - shootInterval + initialDelay);
            mob.setData('bulletSpeed', bulletSpeed);
            mob.setData('maxBulletSpeed', maxBulletSpeed);
            mob.setData('range', range);
            mob.setData('teleportInterval', teleportInterval);
            mob.setData('teleportRange', teleportRange);
            mob.setData('verticalTeleport', verticalTeleport);
            mob.setData('verticalRange', verticalRange);
            mob.setData('verticalMode', verticalMode);
            mob.setData('allowOneWay', allowOneWay);
            mob.setData('lastTeleportTime', this.scene.time.now - (normalizedType === 'shiro-onna' ? teleportInterval - 200 : 0));
            mob.setData('isTeleporting', false);

            if (normalizedType === 'shiro-onna') {
                mob.setAlpha(0.92);
            }

            if (canShoot) {
                mob.setTint(0xff9999);
            }
        });
    }

    private spawnFlyingMobs() {
        this.flyingMobs.clear(true, true);

        const flyingMobObjects = this.rawMapObjects.filter((o: any) => {
            const nameLower = (o.name || '').toLowerCase();
            const isFlyName = (
                nameLower === 'flyingmob' || 
                nameLower === 'flying_mob' || 
                nameLower === 'flymob' || 
                nameLower === 'airmob' || 
                nameLower === 'flyingenemy' || 
                nameLower === 'batmob'
            );
            if (isFlyName) return true;
            const flyProp = this.getProp(o, ['flying', 'isflying', 'air']);
            if (flyProp && Boolean(flyProp)) return true;
            return false;
        });

        flyingMobObjects.forEach((obj: any) => {
            const uniqueKey = `${obj.name}_${Math.round(obj.x)}_${Math.round(obj.y)}`;

            // Skip flying mobs that were killed BEFORE the active checkpoint
            if (this.killedEnemyKeys.has(uniqueKey)) {
                return;
            }

            let mobType = 'pumpkin-bat';
            if (obj.type && typeof obj.type === 'string' && obj.type.trim() !== '') {
                mobType = obj.type.trim();
            }

            const rawCustomType = this.getProp(obj, ['type', 'mobtype', 'mob_type', 'monster']);
            if (rawCustomType && String(rawCustomType).trim() !== '') {
                mobType = String(rawCustomType).trim();
            }

            let distanceInTiles = 4;
            let speed = 70;
            let axis: 'horizontal' | 'vertical' = 'horizontal';
            let initialDir = 1;
            let canShoot = false;
            let ignoreLOS = false;
            let shootInterval = 2200;
            let initialDelay = 300;
            let bulletSpeed = 220;
            let maxBulletSpeed = 220;
            let range = 380;

            const distProp = this.getProp(obj, ['distance', 'tiles', 'range_tiles', 'dist']);
            if (distProp !== undefined) {
                distanceInTiles = Number(distProp);
            }

            const speedProp = this.getProp(obj, ['speed']);
            if (speedProp !== undefined) {
                speed = Number(speedProp);
            }

            const axisProp = this.getProp(obj, ['axis', 'direction_axis']);
            if (axisProp !== undefined) {
                const aVal = String(axisProp).toLowerCase().trim();
                if (aVal === 'vertical' || aVal === 'y' || aVal === 'v') axis = 'vertical';
                else axis = 'horizontal';
            }

            const dirProp = this.getProp(obj, ['direction', 'dir', 'heading', 'flydirection']);
            if (dirProp !== undefined) {
                const val = String(dirProp).toLowerCase().trim();
                if (val === 'left' || val === 'l' || val === '-1') {
                    initialDir = -1;
                    axis = 'horizontal';
                } else if (val === 'right' || val === 'r' || val === '1') {
                    initialDir = 1;
                    axis = 'horizontal';
                } else if (val === 'up' || val === 'u' || val === 'top') {
                    initialDir = -1;
                    axis = 'vertical';
                } else if (val === 'down' || val === 'd' || val === 'bottom') {
                    initialDir = 1;
                    axis = 'vertical';
                }
            }

            const shootProp = this.getProp(obj, ['canshoot', 'shoots']);
            if (shootProp !== undefined) {
                canShoot = Boolean(shootProp);
            }

            const losProp = this.getProp(obj, ['ignorelos', 'ignorewalls', 'wallhack']);
            if (losProp !== undefined) {
                ignoreLOS = Boolean(losProp);
            }

            const intervalProp = this.getProp(obj, ['shootinterval', 'interval', 'cooldown', 'rate']);
            if (intervalProp !== undefined) {
                shootInterval = Number(intervalProp);
            }

            const delayProp = this.getProp(obj, ['initialdelay', 'delay', 'firstshotdelay', 'warmup']);
            if (delayProp !== undefined) {
                initialDelay = Number(delayProp);
            }

            const bulletSpeedProp = this.getProp(obj, ['bulletspeed', 'minspeed']);
            if (bulletSpeedProp !== undefined) {
                bulletSpeed = Number(bulletSpeedProp);
                maxBulletSpeed = bulletSpeed;
            }

            const maxBulletSpeedProp = this.getProp(obj, ['maxbulletspeed', 'maxspeed', 'fastspeed']);
            if (maxBulletSpeedProp !== undefined) {
                maxBulletSpeed = Number(maxBulletSpeedProp);
            }

            const rangeProp = this.getProp(obj, ['range']);
            if (rangeProp !== undefined) {
                range = Number(rangeProp);
            }

            let spawnX = 0, spawnY = 0;
            if (obj.width && obj.height) {
                spawnX = obj.x + ((obj.width || 0) / 2);
                spawnY = obj.y + (obj.height || 0);
            } else {
                spawnX = obj.x;
                spawnY = obj.y;
            }

            let mobScale = 1.0;
            const scaleProp = this.getProp(obj, ['scale', 'mobscale', 'size']);
            if (scaleProp !== undefined && scaleProp !== null && scaleProp !== '') {
                const s = Number(scaleProp);
                if (!isNaN(s) && s > 0) mobScale = s;
            }

            const normalizedType = this.normalizeMobType(mobType);
            const texInfo = this.getMobTextureAndFrame(normalizedType, initialDir);
            const initialAnim = this.getMobAnimKey(normalizedType, initialDir);

            const mob = this.flyingMobs.create(spawnX, spawnY, texInfo.key, texInfo.frame) as Phaser.Physics.Arcade.Sprite;
            mob.setDepth(4).setOrigin(0.5, 1);
            if (mobScale !== 1.0) {
                mob.setScale(mobScale);
            }

            const body = mob.body as Phaser.Physics.Arcade.Body;
            body.allowGravity = false;

            const baseW = 22;
            const baseH = 22;
            const baseOffX = 5;
            const baseOffY = normalizedType === 'sandal' ? 9 : 10;
            body.setSize(baseW, baseH);
            body.setOffset(baseOffX, baseOffY);

            // 1 distance unit = 1 tile = 32 pixels starting strictly from object placed coordinates
            const travelDistancePx = distanceInTiles * 32;
            let minX = spawnX, maxX = spawnX, minY = spawnY, maxY = spawnY;

            if (axis === 'horizontal') {
                if (initialDir === 1) {
                    minX = spawnX;
                    maxX = spawnX + travelDistancePx;
                } else {
                    minX = spawnX - travelDistancePx;
                    maxX = spawnX;
                }
                mob.setVelocityX(speed * initialDir);
            } else {
                if (initialDir === 1) {
                    minY = spawnY;
                    maxY = spawnY + travelDistancePx;
                } else {
                    minY = spawnY - travelDistancePx;
                    maxY = spawnY;
                }
                mob.setVelocityY(speed * initialDir);
            }

            if (this.scene.anims.exists(initialAnim)) {
                mob.play(initialAnim);
            }

            mob.setData('uniqueKey', uniqueKey);
            mob.setData('direction', initialDir);
            mob.setData('speed', speed);
            mob.setData('axis', axis);
            mob.setData('minX', minX);
            mob.setData('maxX', maxX);
            mob.setData('minY', minY);
            mob.setData('maxY', maxY);
            mob.setData('type', normalizedType);
            mob.setData('canShoot', canShoot);
            mob.setData('ignoreLOS', ignoreLOS);
            mob.setData('shootInterval', shootInterval);
            mob.setData('initialDelay', initialDelay);
            mob.setData('lastShootTime', this.scene.time.now - shootInterval + initialDelay);
            mob.setData('bulletSpeed', bulletSpeed);
            mob.setData('maxBulletSpeed', maxBulletSpeed);
            mob.setData('range', range);

            if (canShoot) {
                mob.setTint(0xff9999);
            }
        });
    }

    setupPipeMonsters(map: Phaser.Tilemaps.Tilemap, rawMapObjects: any[]) {
        this.map = map;
        this.rawMapObjects = rawMapObjects;

        // Player vs Pipe Monsters overlap
        this.scene.physics.add.overlap(this.player, this.pipeMonsters, (_p, monsterObj) => {
            const monster = monsterObj as Phaser.GameObjects.Sprite;
            const restingY = monster.getData('restingY') as number;
            if (monster.y <= restingY - 6) {
                const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                const isFalling = pBody.velocity.y > 0 || (pBody.prev && pBody.y > pBody.prev.y);
                const isAbove = pBody.bottom <= monster.y + 4;

                if (isFalling && isAbove) {
                    this.player.stompBounce(-380);
                    this.killPipeMonster(monster);
                } else {
                    this.player.die();
                }
            }
        });

        // Bullets vs Pipe Monsters overlap
        this.scene.physics.add.overlap(this.player.bullets, this.pipeMonsters, (bulletObj, monsterObj) => {
            const monster = monsterObj as Phaser.GameObjects.Sprite;
            const restingY = monster.getData('restingY') as number;
            if (monster.y <= restingY - 6) {
                bulletObj.destroy();
                this.killPipeMonster(monster);
            }
        });

        this.spawnPipeMonsters();
        this.saveCheckpointSnapshot();
    }

    private killPipeMonster(monster: Phaser.GameObjects.Sprite) {
        const uniqueKey = monster.getData('uniqueKey') as string;
        if (uniqueKey) {
            this.killedEnemyKeys.add(uniqueKey);
        }

        this.uiManager.showFloatingText(monster.x, monster.y - 10, '+1 COIN', '#FFD700');
        this.uiManager.spawnParticles(monster.x, monster.y, 0xFFD700);
        this.pipeMonsters.remove(monster, true, true);
        this.enemiesKilled++;
        this.collectiblesManager?.addCoins(1);
        this.soundManager?.playStomp();
        this.soundManager?.playCoin();
    }

    private spawnPipeMonsters() {
        this.pipeMonsters.clear(true, true);

        const monsterObjects = this.map.createFromObjects('Objects', { name: 'PipeMonster', key: 'mob-bonsai-gripper' });
        const rawObjects = this.rawMapObjects.filter((o: any) => o.name === 'PipeMonster');

        monsterObjects.forEach((obj: any, index: number) => {
            const uniqueKey = `PipeMonster_${Math.round(obj.x)}_${Math.round(obj.y)}`;

            // Skip pipe monsters killed BEFORE the active checkpoint
            if (this.killedEnemyKeys.has(uniqueKey)) {
                obj.destroy();
                return;
            }

            let popDuration = 200;
            let scalePercent = 100;
            const rawObj = rawObjects[index];
            if (rawObj && rawObj.properties) {
                const speedProp = rawObj.properties.find((p: any) => p.name && (
                    p.name.toLowerCase() === 'speed' || 
                    p.name.toLowerCase() === 'duration' || 
                    p.name.toLowerCase() === 'popspeed'
                ));
                if (speedProp && speedProp.value !== undefined) {
                    popDuration = Number(speedProp.value);
                }

                const scaleProp = rawObj.properties.find((p: any) => p.name && (
                    p.name.toLowerCase() === 'scale' || 
                    p.name.toLowerCase() === 'scalepercent' ||
                    p.name.toLowerCase() === 'size'
                ));
                if (scaleProp && scaleProp.value !== undefined) {
                    const rawScale = Number(scaleProp.value);
                    if (!isNaN(rawScale) && rawScale > 0) {
                        scalePercent = rawScale;
                    }
                }
            }

            // Convert scale percent (e.g. 100 -> 1.0, 80 -> 0.8, 150 -> 1.5)
            const scaleFactor = scalePercent > 2 ? scalePercent / 100 : (scalePercent <= 0 ? 1 : scalePercent);
            obj.setScale(scaleFactor);

            this.scene.physics.add.existing(obj);
            const monsterBody = obj.body as Phaser.Physics.Arcade.Body;
            monsterBody.allowGravity = false; 
            monsterBody.immovable = true; 
            monsterBody.setSize(24 * scaleFactor, 20 * scaleFactor);
            monsterBody.setOffset(4 * scaleFactor, 3 * scaleFactor);
            
            obj.setDepth(2.9);
            obj.setTexture('mob-bonsai-gripper', 0);
            if (this.scene.anims.exists('mob-bonsai-gripper-walk-l')) {
                obj.play('mob-bonsai-gripper-walk-l');
            }

            // Calculate the exact surface level of the topmost block of the pipe
            let pipeSurfaceY = obj.y - 16;
            if (this.groundLayer) {
                const tileX = this.groundLayer.worldToTileX(obj.x);
                const startTileY = this.groundLayer.worldToTileY(obj.y);
                let topTileY = startTileY;

                // Scan upwards from monster position to find the topmost solid pipe/ground tile
                for (let ty = startTileY; ty >= startTileY - 6; ty--) {
                    const tile = this.groundLayer.getTileAt(tileX, ty);
                    if (tile && tile.index !== -1) {
                        topTileY = ty;
                    } else if (ty < startTileY) {
                        break;
                    }
                }
                const surfaceTile = this.groundLayer.getTileAt(tileX, topTileY);
                if (surfaceTile) {
                    pipeSurfaceY = surfaceTile.pixelY;
                }
            }

            const halfH = (obj.displayHeight || (23 * scaleFactor)) / 2;
            // Resting position: fully submerged inside pipe
            const restingY = pipeSurfaceY + halfH + (8 * scaleFactor);
            // Popped position: bottom of monster stays inside the pipe rim so it never floats above
            const poppedY = pipeSurfaceY - halfH + (4 * scaleFactor);

            obj.setPosition(obj.x, restingY);
            obj.setData('uniqueKey', uniqueKey);
            obj.setData('restingY', restingY);
            obj.setData('poppedY', poppedY);
            obj.setData('pipeSurfaceY', pipeSurfaceY);
            obj.setData('popDuration', popDuration);
            obj.setData('scaleFactor', scaleFactor);

            this.pipeMonsters.add(obj);
            this.startMonsterCycle(obj);
        });
    }

    public clearBullets() {
        this.enemyBullets.clear(true, true);
    }

    public resetAll() {
        this.enemiesKilled = 0;
        this.savedCheckpointKills = 0;
        this.killedEnemyKeys.clear();
        this.savedCheckpointKilledKeys.clear();
        this.enemyBullets.clear(true, true);
        if (this.rawMapObjects.length > 0 && this.groundLayer && this.oneWayLayer) {
            this.spawnGroundMobs();
            this.spawnFlyingMobs();
            if (this.map) {
                this.spawnPipeMonsters();
            }
        }
    }

    private handlePlayerMobCollision = (_playerObj: any, _mobObj: any) => {
        const mob = _mobObj as Phaser.Physics.Arcade.Sprite;
        if (!mob.active || !this.player.active) return;

        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
        const mBody = mob.body as Phaser.Physics.Arcade.Body;

        const isFalling = pBody.velocity.y > 0 || (pBody.prev && pBody.y > pBody.prev.y);
        const isAbove = pBody.bottom <= mBody.top + 16 || pBody.center.y < mBody.top + 8;

        if (isFalling && isAbove) {
            this.player.stompBounce(-380); 
            this.killMob(mob, 'stomp');
        } else {
            this.player.die();
        }
    }

    private handlePlayerFlyingMobCollision = (_playerObj: any, _mobObj: any) => {
        const mob = _mobObj as Phaser.Physics.Arcade.Sprite;
        if (!mob.active || !this.player.active) return;

        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
        const mBody = mob.body as Phaser.Physics.Arcade.Body;

        const isFalling = pBody.velocity.y > 0 || (pBody.prev && pBody.y > pBody.prev.y);
        const isAbove = pBody.bottom <= mBody.top + 16 || pBody.center.y < mBody.top + 8;

        if (isFalling && isAbove) {
            this.player.stompBounce(-380); 
            this.killMob(mob, 'stomp');
        } else {
            this.player.die();
        }
    }

    private killMob(mob: Phaser.Physics.Arcade.Sprite, _method: 'stomp' | 'shoot') {
        const uniqueKey = mob.getData('uniqueKey') as string;
        if (uniqueKey) {
            this.killedEnemyKeys.add(uniqueKey);
        }

        const isFlying = this.flyingMobs.contains(mob);
        const mobType = mob.getData('type') as string;
        const isGhost = mobType === 'shiro-onna' || mobType === 'ghost';

        let coinReward = 1;
        if (isGhost) {
            coinReward = 3;
        } else if (isFlying) {
            coinReward = 2;
        }

        this.groundMobs.remove(mob);
        this.flyingMobs.remove(mob);
        const body = mob.body as Phaser.Physics.Arcade.Body;
        body.allowGravity = true;
        body.checkCollision.none = true;
        body.setCollideWorldBounds(false);
        mob.anims.stop(); 
        mob.setVelocity(Phaser.Math.Between(-80, 80), -280); 
        mob.setAngularVelocity(Phaser.Math.Between(400, 800) * (Math.random() > 0.5 ? 1 : -1)); 
        mob.setDepth(10);
        
        this.enemiesKilled++;
        this.collectiblesManager?.addCoins(coinReward);
        this.soundManager?.playStomp();
        this.soundManager?.playCoin();
        
        const text = `+${coinReward} COIN${coinReward > 1 ? 'S' : ''}`;
        const mobScale = (mob.getData('scale') as number) || 1.0;
        this.uiManager.showFloatingText(mob.x, mob.y - 10 * mobScale, text, '#FFD700');
        this.uiManager.spawnParticles(mob.x, mob.y - 12 * mobScale, 0xFFD700);

        this.scene.time.delayedCall(1500, () => {
            if (mob.active) mob.destroy();
        });
    }

    private startMonsterCycle(monster: Phaser.GameObjects.Sprite) {
        const hideTime = Phaser.Math.Between(800, 2400);
        const stayTime = Phaser.Math.Between(600, 1200);
        const popDuration = (monster.getData('popDuration') as number) || 200;
        const restingY = monster.getData('restingY') as number;
        const poppedY = monster.getData('poppedY') as number;
        const pipeSurfaceY = (monster.getData('pipeSurfaceY') as number) || (restingY - 16);

        const scaleFactor = (monster.getData('scaleFactor') as number) || 1;

        this.scene.time.delayedCall(hideTime, () => {
            if (!monster.active) return;

            const pBody = this.player.body as Phaser.Physics.Arcade.Body;
            const isPlayerAbovePipe = (
                Math.abs(this.player.x - monster.x) < 30 * scaleFactor &&
                pBody.bottom <= pipeSurfaceY + 6 &&
                pBody.bottom >= pipeSurfaceY - 64
            );

            if (isPlayerAbovePipe) {
                this.scene.time.delayedCall(250, () => {
                    if (monster.active) {
                        this.startMonsterCycle(monster);
                    }
                });
                return;
            }

            this.scene.tweens.add({ 
                targets: monster, 
                y: poppedY, 
                duration: popDuration, 
                ease: 'Sine.easeOut', 
                onComplete: () => {
                    if (!monster.active) return;

                    this.scene.time.delayedCall(stayTime, () => {
                        if (!monster.active) return;

                        this.scene.tweens.add({ 
                            targets: monster, 
                            y: restingY, 
                            duration: popDuration, 
                            ease: 'Sine.easeIn', 
                            onComplete: () => {
                                if (monster.active) {
                                    this.startMonsterCycle(monster);
                                }
                            }
                        });
                    });
                }
            });
        });
    }

    private isPlayerInsideOrBehindSmashGround(): boolean {
        if (this.envManager && this.envManager.bridges) {
            for (const bridge of this.envManager.bridges) {
                if (!bridge.broken && bridge.sprite && bridge.sprite.active) {
                    const bBounds = bridge.sprite.getBounds();
                    if (this.player && this.player.body) {
                        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                        const pRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
                        if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, bBounds)) return true;
                    }
                }
            }
        }
        if (!this.smashLayer || !this.player || !this.player.body) return false;
        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
        const centerTile = this.smashLayer.getTileAtWorldXY(pBody.center.x, pBody.center.y);
        if (centerTile && centerTile.index !== -1) return true;
        const topTile = this.smashLayer.getTileAtWorldXY(pBody.center.x, pBody.top + 2);
        if (topTile && topTile.index !== -1) return true;
        const bottomTile = this.smashLayer.getTileAtWorldXY(pBody.center.x, pBody.bottom - 2);
        if (bottomTile && bottomTile.index !== -1) return true;
        const leftTile = this.smashLayer.getTileAtWorldXY(pBody.left + 2, pBody.center.y);
        if (leftTile && leftTile.index !== -1) return true;
        const rightTile = this.smashLayer.getTileAtWorldXY(pBody.right - 2, pBody.center.y);
        if (rightTile && rightTile.index !== -1) return true;
        return false;
    }

    private hasLineOfSight(mobX: number, mobY: number, targetX: number, targetY: number): boolean {
        // If player is standing inside / within smash ground blocks, block all detection
        if (this.isPlayerInsideOrBehindSmashGround()) return false;

        this.losLine.setTo(mobX, mobY, targetX, targetY);

        if (this.envManager && this.envManager.bridges) {
            for (const bridge of this.envManager.bridges) {
                if (!bridge.broken && bridge.sprite && bridge.sprite.active) {
                    const bBounds = bridge.sprite.getBounds();
                    if (Phaser.Geom.Intersects.LineToRectangle(this.losLine, bBounds)) {
                        return false;
                    }
                }
            }
        }

        if (this.envManager && this.envManager.movingPlatforms) {
            for (const plat of this.envManager.movingPlatforms) {
                if (plat.active && plat.visible) {
                    const pBounds = plat.getBounds();
                    if (Phaser.Geom.Intersects.LineToRectangle(this.losLine, pBounds)) {
                        return false;
                    }
                }
            }
        }

        if (!this.groundLayer && !this.smashLayer) return true;
        
        if (this.groundLayer) {
            const tiles = this.groundLayer.getTilesWithinShape(this.losLine);
            for (const tile of tiles) {
                if (tile && tile.index !== -1) {
                    return false;
                }
            }
        }

        if (this.smashLayer) {
            const smashTiles = this.smashLayer.getTilesWithinShape(this.losLine);
            for (const tile of smashTiles) {
                if (tile && tile.index !== -1) {
                    return false;
                }
            }
        }

        // Raycast step check to guarantee zero line-of-sight leaking through tile seams
        const dist = Phaser.Math.Distance.Between(mobX, mobY, targetX, targetY);
        const steps = Math.max(2, Math.ceil(dist / 12));
        for (let i = 1; i < steps; i++) {
            const sampleX = mobX + ((targetX - mobX) * i) / steps;
            const sampleY = mobY + ((targetY - mobY) * i) / steps;
            if (this.groundLayer) {
                const gTile = this.groundLayer.getTileAtWorldXY(sampleX, sampleY);
                if (gTile && gTile.index !== -1) return false;
            }
            if (this.smashLayer) {
                const sTile = this.smashLayer.getTileAtWorldXY(sampleX, sampleY);
                if (sTile && sTile.index !== -1) return false;
            }
        }

        return true;
    }

    private fireEnemyProjectile(mob: Phaser.Physics.Arcade.Sprite, boundZone?: Phaser.Geom.Rectangle, ignoreWalls: boolean = false) {
        const mobScale = (mob.getData('scale') as number) || 1.0;
        const isFacingRight = (this.player.x >= mob.x);
        const aimDir = isFacingRight ? 1 : -1;
        const mobType = (mob.getData('type') as string) || '';
        const isStationary = mob.getData('stationary') as boolean;
        const speed = (mob.getData('speed') as number) || 0;
        mob.setData('direction', aimDir);
        if (mobType === 'lava-kappa' || mobType === 'kappa') {
            if (isStationary || speed === 0) {
                if (mob.anims.isPlaying) mob.anims.stop();
                mob.setTexture('mob-lava-kappa', aimDir === 1 ? 4 : 0);
            } else {
                const animKey = this.getMobAnimKey(mobType, aimDir);
                if (this.scene.anims.exists(animKey)) {
                    mob.play(animKey, true);
                } else {
                    mob.setTexture('mob-lava-kappa', aimDir === 1 ? 4 : 0);
                }
            }
        } else if (isStationary || speed === 0) {
            const texInfo = this.getMobTextureAndFrame(mobType, aimDir);
            if (mob.anims.isPlaying) mob.anims.stop();
            mob.setTexture(texInfo.key, texInfo.frame);
        } else {
            const animKey = this.getMobAnimKey(mobType, aimDir);
            if (this.scene.anims.exists(animKey)) {
                mob.play(animKey, true);
            }
        }
        if (mobType === 'shiro-onna') {
            mob.setFlipX(aimDir === -1);
        }

        // Spawn projectile at the shooter mob's mouth/beak (offset from center-feet origin)
        const mouthX = mob.x + (isFacingRight ? 9 : -9) * mobScale;
        const mouthY = mob.y - 24 * mobScale;

        const baseSpeed = (mob.getData('bulletSpeed') as number) || 220;
        const maxSpeed = (mob.getData('maxBulletSpeed') as number) || baseSpeed;
        const range = (mob.getData('range') as number) || 380;

        const distToPlayer = Phaser.Math.Distance.Between(mouthX, mouthY, this.player.x, this.player.y);
        const distanceRatio = Phaser.Math.Clamp(distToPlayer / range, 0, 1);
        const finalSpeed = Phaser.Math.Linear(baseSpeed, maxSpeed, distanceRatio);

        const angle = Phaser.Math.Angle.Between(mouthX, mouthY, this.player.x, this.player.y);
        const vx = Math.cos(angle) * finalSpeed;
        const vy = Math.sin(angle) * finalSpeed;

        const animKey = isFacingRight ? 'enemy-fireball-r' : 'enemy-fireball-l';
        const spriteRotation = isFacingRight ? angle : (angle >= 0 ? angle - Math.PI : angle + Math.PI);

        const bullet = this.enemyBullets.create(mouthX, mouthY, 'enemy-fireball') as Phaser.Physics.Arcade.Sprite;
        bullet.setDepth(5);
        bullet.setOrigin(0.5, 0.5);
        bullet.setRotation(spriteRotation);

        const body = bullet.body as Phaser.Physics.Arcade.Body;
        body.setSize(16, 16);
        body.setOffset(8, 8);
        body.allowGravity = false;

        if (boundZone) {
            bullet.setData('boundZone', boundZone);
        }
        bullet.setData('ignoreWalls', ignoreWalls);

        if (this.scene.anims.exists(animKey)) {
            bullet.play(animKey);
        }

        bullet.setVelocity(vx, vy);
        this.soundManager?.playEnemyShoot();
        this.uiManager.spawnParticles(mouthX, mouthY, 0xEF4444);

        this.scene.time.delayedCall(3000, () => {
            if (bullet.active) bullet.destroy();
        });
    }

    private tryTeleportShiroOnna(
        mob: Phaser.Physics.Arcade.Sprite, 
        currentTime: number, 
        groundLayer: Phaser.Tilemaps.TilemapLayer, 
        oneWayLayer: Phaser.Tilemaps.TilemapLayer
    ) {
        if (!mob.active || !this.player.active) return;
        if (this.envManager && this.envManager.isPlayerInSafeZone()) return;
        const isTeleporting = mob.getData('isTeleporting') as boolean;
        if (isTeleporting) return;

        let teleportRange = (mob.getData('teleportRange') as number) || 480;
        const rangeLeft = mob.getData('rangeLeft') as number | undefined;
        const rangeRight = mob.getData('rangeRight') as number | undefined;
        const rangeUp = mob.getData('rangeUp') as number | undefined;
        const rangeDown = mob.getData('rangeDown') as number | undefined;
        const spawnX = (mob.getData('spawnX') as number) ?? mob.x;
        const spawnY = (mob.getData('spawnY') as number) ?? mob.y;

        const maxHRange = Math.max(rangeLeft || 0, rangeRight || 0);
        if (maxHRange > 0) {
            teleportRange = Math.max(teleportRange, maxHRange + 64);
        }

        const verticalTeleport = mob.getData('verticalTeleport') !== false;
        const verticalRange = (mob.getData('verticalRange') as number) || 96;
        const verticalMode = (mob.getData('verticalMode') as string) || 'any';
        const allowOneWay = mob.getData('allowOneWay') !== false;

        // Horizontal axis detection checks (-x and +x)
        if (this.player.x < spawnX && rangeLeft !== undefined && (spawnX - this.player.x) > rangeLeft + 64) return;
        if (this.player.x > spawnX && rangeRight !== undefined && (this.player.x - spawnX) > rangeRight + 64) return;

        // Vertical axis detection checks
        if (verticalMode === 'up') {
            if (this.player.y < spawnY && rangeUp !== undefined && (spawnY - this.player.y) > rangeUp + 64) return;
            if (this.player.y > spawnY && (this.player.y - spawnY) > 96) return;
        } else if (verticalMode === 'down') {
            if (this.player.y > spawnY && rangeDown !== undefined && (this.player.y - spawnY) > rangeDown + 64) return;
            if (this.player.y < spawnY && (spawnY - this.player.y) > 96) return;
        } else if (verticalMode === 'same' || !verticalTeleport) {
            if (Math.abs(this.player.y - spawnY) > 64) return;
        } else {
            if (this.player.y < spawnY && rangeUp !== undefined && (spawnY - this.player.y) > rangeUp + 64) return;
            if (this.player.y > spawnY && rangeDown !== undefined && (this.player.y - spawnY) > rangeDown + 64) return;
        }

        const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
        if (distToPlayer > teleportRange) return;

        const teleportInterval = (mob.getData('teleportInterval') as number) || 1100;
        const lastTeleportTime = (mob.getData('lastTeleportTime') as number) || 0;
        if (currentTime < lastTeleportTime + teleportInterval) return;

        // Find candidate teleport spots safely offset from the player
        const playerDir = this.player.facing === 'right' ? 1 : -1;
        const rawOffsets = [
            -playerDir * 52,
            -playerDir * 72,
            -playerDir * 96,
            playerDir * 56,
            playerDir * 76,
            -playerDir * 116,
            playerDir * 96
        ];

        const candidateXOffsets = Phaser.Utils.Array.Shuffle(rawOffsets);
        let targetSpot: { x: number; y: number } | null = null;

        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isPlayerInAir = !pBody.blocked.down && !this.player.isOnPlatform;
        const projectedLandingX = this.player.x + (pBody.velocity.x * 0.35);

        // Search vertical tile offsets both up and down around player's current elevation
        const maxVSpread = Math.max(verticalRange, rangeUp || 0, 96);
        const maxTileDist = Math.min(Math.floor(maxVSpread / 32), 16);
        const verticalTileOffsets: number[] = [0];

        for (let t = 1; t <= maxTileDist; t++) {
            verticalTileOffsets.push(0); // same level
            verticalTileOffsets.push(-t * 32); // above player
            verticalTileOffsets.push(t * 32);  // below player
        }

        // Base tile Y corresponding to player's feet
        const playerBaseTileY = Math.floor((this.player.y + 12) / 32) * 32;

        for (const vOff of verticalTileOffsets) {
            const testY = playerBaseTileY + vOff;

            for (const xOff of candidateXOffsets) {
                const testX = this.player.x + xOff;

                // 1. Horizontal Range checks (-x and +x) from original spawn position
                if (testX < spawnX && rangeLeft !== undefined && (spawnX - testX) > rangeLeft) continue;
                if (testX > spawnX && rangeRight !== undefined && (testX - spawnX) > rangeRight) continue;

                const gTile = groundLayer.getTileAtWorldXY(testX, testY);
                const owTile = allowOneWay ? oneWayLayer.getTileAtWorldXY(testX, testY) : null;
                const smashTile = this.smashLayer ? this.smashLayer.getTileAtWorldXY(testX, testY) : null;
                const bridgeFloor = this.envManager?.bridges ? this.envManager.bridges.some(b => !b.broken && b.sprite.active && b.sprite.getBounds().contains(testX, testY)) : false;
                const hasSolidFloor = (gTile && gTile.index !== -1) || (owTile && owTile.index !== -1) || (smashTile && smashTile.index !== -1) || bridgeFloor;

                if (!hasSolidFloor) continue;

                const floorY = Math.floor(testY / 32) * 32; // Top surface of floor tile in world px

                // 2. Strict vertical bounds relative to spawn position
                if (verticalMode === 'up') {
                    // Cannot teleport below spawn floor! (allowed from spawn level upwards)
                    if (floorY > spawnY + 16) continue;
                    if (rangeUp !== undefined && (spawnY - floorY) > rangeUp + 24) continue;
                } else if (verticalMode === 'down') {
                    // Cannot teleport above spawn floor!
                    if (floorY < spawnY - 16) continue;
                    if (rangeDown !== undefined && (floorY - spawnY) > rangeDown + 24) continue;
                } else if (verticalMode === 'same' || !verticalTeleport) {
                    if (Math.abs(floorY - spawnY) > 24) continue;
                } else {
                    if (rangeUp !== undefined && (spawnY - floorY) > rangeUp + 24) continue;
                    if (rangeDown !== undefined && (floorY - spawnY) > rangeDown + 24) continue;
                }

                // 3. Anti-Clipping Bounding Box Clearance: ensure the ghost standing box is empty air
                const mobScale = (mob.getData('scale') as number) || 1.0;
                const samplePoints = [
                    { x: testX, y: floorY - 6 * mobScale },
                    { x: testX - 10 * mobScale, y: floorY - 6 * mobScale },
                    { x: testX + 10 * mobScale, y: floorY - 6 * mobScale },
                    { x: testX, y: floorY - 18 * mobScale },
                    { x: testX - 10 * mobScale, y: floorY - 18 * mobScale },
                    { x: testX + 10 * mobScale, y: floorY - 18 * mobScale },
                    { x: testX, y: floorY - 28 * mobScale }
                ];
                let isBlocked = false;
                for (const pt of samplePoints) {
                    const tile = groundLayer.getTileAtWorldXY(pt.x, pt.y);
                    const sTile = this.smashLayer ? this.smashLayer.getTileAtWorldXY(pt.x, pt.y) : null;
                    if ((tile && tile.index !== -1) || (sTile && sTile.index !== -1)) {
                        isBlocked = true;
                        break;
                    }
                }
                if (isBlocked) continue;

                // Ensure tile directly above floor is not solid (prevents spawning inside a solid block column)
                const tileAbove = groundLayer.getTileAtWorldXY(testX, floorY - 2);
                const sTileAbove = this.smashLayer ? this.smashLayer.getTileAtWorldXY(testX, floorY - 2) : null;
                if ((tileAbove && tileAbove.index !== -1) || (sTileAbove && sTileAbove.index !== -1)) continue;

                // 4. Hazard Avoidance: Ghost strictly avoids everything on the hazards layer (spikes, lava, death zones in empty air)
                if (this.hazardsLayer) {
                    const hPoints = [
                        { x: testX, y: floorY - 6 * mobScale },
                        { x: testX - 10 * mobScale, y: floorY - 6 * mobScale },
                        { x: testX + 10 * mobScale, y: floorY - 6 * mobScale },
                        { x: testX, y: floorY - 18 * mobScale },
                        { x: testX - 10 * mobScale, y: floorY - 18 * mobScale },
                        { x: testX + 10 * mobScale, y: floorY - 18 * mobScale },
                        { x: testX, y: floorY - 28 * mobScale }
                    ];
                    let isHazard = false;
                    for (const hp of hPoints) {
                        const hTile = this.hazardsLayer.getTileAtWorldXY(hp.x, hp.y);
                        if (hTile && hTile.index !== -1) {
                            isHazard = true;
                            break;
                        }
                    }
                    if (isHazard) continue;
                }

                // 5. Landing Zone Guard: Prevent spawning directly underneath a jumping/falling player
                const currentDistX = Math.abs(testX - this.player.x);
                const projectedDistX = Math.abs(testX - projectedLandingX);
                const isFloorUnderPlayer = floorY >= this.player.y - 8;
                const requiredBuffer = (isPlayerInAir && isFloorUnderPlayer) ? 50 : 38;
                if (currentDistX < requiredBuffer || projectedDistX < requiredBuffer) continue;

                // 6. World Bounds & Safe Zone Guard Check
                if (this.envManager && this.envManager.isPositionInSafeZone(testX, floorY)) continue;

                const withinBounds = testX > 32 && testX < this.scene.physics.world.bounds.width - 32 &&
                                     floorY > 32 && floorY < this.scene.physics.world.bounds.height - 16;
                if (!withinBounds) continue;

                targetSpot = { x: testX, y: floorY };
                break;
            }
            if (targetSpot) break;
        }

        if (targetSpot) {
            mob.setData('isTeleporting', true);
            mob.setData('lastTeleportTime', currentTime + Math.random() * 200);

            // Fast Instantaneous Ghost Disappear (smoke particles, quick fade)
            this.uiManager.spawnParticles(mob.x, mob.y - 14, 0xBAE6FD);
            this.soundManager?.playJump();

            const body = mob.body as Phaser.Physics.Arcade.Body;
            if (body) body.enable = false;

            const mobScale = (mob.getData('scale') as number) || 1.0;
            this.scene.tweens.add({
                targets: mob,
                alpha: 0,
                scaleX: 0.1 * mobScale,
                scaleY: 1.5 * mobScale,
                duration: 45,
                ease: 'Linear',
                onComplete: () => {
                    if (!mob.active) return;
                    mob.setPosition(targetSpot!.x, targetSpot!.y);
                    mob.setVelocity(0, 0);
                    mob.setFlipX(this.player.x < mob.x);
                    this.uiManager.spawnParticles(targetSpot!.x, targetSpot!.y - 14 * mobScale, 0xBAE6FD);

                    this.scene.tweens.add({
                        targets: mob,
                        alpha: 0.92,
                        scaleX: mobScale,
                        scaleY: mobScale,
                        duration: 55,
                        ease: 'Linear',
                        onComplete: () => {
                            if (mob.active) {
                                if (body) body.enable = true;
                                mob.setData('isTeleporting', false);
                            }
                        }
                    });
                }
            });
        }
    }

    update(groundLayer: Phaser.Tilemaps.TilemapLayer, oneWayLayer: Phaser.Tilemaps.TilemapLayer, _delta: number = 16.667) {
        const currentTime = this.scene.time.now;
        const cam = this.scene.cameras.main;
        const activeLeft = cam.scrollX - 400;
        const activeRight = cam.scrollX + cam.width + 400;
        const activeTop = cam.scrollY - 300;
        const activeBottom = cam.scrollY + cam.height + 300;

        this.enemyBullets.getChildren().forEach(child => {
            const bullet = child as Phaser.Physics.Arcade.Sprite;
            if (!bullet.active) return;
            const boundZone = bullet.getData('boundZone') as Phaser.Geom.Rectangle | undefined;
            if (boundZone && !Phaser.Geom.Rectangle.Contains(boundZone, bullet.x, bullet.y)) {
                this.uiManager.spawnParticles(bullet.x, bullet.y, 0xEF4444);
                bullet.destroy();
            }
        });

        this.groundMobs.getChildren().forEach(child => {
            const mob = child as Phaser.Physics.Arcade.Sprite;
            if (!mob.active) return;

            const isNearCamera = mob.x >= activeLeft && mob.x <= activeRight && mob.y >= activeTop && mob.y <= activeBottom;
            
            let dir = mob.getData('direction') as number;
            const speed = mob.getData('speed') as number;
            const isStationary = mob.getData('stationary') as boolean;
            const mobType = mob.getData('type') as string;
            const canShoot = mob.getData('canShoot') as boolean;
            const ignoreLOS = (mob.getData('ignoreLOS') as boolean) || false;
            const allowOneWay = (mob.getData('allowOneWay') as boolean) ?? true;
            const body = mob.body as Phaser.Physics.Arcade.Body;

            if (mobType === 'shiro-onna') {
                mob.setVelocityX(0);
                const isPlayerSafe = this.envManager ? this.envManager.isPlayerInSafeZone() : false;
                const spawnX = (mob.getData('spawnX') as number) ?? mob.x;
                const spawnY = (mob.getData('spawnY') as number) ?? mob.y;
                const mobScale = (mob.getData('scale') as number) || 1.0;
                const initialDir = (mob.getData('direction') as number) || 1;

                if (isPlayerSafe) {
                    // Stop any ongoing teleport tween and return Shiro Onna to original spawn location
                    const isTeleporting = mob.getData('isTeleporting') as boolean;
                    if (isTeleporting) {
                        this.scene.tweens.killTweensOf(mob);
                        mob.setData('isTeleporting', false);
                    }

                    const distFromSpawn = Phaser.Math.Distance.Between(mob.x, mob.y, spawnX, spawnY);
                    if (distFromSpawn > 4) {
                        if (isNearCamera && mob.alpha > 0.1) {
                            this.uiManager.spawnParticles(mob.x, mob.y - 14 * mobScale, 0xBAE6FD);
                        }
                        mob.setPosition(spawnX, spawnY);
                        mob.setVelocity(0, 0);
                        if (isNearCamera) {
                            this.uiManager.spawnParticles(spawnX, spawnY - 14 * mobScale, 0xBAE6FD);
                        }
                    }

                    mob.setAlpha(0.92);
                    mob.setScale(mobScale);
                    mob.setFlipX(initialDir === -1);
                    if (body) {
                        body.enable = true;
                        body.setVelocity(0, 0);
                    }
                } else if (isNearCamera) {
                    mob.setFlipX(this.player.x < mob.x);
                    this.tryTeleportShiroOnna(mob, currentTime, groundLayer, oneWayLayer);
                }
            } else if (mobType === 'lava-kappa' || mobType === 'kappa') {
                if (!isNearCamera) {
                    mob.setVelocityX(0);
                    if (mob.anims.isPlaying) {
                        mob.anims.stop();
                    }
                } else {
                    const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
                    const range = (mob.getData('range') as number) || 380;
                    const inRange = distToPlayer <= range;

                    const mobScale = (mob.getData('scale') as number) || 1.0;
                    const eyeX = mob.x;
                    const eyeY = mob.y - 14 * mobScale;
                    const targetX = this.player.x;
                    const targetY = this.player.y - 8;

                    const playerZone = this.ignoreLOSZones.find(z => Phaser.Geom.Rectangle.Contains(z, this.player.x, this.player.y));
                    const shouldBypassLOS = ignoreLOS || Boolean(playerZone);
                    const canSeePlayer = inRange && (shouldBypassLOS || this.hasLineOfSight(eyeX, eyeY, targetX, targetY));

                    if (isStationary || speed === 0) {
                        // Standstill / Stationary Lava Kappa
                        mob.setVelocityX(0);
                        if (mob.anims.isPlaying) {
                            mob.anims.stop();
                        }
                        if (canSeePlayer) {
                            // Turn to face the player's direction only if player is in visible line of sight
                            const aimDir = this.player.x < mob.x ? -1 : 1;
                            dir = aimDir;
                            mob.setData('direction', dir);
                        }
                        mob.setTexture('mob-lava-kappa', dir === 1 ? 4 : 0);
                    } else if (canSeePlayer) {
                        // Non-stationary Lava Kappa: Follow player only when in range AND line of sight is clear
                        const aimDir = this.player.x < mob.x ? -1 : 1;
                        dir = aimDir;
                        mob.setData('direction', dir);

                        const distX = Math.abs(this.player.x - mob.x);
                        let shouldMove = distX > 16;
                        let moved = false;

                        if (shouldMove) {
                            const lookaheadDist = Math.max(6, Math.ceil(speed * 0.06));
                            const checkX = dir === 1 ? body.right + lookaheadDist : body.left - lookaheadDist;
                            const checkY = body.bottom + 6;

                            const tile = groundLayer.getTileAtWorldXY(checkX, checkY);
                            const oneWayTile = allowOneWay ? oneWayLayer.getTileAtWorldXY(checkX, checkY) : null;
                            const smashTile = this.smashLayer ? this.smashLayer.getTileAtWorldXY(checkX, checkY) : null;
                            const bridgeFloor = this.envManager?.bridges ? this.envManager.bridges.some(b => !b.broken && b.sprite.active && b.sprite.getBounds().contains(checkX, checkY)) : false;
                            const hasFloor = (tile && tile.index !== -1) || (oneWayTile && oneWayTile.index !== -1) || (smashTile && smashTile.index !== -1) || bridgeFloor;

                            let isFloorHazard = false;
                            let isWallHazard = false;
                            if (this.hazardsLayer) {
                                const hFloorTile = this.hazardsLayer.getTileAtWorldXY(checkX, checkY);
                                if (hFloorTile && hFloorTile.index !== -1) isFloorHazard = true;

                                const hWallTile = this.hazardsLayer.getTileAtWorldXY(checkX, body.center.y);
                                if (hWallTile && hWallTile.index !== -1) isWallHazard = true;
                            }

                            const isBlockedByWall = (dir === 1 && (body.blocked.right || body.touching.right)) ||
                                                    (dir === -1 && (body.blocked.left || body.touching.left));

                            if (!hasFloor || isFloorHazard || isWallHazard || isBlockedByWall) {
                                mob.setVelocityX(0);
                            } else {
                                mob.setVelocityX(speed * dir);
                                moved = true;
                            }
                        } else {
                            mob.setVelocityX(0);
                        }

                        if (moved) {
                            const animKey = this.getMobAnimKey(mobType, dir);
                            if ((!mob.anims.isPlaying || mob.anims.currentAnim?.key !== animKey) && this.scene.anims.exists(animKey)) {
                                mob.play(animKey, true);
                            }
                        } else {
                            if (mob.anims.isPlaying) {
                                mob.anims.stop();
                            }
                            mob.setTexture('mob-lava-kappa', dir === 1 ? 4 : 0);
                        }
                    } else {
                        // Non-stationary Lava Kappa: If out of range OR LOS is blocked by any obstacle/ground,
                        // carry on moving along its path normally
                        const lastTurnTime = (mob.getData('lastTurnTime') as number) || 0;
                        const canTurn = (currentTime - lastTurnTime > 150);

                        const spawnX = (mob.getData('spawnX') as number) ?? mob.x;
                        const rangeLeft = mob.getData('rangeLeft') as number | undefined;
                        const rangeRight = mob.getData('rangeRight') as number | undefined;

                        if (canTurn && dir === -1 && rangeLeft !== undefined && (spawnX - mob.x) >= rangeLeft) {
                            dir = 1;
                            mob.setData('lastTurnTime', currentTime);
                        } else if (canTurn && dir === 1 && rangeRight !== undefined && (mob.x - spawnX) >= rangeRight) {
                            dir = -1;
                            mob.setData('lastTurnTime', currentTime);
                        }

                        if (body.blocked.left && body.blocked.right) {
                            mob.setVelocityX(0);
                        } else if (body.blocked.left || body.touching.left) {
                            if (canTurn && dir !== 1) {
                                dir = 1;
                                mob.setData('lastTurnTime', currentTime);
                            }
                        } else if (body.blocked.right || body.touching.right) {
                            if (canTurn && dir !== -1) {
                                dir = -1;
                                mob.setData('lastTurnTime', currentTime);
                            }
                        } else {
                            const lookaheadDist = Math.max(6, Math.ceil(speed * 0.06));
                            const checkX = dir === 1 ? body.right + lookaheadDist : body.left - lookaheadDist;
                            const checkY = body.bottom + 6;
                            
                            const tile = groundLayer.getTileAtWorldXY(checkX, checkY);
                            const oneWayTile = allowOneWay ? oneWayLayer.getTileAtWorldXY(checkX, checkY) : null;
                            const smashTile = this.smashLayer ? this.smashLayer.getTileAtWorldXY(checkX, checkY) : null;
                            const bridgeFloor = this.envManager?.bridges ? this.envManager.bridges.some(b => !b.broken && b.sprite.active && b.sprite.getBounds().contains(checkX, checkY)) : false;
                            const hasFloor = (tile && tile.index !== -1) || (oneWayTile && oneWayTile.index !== -1) || (smashTile && smashTile.index !== -1) || bridgeFloor;
                            
                            let isFloorHazard = false;
                            let isWallHazard = false;
                            if (this.hazardsLayer) {
                                const hFloorTile = this.hazardsLayer.getTileAtWorldXY(checkX, checkY);
                                if (hFloorTile && hFloorTile.index !== -1) isFloorHazard = true;

                                const hWallTile = this.hazardsLayer.getTileAtWorldXY(checkX, body.center.y);
                                if (hWallTile && hWallTile.index !== -1) isWallHazard = true;
                            }

                            if (!hasFloor || isFloorHazard || isWallHazard) {
                                const oppCheckX = dir === 1 ? body.left - lookaheadDist : body.right + lookaheadDist;
                                const oppTile = groundLayer.getTileAtWorldXY(oppCheckX, checkY);
                                const oppOneWay = allowOneWay ? oneWayLayer.getTileAtWorldXY(oppCheckX, checkY) : null;
                                const oppSmash = this.smashLayer ? this.smashLayer.getTileAtWorldXY(oppCheckX, checkY) : null;
                                const oppBridgeFloor = this.envManager?.bridges ? this.envManager.bridges.some(b => !b.broken && b.sprite.active && b.sprite.getBounds().contains(oppCheckX, checkY)) : false;
                                const oppHasFloor = (oppTile && oppTile.index !== -1) || (oppOneWay && oppOneWay.index !== -1) || (oppSmash && oppSmash.index !== -1) || oppBridgeFloor;

                                if (!oppHasFloor) {
                                    mob.setVelocityX(0);
                                } else if (canTurn) {
                                    dir *= -1;
                                    mob.setData('direction', dir);
                                    mob.setData('lastTurnTime', currentTime);
                                }
                            }
                        }

                        mob.setData('direction', dir);
                        mob.setVelocityX(speed * dir);

                        const animKey = this.getMobAnimKey(mobType, dir);
                        if ((!mob.anims.isPlaying || mob.anims.currentAnim?.key !== animKey) && this.scene.anims.exists(animKey)) {
                            mob.play(animKey, true);
                        }
                    }
                }
            } else if (isStationary || speed === 0) {
                mob.setVelocityX(0);

                if (isNearCamera) {
                    if (canShoot) {
                        const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
                        const range = (mob.getData('range') as number) || 380;
                        if (distToPlayer <= range) {
                            const mobScale = (mob.getData('scale') as number) || 1.0;
                            const eyeX = mob.x;
                            const eyeY = mob.y - 14 * mobScale;
                            const targetX = this.player.x;
                            const targetY = this.player.y - 8;

                            const playerZone = this.ignoreLOSZones.find(z => Phaser.Geom.Rectangle.Contains(z, this.player.x, this.player.y));
                            const shouldBypassLOS = ignoreLOS || Boolean(playerZone);

                            if (shouldBypassLOS || this.hasLineOfSight(eyeX, eyeY, targetX, targetY)) {
                                dir = this.player.x < mob.x ? -1 : 1;
                                mob.setData('direction', dir);
                            }
                        }
                    }

                    const texInfo = this.getMobTextureAndFrame(mobType, dir);
                    if (mob.anims.isPlaying) {
                        mob.anims.stop();
                    }
                    mob.setTexture(texInfo.key, texInfo.frame);
                    if (mobType === 'shiro-onna') {
                        mob.setFlipX(dir === -1);
                    }
                }
            } else {
                // Moving Ground Mob (Patrol)
                if (!isNearCamera) {
                    mob.setVelocityX(0);
                } else {
                    const lastTurnTime = (mob.getData('lastTurnTime') as number) || 0;
                    const canTurn = (currentTime - lastTurnTime > 150);

                    const spawnX = (mob.getData('spawnX') as number) ?? mob.x;
                    const rangeLeft = mob.getData('rangeLeft') as number | undefined;
                    const rangeRight = mob.getData('rangeRight') as number | undefined;

                    // Range limits
                    if (canTurn && dir === -1 && rangeLeft !== undefined && (spawnX - mob.x) >= rangeLeft) {
                        dir = 1;
                        mob.setData('lastTurnTime', currentTime);
                    } else if (canTurn && dir === 1 && rangeRight !== undefined && (mob.x - spawnX) >= rangeRight) {
                        dir = -1;
                        mob.setData('lastTurnTime', currentTime);
                    }

                    // Check if approaching a jump pad ahead (mobs turn back when approaching jump pad)
                    let isNearJumpPad = false;
                    if (this.envManager && this.envManager.jumpPads && this.envManager.jumpPads.length > 0) {
                        for (const pad of this.envManager.jumpPads) {
                            if (!pad.active) continue;
                            const padLeft = pad.x;
                            const padRight = pad.x + (pad.displayWidth || 32);
                            const padTop = pad.y - (pad.displayHeight || 32);
                            const padBottom = pad.y;

                            // Check vertical alignment (on the same floor row)
                            const isAtSameFloorLevel = (body.bottom >= padTop - 12 && body.top <= padBottom + 12);
                            if (isAtSameFloorLevel) {
                                const padLookahead = Math.max(10, Math.ceil(speed * 0.12));
                                if (dir === 1 && (body.right + padLookahead >= padLeft && body.left < padLeft)) {
                                    isNearJumpPad = true;
                                    break;
                                } else if (dir === -1 && (body.left - padLookahead <= padRight && body.right > padRight)) {
                                    isNearJumpPad = true;
                                    break;
                                } else if (body.right > padLeft && body.left < padRight) {
                                    isNearJumpPad = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (isNearJumpPad) {
                        if (canTurn) {
                            dir *= -1;
                            mob.setData('direction', dir);
                            mob.setData('lastTurnTime', currentTime);
                        }
                    } else if (body.blocked.left && body.blocked.right) {
                        // Wedged in narrow space: stop moving to prevent infinite vibrating
                        mob.setVelocityX(0);
                    } else if (body.blocked.left || body.touching.left) {
                        if (canTurn && dir !== 1) {
                            dir = 1;
                            mob.setData('lastTurnTime', currentTime);
                        }
                    } else if (body.blocked.right || body.touching.right) {
                        if (canTurn && dir !== -1) {
                            dir = -1;
                            mob.setData('lastTurnTime', currentTime);
                        }
                    } else {
                        // Lookahead: check floor ahead of leading edge (accounting for scale & speed)
                        const lookaheadDist = Math.max(6, Math.ceil(speed * 0.06));
                        const checkX = dir === 1 ? body.right + lookaheadDist : body.left - lookaheadDist;
                        const checkY = body.bottom + 6;
                        
                        const tile = groundLayer.getTileAtWorldXY(checkX, checkY);
                        const oneWayTile = allowOneWay ? oneWayLayer.getTileAtWorldXY(checkX, checkY) : null;
                        const smashTile = this.smashLayer ? this.smashLayer.getTileAtWorldXY(checkX, checkY) : null;
                        const bridgeFloor = this.envManager?.bridges ? this.envManager.bridges.some(b => !b.broken && b.sprite.active && b.sprite.getBounds().contains(checkX, checkY)) : false;
                        const hasFloor = (tile && tile.index !== -1) || (oneWayTile && oneWayTile.index !== -1) || (smashTile && smashTile.index !== -1) || bridgeFloor;
                        
                        // Check if floor or body height ahead contains a hazard tile
                        let isFloorHazard = false;
                        let isWallHazard = false;
                        if (this.hazardsLayer) {
                            const hFloorTile = this.hazardsLayer.getTileAtWorldXY(checkX, checkY);
                            if (hFloorTile && hFloorTile.index !== -1) isFloorHazard = true;

                            const hWallTile = this.hazardsLayer.getTileAtWorldXY(checkX, body.center.y);
                            if (hWallTile && hWallTile.index !== -1) isWallHazard = true;
                        }

                        if (!hasFloor || isFloorHazard || isWallHazard) {
                            // Check opposite side floor to detect isolated 1-tile ledges
                            const oppCheckX = dir === 1 ? body.left - lookaheadDist : body.right + lookaheadDist;
                            const oppTile = groundLayer.getTileAtWorldXY(oppCheckX, checkY);
                            const oppOneWay = allowOneWay ? oneWayLayer.getTileAtWorldXY(oppCheckX, checkY) : null;
                            const oppSmash = this.smashLayer ? this.smashLayer.getTileAtWorldXY(oppCheckX, checkY) : null;
                            const oppBridgeFloor = this.envManager?.bridges ? this.envManager.bridges.some(b => !b.broken && b.sprite.active && b.sprite.getBounds().contains(oppCheckX, checkY)) : false;
                            const oppHasFloor = (oppTile && oppTile.index !== -1) || (oppOneWay && oppOneWay.index !== -1) || (oppSmash && oppSmash.index !== -1) || oppBridgeFloor;

                            if (!oppHasFloor) {
                                mob.setVelocityX(0);
                            } else if (canTurn) {
                                dir *= -1;
                                mob.setData('direction', dir);
                                mob.setData('lastTurnTime', currentTime);
                            }
                        }
                    }
                    
                    mob.setData('direction', dir);
                    mob.setVelocityX(speed * dir);

                    const animKey = this.getMobAnimKey(mobType, dir);
                    if ((!mob.anims.isPlaying || mob.anims.currentAnim?.key !== animKey) && this.scene.anims.exists(animKey)) {
                        mob.play(animKey, true);
                    }
                }
            }

            if (canShoot && isNearCamera) {
                const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
                const range = (mob.getData('range') as number) || 380;
                const shootInterval = (mob.getData('shootInterval') as number) || 2200;
                const lastShootTime = (mob.getData('lastShootTime') as number) || 0;

                if (distToPlayer <= range && currentTime > lastShootTime + shootInterval) {
                    const mobScale = (mob.getData('scale') as number) || 1.0;
                    const eyeX = mob.x;
                    const eyeY = mob.y - 14 * mobScale;
                    const targetX = this.player.x;
                    const targetY = this.player.y - 8;

                    const playerZone = this.ignoreLOSZones.find(z => Phaser.Geom.Rectangle.Contains(z, this.player.x, this.player.y));
                    const shouldBypassLOS = ignoreLOS || Boolean(playerZone);

                    if (shouldBypassLOS || this.hasLineOfSight(eyeX, eyeY, targetX, targetY)) {
                        mob.setData('lastShootTime', currentTime);
                        
                        const aimDir = this.player.x < mob.x ? -1 : 1;
                        mob.setData('direction', aimDir);
                        
                        if (mobType === 'lava-kappa' || mobType === 'kappa') {
                            if (isStationary || speed === 0) {
                                if (mob.anims.isPlaying) mob.anims.stop();
                                mob.setTexture('mob-lava-kappa', aimDir === 1 ? 4 : 0);
                            } else {
                                const animKey = this.getMobAnimKey(mobType, aimDir);
                                if (this.scene.anims.exists(animKey)) {
                                    mob.play(animKey, true);
                                } else {
                                    mob.setTexture('mob-lava-kappa', aimDir === 1 ? 4 : 0);
                                }
                            }
                        } else if (isStationary || speed === 0) {
                            const texInfo = this.getMobTextureAndFrame(mobType, aimDir);
                            if (mob.anims.isPlaying) mob.anims.stop();
                            mob.setTexture(texInfo.key, texInfo.frame);
                        } else {
                            mob.setData('lastAimDir', aimDir);
                            const animKey = this.getMobAnimKey(mobType, aimDir);
                            if (this.scene.anims.exists(animKey)) {
                                mob.play(animKey, true);
                            }
                        }
                        if (mobType === 'shiro-onna') {
                            mob.setFlipX(aimDir === -1);
                        }

                        this.scene.tweens.add({
                            targets: mob,
                            alpha: 0.4,
                            duration: 80,
                            yoyo: true,
                            repeat: 1,
                            onComplete: () => {
                                if (mob.active) {
                                    const currentAimDir = this.player.x < mob.x ? -1 : 1;
                                    mob.setData('direction', currentAimDir);
                                    if (mobType === 'lava-kappa' || mobType === 'kappa') {
                                        if (isStationary || speed === 0) {
                                            if (mob.anims.isPlaying) mob.anims.stop();
                                            mob.setTexture('mob-lava-kappa', currentAimDir === 1 ? 4 : 0);
                                        } else {
                                            const animKey = this.getMobAnimKey(mobType, currentAimDir);
                                            if (this.scene.anims.exists(animKey)) {
                                                mob.play(animKey, true);
                                            } else {
                                                mob.setTexture('mob-lava-kappa', currentAimDir === 1 ? 4 : 0);
                                            }
                                        }
                                    }
                                    this.fireEnemyProjectile(mob, playerZone, ignoreLOS);
                                }
                            }
                        });
                    }
                }
            }
        });

        // Flying Mobs Patrol & Animation Update
        this.flyingMobs.getChildren().forEach(child => {
            const mob = child as Phaser.Physics.Arcade.Sprite;
            if (!mob.active) return;

            const isNearCamera = mob.x >= activeLeft && mob.x <= activeRight && mob.y >= activeTop && mob.y <= activeBottom;

            let dir = mob.getData('direction') as number;
            const speed = (mob.getData('speed') as number) || 70;
            const axis = (mob.getData('axis') as 'horizontal' | 'vertical') || 'horizontal';
            const mobType = mob.getData('type') as string;
            const canShoot = mob.getData('canShoot') as boolean;
            const ignoreLOS = (mob.getData('ignoreLOS') as boolean) || false;

            if (axis === 'horizontal') {
                const minX = mob.getData('minX') as number;
                const maxX = mob.getData('maxX') as number;

                if (mob.x >= maxX) {
                    dir = -1;
                } else if (mob.x <= minX) {
                    dir = 1;
                }

                mob.setData('direction', dir);
                mob.setVelocityX(speed * dir);
                mob.setVelocityY(0);

                if (isNearCamera) {
                    const animKey = this.getMobAnimKey(mobType, dir);
                    if ((!mob.anims.isPlaying || mob.anims.currentAnim?.key !== animKey) && this.scene.anims.exists(animKey)) {
                        mob.play(animKey, true);
                    }
                }
            } else {
                const minY = mob.getData('minY') as number;
                const maxY = mob.getData('maxY') as number;

                if (mob.y >= maxY) {
                    dir = -1;
                } else if (mob.y <= minY) {
                    dir = 1;
                }

                mob.setData('direction', dir);
                mob.setVelocityY(speed * dir);
                mob.setVelocityX(0);

                if (isNearCamera) {
                    const mobScale = (mob.getData('scale') as number) || 1.0;
                    const eyeX = mob.x;
                    const eyeY = mob.y - 14 * mobScale;
                    const targetX = this.player.x;
                    const targetY = this.player.y - 8;
                    const playerZone = this.ignoreLOSZones.find(z => Phaser.Geom.Rectangle.Contains(z, this.player.x, this.player.y));
                    const shouldBypassLOS = ignoreLOS || Boolean(playerZone);
                    const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
                    const range = (mob.getData('range') as number) || 380;
                    const canSeePlayer = canShoot && distToPlayer <= range && (shouldBypassLOS || this.hasLineOfSight(eyeX, eyeY, targetX, targetY));

                    const horizontalFacing = canSeePlayer ? (this.player.x < mob.x ? -1 : 1) : ((mob.getData('initialDirection') as number) || (mob.getData('direction') as number) || 1);
                    const animKey = this.getMobAnimKey(mobType, horizontalFacing);
                    if ((!mob.anims.isPlaying || mob.anims.currentAnim?.key !== animKey) && this.scene.anims.exists(animKey)) {
                        mob.play(animKey, true);
                    }
                }
            }

            if (canShoot && isNearCamera) {
                const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
                const range = (mob.getData('range') as number) || 380;
                const shootInterval = (mob.getData('shootInterval') as number) || 2200;
                const lastShootTime = (mob.getData('lastShootTime') as number) || 0;

                if (distToPlayer <= range && currentTime > lastShootTime + shootInterval) {
                    const mobScale = (mob.getData('scale') as number) || 1.0;
                    const eyeX = mob.x;
                    const eyeY = mob.y - 14 * mobScale;
                    const targetX = this.player.x;
                    const targetY = this.player.y - 8;

                    const playerZone = this.ignoreLOSZones.find(z => Phaser.Geom.Rectangle.Contains(z, this.player.x, this.player.y));
                    const shouldBypassLOS = ignoreLOS || Boolean(playerZone);

                    if (shouldBypassLOS || this.hasLineOfSight(eyeX, eyeY, targetX, targetY)) {
                        mob.setData('lastShootTime', currentTime);

                        const aimDir = this.player.x < mob.x ? -1 : 1;
                        mob.setData('direction', aimDir);
                        const animKey = this.getMobAnimKey(mobType, aimDir);
                        if (this.scene.anims.exists(animKey)) {
                            mob.play(animKey, true);
                        }
                        if (mobType === 'shiro-onna') {
                            mob.setFlipX(aimDir === -1);
                        }

                        this.scene.tweens.add({
                            targets: mob,
                            alpha: 0.4,
                            duration: 80,
                            yoyo: true,
                            repeat: 1,
                            onComplete: () => {
                                if (mob.active) {
                                    this.fireEnemyProjectile(mob, playerZone, ignoreLOS);
                                }
                            }
                        });
                    }
                }
            }
        });
    }
}
