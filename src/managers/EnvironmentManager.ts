// src/managers/EnvironmentManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';
import { InventoryManager } from './InventoryManager';
import { SoundManager } from './SoundManager';
import type { Firebar } from '../types';

export interface WindZoneData {
    zone: Phaser.GameObjects.Zone;
    forceX: number;
    forceY: number;
    turbulence: number;
    frequency: number;
    emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
}

export interface FakeGroundData {
    tileSprite: Phaser.GameObjects.TileSprite;
    bounds: Phaser.Geom.Rectangle;
}

export interface CheckpointData {
    id: number | string;
    zone: Phaser.GameObjects.Zone;
    spawnX: number;
    spawnY: number;
    label: string;
    activated: boolean;
}

export class EnvironmentManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;
    private inventoryManager: InventoryManager;
    private soundManager?: SoundManager;

    public movingPlatforms: Phaser.GameObjects.Sprite[] = [];
    public jumpPads: Phaser.Physics.Arcade.Sprite[] = [];
    public firebars: Firebar[] = [];
    public smashTriggers: Phaser.GameObjects.Zone[] = [];
    public doorZones: Phaser.GameObjects.Zone[] = [];
    public doorExitZones: Phaser.GameObjects.Zone[] = [];
    public disarmZones: Phaser.GameObjects.Zone[] = [];
    public windZones: WindZoneData[] = [];
    public fakeGrounds: FakeGroundData[] = [];
    public checkpoints: CheckpointData[] = [];
    public dandelions: Phaser.GameObjects.Sprite[] = [];

    public doorExitX: number = 0;
    public doorExitY: number = 0;
    private doorPrompt?: Phaser.GameObjects.Container;

    constructor(
        scene: Phaser.Scene, 
        player: Player, 
        uiManager: UIManager, 
        inventoryManager: InventoryManager,
        soundManager?: SoundManager
    ) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
        this.inventoryManager = inventoryManager;
        this.soundManager = soundManager;
    }

    public hasActiveCheckpoint(): boolean {
        return this.checkpoints.some(cp => cp.activated);
    }

    public isPlayerInCheckpointZone(): boolean {
        if (!this.player || !this.player.active) return false;
        const pBounds = this.player.getBounds();
        for (const cp of this.checkpoints) {
            if (cp.zone && cp.zone.active) {
                if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, cp.zone.getBounds())) {
                    return true;
                }
            }
        }
        return false;
    }

    public isPlayerInDoorZone(): boolean {
        if (!this.player || !this.player.active) return false;
        const pBounds = this.player.getBounds();
        for (const dZone of this.doorZones) {
            if (dZone && dZone.active && Phaser.Geom.Intersects.RectangleToRectangle(pBounds, dZone.getBounds())) {
                return true;
            }
        }
        for (const eZone of this.doorExitZones) {
            if (eZone && eZone.active && Phaser.Geom.Intersects.RectangleToRectangle(pBounds, eZone.getBounds())) {
                return true;
            }
        }
        return false;
    }

    public isPlayerInSafeZone(): boolean {
        return this.isPlayerInCheckpointZone() || this.isPlayerInDoorZone();
    }

    public isPositionInSafeZone(x: number, y: number): boolean {
        for (const cp of this.checkpoints) {
            if (cp.zone && cp.zone.active && cp.zone.getBounds().contains(x, y)) {
                return true;
            }
        }
        for (const dZone of this.doorZones) {
            if (dZone && dZone.active && dZone.getBounds().contains(x, y)) {
                return true;
            }
        }
        for (const eZone of this.doorExitZones) {
            if (eZone && eZone.active && eZone.getBounds().contains(x, y)) {
                return true;
            }
        }
        return false;
    }

    public isPositionInCheckpointZone(x: number, y: number): boolean {
        return this.isPositionInSafeZone(x, y);
    }

    setupCheckpoints(rawMapObjects: any[]) {
        this.checkpoints = [];

        // 1. Gather all spawn point locations from Tiled
        const spawnPoints: { [key: string]: { x: number, y: number } } = {};
        
        rawMapObjects.forEach((obj: any) => {
            const cleanName = String(obj.name || '').trim().toLowerCase().replace(/\s+/g, '');
            const posX = obj.x + (obj.width ? obj.width / 2 : 0);
            const posY = obj.y + (obj.height ? obj.height : 0);

            if (/^(checkpoint|cp)\d*(spawn)?$/i.test(cleanName)) {
                spawnPoints[cleanName] = { x: posX, y: posY };
                spawnPoints[cleanName.replace('spawn', '')] = { x: posX, y: posY };
            }
        });

        // 2. Setup Checkpoint Trigger Zones
        rawMapObjects.forEach((obj: any) => {
            const cleanName = String(obj.name || '').trim().toLowerCase().replace(/\s+/g, '');
            const isCheckpointZone = /checkpoint(\d*)?(zone|trigger)?$/i.test(cleanName) && 
                                    (cleanName.includes('zone') || cleanName.includes('trigger') || obj.width);

            if (isCheckpointZone && !cleanName.endsWith('spawn')) {
                const zW = obj.width || 32;
                const zH = (obj.height || 48) + 80;
                const zX = obj.x + (obj.width ? obj.width / 2 : 16);
                const zY = obj.y + (obj.height ? obj.height / 2 : 16) - 40;

                let cpId: number | string = 1;
                if (obj.properties) {
                    const idProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'id' || p.name.toLowerCase() === 'checkpoint'));
                    if (idProp && idProp.value !== undefined) {
                        cpId = idProp.value;
                    }
                } else {
                    const match = cleanName.match(/\d+/);
                    if (match) {
                        cpId = parseInt(match[0], 10);
                    }
                }

                let targetSpawnKey = `checkpoint${cpId}`.toLowerCase();
                let label = `CHECKPOINT ${cpId} SAVED!`;

                if (obj.properties) {
                    const targetProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'target' || p.name.toLowerCase() === 'spawn'));
                    if (targetProp && targetProp.value) {
                        targetSpawnKey = String(targetProp.value).toLowerCase().trim().replace(/\s+/g, '');
                    }

                    const labelProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'label' || p.name.toLowerCase() === 'text'));
                    if (labelProp && labelProp.value) {
                        label = String(labelProp.value);
                    }
                }

                let sX = zX, sY = zY + (zH / 2);
                const matchedSpawn = spawnPoints[targetSpawnKey] || 
                                     spawnPoints[`checkpoint${cpId}`] ||
                                     spawnPoints[`checkpoint${cpId}spawn`];

                if (matchedSpawn) {
                    sX = matchedSpawn.x;
                    sY = matchedSpawn.y;
                }

                const zone = this.scene.add.zone(zX, zY, zW, zH);
                this.scene.physics.add.existing(zone, true);

                this.checkpoints.push({
                    id: cpId,
                    zone,
                    spawnX: sX,
                    spawnY: sY,
                    label,
                    activated: false
                });
            }
        });
    }

    setupFakeGround(rawMapObjects: any[]) {
        rawMapObjects.filter((obj: any) => 
            obj.name === 'FakeGround' || 
            obj.name === 'IllusoryWall' || 
            obj.name === 'SecretGround'
        ).forEach((obj: any) => {
            const x = obj.x || 0;
            const y = obj.y || 0;
            const width = obj.width || 32;
            const height = obj.height || 32;

            const tileSprite = this.scene.add.tileSprite(x, y, width, height, 'plain-ground')
                .setOrigin(0, 0)
                .setDepth(6);

            const bounds = new Phaser.Geom.Rectangle(x, y, width, height);
            this.fakeGrounds.push({ tileSprite, bounds });
        });
    }

    setupWindZones(rawMapObjects: any[]) {
        rawMapObjects.filter((obj: any) => 
            obj.name === 'WindZone' || 
            obj.name === 'AirCurrent' || 
            obj.name === 'Wind'
        ).forEach((obj: any) => {
            const zX = obj.x + (obj.width ? obj.width / 2 : 16);
            const zY = obj.y + (obj.height ? obj.height / 2 : 16);
            const zW = obj.width || 64;
            const zH = obj.height || 64;

            let forceX = 0;
            let forceY = -220;
            let turbulence = 0;
            let frequency = 2.5;
            let color = 0xbae6fd;

            if (obj.properties) {
                const fx = obj.properties.find((p: any) => p.name.toLowerCase() === 'forcex' || p.name.toLowerCase() === 'fx');
                if (fx) forceX = Number(fx.value);

                const fy = obj.properties.find((p: any) => p.name.toLowerCase() === 'forcey' || p.name.toLowerCase() === 'fy');
                if (fy) forceY = Number(fy.value);

                const turb = obj.properties.find((p: any) => p.name.toLowerCase() === 'turbulence' || p.name.toLowerCase() === 'turb' || p.name.toLowerCase() === 'oscillation');
                if (turb) turbulence = Number(turb.value);

                const freq = obj.properties.find((p: any) => p.name.toLowerCase() === 'frequency' || p.name.toLowerCase() === 'freq');
                if (freq) frequency = Number(freq.value);

                const colProp = obj.properties.find((p: any) => p.name.toLowerCase() === 'color');
                if (colProp) color = Number(colProp.value);
            }

            const zone = this.scene.add.zone(zX, zY, zW, zH);
            this.scene.physics.add.existing(zone, true);

            const angle = Phaser.Math.RadToDeg(Math.atan2(forceY, forceX !== 0 ? forceX : (turbulence > 0 ? 30 : 0)));
            const baseSpeed = Math.min(300, Math.max(80, Math.sqrt(forceX * forceX + forceY * forceY + turbulence * turbulence)));

            const emitter = this.scene.add.particles(zX, zY, 'wind-particle', {
                x: { min: -zW / 2, max: zW / 2 },
                y: { min: -zH / 2, max: zH / 2 },
                speed: baseSpeed,
                angle: { min: angle - 18, max: angle + 18 },
                scale: { start: 0.8, end: 0.2 },
                alpha: { start: 0.5, end: 0 },
                lifespan: Math.max(300, Math.min(1000, (Math.max(zW, zH) / baseSpeed) * 1000)),
                frequency: 50,
                tint: color
            }).setDepth(2.8);

            this.windZones.push({ zone, forceX, forceY, turbulence, frequency, emitter });
        });
    }

    setupDoors(rawMapObjects: any[]) {
        this.doorExitZones = [];
        const exitObject = rawMapObjects.find((obj: any) => obj.name === 'DoorExit');
        if (exitObject) {
            this.doorExitX = exitObject.x + (exitObject.width ? exitObject.width / 2 : 0);
            this.doorExitY = exitObject.y + (exitObject.height ? exitObject.height : 0);

            const eW = exitObject.width || 32;
            const eH = (exitObject.height || 48) + 64;
            const eX = exitObject.x + (exitObject.width ? exitObject.width / 2 : 16);
            const eY = exitObject.y + (exitObject.height ? exitObject.height / 2 : 24) - 32;
            const exitZone = this.scene.add.zone(eX, eY, eW, eH);
            this.scene.physics.add.existing(exitZone, true);
            this.doorExitZones.push(exitZone);
        }
        
        this.doorZones = [];
        rawMapObjects.filter((obj: any) => obj.name === 'DoorZone' || obj.name === 'DoorEntrance').forEach((obj: any) => {
            const zW = obj.width || 32;
            const zH = (obj.height || 48) + 64;
            const zX = obj.x + (obj.width ? obj.width / 2 : 16);
            const zY = obj.y + (obj.height ? obj.height / 2 : 24) - 32;
            const zone = this.scene.add.zone(zX, zY, zW, zH);
            this.scene.physics.add.existing(zone, true); 
            this.doorZones.push(zone);
        });
    }

    setupGunDisarmZones(rawMapObjects: any[]) {
        rawMapObjects.filter((obj: any) => 
            obj.name === 'GunDisarmZone' || 
            obj.name === 'DisarmZone' || 
            obj.name === 'RemoveGunZone'
        ).forEach((obj: any) => {
            const zX = obj.x + (obj.width ? obj.width / 2 : 0);
            const zY = obj.y + (obj.height ? obj.height / 2 : 0);
            const zW = obj.width || 32;
            const zH = obj.height || 48;
            const zone = this.scene.add.zone(zX, zY, zW, zH);
            this.scene.physics.add.existing(zone, true);
            this.disarmZones.push(zone);
        });
    }

    setupMovingPlatforms(map: Phaser.Tilemaps.Tilemap, rawMapObjects: any[]) {
        const platformObjects = map.createFromObjects('Objects', { name: 'MovingPlatform', key: 'moving-platform-img' });
        const rawPlatforms = rawMapObjects.filter((o: any) => o.name === 'MovingPlatform');

        platformObjects.forEach((obj: any, index: number) => {
            const rawObj = rawPlatforms[index];
            if (rawObj && rawObj.gid && map.tilesets) {
                const tileset = map.tilesets.find(t => rawObj.gid >= t.firstgid && rawObj.gid < t.firstgid + t.total);
                if (tileset && this.scene.textures.exists(tileset.name)) {
                    obj.setTexture(tileset.name);
                }
            }

            this.scene.physics.add.existing(obj);
            const platBody = obj.body as Phaser.Physics.Arcade.Body;
            platBody.allowGravity = false; 
            platBody.immovable = true;     
            
            // Tighten hitbox to match visible platform pixels (removing transparent top/bottom padding)
            if (obj.texture && (obj.texture.key === 'wooden moving platform' || obj.texture.key === 'moving-platform-img')) {
                platBody.setSize(obj.width, 12).setOffset(0, 10);
            } else if (obj.texture && obj.texture.key === 'moving-platform') {
                platBody.setSize(obj.width, 18).setOffset(0, 6);
            } else {
                platBody.setSize(obj.width, 12).setOffset(0, 10);
            }     
            
            let platSpeed = 250;
            let platDistance = 150;
            let platDirection = 1;
            let platFriction = 1;

            if (rawObj && rawObj.properties) {
                const speedProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'speed');
                if (speedProp && speedProp.value !== undefined) {
                    platSpeed = Math.abs(Number(speedProp.value));
                }

                const distProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'distance' || p.name.toLowerCase() === 'dist');
                if (distProp && distProp.value !== undefined) {
                    platDistance = Math.abs(Number(distProp.value));
                }

                const dirProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'direction' || p.name.toLowerCase() === 'dir');
                if (dirProp && dirProp.value !== undefined) {
                    const val = String(dirProp.value).toLowerCase().trim();
                    if (val === 'left' || val === '-1') platDirection = -1;
                    else if (val === 'right' || val === '1') platDirection = 1;
                }

                const frictionProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'friction');
                if (frictionProp && frictionProp.value !== undefined) {
                    platFriction = Number(frictionProp.value);
                }
            }
            
            let minX = obj.x;
            let maxX = obj.x + platDistance;

            if (platDirection === -1) {
                minX = obj.x - platDistance;
                maxX = obj.x;
            }

            platBody.setVelocityX(platSpeed * platDirection); 
            platBody.setFriction(platFriction, 0); 
            obj.setData('startX', obj.x);
            obj.setData('minX', minX);
            obj.setData('maxX', maxX);
            obj.setData('speed', platSpeed); 
            obj.setData('distance', platDistance);
            obj.setData('initialDirection', platDirection);
            this.movingPlatforms.push(obj);
        });

        if (this.movingPlatforms.length > 0) {
            this.scene.physics.add.collider(this.player, this.movingPlatforms, (_p, plat) => {
                const pBody = (_p as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
                const platBody = (plat as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
                if (pBody.bottom <= platBody.top + 4) this.player.isOnPlatform = true;
            });
        }
    }

    setupJumpPads(map: Phaser.Tilemaps.Tilemap, rawMapObjects: any[]) {
        const rawPads = rawMapObjects.filter((o: any) => {
            const name = (o.name || '').toLowerCase();
            const type = (o.type || '').toLowerCase();
            const className = (o.class || '').toLowerCase();
            return name === 'jumppad' || name === 'jump-pad' || name === 'jump_pad' || name === 'pad' ||
                   type === 'jumppad' || type === 'jump-pad' || className === 'jumppad' || className === 'jump-pad';
        });

        rawPads.forEach((rawObj: any) => {
            let textureKey = 'jump-pad-img';
            let frameIndex: number | string | undefined = undefined;

            if (rawObj.gid && map && map.tilesets) {
                const cleanGid = rawObj.gid & 0x1FFFFFFF;
                const tileset = map.tilesets.find((t: any) => cleanGid >= t.firstgid && cleanGid < t.firstgid + t.total);
                if (tileset) {
                    const localId = cleanGid - tileset.firstgid;
                    const tilesetKeyMap: Record<string, string> = {
                        'LevelObjectTiles': 'levelobjects',
                        'levelobjects': 'levelobjects',
                        'LandTiles_32_32': 'landtiles',
                        'landtiles': 'landtiles',
                        'sky': 'sky',
                        'clouds1': 'clouds1',
                        'cloud2': 'cloud2',
                        'smallTree': 'smallTree',
                        'largeTree': 'largeTree',
                        'grass': 'grass',
                        'cherry blossom': 'cherry blossom',
                        'well': 'well',
                        'water': 'water',
                        'lava': 'lava',
                        'moving-platform': 'moving-platform',
                        'moving-platform-img': 'moving-platform-img',
                        'wooden moving platform': 'wooden moving platform',
                        'jump-pad': 'jump-pad-img',
                        'jump-pad-img': 'jump-pad-img',
                        'dandelion': 'dandelion',
                        'dandelion flower sprite': 'dandelion',
                        'plain-ground': 'plain-ground',
                        'bush': 'bush'
                    };

                    const resolvedKey = tilesetKeyMap[tileset.name] || tileset.name;
                    if (this.scene.textures.exists(resolvedKey)) {
                        textureKey = resolvedKey;
                        const tex = this.scene.textures.get(resolvedKey);
                        const frameKey = String(localId);
                        
                        // If texture does not already have this individual tile frame, add it dynamically from tileset coordinates
                        if (!tex.has(frameKey)) {
                            const tileW = tileset.tileWidth || 32;
                            const tileH = tileset.tileHeight || 32;
                            const srcImg = tex.getSourceImage() as HTMLImageElement;
                            const imgW = (srcImg && srcImg.width) ? srcImg.width : (tileset.columns ? tileset.columns * tileW : 96);
                            const cols = tileset.columns || Math.max(1, Math.floor(imgW / tileW));
                            const col = localId % cols;
                            const row = Math.floor(localId / cols);
                            const frameX = col * tileW;
                            const frameY = row * tileH;
                            tex.add(frameKey, 0, frameX, frameY, tileW, tileH);
                        }
                        frameIndex = frameKey;
                    }
                }
            }

            const padSprite = (frameIndex !== undefined)
                ? this.scene.physics.add.sprite(rawObj.x, rawObj.y, textureKey, frameIndex)
                : this.scene.physics.add.sprite(rawObj.x, rawObj.y, textureKey);

            padSprite.setDepth(4).setOrigin(0, 1);
            if (rawObj.width && rawObj.height) {
                padSprite.setDisplaySize(rawObj.width, rawObj.height);
            }
            
            let bouncePower = 800; 
            if (rawObj.properties) {
                if (Array.isArray(rawObj.properties)) {
                    const pProp = rawObj.properties.find((p: any) => p && p.name && p.name.toLowerCase() === 'power');
                    if (pProp && pProp.value !== undefined) bouncePower = Number(pProp.value);
                } else if (typeof rawObj.properties === 'object') {
                    if (rawObj.properties.power !== undefined) bouncePower = Number(rawObj.properties.power);
                }
            }
            padSprite.setData('bouncePower', -Math.abs(bouncePower));
            const padBody = padSprite.body as Phaser.Physics.Arcade.Body;
            padBody.setAllowGravity(false).setImmovable(true).setSize(rawObj.width || padSprite.width, rawObj.height || padSprite.height).setOffset(0, 0);
            this.jumpPads.push(padSprite);
        });

        let lastBounceTime = 0;
        this.scene.physics.add.collider(this.player, this.jumpPads, (_p, padObj) => {
            const pBody = (_p as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
            const padBody = (padObj as Phaser.GameObjects.Sprite).body as Phaser.Physics.Arcade.Body;
            const currentTime = this.scene.time.now;
            
            if ((pBody.touching.down || pBody.blocked.down || pBody.bottom <= padBody.top + 8) && (currentTime - lastBounceTime > 200)) {
                this.player.setVelocityY((padObj as Phaser.GameObjects.Sprite).getData('bouncePower'));
                this.player.isNormalJump = false; 
                this.player.ignoreGroundJumpUntil = currentTime + 150;
                lastBounceTime = currentTime;
                this.soundManager?.playJump();
            }
        });
    }

    setupFirebars(rawMapObjects: any[]) {
        const rawFirebars = rawMapObjects.filter((o: any) => o.name === 'Firebar');
        rawFirebars.forEach((obj: any) => {
            const pivotX = obj.x! + (obj.width || 0) / 2;
            const pivotY = obj.y! + (obj.height || 0) / 2;
            let length = 4;
            let rawSpeed = 0.05;
            let startAngleRad = 0;
            
            // Check Tiled properties (both array and object representations)
            if (obj.properties) {
                if (Array.isArray(obj.properties)) {
                    const lenProp = obj.properties.find((p: any) => p && p.name && p.name.toLowerCase() === 'length');
                    if (lenProp && lenProp.value !== undefined) length = Number(lenProp.value);
                    
                    const speedProp = obj.properties.find((p: any) => p && p.name && (p.name.toLowerCase() === 'speed' || p.name.toLowerCase() === 'rotationspeed'));
                    if (speedProp && speedProp.value !== undefined) rawSpeed = Number(speedProp.value);

                    const angleProp = obj.properties.find((p: any) => p && p.name && (p.name.toLowerCase() === 'startangle' || p.name.toLowerCase() === 'angle' || p.name.toLowerCase() === 'initialangle'));
                    if (angleProp && angleProp.value !== undefined) {
                        const val = Number(angleProp.value);
                        startAngleRad = val > (2 * Math.PI) ? Phaser.Math.DegToRad(val) : val;
                    }
                } else if (typeof obj.properties === 'object') {
                    if (obj.properties.length !== undefined) length = Number(obj.properties.length);
                    if (obj.properties.speed !== undefined) rawSpeed = Number(obj.properties.speed);
                    if (obj.properties.startAngle !== undefined || obj.properties.angle !== undefined) {
                        const val = Number(obj.properties.startAngle ?? obj.properties.angle);
                        startAngleRad = val > (2 * Math.PI) ? Phaser.Math.DegToRad(val) : val;
                    }
                }
            }

            // Normalize Speed:
            // If user enters a multiplier (e.g. 1.0 = normal, 2.0 = double fast, -1.0 = reverse): scale by 0.05 baseline
            // If user enters direct radians step (e.g. 0.05, 0.08, 0.025, -0.05): use directly
            const speed = Math.abs(rawSpeed) >= 0.5 ? rawSpeed * 0.05 : rawSpeed;
            
            const scaleRatio = Math.max(0.5, (length * 16) / 31);
            const sprite = this.scene.add.sprite(pivotX, pivotY, 'firebar-sprite');
            // Exact center of the bottom hook: pixel (15.5, 48.5) in 32x64 frame
            sprite.setOrigin(15.5 / 32, 48.5 / 64);
            sprite.setScale(1, scaleRatio);
            sprite.setDepth(5);
            sprite.play('firebar-spin');
            sprite.setRotation(startAngleRad + Math.PI / 2);

            const barLength = 31 * scaleRatio;
            this.firebars.push({ pivotX, pivotY, angle: startAngleRad, speed, sprite, barLength });
        });
    }

    setupSmashTriggers(map: Phaser.Tilemaps.Tilemap) {
        const objectLayer = map.getObjectLayer('Objects');
        if (objectLayer) {
            objectLayer.objects.filter((obj: any) => obj.name === 'SmashTrigger').forEach((obj: any) => {
                const zone = this.scene.add.zone(obj.x! + (obj.width! / 2), obj.y! + (obj.height! / 2), obj.width!, obj.height!);
                this.smashTriggers.push(zone);
            });
        }
    }

    setupDandelions(rawMapObjects: any[]) {
        this.dandelions = [];
        rawMapObjects.filter((obj: any) => {
            const name = String(obj.name || '').trim().toLowerCase();
            const type = String(obj.type || '').trim().toLowerCase();
            return name === 'dandelion' || type === 'dandelion' || name.startsWith('dandelion');
        }).forEach((obj: any) => {
            const posX = obj.x || 0;
            // Tiled objects with GID (tile objects) have origin at bottom-left (y is bottom)
            const hasGid = obj.gid !== undefined;
            const originY = hasGid ? 1 : 0;
            const posY = obj.y || 0;

            let depth = 2.5;
            let animSpeed = 6;

            if (obj.properties) {
                if (Array.isArray(obj.properties)) {
                    const depthProp = obj.properties.find((p: any) => p && p.name && p.name.toLowerCase() === 'depth');
                    if (depthProp && depthProp.value !== undefined) depth = Number(depthProp.value);

                    const speedProp = obj.properties.find((p: any) => p && p.name && (p.name.toLowerCase() === 'speed' || p.name.toLowerCase() === 'fps'));
                    if (speedProp && speedProp.value !== undefined) animSpeed = Number(speedProp.value);
                } else if (typeof obj.properties === 'object') {
                    if (obj.properties.depth !== undefined) depth = Number(obj.properties.depth);
                    if (obj.properties.speed !== undefined) animSpeed = Number(obj.properties.speed);
                }
            }

            const sprite = this.scene.add.sprite(posX, posY, 'dandelion')
                .setOrigin(0, originY)
                .setDepth(depth);

            // Optional custom scaling if specified in Tiled
            if (obj.width && obj.height && (obj.width !== 32 || obj.height !== 32)) {
                sprite.setDisplaySize(obj.width, obj.height);
            }

            // Stagger start frame randomly so multiple dandelions sway naturally out of sync
            const startFrame = Math.floor(Math.random() * 4);
            sprite.play({
                key: 'dandelion-sway',
                startFrame: startFrame,
                frameRate: animSpeed,
                repeat: -1
            });

            this.dandelions.push(sprite);
        });
    }

    update(delta: number = 16.667) {
        const deltaFactor = Math.min(delta / 16.6667, 3.0); // Normalized 60Hz delta scale
        const cam = this.scene.cameras.main;
        const camLeft = cam.scrollX - 200;
        const camRight = cam.scrollX + cam.width + 200;
        const pBounds = this.player.getBounds();
        const pBody = this.player.body as Phaser.Physics.Arcade.Body;

        this.firebars.forEach(bar => {
            bar.angle += bar.speed * deltaFactor;
            bar.sprite.setRotation(bar.angle + Math.PI / 2);

            // Only update collision if near the camera view
            if (bar.pivotX >= camLeft && bar.pivotX <= camRight && this.player && this.player.active) {
                const tipX = bar.pivotX + Math.cos(bar.angle) * bar.barLength;
                const tipY = bar.pivotY + Math.sin(bar.angle) * bar.barLength;
                
                // Pixel-accurate player body bounds (inset slightly to ignore empty border padding)
                const playerRect = new Phaser.Geom.Rectangle(
                    pBody.x + 2, 
                    pBody.y + 2, 
                    Math.max(1, pBody.width - 4), 
                    Math.max(1, pBody.height - 4)
                );
                const fireLine = new Phaser.Geom.Line(bar.pivotX, bar.pivotY, tipX, tipY);

                let isHit = Phaser.Geom.Intersects.LineToRectangle(fireLine, playerRect);
                if (!isHit) {
                    // Check flame pixel thickness (3.5px radius strictly along the rotating firebar)
                    const sampleCount = 6;
                    for (let s = 1; s <= sampleCount; s++) {
                        const dist = (bar.barLength * s) / sampleCount;
                        const sampleX = bar.pivotX + Math.cos(bar.angle) * dist;
                        const sampleY = bar.pivotY + Math.sin(bar.angle) * dist;
                        if (Phaser.Geom.Intersects.CircleToRectangle(new Phaser.Geom.Circle(sampleX, sampleY, 3.5), playerRect)) {
                            isHit = true;
                            break;
                        }
                    }
                }

                if (isHit) {
                    this.player.die();
                }
            }
        });

        this.movingPlatforms.forEach(plat => {
            const platBody = plat.body as Phaser.Physics.Arcade.Body;
            const minX = plat.getData('minX') as number;
            const maxX = plat.getData('maxX') as number;
            const platSpeed = plat.getData('speed') as number;

            if (plat.x >= maxX) {
                platBody.setVelocityX(-platSpeed);
            } else if (plat.x <= minX) {
                platBody.setVelocityX(platSpeed);
            }
        });
        const currentTime = this.scene.time.now;

        // Handle Custom Checkpoint Zones
        for (const cp of this.checkpoints) {
            if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, cp.zone.getBounds())) {
                if (!cp.activated) {
                    cp.activated = true;
                    this.player.spawnX = cp.spawnX;
                    this.player.spawnY = cp.spawnY;
                    this.player.activeSpawnX = cp.spawnX;
                    this.player.activeSpawnY = cp.spawnY;
                    this.player.lastSafeX = cp.spawnX;
                    this.player.lastSafeY = cp.spawnY;

                    this.scene.cameras.main.flash(200, 255, 255, 255);
                    this.uiManager.showFloatingText(cp.spawnX, cp.spawnY - 20, cp.label, '#FFD700', 2500, 30);
                    this.uiManager.spawnParticles(cp.spawnX, cp.spawnY, 0xFFD700);
                    this.soundManager?.playCheckpoint();

                    // Snapshot collected items and killed mobs up to this checkpoint
                    this.scene.events.emit('checkpoint-saved');
                }
            }
        }

        // Handle FakeGround / Illusory Walls
        for (const fake of this.fakeGrounds) {
            const isInside = Phaser.Geom.Intersects.RectangleToRectangle(pBounds, fake.bounds);
            if (isInside) {
                fake.tileSprite.setAlpha(0);
            } else {
                fake.tileSprite.setAlpha(1);
            }
        }

        // Apply Environmental Wind Zone Forces
        for (const wind of this.windZones) {
            if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, wind.zone.getBounds())) {
                let currentForceX = wind.forceX;
                if (wind.turbulence > 0) {
                    currentForceX += Math.sin(currentTime * 0.003 * wind.frequency) * wind.turbulence;
                }

                if (currentForceX !== 0) {
                    pBody.velocity.x += currentForceX * 0.05;
                }
                if (wind.forceY !== 0) {
                    pBody.velocity.y += wind.forceY * 0.05;
                }
            }
        }

        // Handle Teleport Door (Standard Door Teleporter without checkpoint lock)
        let isPlayerInDoor = false;
        for (const zone of this.doorZones) {
            if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, zone.getBounds())) {
                isPlayerInDoor = true;
                break;
            }
        }
        this.player.isNearDoor = isPlayerInDoor;

        if (isPlayerInDoor) {
            // Display sleek "E to enter" floating prompt above player
            if (!this.doorPrompt) {
                const bg = this.scene.add.graphics();
                bg.fillStyle(0x0f172a, 0.9);
                bg.fillRoundedRect(-48, -14, 96, 28, 8);
                bg.lineStyle(1.5, 0x38bdf8, 0.95);
                bg.strokeRoundedRect(-48, -14, 96, 28, 8);

                const txt = this.scene.add.text(0, 0, 'E to enter', {
                    fontSize: '13px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#f8fafc',
                    fontStyle: 'bold'
                }).setOrigin(0.5);

                this.doorPrompt = this.scene.add.container(this.player.x, this.player.y - 36, [bg, txt]);
                this.doorPrompt.setDepth(30);
            } else {
                this.doorPrompt.setPosition(this.player.x, this.player.y - 36);
            }
        } else {
            if (this.doorPrompt) {
                this.doorPrompt.destroy();
                this.doorPrompt = undefined;
            }
        }

        const enterPressed = Phaser.Input.Keyboard.JustDown(this.player.keyE) ||
                             Phaser.Input.Keyboard.JustDown(this.player.enterKey) ||
                             Phaser.Input.Keyboard.JustDown(this.player.cursors.up) ||
                             (this.player.keyW && Phaser.Input.Keyboard.JustDown(this.player.keyW));

        if (isPlayerInDoor && enterPressed && this.doorExitX !== 0) {
            if (this.doorPrompt) {
                this.doorPrompt.destroy();
                this.doorPrompt = undefined;
            }
            this.player.isNearDoor = false;
            this.player.setPosition(this.doorExitX, this.doorExitY); 
            this.player.setVelocity(0, 0);
            this.scene.cameras.main.flash(150, 255, 255, 255);
            this.uiManager.spawnParticles(this.doorExitX, this.doorExitY, 0x38BDF8);
            this.soundManager?.playTeleport();
        }

        // Handle Gun Disarm Zones
        if (this.player.hasGun || this.inventoryManager.gunCount > 0) {
            for (const zone of this.disarmZones) {
                if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, zone.getBounds())) {
                    this.inventoryManager.disarmGun();
                    this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'GUN DISARMED', '#00FFFF');
                    this.uiManager.spawnParticles(this.player.x, this.player.y, 0x00FFFF);
                    this.scene.cameras.main.shake(150, 0.005);
                    break;
                }
            }
        }

        // Handle Smash Triggers
        let touchingTrigger = false;
        this.smashTriggers.forEach(zone => {
            const pRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
            if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, zone.getBounds())) touchingTrigger = true;
        });

        if (touchingTrigger) this.player.canSmash = true; 
        else if (pBody.blocked.down) this.player.canSmash = false; 
    }

    resetAll() {
        for (const fake of this.fakeGrounds) {
            fake.tileSprite.setAlpha(1);
        }

        this.movingPlatforms.forEach(plat => {
            const startX = plat.getData('startX') as number;
            const platSpeed = plat.getData('speed') as number;
            const initDir = (plat.getData('initialDirection') as number) || 1;
            plat.setPosition(startX, plat.y);
            (plat.body as Phaser.Physics.Arcade.Body).setVelocityX(platSpeed * initDir);
        });
    }

    resetCheckpoints() {
        this.checkpoints.forEach(cp => {
            cp.activated = false;
        });
    }
}
