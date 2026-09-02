// src/managers/EnemyManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';

export class EnemyManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;

    public groundMobs: Phaser.Physics.Arcade.Group;
    public pipeMonsters: Phaser.GameObjects.Sprite[] = [];
    public enemiesKilled: number = 0;

    constructor(scene: Phaser.Scene, player: Player, uiManager: UIManager) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
        this.groundMobs = this.scene.physics.add.group();
    }

    setupGroundMobs(rawMapObjects: any[], groundLayer: Phaser.Tilemaps.TilemapLayer, oneWayLayer: Phaser.Tilemaps.TilemapLayer) {
        const mobObjects = rawMapObjects.filter((o: any) => o.name === 'GroundMob');
        
        mobObjects.forEach((obj: any) => {
            let mobType = 'onion'; 
            let mobSpeed = 75;

            if (obj.properties) {
                const typeProp = obj.properties.find((p: any) => p.name.toLowerCase() === 'type');
                if (typeProp) mobType = typeProp.value;

                const speedProp = obj.properties.find((p: any) => p.name.toLowerCase() === 'speed');
                if (speedProp) mobSpeed = Number(speedProp.value);
            }

            const textureKey = `mob-${mobType}`;
            const animKey = `${mobType}-walk`;

            const mob = this.groundMobs.create(obj.x, obj.y, textureKey) as Phaser.Physics.Arcade.Sprite;
            mob.setDepth(4).setOrigin(0, 1); 
            
            if (this.scene.anims.exists(animKey)) mob.play(animKey);
            
            const body = mob.body as Phaser.Physics.Arcade.Body;
            body.setCollideWorldBounds(true);
            
            mob.setData('direction', 1);
            mob.setData('speed', mobSpeed); 
            mob.setData('type', mobType); 
        });

        this.scene.physics.add.collider(this.groundMobs, groundLayer);
        this.scene.physics.add.collider(this.groundMobs, oneWayLayer);
        this.scene.physics.add.overlap(this.player, this.groundMobs, this.handlePlayerMobCollision, undefined, this);

        this.scene.physics.add.overlap(this.player.bullets, this.groundMobs, (bulletObj, mobObj) => {
            bulletObj.destroy();
            this.killMob(mobObj as Phaser.Physics.Arcade.Sprite, 'shoot');
        });
    }

    setupPipeMonsters(map: Phaser.Tilemaps.Tilemap) {
        const monsterObjects = map.createFromObjects('Objects', { name: 'PipeMonster', key: 'pipe-monster' });
        monsterObjects.forEach((obj: any) => {
            this.scene.physics.add.existing(obj);
            const monsterBody = obj.body as Phaser.Physics.Arcade.Body;
            monsterBody.allowGravity = false; 
            monsterBody.immovable = true; 
            monsterBody.setSize(24, 20);
            
            obj.setData('restingY', obj.y);
            obj.setDepth(2.5);
            this.pipeMonsters.push(obj);
            this.startMonsterCycle(obj);
        });

        this.scene.physics.add.overlap(this.player, this.pipeMonsters, () => this.player.die(), (_p, monster) => {
            return (monster as Phaser.GameObjects.Sprite).y <= (monster as Phaser.GameObjects.Sprite).getData('restingY') - 10; 
        }, this);
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
        (mob.body as Phaser.Physics.Arcade.Body).checkCollision.none = true;
        mob.anims.stop(); 
        mob.setVelocity(Phaser.Math.Between(-100, 100), -250); 
        mob.setAngularVelocity(Phaser.Math.Between(400, 800) * (Math.random() > 0.5 ? 1 : -1)); 
        
        this.enemiesKilled++;
        
        if (method === 'stomp') {
            this.uiManager.showFloatingText(mob.x, mob.y - 10, 'STOMP!', '#ffffff');
            this.uiManager.spawnParticles(mob.x, mob.y, 0xffffff);
        } else {
            this.uiManager.showFloatingText(mob.x, mob.y - 10, 'SPLAT!', '#8B0000');
            this.uiManager.spawnParticles(mob.x, mob.y, 0x8B0000);
        }

        this.scene.time.delayedCall(2000, () => mob.destroy());
    }

    private startMonsterCycle(monster: Phaser.GameObjects.Sprite) {
        const hideTime = Phaser.Math.Between(1000, 3000), popUpDistance = 20; 
        this.scene.time.delayedCall(hideTime, () => {
            this.scene.tweens.add({ 
                targets: monster, y: monster.y - popUpDistance, duration: 200, ease: 'Sine.easeOut', 
                onComplete: () => {
                    this.scene.time.delayedCall(Phaser.Math.Between(500, 1500), () => {
                        this.scene.tweens.add({ 
                            targets: monster, y: monster.y + popUpDistance, duration: 200, ease: 'Sine.easeIn', 
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
            
            let dir = mob.getData('direction');
            const speed = mob.getData('speed');
            const body = mob.body as Phaser.Physics.Arcade.Body;
            
            if (body.blocked.left || body.blocked.right) {
                dir *= -1;
            } else if (body.blocked.down) {
                const nextX = mob.x + (dir * (body.halfWidth + 4));
                const nextY = body.bottom + 2;
                
                const tile = groundLayer.getTileAtWorldXY(nextX, nextY);
                const oneWayTile = oneWayLayer.getTileAtWorldXY(nextX, nextY);
                const hasFloor = (tile && tile.index !== -1) || (oneWayTile && oneWayTile.index !== -1);
                
                if (!hasFloor) dir *= -1; 
            }
            
            mob.setData('direction', dir);
            mob.setVelocityX(speed * dir);
            mob.setFlipX(dir === -1); 
        });
    }
}