import type { Container } from 'pixi.js';
import {
  Tween,
  TweenRunner,
  easeOutCubic,
  easeOutBack,
  easeInCubic,
  linear,
  type EaseFn,
} from './Tween';

// ============================================================================
// SimpleAnimator — 高级动画工具类
//
// 设计原则：
//   1. 零外部依赖，仅依赖自研 Tween 引擎
//   2. 所有方法都返回 TweenRunner，调用方可以在 onUpdate 中驱动
//   3. 支持延迟和交错动画（stagger）
//   4. 帧数基准：60fps，1帧 ≈ 16.6ms
//
// 常用动画（帧数参考 @ 60fps）：
//   fadeIn      20帧(333ms)  — 淡入
//   fadeOut     15帧(250ms)  — 淡出
//   slideIn     25帧(416ms)  — 从方向飞入
//   slideOut    20帧(333ms)  — 飞出
//   popIn       18帧(300ms)  — 弹入（带回弹）
//   stagger     每项间隔 3~5帧 — 交错进入
// ============================================================================

/** 方向枚举 */
export type SlideDirection = 'left' | 'right' | 'up' | 'down';

/** 帧数常量（60fps 基准） */
const FRAMES = {
  fadeIn: 20,
  fadeOut: 15,
  slideIn: 25,
  slideOut: 20,
  popIn: 18,
  scaleIn: 22,
  staggerGap: 4,
};

/**
 * SimpleAnimator — 静态工具类
 *
 * 所有方法返回 TweenRunner，调用方需要在 update 循环中调用 runner.update(dt)。
 * 如果传入已有的 runner，动画会附加到该 runner（复用更新循环）。
 */
export default class SimpleAnimator {

  // ── 淡入 ──────────────────────────────────────────────

  /**
   * 淡入：alpha 从 0 → 1
   * @param target    目标 DisplayObject
   * @param duration  帧数（默认20帧≈333ms）
   * @param delay     延迟帧数
   * @param runner    复用已有 runner（可选）
   * @param ease      缓动函数（默认 easeOutCubic）
   */
  public static fadeIn(
    target: Container,
    duration = FRAMES.fadeIn,
    delay = 0,
    runner?: TweenRunner,
    ease: EaseFn = easeOutCubic,
  ): TweenRunner {
    const r = runner ?? new TweenRunner();
    target.alpha = 0;
    target.visible = true;
    r.add(Tween.delayed(target, { alpha: 1 }, duration, ease, delay));
    return r;
  }

  // ── 淡出 ──────────────────────────────────────────────

  /**
   * 淡出：alpha 从当前 → 0
   * @param hideOnComplete 完成后设置 visible = false
   */
  public static fadeOut(
    target: Container,
    duration = FRAMES.fadeOut,
    delay = 0,
    runner?: TweenRunner,
    ease: EaseFn = easeInCubic,
    hideOnComplete = true,
  ): TweenRunner {
    const r = runner ?? new TweenRunner();
    r.add(Tween.delayed(
      target,
      { alpha: 0 },
      duration,
      ease,
      delay,
      () => { if (hideOnComplete) target.visible = false; },
    ));
    return r;
  }

  // ── 滑入 ──────────────────────────────────────────────

  /**
   * 从指定方向滑入（位移 + 淡入）
   * @param direction 方向
   * @param distance  位移像素距离（默认80）
   * @param duration  帧数
   * @param delay     延迟帧数
   */
  public static slideIn(
    target: Container,
    direction: SlideDirection = 'right',
    distance = 80,
    duration = FRAMES.slideIn,
    delay = 0,
    runner?: TweenRunner,
    ease: EaseFn = easeOutCubic,
  ): TweenRunner {
    const r = runner ?? new TweenRunner();

    // 保存目标最终位置（假设已由 onResize 设定好）
    const finalX = target.x;
    const finalY = target.y;

    // 根据方向设置初始偏移
    switch (direction) {
      case 'left':
        target.x = finalX - distance;
        break;
      case 'right':
        target.x = finalX + distance;
        break;
      case 'up':
        target.y = finalY - distance;
        break;
      case 'down':
        target.y = finalY + distance;
        break;
    }

    target.alpha = 0;
    target.visible = true;

    // 位移动画
    const toProps: Record<string, number> = {};
    if (direction === 'left' || direction === 'right') {
      toProps.x = finalX;
    } else {
      toProps.y = finalY;
    }
    toProps.alpha = 1;

    r.add(Tween.delayed(target, toProps, duration, ease, delay));
    return r;
  }

  // ── 滑出 ──────────────────────────────────────────────

  /**
   * 向指定方向滑出（位移 + 淡出）
   */
  public static slideOut(
    target: Container,
    direction: SlideDirection = 'left',
    distance = 80,
    duration = FRAMES.slideOut,
    delay = 0,
    runner?: TweenRunner,
    ease: EaseFn = easeInCubic,
    hideOnComplete = true,
  ): TweenRunner {
    const r = runner ?? new TweenRunner();

    const toProps: Record<string, number> = { alpha: 0 };
    switch (direction) {
      case 'left':
        toProps.x = target.x - distance;
        break;
      case 'right':
        toProps.x = target.x + distance;
        break;
      case 'up':
        toProps.y = target.y - distance;
        break;
      case 'down':
        toProps.y = target.y + distance;
        break;
    }

    r.add(Tween.delayed(
      target,
      toProps,
      duration,
      ease,
      delay,
      () => { if (hideOnComplete) target.visible = false; },
    ));
    return r;
  }

  // ── 弹入（带回弹） ──────────────────────────────────

  /**
   * 弹入：scale 从 0 → 1 + 回弹缓动
   */
  public static popIn(
    target: Container,
    duration = FRAMES.popIn,
    delay = 0,
    runner?: TweenRunner,
  ): TweenRunner {
    const r = runner ?? new TweenRunner();
    target.alpha = 0;
    target.scale.set(0.3);
    target.visible = true;

    // scale 需要同时控制 x 和 y，使用 scale 的 proxy
    const proxy = { scaleX: 0.3, scaleY: 0.3, alpha: 0 };
    const syncFn = () => {
      target.scale.set(proxy.scaleX, proxy.scaleY);
      target.alpha = proxy.alpha;
    };

    // 用 Tween + 手动同步
    r.add(Tween.delayed(
      proxy,
      { scaleX: 1, scaleY: 1, alpha: 1 },
      duration,
      easeOutBack,
      delay,
      undefined,
      undefined,
    ));

    // 记住需要在 update 中手动同步 proxy → target
    // 我们用一个特殊的 wrapper tween 来做
    const syncTween = Tween.delayed(
      { _progress: 0 },
      { _progress: 1 },
      duration + delay + 2,
      linear,
      0,
      undefined,
      undefined,
    );
    // 覆盖 update 来同步
    const origUpdate = syncTween.update.bind(syncTween);
    syncTween.update = (dt: number) => {
      origUpdate(dt);
      syncFn();
    };
    r.add(syncTween);

    return r;
  }

  // ── 缩放淡入 ──────────────────────────────────────────

  /**
   * 缩放淡入：scale 0.85→1 + alpha 0→1（比 popIn 更柔和）
   */
  public static scaleIn(
    target: Container,
    duration = FRAMES.scaleIn,
    delay = 0,
    runner?: TweenRunner,
  ): TweenRunner {
    const r = runner ?? new TweenRunner();

    const proxy = { scaleX: 0.85, scaleY: 0.85, alpha: 0 };
    target.scale.set(0.85);
    target.alpha = 0;
    target.visible = true;

    r.add(Tween.delayed(
      proxy,
      { scaleX: 1, scaleY: 1, alpha: 1 },
      duration,
      easeOutCubic,
      delay,
    ));

    const syncTween = Tween.delayed(
      { _p: 0 },
      { _p: 1 },
      duration + delay + 2,
      linear,
    );
    const orig = syncTween.update.bind(syncTween);
    syncTween.update = (dt: number) => {
      orig(dt);
      target.scale.set(proxy.scaleX, proxy.scaleY);
      target.alpha = proxy.alpha;
    };
    r.add(syncTween);

    return r;
  }

  // ── 交错动画 ──────────────────────────────────────────

  /**
   * 对一组目标执行交错动画
   *
   * @param targets     目标数组
   * @param animFn      对每个目标调用的动画函数，接收 (target, delay, runner)
   * @param staggerDelay 每个目标之间的延迟帧数（默认4帧≈67ms）
   * @param runner       复用已有 runner（可选）
   *
   * @example
   * SimpleAnimator.stagger(
   *   [btn1, btn2, btn3],
   *   (target, delay, runner) => SimpleAnimator.slideIn(target, 'right', 60, 22, delay, runner),
   *   5,
   * );
   */
  public static stagger(
    targets: Container[],
    animFn: (target: Container, delay: number, runner: TweenRunner) => TweenRunner,
    staggerDelay = FRAMES.staggerGap,
    runner?: TweenRunner,
  ): TweenRunner {
    const r = runner ?? new TweenRunner();
    targets.forEach((target, index) => {
      animFn(target, index * staggerDelay, r);
    });
    return r;
  }

  // ── 场景过渡：交叉淡入淡出 ────────────────────────────

  /**
   * 场景交叉过渡（用于 SceneManager）
   *
   * @param oldRoot  旧场景 root
   * @param newRoot  新场景 root
   * @param duration 帧数
   * @param runner   复用已有 runner
   * @param onMidPoint 中间点回调（用于切换场景逻辑）
   * @param onComplete 完成回调
   */
  public static crossFade(
    oldRoot: Container | null,
    newRoot: Container,
    duration = 12,
    runner?: TweenRunner,
    onMidPoint?: () => void,
    onComplete?: () => void,
  ): TweenRunner {
    const r = runner ?? new TweenRunner();
    const halfDur = Math.max(1, Math.round(duration / 2));

    if (oldRoot) {
      // 旧场景淡出
      r.add(Tween.to(oldRoot, { alpha: 0 }, halfDur, easeInCubic, () => {
        onMidPoint?.();
        // 新场景淡入
        newRoot.alpha = 0;
        newRoot.visible = true;
        r.add(Tween.to(newRoot, { alpha: 1 }, halfDur, easeOutCubic, onComplete));
      }));
    } else {
      // 无旧场景，直接淡入
      newRoot.alpha = 0;
      newRoot.visible = true;
      onMidPoint?.();
      r.add(Tween.to(newRoot, { alpha: 1 }, halfDur, easeOutCubic, onComplete));
    }

    return r;
  }

  // ── 呼吸动画（持续循环） ──────────────────────────────

  /**
   * 创建呼吸脉动效果（alpha 或 scale 的持续循环）
   * 注意：这不使用 TweenRunner，而是返回一个 tick 函数
   * 调用方需要在 onUpdate 中调用该函数
   *
   * @param target     目标
   * @param property   'alpha' | 'scale'
   * @param min        最小值
   * @param max        最大值
   * @param speed      脉动速度（值越大越快）
   * @returns tick 函数 (dt: number) => void
   */
  public static breathe(
    target: Container,
    property: 'alpha' | 'scale' = 'alpha',
    min = 0.7,
    max = 1.0,
    speed = 2.0,
  ): (dt: number) => void {
    let elapsed = 0;
    return (dt: number) => {
      elapsed += dt * 0.016 * speed;
      const t = (Math.sin(elapsed) + 1) / 2; // 0~1 循环
      const value = min + t * (max - min);
      if (property === 'alpha') {
        target.alpha = value;
      } else {
        target.scale.set(value);
      }
    };
  }
}
