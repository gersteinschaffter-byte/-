import { Container, Graphics } from 'pixi.js';
import { Tween, TweenRunner } from './Tween';

/**
 * FlashLine
 * A simple "slash" line used by the battle MVP.
 * Extracted so it can be reused by other scenes (summon, rewards, etc.).
 */
export function spawnFlashLine(
  parent: Container,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  runner: TweenRunner,
  opts?: { width?: number; color?: number; alpha?: number; inFrames?: number; outFrames?: number },
): void {
  const width = opts?.width ?? 6;
  const color = opts?.color ?? 0xffffff;
  const a = opts?.alpha ?? 0.65;
  const inFrames = opts?.inFrames ?? 4;
  const outFrames = opts?.outFrames ?? 10;

  const line = new Graphics();
  line.lineStyle(width, color, a);
  line.moveTo(x0, y0);
  line.lineTo(x1, y1);
  line.alpha = 0;
  parent.addChild(line);

  runner.add(
    Tween.to(line, { alpha: 1 }, inFrames, (t) => t, () => {
      runner.add(
        Tween.to(line, { alpha: 0 }, outFrames, (t) => t, () => {
          line.destroy();
        }),
      );
    }),
  );
}
