import { Container, Graphics, Text } from 'pixi.js';
import { createText, roundedRect } from '../ui/uiFactory';
import { BattleFXManager } from './BattleFX';
import ScrollView from '../ui/components/ScrollView';
import { Tween, TweenRunner, easeOutCubic } from '../fx/Tween';
import { getBuffJson } from './SkillDefs';
import FighterNode from './FighterNode';
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 配置常量
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ARENA_W = 700;
const ARENA_H = 980;
const LOG_H = 140;
const FIGHT_H = ARENA_H - LOG_H;
// ❷ 紧缩布局: 缩小间距
const Y_ENEMY = FIGHT_H * 0.24; // 敌方行（下移，拉开顶部密度）
const Y_ALLY = FIGHT_H * 0.74; // 我方行（下移，利用下方空间）
const Y_VS = FIGHT_H * 0.50; // VS 线（居中分隔）
/** 技能颜色映射 */
const SKILL_COLOR = {
    sk_fireball: 0xff6633, sk_sweep: 0xffaa22, sk_heal: 0x54ff8d,
    sk_aura_heal: 0x88ffcc, sk_warcry: 0xff4444, sk_shield: 0x66ccff,
    sk_poison: 0xcc44ff, sk_slow: 0x44ddff,
};
const DEFAULT_COLOR = 0xffee88;
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BattleView v0.95
//
// ❷ 紧缩布局 + 阵营标签
// ❸ VS 线增强 (alpha↑, 菱形装饰)
// ❹ 日志区初始隐藏 + 首日志淡入
// ❺ 角色呼吸浮动动画
// ❼ 回合标签居中
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default class BattleView {
    constructor() {
        Object.defineProperty(this, "root", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Container()
        });
        Object.defineProperty(this, "nodes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "fxLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Container()
        });
        Object.defineProperty(this, "uiLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Container()
        });
        Object.defineProperty(this, "runner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new TweenRunner()
        });
        Object.defineProperty(this, "fx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // UI 元素
        Object.defineProperty(this, "roundBg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "roundLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "resultLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "vsDivider", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enemyTag", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // ❷ 阵营标签
        Object.defineProperty(this, "allyTag", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // ❷ 阵营标签
        Object.defineProperty(this, "logBg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "logScroll", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "logText", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "logLines", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "logRevealed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        }); // ❹ 日志是否已显示
        // ❺ 呼吸动画计时
        Object.defineProperty(this, "breathTick", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // Buff 剩余回合跟踪
        Object.defineProperty(this, "buffTurns", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        // 事件分发表
        Object.defineProperty(this, "handlers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // ── 竞技场底板 ──
        const arena = new Graphics();
        arena.beginFill(0x0b1533, 0.65);
        roundedRect(arena, 0, 0, ARENA_W, ARENA_H, 32);
        arena.endFill();
        arena.lineStyle(2.5, 0x5fa6ff, 0.30);
        roundedRect(arena, 5, 5, ARENA_W - 10, ARENA_H - 10, 28);
        this.root.addChild(arena, this.fxLayer, this.uiLayer);
        // FX 管理器
        this.fx = new BattleFXManager(this.fxLayer, this.runner, ARENA_W, ARENA_H);
        // ❼ 回合标签（居中）
        this.roundBg = new Graphics();
        this.roundLabel = createText('回合 0', 20, 0xffffff, '900');
        this.roundLabel.anchor.set(0.5, 0);
        this.uiLayer.addChild(this.roundBg, this.roundLabel);
        this.paintRoundPill();
        // ❷ 阵营标签
        this.enemyTag = createText('— 敌 方 —', 13, 0xff6b7f, '700');
        this.enemyTag.anchor.set(0.5);
        this.enemyTag.alpha = 0.50;
        this.enemyTag.position.set(ARENA_W / 2, Y_ENEMY - 68);
        this.uiLayer.addChild(this.enemyTag);
        this.allyTag = createText('— 我 方 —', 13, 0x6bb8ff, '700');
        this.allyTag.anchor.set(0.5);
        this.allyTag.alpha = 0.50;
        this.allyTag.position.set(ARENA_W / 2, Y_ALLY - 68);
        this.uiLayer.addChild(this.allyTag);
        // ❸ VS 分割线（增强）
        this.vsDivider = new Container();
        this.uiLayer.addChild(this.vsDivider);
        this.paintVsDivider();
        // ❹ 日志区（初始隐藏）
        const logY = ARENA_H - LOG_H - 12;
        this.logBg = new Graphics();
        this.logBg.position.set(14, logY);
        this.logScroll = new ScrollView(ARENA_W - 28, LOG_H);
        this.logScroll.position.set(14, logY);
        this.logText = createText('', 14, 0xd7e6ff, '700');
        this.logText.position.set(10, 6);
        Object.assign(this.logText.style, { wordWrap: true, wordWrapWidth: ARENA_W - 48, lineHeight: 18 });
        this.logScroll.content.addChild(this.logText);
        this.uiLayer.addChild(this.logBg, this.logScroll);
        // ❹ 初始隐藏日志
        this.logBg.alpha = 0;
        this.logScroll.alpha = 0;
        this.logRevealed = false;
        this.paintLog();
        // ── 结果标签 ──
        this.resultLabel = createText('', 36, 0xffffff, '900');
        this.resultLabel.anchor.set(0.5);
        this.resultLabel.position.set(ARENA_W / 2, FIGHT_H / 2);
        this.resultLabel.visible = false;
        this.uiLayer.addChild(this.resultLabel);
        // ── 事件分发表 ──
        this.handlers = {
            roundStart: (p) => this.onRoundStart(p),
            actorTurn: (p) => this.onActorTurn(p),
            skillUse: (p) => this.onSkillUse(p),
            heal: (p) => this.onHeal(p),
            damage: (p) => this.onDamage(p),
            buffAdd: (p) => this.onBuffAdd(p),
            buffRemove: (p) => this.onBuffRemove(p),
            dead: (p) => this.onDead(p),
            battleEnd: (p) => this.onBattleEnd(p),
        };
    }
    // ━━ 公开 API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    isAnimating() { return !this.runner.isIdle(); }
    stopAllAnimations() { this.runner.clear(); }
    update(dt) {
        this.runner.update(dt);
        this.fx.update(dt);
        // ❺ 呼吸动画
        this.breathTick += dt;
        for (const node of this.nodes.values()) {
            if (node.isDead)
                continue;
            node.container.y = node.baseY + Math.sin(this.breathTick * 0.04 + node.phase) * 2.5;
        }
    }
    /** 构建战场 */
    build(teamA, teamB) {
        this.logLines.length = 0;
        this.logRevealed = false;
        this.logBg.alpha = 0;
        this.logScroll.alpha = 0;
        this.paintLog();
        this.clearFighters();
        this.fx.clear();
        this.breathTick = 0;
        const cx = ARENA_W / 2;
        this.placeTeam(teamA, 'A', cx, Y_ALLY);
        this.placeTeam(teamB, 'B', cx, Y_ENEMY);
        this.resultLabel.visible = false;
        this.resultLabel.text = '';
        this.roundLabel.text = '回合 0';
        this.paintRoundPill();
    }
    /** 处理战斗事件 */
    onEvent(e) {
        this.handlers[e.type]?.(e.payload);
    }
    // ━━ 事件处理器 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    onRoundStart(p) {
        this.roundLabel.text = `回合 ${p.round}`;
        this.paintRoundPill();
        this.pulse(this.roundLabel);
        this.log(`—— 回合 ${p.round} ——`);
        this.tickBuffTurns();
    }
    onActorTurn(p) {
        this.highlightActor(p.actorId);
        const node = this.nodes.get(p.actorId);
        if (node)
            node.flashTurn(this.runner);
        this.log(`${node?.getName() ?? p.actorId} 行动`);
    }
    onSkillUse(p) {
        const node = this.nodes.get(p.actorId);
        if (!node)
            return;
        const color = SKILL_COLOR[p.skillId] ?? DEFAULT_COLOR;
        this.fx.setSkillColor(p.actorId, color);
        node.flashColor(color, this.runner);
        this.fx.floatingText(`【${p.skillName}】`, node.x, node.y - 80, { color, fontSize: 20, rise: 50, life: 55 });
        if (p.skillId === 'sk_sweep')
            this.fx.screenFlash(color, 0.22, 18);
        this.fx.skillHitParticles(p.skillId, node.x, node.y);
        this.log(`${node.getName()} 使用【${p.skillName}】`);
    }
    onHeal(p) {
        const tar = this.nodes.get(p.targetId);
        if (!tar)
            return;
        tar.applyHeal(p.amount, p.targetHp, p.targetMaxHp, this.fx);
        this.fx.expandRing(tar.x, tar.y, 0x54ff8d);
        this.log(`${tar.getName()} +${p.amount}`);
    }
    onDamage(p) {
        const src = this.nodes.get(p.sourceId);
        const tar = this.nodes.get(p.targetId);
        if (!tar)
            return;
        if (p.sourceId === p.targetId) {
            tar.applyDamage(p.amount, p.targetHp, p.targetMaxHp, this.fx, this.runner, 0xcc44ff);
            this.log(`${tar.getName()} 持续伤害 -${p.amount}`);
            return;
        }
        if (src) {
            const lineColor = this.fx.getSkillColor(p.sourceId) ?? 0xffffff;
            src.playAttack(tar.x, tar.y, this.fx, lineColor);
        }
        const eb = p.elementBonus;
        let dmgColor;
        let tag = '';
        if (eb != null && eb > 1) {
            dmgColor = 0xff8800;
            tag = ' 克制!';
            this.fx.floatingText('克制！', tar.x + 40, tar.y - 50, { color: 0xff8800, fontSize: 16, rise: 32, life: 38 });
        }
        else if (eb != null && eb < 1) {
            dmgColor = 0x88aacc;
            tag = ' 抵抗';
            this.fx.floatingText('抵抗', tar.x + 40, tar.y - 50, { color: 0x88aacc, fontSize: 16, rise: 32, life: 38 });
        }
        tar.applyDamage(p.amount, p.targetHp, p.targetMaxHp, this.fx, this.runner, dmgColor);
        const sname = src?.getName() ?? p.sourceId;
        this.log(`${sname} → ${tar.getName()} -${p.amount}${tag}`);
    }
    onBuffAdd(p) {
        const tar = this.nodes.get(p.targetId);
        if (!tar)
            return;
        const def = getBuffJson(p.buffId);
        const icon = def?.icon ?? '✦';
        const name = def?.name ?? p.buffId;
        const dur = def?.durationRounds;
        tar.addBuff(p.buffId, icon, dur);
        if (dur != null && Number.isFinite(dur) && dur > 0) {
            if (!this.buffTurns.has(p.targetId))
                this.buffTurns.set(p.targetId, new Map());
            this.buffTurns.get(p.targetId).set(p.buffId, dur | 0);
            tar.updateBuffTurns(p.buffId, dur | 0);
        }
        this.fx.floatingText(`${icon}${name}`, tar.x, tar.y - 70, { color: 0xffee88, fontSize: 18 });
        if (p.buffId.toLowerCase().includes('poison') || name.includes('毒'))
            tar.flashPoison(this.runner);
        if (p.buffId.includes('shield'))
            this.fx.skillHitParticles('sk_shield', tar.x, tar.y);
        this.log(`${tar.getName()} 获得 ${icon}${name}`);
    }
    onBuffRemove(p) {
        this.nodes.get(p.targetId)?.removeBuff(p.buffId);
        this.buffTurns.get(p.targetId)?.delete(p.buffId);
    }
    onDead(p) {
        const tar = this.nodes.get(p.targetId);
        if (!tar)
            return;
        tar.playDeath(this.fx, this.runner);
        this.log(`${tar.getName()} 倒下了`);
    }
    onBattleEnd(p) {
        const text = p.winner === 'Draw' ? '平局'
            : p.winner === 'A' ? '我方胜利！' : '敌方胜利…';
        this.resultLabel.text = text;
        this.resultLabel.visible = true;
        this.pulse(this.resultLabel);
        this.log(`结果：${text}`);
    }
    // ━━ 内部辅助 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    clearFighters() {
        for (const n of this.nodes.values())
            n.destroy();
        this.nodes.clear();
        this.buffTurns.clear();
        this.fxLayer.removeChildren();
        this.fx = new BattleFXManager(this.fxLayer, this.runner, ARENA_W, ARENA_H);
    }
    placeTeam(team, side, cx, baseY) {
        const count = Math.min(5, team.length);
        const xs = this.computeXPositions(count, cx);
        const slideDir = side === 'A' ? 80 : -80;
        for (let i = 0; i < count; i++) {
            const f = team[i];
            const node = new FighterNode(f);
            node.baseY = baseY; // ❺ 记录基准 Y
            node.container.position.set(xs[i], baseY + slideDir);
            node.container.alpha = 0;
            this.nodes.set(f.id, node);
            this.fxLayer.addChild(node.container);
            this.runner.add(Tween.to(node.container, { y: baseY, alpha: 1 }, 18, easeOutCubic));
        }
    }
    computeXPositions(count, cx) {
        if (count <= 1)
            return [cx];
        const step = Math.min(176, 600 / (count - 1));
        const start = cx - (step * (count - 1)) / 2;
        return Array.from({ length: count }, (_, i) => start + step * i);
    }
    highlightActor(actorId) {
        for (const [id, n] of this.nodes) {
            if (n.isDead) {
                n.setActive(false);
                n.container.alpha = Math.min(n.container.alpha, 0.15);
                continue;
            }
            const active = id === actorId;
            n.setActive(active);
            n.container.alpha = active ? 1 : 0.80;
        }
    }
    tickBuffTurns() {
        for (const [fid, map] of this.buffTurns) {
            const node = this.nodes.get(fid);
            for (const [bid, t] of map) {
                const next = Math.max(0, t - 1);
                map.set(bid, next);
                node?.updateBuffTurns(bid, next);
            }
        }
    }
    // ── UI 绘制 ──
    /** ❼ 回合标签居中 pill */
    paintRoundPill() {
        const px = 16, py = 5;
        const w = Math.max(110, this.roundLabel.width + px * 2);
        const h = Math.max(30, this.roundLabel.height + py * 2);
        const x0 = (ARENA_W - w) / 2;
        const y0 = 10;
        this.roundBg.clear();
        this.roundBg.beginFill(0x000000, 0.35);
        roundedRect(this.roundBg, x0, y0, w, h, 14);
        this.roundBg.endFill();
        this.roundBg.lineStyle(1.5, 0x5fa6ff, 0.25);
        roundedRect(this.roundBg, x0, y0, w, h, 14);
        this.roundLabel.position.set(ARENA_W / 2, y0 + py);
    }
    /** ❸ VS 增强：更亮虚线 + 菱形装饰 + VS 文字更可见 */
    paintVsDivider() {
        this.vsDivider.removeChildren();
        const cy = Y_VS;
        const g = new Graphics();
        // 虚线 alpha 0.12→0.25
        g.lineStyle(1.5, 0x5fa6ff, 0.25);
        const margin = 50;
        const vsGap = 36; // VS 文字左右留空
        for (let x = margin; x < ARENA_W - margin; x += 24) {
            const x2 = Math.min(x + 14, ARENA_W - margin);
            // 跳过 VS 文字区域
            if (x + 14 > ARENA_W / 2 - vsGap && x < ARENA_W / 2 + vsGap)
                continue;
            g.moveTo(x, cy);
            g.lineTo(x2, cy);
        }
        // 菱形装饰
        const dSize = 5;
        g.lineStyle(0);
        g.beginFill(0x5fa6ff, 0.30);
        for (const dx of [-vsGap - 6, vsGap + 6]) {
            const px = ARENA_W / 2 + dx;
            g.moveTo(px, cy - dSize);
            g.lineTo(px + dSize, cy);
            g.lineTo(px, cy + dSize);
            g.lineTo(px - dSize, cy);
            g.closePath();
        }
        g.endFill();
        // VS 文字 alpha 0.20→0.45, 大一号
        const vs = createText('VS', 26, 0x5fa6ff, '900');
        vs.alpha = 0.45;
        vs.anchor.set(0.5);
        vs.position.set(ARENA_W / 2, cy);
        this.vsDivider.addChild(g, vs);
    }
    // ── 日志 ──
    /** ❹ 日志：首条淡入 */
    log(line) {
        if (!line)
            return;
        this.logLines.push(line);
        if (this.logLines.length > 40)
            this.logLines.splice(0, this.logLines.length - 40);
        this.paintLog();
        // ❹ 首次日志出现时淡入
        if (!this.logRevealed) {
            this.logRevealed = true;
            this.runner.add(Tween.to(this.logBg, { alpha: 1 }, 16, easeOutCubic));
            this.runner.add(Tween.to(this.logScroll, { alpha: 1 }, 16, easeOutCubic));
        }
    }
    paintLog() {
        const w = ARENA_W - 28;
        this.logBg.clear();
        this.logBg.beginFill(0x000000, 0.30);
        roundedRect(this.logBg, 0, 0, w, LOG_H, 14);
        this.logBg.endFill();
        this.logBg.lineStyle(1.5, 0x5fa6ff, 0.15);
        roundedRect(this.logBg, 0, 0, w, LOG_H, 14);
        this.logText.text = this.logLines.join('\n');
        this.logScroll.setContentHeight(Math.max(LOG_H, Math.ceil(this.logText.height + 16)));
        this.logScroll.scrollTo(999999);
    }
    // ── 动画辅助 ──
    pulse(label) {
        label.scale.set(1);
        this.runner.add(Tween.to(label.scale, { x: 1.08, y: 1.08 }, 8, easeOutCubic, () => {
            this.runner.add(Tween.to(label.scale, { x: 1, y: 1 }, 10, easeOutCubic));
        }));
    }
}
