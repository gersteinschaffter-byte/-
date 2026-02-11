import { Container, Graphics, Text } from 'pixi.js';
import type { BattleEvent, FighterSnapshot, Side } from './BattleTypes';
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
const LOG_H   = 140;
const FIGHT_H = ARENA_H - LOG_H;

// ❷ 紧缩布局: 缩小间距
const Y_ENEMY = FIGHT_H * 0.24;   // 敌方行（下移，拉开顶部密度）
const Y_ALLY  = FIGHT_H * 0.74;   // 我方行（下移，利用下方空间）
const Y_VS    = FIGHT_H * 0.50;   // VS 线（居中分隔）

/** 技能颜色映射 */
const SKILL_COLOR: Record<string, number> = {
  sk_fireball: 0xff6633,
  sk_sweep: 0xffaa22,
  sk_heal: 0x54ff8d,
  sk_aura_heal: 0x88ffcc,
  sk_warcry: 0xff4444,
  sk_shield: 0x66ccff,
  sk_poison: 0xcc44ff,
  sk_slow: 0x66bbff,

  sk_thunderbolt: 0x7ab5ff,
  sk_blizzard: 0xa9e7ff,
  sk_berserk: 0xff5533,
  sk_weaken: 0xaa66ff,
  sk_ironwall: 0x66ccff,
  sk_haste: 0x7dffe0,
  sk_cleave: 0xffa53a,
  sk_smite: 0xffe07a,
  sk_revitalize: 0x71ffb0,
  sk_curse: 0xbb66ff,
  sk_mass_heal: 0x9dffcb,
  sk_empower: 0xffe6a6,

  sk_raging_inferno: 0xff6633,
  sk_ember_guard: 0xffaa55,
  sk_tidal_blessing: 0x66ddff,
  sk_frost_barrier: 0xa9e7ff,
  sk_gale_combo: 0x88ffcc,
  sk_haste_banner: 0x44ddff,
  sk_solar_judgment: 0xffe07a,
  sk_holy_aegis: 0x99ddff,
  sk_nether_burst: 0x8b76ff,
  sk_curse_mist: 0xaa44ff,
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
  public readonly root = new Container();

  private readonly nodes   = new Map<string, FighterNode>();
  private readonly fxLayer = new Container();
  private readonly uiLayer = new Container();
  private readonly runner  = new TweenRunner();
  private fx: BattleFXManager;

  // UI 元素
  private readonly roundBg: Graphics;
  private readonly roundLabel: Text;
  private readonly resultLabel: Text;
  private readonly vsDivider: Container;
  private readonly enemyTag: Text;    // ❷ 阵营标签
  private readonly allyTag: Text;     // ❷ 阵营标签
  private readonly logBg: Graphics;
  private readonly logScroll: ScrollView;
  private readonly logText: Text;
  private readonly logLines: string[] = [];
  private logRevealed = false;        // ❹ 日志是否已显示

  // ❺ 呼吸动画计时
  private breathTick = 0;

  // Buff 剩余回合跟踪
  private readonly buffTurns = new Map<string, Map<string, number>>();

  // 事件分发表
  private readonly handlers: Record<string, (p: any) => void>;

  constructor() {
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
      actorTurn:  (p) => this.onActorTurn(p),
      skillUse:   (p) => this.onSkillUse(p),
      heal:       (p) => this.onHeal(p),
      shield:     (p) => this.onShield(p),
      damage:     (p) => this.onDamage(p),
      buffAdd:    (p) => this.onBuffAdd(p),
      buffRemove: (p) => this.onBuffRemove(p),
      dead:       (p) => this.onDead(p),
      battleEnd:  (p) => this.onBattleEnd(p),
    };
  }

  // ━━ 公开 API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  isAnimating(): boolean { return !this.runner.isIdle(); }
  stopAllAnimations(): void { this.runner.clear(); }

  update(dt: number): void {
    this.runner.update(dt);
    this.fx.update(dt);

    // ❺ 呼吸动画
    this.breathTick += dt;
    for (const node of this.nodes.values()) {
      if (node.isDead) continue;
      node.container.y = node.baseY + Math.sin(this.breathTick * 0.04 + node.phase) * 2.5;
    }
  }

  /** 构建战场 */
  build(teamA: FighterSnapshot[], teamB: FighterSnapshot[]): void {
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
  onEvent(e: BattleEvent): void {
    this.handlers[e.type]?.(e.payload);
  }

  // ━━ 事件处理器 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private onRoundStart(p: { round: number }): void {
    this.roundLabel.text = `回合 ${p.round}`;
    this.paintRoundPill();
    this.pulse(this.roundLabel);
    this.log(`—— 回合 ${p.round} ——`);
    this.tickBuffTurns();
  }

  private onActorTurn(p: { actorId: string }): void {
    this.highlightActor(p.actorId);
    const node = this.nodes.get(p.actorId);
    if (node) node.flashTurn(this.runner);
    this.log(`${node?.getName() ?? p.actorId} 行动`);
  }

  private onSkillUse(p: { actorId: string; skillId: string; skillName: string }): void {
    const node = this.nodes.get(p.actorId);
    if (!node) return;

    const color = SKILL_COLOR[p.skillId] ?? DEFAULT_COLOR;
    this.fx.setSkillColor(p.actorId, color);
    this.fx.setRecentSkill(p.actorId, p.skillId);
    node.flashColor(color, this.runner);
    this.fx.floatingText(`【${p.skillName}】`, node.x, node.y - 80,
      { color, fontSize: 20, rise: 50, life: 55 });
    if (p.skillId === 'sk_sweep') this.fx.screenFlash(color, 0.22, 18);
    this.fx.skillHitParticles(p.skillId, node.x, node.y);
    this.log(`${node.getName()} 使用【${p.skillName}】`);
  }

  private onHeal(p: { targetId: string; amount: number; targetHp: number; targetMaxHp: number; targetShield?: number; targetMaxShield?: number }): void {
    const tar = this.nodes.get(p.targetId);
    if (!tar) return;
    tar.applyHeal(p.amount, p.targetHp, p.targetMaxHp, p.targetShield ?? 0, p.targetMaxShield ?? p.targetMaxHp, this.fx);
    this.fx.expandRing(tar.x, tar.y, 0x54ff8d);
    this.log(`${tar.getName()} +${p.amount}`);
  }

  private onShield(p: { sourceId: string; targetId: string; amount: number; targetShield: number; targetMaxShield: number }): void {
    const tar = this.nodes.get(p.targetId);
    if (!tar) return;
    tar.applyShield(p.amount, p.targetShield, p.targetMaxShield, this.fx);
    this.log(`${tar.getName()} 获得护盾 +${p.amount}`);
  }

  private onDamage(p: {
    sourceId: string; targetId: string; amount: number; absorbed?: number;
    targetHp: number; targetMaxHp: number; targetShield?: number; targetMaxShield?: number; elementBonus?: number;
  }): void {
    const src = this.nodes.get(p.sourceId);
    const tar = this.nodes.get(p.targetId);
    if (!tar) return;

    if (p.sourceId === p.targetId) {
      tar.applyDamage(p.amount, p.targetHp, p.targetMaxHp, p.targetShield ?? 0, p.targetMaxShield ?? p.targetMaxHp, this.fx, this.runner, 0xcc44ff, p.absorbed ?? 0);
      this.log(`${tar.getName()} 持续伤害 -${p.amount}`);
      return;
    }

    if (src) {
      const lineColor = this.fx.getSkillColor(p.sourceId) ?? 0xffffff;
      src.playAttack(tar.x, tar.y, this.fx, lineColor);

      const recentSkill = this.fx.getRecentSkill(p.sourceId);
      if (recentSkill) this.fx.skillHitParticles(recentSkill, tar.x, tar.y);
      else this.fx.hitSpark(tar.x, tar.y, 8);
    }

    const eb = p.elementBonus;
    let dmgColor: number | undefined;
    let tag = '';

    if (eb != null && eb > 1) {
      dmgColor = 0xff8800; tag = ' 克制!';
      this.fx.floatingText('克制！', tar.x + 40, tar.y - 50,
        { color: 0xff8800, fontSize: 16, rise: 32, life: 38 });
    } else if (eb != null && eb < 1) {
      dmgColor = 0x88aacc; tag = ' 抵抗';
      this.fx.floatingText('抵抗', tar.x + 40, tar.y - 50,
        { color: 0x88aacc, fontSize: 16, rise: 32, life: 38 });
    }

    tar.applyDamage(p.amount, p.targetHp, p.targetMaxHp, p.targetShield ?? 0, p.targetMaxShield ?? p.targetMaxHp, this.fx, this.runner, dmgColor, p.absorbed ?? 0);
    const sname = src?.getName() ?? p.sourceId;
    const absorbTag = (p.absorbed ?? 0) > 0 ? ` (护盾吸收:${p.absorbed})` : '';
    this.log(`${sname} → ${tar.getName()} -${p.amount}${tag}${absorbTag}`);
  }

  private onBuffAdd(p: { sourceId: string; targetId: string; buffId: string }): void {
    const tar = this.nodes.get(p.targetId);
    if (!tar) return;
    const def = getBuffJson(p.buffId);
    const icon = def?.icon ?? '✦';
    const name = def?.name ?? p.buffId;
    const dur  = def?.durationRounds;
    tar.addBuff(p.buffId, icon, dur);
    if (dur != null && Number.isFinite(dur) && dur > 0) {
      if (!this.buffTurns.has(p.targetId)) this.buffTurns.set(p.targetId, new Map());
      this.buffTurns.get(p.targetId)!.set(p.buffId, dur | 0);
      tar.updateBuffTurns(p.buffId, dur | 0);
    }
    this.fx.floatingText(`${icon}${name}`, tar.x, tar.y - 70, { color: 0xffee88, fontSize: 18 });
    if (p.buffId.toLowerCase().includes('poison') || name.includes('毒')) tar.flashPoison(this.runner);
    if (p.buffId.includes('shield')) this.fx.skillHitParticles('sk_shield', tar.x, tar.y);
    this.log(`${tar.getName()} 获得 ${icon}${name}`);
  }

  private onBuffRemove(p: { targetId: string; buffId: string }): void {
    this.nodes.get(p.targetId)?.removeBuff(p.buffId);
    this.buffTurns.get(p.targetId)?.delete(p.buffId);
  }

  private onDead(p: { targetId: string }): void {
    const tar = this.nodes.get(p.targetId);
    if (!tar) return;
    tar.playDeath(this.fx, this.runner);
    this.log(`${tar.getName()} 倒下了`);
  }

  private onBattleEnd(p: { winner: Side | 'Draw' }): void {
    const text = p.winner === 'Draw' ? '平局'
      : p.winner === 'A' ? '我方胜利！' : '敌方胜利…';
    this.resultLabel.text = text;
    this.resultLabel.visible = true;
    this.pulse(this.resultLabel);
    this.log(`结果：${text}`);
  }

  // ━━ 内部辅助 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private clearFighters(): void {
    for (const n of this.nodes.values()) n.destroy();
    this.nodes.clear();
    this.buffTurns.clear();
    this.fxLayer.removeChildren();
    this.fx = new BattleFXManager(this.fxLayer, this.runner, ARENA_W, ARENA_H);
  }

  private placeTeam(team: FighterSnapshot[], side: Side, cx: number, baseY: number): void {
    const count = Math.min(5, team.length);
    const xs = this.computeXPositions(count, cx);
    const slideDir = side === 'A' ? 80 : -80;

    for (let i = 0; i < count; i++) {
      const f = team[i]!;
      const node = new FighterNode(f);
      node.baseY = baseY;                            // ❺ 记录基准 Y
      node.container.position.set(xs[i]!, baseY + slideDir);
      node.container.alpha = 0;
      this.nodes.set(f.id, node);
      this.fxLayer.addChild(node.container);
      this.runner.add(Tween.to(node.container, { y: baseY, alpha: 1 }, 18, easeOutCubic));
    }
  }

  private computeXPositions(count: number, cx: number): number[] {
    if (count <= 1) return [cx];
    const step = Math.min(176, 600 / (count - 1));
    const start = cx - (step * (count - 1)) / 2;
    return Array.from({ length: count }, (_, i) => start + step * i);
  }

  private highlightActor(actorId: string): void {
    for (const [id, n] of this.nodes) {
      if (n.isDead) { n.setActive(false); n.container.alpha = Math.min(n.container.alpha, 0.15); continue; }
      const active = id === actorId;
      n.setActive(active);
      n.container.alpha = active ? 1 : 0.80;
    }
  }

  private tickBuffTurns(): void {
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
  private paintRoundPill(): void {
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
  private paintVsDivider(): void {
    this.vsDivider.removeChildren();
    const cy = Y_VS;
    const g = new Graphics();

    // 虚线 alpha 0.12→0.25
    g.lineStyle(1.5, 0x5fa6ff, 0.25);
    const margin = 50;
    const vsGap = 36;  // VS 文字左右留空
    for (let x = margin; x < ARENA_W - margin; x += 24) {
      const x2 = Math.min(x + 14, ARENA_W - margin);
      // 跳过 VS 文字区域
      if (x + 14 > ARENA_W / 2 - vsGap && x < ARENA_W / 2 + vsGap) continue;
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
  private log(line: string): void {
    if (!line) return;
    this.logLines.push(line);
    if (this.logLines.length > 40) this.logLines.splice(0, this.logLines.length - 40);
    this.paintLog();

    // ❹ 首次日志出现时淡入
    if (!this.logRevealed) {
      this.logRevealed = true;
      this.runner.add(Tween.to(this.logBg, { alpha: 1 }, 16, easeOutCubic));
      this.runner.add(Tween.to(this.logScroll, { alpha: 1 }, 16, easeOutCubic));
    }
  }

  private paintLog(): void {
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

  private pulse(label: Text): void {
    label.scale.set(1);
    this.runner.add(
      Tween.to(label.scale, { x: 1.08, y: 1.08 }, 8, easeOutCubic, () => {
        this.runner.add(Tween.to(label.scale, { x: 1, y: 1 }, 10, easeOutCubic));
      }),
    );
  }
}
