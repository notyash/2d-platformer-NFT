// src/managers/InputRecorder.ts

export interface RecordedInputFrame {
  frame: number;
  keys: string[];
}

export class InputRecorder {
  private static instance: InputRecorder;
  private isRecording: boolean = false;
  private currentFrame: number = 0;
  private inputLog: RecordedInputFrame[] = [];
  private lastKeySignature: string = '';

  constructor() {}

  public static getInstance(): InputRecorder {
    if (!InputRecorder.instance) {
      InputRecorder.instance = new InputRecorder();
    }
    return InputRecorder.instance;
  }

  public start(): void {
    this.isRecording = true;
    this.currentFrame = 0;
    this.inputLog = [];
    this.lastKeySignature = '';
  }

  public stop(): void {
    this.isRecording = false;
  }

  public reset(): void {
    this.start();
  }

  /**
   * Log frame keystrokes if keys state changed
   */
  public logFrame(frame: number, activeKeys: string[]): void {
    if (!this.isRecording) return;
    this.currentFrame = frame;

    const signature = activeKeys.sort().join('|');
    if (signature !== this.lastKeySignature) {
      this.inputLog.push({
        frame,
        keys: [...activeKeys]
      });
      this.lastKeySignature = signature;
    }
  }

  public getInputs(): RecordedInputFrame[] {
    return [...this.inputLog];
  }

  public getFrameCount(): number {
    return this.currentFrame;
  }
}
