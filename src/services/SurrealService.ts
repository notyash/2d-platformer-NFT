// src/services/SurrealService.ts
import { Surreal } from 'surrealdb';
import type { VerifiedRunPayload } from '../managers/SecurityManager';
import type { LeaderboardEntry } from '../managers/LeaderboardManager';

export interface SurrealRunSession {
  runId: string;
  startTime: number;
  stage: string;
}

export interface SurrealSubmitResult {
  success: boolean;
  verified: boolean;
  rank?: number;
  isWhitelisted?: boolean;
  message: string;
}

export class SurrealService {
  private static instance: SurrealService;
  private db: Surreal;
  private isConnected: boolean = false;
  private isAuthenticated: boolean = false;
  private isConnecting: boolean = false;

  private endpoint: string = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SURREAL_URL) || 'http://127.0.0.1:8000';
  private namespace: string = 'onion_game';
  private database: string = 'development';

  constructor() {
    this.db = new Surreal();
    this.tryConnect();
  }

  public static getInstance(): SurrealService {
    if (!SurrealService.instance) {
      SurrealService.instance = new SurrealService();
    }
    return SurrealService.instance;
  }

  public async tryConnect(): Promise<boolean> {
    if (this.isConnected) return true;
    if (this.isConnecting) return false;

    this.isConnecting = true;
    try {
      // Connect to SurrealDB instance (WS or HTTP)
      await this.db.connect(this.endpoint, {
        namespace: this.namespace,
        database: this.database
      });

      this.isConnected = true;
      console.log(`[SurrealDB] Connected successfully to ${this.endpoint} [NS: ${this.namespace}, DB: ${this.database}]`);
      return true;
    } catch (err) {
      this.isConnected = false;
      console.warn('[SurrealDB] Server connection pending or offline. Operating in fallback mode:', (err as Error).message);
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  public isOnline(): boolean {
    return this.isConnected;
  }

  /**
   * Authenticate player via Web3 wallet Record Access
   */
  public async signinWithWallet(walletAddress: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.tryConnect();
      }
      await this.db.signin({
        namespace: this.namespace,
        database: this.database,
        access: 'player_auth',
        variables: { wallet: walletAddress }
      });
      this.isConnected = true;
      this.isAuthenticated = true;
      console.log(`[SurrealDB] Authenticated player: ${walletAddress}`);
      return true;
    } catch (err) {
      this.isAuthenticated = false;
      console.warn('[SurrealDB] Wallet signin failed, continuing with fallback:', (err as Error).message);
      return false;
    }
  }

  public isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Start a new run session directly on SurrealDB backend
   */
  public async startRun(wallet: string = '0x0000000000000000000000000000000000000000', stage: string = 'stage1'): Promise<SurrealRunSession> {
    if (!this.isConnected) {
      await this.tryConnect();
    }

    if (this.isConnected) {
      try {
        const res = await this.db.query<[SurrealRunSession]>(
          'RETURN fn::start_run($wallet, $stage);',
          { wallet, stage }
        );
        if (res && res[0]) {
          return res[0];
        }
      } catch (err) {
        console.warn('[SurrealDB] fn::start_run failed, using client fallback:', err);
      }
    }

    // Client fallback session
    return {
      runId: `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      startTime: Date.now(),
      stage
    };
  }

  /**
   * Submit and verify run through SurrealDB fn::submit_run
   */
  public async submitRun(
    payload: VerifiedRunPayload,
    inputs: Array<{ frame: number; keys: string[] }>,
    playerName: string = 'Anonymous Player',
    walletAddress?: string
  ): Promise<SurrealSubmitResult> {
    const wallet = walletAddress || '0x0000000000000000000000000000000000000000';
    const score = (payload.totalCoins * 50) + (payload.totalKills * 100) - (payload.totalDeaths * 200) + Math.max(0, 5000 - Math.floor(payload.totalDurationMs / 100));
    const totalSecs = Math.floor(payload.totalDurationMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const hundredths = Math.floor((payload.totalDurationMs % 1000) / 10);
    const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;

    if (!this.isConnected) {
      await this.tryConnect();
    }

    if (this.isConnected) {
      try {
        const res = await this.db.query<[SurrealSubmitResult]>(
          `RETURN fn::submit_run(
            $run_id, 
            $wallet, 
            $username, 
            $duration_ms, 
            $formatted_time, 
            $score, 
            $coins, 
            $kills, 
            $deaths, 
            $inputs, 
            $final_hash
          );`,
          {
            run_id: payload.runId,
            wallet: wallet,
            username: playerName,
            duration_ms: payload.totalDurationMs,
            formatted_time: formattedTime,
            score: Math.max(0, score),
            coins: payload.totalCoins,
            kills: payload.totalKills,
            deaths: payload.totalDeaths,
            inputs: inputs,
            final_hash: payload.finalHash
          }
        );

        if (res && res[0]) {
          return res[0];
        }
      } catch (err) {
        console.warn('[SurrealDB] fn::submit_run failed, falling back to local verification:', err);
      }
    }

    // Local fallback evaluation
    return {
      success: payload.isLegitimate,
      verified: payload.isLegitimate,
      rank: 1,
      isWhitelisted: payload.isLegitimate,
      message: payload.isLegitimate ? 'Run verified locally (Offline Mode)' : `Verification failed: ${payload.validationFlags.join(', ')}`
    };
  }

  /**
   * Fetch live global leaderboard from SurrealDB
   */
  public async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    if (!this.isConnected) {
      await this.tryConnect();
    }

    if (this.isConnected) {
      try {
        const res = await this.db.query<[any[]]>(
          'RETURN fn::get_leaderboard($limit);',
          { limit }
        );

        if (res && Array.isArray(res[0])) {
          return res[0].map((entry: any, index: number) => ({
            rank: index + 1,
            playerName: entry.username || 'Anonymous',
            walletAddress: entry.wallet,
            timeMs: entry.duration_ms,
            formattedTime: entry.formatted_time,
            score: entry.score,
            coins: entry.coins,
            kills: entry.kills,
            deaths: entry.deaths,
            verified: entry.verified,
            timestamp: new Date(entry.created_at).getTime(),
            runId: entry.run_id
          }));
        }
      } catch (err) {
        console.warn('[SurrealDB] fn::get_leaderboard query failed, using local cache:', err);
      }
    }

    return [];
  }
}
