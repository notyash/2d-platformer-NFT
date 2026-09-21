import Phaser from 'phaser';
import { MainStageScene } from './scenes/MainStageScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 480, // matches map height exactly: 15 tiles x 32px
  parent: 'app',
  fps: {
    target: 60,
    min: 30,
    smoothStep: true
  },
  render: {
    powerPreference: 'high-performance',
    batchSize: 4096
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false
    }
  },
  scene: [MainStageScene]
};

new Phaser.Game(config);
