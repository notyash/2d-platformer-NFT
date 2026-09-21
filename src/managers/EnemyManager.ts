// src/managers/EnemyManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';
import { CollectiblesManager } from './CollectiblesManager';
import { SoundManager } from './SoundManager';

export class EnemyManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;
    private collectiblesManager?: CollectiblesManager;
    private soundManager?: SoundManager;

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
        soundManager?: SoundManager
    ) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
        this.collectiblesManager = collectiblesManager;
        this.soundManager = soundManager;

        this.groundMobs = this.scene.physics.add.group();
        this.flyingMobs = this.scene.physics.add.group({ allowGravity: false });
        this.pipeMonsters = this.scene.physics.add.group({ allowGravity: false, immovable: true });
        this.enemyBullets = this.scene.physics.add.group({ allowGravity: false });
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
        if (s.includes('bat') || s.includes('pumpkin')) return 'pumpkin-bat';
        if (s.includes('bonsai') || s.includes('gripper')) return 'bonsai-gripper';
        if (s.includes('kappa') || s.includes('lava')) return 'lava-kappa';
        if (s.includes('shiro') || s.includes('onna') || s.includes('ghost') || s.includes('teleport')) return 'shiro-onna';
        if (s.includes('yellow')) return 'bug-yellow';
        if (s.includes('devil') || s.includes('red')) return 'devil';
        if (s.includes('hedgehog') || s.includes('purple')) return 'hedgehog';
        if (s.includes('green') || s.includes('bug')) return 'bug-green';
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
                nameLower.includes('kappa') ||
                nameLower.includes('bug') ||
                nameLower.includes('devil') ||
                nameLower.includes('hedgehog') ||
                nameLower.includes('gripper') ||
                nameLower.includes('bonsai') ||
                typeLower.includes('ghost') ||
                typeLower.includes('shiro') ||
                typeLower.includes('sandal') ||
                typeLower.includes('kappa') ||
                typeLower.includes('devil') ||
                typeLower.includes('hedgehog') ||
                typeLower.includes('gripper') ||
                typeLower.includes('shooter') ||
                customType.includes('ghost') ||
                customType.includes('shiro') ||
                customType.includes('sandal') ||
                customType.includes('kappa') ||
                customType.includes('bug') ||
                customType.includes('devil') ||
                customType.includes('hedgehog') ||
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

            let mobType = 'bug-green';
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
            
            const is32x32 = normalizedType === 'sandal' || normalizedType === 'pumpkin-bat' || normalizedType === 'bonsai-gripper' || normalizedType === 'lava-kappa' || normalizedType === 'shiro-onna';
            const body = mob.body as Phaser.Physics.Arcade.Body;
            const baseW = is32x32 ? 22 : 24;
            const baseH = is32x32 ? 22 : 24;
            const baseOffX = is32x32 ? 5 : 9;
            const baseOffY = is32x32 ? 10 : 6;
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
            mob.setData('direction', initialDir);
            mob.setData('speed', mobSpeed); 
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

            const is32x32 = normalizedType === 'sandal' || normalizedType === 'pumpkin-bat' || normalizedType === 'bonsai-gripper' || normalizedType === 'lava-kappa' || normalizedType === 'shiro-onna';
            const baseW = is32x32 ? 22 : 24;
            const baseH = is32x32 ? 22 : 24;
            const baseOffX = is32x32 ? 5 : 9;
            const baseOffY = is32x32 ? 10 : 6;
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

        const monsterObjects = this.map.createFromObjects('Objects', { name: 'PipeMonster', key: 'pipe-monster-l' });
        const rawObjects = this.rawMapObjects.filter((o: any) => o.name === 'PipeMonster');

        monsterObjects.forEach((obj: any, index: number) => {
            const uniqueKey = `PipeMonster_${Math.round(obj.x)}_${Math.round(obj.y)}`;

            // Skip pipe monsters killed BEFORE the active checkpoint
            if (this.killedEnemyKeys.has(uniqueKey)) {
                obj.destroy();
                return;
            }

            this.scene.physics.add.existing(obj);
            const monsterBody = obj.body as Phaser.Physics.Arcade.Body;
            monsterBody.allowGravity = false; 
            monsterBody.immovable = true; 
            monsterBody.setSize(24, 20);
            monsterBody.setOffset(4, 3);
            
            obj.setDepth(2.9);
            obj.setTexture('pipe-monster-l');

            // Look left and right at a fixed interval using dedicated Devil_Red_Stand_L/R images
            const lookTimer = this.scene.time.addEvent({
                delay: 750,
                loop: true,
                callback: () => {
                    if (obj && obj.active) {
                        const nextTex = obj.texture.key === 'pipe-monster-l' ? 'pipe-monster-r' : 'pipe-monster-l';
                        obj.setTexture(nextTex);
                    } else if (lookTimer) {
                        lookTimer.destroy();
                    }
                }
            });

            let popDuration = 200;
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
            }

            obj.setData('uniqueKey', uniqueKey);
            obj.setData('restingY', obj.y);
            obj.setData('popDuration', popDuration);

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
        const popDistance = 24;

        this.scene.time.delayedCall(hideTime, () => {
            if (!monster.active) return;

            const pBody = this.player.body as Phaser.Physics.Arcade.Body;
            const isPlayerAbovePipe = (
                Math.abs(this.player.x - monster.x) < 30 &&
                pBody.bottom <= restingY + 6 &&
                pBody.bottom >= restingY - 64
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
                y: restingY - popDistance, 
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

    private hasLineOfSight(mobX: number, mobY: number, targetX: number, targetY: number): boolean {
        if (!this.groundLayer) return true;
        
        this.losLine.setTo(mobX, mobY, targetX, targetY);
        const tiles = this.groundLayer.getTilesWithinShape(this.losLine);

        for (const tile of tiles) {
            if (tile && tile.index !== -1) {
                return false;
            }
        }
        if (this.smashLayer) {
            const smashTiles = this.smashLayer.getTilesWithinShape(this.losLine);
            for (const tile of smashTiles) {
                if (tile && tile.index !== -1) return false;
            }
        }
        return true;
    }

    private fireEnemyProjectile(mob: Phaser.Physics.Arcade.Sprite, boundZone?: Phaser.Geom.Rectangle, ignoreWalls: boolean = false) {
        const mobScale = (mob.getData('scale') as number) || 1.0;
        const isFacingRight = (this.player.x >= mob.x);

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
        const isTeleporting = mob.getData('isTeleporting') as boolean;
        if (isTeleporting) return;

        const teleportRange = (mob.getData('teleportRange') as number) || 480;
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

        // Custom Teleportation Constraints
        const horizontalRange = mob.getData('horizontalRange') as number | undefined;
        const spawnX = (mob.getData('spawnX') as number) ?? mob.x;
        const verticalTeleport = mob.getData('verticalTeleport') !== false;
        const verticalRange = (mob.getData('verticalRange') as number) || 96;
        const verticalMode = (mob.getData('verticalMode') as string) || 'any';
        const allowOneWay = mob.getData('allowOneWay') !== false;

        let maxUpPx = verticalTeleport ? verticalRange : 0;
        let maxDownPx = verticalTeleport ? verticalRange : 0;

        if (verticalMode === 'up') maxDownPx = 0;
        else if (verticalMode === 'down') maxUpPx = 0;
        else if (verticalMode === 'same' || !verticalTeleport) {
            maxUpPx = 16;
            maxDownPx = 16;
        }

        // Generate vertical tile offsets starting from player's current floor level (0), then expanding outwards
        const maxUpTiles = Math.floor(maxUpPx / 32);
        const maxDownTiles = Math.floor(maxDownPx / 32);
        const maxTileDist = Math.max(maxUpTiles, maxDownTiles);
        const verticalTileOffsets: number[] = [0];

        for (let t = 1; t <= maxTileDist; t++) {
            if (verticalMode === 'up') {
                if (t <= maxUpTiles) verticalTileOffsets.push(-t * 32);
            } else if (verticalMode === 'down') {
                if (t <= maxDownTiles) verticalTileOffsets.push(t * 32);
            } else {
                // Prioritize same level / immediate ground first
                if (t <= maxDownTiles) verticalTileOffsets.push(t * 32);
                if (t <= maxUpTiles) verticalTileOffsets.push(-t * 32);
            }
        }

        // Base tile Y corresponding to player's feet
        const playerBaseTileY = Math.floor((this.player.y + 12) / 32) * 32;

        for (const vOff of verticalTileOffsets) {
            const testY = playerBaseTileY + vOff;

            for (const xOff of candidateXOffsets) {
                const testX = this.player.x + xOff;

                // 1. Horizontal Range check from original spawn position
                if (horizontalRange !== undefined && Math.abs(testX - spawnX) > horizontalRange) continue;

                const gTile = groundLayer.getTileAtWorldXY(testX, testY);
                const owTile = allowOneWay ? oneWayLayer.getTileAtWorldXY(testX, testY) : null;
                const smashTile = this.smashLayer ? this.smashLayer.getTileAtWorldXY(testX, testY) : null;
                const hasSolidFloor = (gTile && gTile.index !== -1) || (owTile && owTile.index !== -1) || (smashTile && smashTile.index !== -1);

                if (!hasSolidFloor) continue;

                const floorY = Math.floor(testY / 32) * 32; // Top surface of floor tile in world px

                // 2. Vertical Distance Checks relative to Player and Mob
                const pDiff = floorY - this.player.y;
                if (pDiff < -maxUpPx - 24 || pDiff > maxDownPx + 36) continue;

                const mDiff = floorY - mob.y;
                if (mDiff < -maxUpPx - 24 || mDiff > maxDownPx + 36) continue;

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

                // 6. World Bounds Check
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
            const body = mob.body as Phaser.Physics.Arcade.Body;

            if (mobType === 'shiro-onna') {
                mob.setVelocityX(0);
                if (isNearCamera) {
                    mob.setFlipX(this.player.x < mob.x);
                    this.tryTeleportShiroOnna(mob, currentTime, groundLayer, oneWayLayer);
                }
            } else if (isStationary || speed === 0) {
                mob.setVelocityX(0);

                if (isNearCamera) {
                    if (canShoot) {
                        const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
                        const range = (mob.getData('range') as number) || 380;
                        if (distToPlayer <= range) {
                            dir = this.player.x < mob.x ? -1 : 1;
                            mob.setData('direction', dir);
                        }
                    }

                    const texInfo = this.getMobTextureAndFrame(mobType, dir);
                    if (mob.anims.isPlaying) {
                        mob.anims.stop();
                    }
                    if (mob.texture.key !== texInfo.key || (texInfo.frame !== undefined && mob.frame.name !== String(texInfo.frame))) {
                        mob.setTexture(texInfo.key, texInfo.frame);
                    }
                }
            } else {
                if (body.blocked.left) {
                    dir = 1;
                } else if (body.blocked.right) {
                    dir = -1;
                } else if (body.blocked.down && isNearCamera) {
                    const checkX = body.center.x + (dir * (body.halfWidth + 4));
                    const checkY = body.bottom + 2;
                    
                    const tile = groundLayer.getTileAtWorldXY(checkX, checkY);
                    const oneWayTile = oneWayLayer.getTileAtWorldXY(checkX, checkY);
                    const smashTile = this.smashLayer ? this.smashLayer.getTileAtWorldXY(checkX, checkY) : null;
                    const hasFloor = (tile && tile.index !== -1) || (oneWayTile && oneWayTile.index !== -1) || (smashTile && smashTile.index !== -1);
                    
                    if (!hasFloor) dir *= -1; 
                }
                
                mob.setData('direction', dir);
                mob.setVelocityX(speed * dir);

                if (isNearCamera) {
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
                    const horizontalFacing = this.player.x < mob.x ? -1 : 1;
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
