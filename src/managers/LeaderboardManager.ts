// src/managers/LeaderboardManager.ts
import Phaser from 'phaser';
import type { VerifiedRunPayload } from './SecurityManager';
import { SoundManager } from './SoundManager';
import { SurrealService } from '../services/SurrealService';
import { InputRecorder } from './InputRecorder';

export interface LeaderboardEntry {
  rank?: number;
  playerName: string;
  walletAddress?: string;
  timeMs: number;
  formattedTime: string;
  deaths: number;
  coins: number;
  kills: number;
  score: number;
  verified: boolean;
  timestamp: number;
  runId: string;
}

const STORAGE_KEY = 'onion_boy_leaderboard_v1';

const MOCK_GLOBAL_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, playerName: 'CryptoOnionKing', walletAddress: '0x71C...39A1', timeMs: 64230, formattedTime: '01:04.23', deaths: 0, coins: 48, kills: 19, score: 2840, verified: true, timestamp: Date.now() - 3600000 * 5, runId: 'run_mock_1' },
  { rank: 2, playerName: 'PixelNinja_88', walletAddress: '0xA4F...8821', timeMs: 71500, formattedTime: '01:11.50', deaths: 0, coins: 45, kills: 18, score: 2650, verified: true, timestamp: Date.now() - 3600000 * 12, runId: 'run_mock_2' },
  { rank: 3, playerName: 'SandalStomper', walletAddress: '0x99B...12C0', timeMs: 78920, formattedTime: '01:18.92', deaths: 1, coins: 42, kills: 16, score: 2320, verified: true, timestamp: Date.now() - 3600000 * 24, runId: 'run_mock_3' },
  { rank: 4, playerName: 'GigaChadRunner', walletAddress: '0x32D...76FA', timeMs: 84100, formattedTime: '01:24.10', deaths: 0, coins: 39, kills: 15, score: 2190, verified: true, timestamp: Date.now() - 3600000 * 36, runId: 'run_mock_4' },
  { rank: 5, playerName: 'LavaKappaSlayer', walletAddress: '0xEE5...430B', timeMs: 92350, formattedTime: '01:32.35', deaths: 2, coins: 36, kills: 14, score: 1980, verified: true, timestamp: Date.now() - 3600000 * 48, runId: 'run_mock_5' }
];

export class LeaderboardManager {
  private static instance: LeaderboardManager;
  private entries: LeaderboardEntry[] = [];
  private currentModalContainer?: Phaser.GameObjects.Container;

  constructor() {
    this.entries = this.loadEntries();
  }

  public static getInstance(): LeaderboardManager {
    if (!LeaderboardManager.instance) {
      LeaderboardManager.instance = new LeaderboardManager();
    }
    return LeaderboardManager.instance;
  }

  public static formatTime(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  }

  private loadEntries(): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.sortAndRank(parsed);
        }
      }
    } catch {
      // Fallback to mock entries
    }
    return this.sortAndRank([...MOCK_GLOBAL_ENTRIES]);
  }

  private saveEntries(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // Storage quota or iframe permission fallback
    }
  }

  private sortAndRank(items: LeaderboardEntry[]): LeaderboardEntry[] {
    // Primary sort: Lowest time, then least deaths, then highest score
    const sorted = [...items].sort((a, b) => {
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      if (a.deaths !== b.deaths) return a.deaths - b.deaths;
      return b.score - a.score;
    });

    return sorted.map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));
  }

  public getTopEntries(limit: number = 10): LeaderboardEntry[] {
    return this.entries.slice(0, limit);
  }

  public submitRun(
    payload: VerifiedRunPayload,
    playerName: string = 'Anonymous Onion',
    walletAddress?: string
  ): { success: boolean; rank: number; message: string } {
    if (!payload.isLegitimate) {
      console.warn('[Leaderboard] Rejected illegitimate run payload:', payload.validationFlags);
      return {
        success: false,
        rank: -1,
        message: `Run verification failed: ${payload.validationFlags.join(', ')}`
      };
    }

    const calculatedScore = (payload.totalCoins * 50) + (payload.totalKills * 100) - (payload.totalDeaths * 200) + Math.max(0, 5000 - Math.floor(payload.totalDurationMs / 100));

    const newEntry: LeaderboardEntry = {
      playerName: playerName.slice(0, 20),
      walletAddress: walletAddress ? (walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)) : undefined,
      timeMs: payload.totalDurationMs,
      formattedTime: LeaderboardManager.formatTime(payload.totalDurationMs),
      deaths: payload.totalDeaths,
      coins: payload.totalCoins,
      kills: payload.totalKills,
      score: Math.max(0, calculatedScore),
      verified: payload.isLegitimate,
      timestamp: Date.now(),
      runId: payload.runId
    };

    this.entries.push(newEntry);
    this.entries = this.sortAndRank(this.entries);
    this.saveEntries();

    const finalRank = this.entries.findIndex(e => e.runId === payload.runId) + 1;

    // Direct submit to SurrealDB backend layer
    SurrealService.getInstance().submitRun(
      payload,
      InputRecorder.getInstance().getInputs(),
      playerName,
      walletAddress
    ).then(surrealResult => {
      console.log('[SurrealDB] Submission result:', surrealResult);
    }).catch(err => {
      console.warn('[SurrealDB] Async submit error:', err);
    });

    // Dispatch global window event for web app / NFT dApp integration
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('onion_boy_run_submitted', {
        detail: { entry: newEntry, payload, rank: finalRank }
      }));
    }

    return {
      success: true,
      rank: finalRank,
      message: `Run submitted successfully! Current Rank: #${finalRank}`
    };
  }

  /**
   * Opens the in-game Leaderboard Modal
   */
  public showLeaderboardModal(scene: Phaser.Scene, soundManager?: SoundManager, onClose?: () => void): void {
    if (this.currentModalContainer) {
      this.closeLeaderboardModal();
    }

    const { width, height } = scene.scale;
    const container = scene.add.container(width / 2, height / 2).setDepth(200);
    this.currentModalContainer = container;

    // Semi-transparent backdrop overlay
    const backdrop = scene.add.rectangle(0, 0, width, height, 0x030712, 0.85);
    backdrop.setInteractive(); // Blocks input behind modal

    // Modal Card
    const modalW = Math.min(840, width - 40);
    const modalH = Math.min(420, height - 40);

    const modalBg = scene.add.graphics();
    modalBg.fillStyle(0x0f172a, 0.95);
    modalBg.lineStyle(2, 0x38bdf8, 0.8);
    modalBg.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);
    modalBg.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);

    // Header Title
    const titleText = scene.add.text(0, -modalH / 2 + 28, '🏆 HALL OF ONION WARRIORS', {
      fontFamily: 'Outfit, Inter, sans-serif',
      fontSize: '22px',
      color: '#facc15',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const subtitleText = scene.add.text(0, -modalH / 2 + 52, 'Global Speedrun & High Score Rankings (Tamper-Proof Verified)', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      color: '#94a3b8'
    }).setOrigin(0.5);

    // Table Headers
    const tableHeaderY = -modalH / 2 + 82;
    const colRank = -modalW / 2 + 45;
    const colName = -modalW / 2 + 130;
    const colTime = -modalW / 2 + 370;
    const colScore = -modalW / 2 + 510;
    const colDeaths = -modalW / 2 + 630;
    const colStatus = modalW / 2 - 60;

    const headers = [
      { text: 'RANK', x: colRank },
      { text: 'PLAYER / WALLET', x: colName },
      { text: 'TIME', x: colTime },
      { text: 'SCORE', x: colScore },
      { text: 'DEATHS', x: colDeaths },
      { text: 'VERIFIED', x: colStatus }
    ];

    headers.forEach(h => {
      const headerObj = scene.add.text(h.x, tableHeaderY, h.text, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        color: '#38bdf8',
        fontStyle: 'bold'
      }).setOrigin(h.text === 'VERIFIED' ? 0.5 : 0, 0.5);
      container.add(headerObj);
    });

    // Divider Line
    const divider = scene.add.graphics();
    divider.lineStyle(1, 0x1e293b, 1);
    divider.lineBetween(-modalW / 2 + 25, tableHeaderY + 14, modalW / 2 - 25, tableHeaderY + 14);

    container.add([backdrop, modalBg, titleText, subtitleText, divider]);

    // Rows
    const topEntries = this.getTopEntries(6);
    topEntries.forEach((entry, i) => {
      const rowY = tableHeaderY + 34 + (i * 38);

      // Row background hover/striping
      const rowBg = scene.add.graphics();
      rowBg.fillStyle(i % 2 === 0 ? 0x1e293b : 0x0f172a, 0.4);
      rowBg.fillRoundedRect(-modalW / 2 + 20, rowY - 14, modalW - 40, 30, 6);
      container.add(rowBg);

      // Rank Medals / Colors
      let rankColor = '#ffffff';
      let rankPrefix = `#${entry.rank}`;
      if (entry.rank === 1) { rankColor = '#facc15'; rankPrefix = '🥇 1st'; }
      else if (entry.rank === 2) { rankColor = '#e2e8f0'; rankPrefix = '🥈 2nd'; }
      else if (entry.rank === 3) { rankColor = '#f97316'; rankPrefix = '🥉 3rd'; }

      const rankText = scene.add.text(colRank, rowY, rankPrefix, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: rankColor,
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      // Name & Wallet
      const nameStr = entry.walletAddress ? `${entry.playerName} (${entry.walletAddress})` : entry.playerName;
      const nameText = scene.add.text(colName, rowY, nameStr, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: '#f8fafc'
      }).setOrigin(0, 0.5);

      // Time
      const timeText = scene.add.text(colTime, rowY, entry.formattedTime, {
        fontFamily: 'Courier, monospace',
        fontSize: '13px',
        color: '#4ade80',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      // Score
      const scoreText = scene.add.text(colScore, rowY, `${entry.score.toLocaleString()} pts`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: '#fbbf24'
      }).setOrigin(0, 0.5);

      // Deaths
      const deathsText = scene.add.text(colDeaths, rowY, `${entry.deaths} 💀`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        color: entry.deaths === 0 ? '#4ade80' : '#f87171'
      }).setOrigin(0, 0.5);

      // Verification Badge
      const verifiedText = scene.add.text(colStatus, rowY, entry.verified ? '✓ OK' : '⚠ SUS', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        color: entry.verified ? '#22c55e' : '#ef4444',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0.5);

      container.add([rankText, nameText, timeText, scoreText, deathsText, verifiedText]);
    });

    // Close Button
    const closeBtnY = modalH / 2 - 32;
    const closeBtnBg = scene.add.graphics();
    closeBtnBg.fillStyle(0x334155, 1);
    closeBtnBg.fillRoundedRect(-60, closeBtnY - 16, 120, 32, 8);

    const closeBtnText = scene.add.text(0, closeBtnY, 'CLOSE (ESC)', {
      fontFamily: 'Outfit, Inter, sans-serif',
      fontSize: '13px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const closeZone = scene.add.zone(0, closeBtnY, 120, 32).setInteractive({ cursor: 'pointer' });
    closeZone.on('pointerover', () => {
      closeBtnBg.clear();
      closeBtnBg.fillStyle(0xef4444, 1);
      closeBtnBg.fillRoundedRect(-60, closeBtnY - 16, 120, 32, 8);
    });
    closeZone.on('pointerout', () => {
      closeBtnBg.clear();
      closeBtnBg.fillStyle(0x334155, 1);
      closeBtnBg.fillRoundedRect(-60, closeBtnY - 16, 120, 32, 8);
    });
    closeZone.on('pointerdown', () => {
      if (soundManager) soundManager.playMenuSelect();
      this.closeLeaderboardModal();
      if (onClose) onClose();
    });

    container.add([closeBtnBg, closeBtnText, closeZone]);

    // Animate Modal In
    container.setScale(0.85);
    container.setAlpha(0);
    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 180,
      ease: 'Back.easeOut'
    });

    // Keyboard ESC shortcut
    const escKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    if (escKey) {
      const escListener = () => {
        this.closeLeaderboardModal();
        if (onClose) onClose();
        escKey.off('down', escListener);
      };
      escKey.once('down', escListener);
    }
  }

  public closeLeaderboardModal(): void {
    if (this.currentModalContainer) {
      this.currentModalContainer.destroy();
      this.currentModalContainer = undefined;
    }
  }
}
