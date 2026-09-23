// src/managers/SecurityManager.ts

export interface SecurityEvent {
  type: 'START' | 'CHECKPOINT' | 'COIN_COLLECT' | 'ENEMY_KILL' | 'POWERUP' | 'DEATH' | 'FINISH';
  timestamp: number;
  data: Record<string, any>;
  hash: string;
}

export interface VerifiedRunPayload {
  runId: string;
  stageKey: string;
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  totalDeaths: number;
  totalCoins: number;
  totalKills: number;
  eventCount: number;
  finalHash: string;
  checksum: string;
  isLegitimate: boolean;
  validationFlags: string[];
}

export class SecurityManager {
  private static instance: SecurityManager;
  private runId: string = '';
  private startTime: number = 0;
  private endTime: number = 0;
  private stageKey: string = 'stage1';
  private events: SecurityEvent[] = [];
  private lastHash: string = 'GENESIS_ONION_BOY';
  private validationFlags: string[] = [];

  // Tracking state for cheat detection
  private lastSafePosition: { x: number; y: number; time: number } = { x: 0, y: 0, time: 0 };
  private maxObservedVelocity: number = 0;
  private totalCoins: number = 0;
  private totalKills: number = 0;
  private totalDeaths: number = 0;

  constructor() {
    this.startNewRun();
  }

  public static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  public startNewRun(stage: string = 'stage1'): void {
    this.stageKey = stage;
    this.startTime = Date.now();
    this.endTime = 0;
    this.runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.events = [];
    this.lastHash = this.simpleHash(`RUN_INIT_${this.runId}_${this.startTime}`);
    this.validationFlags = [];
    this.totalCoins = 0;
    this.totalKills = 0;
    this.totalDeaths = 0;
    this.maxObservedVelocity = 0;

    this.recordEvent('START', { stage, runId: this.runId });
  }

  public recordEvent(type: SecurityEvent['type'], data: Record<string, any> = {}): void {
    const timestamp = Date.now();
    const payloadStr = JSON.stringify({ type, timestamp, data, prevHash: this.lastHash });
    const hash = this.simpleHash(payloadStr);

    const event: SecurityEvent = {
      type,
      timestamp,
      data,
      hash
    };

    this.events.push(event);
    this.lastHash = hash;
  }

  public logPlayerPosition(x: number, y: number): void {
    const now = Date.now();
    if (this.lastSafePosition.time > 0) {
      const dt = (now - this.lastSafePosition.time) / 1000;
      if (dt > 0.05) {
        const dx = x - this.lastSafePosition.x;
        const dy = y - this.lastSafePosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const velocity = dist / dt;

        if (velocity > this.maxObservedVelocity) {
          this.maxObservedVelocity = velocity;
        }

        // Catch speedhacks / illegal warping (>1500px/s without jumppad/wind/teleport)
        if (velocity > 2200 && !this.hasRecentEvent('POWERUP', 1000)) {
          if (!this.validationFlags.includes('UNUSUAL_SPEED')) {
            this.validationFlags.push('UNUSUAL_SPEED');
          }
        }
      }
    }
    this.lastSafePosition = { x, y, time: now };
  }

  public recordCheckpoint(checkpointId: number, x: number, y: number): void {
    this.recordEvent('CHECKPOINT', { id: checkpointId, x: Math.round(x), y: Math.round(y) });
  }

  public recordCoinCollect(coinCount: number): void {
    this.totalCoins = coinCount;
    this.recordEvent('COIN_COLLECT', { count: coinCount });
  }

  public recordEnemyKill(mobType: string, method: 'stomp' | 'shoot', killCount: number): void {
    this.totalKills = killCount;
    this.recordEvent('ENEMY_KILL', { mobType, method, count: killCount });
  }

  public recordPowerup(type: 'gun' | 'totem'): void {
    this.recordEvent('POWERUP', { type });
  }

  public recordDeath(deathCount: number): void {
    this.totalDeaths = deathCount;
    this.recordEvent('DEATH', { count: deathCount });
  }

  public finishRun(coins: number, kills: number, deaths: number, exactNetDurationMs?: number): VerifiedRunPayload {
    this.endTime = Date.now();
    this.totalCoins = coins;
    this.totalKills = kills;
    this.totalDeaths = deaths;
    
    const totalDurationMs = (exactNetDurationMs !== undefined && exactNetDurationMs >= 0)
      ? exactNetDurationMs
      : (this.endTime - this.startTime);

    this.recordEvent('FINISH', { coins, kills, deaths, durationMs: totalDurationMs });

    // Plausibility verification
    const isPlausible = (
      totalDurationMs >= 5000 && // Minimum possible speedrun time
      this.validationFlags.length === 0 &&
      this.events.length >= 2
    );

    const checksumPayload = `${this.runId}:${this.startTime}:${this.endTime}:${totalDurationMs}:${coins}:${kills}:${deaths}:${this.lastHash}`;
    const checksum = this.simpleHash(checksumPayload);

    return {
      runId: this.runId,
      stageKey: this.stageKey,
      startTime: this.startTime,
      endTime: this.endTime,
      totalDurationMs,
      totalDeaths: this.totalDeaths,
      totalCoins: this.totalCoins,
      totalKills: this.totalKills,
      eventCount: this.events.length,
      finalHash: this.lastHash,
      checksum,
      isLegitimate: isPlausible,
      validationFlags: [...this.validationFlags]
    };
  }

  private hasRecentEvent(type: SecurityEvent['type'], windowMs: number): boolean {
    const now = Date.now();
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (now - this.events[i].timestamp > windowMs) break;
      if (this.events[i].type === type) return true;
    }
    return false;
  }

  public getRunId(): string {
    return this.runId;
  }
}
