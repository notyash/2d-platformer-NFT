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
    public disarmZones: Phaser.GameObjects.Zone[] = [];
    public windZones: WindZoneData[] = [];
    public fakeGrounds: FakeGroundData[] = [];
    public checkpoints: CheckpointData[] = [];

    public doorExitX: number = 0;
    public doorExitY: number = 0;

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

    setupCheckpoints(rawMapObjects: any[]) {
        this.checkpoints = [];

        // 1. Gather all spawn point locations from Tiled
        const spawnPoints: { [key: string]: { x: number, y: number } } = {};
        
        rawMapObjects.forEach((obj: any) => {
            const cleanName = String(obj.name || '').trim().toLowerCase().replace(/\s+/g, '');
            const posX = obj.x + (obj.width ? obj.width / 2 : 0);
            const posY = obj.y + (obj.height ? obj.height : 0);

            // Matches Checkpoint1, Checkpoint2, Checkpoint3, Checkpoint1Spawn, etc.
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
                const zX = obj.x + (obj.width ? obj.width / 2 : 16);
                const zY = obj.y + (obj.height ? obj.height / 2 : 16);
                const zW = obj.width || 32;
                const zH = obj.height || 48;

                // Priority 1: Check if 'id' property is specified in Tiled
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

                // Match with target spawn point or fallback to zone position
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
        const exitObject = rawMapObjects.find((obj: any) => obj.name === 'DoorExit');
        if (exitObject) {
            this.doorExitX = exitObject.x + (exitObject.width ? exitObject.width / 2 : 0);
            this.doorExitY = exitObject.y + (exitObject.height ? exitObject.height : 0);
        }
        
        rawMapObjects.filter((obj: any) => obj.name === 'DoorZone').forEach((obj: any) => {
            const zX = obj.x + (obj.width ? obj.width / 2 : 0);
            const zY = obj.y + (obj.height ? obj.height / 2 : 0);
            const zW = obj.width || 32;
            const zH = obj.height || 48;
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
            this.scene.physics.add.existing(obj);
            const platBody = obj.body as Phaser.Physics.Arcade.Body;
            platBody.allowGravity = false; 
            platBody.immovable = true;     
            
            let platSpeed = 250;
            let platDistance = 150;
            let platDirection = 1;
            let platFriction = 1;

            const rawObj = rawPlatforms[index];
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
                if (pBody.bottom <= platBody.top + 2) this.player.isOnPlatform = true;
            });
        }
    }

    setupJumpPads(rawMapObjects: any[]) {
        const rawPads = rawMapObjects.filter((o: any) => o.name === 'JumpPad');
        rawPads.forEach((rawObj: any) => {
            const padSprite = this.scene.physics.add.sprite(rawObj.x, rawObj.y, 'jump-pad-img').setDepth(4).setOrigin(0, 1);
            if (rawObj.width) padSprite.setDisplaySize(rawObj.width, rawObj.height);
            
            let bouncePower = 800; 
            if (rawObj.properties) {
                const pProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'power');
                if (pProp) bouncePower = Number(pProp.value);
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
            
            if (pBody.touching.down && padBody.touching.up && (currentTime - lastBounceTime > 300)) {
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
            let length = 5, speed = 0.05; 
            
            if (obj.properties) {
                const lenProp = obj.properties.find((p: any) => p.name.toLowerCase() === 'length');
                if (lenProp) length = Number(lenProp.value);
                const speedProp = obj.properties.find((p: any) => p.name.toLowerCase() === 'speed');
                if (speedProp) speed = Number(speedProp.value);
            }
            
            const segments: Phaser.GameObjects.Sprite[] = [], distances: number[] = [];
            for (let i = 0; i < length; i++) {
                const dist = (i + 1) * 16; 
                const segment = this.scene.physics.add.sprite(pivotX + dist, pivotY, 'fireball');
                segment.setDepth(5);
                
                const segBody = segment.body as Phaser.Physics.Arcade.Body;
                segBody.setAllowGravity(false).setImmovable(true).setCircle(6, 2, 2); 
                
                segments.push(segment); 
                distances.push(dist);
                
                this.scene.physics.add.overlap(this.player, segment, () => this.player.die());
            }
            this.firebars.push({ pivotX, pivotY, angle: 0, speed, segments, distances });
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

    update() {
        this.firebars.forEach(bar => {
            bar.angle += bar.speed; 
            for (let i = 0; i < bar.segments.length; i++) {
                bar.segments[i].setPosition(
                    bar.pivotX + Math.cos(bar.angle) * bar.distances[i],
                    bar.pivotY + Math.sin(bar.angle) * bar.distances[i]
                );
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

        const pBounds = this.player.getBounds();
        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
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
                    this.uiManager.showFloatingText(cp.spawnX, cp.spawnY - 20, cp.label, '#FFD700');
                    this.uiManager.spawnParticles(cp.spawnX, cp.spawnY, 0xFFD700);
                    this.soundManager?.playCheckpoint();
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

        const enterPressed = Phaser.Input.Keyboard.JustDown(this.player.enterKey) || 
                             Phaser.Input.Keyboard.JustDown(this.player.cursors.up) ||
                             (this.player.keyW && Phaser.Input.Keyboard.JustDown(this.player.keyW));

        if (isPlayerInDoor && enterPressed && this.doorExitX !== 0) {
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
