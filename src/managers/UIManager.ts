// src/managers/UIManager.ts
import Phaser from 'phaser';
import { SoundManager } from './SoundManager';

export interface MenuOption {
    id: string;
    label: string;
    action: () => void;
}

export class UIManager {
    private scene: Phaser.Scene;
    private soundManager?: SoundManager;
    private hudText!: Phaser.GameObjects.Text;
    
    // Pause Menu Container & State
    private pauseContainer?: Phaser.GameObjects.Container;
    public soundEnabled: boolean = true;
    public isPauseMenuOpen: boolean = false;
    
    private selectedMenuIndex: number = 0;
    private menuOptions: MenuOption[] = [];
    private menuButtonBoxes: Phaser.GameObjects.Rectangle[] = [];
    private menuButtonLabels: Phaser.GameObjects.Text[] = [];
    private selectionHighlight?: Phaser.GameObjects.Graphics;
    private soundLabelRef?: Phaser.GameObjects.Text;

    // Keys for menu navigation
    private keyUp?: Phaser.Input.Keyboard.Key;
    private keyDown?: Phaser.Input.Keyboard.Key;
    private keyW?: Phaser.Input.Keyboard.Key;
    private keyS?: Phaser.Input.Keyboard.Key;
    private keyEnter?: Phaser.Input.Keyboard.Key;
    private keySpace?: Phaser.Input.Keyboard.Key;

    constructor(scene: Phaser.Scene, soundManager?: SoundManager) {
        this.scene = scene;
        this.soundManager = soundManager;
        this.setupKeyboard();
    }

    private setupKeyboard() {
        if (!this.scene.input.keyboard) return;
        this.keyUp = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.keyDown = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.keyW = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyS = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyEnter = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.keySpace = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    createHUD() {
        this.hudText = this.scene.add.text(16, 16, '', { 
            fontSize: '15px', 
            fontFamily: 'Arial', 
            color: '#f8fafc', 
            stroke: '#020617', 
            strokeThickness: 3.5,
            fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(15);
    }

    updateHUD(formattedTime: string, coins: number, kills: number, deaths: number) {
        // Pure ASCII text to avoid multi-byte emoji encoding issues
        this.hudText.setText(`TIME: ${formattedTime}   |   DEATHS: ${deaths}   |   COINS: ${coins}   |   KILLS: ${kills}`);
    }

    showFloatingText(x: number, y: number, message: string, color: string) {
        const floatText = this.scene.add.text(x, y, message, { 
            fontSize: '18px', fontFamily: 'Arial', color: color, stroke: '#000000', strokeThickness: 4, fontStyle: 'bold' 
        }).setOrigin(0.5).setDepth(30);
        
        this.scene.tweens.add({ 
            targets: floatText, y: y - 40, alpha: 0, duration: 800, ease: 'Cubic.easeOut', 
            onComplete: () => floatText.destroy() 
        });
    }

    spawnParticles(x: number, y: number, color: number) {
        const particles = this.scene.add.particles(x, y, 'particle', { 
            speed: { min: 50, max: 150 }, scale: { start: 1, end: 0 }, tint: color, lifespan: 600, blendMode: 'ADD', emitting: false 
        });
        particles.setDepth(25); 
        particles.explode(15);
        this.scene.time.delayedCall(700, () => particles.destroy());
    }

    showPauseMenu(
        onResume: () => void, 
        onRestart: () => void, 
        stats: { time: string; deaths: number; coins: number; kills: number }
    ) {
        this.hidePauseMenu();
        this.isPauseMenuOpen = true;
        this.selectedMenuIndex = 0;

        this.pauseContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

        // Dark dimming backdrop
        const backdrop = this.scene.add.rectangle(640, 240, 1280, 480, 0x000000, 0.75)
            .setInteractive(); // Intercepts clicks behind menu
        this.pauseContainer.add(backdrop);

        // Modal Frame
        const modalWidth = 380;
        const modalHeight = 330;
        const modalX = 640;
        const modalY = 240;

        const modalBg = this.scene.add.rectangle(modalX, modalY, modalWidth, modalHeight, 0x0f172a, 0.95)
            .setStrokeStyle(2.5, 0x38bdf8, 0.9);
        this.pauseContainer.add(modalBg);

        // Title
        const title = this.scene.add.text(modalX, modalY - 130, 'GAME PAUSED', {
            fontSize: '22px', fontFamily: 'Arial', color: '#38bdf8', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.pauseContainer.add(title);

        // Run Stats Summary
        const statsSummary = this.scene.add.text(modalX, modalY - 90, `TIME: ${stats.time}   |   DEATHS: ${stats.deaths}\nCOINS: ${stats.coins}   |   KILLS: ${stats.kills}`, {
            fontSize: '12px', fontFamily: 'Arial', color: '#94a3b8', align: 'center', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.pauseContainer.add(statsSummary);

        // Define Menu Options
        this.menuOptions = [
            { id: 'resume', label: 'Resume Game', action: onResume },
            { id: 'restart', label: 'Restart Run', action: onRestart },
            { 
                id: 'sound', 
                label: `Sound FX: ${this.soundEnabled ? 'ON' : 'OFF'}`, 
                action: () => {
                    this.soundEnabled = !this.soundEnabled;
                    this.soundManager?.setMuted(!this.soundEnabled);
                    if (this.soundLabelRef) {
                        this.soundLabelRef.setText(`Sound FX: ${this.soundEnabled ? 'ON' : 'OFF'}`);
                    }
                    if (this.soundEnabled) {
                        this.soundManager?.playMenuSelect();
                    }
                }
            },
            { 
                id: 'character', 
                label: 'Change Character', 
                action: () => {
                    this.showFloatingText(640, 360, 'Character Select: Coming in Main Menu!', '#facc15');
                    this.soundManager?.playMenuSelect();
                } 
            }
        ];

        this.menuButtonBoxes = [];
        this.menuButtonLabels = [];

        const startBtnY = modalY - 40;
        const btnGap = 46;
        const btnWidth = 280;
        const btnHeight = 36;

        for (let i = 0; i < this.menuOptions.length; i++) {
            const opt = this.menuOptions[i];
            const btnY = startBtnY + (i * btnGap);

            // Button Box
            const box = this.scene.add.rectangle(modalX, btnY, btnWidth, btnHeight, 0x1e293b, 0.9)
                .setStrokeStyle(1.5, 0x475569)
                .setInteractive({ useHandCursor: true });

            // Button Label
            const label = this.scene.add.text(modalX, btnY, opt.label, {
                fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2.5
            }).setOrigin(0.5);

            if (opt.id === 'sound') {
                this.soundLabelRef = label;
            }

            // Mouse interactions
            const index = i;
            box.on('pointerover', () => {
                if (this.selectedMenuIndex !== index) {
                    this.selectedMenuIndex = index;
                    this.soundManager?.playMenuSelect();
                    this.updateMenuVisuals();
                }
            });

            box.on('pointerdown', () => {
                this.selectedMenuIndex = index;
                this.triggerCurrentOption();
            });

            this.menuButtonBoxes.push(box);
            this.menuButtonLabels.push(label);
            this.pauseContainer.add([box, label]);
        }

        // Selection Highlight Graphics
        this.selectionHighlight = this.scene.add.graphics();
        this.pauseContainer.add(this.selectionHighlight);

        this.updateMenuVisuals();
    }

    public updatePauseMenu() {
        if (!this.isPauseMenuOpen) return;

        // Up Navigation
        if (
            (this.keyUp && Phaser.Input.Keyboard.JustDown(this.keyUp)) || 
            (this.keyW && Phaser.Input.Keyboard.JustDown(this.keyW))
        ) {
            this.selectedMenuIndex = (this.selectedMenuIndex - 1 + this.menuOptions.length) % this.menuOptions.length;
            this.soundManager?.playMenuSelect();
            this.updateMenuVisuals();
        }

        // Down Navigation
        if (
            (this.keyDown && Phaser.Input.Keyboard.JustDown(this.keyDown)) || 
            (this.keyS && Phaser.Input.Keyboard.JustDown(this.keyS))
        ) {
            this.selectedMenuIndex = (this.selectedMenuIndex + 1) % this.menuOptions.length;
            this.soundManager?.playMenuSelect();
            this.updateMenuVisuals();
        }

        // Enter or Space to Select
        if (
            (this.keyEnter && Phaser.Input.Keyboard.JustDown(this.keyEnter)) ||
            (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace))
        ) {
            this.triggerCurrentOption();
        }
    }

    private triggerCurrentOption() {
        const opt = this.menuOptions[this.selectedMenuIndex];
        if (opt && opt.action) {
            this.soundManager?.playMenuSelect();
            opt.action();
        }
    }

    private updateMenuVisuals() {
        if (!this.isPauseMenuOpen || !this.selectionHighlight) return;

        for (let i = 0; i < this.menuButtonBoxes.length; i++) {
            const box = this.menuButtonBoxes[i];
            const label = this.menuButtonLabels[i];
            const isSelected = (i === this.selectedMenuIndex);

            if (isSelected) {
                // Highlighted button
                if (i === 1) {
                    // Restart button (Red hue)
                    box.setFillStyle(0xb91c1c, 0.95);
                    box.setStrokeStyle(2, 0xf87171);
                } else {
                    // Standard option (Cyan hue)
                    box.setFillStyle(0x0284c7, 0.95);
                    box.setStrokeStyle(2, 0x38bdf8);
                }
                box.setScale(1.02);
                label.setScale(1.02);
                label.setColor('#ffffff');
            } else {
                // Unselected button
                box.setFillStyle(0x1e293b, 0.85);
                box.setStrokeStyle(1.5, 0x475569);
                box.setScale(1);
                label.setScale(1);
                label.setColor('#94a3b8');
            }
        }

        // Draw animated/bright border highlight around active box
        this.selectionHighlight.clear();
        const activeBox = this.menuButtonBoxes[this.selectedMenuIndex];
        if (activeBox) {
            const borderColor = (this.selectedMenuIndex === 1) ? 0xfca5a5 : 0x7dd3fc;
            this.selectionHighlight.lineStyle(3, borderColor, 1);
            this.selectionHighlight.strokeRoundedRect(
                activeBox.x - (activeBox.width * activeBox.scaleX / 2) - 3,
                activeBox.y - (activeBox.height * activeBox.scaleY / 2) - 3,
                (activeBox.width * activeBox.scaleX) + 6,
                (activeBox.height * activeBox.scaleY) + 6,
                6
            );
        }
    }

    hidePauseMenu() {
        this.isPauseMenuOpen = false;
        if (this.pauseContainer) {
            this.pauseContainer.destroy();
            this.pauseContainer = undefined;
        }
    }
}
