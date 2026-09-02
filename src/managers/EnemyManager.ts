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
    public pipeMonsters!: Phaser.Physics.Arcade.Group;
    public enemyBullets!: Phaser.Physics.Arcade.Group;
    public ignoreLOSZones: Phaser.Geom.Rectangle[] = [];

    public enemiesKilled: number = 0;
    private killedEnemyKeys: Set<string> = new Set();

    private rawMapObjects: any[] = [];
    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private oneWayLayer!: Phaser.Tilemaps.TilemapLayer;
    private map!: Phaser.Tilemaps.Tilemap;

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
        this.pipeMonsters = this.scene.physics.add.group({ allowGravity: false, immovable: true });
        this.enemyBullets = this.scene.physics.add.group({ allowGravity: false });
    }

    setupGroundMobs(rawMapObjects: any[], groundLayer: Phaser.Tilemaps.TilemapLayer, oneWayLayer: Phaser.Tilemaps.TilemapLayer) {
        this.rawMapObjects = rawMapObjects;
        this.groundLayer = groundLayer;
        this.oneWayLayer = oneWayLayer;

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

        // Mobs vs One-Way Platforms collision
        this.scene.physics.add.collider(this.groundMobs, this.oneWayLayer, undefined, (mobObj, tile) => {
            const t = tile as Phaser.Tilemaps.Tile;
            if (t.index === -1) return false;
            const mBody = (mobObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
            return mBody.velocity.y > 0 && mBody.bottom <= t.pixelY + 10;
        });

        // Player vs Mobs overlap (instant stomp detection & fatal side hits)
        this.scene.physics.add.overlap(this.player, this.groundMobs, this.handlePlayerMobCollision);

        // Player Bullets vs Mobs overlap (kill mob with blaster)
        this.scene.physics.add.overlap(this.player.bullets, this.groundMobs, (bulletObj, mobObj) => {
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

        this.spawnGroundMobs();
    }

    private spawnGroundMobs() {
        this.groundMobs.clear(true, true);
        this.enemyBullets.clear(true, true);

        const mobObjects = this.rawMapObjects.filter((o: any) => 
            o.name === 'GroundMob' || 
            o.name === 'Mob' || 
            o.name === 'Enemy' || 
            o.name === 'ShooterMob' ||
            o.name === 'ShootingMob'
        );

        mobObjects.forEach((obj: any) => {
            const uniqueKey = `${obj.name}_${Math.round(obj.x)}_${Math.round(obj.y)}`;

            // Skip mobs that have already been defeated in this run
            if (this.killedEnemyKeys.has(uniqueKey)) {
                return;
            }

            let mobType = 'bug-green';
            let mobSpeed = 60;
            let isStationary = false;
            let canShoot = obj.name === 'ShooterMob' || obj.name === 'ShootingMob';
            let ignoreLOS = false;
            let shootInterval = 2200;
            let initialDelay = 300;
            let bulletSpeed = 220;
            let maxBulletSpeed = 220;
            let range = 380;

            if (obj.properties) {
                const typeProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'type' || p.name.toLowerCase() === 'mobtype'));
                if (typeProp && typeProp.value) {
                    mobType = String(typeProp.value).toLowerCase().trim();
                }

                const speedProp = obj.properties.find((p: any) => p.name && p.name.toLowerCase() === 'speed');
                if (speedProp && speedProp.value !== undefined) {
                    mobSpeed = Number(speedProp.value);
                    if (mobSpeed === 0) isStationary = true;
                }

                const stationaryProp = obj.properties.find((p: any) => p.name && (
                    p.name.toLowerCase() === 'stationary' || 
                    p.name.toLowerCase() === 'standstill' || 
                    p.name.toLowerCase() === 'static' || 
                    p.name.toLowerCase() === 'staystill'
                ));
                if (stationaryProp && stationaryProp.value !== undefined) {
                    isStationary = Boolean(stationaryProp.value);
                    if (isStationary) mobSpeed = 0;
                }

                const shootProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'canshoot' || p.name.toLowerCase() === 'shoots'));
                if (shootProp && shootProp.value !== undefined) {
                    canShoot = Boolean(shootProp.value);
                }

                const losProp = obj.properties.find((p: any) => p.name && (
                    p.name.toLowerCase() === 'ignorelos' || 
                    p.name.toLowerCase() === 'ignorewalls' || 
                    p.name.toLowerCase() === 'wallhack'
                ));
                if (losProp && losProp.value !== undefined) {
                    ignoreLOS = Boolean(losProp.value);
                }

                const intervalProp = obj.properties.find((p: any) => p.name && (
                    p.name.toLowerCase() === 'shootinterval' || 
                    p.name.toLowerCase() === 'interval' ||
                    p.name.toLowerCase() === 'cooldown' ||
                    p.name.toLowerCase() === 'rate'
                ));
                if (intervalProp && intervalProp.value !== undefined) {
                    shootInterval = Number(intervalProp.value);
                }

                const delayProp = obj.properties.find((p: any) => p.name && (
                    p.name.toLowerCase() === 'initialdelay' || 
                    p.name.toLowerCase() === 'activationtime' || 
                    p.name.toLowerCase() === 'delay' ||
                    p.name.toLowerCase() === 'firstshotdelay' ||
                    p.name.toLowerCase() === 'warmup'
                ));
                if (delayProp && delayProp.value !== undefined) {
                    initialDelay = Number(delayProp.value);
                }

                const bulletSpeedProp = obj.properties.find((p: any) => p.name && (
                    p.name.toLowerCase() === 'bulletspeed' ||
                    p.name.toLowerCase() === 'minspeed'
                ));
                if (bulletSpeedProp && bulletSpeedProp.value !== undefined) {
                    bulletSpeed = Number(bulletSpeedProp.value);
                    maxBulletSpeed = bulletSpeed;
                }

                const maxBulletSpeedProp = obj.properties.find((p: any) => p.name && (
                    p.name.toLowerCase() === 'maxbulletspeed' ||
                    p.name.toLowerCase() === 'maxspeed' ||
                    p.name.toLowerCase() === 'fastspeed'
                ));
                if (maxBulletSpeedProp && maxBulletSpeedProp.value !== undefined) {
                    maxBulletSpeed = Number(maxBulletSpeedProp.value);
                }

                const rangeProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'range'));
                if (rangeProp && rangeProp.value !== undefined) {
                    range = Number(rangeProp.value);
                }
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
            if (obj.properties) {
                const dirProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'direction' || p.name.toLowerCase() === 'dir'));
                if (dirProp && dirProp.value !== undefined) {
                    const val = String(dirProp.value).toLowerCase().trim();
                    if (val === 'left' || val === '-1') initialDir = -1;
                    else if (val === 'right' || val === '1') initialDir = 1;
                }
            }

            const initialAnim = initialDir === 1 ? `mob-${mobType}-walk-r` : `mob-${mobType}-walk-l`;
            const initialTexture = initialDir === 1 ? `mob-${mobType}-r` : `mob-${mobType}-l`;

            const mob = this.groundMobs.create(spawnX, spawnY, initialTexture) as Phaser.Physics.Arcade.Sprite;
            mob.setDepth(4).setOrigin(0.5, 1); 
            
            const body = mob.body as Phaser.Physics.Arcade.Body;
            body.setSize(24, 24);
            body.setOffset(9, 6);
            body.setCollideWorldBounds(true);
            
            if (!isStationary && this.scene.anims.exists(initialAnim)) {
                mob.play(initialAnim);
            }
            
            mob.setData('uniqueKey', uniqueKey);
            mob.setData('direction', initialDir);
            mob.setData('speed', mobSpeed); 
            mob.setData('stationary', isStationary);
            mob.setData('type', mobType); 
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
                    this.player.setVelocityY(-380);
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

        const monsterObjects = this.map.createFromObjects('Objects', { name: 'PipeMonster', key: 'pipe-monster' });
        const rawObjects = this.rawMapObjects.filter((o: any) => o.name === 'PipeMonster');

        monsterObjects.forEach((obj: any, index: number) => {
            const uniqueKey = `PipeMonster_${Math.round(obj.x)}_${Math.round(obj.y)}`;

            // Skip pipe monsters already defeated in this run
            if (this.killedEnemyKeys.has(uniqueKey)) {
                obj.destroy();
                return;
            }

            this.scene.physics.add.existing(obj);
            const monsterBody = obj.body as Phaser.Physics.Arcade.Body;
            monsterBody.allowGravity = false; 
            monsterBody.immovable = true; 
            monsterBody.setSize(24, 20);
            
            obj.setDepth(2.5);

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
        this.killedEnemyKeys.clear();
        this.enemyBullets.clear(true, true);
        if (this.rawMapObjects.length > 0 && this.groundLayer && this.oneWayLayer) {
            this.spawnGroundMobs();
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
            this.player.setVelocityY(-380); 
            this.player.isNormalJump = false;
            this.killMob(mob, 'stomp');
        } else {
            this.player.die();
        }
    }

    private killMob(mob: Phaser.Physics.Arcade.Sprite, method: 'stomp' | 'shoot') {
        const uniqueKey = mob.getData('uniqueKey') as string;
        if (uniqueKey) {
            this.killedEnemyKeys.add(uniqueKey);
        }

        this.groundMobs.remove(mob);
        const body = mob.body as Phaser.Physics.Arcade.Body;
        body.checkCollision.none = true;
        body.setCollideWorldBounds(false);
        mob.anims.stop(); 
        mob.setVelocity(Phaser.Math.Between(-80, 80), -280); 
        mob.setAngularVelocity(Phaser.Math.Between(400, 800) * (Math.random() > 0.5 ? 1 : -1)); 
        mob.setDepth(10);
        
        this.enemiesKilled++;
        this.collectiblesManager?.addCoins(1);
        this.soundManager?.playStomp();
        this.soundManager?.playCoin();
        
        const text = method === 'stomp' ? '+1 COIN' : '+1 COIN';
        this.uiManager.showFloatingText(mob.x, mob.y - 10, text, '#FFD700');
        this.uiManager.spawnParticles(mob.x, mob.y, 0xFFD700);

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
        
        const line = new Phaser.Geom.Line(mobX, mobY, targetX, targetY);
        const tiles = this.groundLayer.getTilesWithinShape(line);

        for (const tile of tiles) {
            if (tile && tile.index !== -1) {
                return false;
            }
        }
        return true;
    }

    private fireEnemyProjectile(mob: Phaser.Physics.Arcade.Sprite, boundZone?: Phaser.Geom.Rectangle, ignoreWalls: boolean = false) {
        const bullet = this.enemyBullets.create(mob.x, mob.y - 12, 'enemy-bullet') as Phaser.Physics.Arcade.Sprite;
        bullet.setDepth(5);
        bullet.setOrigin(0.5, 0.5);

        const body = bullet.body as Phaser.Physics.Arcade.Body;
        body.setSize(10, 10);
        body.setOffset(3, 3);
        body.allowGravity = false;

        if (boundZone) {
            bullet.setData('boundZone', boundZone);
        }
        bullet.setData('ignoreWalls', ignoreWalls);

        const baseSpeed = (mob.getData('bulletSpeed') as number) || 220;
        const maxSpeed = (mob.getData('maxBulletSpeed') as number) || baseSpeed;
        const range = (mob.getData('range') as number) || 380;

        const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y - 12, this.player.x, this.player.y);
        const distanceRatio = Phaser.Math.Clamp(distToPlayer / range, 0, 1);
        const finalSpeed = Phaser.Math.Linear(baseSpeed, maxSpeed, distanceRatio);

        const angle = Phaser.Math.Angle.Between(mob.x, mob.y - 12, this.player.x, this.player.y);
        const vx = Math.cos(angle) * finalSpeed;
        const vy = Math.sin(angle) * finalSpeed;

        bullet.setVelocity(vx, vy);
        this.soundManager?.playEnemyShoot();
        this.uiManager.spawnParticles(mob.x, mob.y - 12, 0xEF4444);

        this.scene.time.delayedCall(3000, () => {
            if (bullet.active) bullet.destroy();
        });
    }

    update(groundLayer: Phaser.Tilemaps.TilemapLayer, oneWayLayer: Phaser.Tilemaps.TilemapLayer) {
        const currentTime = this.scene.time.now;

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
            
            let dir = mob.getData('direction') as number;
            const speed = mob.getData('speed') as number;
            const isStationary = mob.getData('stationary') as boolean;
            const mobType = mob.getData('type') as string;
            const canShoot = mob.getData('canShoot') as boolean;
            const ignoreLOS = (mob.getData('ignoreLOS') as boolean) || false;
            const body = mob.body as Phaser.Physics.Arcade.Body;
            
            if (isStationary || speed === 0) {
                mob.setVelocityX(0);

                if (canShoot) {
                    const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
                    const range = (mob.getData('range') as number) || 380;
                    if (distToPlayer <= range) {
                        dir = this.player.x < mob.x ? -1 : 1;
                        mob.setData('direction', dir);
                    }
                }

                const texKey = dir === 1 ? `mob-${mobType}-r` : `mob-${mobType}-l`;
                if (mob.anims.isPlaying) {
                    mob.anims.stop();
                }
                if (mob.texture.key !== texKey) {
                    mob.setTexture(texKey);
                }
            } else {
                if (body.blocked.left) {
                    dir = 1;
                } else if (body.blocked.right) {
                    dir = -1;
                } else if (body.blocked.down) {
                    const checkX = body.center.x + (dir * (body.halfWidth + 4));
                    const checkY = body.bottom + 2;
                    
                    const tile = groundLayer.getTileAtWorldXY(checkX, checkY);
                    const oneWayTile = oneWayLayer.getTileAtWorldXY(checkX, checkY);
                    const hasFloor = (tile && tile.index !== -1) || (oneWayTile && oneWayTile.index !== -1);
                    
                    if (!hasFloor) dir *= -1; 
                }
                
                mob.setData('direction', dir);
                mob.setVelocityX(speed * dir);

                const animKey = dir === 1 ? `mob-${mobType}-walk-r` : `mob-${mobType}-walk-l`;
                if (mob.anims.currentAnim?.key !== animKey && this.scene.anims.exists(animKey)) {
                    mob.play(animKey, true);
                }
            }

            if (canShoot) {
                const distToPlayer = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
                const range = (mob.getData('range') as number) || 380;
                const shootInterval = (mob.getData('shootInterval') as number) || 2200;
                const lastShootTime = (mob.getData('lastShootTime') as number) || 0;

                if (distToPlayer <= range && currentTime > lastShootTime + shootInterval) {
                    const eyeX = mob.x;
                    const eyeY = mob.y - 14;
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
    }
}
