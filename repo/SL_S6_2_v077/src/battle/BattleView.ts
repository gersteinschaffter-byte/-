import { Container, Graphics, Text } from 'pixi.js';
import type { BattleEvent, FighterSnapshot, Side } from './BattleTypes';
import { createText, roundedRect } from '../ui/uiFactory';
import ScrollView from '../ui/components/ScrollView';
import { Tween, TweenRunner, easeOutCubic } from '../fx/Tween';
import { spawnFloatingText } from '../fx/FloatingText';
import { spawnFlashLine } from '../fx/FlashLine';
import { getBuffJson } from './SkillDefs';
import FighterNode from './FighterNode';

// Skill-type color mapping for visual variety.
const SKILL_COLORS: Record<string, number> = {
  sk_fireball:  0xff6633,
  sk_sweep:     0xffaa22,
  sk_heal:      0x54ff8d,
  sk_aura_heal: 0x88ffcc,
  sk_warcry:    0xff4444,
  sk_shield:    0x66ccff,
  sk_poison:    0xcc44ff,
  sk_slow:      0x44ddff,
};
const DEFAULT_SKILL_COLOR = 0xffee88;

/**
 * BattleView
 *
 * PixiJS rendering layer.
 * - Only consumes battle events
 * - Does NOT do any numeric simulation
 */
export default class BattleView {
  public readonly root: Container;

  private readonly fighterNodes: Map<string, FighterNode> = new Map();
  private readonly fxLayer: Container;
  private readonly uiLayer: Container;
  private readonly roundLabel: Text;
  private readonly resultLabel: Text;

  private readonly roundBg: Graphics;

  private readonly logBg: Graphics;
  private readonly logScroll: ScrollView;
  private readonly logText: Text;
  private readonly logLines: string[] = [];

  // Buff remaining rounds (UI-only hint). key: fighterId -> buffId -> remaining
  private readonly buffTurns: Map<string, Map<string, number>> = new Map();


  // Shared fx/tween runner (reused across battle effects)
  private readonly tweenRunner = new TweenRunner();
  // When a skill is used, we keep its color for a short time so subsequent damage lines inherit the color.
  private readonly skillColorTTL: Map<string, { color: number; ttl: number }> = new Map();

  constructor() {
    this.root = new Container();

    const arena = new Graphics();
    arena.beginFill(0x0b1533, 0.65);
    roundedRect(arena, 0, 0, 720, 900, 38);
    arena.endFill();
    arena.lineStyle(3, 0x5fa6ff, 0.35);
    roundedRect(arena, 6, 6, 708, 888, 34);
    this.root.addChild(arena);

    this.fxLayer = new Container();
    this.uiLayer = new Container();
    this.root.addChild(this.fxLayer, this.uiLayer);

    this.roundBg = new Graphics();
    this.uiLayer.addChild(this.roundBg);

    this.roundLabel = createText('回合 0', 28, 0xffffff, '900');
    this.roundLabel.position.set(24, 18);
    this.uiLayer.addChild(this.roundLabel);
    this.updateRoundPill();

    // Battle log panel (scrollable, shows recent actions clearly)
    this.logBg = new Graphics();
    // Panel sits at the bottom of the 720x900 arena.
    this.logBg.position.set(16, 684); // 900 - 200 - 16
    this.uiLayer.addChild(this.logBg);

    // Scrollable log viewport
    this.logScroll = new ScrollView(720 - 32, 200);
    this.logScroll.position.set(16, 684);
    this.uiLayer.addChild(this.logScroll);

    this.logText = createText('', 14, 0xd7e6ff, '700');
    this.logText.position.set(12, 10);
    // Enable wrapping so long lines don't get cut off horizontally.
    const st: any = this.logText.style;
    st.wordWrap = true;
    st.wordWrapWidth = (720 - 32) - 24;
    st.lineHeight = 18;
    this.logScroll.content.addChild(this.logText);
    this.renderLog();

    this.resultLabel = createText('', 36, 0xffffff, '900');
    this.resultLabel.anchor.set(0.5);
    this.resultLabel.position.set(360, 450);
    this.resultLabel.visible = false;
    this.uiLayer.addChild(this.resultLabel);
  }

  /** Returns true if there are running tweens/FX animations. */
  public isAnimating(): boolean {
    return !this.tweenRunner.isIdle();
  }

  /** Stop all running animations to prevent callbacks from accessing destroyed objects */
  public stopAllAnimations(): void {
    this.tweenRunner.clear();
  }

  /** Clear view and build fighters from setup. */
  public build(teamA: FighterSnapshot[], teamB: FighterSnapshot[]): void {
    this.logLines.length = 0;
    this.renderLog();
    // Remove old nodes
    for (const n of this.fighterNodes.values()) n.destroy();
    this.fighterNodes.clear();
    this.buffTurns.clear();
    this.fxLayer.removeChildren();

    // Positions (virtual arena 720x900)
    // Layout: enemy on top row (centered), player on bottom row (centered).
    const arenaW = 720;
    const arenaH = 900;
    const centerX = arenaW / 2;
    const centerY = arenaH / 2;

    const maxSpan = 560; // max horizontal span used for formation
    const maxSlotsA = 5; // player must support up to 5
    const maxSlotsB = 5; // allow up to 5 for future-proof; typically enemies are fewer

    const computeXs = (count: number) => {
      const n = Math.max(0, count);
      if (n <= 1) return [centerX];
      const step = Math.min(140, maxSpan / (n - 1));
      const start = centerX - (step * (n - 1)) / 2;
      return Array.from({ length: n }).map((_, i) => start + step * i);
    };

    // More "confrontational" spacing: enemy higher, player lower.
    const yB = centerY - 160;
    const yA = centerY + 170;

    const placeTeam = (team: FighterSnapshot[], side: Side) => {
      const maxSlots = side === 'A' ? maxSlotsA : maxSlotsB;
      const count = Math.min(maxSlots, team.length);
      const xs = computeXs(count);
      for (let i = 0; i < count; i++) {
        const f = team[i]!;
        const x = xs[i] ?? centerX;
        const y = side === 'A' ? yA : yB;
        const node = new FighterNode(f);
        node.container.position.set(x, y);
        node.container.alpha = 0;
        // Entrance tween: slide from vertical direction for clear top/bottom separation.
        node.container.y += side === 'A' ? 120 : -120;
        this.fighterNodes.set(f.id, node);
        this.fxLayer.addChild(node.container);
        this.tweenRunner.add(Tween.to(node.container, { y, alpha: 1 }, 18, easeOutCubic));
      }
    };

    placeTeam(teamA, 'A');
    placeTeam(teamB, 'B');
    this.resultLabel.visible = false;
    this.resultLabel.text = '';
    this.roundLabel.text = '回合 0';
  }

  /** Receive one battle event from logic. */
  public onEvent(e: BattleEvent): void {
    switch (e.type) {
      case 'roundStart': {
        this.roundLabel.text = `回合 ${e.payload.round}`;
        this.updateRoundPill();
        this.pulseLabel(this.roundLabel);
        this.pushLog(`—— 回合 ${e.payload.round} ——`);
        // UI-only buff remaining rounds: tick down once per round for display hint.
        for (const m of this.buffTurns.values()) {
          for (const [bid, t] of m.entries()) {
            m.set(bid, Math.max(0, t - 1));
          }
        }
        // Refresh buff turn badges
        for (const [fid, m] of this.buffTurns.entries()) {
          const node = this.fighterNodes.get(fid);
          if (!node) continue;
          for (const [bid, t] of m.entries()) node.updateBuffTurns(bid, t);
        }
        break;
      }
      case 'actorTurn': {
        this.setActiveActor(e.payload.actorId);
        const node = this.fighterNodes.get(e.payload.actorId);
        if (node) node.flashTurn(this.tweenRunner);
        const name = node ? node.getName() : e.payload.actorId;
        this.pushLog(`${name} 行动`);
        break;
      }
      case 'skillUse': {
        const node = this.fighterNodes.get(e.payload.actorId);
        if (node) {
          this.pushLog(`${node.getName()} 使用【${e.payload.skillName}】`);
          const color = SKILL_COLORS[e.payload.skillId] ?? DEFAULT_SKILL_COLOR;
          // Remember this skill color briefly so the following damage line can inherit it.
          this.skillColorTTL.set(e.payload.actorId, { color, ttl: 40 });
          // Big AOE skill: full screen flash for a more impactful feel.
          if (e.payload.skillId === 'sk_sweep') {
            this.spawnScreenFlash(color, 0.22, 18);
          }
          // Skill name floating text above the actor.
          spawnFloatingText(
            this.fxLayer,
            `【${e.payload.skillName}】`,
            node.container.x,
            node.container.y - 100,
            this.tweenRunner,
            { color, fontSize: 22, rise: 56, life: 60 },
          );
          // Quick body flash in skill color.
          node.flashColor(color, this.tweenRunner);
        }
        break;
      }
      case 'heal': {
        const tar = this.fighterNodes.get(e.payload.targetId);
        if (tar) {
          tar.onHeal(e.payload.amount, e.payload.targetHp, e.payload.targetMaxHp, this.fxLayer, this.tweenRunner);
          // Green glow ring around healed target.
          this.spawnRing(tar.container.x, tar.container.y, 0x54ff8d);
          this.pushLog(`${tar.getName()} +${e.payload.amount}`);
        }
        break;
      }
      case 'damage': {
        const src = this.fighterNodes.get(e.payload.sourceId);
        const tar = this.fighterNodes.get(e.payload.targetId);
        if (src && tar) {
          // Self-damage (DoT) — no attack line, just purple damage number.
          if (e.payload.sourceId === e.payload.targetId) {
            tar.onDamage(e.payload.amount, e.payload.targetHp, e.payload.targetMaxHp, this.fxLayer, this.tweenRunner, 0xcc44ff);
          } else {
            const sc = this.skillColorTTL.get(e.payload.sourceId);
            const lineColor = sc ? sc.color : 0xffffff;
            src.playAttackTo(tar.container.x, tar.container.y, this.fxLayer, this.tweenRunner, lineColor);
            // Elemental advantage visual feedback.
            const eb = e.payload.elementBonus;
            if (eb != null && eb > 1) {
              tar.onDamage(e.payload.amount, e.payload.targetHp, e.payload.targetMaxHp, this.fxLayer, this.tweenRunner, 0xff8800);
              spawnFloatingText(this.fxLayer, '克制！', tar.container.x + 40, tar.container.y - 60, this.tweenRunner, { color: 0xff8800, fontSize: 18, rise: 36, life: 40 });
            } else if (eb != null && eb < 1) {
              tar.onDamage(e.payload.amount, e.payload.targetHp, e.payload.targetMaxHp, this.fxLayer, this.tweenRunner, 0x88aacc);
              spawnFloatingText(this.fxLayer, '抵抗', tar.container.x + 40, tar.container.y - 60, this.tweenRunner, { color: 0x88aacc, fontSize: 18, rise: 36, life: 40 });
            } else {
              tar.onDamage(e.payload.amount, e.payload.targetHp, e.payload.targetMaxHp, this.fxLayer, this.tweenRunner);
            }
          }
        }
        // Log
        if (tar) {
          const tname = tar.getName();
          if (e.payload.sourceId === e.payload.targetId) this.pushLog(`${tname} 受到持续伤害 -${e.payload.amount}`);
          else {
            const sname = src ? src.getName() : e.payload.sourceId;
            const eb = e.payload.elementBonus;
            const tag = eb != null && eb > 1 ? ' 克制!' : eb != null && eb < 1 ? ' 抵抗' : '';
            this.pushLog(`${sname} → ${tname} -${e.payload.amount}${tag}`);
          }
        }
        break;
      }
      case 'buffAdd': {
        const tar = this.fighterNodes.get(e.payload.targetId);
        if (tar) {
          const def = getBuffJson(e.payload.buffId);
          const icon = def?.icon ?? '✦';
          const name = def?.name ?? e.payload.buffId;
          const duration = def?.durationRounds;
          tar.addBuffIcon(e.payload.buffId, icon, duration);
          // Track remaining rounds for UI badge (best-effort; logic is source of truth).
          if (duration != null && Number.isFinite(duration) && duration > 0) {
            if (!this.buffTurns.has(e.payload.targetId)) this.buffTurns.set(e.payload.targetId, new Map());
            this.buffTurns.get(e.payload.targetId)!.set(e.payload.buffId, Math.floor(duration));
            tar.updateBuffTurns(e.payload.buffId, Math.floor(duration));
          }
          spawnFloatingText(this.fxLayer, `${icon}${name}`, tar.container.x, tar.container.y - 90, this.tweenRunner, { color: 0xffee88, fontSize: 20 });
          // Poison-like buffs: make the target flicker purple briefly.
          const isPoison = (e.payload.buffId || '').toLowerCase().includes('poison') || name.includes('毒');
          if (isPoison) tar.flashPoison(this.tweenRunner);
          this.pushLog(`${tar.getName()} 获得 ${icon}${name}`);
        }
        break;
      }
      case 'buffRemove': {
	        const tar = this.fighterNodes.get(e.payload.targetId);
        if (tar) tar.removeBuffIcon(e.payload.buffId);
        const m = this.buffTurns.get(e.payload.targetId);
        if (m) m.delete(e.payload.buffId);
        break;
      }
      case 'dead': {
        const tar = this.fighterNodes.get(e.payload.targetId);
        if (tar) {
          tar.playDeath(this.tweenRunner);
          this.pushLog(`${tar.getName()} 倒下了`);
        }
        break;
      }
      case 'battleEnd': {
        this.resultLabel.visible = true;
        this.resultLabel.text = e.payload.winner === 'Draw' ? '平局' : e.payload.winner === 'A' ? '我方胜利！' : '敌方胜利…';
        this.pulseLabel(this.resultLabel);
        this.pushLog(`结果：${this.resultLabel.text}`);
        break;
      }
      default:
        break;
    }
  }


  private updateRoundPill(): void {
    const padX = 14;
    const padY = 8;
    const w = Math.max(120, this.roundLabel.width + padX * 2);
    const h = Math.max(38, this.roundLabel.height + padY * 2);

    this.roundBg.clear();
    this.roundBg.beginFill(0x000000, 0.28);
    roundedRect(this.roundBg, 14, 12, w, h, 16);
    this.roundBg.endFill();

    this.roundBg.lineStyle(2, 0x5fa6ff, 0.25);
    roundedRect(this.roundBg, 14, 12, w, h, 16);

    // Keep text inside the pill.
    this.roundLabel.position.set(14 + padX, 12 + padY - 1);
  }

  private pushLog(line: string): void {
    if (!line) return;
    this.logLines.push(line);
    while (this.logLines.length > 50) this.logLines.shift();
    this.renderLog();
  }

  private renderLog(): void {
    // Draw bg
    const w = 720 - 32;
    const h = 200;
    this.logBg.clear();
    this.logBg.beginFill(0x000000, 0.25);
    roundedRect(this.logBg, 0, 0, w, h, 18);
    this.logBg.endFill();
    this.logBg.lineStyle(2, 0x5fa6ff, 0.18);
    roundedRect(this.logBg, 0, 0, w, h, 18);

    this.logText.text = this.logLines.join('\n');

    // Update scroll range + auto-scroll to bottom.
    // content height derived from text bounds; add padding.
    const contentH = Math.max(h, Math.ceil(this.logText.height + 24));
    this.logScroll.setContentHeight(contentH);
    // Scroll to bottom so newest logs are visible.
    const maxScroll: any = (this.logScroll as any).getMaxScroll ? (this.logScroll as any).getMaxScroll() : null;
    if (typeof maxScroll === 'number') this.logScroll.scrollTo(maxScroll);
    else this.logScroll.scrollTo(999999);
  }

  private setActiveActor(actorId: string): void {
    for (const [id, n] of this.fighterNodes.entries()) {
      const isActive = id === actorId;
      if ((n as any).isDead) {
        n.setActive(false);
        n.container.alpha = 0;
        continue;
      }
      n.setActive(isActive);
      // Slightly dim non-active fighters so the current actor pops.
      n.container.alpha = isActive ? 1 : 0.78;
    }
  }


  /** Update animations. Called by BattleEngine each tick. */
  public update(dt: number): void {
    this.tweenRunner.update(dt);
    // Tick down skill color lifetimes (dt is in frames).
    for (const [id, v] of this.skillColorTTL.entries()) {
      v.ttl -= dt;
      if (v.ttl <= 0) this.skillColorTTL.delete(id);
    }
  }

  /** Expanding ring effect (heal glow, AOE indicator). */

  /** Full-screen flash overlay (used by AOE skills). */
  private spawnScreenFlash(color: number, alpha = 0.18, lifeFrames = 16): void {
    const flash = new Graphics();
    flash.beginFill(color, alpha);
    // Arena is 720x900 in this scene.
    flash.drawRect(0, 0, 720, 900);
    flash.endFill();
    flash.alpha = 0;
    this.fxLayer.addChild(flash);

    this.tweenRunner.add(
      Tween.to(flash, { alpha: 1 }, Math.max(2, Math.floor(lifeFrames * 0.25)), easeOutCubic, () => {
        this.tweenRunner.add(
          Tween.to(flash, { alpha: 0 }, Math.max(4, Math.floor(lifeFrames * 0.75)), easeOutCubic, () => {
            flash.destroy();
          }),
        );
      }),
    );
  }
  private spawnRing(x: number, y: number, color: number, radius = 60): void {
    const ring = new Graphics();
    ring.lineStyle(4, color, 0.7);
    ring.drawCircle(0, 0, 10);
    ring.position.set(x, y);
    ring.alpha = 0.9;
    this.fxLayer.addChild(ring);

    // Animate: scale up + fade out.
    const targetScale = radius / 10;
    this.tweenRunner.add(
      Tween.to(ring, { alpha: 0 }, 20, easeOutCubic, () => ring.destroy()),
    );
    this.tweenRunner.add(
      Tween.to(ring.scale, { x: targetScale, y: targetScale }, 20, easeOutCubic),
    );
  }

  private pulseLabel(label: Text): void {
    label.scale.set(1);
    this.tweenRunner.add(
      Tween.to(label.scale, { x: 1.08, y: 1.08 }, 8, easeOutCubic, () => {
        this.tweenRunner.add(Tween.to(label.scale, { x: 1, y: 1 }, 10, easeOutCubic));
      }),
    );
  }
}