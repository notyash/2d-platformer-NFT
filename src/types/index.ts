import Phaser from 'phaser';

export type Facing = 'left' | 'right';

export interface Firebar {
  pivotX: number;
  pivotY: number;
  angle: number;
  speed: number;
  segments: Phaser.GameObjects.Sprite[];
  distances: number[];
}