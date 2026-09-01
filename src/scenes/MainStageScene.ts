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
  private jumpPads: Phaser.GameObjects.Sprite[] = [];
  
  // Collectibles & Powerups
  private coins: Phaser.GameObjects.Sprite[] = [];
  private tempCheckpoints: Phaser.GameObjects.Sprite[] = [];
  private gunPowerups: Phaser.GameObjects.Sprite[] = [];
  private totems: Phaser.GameObjects.Sprite[] = [];
  private bullets!: Phaser.Physics.Arcade.Group; 
  
  private isOnPlatform: boolean = false;
  
  // Spawn points and safe position tracking
  private spawnX: number = 100;
  private spawnY: number = 100;
  private activeSpawnX: number = 100;
  private activeSpawnY: number = 100;
  private lastSafeX: number = 100;
  private lastSafeY: number = 100;
  
  // Smash Mechanics Tracking
  private smashTriggers: Phaser.GameObjects.Zone[] = [];
  private canSmash: boolean = false;

  private doorExitX: number = 0;
  private doorExitY: number = 0;

  // Stats & HUD
  private startTime: number = 0;
  private coinsCollected: number = 0;
  private enemiesKilled: number = 0;
  private hudText!: Phaser.GameObjects.Text;
  
  // Powerup States
  private checkpointTimer?: Phaser.Time.TimerEvent;
  private hasGun: boolean = false;
  private gunTimer?: Phaser.Time.TimerEvent;
  private hasTotem: boolean = false;
  private isInvincible: boolean = false; 

  // Jump control flags
  private canJump: boolean = true;
  private isNormalJump: boolean = false; 
  private ignoreGroundJumpUntil: number = 0;

  constructor() {
    super('MainStageScene');
  }

  preload() {
    // Load tilesets and tilemap
    this.load.image('levelobjects', 'assets/tilesets/LevelObjectTiles.png');
    this.load.image('landtiles', 'assets/tilesets/LandTiles_32_32.png');
    this.load.image('sky', 'assets/tilesets/sky.png');
    this.load.image('clouds1', 'assets/tilesets/clouds1.png');
    this.load.image('smallTree', 'assets/tilesets/smallTree.png');
    this.load.image('largeTree', 'assets/tilesets/largeTree.png');
    this.load.image('grass', 'assets/tilesets/grass.png');
    this.load.image('cloud2', 'assets/tilesets/cloud2.png');
    this.load.tilemapTiledJSON('stage1', 'assets/tilemaps/harder-main-stage.json');

    // Load custom sprites and assets
    this.load.image('moving-platform-img', 'assets/sprites/moving-platform.png');
    this.load.image('pipe-monster', 'assets/sprites/monsters/Devil_Red_Stand_L.png');
    this.load.image('jump-pad-img', 'assets/sprites/jump-pad.png');
    this.load.spritesheet('coin', 'assets/sprites/Coin_24x24_Anim.png', { frameWidth: 24, frameHeight: 24 });

    this.load.image('temp-checkpoint', 'assets/sprites/temp-checkpoint.png');
    this.load.image('gun-powerup', 'assets/sprites/gun-powerup.png');
    this.load.image('totem', 'assets/sprites/totem.png');
    this.load.image('bullet', 'assets/sprites/bullet.png');

    // Load player animations & sprites
    this.load.image('idle-r', 'assets/sprites/player/Melissa_Stand_R.png');
    this.load.image('idle-l', 'assets/sprites/player/Melissa_Stand_L.png');
    this.load.image('jump-r', 'assets/sprites/player/Melissa_Jump1_R.png');
    this.load.image('jump-l', 'assets/sprites/player/Melissa_Jump1_L.png');
    this.load.image('fall-r', 'assets/sprites/player/Melissa_Fall2_R.png');
    this.load.image('fall-l', 'assets/sprites/player/Melissa_Fall2_L.png');

    this.load.spritesheet('walk-r', 'assets/sprites/player/Melissa_Walk_Anim_R.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('walk-l', 'assets/sprites/player/Melissa_Walk_Anim_L.png', { frameWidth: 32, frameHeight: 32 });
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

    // Create map layers
    const skyLayer = map.createLayer('Sky', allTilesets, 0, 0);
    const treesLayer = map.createLayer('Trees', allTilesets, 0, 0);
    const backgroundLayer = map.createLayer('Background', allTilesets, 0, 0);
    const groundLayer = map.createLayer('Ground', allTilesets, 0, 0);
    const oneWayLayer = map.createLayer('OneWayPlatforms', allTilesets, 0, 0);
    const hazardsLayer = map.createLayer('Hazards', allTilesets, 0, 0);
    const foregroundLayer = map.createLayer('Foreground', allTilesets, 0, 0);
    const smashLayer = map.createLayer('SmashGround', allTilesets, 0, 0);

    // Set layer depths
    skyLayer?.setDepth(0);
    treesLayer?.setDepth(1);
    backgroundLayer?.setDepth(2);
    groundLayer?.setDepth(3);
    oneWayLayer?.setDepth(4);
    smashLayer?.setDepth(4);
    hazardsLayer?.setDepth(5);
    foregroundLayer?.setDepth(7);

    // Configure layer collisions
    groundLayer?.setCollisionByExclusion([-1]);
    oneWayLayer?.setCollisionByExclusion([-1]);
    hazardsLayer?.setCollisionByExclusion([-1]);
    smashLayer?.setCollisionByExclusion([-1]);

    // Setup player animations
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

    // Setup coin animation
    this.anims.create({
      key: 'coin-spin',
      frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 7 }), 
      frameRate: 10,
      repeat: -1 
    });

    // Initialize player spawn position
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
    
    // Ensure high maximum velocity limits so large power values execute fully
    (this.player.body as Phaser.Physics.Arcade.Body).setMaxVelocity(10000, 10000);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Setup HUD and game stats
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
    
    // Create bullet group
    this.bullets = this.physics.add.group({ allowGravity: false });
    if (groundLayer) {
      this.physics.add.collider(this.bullets, groundLayer, (bullet) => bullet.destroy());
    }

    // Setup door teleportation
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
        const isGrounded = pBody.blocked.down || this.isOnPlatform;
        
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) && isGrounded) {
          this.player.setPosition(this.doorExitX, this.doorExitY);
          this.player.setVelocity(0, 0); 
        }
      });
    });

    // Setup moving platforms
    const platformObjects = map.createFromObjects('Objects', { name: 'MovingPlatform', key: 'moving-platform-img' });
    const rawMapObjects = map.getObjectLayer('Objects')?.objects || [];
    const rawPlatforms = rawMapObjects.filter((o: any) => o.name === 'MovingPlatform');

    platformObjects.forEach((obj: any, index: number) => {
      this.physics.add.existing(obj);
      const platBody = obj.body as Phaser.Physics.Arcade.Body;
      platBody.allowGravity = false; 
      platBody.immovable = true;     
      
      let platSpeed = 250; 
      let platFriction = 1;

      const rawObj = rawPlatforms[index];
      if (rawObj && rawObj.properties) {
        const speedProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'speed');
        if (speedProp) platSpeed = speedProp.value;

        const frictionProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'friction');
        if (frictionProp && frictionProp.value !== undefined) {
          platFriction = Number(frictionProp.value);
        }
      }
      
      platBody.setVelocityX(platSpeed); 
      platBody.setFriction(platFriction, 0); 
      obj.setData('startX', obj.x);
      obj.setData('speed', platSpeed); 
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

    // Setup Jump Pads as fully solid pipes
    const rawPads = rawMapObjects.filter((o: any) => o.name === 'JumpPad');
    rawPads.forEach((rawObj: any) => {
      const padSprite = this.physics.add.sprite(rawObj.x, rawObj.y, 'jump-pad-img') as Phaser.Physics.Arcade.Sprite;
      padSprite.setDepth(4);
      padSprite.setOrigin(0, 1);

      if (rawObj.width && rawObj.height) {
        padSprite.setDisplaySize(rawObj.width, rawObj.height);
      }

      let bouncePower = 800; 
      if (rawObj.properties) {
        const powerProp = rawObj.properties.find((p: any) => {
          const propName = p.name ? p.name.toLowerCase() : '';
          return propName === 'power' || propName === 'speed';
        });
        if (powerProp && powerProp.value !== undefined) {
          bouncePower = Number(powerProp.value);
        }
      }

      padSprite.setData('bouncePower', -Math.abs(bouncePower));

      const padBody = padSprite.body as Phaser.Physics.Arcade.Body;
      padBody.setAllowGravity(false);
      padBody.setImmovable(true);
      padBody.setSize(rawObj.width || padSprite.width, rawObj.height || padSprite.height);
      padBody.setOffset(0, 0);

      this.jumpPads.push(padSprite);
    });

    // Solid collider for Jump Pads: Acts as a normal wall from the side, but launches if touched from top
    let lastBounceTime = 0;
    if (this.jumpPads.length > 0) {
      this.physics.add.collider(this.player, this.jumpPads, (_playerObj, padObj) => {
        const pBody = (_playerObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
        const padBody = (padObj as Phaser.GameObjects.Sprite).body as Phaser.Physics.Arcade.Body;
        const currentTime = this.time.now;
        
        if (pBody.touching.down && padBody.touching.up && (currentTime - lastBounceTime > 300)) {
          const padSprite = padObj as Phaser.GameObjects.Sprite;
          const power = padSprite.getData('bouncePower');
          
          this.player.setVelocityY(power);
          
          this.isNormalJump = false; 
          this.ignoreGroundJumpUntil = currentTime + 150;
          lastBounceTime = currentTime;
        }
      });
    }

    // Setup pipe monsters
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

    // Setup Collectibles natively as clean static bodies.
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
    
    // Setup Smash trigger zones
    const objectLayer = map.getObjectLayer('Objects');
    if (objectLayer) {
      const rawTriggers = objectLayer.objects.filter(obj => obj.name === 'SmashTrigger');
      rawTriggers.forEach(obj => {
        const zone = this.add.zone(obj.x! + (obj.width! / 2), obj.y! + (obj.height! / 2), obj.width!, obj.height!);
        this.smashTriggers.push(zone);
      });
    }

    // World colliders setup
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
    
    // Setup Smash Ground mechanics
    if (smashLayer) {
      this.physics.add.collider(
        this.player, smashLayer, undefined,
        (_playerObj, tile) => {
          const t = tile as Phaser.Tilemaps.Tile;
          if (t.index === -1) return false;
          
          const body = (_playerObj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
          if (body.velocity.y > 0 && this.canSmash) {
            return false; 
          }
          
          return body.velocity.y > 0 && body.bottom <= t.pixelY + 10;
        },
        this
      );
    }

    if (hazardsLayer) {
      this.physics.add.overlap(this.player, hazardsLayer, this.handlePlayerDeath,
        (_playerObj, tile) => (tile as Phaser.Tilemaps.Tile).index !== -1, this);
    }

    // Camera and bounds configuration
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

    const speed = 200; 
    const jumpSpeed = 400; 
    const shortHopCap = -150;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // Update moving platforms loop
    this.movingPlatforms.forEach(plat => {
      const platBody = plat.body as Phaser.Physics.Arcade.Body;
      const startX = plat.getData('startX');
      const platSpeed = plat.getData('speed'); 
      
      if (plat.x > startX + 150) {
        platBody.setVelocityX(-platSpeed);
      } else if (plat.x < startX - 150) {
        platBody.setVelocityX(platSpeed);
      }
    });

    this.player.setVelocityX(0);

    // Handle horizontal movement inputs
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
      this.facing = 'left';
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
      this.facing = 'right';
    }

    // Strict structural check for grounding: Rely only on tilemap floors and moving platforms.
    const isGrounded = body.blocked.down || this.isOnPlatform;

    // Save safe position for Totem powerup
    if (isGrounded && !this.isInvincible) {
      this.lastSafeX = this.player.x;
      this.lastSafeY = this.player.y - 10; 
    }

    // Check Smash trigger zone overlap
    let touchingTrigger = false;
    this.smashTriggers.forEach(zone => {
      const pBody = this.player.body as Phaser.Physics.Arcade.Body;
      const pRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
      
      if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, zone.getBounds())) {
        touchingTrigger = true;
      }
    });

    if (touchingTrigger) {
      this.canSmash = true; 
    } else if (isGrounded) {
      this.canSmash = false; 
    }

    // Handle manual jumping input
    if (isGrounded) {
      if (this.cursors.up.isDown && this.canJump && this.time.now > this.ignoreGroundJumpUntil) {
        this.player.setVelocityY(-jumpSpeed);
        this.canJump = false;
        this.isNormalJump = true; 
      }
    } else {
      this.canJump = true;
    }

    // Handle variable jump height (short hop) ONLY for manual jumps
    if (this.isNormalJump && !this.cursors.up.isDown && body.velocity.y < shortHopCap) {
      this.player.setVelocityY(shortHopCap);
      this.isNormalJump = false; 
    }

    this.updateAnimationState(body, isGrounded);
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

  private updateAnimationState(body: Phaser.Physics.Arcade.Body, isGrounded: boolean) {
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

  private handlePlayerDeath = (_playerObj: any, _monsterObj: any) => {
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