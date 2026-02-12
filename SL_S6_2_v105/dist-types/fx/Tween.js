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
export class Tween {
    constructor(target, to, duration, ease, onComplete, delayFrames = 0, onStart) {
        Object.defineProperty(this, "done", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "t", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "duration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "from", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "to", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "target", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ease", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onComplete", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onStart", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "delayFrames", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "started", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "delayDone", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        }); // ★ 修复：独立的延迟完成标记
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
    static to(target, to, duration, ease, onComplete) {
        return new Tween(target, to, duration, ease, onComplete);
    }
    /**
     * 带延迟的补间动画
     * @param delayFrames 延迟帧数
     */
    static delayed(target, to, duration, ease, delayFrames, onComplete, onStart) {
        return new Tween(target, to, duration, ease, onComplete, delayFrames, onStart);
    }
    update(dt) {
        if (this.done)
            return;
        // ★ 延迟阶段（使用独立标记，修复 this.t 重置后重入 bug）
        if (!this.delayDone) {
            this.t += dt;
            if (this.t < this.delayFrames)
                return;
            // 溢出的时间用于动画
            dt = this.t - this.delayFrames;
            this.t = 0;
            this.delayDone = true; // ★ 永远不再进入延迟阶段
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
    constructor() {
        Object.defineProperty(this, "tweens", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    add(t) {
        this.tweens.push(t);
    }
    isIdle() {
        return this.tweens.length === 0;
    }
    clear() {
        this.tweens.length = 0;
    }
    update(dt) {
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const t = this.tweens[i];
            if (!t)
                continue;
            t.update(dt);
            if (t.done)
                this.tweens.splice(i, 1);
        }
    }
}
// ══════════════════════════════════════════════════════════
// ★ 缓动函数库（12种）
// ══════════════════════════════════════════════════════════
/** 线性 */
export function linear(t) {
    return t;
}
/** 缓出三次 — 最常用，自然减速 */
export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
/** 缓入三次 — 加速启动 */
export function easeInCubic(t) {
    return t * t * t;
}
/** 缓入缓出三次 — 平滑过渡 */
export function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
/** 缓出二次 — 轻柔减速 */
export function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
}
/** 缓入二次 */
export function easeInQuad(t) {
    return t * t;
}
/** 缓出四次 — 强减速 */
export function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
}
/** 缓出回弹 — 超过目标再回来，活泼感 */
export function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
/** 缓出弹性 — 弹簧效果 */
export function easeOutElastic(t) {
    if (t === 0 || t === 1)
        return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}
/** 缓出弹跳 — 落地弹跳 */
export function easeOutBounce(t) {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1)
        return n1 * t * t;
    if (t < 2 / d1)
        return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1)
        return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
}
/** 缓出指数 — 极快启动，慢慢停 */
export function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
/** 缓入缓出正弦 — 最温和的 S 曲线 */
export function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}
