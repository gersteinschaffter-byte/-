/**
 * A tiny tween engine (no external dependency).
 *
 * Why extract:
 * - BattleView originally contained an inline Tween implementation.
 * - Moving it to `src/fx` makes it reusable by any scene/UI component.
 *
 * Note: We keep the API intentionally small: `Tween.to()` + `TweenRunner.update()`.
 */

export type EaseFn = (t: number) => number;

export class Tween {
  public done = false;

  private t = 0;
  private readonly duration: number;
  private readonly from: Record<string, number> = {};
  private readonly to: Record<string, number>;
  private readonly target: any;
  private readonly ease: EaseFn;
  private readonly onComplete?: () => void;

  private constructor(target: any, to: Record<string, number>, duration: number, ease: EaseFn, onComplete?: () => void) {
    this.target = target;
    this.to = to;
    this.duration = Math.max(1, duration);
    this.ease = ease;
    this.onComplete = onComplete;
    for (const k of Object.keys(to)) {
      this.from[k] = Number(target[k]) || 0;
    }
  }

  public static to(target: any, to: Record<string, number>, duration: number, ease: EaseFn, onComplete?: () => void): Tween {
    return new Tween(target, to, duration, ease, onComplete);
  }


  public update(dt: number): void {
    if (this.done) return;
    this.t += dt;
    const p = Math.min(1, this.t / this.duration);
    const e = this.ease(p);
    for (const k of Object.keys(this.to)) {
      const from = this.from[k] ?? 0;
      const to = this.to[k] ?? 0;
      const v = from + (to - from) * e;
      this.target[k] = v;
    }
    if (p >= 1) {
      this.done = true;
      this.onComplete?.();
    }
  }
}

export class TweenRunner {
  private readonly tweens: Tween[] = [];

  public add(t: Tween): void {
    this.tweens.push(t);
  }

  public isIdle(): boolean {
    return this.tweens.length === 0;
  }

  public clear(): void {
    this.tweens.length = 0;
  }

  public update(dt: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const t = this.tweens[i];
      if (!t) continue;
      t.update(dt);
      if (t.done) this.tweens.splice(i, 1);
    }
  }
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
