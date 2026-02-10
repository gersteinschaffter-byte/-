import { Container, Graphics, BLEND_MODES } from 'pixi.js';
import ParticleSystem, {} from '../fx/ParticleSystem';
import { Tween, TweenRunner, easeOutCubic } from '../fx/Tween';
import { spawnFloatingText } from '../fx/FloatingText';
import { spawnFlashLine } from '../fx/FlashLine';
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 战斗粒子预设
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/** 火球命中 — 橙红爆散 */
export const FireHitPreset = {
    rate: 0,
    life: [12, 28],
    speedX: [-4, 4],
    speedY: [-5, 2],
    accelY: 0.12,
    size: [2, 4.5],
    sizeEnd: [0.3, 0.8],
    alpha: [0.7, 1.0],
    alphaEnd: 0,
    colors: [0xff6633, 0xff9944, 0xffcc22, 0xffe088],
    emitZone: 'point',
    spread: 18,
    blendMode: BLEND_MODES.ADD,
    drawGlow: true,
};
/** 治疗 — 绿色上升光点 */
export const HealRisePreset = {
    rate: 0,
    life: [18, 36],
    speedX: [-1.2, 1.2],
    speedY: [-3.5, -1.5],
    accelY: -0.02,
    size: [1.5, 3.5],
    sizeEnd: [0.3, 0.6],
    alpha: [0.5, 0.9],
    alphaEnd: 0,
    colors: [0x54ff8d, 0x88ffbb, 0xaaffcc, 0xffffff],
    emitZone: 'point',
    spread: 30,
    blendMode: BLEND_MODES.ADD,
    drawGlow: true,
};
/** 横扫 / AOE — 宽幅散射 */
export const SweepImpactPreset = {
    rate: 0,
    life: [10, 22],
    speedX: [-6, 6],
    speedY: [-3, 3],
    accelY: 0.06,
    size: [1.5, 3.5],
    sizeEnd: [0.2, 0.5],
    alpha: [0.6, 1.0],
    alphaEnd: 0,
    colors: [0xffaa22, 0xffdd55, 0xffffff, 0xff8800],
    emitZone: 'point',
    spread: 40,
    blendMode: BLEND_MODES.ADD,
    drawGlow: false,
};
/** 中毒 — 紫色下坠 */
export const PoisonDripPreset = {
    rate: 0,
    life: [16, 30],
    speedX: [-1, 1],
    speedY: [0.8, 2.5],
    accelY: 0.04,
    size: [1.2, 2.8],
    sizeEnd: [0.3, 0.5],
    alpha: [0.5, 0.8],
    alphaEnd: 0,
    colors: [0xcc44ff, 0xaa22dd, 0xee88ff, 0x8833cc],
    emitZone: 'point',
    spread: 20,
    blendMode: BLEND_MODES.ADD,
    drawGlow: false,
};
/** 护盾 — 蓝色微光环绕 */
export const ShieldGlintPreset = {
    rate: 0,
    life: [14, 26],
    speedX: [-2, 2],
    speedY: [-2, 2],
    size: [1.2, 2.5],
    sizeEnd: [0.2, 0.5],
    alpha: [0.4, 0.8],
    alphaEnd: 0,
    colors: [0x66ccff, 0x88ddff, 0xaaeeff, 0xffffff],
    emitZone: 'point',
    spread: 35,
    blendMode: BLEND_MODES.ADD,
    drawGlow: true,
};
/** 阵亡 — 灰白碎片爆散 */
export const DeathShatterPreset = {
    rate: 0,
    life: [18, 40],
    speedX: [-5, 5],
    speedY: [-6, 2],
    accelY: 0.10,
    size: [2, 5],
    sizeEnd: [0.5, 1],
    alpha: [0.6, 1.0],
    alphaEnd: 0,
    colors: [0xaaaaaa, 0xcccccc, 0x888888, 0xffffff],
    emitZone: 'point',
    spread: 22,
    blendMode: BLEND_MODES.ADD,
    drawGlow: false,
    rotSpeed: [-0.06, 0.06],
};
/** 通用命中 — 白色微粒 */
export const HitSparkPreset = {
    rate: 0,
    life: [8, 18],
    speedX: [-3, 3],
    speedY: [-3, 3],
    size: [1, 3],
    sizeEnd: [0.2, 0.5],
    alpha: [0.5, 0.9],
    alphaEnd: 0,
    colors: [0xffffff, 0xddeeff, 0xbbccff],
    emitZone: 'point',
    spread: 12,
    blendMode: BLEND_MODES.ADD,
    drawGlow: false,
};
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 技能→粒子预设映射
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SKILL_HIT_FX = {
    sk_fireball: { preset: FireHitPreset, count: 14 },
    sk_sweep: { preset: SweepImpactPreset, count: 10 },
    sk_heal: { preset: HealRisePreset, count: 10 },
    sk_aura_heal: { preset: HealRisePreset, count: 8 },
    sk_shield: { preset: ShieldGlintPreset, count: 10 },
    sk_poison: { preset: PoisonDripPreset, count: 8 },
    sk_slow: { preset: ShieldGlintPreset, count: 6 },
    sk_warcry: { preset: FireHitPreset, count: 8 },
    sk_raging_inferno: { preset: FireHitPreset, count: 16 },
    sk_ember_guard: { preset: ShieldGlintPreset, count: 8 },
    sk_tidal_blessing: { preset: HealRisePreset, count: 12 },
    sk_frost_barrier: { preset: ShieldGlintPreset, count: 12 },
    sk_gale_combo: { preset: SweepImpactPreset, count: 12 },
    sk_haste_banner: { preset: HealRisePreset, count: 8 },
    sk_solar_judgment: { preset: FireHitPreset, count: 18 },
    sk_holy_aegis: { preset: ShieldGlintPreset, count: 12 },
    sk_nether_burst: { preset: PoisonDripPreset, count: 12 },
    sk_curse_mist: { preset: PoisonDripPreset, count: 10 },
};
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BattleFXManager — 集中管理所有战斗特效
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export class BattleFXManager {
    constructor(fxLayer, runner, arenaW, arenaH) {
        Object.defineProperty(this, "fxLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "runner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "particles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "arenaW", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "arenaH", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** 技能颜色缓存：actorId → { color, ttl } */
        Object.defineProperty(this, "skillColorCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        this.fxLayer = fxLayer;
        this.runner = runner;
        this.arenaW = arenaW;
        this.arenaH = arenaH;
        this.particles = new ParticleSystem({ maxParticles: 120 });
        this.fxLayer.addChild(this.particles);
    }
    /** 每帧调用 */
    update(dt) {
        this.particles.onUpdate(dt);
        for (const [id, v] of this.skillColorCache.entries()) {
            v.ttl -= dt;
            if (v.ttl <= 0)
                this.skillColorCache.delete(id);
        }
    }
    /** 清空所有特效 */
    clear() {
        this.particles.clearAll();
        this.skillColorCache.clear();
    }
    // ── 攻击线 ──
    attackLine(x0, y0, x1, y1, color = 0xffffff) {
        spawnFlashLine(this.fxLayer, x0, y0, x1, y1, this.runner, { color });
    }
    // ── 浮动文字 ──
    floatingText(text, x, y, opts) {
        spawnFloatingText(this.fxLayer, text, x, y, this.runner, opts);
    }
    // ── 技能颜色跟踪 ──
    setSkillColor(actorId, color) {
        this.skillColorCache.set(actorId, { color, ttl: 40 });
    }
    getSkillColor(actorId) {
        const c = this.skillColorCache.get(actorId);
        return c ? c.color : null;
    }
    // ── 技能命中粒子 ──
    /** 根据技能ID在目标位置爆发对应粒子 */
    skillHitParticles(skillId, x, y) {
        const fx = SKILL_HIT_FX[skillId];
        if (fx) {
            this.particles.burst(fx.preset, x, y, fx.count);
        }
    }
    /** 通用命中火花（无技能时使用） */
    hitSpark(x, y, count = 6) {
        this.particles.burst(HitSparkPreset, x, y, count);
    }
    // ── 治疗粒子 ──
    healParticles(x, y) {
        this.particles.burst(HealRisePreset, x, y, 10);
    }
    // ── 阵亡爆散 ──
    deathParticles(x, y) {
        this.particles.burst(DeathShatterPreset, x, y, 18);
    }
    // ── 全屏闪光 ──
    screenFlash(color, alpha = 0.18, lifeFrames = 16) {
        const flash = new Graphics();
        flash.beginFill(color, alpha);
        flash.drawRect(0, 0, this.arenaW, this.arenaH);
        flash.endFill();
        flash.alpha = 0;
        this.fxLayer.addChild(flash);
        const fadeIn = Math.max(2, (lifeFrames * 0.25) | 0);
        const fadeOut = Math.max(4, (lifeFrames * 0.75) | 0);
        this.runner.add(Tween.to(flash, { alpha: 1 }, fadeIn, easeOutCubic, () => {
            this.runner.add(Tween.to(flash, { alpha: 0 }, fadeOut, easeOutCubic, () => flash.destroy()));
        }));
    }
    // ── 扩散圆环 ──
    expandRing(x, y, color, radius = 60) {
        const ring = new Graphics();
        ring.lineStyle(3, color, 0.7);
        ring.drawCircle(0, 0, 10);
        ring.position.set(x, y);
        ring.alpha = 0.9;
        this.fxLayer.addChild(ring);
        const scale = radius / 10;
        this.runner.add(Tween.to(ring, { alpha: 0 }, 20, easeOutCubic, () => ring.destroy()));
        this.runner.add(Tween.to(ring.scale, { x: scale, y: scale }, 20, easeOutCubic));
    }
}
