// src/managers/EnvironmentManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import type { Firebar } from '../types';

export class EnvironmentManager {
    private scene: Phaser.Scene;
    private player: Player;

    public movingPlatforms: Phaser.GameObjects.Sprite[] = [];
    public jumpPads: Phaser.GameObjects.Sprite[] = [];
    public firebars: Firebar[] = [];
    public smashTriggers: Phaser.GameObjects.Zone[] = [];

    public doorExitX: number = 0;
    public doorExitY: number = 0;

    constructor(scene: Phaser.Scene, player: Player) {
        this.scene = scene;
        this.player = player;
    }

    setupDoors(rawMapObjects: any[]) {
        const exitObject = rawMapObjects.find((obj: any) => obj.name === 'DoorExit');
        if (exitObject) { this.doorExitX = exitObject.x; this.doorExitY = exitObject.y; }
        
        rawMapObjects.filter((obj: any) => obj.name === 'DoorZone').forEach((obj: any) => {
            const zone = this.scene.add.zone(obj.x! + obj.width! / 2, obj.y! + obj.height! / 2, obj.width!, obj.height!);
            this.scene.physics.add.existing(zone, true); 
            this.scene.physics.add.overlap(this.player, zone, () => this.player.isNearDoor = true);
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
            
            let platSpeed = 250, platFriction = 1;
            const rawObj = rawPlatforms[index];
            if (rawObj && rawObj.properties) {
                const speedProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'speed');
                if (speedProp) platSpeed = speedProp.value;
                const frictionProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'friction');
                if (frictionProp && frictionProp.value !== undefined) platFriction = Number(frictionProp.value);
            }
            
            platBody.setVelocityX(platSpeed); 
            platBody.setFriction(platFriction, 0); 
            obj.setData('startX', obj.x);
            obj.setData('speed', platSpeed); 
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
            const startX = plat.getData('startX'), platSpeed = plat.getData('speed'); 
            if (plat.x > startX + 150) platBody.setVelocityX(-platSpeed);
            else if (plat.x < startX - 150) platBody.setVelocityX(platSpeed);
        });

        // Handle Door Logic
        if (this.player.isNearDoor && (this.player.body as Phaser.Physics.Arcade.Body).blocked.down && Phaser.Input.Keyboard.JustDown(this.player.enterKey)) {
            this.player.setPosition(this.doorExitX, this.doorExitY); 
            this.player.setVelocity(0, 0);
        }

        // Handle Smash Triggers
        let touchingTrigger = false;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        this.smashTriggers.forEach(zone => {
            const pRect = new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
            if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, zone.getBounds())) touchingTrigger = true;
        });

        if (touchingTrigger) this.player.canSmash = true; 
        else if (body.blocked.down) this.player.canSmash = false; 
    }
}