// src/managers/UIManager.ts
import Phaser from 'phaser';

export class UIManager {
    private scene: Phaser.Scene;
    private hudText!: Phaser.GameObjects.Text;
    private gunTimerText!: Phaser.GameObjects.Text;
    private cpTimerText!: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createHUD() {
        this.hudText = this.scene.add.text(16, 16, '', { 
            fontSize: '20px', fontFamily: 'Arial', color: '#ffffff', stroke: '#000000', strokeThickness: 3 
        }).setScrollFactor(0).setDepth(10);
        
        this.gunTimerText = this.scene.add.text(16, 44, '', { 
            fontSize: '18px', fontFamily: 'Arial', color: '#00FFFF', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold' 
        }).setScrollFactor(0).setDepth(10);
        
        this.cpTimerText = this.scene.add.text(16, 68, '', { 
            fontSize: '18px', fontFamily: 'Arial', color: '#D15FEE', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold' 
        }).setScrollFactor(0).setDepth(10);
    }

    updateHUD(elapsedSeconds: number, coins: number, kills: number, gunTimer?: Phaser.Time.TimerEvent, cpTimer?: Phaser.Time.TimerEvent) {
        this.hudText.setText(`Time: ${elapsedSeconds}s | Coins: ${coins} | Kills: ${kills}`);

        if (gunTimer && gunTimer.getRemaining() > 0) {
            this.gunTimerText.setText(`Gun: ${Math.ceil(gunTimer.getRemainingSeconds())}s`);
        } else {
            this.gunTimerText.setText('');
        }

        if (cpTimer && cpTimer.getRemaining() > 0) {
            this.cpTimerText.setText(`Temp CP: ${Math.ceil(cpTimer.getRemainingSeconds())}s`);
        } else {
            this.cpTimerText.setText('');
        }
    }

    showFloatingText(x: number, y: number, message: string, color: string) {
        const floatText = this.scene.add.text(x, y, message, { 
            fontSize: '20px', fontFamily: 'Arial', color: color, stroke: '#000000', strokeThickness: 4, fontStyle: 'bold' 
        }).setOrigin(0.5).setDepth(10);
        
        this.scene.tweens.add({ 
            targets: floatText, y: y - 40, alpha: 0, duration: 800, ease: 'Cubic.easeOut', 
            onComplete: () => floatText.destroy() 
        });
    }

    spawnParticles(x: number, y: number, color: number) {
        const particles = this.scene.add.particles(x, y, 'particle', { 
            speed: { min: 50, max: 150 }, scale: { start: 1, end: 0 }, tint: color, lifespan: 600, blendMode: 'ADD', emitting: false 
        });
        particles.setDepth(6); 
        particles.explode(15);
        this.scene.time.delayedCall(700, () => particles.destroy());
    }
}