// src/managers/SoundManager.ts
import Phaser from 'phaser';

export class SoundManager {
    private scene: Phaser.Scene;
    private ctx?: AudioContext;
    public isMuted: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.initAudioContext();
    }

    private initAudioContext() {
        const resumeAudio = () => {
            if (!this.ctx) {
                try {
                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioContextClass) {
                        this.ctx = new AudioContextClass();
                    }
                } catch {
                    // Ignore audio context errors
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            if (this.scene.sound && this.scene.sound.locked) {
                this.scene.sound.unlock();
            }
        };

        window.addEventListener('pointerdown', resumeAudio, { passive: true });
        window.addEventListener('keydown', resumeAudio, { passive: true });
        window.addEventListener('touchstart', resumeAudio, { passive: true });
    }

    private ensureContext() {
        if (!this.ctx) {
            try {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    this.ctx = new AudioContextClass();
                }
            } catch {
                return;
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    public setMuted(muted: boolean) {
        this.isMuted = muted;
        if (this.scene.sound) {
            this.scene.sound.mute = muted;
        }
    }

    public playJump() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(150, 420, 'sine', 0.12, 0.18);
    }

    public playShoot() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(620, 180, 'sawtooth', 0.08, 0.2);
    }

    public playCoin() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(987.77, 1318.51, 'triangle', 0.15, 0.25); // B5 to E6 gleaming chime
    }

    public playPowerup() {
        if (this.isMuted) return;
        this.ensureContext();
        // 4-step ascending 8-bit fanfare (C5 -> E5 -> G5 -> C6)
        this.playTone(523.25, 523.25, 'triangle', 0.06, 0.22);
        this.scene.time.delayedCall(65, () => this.playTone(659.25, 659.25, 'triangle', 0.06, 0.22));
        this.scene.time.delayedCall(130, () => this.playTone(783.99, 783.99, 'triangle', 0.06, 0.25));
        this.scene.time.delayedCall(195, () => this.playTone(1046.50, 1046.50, 'sine', 0.18, 0.3));
    }

    public playStomp() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(280, 80, 'square', 0.1, 0.25);
    }

    public playDeath() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(400, 90, 'sawtooth', 0.4, 0.35);
    }

    public playMenuSelect() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(520, 680, 'sine', 0.05, 0.18);
    }

    public playCheckpoint() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(440, 880, 'sine', 0.2, 0.25);
    }

    public playTeleport() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(200, 850, 'triangle', 0.25, 0.22);
    }

    private playTone(startFreq: number, endFreq: number, type: OscillatorType, duration: number, volume: number) {
        try {
            if (!this.ctx) return;
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), this.ctx.currentTime + duration);

            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch {
            // Ignore audio output errors
        }
    }
}
