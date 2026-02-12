import { Container, Graphics, Sprite, Texture, BLEND_MODES } from 'pixi.js';
import ParticleSystem, { DustMotes } from '../../fx/ParticleSystem';
// ============================================================================
// GradientBackground v0.83 — 多层渐变背景系统 + 粒子
//
// 视觉分层（从后到前）:
//   Layer 0: 纵向线性渐变底色（canvas texture）
//   Layer 1: 大范围氛围光晕（3~4个柔和辐射圆）
//   Layer 2: 暗角（vignette）
//   Layer 3: 微光星点（静态随机分布，带闪烁）
//   Layer 4: 极细水平扫描线（科幻质感）
//   Layer 5: ★ 浮游尘埃粒子（ParticleSystem 驱动，ADD 混合）
//
// 性能策略:
//   - 渐变底色使用 canvas 生成一次性 texture（不每帧重绘）
//   - 氛围光晕仅在 resize 时重绘
//   - 星点闪烁通过 onUpdate 控制 alpha（无粒子系统开销）
//   - 扫描线用单张 Graphics 一次绘制
//   - 粒子系统使用对象池，零 GC 压力
// ============================================================================
/** 辅助：将 0xRRGGBB 拆成 [r,g,b] */
function hexToRgb(hex) {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}
/** 辅助：CSS rgba 字符串 */
function rgbaStr(r, g, b, a) {
    return `rgba(${r},${g},${b},${a})`;
}
// ── 配置 ─────────────────────────────────────────────
const BG_CONFIG = {
    // 纵向渐变色带（从上到下）
    gradientStops: [
        { pos: 0.0, color: 0x060b1a }, // 顶部：极深太空
        { pos: 0.25, color: 0x0a1230 }, // 上段：深邃蓝
        { pos: 0.5, color: 0x0d1b3e }, // 中间：靛蓝
        { pos: 0.75, color: 0x150e30 }, // 下段：暗紫
        { pos: 1.0, color: 0x0a0818 }, // 底部：深紫黑
    ],
    // 氛围光晕
    glowOrbs: [
        { cx: 0.20, cy: 0.15, radius: 0.35, color: 0x1e3a6e, alpha: 0.18 }, // 左上蓝光
        { cx: 0.80, cy: 0.18, radius: 0.30, color: 0x5b2d8e, alpha: 0.14 }, // 右上紫光
        { cx: 0.50, cy: 0.80, radius: 0.40, color: 0x1a4a5e, alpha: 0.12 }, // 底部青光
        { cx: 0.65, cy: 0.50, radius: 0.22, color: 0x3a1a6e, alpha: 0.08 }, // 中右微紫
    ],
    // 星点
    starCount: 50,
    starMinAlpha: 0.08,
    starMaxAlpha: 0.40,
    starMinSize: 0.8,
    starMaxSize: 2.2,
    // 扫描线
    scanLineAlpha: 0.025,
    scanLineGap: 4, // 像素间隔
    // 暗角强度
    vignetteAlpha: 0.45,
};
class GradientBackground extends Container {
    constructor() {
        super();
        // 各分层
        Object.defineProperty(this, "gradientSprite", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "glowLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "vignetteLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "starLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scanLineLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // ★ v0.83: 粒子层
        Object.defineProperty(this, "dustParticles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // 当前屏幕尺寸缓存
        Object.defineProperty(this, "screenW", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "screenH", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // 星点数据（resize 时生成一次）
        Object.defineProperty(this, "stars", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        // 渐变 texture 缓存（避免重复创建）
        Object.defineProperty(this, "gradientTex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        // 动画计时器
        Object.defineProperty(this, "elapsed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // ★ 性能优化：星点重绘节流（每 N 帧重绘一次）
        Object.defineProperty(this, "starFrameCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.name = 'GradientBackground';
        // Layer 0: 渐变底色 sprite
        this.gradientSprite = new Sprite();
        this.addChild(this.gradientSprite);
        // Layer 1: 氛围光晕
        this.glowLayer = new Graphics();
        this.addChild(this.glowLayer);
        // Layer 2: 暗角
        this.vignetteLayer = new Graphics();
        this.addChild(this.vignetteLayer);
        // Layer 3: 星点
        this.starLayer = new Graphics();
        this.addChild(this.starLayer);
        // Layer 4: 扫描线
        this.scanLineLayer = new Graphics();
        this.scanLineLayer.alpha = BG_CONFIG.scanLineAlpha;
        this.addChild(this.scanLineLayer);
        // ★ Layer 5: 浮游尘埃粒子（轻量）
        this.dustParticles = new ParticleSystem({ maxParticles: 30 });
        this.addChild(this.dustParticles);
    }
    // ── 公开方法 ───────────────────────────────────────
    /**
     * 当屏幕尺寸变化时调用（传入真实像素尺寸）。
     * 重新生成所有静态层。
     */
    resize(w, h) {
        if (w === this.screenW && h === this.screenH)
            return;
        this.screenW = w;
        this.screenH = h;
        this.rebuildGradientTexture(w, h);
        this.rebuildGlowOrbs(w, h);
        this.rebuildVignette(w, h);
        this.rebuildStars(w, h);
        this.rebuildScanLines(w, h);
        // ★ v0.83: 启动/更新粒子发射区域
        this.dustParticles.emitContinuous(DustMotes, w, h);
    }
    /**
     * 每帧调用，驱动星点闪烁动画。
     * @param dt PIXI ticker delta（~1 at 60fps）
     */
    onUpdate(dt) {
        this.elapsed += dt * 0.016; // 转为近似秒
        // ★ 性能优化：星点每 4 帧重绘一次（而非每帧）
        this.starFrameCounter++;
        if (this.starFrameCounter >= GradientBackground.STAR_REDRAW_INTERVAL) {
            this.starFrameCounter = 0;
            this.updateStarTwinkle();
        }
        // ★ v0.83: 驱动粒子
        this.dustParticles.onUpdate(dt);
    }
    // ── Layer 0: 纵向渐变 ─────────────────────────────
    rebuildGradientTexture(w, h) {
        // 销毁旧 texture
        if (this.gradientTex) {
            this.gradientTex.destroy(true);
            this.gradientTex = null;
        }
        // 使用 canvas 绘制平滑纵向渐变
        const canvas = document.createElement('canvas');
        // 渐变只需要 1px 宽度，然后 sprite 拉伸
        canvas.width = 1;
        canvas.height = Math.max(1, Math.round(h));
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        for (const stop of BG_CONFIG.gradientStops) {
            const [r, g, b] = hexToRgb(stop.color);
            grad.addColorStop(stop.pos, rgbaStr(r, g, b, 1));
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.gradientTex = Texture.from(canvas);
        this.gradientSprite.texture = this.gradientTex;
        this.gradientSprite.width = w;
        this.gradientSprite.height = h;
    }
    // ── Layer 1: 氛围光晕 ─────────────────────────────
    rebuildGlowOrbs(w, h) {
        const g = this.glowLayer;
        g.clear();
        const dim = Math.max(w, h);
        for (const orb of BG_CONFIG.glowOrbs) {
            const cx = orb.cx * w;
            const cy = orb.cy * h;
            const radius = orb.radius * dim;
            // 用同心圆模拟径向渐变（6 层由外到内逐渐加深）
            const rings = 8;
            for (let i = rings; i >= 0; i--) {
                const t = i / rings; // 1 = 最外圈, 0 = 圆心
                const r = radius * t;
                const alpha = orb.alpha * (1 - t) * (1 - t); // 二次衰减
                g.beginFill(orb.color, alpha);
                g.drawCircle(cx, cy, Math.max(1, r));
                g.endFill();
            }
        }
        // 添加模式：叠加使光晕更自然
        g.blendMode = BLEND_MODES.ADD;
    }
    // ── Layer 2: 暗角（vignette）───────────────────────
    rebuildVignette(w, h) {
        const g = this.vignetteLayer;
        g.clear();
        // 四边向内的暗角：用多层半透明矩形模拟
        const maxDim = Math.max(w, h) * 0.6;
        const steps = 6;
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const inset = maxDim * t * 0.15;
            const alpha = BG_CONFIG.vignetteAlpha * (1 - t) * 0.5;
            g.beginFill(0x000000, alpha);
            g.drawRect(0, 0, w, inset); // 顶边
            g.drawRect(0, h - inset, w, inset); // 底边
            g.drawRect(0, inset, inset, h - inset * 2); // 左边
            g.drawRect(w - inset, inset, inset, h - inset * 2); // 右边
            g.endFill();
        }
    }
    // ── Layer 3: 星点 ──────────────────────────────────
    rebuildStars(_w, _h) {
        // 用确定性随机种子保证每次 resize 星点位置一致
        this.stars = [];
        for (let i = 0; i < BG_CONFIG.starCount; i++) {
            const seed1 = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
            const seed2 = Math.sin(i * 78.233 + 12.9898) * 12345.6789;
            const seed3 = Math.sin(i * 43.12 + 29.91) * 98765.4321;
            this.stars.push({
                x: Math.abs(seed1 % 1),
                y: Math.abs(seed2 % 1),
                size: BG_CONFIG.starMinSize +
                    Math.abs(seed3 % 1) * (BG_CONFIG.starMaxSize - BG_CONFIG.starMinSize),
                baseAlpha: BG_CONFIG.starMinAlpha +
                    Math.abs((seed1 * seed2) % 1) * (BG_CONFIG.starMaxAlpha - BG_CONFIG.starMinAlpha),
                phase: Math.abs(seed3 % 1) * Math.PI * 2,
                speed: 0.3 + Math.abs((seed1 + seed2) % 1) * 1.2,
            });
        }
        // 首次绘制
        this.drawStars();
    }
    drawStars() {
        const g = this.starLayer;
        g.clear();
        const w = this.screenW;
        const h = this.screenH;
        if (w === 0 || h === 0)
            return;
        for (const star of this.stars) {
            const sx = star.x * w;
            const sy = star.y * h;
            const twinkle = Math.sin(this.elapsed * star.speed + star.phase) * 0.5 + 0.5;
            const alpha = star.baseAlpha * (0.3 + twinkle * 0.7);
            g.beginFill(0xffffff, alpha);
            g.drawCircle(sx, sy, star.size);
            g.endFill();
        }
    }
    /** 每帧更新星点闪烁（只重绘星点层） */
    updateStarTwinkle() {
        if (this.stars.length === 0 || this.screenW === 0)
            return;
        this.drawStars();
    }
    // ── Layer 4: 扫描线 ────────────────────────────────
    rebuildScanLines(w, h) {
        const g = this.scanLineLayer;
        g.clear();
        g.beginFill(0x000000, 1);
        for (let y = 0; y < h; y += BG_CONFIG.scanLineGap) {
            g.drawRect(0, y, w, 1);
        }
        g.endFill();
    }
    // ── 销毁 ───────────────────────────────────────────
    destroy() {
        if (this.gradientTex) {
            this.gradientTex.destroy(true);
            this.gradientTex = null;
        }
        super.destroy({ children: true });
    }
}
Object.defineProperty(GradientBackground, "STAR_REDRAW_INTERVAL", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 4
});
export default GradientBackground;
