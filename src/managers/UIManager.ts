// src/managers/UIManager.ts
import Phaser from 'phaser';
import { SoundManager } from './SoundManager';
import { LeaderboardManager } from './LeaderboardManager';

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

    // Death Screen Container & State
    private deathContainer?: Phaser.GameObjects.Container;
    public isDeathScreenOpen: boolean = false;
    private selectedDeathIndex: number = 0;
    private deathOptions: MenuOption[] = [];
    private deathButtonBoxes: Phaser.GameObjects.Rectangle[] = [];
    private deathButtonLabels: Phaser.GameObjects.Text[] = [];
    private deathHighlight?: Phaser.GameObjects.Graphics;

    // Dynamic Menu Geometry Constants
    private get pauseModalX(): number { return this.scene.scale.width / 2; }
    private get pauseModalY(): number { return this.scene.scale.height / 2; }
    private currentStartBtnY = 182;
    private readonly pauseBtnGap = 42;
    private readonly pauseBtnWidth = 280;
    private readonly pauseBtnHeight = 34;

    private get deathModalX(): number { return this.scene.scale.width / 2; }
    private get deathModalY(): number { return this.scene.scale.height / 2; }
    private readonly deathBtnY = 292;
    private readonly deathBtnWidth = 320;
    private readonly deathBtnHeight = 44;

    constructor(scene: Phaser.Scene, soundManager?: SoundManager) {
        this.scene = scene;
        this.soundManager = soundManager;
        
        // Global Keyboard Event Listener
        window.addEventListener('keydown', this.handleGlobalKeyDown, { capture: true });
        
        // Global Pointer Move & Down Listeners (Screen coordinates immune to camera scrolling)
        this.scene.input.on('pointermove', this.handlePointerMove);
        this.scene.input.on('pointerdown', this.handlePointerDown);

        this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('keydown', this.handleGlobalKeyDown, { capture: true });
            this.scene.input.off('pointermove', this.handlePointerMove);
            this.scene.input.off('pointerdown', this.handlePointerDown);
        });
    }

    private handlePointerMove = (pointer: Phaser.Input.Pointer) => {
        if (this.isPauseMenuOpen) {
            const px = pointer.x;
            const py = pointer.y;
            const halfW = this.pauseBtnWidth / 2;
            const halfH = this.pauseBtnHeight / 2;

            for (let i = 0; i < this.menuOptions.length; i++) {
                const btnY = this.currentStartBtnY + (i * this.pauseBtnGap);
                if (
                    px >= this.pauseModalX - halfW && px <= this.pauseModalX + halfW &&
                    py >= btnY - halfH && py <= btnY + halfH
                ) {
                    if (this.selectedMenuIndex !== i) {
                        this.selectedMenuIndex = i;
                        this.soundManager?.playMenuSelect();
                        this.updateMenuVisuals();
                    }
                    break;
                }
            }
            return;
        }

        if (this.isDeathScreenOpen) {
            const px = pointer.x;
            const py = pointer.y;
            const halfW = this.deathBtnWidth / 2;
            const halfH = this.deathBtnHeight / 2;

            if (
                px >= this.deathModalX - halfW && px <= this.deathModalX + halfW &&
                py >= this.deathBtnY - halfH && py <= this.deathBtnY + halfH
            ) {
                if (this.selectedDeathIndex !== 0) {
                    this.selectedDeathIndex = 0;
                    this.soundManager?.playMenuSelect();
                    this.updateDeathVisuals();
                }
            }
        }
    };

    private handlePointerDown = (pointer: Phaser.Input.Pointer) => {
        if (this.isPauseMenuOpen) {
            const px = pointer.x;
            const py = pointer.y;
            const halfW = this.pauseBtnWidth / 2;
            const halfH = this.pauseBtnHeight / 2;

            for (let i = 0; i < this.menuOptions.length; i++) {
                const btnY = this.currentStartBtnY + (i * this.pauseBtnGap);
                if (
                    px >= this.pauseModalX - halfW && px <= this.pauseModalX + halfW &&
                    py >= btnY - halfH && py <= btnY + halfH
                ) {
                    this.selectedMenuIndex = i;
                    this.triggerCurrentOption();
                    break;
                }
            }
            return;
        }

        if (this.isDeathScreenOpen) {
            const px = pointer.x;
            const py = pointer.y;
            const halfW = this.deathBtnWidth / 2;
            const halfH = this.deathBtnHeight / 2;

            if (
                px >= this.deathModalX - halfW && px <= this.deathModalX + halfW &&
                py >= this.deathBtnY - halfH && py <= this.deathBtnY + halfH
            ) {
                this.selectedDeathIndex = 0;
                this.triggerCurrentDeathOption();
            }
        }
    };

    private handleGlobalKeyDown = (event: KeyboardEvent) => {
        if (this.isPauseMenuOpen) {
            const key = event.code;
            if (key === 'ArrowUp' || key === 'KeyW') {
                event.preventDefault();
                event.stopPropagation();
                this.selectedMenuIndex = (this.selectedMenuIndex - 1 + this.menuOptions.length) % this.menuOptions.length;
                this.soundManager?.playMenuSelect();
                this.updateMenuVisuals();
            } else if (key === 'ArrowDown' || key === 'KeyS') {
                event.preventDefault();
                event.stopPropagation();
                this.selectedMenuIndex = (this.selectedMenuIndex + 1) % this.menuOptions.length;
                this.soundManager?.playMenuSelect();
                this.updateMenuVisuals();
            } else if (key === 'Enter' || key === 'Space') {
                event.preventDefault();
                event.stopPropagation();
                this.triggerCurrentOption();
            }
            return;
        }

        if (this.isDeathScreenOpen) {
            const key = event.code;
            if (key === 'Enter' || key === 'Space') {
                event.preventDefault();
                event.stopPropagation();
                this.triggerCurrentDeathOption();
            }
        }
    };

    createHUD(onPauseToggle?: () => void, onRestartRun?: () => void) {
        this.hudText = this.scene.add.text(16, 16, '', { 
            fontSize: '15px', 
            fontFamily: 'Arial', 
            color: '#f8fafc', 
            stroke: '#020617', 
            strokeThickness: 3.5,
            fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(15);

        // Top Right [R+R] Restart Run Button
        const restartBtnContainer = this.scene.add.container(this.scene.scale.width - 192, 24).setScrollFactor(0).setDepth(15);
        const restartBtnBg = this.scene.add.rectangle(0, 0, 132, 28, 0x0f172a, 0.85)
            .setStrokeStyle(1.5, 0xf87171, 0.8)
            .setInteractive({ useHandCursor: true });
        
        const restartBtnText = this.scene.add.text(0, 0, '[R+R] Restart Run', {
            fontSize: '12px', fontFamily: 'Arial', color: '#f87171', fontStyle: 'bold'
        }).setOrigin(0.5);

        restartBtnBg.on('pointerover', () => {
            restartBtnBg.setFillStyle(0xb91c1c, 0.95);
            restartBtnBg.setStrokeStyle(1.5, 0xfca5a5);
            restartBtnText.setColor('#ffffff');
        });

        restartBtnBg.on('pointerout', () => {
            restartBtnBg.setFillStyle(0x0f172a, 0.85);
            restartBtnBg.setStrokeStyle(1.5, 0xf87171, 0.8);
            restartBtnText.setColor('#f87171');
        });

        restartBtnBg.on('pointerdown', () => {
            this.soundManager?.playMenuSelect();
            if (onRestartRun) onRestartRun();
        });

        restartBtnContainer.add([restartBtnBg, restartBtnText]);

        // Top Right [ESC] Menu Button
        const menuBtnContainer = this.scene.add.container(this.scene.scale.width - 66, 24).setScrollFactor(0).setDepth(15);
        const btnBg = this.scene.add.rectangle(0, 0, 100, 28, 0x0f172a, 0.85)
            .setStrokeStyle(1.5, 0x38bdf8, 0.8)
            .setInteractive({ useHandCursor: true });
        
        const btnText = this.scene.add.text(0, 0, '[ESC] Menu', {
            fontSize: '12px', fontFamily: 'Arial', color: '#38bdf8', fontStyle: 'bold'
        }).setOrigin(0.5);

        btnBg.on('pointerover', () => {
            btnBg.setFillStyle(0x0284c7, 0.95);
            btnBg.setStrokeStyle(1.5, 0x7dd3fc);
            btnText.setColor('#ffffff');
        });

        btnBg.on('pointerout', () => {
            btnBg.setFillStyle(0x0f172a, 0.85);
            btnBg.setStrokeStyle(1.5, 0x38bdf8, 0.8);
            btnText.setColor('#38bdf8');
        });

        btnBg.on('pointerdown', () => {
            this.soundManager?.playMenuSelect();
            if (onPauseToggle) onPauseToggle();
        });

        menuBtnContainer.add([btnBg, btnText]);
    }

    updateHUD(formattedTime: string, coins: number, kills: number, deaths: number) {
        this.hudText.setText(`TIME: ${formattedTime}   |   DEATHS: ${deaths}   |   COINS: ${coins}   |   KILLS: ${kills}`);
    }

    showFloatingText(x: number, y: number, message: string, color: string, duration: number = 800, distance: number = 40) {
        const floatText = this.scene.add.text(x, y, message, { 
            fontSize: '18px', fontFamily: 'Arial', color: color, stroke: '#000000', strokeThickness: 4, fontStyle: 'bold' 
        }).setOrigin(0.5).setDepth(30);

        if (duration > 1200) {
            floatText.setScale(0.85);
            this.scene.tweens.add({
                targets: floatText,
                scale: 1.1,
                duration: 200,
                yoyo: true,
                repeat: 0,
                ease: 'Back.easeOut'
            });

            this.scene.tweens.add({
                targets: floatText,
                y: y - distance,
                duration: duration * 0.4,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: floatText,
                        alpha: 0,
                        duration: duration * 0.6,
                        ease: 'Linear',
                        onComplete: () => floatText.destroy()
                    });
                }
            });
        } else {
            this.scene.tweens.add({ 
                targets: floatText, y: y - distance, alpha: 0, duration: duration, ease: 'Cubic.easeOut', 
                onComplete: () => floatText.destroy() 
            });
        }
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
        onRespawnCheckpoint: () => void,
        onRestart: () => void, 
        stats: { time: string; deaths: number; coins: number; kills: number; hasCheckpoint?: boolean }
    ) {
        this.hidePauseMenu();
        this.isPauseMenuOpen = true;
        this.selectedMenuIndex = 0;

        if (this.scene.game.canvas) {
            this.scene.game.canvas.focus();
        }

        this.pauseContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

        // Dark dimming backdrop
        const backdrop = this.scene.add.rectangle(this.pauseModalX, this.pauseModalY, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.75);
        this.pauseContainer.add(backdrop);

        // Construct dynamic menu options
        this.menuOptions = [
            { id: 'resume', label: 'Resume Game', action: onResume }
        ];

        // "Respawn at Checkpoint" only shows up if a checkpoint has been achieved
        if (stats.hasCheckpoint) {
            this.menuOptions.push({ id: 'respawn', label: 'Respawn at Checkpoint', action: onRespawnCheckpoint });
        }

        this.menuOptions.push(
            {
                id: 'leaderboard',
                label: '🏆 View Leaderboard',
                action: () => {
                    LeaderboardManager.getInstance().showLeaderboardModal(this.scene, this.soundManager);
                }
            },
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
            { id: 'restart', label: 'Restart Full Run', action: onRestart }
        );

        // Dynamic modal sizing & positioning
        const totalBtns = this.menuOptions.length;
        const modalWidth = 380;
        const modalHeight = Math.max(320, 140 + totalBtns * this.pauseBtnGap);
        const titleOffsetY = -modalHeight / 2 + 30;
        const statsOffsetY = -modalHeight / 2 + 65;
        
        this.currentStartBtnY = this.pauseModalY - modalHeight / 2 + 105;

        const modalBg = this.scene.add.rectangle(this.pauseModalX, this.pauseModalY, modalWidth, modalHeight, 0x0f172a, 0.95)
            .setStrokeStyle(2.5, 0x38bdf8, 0.9);
        this.pauseContainer.add(modalBg);

        // Title
        const title = this.scene.add.text(this.pauseModalX, this.pauseModalY + titleOffsetY, 'GAME PAUSED', {
            fontSize: '22px', fontFamily: 'Arial', color: '#38bdf8', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.pauseContainer.add(title);

        // Run Stats Summary
        const statsSummary = this.scene.add.text(this.pauseModalX, this.pauseModalY + statsOffsetY, `TIME: ${stats.time}   |   DEATHS: ${stats.deaths}\nCOINS: ${stats.coins}   |   KILLS: ${stats.kills}`, {
            fontSize: '12px', fontFamily: 'Arial', color: '#94a3b8', align: 'center', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.pauseContainer.add(statsSummary);

        this.menuButtonBoxes = [];
        this.menuButtonLabels = [];

        for (let i = 0; i < this.menuOptions.length; i++) {
            const opt = this.menuOptions[i];
            const btnY = this.currentStartBtnY + (i * this.pauseBtnGap);

            // Button Box
            const box = this.scene.add.rectangle(this.pauseModalX, btnY, this.pauseBtnWidth, this.pauseBtnHeight, 0x1e293b, 0.9)
                .setStrokeStyle(1.5, 0x475569);

            // Button Label
            const label = this.scene.add.text(this.pauseModalX, btnY, opt.label, {
                fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2.5
            }).setOrigin(0.5);

            if (opt.id === 'sound') {
                this.soundLabelRef = label;
            }

            this.menuButtonBoxes.push(box);
            this.menuButtonLabels.push(label);
            this.pauseContainer.add([box, label]);
        }

        // Selection Highlight Graphics
        this.selectionHighlight = this.scene.add.graphics();
        this.pauseContainer.add(this.selectionHighlight);

        // Check if pointer is currently hovering over any button upon open
        const pointer = this.scene.input.activePointer;
        if (pointer) {
            const px = pointer.x;
            const py = pointer.y;
            const halfW = this.pauseBtnWidth / 2;
            const halfH = this.pauseBtnHeight / 2;

            for (let i = 0; i < this.menuOptions.length; i++) {
                const btnY = this.currentStartBtnY + (i * this.pauseBtnGap);
                if (
                    px >= this.pauseModalX - halfW && px <= this.pauseModalX + halfW &&
                    py >= btnY - halfH && py <= btnY + halfH
                ) {
                    this.selectedMenuIndex = i;
                    break;
                }
            }
        }

        this.updateMenuVisuals();
    }

    public updatePauseMenu() {
        // Handled via window & screen pointer listeners
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
            const opt = this.menuOptions[i];

            if (isSelected) {
                if (opt.id === 'restart') {
                    // Restart Full Run (Red)
                    box.setFillStyle(0xb91c1c, 0.95);
                    box.setStrokeStyle(2, 0xf87171);
                } else if (opt.id === 'respawn') {
                    // Respawn at Checkpoint (Amber / Gold)
                    box.setFillStyle(0xb45309, 0.95);
                    box.setStrokeStyle(2, 0xfbbf24);
                } else {
                    // Standard option (Cyan)
                    box.setFillStyle(0x0284c7, 0.95);
                    box.setStrokeStyle(2, 0x38bdf8);
                }
                box.setScale(1.02);
                label.setScale(1.02);
                label.setColor('#ffffff');
            } else {
                box.setFillStyle(0x1e293b, 0.85);
                box.setStrokeStyle(1.5, 0x475569);
                box.setScale(1);
                label.setScale(1);
                label.setColor('#94a3b8');
            }
        }

        this.selectionHighlight.clear();
        const activeBox = this.menuButtonBoxes[this.selectedMenuIndex];
        const activeOpt = this.menuOptions[this.selectedMenuIndex];
        if (activeBox && activeOpt) {
            let borderColor = 0x7dd3fc;
            if (activeOpt.id === 'restart') borderColor = 0xfca5a5;
            else if (activeOpt.id === 'respawn') borderColor = 0xfde047;

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

    hideDeathScreen() {
        this.isDeathScreenOpen = false;
        if (this.deathContainer) {
            this.deathContainer.destroy();
            this.deathContainer = undefined;
        }
    }

    hidePauseMenu() {
        this.isPauseMenuOpen = false;
        if (this.pauseContainer) {
            this.pauseContainer.destroy();
            this.pauseContainer = undefined;
        }
    }

    showDeathScreen(
        onRestart: () => void,
        stats: { time: string; deaths: number; coins: number; kills: number }
    ) {
        this.hideDeathScreen();
        this.hidePauseMenu();
        this.isDeathScreenOpen = true;
        this.selectedDeathIndex = 0;

        if (this.scene.game.canvas) {
            this.scene.game.canvas.focus();
        }

        this.deathContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(150);

        const backdrop = this.scene.add.rectangle(this.deathModalX, this.deathModalY, this.scene.scale.width, this.scene.scale.height, 0x0a0000, 0.85);
        this.deathContainer.add(backdrop);

        const modalWidth = 420;
        const modalHeight = 300;
        const modalBg = this.scene.add.rectangle(this.deathModalX, this.deathModalY, modalWidth, modalHeight, 0x180808, 0.96)
            .setStrokeStyle(2.5, 0xef4444, 0.95);
        this.deathContainer.add(modalBg);

        const title = this.scene.add.text(this.deathModalX, this.deathModalY - 105, 'YOU DIED', {
            fontSize: '32px', fontFamily: 'Arial', color: '#ef4444', stroke: '#450a0a', strokeThickness: 5, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.deathContainer.add(title);

        this.scene.tweens.add({
            targets: title,
            scale: 1.06,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const subtitle = this.scene.add.text(this.deathModalX, this.deathModalY - 65, 'Press ENTER or SPACE to Try Again', {
            fontSize: '13px', fontFamily: 'Arial', color: '#fca5a5', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.deathContainer.add(subtitle);

        const statsBox = this.scene.add.rectangle(this.deathModalX, this.deathModalY - 18, 360, 50, 0x0f0404, 0.9)
            .setStrokeStyle(1.5, 0x7f1d1d);
        const statsText = this.scene.add.text(this.deathModalX, this.deathModalY - 18, `TIME: ${stats.time}   |   DEATHS: ${stats.deaths}\nCOINS: ${stats.coins}   |   KILLS: ${stats.kills}`, {
            fontSize: '12px', fontFamily: 'Arial', color: '#e2e8f0', align: 'center', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.deathContainer.add([statsBox, statsText]);

        this.deathOptions = [
            { id: 'restart', label: 'Try Again (Restart Stage)', action: onRestart }
        ];

        this.deathButtonBoxes = [];
        this.deathButtonLabels = [];

        const box = this.scene.add.rectangle(this.deathModalX, this.deathBtnY, this.deathBtnWidth, this.deathBtnHeight, 0xb91c1c, 0.95)
            .setStrokeStyle(2, 0xf87171);

        const label = this.scene.add.text(this.deathModalX, this.deathBtnY, this.deathOptions[0].label, {
            fontSize: '15px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2.5
        }).setOrigin(0.5);

        this.deathButtonBoxes.push(box);
        this.deathButtonLabels.push(label);
        this.deathContainer.add([box, label]);

        this.deathHighlight = this.scene.add.graphics();
        this.deathContainer.add(this.deathHighlight);

        this.updateDeathVisuals();
    }

    public updateDeathMenu() {
        // Handled via window & screen pointer listeners
    }

    private triggerCurrentDeathOption() {
        const opt = this.deathOptions[this.selectedDeathIndex];
        if (opt && opt.action) {
            this.soundManager?.playMenuSelect();
            opt.action();
        }
    }

    private updateDeathVisuals() {
        if (!this.isDeathScreenOpen || !this.deathHighlight) return;

        const activeBox = this.deathButtonBoxes[0];
        if (activeBox) {
            activeBox.setFillStyle(0xb91c1c, 0.95);
            activeBox.setStrokeStyle(2, 0xf87171);
            activeBox.setScale(1.02);
            if (this.deathButtonLabels[0]) {
                this.deathButtonLabels[0].setScale(1.02);
                this.deathButtonLabels[0].setColor('#ffffff');
            }

            this.deathHighlight.clear();
            this.deathHighlight.lineStyle(3, 0xfca5a5, 1);
            this.deathHighlight.strokeRoundedRect(
                activeBox.x - (activeBox.width * activeBox.scaleX / 2) - 3,
                activeBox.y - (activeBox.height * activeBox.scaleY / 2) - 3,
                (activeBox.width * activeBox.scaleX) + 6,
                (activeBox.height * activeBox.scaleY) + 6,
                6
            );
        }
    }
}
