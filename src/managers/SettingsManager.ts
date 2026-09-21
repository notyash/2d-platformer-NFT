export interface GameSettings {
  masterVolume: number; // 0.0 to 1.0
  bgmVolume: number;    // 0.0 to 1.0
  sfxVolume: number;    // 0.0 to 1.0
  screenShake: boolean;
  particleQuality: 'high' | 'medium' | 'off';
}

const STORAGE_KEY = 'onion_boy_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  bgmVolume: 0.7,
  sfxVolume: 0.85,
  screenShake: true,
  particleQuality: 'high'
};

export class SettingsManager {
  private static instance: SettingsManager;
  private settings: GameSettings;
  private listeners: ((settings: GameSettings) => void)[] = [];

  constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  private loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          masterVolume: typeof parsed.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.masterVolume)) : DEFAULT_SETTINGS.masterVolume,
          bgmVolume: typeof parsed.bgmVolume === 'number' ? Math.max(0, Math.min(1, parsed.bgmVolume)) : DEFAULT_SETTINGS.bgmVolume,
          sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : DEFAULT_SETTINGS.sfxVolume,
          screenShake: typeof parsed.screenShake === 'boolean' ? parsed.screenShake : DEFAULT_SETTINGS.screenShake,
          particleQuality: ['high', 'medium', 'off'].includes(parsed.particleQuality) ? parsed.particleQuality : DEFAULT_SETTINGS.particleQuality
        };
      }
    } catch {
      // Ignore localStorage errors (e.g. incognito/iframe restrictions)
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore localStorage quota/permission issues
    }
    this.notifyListeners();
  }

  public getSettings(): Readonly<GameSettings> {
    return this.settings;
  }

  public setMasterVolume(vol: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public setBgmVolume(vol: number): void {
    this.settings.bgmVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public setSfxVolume(vol: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public setScreenShake(enabled: boolean): void {
    this.settings.screenShake = enabled;
    this.saveSettings();
  }

  public setParticleQuality(quality: 'high' | 'medium' | 'off'): void {
    this.settings.particleQuality = quality;
    this.saveSettings();
  }

  public getEffectiveSfxVolume(): number {
    return this.settings.masterVolume * this.settings.sfxVolume;
  }

  public getEffectiveBgmVolume(): number {
    return this.settings.masterVolume * this.settings.bgmVolume;
  }

  public subscribe(cb: (settings: GameSettings) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.settings));
  }
}
