import Phaser from 'phaser';

type Facing = 'left' | 'right';

export class MainStageScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key; 
  private facing: Facing = 'right';
  
  private movingPlatforms: Phaser.GameObjects.Sprite[] = [];
  private pipeMonsters: Phaser.GameObjects.Sprite[] = [];
  
  // Collectibles & Powerups
  private coins: Phaser.GameObjects.Sprite[] = [];
  private tempCheckpoints: Phaser.GameObjects.Sprite[] = [];
  private gunPowerups: Phaser.GameObjects.Sprite[] = [];
  private totems: Phaser.GameObjects.Sprite[] = [];
  private bullets!: Phaser.Physics.Arcade.Group; 
  
  private isOnPlatform: boolean = false;
  
  // Main level spawn point
  private spawnX: number = 100;
  private spawnY: number = 100;
  
  // The spawn point currently active
  private activeSpawnX: number = 100;
  private activeSpawnY: number = 100;

  // Tracks the exact last safe ground the player stood on for the Totem rewind
  private lastSafeX: number = 100;
  private lastSafeY: number = 100;

  private doorExitX: number = 0;
  private doorExitY: number = 0;

  // --- LEADERBOARD STATS ---
  private startTime: number = 0;
  private coinsCollected: number = 0;
  private enemiesKilled: number = 0;
  
  // --- HUD ---
  private hudText!: Phaser.GameObjects.Text;
  
  // --- POWERUP STATES ---
  private checkpointTimer?: Phaser.Time.TimerEvent;
  
  private hasGun: boolean = false;
  private gunTimer?: Phaser.Time.TimerEvent;
  
  private hasTotem: boolean = false;
  private isInvincible: boolean = false; 

  constructor() {
    super('MainStageScene');
  }

  preload() {
    this.load.image('levelobjects', 'assets/tilesets/LevelObjectTiles.png');
    this.load.image('landtiles', 'assets/tilesets/LandTiles_32_32.png');
    this.load.image('sky', 'assets/tilesets/sky.png');
    this.load.image('clouds1', 'assets/tilesets/clouds1.png');
    this.load.image('smallTree', 'assets/tilesets/smallTree.png');
    this.load.image('largeTree', 'assets/tilesets/largeTree.png');
    this.load.image('grass', 'assets/tilesets/grass.png');
    this.load.image('cloud2', 'assets/tilesets/cloud2.png');
    this.load.tilemapTiledJSON('stage1', 'assets/tilemaps/harder-main-stage.json');

    this.load.image('moving-platform-img', 'assets/sprites/moving-platform.png');
    this.load.image('pipe-monster', 'assets/sprites/monsters/Devil_Red_Stand_L.png');
    
    // CHANGED: Updated frame dimensions to 24x24
    this.load.spritesheet('coin', 'assets/sprites/Coin_24x24_Anim.png', {
      frameWidth: 24,
      frameHeight: 24
    });

    // Other placeholders
    this.load.image('temp-checkpoint', 'assets/sprites/temp-checkpoint.png');
    this.load.image('gun-powerup', 'assets/sprites/gun-powerup.png');
    this.load.image('totem', 'assets/sprites/totem.png');
    this.load.image('bullet', 'assets/sprites/bullet.png');

    this.load.image('idle-r', 'assets/sprites/player/Melissa_Stand_R.png');
    this.load.image('idle-l', 'assets/sprites/player/Melissa_Stand_L.png');
    this.load.image('jump-r', 'assets/sprites/player/Melissa_Jump1_R.png');
    this.load.image('jump-l', 'assets/sprites/player/Melissa_Jump1_L.png');
    this.load.image('fall-r', 'assets/sprites/player/Melissa_Fall2_R.png');
    this.load.image('fall-l', 'assets/sprites/player/Melissa_Fall2_L.png');

    this.load.spritesheet('walk-r', 'assets/sprites/player/Melissa_Walk_Anim_R.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('walk-l', 'assets/sprites/player/Melissa_Walk_Anim_L.png', {
      frameWidth: 32,
      frameHeight: 32
    });
  }

  create() {
    const map = this.make.tilemap({ key: 'stage1' });

    const levelObjectsTileset = map.addTilesetImage('LevelObjectTiles', 'levelobjects');
    const landTileset = map.addTilesetImage('LandTiles_32_32', 'landtiles');
    const skyTileset = map.addTilesetImage('sky', 'sky');
    const clouds1Tileset = map.addTilesetImage('clouds1', 'clouds1');
    const cloud2Tileset = map.addTilesetImage('cloud2', 'cloud2');
    const smallTreeTileset = map.addTilesetImage('smallTree', 'smallTree');
    const largeTreeTileset = map.addTilesetImage('largeTree', 'largeTree');
    const grassTileset = map.addTilesetImage('grass', 'grass');

    if (!levelObjectsTileset || !landTileset || !skyTileset || !clouds1Tileset
      || !smallTreeTileset || !largeTreeTileset || !grassTileset || !cloud2Tileset) {
      console.error('One or more tilesets failed to load');
      return;
    }

    const allTilesets = [levelObjectsTileset, landTileset, skyTileset,
      clouds1Tileset, cloud2Tileset, smallTreeTileset, largeTreeTileset, grassTileset];

    const skyLayer = map.createLayer('Sky', allTilesets, 0, 0)
    const treesLayer = map.createLayer('Trees', allTilesets, 0, 0)
    const backgroundLayer = map.createLayer('Background', allTilesets, 0, 0);
    const groundLayer = map.createLayer('Ground', allTilesets, 0, 0);
    const oneWayLayer = map.createLayer('OneWayPlatforms', allTilesets, 0, 0);
    const hazardsLayer = map.createLayer('Hazards', allTilesets, 0, 0);
    const foregroundLayer = map.createLayer('Foreground', allTilesets, 0, 0);

    skyLayer?.setDepth(0);
    treesLayer?.setDepth(1);
    backgroundLayer?.setDepth(2);
    groundLayer?.setDepth(3);
    oneWayLayer?.setDepth(4);
    hazardsLayer?.setDepth(5);
    foregroundLayer?.setDepth(7);

    groundLayer?.setCollisionByExclusion([-1]);
    oneWayLayer?.setCollisionByExclusion([-1]);
    hazardsLayer?.setCollisionByExclusion([-1]);

    // Player Animations
    this.anims.create({
      key: 'walk-r-anim',
      frames: this.anims.generateFrameNumbers('walk-r', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
    this.anims.create({
      key: 'walk-l-anim',
      frames: this.anims.generateFrameNumbers('walk-l', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });

    // Coin Animation
    this.anims.create({
      key: 'coin-spin',
      frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 7 }), 
      frameRate: 10,
      repeat: -1 
    });

    const spawnObject = map.getObjectLayer('Objects')?.objects.find(obj => obj.name === 'Spawn');
    if (spawnObject && spawnObject.x !== undefined && spawnObject.y !== undefined) {
      this.spawnX = spawnObject.x;
      this.spawnY = spawnObject.y;
      this.activeSpawnX = this.spawnX;
      this.activeSpawnY = this.spawnY;
      this.lastSafeX = this.spawnX;
      this.lastSafeY = this.spawnY;
    }

    this.player = this.physics.add.sprite(this.activeSpawnX, this.activeSpawnY, 'idle-r');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(4); 
    this.player.setBodySize(14, 24);
    this.player.setOffset(9, 8);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // --- LEADERBOARD & HUD SETUP ---
    this.startTime = this.time.now;
    this.hudText = this.add.text(16, 16, 'Time: 0s | Coins: 0 | Kills: 0', { 
      fontSize: '20px', 
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.hudText.setScrollFactor(0);
    this.hudText.setDepth(10); 
    
    // Create Bullet Group
    this.bullets = this.physics.add.group({ allowGravity: false });
    if (groundLayer) {
      this.physics.add.collider(this.bullets, groundLayer, (bullet) => bullet.destroy());
    }

    // --- Door Teleport Setup ---
    const exitObject = map.getObjectLayer('Objects')?.objects.find(obj => obj.name === 'DoorExit');
    if (exitObject && exitObject.x !== undefined && exitObject.y !== undefined) {
      this.doorExitX = exitObject.x;
      this.doorExitY = exitObject.y;
    }

    const doorZones = map.getObjectLayer('Objects')?.objects.filter(obj => obj.name === 'DoorZone') || [];
    doorZones.forEach(obj => {
      const zone = this.add.zone(obj.x! + obj.width! / 2, obj.y! + obj.height! / 2, obj.width!, obj.height!);
      this.physics.add.existing(zone, true); 
      
      this.physics.add.overlap(this.player, zone, () => {
        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isGrounded = pBody.blocked.down || pBody.touching.down;
        
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) && isGrounded) {
          this.player.setPosition(this.doorExitX, this.doorExitY);
          this.player.setVelocity(0, 0); 
        }
      });
    });

    // --- Tiled Moving Platforms Setup ---
    const platformObjects = map.createFromObjects('Objects', { name: 'MovingPlatform', key: 'moving-platform-img' });
    platformObjects.forEach((obj: any) => {
      this.physics.add.existing(obj);
      const platBody = obj.body as Phaser.Physics.Arcade.Body;
      platBody.allowGravity = false; 
      platBody.immovable = true;     
      platBody.setVelocityX(250); 
      platBody.setFriction(0, 0);
      obj.setData('startX', obj.x);
      this.movingPlatforms.push(obj);
    });

    if (this.movingPlatforms.length > 0) {
      this.physics.add.collider(this.player, this.movingPlatforms, (_playerObj, platformObj) => {
        const pBody = (_playerObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
        const platBody = (platformObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
        if (pBody.bottom <= platBody.top + 2) {
          this.isOnPlatform = true;
        }
      });
    }

    // --- Pipe Monsters Setup ---
    const monsterObjects = map.createFromObjects('Objects', { name: 'PipeMonster', key: 'pipe-monster' });
    monsterObjects.forEach((obj: any) => {
      this.physics.add.existing(obj);
      const monsterBody = obj.body as Phaser.Physics.Arcade.Body;
      monsterBody.allowGravity = false; 
      monsterBody.immovable = true;     
      monsterBody.setSize(24, 20);
      obj.setData('restingY', obj.y);
      obj.setDepth(2.5);
      this.pipeMonsters.push(obj);
      this.startMonsterCycle(obj);
    });

    if (this.pipeMonsters.length > 0) {
      this.physics.add.overlap(this.player, this.pipeMonsters, this.handlePlayerDeath, 
        (_playerObj, monsterObj) => {
          const mSprite = monsterObj as Phaser.GameObjects.Sprite;
          return mSprite.y <= mSprite.getData('restingY') - 10; 
        }, 
        this
      );
    }

    // --- Collectible Setup ---
    
    // 1. Coins
    const coinObjects = map.createFromObjects('Objects', { name: 'Coin', key: 'coin' });
    coinObjects.forEach((obj: any) => {
      this.physics.add.existing(obj, true); 
      obj.setDepth(4);
      obj.play('coin-spin');
      this.coins.push(obj);
    });
    
    if (this.coins.length > 0) {
      this.physics.add.overlap(this.player, this.coins, (_playerObj, coinObj) => {
        coinObj.destroy();
        this.coinsCollected += 1;
      });
    }

    // 2. Temp Checkpoint
    const cpObjects = map.createFromObjects('Objects', { name: 'TempCheckpoint', key: 'temp-checkpoint' });
    cpObjects.forEach((obj: any) => {
      this.physics.add.existing(obj, true);
      obj.setDepth(4);
      this.tempCheckpoints.push(obj);
    });
    if (this.tempCheckpoints.length > 0) {
      this.physics.add.overlap(this.player, this.tempCheckpoints, (_playerObj, cpObj) => {
        const cpSprite = cpObj as Phaser.GameObjects.Sprite;
        this.activeSpawnX = cpSprite.x;
        this.activeSpawnY = cpSprite.y;
        cpSprite.destroy();
        
        if (this.checkpointTimer) this.checkpointTimer.remove();
        this.checkpointTimer = this.time.delayedCall(7000, () => {
          this.activeSpawnX = this.spawnX;
          this.activeSpawnY = this.spawnY;
        });
      });
    }

    // 3. Gun Powerup
    const gunObjects = map.createFromObjects('Objects', { name: 'GunPowerup', key: 'gun-powerup' });
    gunObjects.forEach((obj: any) => {
      this.physics.add.existing(obj, true);
      obj.setDepth(4);
      this.gunPowerups.push(obj);
    });
    if (this.gunPowerups.length > 0) {
      this.physics.add.overlap(this.player, this.gunPowerups, (_playerObj, gunObj) => {
        gunObj.destroy();
        this.hasGun = true;
        this.player.setTint(0x00ffff); 
        
        if (this.gunTimer) this.gunTimer.remove();
        this.gunTimer = this.time.delayedCall(10000, () => {
          this.hasGun = false;
          if (!this.hasTotem) this.player.clearTint();
        });
      });
    }

    // 4. Totem
    const totemObjects = map.createFromObjects('Objects', { name: 'Totem', key: 'totem' });
    totemObjects.forEach((obj: any) => {
      this.physics.add.existing(obj, true);
      obj.setDepth(4);
      this.totems.push(obj);
    });
    if (this.totems.length > 0) {
      this.physics.add.overlap(this.player, this.totems, (_playerObj, totemObj) => {
        totemObj.destroy();
        this.hasTotem = true;
        this.player.setTint(0xffd700); 
      });
    }
    // ------------------------------------

    if (groundLayer) this.physics.add.collider(this.player, groundLayer);

    if (oneWayLayer) {
      this.physics.add.collider(
        this.player, oneWayLayer, undefined, 
        (_playerObj, tile) => {
          const t = tile as Phaser.Tilemaps.Tile;
          if (t.index === -1) return false; 
          const body = (_playerObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
          return body.velocity.y > 0 && body.bottom <= t.pixelY + 10;
        },
        this
      );
    }

    if (hazardsLayer) {
      this.physics.add.overlap(this.player, hazardsLayer, this.handlePlayerDeath,
        (_playerObj, tile) => (tile as Phaser.Tilemaps.Tile).index !== -1, this);
    }

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.world.TILE_BIAS = 32;

    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.input.on('pointerdown', () => this.game.canvas.focus());
  }

  update() {
    const elapsedSeconds = Math.floor((this.time.now - this.startTime) / 1000);
    this.hudText.setText(`Time: ${elapsedSeconds}s | Coins: ${this.coinsCollected} | Kills: ${this.enemiesKilled}`);

    if (this.hasGun && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.shootBullet();
    }

    const speed = this.isOnPlatform ? 270 : 200; 
    const jumpSpeed = 400; 
    const shortHopCap = -150; 
    
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    this.movingPlatforms.forEach(plat => {
      const platBody = plat.body as Phaser.Physics.Arcade.Body;
      const startX = plat.getData('startX');
      if (plat.x > startX + 150) {
        platBody.setVelocityX(-250);
      } else if (plat.x < startX - 150) {
        platBody.setVelocityX(250);
      }
    });

    this.player.setVelocityX(0);

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
      this.facing = 'left';
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
      this.facing = 'right';
    }

    const isGrounded = body.blocked.down || body.touching.down;

    // --- Record Last Safe Position for Totem ---
    if (isGrounded && !this.isInvincible) {
      this.lastSafeX = this.player.x;
      this.lastSafeY = this.player.y - 10; 
    }

    if (this.cursors.up.isDown && isGrounded) {
      this.player.setVelocityY(-jumpSpeed);
    }

    if (!this.cursors.up.isDown && body.velocity.y < shortHopCap) {
      this.player.setVelocityY(shortHopCap);
    }

    this.updateAnimationState(body);
    this.isOnPlatform = false;
  }

  private shootBullet() {
    const bullet = this.bullets.create(this.player.x, this.player.y, 'bullet') as Phaser.Physics.Arcade.Sprite;
    bullet.body!.setSize(10, 10);
    bullet.setVelocityX(this.facing === 'right' ? 500 : -500);
    
    this.time.delayedCall(1500, () => {
      if (bullet.active) bullet.destroy();
    });
  }

  private updateAnimationState(body: Phaser.Physics.Arcade.Body) {
    const isGrounded = body.blocked.down || body.touching.down;
    const isMovingHorizontally = body.velocity.x !== 0;

    if (!isGrounded) {
      const key = body.velocity.y < 0
        ? (this.facing === 'right' ? 'jump-r' : 'jump-l')
        : (this.facing === 'right' ? 'fall-r' : 'fall-l');

      if (this.player.anims.isPlaying) this.player.anims.stop();
      if (this.player.texture.key !== key) this.player.setTexture(key);
      return;
    }

    if (isMovingHorizontally) {
      const key = this.facing === 'right' ? 'walk-r-anim' : 'walk-l-anim';
      if (this.player.anims.currentAnim?.key !== key) {
        this.player.anims.play(key, true);
      }
    } else {
      const key = this.facing === 'right' ? 'idle-r' : 'idle-l';
      if (this.player.anims.isPlaying) this.player.anims.stop();
      if (this.player.texture.key !== key) this.player.setTexture(key);
    }
  }

  private handlePlayerDeath = (_playerObj: any, _tile: any) => {
    if (this.isInvincible) return;

    if (this.hasTotem) {
      this.hasTotem = false;
      this.isInvincible = true;
      
      this.player.setPosition(this.lastSafeX, this.lastSafeY);
      this.player.setVelocity(0, 0);
      this.player.setTint(0xffaa00); 
      
      this.time.delayedCall(2000, () => {
        this.isInvincible = false;
        if (this.hasGun) this.player.setTint(0x00ffff);
        else this.player.clearTint();
      });
      return;
    }

    this.player.setPosition(this.activeSpawnX, this.activeSpawnY);
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setTexture(this.facing === 'right' ? 'idle-r' : 'idle-l');

    this.hasGun = false;
    this.player.clearTint();
  }

  private startMonsterCycle(monster: Phaser.GameObjects.Sprite) {
    const hideTime = Phaser.Math.Between(1000, 3000);
    const popUpDistance = 20; 

    this.time.delayedCall(hideTime, () => {
      if (Math.abs(this.player.x - monster.x) < 40) {
        this.startMonsterCycle(monster);
        return; 
      }

      this.tweens.add({
        targets: monster,
        y: monster.y - popUpDistance,
        duration: 200,           
        ease: 'Sine.easeOut',    
        onComplete: () => {
          const stayUpTime = Phaser.Math.Between(500, 1500); 
          this.time.delayedCall(stayUpTime, () => {
            this.tweens.add({
              targets: monster,
              y: monster.y + popUpDistance,
              duration: 200,     
              ease: 'Sine.easeIn', 
              onComplete: () => {
                this.startMonsterCycle(monster); 
              }
            });
          });
        }
      });
    });
  }
}