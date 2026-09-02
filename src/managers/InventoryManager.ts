// src/managers/InventoryManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';
import { SoundManager } from './SoundManager';

export interface HotbarSlot {
    id: 'gun' | 'totem' | 'checkpoint';
    name: string;
    keyLabel: string;
    iconTexture: string;
}

export class InventoryManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;
    private soundManager?: SoundManager;

    public selectedSlot: number = 0; // 0 = Gun, 1 = Totem, 2 = Checkpoint

    // Inventory counts
    public gunCount: number = 0;
    public totemCount: number = 0;
    public checkpointCount: number = 0;

    // Checkpoint placement state
    public checkpointTimer?: Phaser.Time.TimerEvent;
    private tempSpawnX?: number;
    private tempSpawnY?: number;
    private activeBeacon?: Phaser.GameObjects.Sprite;
    private beaconText?: Phaser.GameObjects.Text;

    // UI elements
    private hotbarContainer!: Phaser.GameObjects.Container;
    private slotBoxes: Phaser.GameObjects.Rectangle[] = [];
    private slotIcons: Phaser.GameObjects.Sprite[] = [];
    private slotCountTexts: Phaser.GameObjects.Text[] = [];
    private selectionHighlight!: Phaser.GameObjects.Graphics;
    private helperText!: Phaser.GameObjects.Text;

    // Input keys
    private keyE!: Phaser.Input.Keyboard.Key;
    private key1!: Phaser.Input.Keyboard.Key;
    private key2!: Phaser.Input.Keyboard.Key;
    private key3!: Phaser.Input.Keyboard.Key;

    private readonly slotsConfig: HotbarSlot[] = [
        { id: 'gun', name: 'Blaster Gun', keyLabel: '1', iconTexture: 'gun-powerup' },
        { id: 'totem', name: 'Shield Totem', keyLabel: '2', iconTexture: 'totem' },
        { id: 'checkpoint', name: 'Temp Checkpoint', keyLabel: '3', iconTexture: 'temp-checkpoint' }
    ];

    constructor(scene: Phaser.Scene, player: Player, uiManager: UIManager, soundManager?: SoundManager) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
        this.soundManager = soundManager;

        this.setupInputs();
        this.createHotbarUI();
    }

    public isTempCheckpointActive(): boolean {
        return !!(this.checkpointTimer && this.checkpointTimer.getRemaining() > 0);
    }

    private setupInputs() {
        if (!this.scene.input.keyboard) return;

        this.keyE = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.key1 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.key2 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this.key3 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);

        // Mouse Wheel Slot Cycling (Minecraft style)
        this.scene.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
            if (deltaY > 0) {
                this.selectSlot((this.selectedSlot + 1) % this.slotsConfig.length);
            } else if (deltaY < 0) {
                this.selectSlot((this.selectedSlot + this.slotsConfig.length - 1) % this.slotsConfig.length);
            }
        });
    }

    private createHotbarUI() {
        const slotSize = 42;
        const gap = 8;
        const totalWidth = (slotSize * 3) + (gap * 2);
        const startX = (1280 - totalWidth) / 2;
        const posY = 426; // Positioned at bottom with clean margin

        this.hotbarContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(20);

        // Background backing panel
        const bgPanel = this.scene.add.rectangle(1280 / 2, posY + (slotSize / 2), totalWidth + 14, slotSize + 10, 0x0f172a, 0.85)
            .setStrokeStyle(2, 0x334155, 0.9)
            .setOrigin(0.5);
        this.hotbarContainer.add(bgPanel);

        // Slots
        for (let i = 0; i < this.slotsConfig.length; i++) {
            const config = this.slotsConfig[i];
            const slotX = startX + (i * (slotSize + gap)) + (slotSize / 2);
            const slotY = posY + (slotSize / 2);

            // Slot Background Box
            const box = this.scene.add.rectangle(slotX, slotY, slotSize, slotSize, 0x1e293b, 0.9)
                .setStrokeStyle(1.5, 0x475569)
                .setInteractive({ useHandCursor: true });
            
            box.on('pointerdown', () => {
                this.selectSlot(i);
                if (i !== 0) this.useSelectedItem();
            });

            this.slotBoxes.push(box);
            this.hotbarContainer.add(box);

            // Slot Number Key Label (1, 2, 3)
            const numText = this.scene.add.text(slotX - (slotSize / 2) + 3, slotY - (slotSize / 2) + 2, config.keyLabel, {
                fontSize: '10px', fontFamily: 'Arial', color: '#94a3b8', fontStyle: 'bold'
            });
            this.hotbarContainer.add(numText);

            // Item Icon
            const icon = this.scene.add.sprite(slotX, slotY, config.iconTexture, 0)
                .setDisplaySize(22, 22)
                .setAlpha(0.35);
            this.slotIcons.push(icon);
            this.hotbarContainer.add(icon);

            // Item Count / Status Badge
            const countText = this.scene.add.text(slotX + (slotSize / 2) - 3, slotY + (slotSize / 2) - 2, '0', {
                fontSize: '11px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
            }).setOrigin(1, 1);
            this.slotCountTexts.push(countText);
            this.hotbarContainer.add(countText);
        }

        // Selection Highlight Border
        this.selectionHighlight = this.scene.add.graphics();
        this.hotbarContainer.add(this.selectionHighlight);

        // Contextual action prompt on TOP of hotbar with comfortable gap
        this.helperText = this.scene.add.text(1280 / 2, posY - 18, '[Space] Shoot', {
            fontSize: '12px', fontFamily: 'Arial', color: '#38bdf8', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.hotbarContainer.add(this.helperText);

        this.updateUI();
    }

    public selectSlot(index: number) {
        if (this.selectedSlot !== index) {
            this.soundManager?.playMenuSelect();
        }

        this.selectedSlot = Phaser.Math.Clamp(index, 0, this.slotsConfig.length - 1);
        
        // Gun does NOT need activation - if Gun slot is selected and player has gun, it is immediately ready to shoot
        if (this.selectedSlot === 0) {
            this.player.hasGun = this.gunCount > 0;
            if (this.player.hasGun) {
                this.player.setTint(0x00ffff);
            } else {
                if (this.player.hasTotem) this.player.setTint(0xffd700);
                else this.player.clearTint();
            }
        } else {
            // Holster gun when switching away to shield or checkpoint
            this.player.hasGun = false;
            if (this.player.hasTotem) this.player.setTint(0xffd700);
            else this.player.clearTint();
        }

        this.updateUI();
    }

    public addGun() {
        this.gunCount = 1;
        this.selectSlot(0); // Auto-select gun slot
        this.soundManager?.playPowerup();
        this.updateUI();
    }

    public addTotem() {
        this.totemCount++;
        this.soundManager?.playPowerup();
        this.updateUI();
    }

    public addCheckpoint() {
        this.checkpointCount++;
        this.soundManager?.playPowerup();
        this.updateUI();
    }

    public disarmGun() {
        this.gunCount = 0;
        this.player.hasGun = false;
        if (this.player.hasTotem) this.player.setTint(0xffd700);
        else this.player.clearTint();
        this.updateUI();
    }

    public useSelectedItem() {
        const slot = this.slotsConfig[this.selectedSlot];

        if (slot.id === 'gun') {
            return;
        } else if (slot.id === 'totem') {
            if (this.player.hasTotem) {
                this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'SHIELD ALREADY ACTIVE!', '#FFD700');
            } else if (this.totemCount > 0) {
                this.totemCount--;
                this.player.hasTotem = true;
                this.player.setTint(0xffd700);
                this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'SHIELD ACTIVATED!', '#FFD700');
                this.uiManager.spawnParticles(this.player.x, this.player.y, 0xFFD700);
                this.scene.cameras.main.shake(150, 0.006);
                this.soundManager?.playPowerup();
            } else {
                this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'NO SHIELD IN INVENTORY', '#EF4444');
            }
        } else if (slot.id === 'checkpoint') {
            if (this.checkpointCount > 0) {
                this.checkpointCount--;
                this.activateTempCheckpointAtPlayer();
            } else {
                this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'NO CHECKPOINT IN INVENTORY', '#EF4444');
            }
        }

        this.updateUI();
    }

    private activateTempCheckpointAtPlayer() {
        const placeX = Math.round(this.player.x);
        const placeY = Math.round(this.player.y);

        this.tempSpawnX = placeX;
        this.tempSpawnY = placeY;
        this.player.activeSpawnX = placeX;
        this.player.activeSpawnY = placeY;

        // Clear previous beacon if any
        if (this.activeBeacon && this.activeBeacon.active) {
            this.activeBeacon.destroy();
            this.activeBeacon = undefined;
        }
        if (this.beaconText && this.beaconText.active) {
            this.beaconText.destroy();
            this.beaconText = undefined;
        }
        if (this.checkpointTimer) {
            this.checkpointTimer.remove();
            this.checkpointTimer = undefined;
        }

        // Spawn visual beacon at placed coordinate
        this.activeBeacon = this.scene.add.sprite(placeX, placeY, 'temp-checkpoint')
            .setDepth(3.5)
            .play('cp-anim');

        this.beaconText = this.scene.add.text(placeX, placeY - 24, 'CP: 7s', {
            fontSize: '12px', fontFamily: 'Arial', color: '#D15FEE', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(4);

        this.uiManager.showFloatingText(placeX, placeY - 20, 'CHECKPOINT PLACED! (7s)', '#D15FEE');
        this.uiManager.spawnParticles(placeX, placeY, 0xD15FEE);
        this.scene.cameras.main.shake(150, 0.008);
        this.soundManager?.playCheckpoint();

        // 7-second countdown timer (allows unlimited respawns for full duration of this timer)
        this.checkpointTimer = this.scene.time.delayedCall(7000, () => {
            // Timer expired: restore active spawn back to the permanent base/door spawn
            this.player.activeSpawnX = this.player.spawnX;
            this.player.activeSpawnY = this.player.spawnY;
            this.checkpointTimer = undefined;
            this.tempSpawnX = undefined;
            this.tempSpawnY = undefined;

            if (this.activeBeacon && this.activeBeacon.active) {
                this.uiManager.spawnParticles(this.activeBeacon.x, this.activeBeacon.y, 0xD15FEE);
                this.activeBeacon.destroy();
                this.activeBeacon = undefined;
            }
            if (this.beaconText && this.beaconText.active) {
                this.beaconText.destroy();
                this.beaconText = undefined;
            }
            this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'CHECKPOINT EXPIRED', '#94A3B8');
            this.updateUI();
        });
    }

    public update() {
        // Keyboard slot selection
        if (Phaser.Input.Keyboard.JustDown(this.key1)) this.selectSlot(0);
        if (Phaser.Input.Keyboard.JustDown(this.key2)) this.selectSlot(1);
        if (Phaser.Input.Keyboard.JustDown(this.key3)) this.selectSlot(2);

        // Use item with E key (for Shield & Checkpoint)
        if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
            this.useSelectedItem();
        }

        // Update Beacon label
        if (this.checkpointTimer && this.checkpointTimer.getRemaining() > 0 && this.beaconText && this.beaconText.active) {
            const remSec = Math.ceil(this.checkpointTimer.getRemainingSeconds());
            this.beaconText.setText(`CP: ${remSec}s`);
        }
    }

    public updateUI() {
        // Update Gun Slot (0)
        this.slotIcons[0].setAlpha(this.gunCount > 0 ? 1 : 0.3);
        this.slotCountTexts[0].setText(this.gunCount > 0 ? 'READY' : '0');
        this.slotCountTexts[0].setColor(this.gunCount > 0 ? '#00FFFF' : '#FFFFFF');

        // Update Totem Slot (1)
        this.slotIcons[1].setAlpha((this.totemCount > 0 || this.player.hasTotem) ? 1 : 0.3);
        if (this.player.hasTotem) {
            this.slotCountTexts[1].setText(this.totemCount > 0 ? `+${this.totemCount} (ON)` : 'ON');
            this.slotCountTexts[1].setColor('#FFD700');
        } else {
            this.slotCountTexts[1].setText(this.totemCount > 0 ? `x${this.totemCount}` : '0');
            this.slotCountTexts[1].setColor('#FFFFFF');
        }

        // Update Checkpoint Slot (2)
        const cpActive = this.checkpointTimer && this.checkpointTimer.getRemaining() > 0;
        this.slotIcons[2].setAlpha((this.checkpointCount > 0 || cpActive) ? 1 : 0.3);
        if (cpActive) {
            const rem = Math.ceil(this.checkpointTimer!.getRemainingSeconds());
            this.slotCountTexts[2].setText(`${rem}s`);
            this.slotCountTexts[2].setColor('#D15FEE');
        } else {
            this.slotCountTexts[2].setText(this.checkpointCount > 0 ? `x${this.checkpointCount}` : '0');
            this.slotCountTexts[2].setColor('#FFFFFF');
        }

        // Draw Selection Highlight
        this.selectionHighlight.clear();
        const selectedBox = this.slotBoxes[this.selectedSlot];
        if (selectedBox) {
            this.selectionHighlight.lineStyle(3, 0x38bdf8, 1);
            this.selectionHighlight.strokeRoundedRect(
                selectedBox.x - (selectedBox.width / 2) - 2,
                selectedBox.y - (selectedBox.height / 2) - 2,
                selectedBox.width + 4,
                selectedBox.height + 4,
                4
            );
        }

        // Contextual action prompt on top of hotbar with clear margin
        if (this.selectedSlot === 0) {
            this.helperText.setText('[Space] Shoot');
            this.helperText.setColor('#00FFFF');
        } else if (this.selectedSlot === 1) {
            this.helperText.setText('[E] Use');
            this.helperText.setColor('#FFD700');
        } else if (this.selectedSlot === 2) {
            this.helperText.setText('[E] Use');
            this.helperText.setColor('#D15FEE');
        }
    }

    public onPlayerDeath() {
        // Player died: reset collected inventory items
        this.gunCount = 0;
        this.totemCount = 0;
        this.checkpointCount = 0;

        // If temp checkpoint is STILL ticking, KEEP player at the temp checkpoint!
        if (this.checkpointTimer && this.checkpointTimer.getRemaining() > 0 && this.tempSpawnX !== undefined && this.tempSpawnY !== undefined) {
            this.player.activeSpawnX = this.tempSpawnX;
            this.player.activeSpawnY = this.tempSpawnY;
        } else {
            // No active temp checkpoint: respawn at base spawn point
            this.player.activeSpawnX = this.player.spawnX;
            this.player.activeSpawnY = this.player.spawnY;
        }

        this.updateUI();
    }

    public resetAll() {
        // Full reset (e.g. on manual restart run)
        this.gunCount = 0;
        this.totemCount = 0;
        this.checkpointCount = 0;

        if (this.checkpointTimer) {
            this.checkpointTimer.remove();
            this.checkpointTimer = undefined;
        }

        this.tempSpawnX = undefined;
        this.tempSpawnY = undefined;
        this.player.activeSpawnX = this.player.spawnX;
        this.player.activeSpawnY = this.player.spawnY;

        if (this.activeBeacon && this.activeBeacon.active) {
            this.activeBeacon.destroy();
            this.activeBeacon = undefined;
        }
        if (this.beaconText && this.beaconText.active) {
            this.beaconText.destroy();
            this.beaconText = undefined;
        }

        this.selectedSlot = 0;
        this.updateUI();
    }
}
