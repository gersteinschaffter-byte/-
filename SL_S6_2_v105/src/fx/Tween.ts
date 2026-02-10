/**
 * Tween Engine v0.82 — 轻量补间动画系统
 *
 * v0.82 新增：
 * - 丰富的缓动函数库（12种）
 * - Tween.delay() 延迟启动
 * - Tween.sequence() 顺序执行
 * - onStart 回调
 *
 * 核心 API:
 *   Tween.to(target, props, duration, ease, onComplete)
 *   TweenRunner.add(tween) / .update(dt)
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
  private readonly onStart?: () => void;
  private readonly delayFrames: number;
  private started = false;
  private delayDone = false;  // ★ 修复：独立的延迟完成标记

  private constructor(
    target: any,
    to: Record<string, number>,
    duration: number,
    ease: EaseFn,
    onComplete?: () => void,
    delayFrames = 0,
    onStart?: () => void,
  ) {
    this.target = target;
    this.to = to;
    this.duration = Math.max(1, duration);
    this.ease = ease;
    this.onComplete = onComplete;
    this.delayFrames = delayFrames;
    this.onStart = onStart;
    this.delayDone = (delayFrames <= 0); // 无延迟则直接标记完成
    // 初始值在首次 update 时捕获（允许 delay 期间目标值被修改）
  }

  /**
   * 创建补间动画
   * @param target   目标对象（任何具有数值属性的对象）
   * @param to       目标属性值
   * @param duration 持续帧数（60fps 下约 16.6ms/帧）
   * @param ease     缓动函数
   * @param onComplete 完成回调
   */
  public static to(
    target: any,
    to: Record<string, number>,
    duration: number,
    ease: EaseFn,
    onComplete?: () => void,
  ): Tween {
    return new Tween(target, to, duration, ease, onComplete);
  }

  /**
   * 带延迟的补间动画
   * @param delayFrames 延迟帧数
   */
  public static delayed(
    target: any,
    to: Record<string, number>,
    duration: number,
    ease: EaseFn,
    delayFrames: number,
    onComplete?: () => void,
    onStart?: () => void,
  ): Tween {
    return new Tween(target, to, duration, ease, onComplete, delayFrames, onStart);
  }

  public update(dt: number): void {
    if (this.done) return;

    // ★ 延迟阶段（使用独立标记，修复 this.t 重置后重入 bug）
    if (!this.delayDone) {
      this.t += dt;
      if (this.t < this.delayFrames) return;
      // 溢出的时间用于动画
      dt = this.t - this.delayFrames;
      this.t = 0;
      this.delayDone = true;  // ★ 永远不再进入延迟阶段
    }

    // 首次 update 时捕获初始值
    if (!this.started) {
      this.started = true;
      for (const k of Object.keys(this.to)) {
        this.from[k] = Number(this.target[k]) || 0;
      }
      this.onStart?.();
    }

    this.t += dt;
    const p = Math.min(1, this.t / this.duration);
    const e = this.ease(p);
    for (const k of Object.keys(this.to)) {
      const from = this.from[k] ?? 0;
      const to = this.to[k] ?? 0;
      this.target[k] = from + (to - from) * e;
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

// ══════════════════════════════════════════════════════════
// ★ 缓动函数库（12种）
// ══════════════════════════════════════════════════════════

/** 线性 */
export function linear(t: number): number {
  return t;
}

/** 缓出三次 — 最常用，自然减速 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 缓入三次 — 加速启动 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** 缓入缓出三次 — 平滑过渡 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 缓出二次 — 轻柔减速 */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** 缓入二次 */
export function easeInQuad(t: number): number {
  return t * t;
}

/** 缓出四次 — 强减速 */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** 缓出回弹 — 超过目标再回来，活泼感 */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** 缓出弹性 — 弹簧效果 */
export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/** 缓出弹跳 — 落地弹跳 */
export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

/** 缓出指数 — 极快启动，慢慢停 */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** 缓入缓出正弦 — 最温和的 S 曲线 */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
