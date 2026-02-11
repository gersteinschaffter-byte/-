import { Container, Graphics, Text } from 'pixi.js';
import { createText, roundedRect } from '../ui/uiFactory';
import { Tween, TweenRunner, easeOutCubic } from '../fx/Tween';
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 常量
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ELEM = {
    '火': { icon: '🔥', tint: 0xff6633 },
    '水': { icon: '💧', tint: 0x33aaff },
    '风': { icon: '🌿', tint: 0x44cc66 },
    '光': { icon: '✨', tint: 0xffdd44 },
    '暗': { icon: '💀', tint: 0xbb66ff },
};
/** 方块几何参数 */
const Box = {
    W: 120, H: 100, HW: 60, HH: 50, R: 18, HPW: 108, HPH: 12,
};
/** 名字最大显示长度 */
const NAME_MAX_CHARS = 7;
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FighterNode v0.95
//
// ❶ 颜色区分增强: 更深底色+更亮边框+顶部色条
// ❺ 呼吸动画: 暴露 baseY / phase 给 BattleView 驱动
// ❻ 元素图标: 放大到名字标签左侧 "💧精英·史莱姆"
// ❽ 名字截断: 超7字符截断+"…"
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default class FighterNode {
    constructor(f) {
        Object.defineProperty(this, "container", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Container()
        });
        Object.defineProperty(this, "side", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isDead", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        /** 呼吸动画参数（由 BattleView 读取驱动） */
        Object.defineProperty(this, "baseY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "phase", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: Math.random() * Math.PI * 2
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxHp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shield", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxShield", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "destroyed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // 视觉层
        Object.defineProperty(this, "glowActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Graphics()
        });
        Object.defineProperty(this, "glowTurn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Graphics()
        });
        Object.defineProperty(this, "body", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Graphics()
        });
        Object.defineProperty(this, "bodySheen", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Graphics()
        });
        Object.defineProperty(this, "topStrip", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Graphics()
        }); // ❶ 顶部阵营色条
        Object.defineProperty(this, "hpBar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Graphics()
        });
        Object.defineProperty(this, "hpLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "nameLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Buff 栏
        Object.defineProperty(this, "buffBar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Container()
        });
        Object.defineProperty(this, "buffs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        this.name = f.name;
        this.hp = f.hp;
        this.maxHp = f.maxHp;
        this.shield = Math.max(0, Math.floor(f.shield ?? 0));
        this.maxShield = Math.max(1, Math.floor(f.maxShield ?? f.maxHp));
        this.side = f.side;
        const c = this.container;
        // ── 层级顺序 ──
        this.glowActive.visible = false;
        c.addChild(this.glowActive, this.glowTurn, this.body, this.bodySheen, this.topStrip);
        // ❻❽ 名字标签：emoji 元素 + 截断名字
        const elem = f.element ? ELEM[f.element] : null;
        const prefix = elem ? elem.icon : '';
        const displayName = f.name.length > NAME_MAX_CHARS
            ? f.name.slice(0, NAME_MAX_CHARS) + '…' : f.name;
        this.nameLabel = createText(`${prefix}${displayName}`, 15, 0xffffff, '800');
        this.nameLabel.anchor.set(0.5);
        this.nameLabel.position.set(0, -Box.HH - 16);
        c.addChild(this.nameLabel);
        // 汉字首字（方块内居中偏上）
        const glyph = createText((f.name || '?')[0], 36, 0xffffff, '900');
        glyph.anchor.set(0.5);
        glyph.position.set(0, -8);
        c.addChild(glyph);
        // ❻ 元素图标放大（方块内右上角作为辅助识别）
        if (elem) {
            const icon = createText(elem.icon, 18, 0xffffff, '400');
            icon.anchor.set(0.5);
            icon.position.set(Box.HW - 18, -Box.HH + 16);
            c.addChild(icon);
        }
        // HP 文字
        this.hpLabel = createText('', 12, 0xd7e6ff, '800');
        this.hpLabel.anchor.set(0.5);
        this.hpLabel.position.set(0, Box.HH - 22);
        c.addChild(this.hpLabel);
        // HP 条
        this.hpBar.position.set(-Box.HPW / 2, Box.HH - 14);
        c.addChild(this.hpBar);
        // Buff 栏
        this.buffBar.position.set(-Box.HW, Box.HH + 6);
        c.addChild(this.buffBar);
        this.paintBody();
        this.paintHp();
    }
    // ━━ 公开 API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    getName() { return this.name; }
    get x() { return this.container.x; }
    get y() { return this.container.y; }
    destroy() {
        this.destroyed = true;
        this.container.destroy({ children: true });
    }
    // ── 行动高亮 ──
    setActive(active) {
        if (this.destroyed || this.isDead) {
            this.glowActive.visible = false;
            return;
        }
        this.glowActive.visible = active;
        if (!active)
            return;
        this.paintGlow(this.glowActive, 10, 0xfff4a0, 0.08, 0.35);
    }
    flashTurn(runner) {
        if (this.destroyed)
            return;
        this.paintGlow(this.glowTurn, 8, 0xfff4a0, 0.18, 0);
        this.glowTurn.alpha = 1;
        runner.add(Tween.to(this.glowTurn, { alpha: 0 }, 20, easeOutCubic, () => {
            if (!this.destroyed)
                this.glowTurn.clear();
        }));
    }
    // ── 颜色闪烁 ──
    flashColor(color, runner) {
        this.spawnOverlayFlash(color, 0.35, 14, runner);
    }
    flashPoison(runner) {
        if (this.destroyed)
            return;
        const ov = this.createOverlay(0xcc44ff, 0.28);
        ov.alpha = 0;
        this.container.addChild(ov);
        const blink = (n) => {
            if (n <= 0 || this.destroyed) {
                this.safeRemove(ov);
                return;
            }
            runner.add(Tween.to(ov, { alpha: 1 }, 4, easeOutCubic, () => {
                runner.add(Tween.to(ov, { alpha: 0 }, 6, easeOutCubic, () => blink(n - 1)));
            }));
        };
        blink(3);
    }
    // ── 伤害 / 治疗 / 死亡 ──
    applyDamage(amount, hp, maxHp, shield, maxShield, fx, runner, color, absorbed = 0) {
        this.hp = hp;
        this.maxHp = maxHp;
        this.shield = Math.max(0, Math.floor(shield));
        this.maxShield = Math.max(1, Math.floor(maxShield || maxHp));
        this.paintHp();
        const ox = this.container.x;
        runner.add(Tween.to(this.container, { x: ox + 10 }, 3, easeOutCubic, () => {
            runner.add(Tween.to(this.container, { x: ox }, 7, easeOutCubic));
        }));
        const dmgText = absorbed > 0 ? `-${amount} (🛡-${absorbed})` : `-${amount}`;
        fx.floatingText(dmgText, this.x, this.y - Box.HH - 28, color != null ? { color } : undefined);
        fx.hitSpark(this.x, this.y, 5);
    }
    applyHeal(amount, hp, maxHp, shield, maxShield, fx) {
        this.hp = hp;
        this.maxHp = maxHp;
        this.shield = Math.max(0, Math.floor(shield));
        this.maxShield = Math.max(1, Math.floor(maxShield || maxHp));
        this.paintHp();
        fx.floatingText(`+${amount}`, this.x, this.y - Box.HH - 28, { color: 0x54ff8d });
        fx.healParticles(this.x, this.y);
    }
    applyShield(amount, shield, maxShield, fx) {
        this.shield = Math.max(0, Math.floor(shield));
        this.maxShield = Math.max(1, Math.floor(maxShield || this.maxHp));
        this.paintHp();
        fx.floatingText(`🛡+${amount}`, this.x, this.y - Box.HH - 28, { color: 0x66ccff });
        fx.healParticles(this.x, this.y);
    }
    playDeath(fx, runner) {
        if (this.isDead)
            return;
        this.isDead = true;
        this.setActive(false);
        fx.deathParticles(this.x, this.y);
        runner.add(Tween.to(this.container, { alpha: 0.12 }, 40, easeOutCubic));
        runner.add(Tween.to(this.container.scale, { x: 0.85, y: 0.85 }, 40, easeOutCubic));
    }
    playAttack(tx, ty, fx, color = 0xffffff) {
        fx.attackLine(this.x, this.y, tx, ty, color);
    }
    // ── Buff 图标 ──
    addBuff(buffId, icon, duration) {
        if (this.buffs.has(buffId))
            return;
        const root = new Container();
        const bg = new Graphics();
        bg.beginFill(0x000000, 0.4).drawRoundedRect(0, 0, 22, 22, 5).endFill();
        root.addChild(bg);
        const it = createText(icon, 14, 0xffffff, '800');
        it.position.set(3, 2);
        root.addChild(it);
        let tt;
        if (duration != null && Number.isFinite(duration) && duration > 0) {
            tt = createText(String(duration | 0), 10, 0xffee88, '900');
            tt.anchor.set(1, 1);
            tt.position.set(22, 22);
            root.addChild(tt);
        }
        this.buffs.set(buffId, { root, icon: it, turns: tt });
        this.buffBar.addChild(root);
        this.layoutBuffs();
    }
    updateBuffTurns(buffId, turns) {
        const b = this.buffs.get(buffId);
        if (!b?.turns || turns == null || !Number.isFinite(turns))
            return;
        b.turns.text = String(Math.max(0, turns | 0));
    }
    removeBuff(buffId) {
        const b = this.buffs.get(buffId);
        if (!b)
            return;
        this.buffBar.removeChild(b.root);
        b.root.destroy({ children: true });
        this.buffs.delete(buffId);
        this.layoutBuffs();
    }
    // ━━ 内部绘制 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    /** ❶ 增强颜色区分 */
    paintBody() {
        const isAlly = this.side === 'A';
        // 更深底色，拉大两阵营色差
        const base = isAlly ? 0x081e4a : 0x4a0810;
        // 更亮边框 + 高光
        const accent = isAlly ? 0x3aa7ff : 0xff4d6d;
        const g = this.body;
        g.clear();
        g.beginFill(base, 0.95);
        g.drawRoundedRect(-Box.HW, -Box.HH, Box.W, Box.H, Box.R);
        g.endFill();
        // ❶ 更亮边框 alpha 0.55→0.75
        g.lineStyle(2.5, accent, 0.75);
        g.drawRoundedRect(-Box.HW, -Box.HH, Box.W, Box.H, Box.R);
        // ❶ 上半高光 alpha 0.25→0.35
        const s = this.bodySheen;
        s.clear();
        s.beginFill(accent, 0.35);
        s.drawRoundedRect(-Box.HW + 1, -Box.HH + 1, Box.W - 2, Box.H * 0.45, Box.R);
        s.endFill();
        // ❶ 顶部 3px 亮色条（最醒目的阵营标识）
        const t = this.topStrip;
        t.clear();
        t.beginFill(accent, 0.85);
        t.drawRoundedRect(-Box.HW + 4, -Box.HH + 2, Box.W - 8, 4, 2);
        t.endFill();
    }
    paintHp() {
        if (this.destroyed)
            return;
        const hpRatio = this.maxHp > 0 ? Math.max(0, Math.min(1, this.hp / this.maxHp)) : 0;
        const shieldRatioByHp = this.maxHp > 0 ? Math.max(0, Math.min(1, this.shield / this.maxHp)) : 0;
        this.hpLabel.text = `${Math.max(0, this.hp | 0)}/${Math.max(0, this.maxHp | 0)}  🛡${Math.max(0, this.shield | 0)}`;
        const g = this.hpBar;
        g.clear();
        g.beginFill(0x000000, 0.45);
        roundedRect(g, 0, 0, Box.HPW, Box.HPH, 6);
        g.endFill();
        const innerW = Box.HPW - 4;
        const hpW = Math.max(0, innerW * hpRatio);
        if (hpW > 0) {
            const color = hpRatio > 0.5 ? 0x54ff8d : hpRatio > 0.25 ? 0xffcc33 : 0xff4444;
            g.beginFill(color, 0.9);
            roundedRect(g, 2, 2, hpW, Box.HPH - 4, 4);
            g.endFill();
        }
        const shieldW = Math.max(0, Math.min(innerW - hpW, innerW * shieldRatioByHp));
        if (shieldW > 0) {
            g.beginFill(0x66ccff, 0.92);
            roundedRect(g, 2 + hpW, 2, shieldW, Box.HPH - 4, 4);
            g.endFill();
        }
    }
    paintGlow(g, pad, color, fillA, strokeA) {
        g.clear();
        const x = -Box.HW - pad, y = -Box.HH - pad;
        const w = Box.W + pad * 2, h = Box.H + pad * 2;
        const r = Box.R + pad / 2;
        if (fillA > 0) {
            g.beginFill(color, fillA);
            g.drawRoundedRect(x, y, w, h, r);
            g.endFill();
        }
        if (strokeA > 0) {
            g.lineStyle(3, color, strokeA);
            g.drawRoundedRect(x, y, w, h, r);
        }
    }
    layoutBuffs() {
        let x = 0;
        for (const b of this.buffs.values()) {
            b.root.position.set(x, 0);
            x += 26;
        }
    }
    createOverlay(color, alpha) {
        const g = new Graphics();
        g.beginFill(color, alpha);
        g.drawRoundedRect(-Box.HW, -Box.HH, Box.W, Box.H, Box.R);
        g.endFill();
        return g;
    }
    spawnOverlayFlash(color, alpha, frames, runner) {
        if (this.destroyed)
            return;
        const ov = this.createOverlay(color, alpha);
        this.container.addChild(ov);
        runner.add(Tween.to(ov, { alpha: 0 }, frames, easeOutCubic, () => this.safeRemove(ov)));
    }
    safeRemove(g) {
        if (!this.destroyed)
            this.container.removeChild(g);
        g.destroy();
    }
}
