// src/managers/SoundManager.ts
import Phaser from 'phaser';
import { SettingsManager } from './SettingsManager';

export class SoundManager {
    private scene: Phaser.Scene;
    private ctx?: AudioContext;
    public isMuted: boolean = false;
    private settingsManager: SettingsManager;
    private musicInterval: any;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.settingsManager = SettingsManager.getInstance();
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

    public playEnemyShoot() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(220, 110, 'sawtooth', 0.14, 0.22);
    }

    public playCoin() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(987.77, 1318.51, 'triangle', 0.15, 0.25);
    }

    public playPowerup() {
        if (this.isMuted) return;
        this.ensureContext();
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

    public playBridgeBreak() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(160, 45, 'sawtooth', 0.25, 0.35);
        this.scene.time.delayedCall(40, () => this.playTone(280, 70, 'square', 0.2, 0.28));
        this.scene.time.delayedCall(90, () => this.playTone(120, 30, 'sawtooth', 0.3, 0.35));
    }

    public playMenuSelect() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(520, 680, 'sine', 0.05, 0.18, true);
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

    public pauseAll() {
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend();
        }
        if (this.scene.sound) {
            this.scene.sound.pauseAll();
        }
    }

    public resumeAll() {
        if (!this.isMuted) {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            if (this.scene.sound) {
                this.scene.sound.resumeAll();
            }
        }
    }

    public playBossMusic() {
        if (this.isMuted) return;
        this.ensureContext();
        if (this.musicInterval) return;
        
        let step = 0;
        // Ominous minor scale arpeggio
        const notes = [220.00, 261.63, 329.63, 293.66, 349.23, 293.66, 261.63, 220.00];
        
        this.musicInterval = setInterval(() => {
            if (this.isMuted || (this.scene as any).isGamePaused) return;
            const freq = notes[step % notes.length];
            // Bass thump
            if (step % 2 === 0) {
                this.playTone(freq / 2, freq / 4, 'square', 0.15, 0.2);
            }
            // Arpeggio
            this.playTone(freq, freq, 'sawtooth', 0.1, 0.15);
            step++;
        }, 150); // 150ms per note (100 BPM 16th notes)
    }

    public stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }

    private playTone(startFreq: number, endFreq: number, type: OscillatorType, duration: number, volume: number, isMenu: boolean = false) {
        try {
            if (!this.ctx) return;
            if (!isMenu && (this.scene as any).isGamePaused) return;
            const effectiveVol = volume * this.settingsManager.getEffectiveSfxVolume();
            if (effectiveVol <= 0.001) return;

            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), this.ctx.currentTime + duration);

            gain.gain.setValueAtTime(effectiveVol, this.ctx.currentTime);
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
