import { Container, Graphics, BLEND_MODES } from 'pixi.js';
// ── 预设 ──────────────────────────────────────────────────
/** 缓慢漂浮的尘埃微粒 — 背景氛围（轻量版） */
export const DustMotes = {
    rate: 0.15,
    life: [350, 700],
    speedX: [-0.12, 0.12],
    speedY: [-0.20, -0.04],
    accelX: 0,
    accelY: -0.001,
    size: [1.2, 3.0],
    sizeEnd: [0.3, 0.8],
    alpha: [0.10, 0.25],
    alphaEnd: 0,
    colors: [0x69a8ff, 0x8b7aff, 0x4bcbff, 0xaaccff, 0xffffff],
    emitZone: 'fullscreen',
    blendMode: BLEND_MODES.ADD,
    drawGlow: false,
};
/** 向上飘升的光点 — 能量感 */
export const RisingMotes = {
    rate: 0.25,
    life: [180, 400],
    speedX: [-0.1, 0.1],
    speedY: [-0.5, -0.2],
    accelY: -0.002,
    size: [0.8, 2.0],
    sizeEnd: [0.2, 0.5],
    alpha: [0.12, 0.30],
    alphaEnd: 0,
    colors: [0x69a8ff, 0xaaccff, 0xffffff],
    emitZone: 'fullscreen',
    blendMode: BLEND_MODES.ADD,
    drawGlow: true,
};
/** 抽卡揭示爆发 — 中心放射 */
export const SummonBurst = {
    rate: 0, // burst 模式不用 rate
    life: [25, 55],
    speedX: [-5, 5],
    speedY: [-5, 5],
    accelX: 0,
    accelY: 0.05,
    size: [2, 5],
    sizeEnd: [0.5, 1],
    alpha: [0.6, 1.0],
    alphaEnd: 0,
    colors: [0xffd700, 0xffe88a, 0xffffff, 0xffb347, 0xc46cff],
    emitZone: 'point',
    spread: 8,
    blendMode: BLEND_MODES.ADD,
    drawGlow: true,
    rotSpeed: [-0.05, 0.05],
};
/** 卡片微光闪烁 — 静态环绕 */
export const CardSparkle = {
    rate: 0,
    life: [20, 40],
    speedX: [-1.5, 1.5],
    speedY: [-1.5, 1.5],
    size: [1, 3],
    sizeEnd: [0.3, 0.8],
    alpha: [0.5, 0.9],
    alphaEnd: 0,
    colors: [0xffffff, 0xffe88a, 0x69a8ff],
    emitZone: 'point',
    spread: 50,
    blendMode: BLEND_MODES.ADD,
    drawGlow: false,
};
/** SSR/SP 稀有度光效爆发 */
export const RarityBurst = {
    rate: 0,
    life: [30, 65],
    speedX: [-6, 6],
    speedY: [-6, 6],
    accelY: 0.04,
    size: [2.5, 6],
    sizeEnd: [0.3, 1],
    alpha: [0.7, 1.0],
    alphaEnd: 0,
    colors: [0xc46cff, 0xe08aff, 0xffffff, 0x8b7aff],
    emitZone: 'point',
    spread: 12,
    blendMode: BLEND_MODES.ADD,
    drawGlow: true,
    rotSpeed: [-0.08, 0.08],
};
// ── 辅助 ──────────────────────────────────────────────────
/** 范围随机 */
function rng(min, max) {
    return min + Math.random() * (max - min);
}
/** 随机选取数组元素 */
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
// ══════════════════════════════════════════════════════════
// ★ ParticleSystem
// ══════════════════════════════════════════════════════════
class ParticleSystem extends Container {
    constructor(opts) {
        super();
        Object.defineProperty(this, "pool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxParticles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "gfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // 持续发射状态
        Object.defineProperty(this, "continuousConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "emitAreaW", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "emitAreaH", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "emitAccum", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // 发射率累加器
        // ★ 性能：重绘节流
        Object.defineProperty(this, "redrawCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.maxParticles = opts?.maxParticles ?? 200;
        // 预分配对象池
        this.pool = [];
        for (let i = 0; i < this.maxParticles; i++) {
            this.pool.push({
                alive: false,
                x: 0, y: 0,
                vx: 0, vy: 0,
                ax: 0, ay: 0,
                size: 0, sizeEnd: 0,
                color: 0xffffff,
                alpha: 0, alphaEnd: 0,
                life: 0, maxLife: 1,
                rotation: 0, rotSpeed: 0,
            });
        }
        this.gfx = new Graphics();
        this.addChild(this.gfx);
    }
    // ── 持续发射 ────────────────────────────────────────────
    /**
     * 开始持续发射粒子（每帧自动按 rate 发射）
     * @param config  发射器配置
     * @param areaW   发射区域宽
     * @param areaH   发射区域高
     */
    emitContinuous(config, areaW, areaH) {
        this.continuousConfig = config;
        this.emitAreaW = areaW;
        this.emitAreaH = areaH;
        this.emitAccum = 0;
        this.gfx.blendMode = config.blendMode ?? BLEND_MODES.NORMAL;
    }
    /** 更新持续发射的区域尺寸（resize 时调用） */
    resizeEmitArea(w, h) {
        this.emitAreaW = w;
        this.emitAreaH = h;
    }
    /** 停止持续发射（已存在的粒子继续播完） */
    stopContinuous() {
        this.continuousConfig = null;
    }
    // ── 爆发发射 ────────────────────────────────────────────
    /**
     * 在指定位置爆发一批粒子
     * @param config  发射器配置
     * @param x       中心 x
     * @param y       中心 y
     * @param count   发射数量
     */
    burst(config, x, y, count) {
        // 爆发时临时设置混合模式
        this.gfx.blendMode = config.blendMode ?? BLEND_MODES.NORMAL;
        for (let i = 0; i < count; i++) {
            const p = this.getDeadParticle();
            if (!p)
                break;
            this.initParticle(p, config, x, y);
        }
    }
    // ── 每帧更新 ────────────────────────────────────────────
    /**
     * 每帧调用
     * @param dt PIXI ticker delta（~1 at 60fps）
     */
    onUpdate(dt) {
        const k = Math.min(3, Math.max(0.1, dt)); // 帧率保护
        // 持续发射
        if (this.continuousConfig && this.emitAreaW > 0) {
            this.emitAccum += this.continuousConfig.rate * k;
            while (this.emitAccum >= 1) {
                this.emitAccum -= 1;
                const p = this.getDeadParticle();
                if (p) {
                    const cfg = this.continuousConfig;
                    const ex = Math.random() * this.emitAreaW;
                    const ey = Math.random() * this.emitAreaH;
                    this.initParticle(p, cfg, ex, ey);
                }
            }
        }
        // 更新存活粒子
        for (const p of this.pool) {
            if (!p.alive)
                continue;
            p.life += k;
            if (p.life >= p.maxLife) {
                p.alive = false;
                continue;
            }
            // 物理
            p.vx += p.ax * k;
            p.vy += p.ay * k;
            p.x += p.vx * k;
            p.y += p.vy * k;
            p.rotation += p.rotSpeed * k;
        }
        // ★ 节流重绘：每 N 帧重绘一次
        this.redrawCounter++;
        if (this.redrawCounter >= ParticleSystem.REDRAW_INTERVAL) {
            this.redrawCounter = 0;
            this.redraw();
        }
    }
    // ── 获取活跃粒子数（调试用） ────────────────────────────
    getAliveCount() {
        let count = 0;
        for (const p of this.pool) {
            if (p.alive)
                count++;
        }
        return count;
    }
    /** 清空所有粒子 */
    clearAll() {
        for (const p of this.pool) {
            p.alive = false;
        }
        this.gfx.clear();
    }
    // ── 内部方法 ────────────────────────────────────────────
    getDeadParticle() {
        for (const p of this.pool) {
            if (!p.alive)
                return p;
        }
        return null; // 池满
    }
    initParticle(p, cfg, x, y) {
        p.alive = true;
        p.life = 0;
        p.maxLife = rng(cfg.life[0], cfg.life[1]);
        // 位置（带散布）
        const spread = cfg.spread ?? 0;
        p.x = x + (spread > 0 ? rng(-spread, spread) : 0);
        p.y = y + (spread > 0 ? rng(-spread, spread) : 0);
        // 速度
        p.vx = rng(cfg.speedX[0], cfg.speedX[1]);
        p.vy = rng(cfg.speedY[0], cfg.speedY[1]);
        // 加速度
        p.ax = cfg.accelX ?? 0;
        p.ay = cfg.accelY ?? 0;
        // 大小
        p.size = rng(cfg.size[0], cfg.size[1]);
        p.sizeEnd = cfg.sizeEnd ? rng(cfg.sizeEnd[0], cfg.sizeEnd[1]) : p.size;
        // Alpha
        p.alpha = rng(cfg.alpha[0], cfg.alpha[1]);
        p.alphaEnd = cfg.alphaEnd ?? p.alpha;
        // 颜色
        p.color = pick(cfg.colors);
        // 旋转
        p.rotation = Math.random() * Math.PI * 2;
        p.rotSpeed = cfg.rotSpeed ? rng(cfg.rotSpeed[0], cfg.rotSpeed[1]) : 0;
    }
    redraw() {
        const g = this.gfx;
        g.clear();
        let hasAlive = false;
        for (const p of this.pool) {
            if (!p.alive)
                continue;
            hasAlive = true;
            const t = p.maxLife > 0 ? p.life / p.maxLife : 1; // 0→1 生命进度
            const alpha = p.alpha + (p.alphaEnd - p.alpha) * t;
            const size = p.size + (p.sizeEnd - p.size) * t;
            if (alpha <= 0.005 || size <= 0.1)
                continue;
            // 光晕（大粒子）
            if (size > 1.5) {
                g.beginFill(p.color, alpha * 0.15);
                g.drawCircle(p.x, p.y, size * 3);
                g.endFill();
            }
            // 主体
            g.beginFill(p.color, alpha);
            g.drawCircle(p.x, p.y, size);
            g.endFill();
        }
        // 无活跃粒子时不留空 Graphics 指令
        if (!hasAlive) {
            g.clear();
        }
    }
    // ── 销毁 ────────────────────────────────────────────────
    destroy() {
        this.continuousConfig = null;
        this.pool.length = 0;
        super.destroy({ children: true });
    }
}
Object.defineProperty(ParticleSystem, "REDRAW_INTERVAL", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2
}); // 每 2 帧重绘一次
export default ParticleSystem;
