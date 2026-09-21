import Phaser from 'phaser';
import { MainStageScene } from './scenes/MainStageScene';

const BASE_HEIGHT = 480; // 15 vertical tiles x 32px

function getResponsiveWidth(): number {
  if (typeof window !== 'undefined' && window.innerHeight > 0) {
    const ratio = window.innerWidth / window.innerHeight;
    return Math.round(BASE_HEIGHT * Math.max(1.2, Math.min(2.5, ratio)));
  }
  return 854; // 16:9 standard fallback (854 x 480)
}

const initialWidth = getResponsiveWidth();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: initialWidth,
  height: BASE_HEIGHT,
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: initialWidth,
    height: BASE_HEIGHT
  },
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

const game = new Phaser.Game(config);

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    if (game.isBooted && window.innerHeight > 0) {
      const newWidth = getResponsiveWidth();
      game.scale.resize(newWidth, BASE_HEIGHT);
    }
  });
}
