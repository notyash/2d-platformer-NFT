import Phaser from 'phaser';
import { MainStageScene } from './scenes/MainStageScene';

const BASE_HEIGHT = 480; // 15 vertical tiles x 32px

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi|Tablet/i;
  const isMobileUA = mobileRegex.test(userAgent);
  const isTouchMac = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  const isCoarsePointer = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse) and (hover: none)').matches);
  const isSmallTouchDevice = Boolean('ontouchstart' in window && (window.innerWidth <= 1024 || window.screen.width <= 1024));

  return isMobileUA || isTouchMac || isCoarsePointer || isSmallTouchDevice;
}

function showMobileBlocker() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div class="mobile-blocker">
      <div class="mobile-card">
        <div class="mobile-icon">🧅</div>
        <h1 class="mobile-title">ONION BOY</h1>
        <div class="mobile-badge">DESKTOP ONLY</div>
        <p class="mobile-desc">
          Onion Boy is designed exclusively for precision desktop keyboard & mouse platforming. Mobile and touchscreen devices are not supported.
        </p>
        <div class="mobile-reqs">
          <div class="req-item"><span class="req-icon">⌨️</span><span>Keyboard Controls (WASD / Arrows / Space)</span></div>
          <div class="req-item"><span class="req-icon">🖱️</span><span>Mouse Blaster Controls (Left-Click)</span></div>
          <div class="req-item"><span class="req-icon">🖥️</span><span>Desktop / Laptop Display</span></div>
        </div>
        <div class="mobile-footer">Please open this game on a desktop or laptop computer to play.</div>
      </div>
    </div>
  `;
}

function getResponsiveWidth(): number {
  if (typeof window !== 'undefined' && window.innerHeight > 0) {
    const ratio = window.innerWidth / window.innerHeight;
    return Math.round(BASE_HEIGHT * Math.max(1.2, Math.min(2.5, ratio)));
  }
  return 854; // 16:9 standard fallback (854 x 480)
}

if (isMobileDevice()) {
  showMobileBlocker();
} else {
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
      if (isMobileDevice()) {
        game.destroy(true);
        showMobileBlocker();
        return;
      }
      if (game.isBooted && window.innerHeight > 0) {
        const newWidth = getResponsiveWidth();
        game.scale.resize(newWidth, BASE_HEIGHT);
      }
    });
  }
}
