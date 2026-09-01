import Phaser from 'phaser';
import { MainStageScene } from './scenes/MainStageScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 480, // matches map height exactly: 15 tiles x 32px — no empty space below the level
  parent: 'app',
  // backgroundColor: '#87CEEB',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: true // CHANGED: Set to true so you can see the new hitbox! Change back to false when done.
    }
  },
  scene: [MainStageScene]
};

new Phaser.Game(config);