// src/managers/EnemyManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';
import { SoundManager } from './SoundManager';

export class EnemyManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;
    private soundManager?: SoundManager;

    public groundMobs: Phaser.Physics.Arcade.Group;
    public pipeMonsters: Phaser.Physics.Arcade.Group;
    public enemiesKilled: number = 0;

    private rawMapObjects: any[] = [];
    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private oneWayLayer!: Phaser.Tilemaps.TilemapLayer;
    private map!: Phaser.Tilemaps.Tilemap;

    constructor(scene: Phaser.Scene, player: Player, uiManager: UIManager, soundManager?: SoundManager) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
        this.soundManager = soundManager;

        this.groundMobs = this.scene.physics.add.group();
        this.pipeMonsters = this.scene.physics.add.group({ allowGravity: false, immovable: true });
    }

    setupGroundMobs(rawMapObjects: any[], groundLayer: Phaser.Tilemaps.TilemapLayer, oneWayLayer: Phaser.Tilemaps.TilemapLayer) {
        this.rawMapObjects = rawMapObjects;
        this.groundLayer = groundLayer;
        this.oneWayLayer = oneWayLayer;

        this.scene.physics.add.collider(this.groundMobs, groundLayer);
        this.scene.physics.add.collider(this.groundMobs, oneWayLayer);
        this.scene.physics.add.overlap(this.player, this.groundMobs, this.handlePlayerMobCollision, undefined, this);

        this.scene.physics.add.overlap(this.player.bullets, this.groundMobs, (bulletObj, mobObj) => {
            bulletObj.destroy();
            this.killMob(mobObj as Phaser.Physics.Arcade.Sprite, 'shoot');
        });

        this.spawnGroundMobs();
    }

    private spawnGroundMobs() {
        this.groundMobs.clear(true, true);

        const mobObjects = this.rawMapObjects.filter((o: any) => o.name === 'GroundMob');
        
        mobObjects.forEach((obj: any) => {
            let rawType = 'bug';
            let mobSpeed = 75;

            if (obj.properties) {
                const typeProp = obj.properties.find((p: any) => p.name && p.name.toLowerCase() === 'type');
                if (typeProp && typeProp.value !== undefined) rawType = String(typeProp.value).toLowerCase().trim();

                const speedProp = obj.properties.find((p: any) => p.name && p.name.toLowerCase() === 'speed');
                if (speedProp && speedProp.value !== undefined) mobSpeed = Number(speedProp.value) || 75;
            }

            // Map Tiled types: 'bug' / 'green-bug' -> 'bug-green', 'yellow-bug' / 'bug-yellow' -> 'bug-yellow', 'devil', 'hedgehog'
            let mobType = 'bug-green';
            if (rawType.includes('devil')) {
                mobType = 'devil';
            } else if (rawType.includes('hedgehog')) {
                mobType = 'hedgehog';
            } else if (rawType.includes('yellow')) {
                mobType = 'bug-yellow';
            } else {
                mobType = 'bug-green';
            }

            // Coordinate conversion from Tiled:
            let spawnX = obj.x;
            let spawnY = obj.y;

            if (obj.gid === undefined && obj.width && obj.height) {
                // Tiled Rectangle Object: (x, y) is top-left
                spawnX = obj.x + (obj.width / 2);
                spawnY = obj.y + obj.height;
            } else if (obj.gid !== undefined) {
                // Tiled Tile Object: (x, y) is bottom-left
                spawnX = obj.x + ((obj.width || 0) / 2);
                spawnY = obj.y;
            } else {
                // Tiled Point Object
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
            
            // Hitbox adjusted for 42x30 sprite (24x24 body, flush with bottom)
            const body = mob.body as Phaser.Physics.Arcade.Body;
            body.setSize(24, 24);
            body.setOffset(9, 6);
            body.setCollideWorldBounds(true);
            
            if (this.scene.anims.exists(initialAnim)) {
                mob.play(initialAnim);
            }
            
            mob.setData('direction', initialDir);
            mob.setData('speed', mobSpeed); 
            mob.setData('type', mobType); 
        });
    }

    setupPipeMonsters(map: Phaser.Tilemaps.Tilemap) {
        this.map = map;

        // Player vs Pipe Monsters overlap
        this.scene.physics.add.overlap(this.player, this.pipeMonsters, (_p, monsterObj) => {
            const monster = monsterObj as Phaser.GameObjects.Sprite;
            const restingY = monster.getData('restingY') as number;
            // Kill player when monster has popped up from pipe
            if (monster.y <= restingY - 6) {
                this.player.die();
            }
        });

        // Bullets vs Pipe Monsters overlap
        this.scene.physics.add.overlap(this.player.bullets, this.pipeMonsters, (bulletObj, monsterObj) => {
            const monster = monsterObj as Phaser.GameObjects.Sprite;
            const restingY = monster.getData('restingY') as number;
            if (monster.y <= restingY - 6) {
                bulletObj.destroy();
                this.uiManager.showFloatingText(monster.x, monster.y - 10, 'SPLAT!', '#8B0000');
                this.uiManager.spawnParticles(monster.x, monster.y, 0x8B0000);
                this.pipeMonsters.remove(monster, true, true);
                this.enemiesKilled++;
                this.soundManager?.playStomp();
            }
        });

        this.spawnPipeMonsters();
    }

    private spawnPipeMonsters() {
        this.pipeMonsters.clear(true, true);

        const monsterObjects = this.map.createFromObjects('Objects', { name: 'PipeMonster', key: 'pipe-monster' });
        monsterObjects.forEach((obj: any) => {
            this.scene.physics.add.existing(obj);
            const monsterBody = obj.body as Phaser.Physics.Arcade.Body;
            monsterBody.allowGravity = false; 
            monsterBody.immovable = true; 
            monsterBody.setSize(24, 20);
            
            obj.setData('restingY', obj.y);
            obj.setDepth(2.5);
            this.pipeMonsters.add(obj);
            this.startMonsterCycle(obj);
        });
    }

    public resetAll() {
        this.enemiesKilled = 0;
        if (this.rawMapObjects.length > 0 && this.groundLayer && this.oneWayLayer) {
            this.spawnGroundMobs();
        }
        if (this.map) {
            this.spawnPipeMonsters();
        }
    }

    private handlePlayerMobCollision = (_playerObj: any, _mobObj: any) => {
        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
        const mBody = (_mobObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;

        if (pBody.velocity.y > 0 && pBody.bottom < mBody.y + (mBody.height / 2)) {
            this.player.setVelocityY(-350); 
            this.killMob(_mobObj, 'stomp');
        } else {
            this.player.die();
        }
    }

    private killMob(mob: Phaser.Physics.Arcade.Sprite, method: 'stomp' | 'shoot') {
        this.groundMobs.remove(mob);
        const body = mob.body as Phaser.Physics.Arcade.Body;
        body.checkCollision.none = true;
        body.setCollideWorldBounds(false); // Allows mob to fall off the bottom of the world
        mob.anims.stop(); 
        mob.setVelocity(Phaser.Math.Between(-80, 80), -280); 
        mob.setAngularVelocity(Phaser.Math.Between(400, 800) * (Math.random() > 0.5 ? 1 : -1)); 
        mob.setDepth(10);
        
        this.enemiesKilled++;
        this.soundManager?.playStomp();
        
        if (method === 'stomp') {
            this.uiManager.showFloatingText(mob.x, mob.y - 10, 'STOMP!', '#ffffff');
            this.uiManager.spawnParticles(mob.x, mob.y, 0xffffff);
        } else {
            this.uiManager.showFloatingText(mob.x, mob.y - 10, 'SPLAT!', '#8B0000');
            this.uiManager.spawnParticles(mob.x, mob.y, 0x8B0000);
        }

        this.scene.time.delayedCall(1500, () => {
            if (mob.active) mob.destroy();
        });
    }

    private startMonsterCycle(monster: Phaser.GameObjects.Sprite) {
        const hideTime = Phaser.Math.Between(1000, 3000), popUpDistance = 22; 
        this.scene.time.delayedCall(hideTime, () => {
            if (!monster.active) return;
            this.scene.tweens.add({ 
                targets: monster, y: monster.y - popUpDistance, duration: 250, ease: 'Sine.easeOut', 
                onComplete: () => {
                    if (!monster.active) return;
                    this.scene.time.delayedCall(Phaser.Math.Between(600, 1600), () => {
                        if (!monster.active) return;
                        this.scene.tweens.add({ 
                            targets: monster, y: monster.y + popUpDistance, duration: 250, ease: 'Sine.easeIn', 
                            onComplete: () => this.startMonsterCycle(monster) 
                        });
                    });
                }
            });
        });
    }

    update(groundLayer: Phaser.Tilemaps.TilemapLayer, oneWayLayer: Phaser.Tilemaps.TilemapLayer) {
        this.groundMobs.getChildren().forEach(child => {
            const mob = child as Phaser.Physics.Arcade.Sprite;
            if (!mob.active) return;
            
            let dir = mob.getData('direction') as number;
            const speed = mob.getData('speed') as number;
            const mobType = mob.getData('type') as string;
            const body = mob.body as Phaser.Physics.Arcade.Body;
            
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
        });
    }
}
