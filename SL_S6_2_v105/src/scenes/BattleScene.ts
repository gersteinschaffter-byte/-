import type GameApp from '../core/GameApp';
import BaseScene from './BaseScene';
import BattleEngine from '../battle/BattleEngine';
import type { FighterSnapshot, Side } from '../battle/BattleTypes';
import { buildStatsPanel } from '../battle/BattleStatsPanel';
import ScrollView from '../ui/components/ScrollView';
import UIButton from '../ui/components/UIButton';
import { PopupLayers } from '../ui/PopupLayers';
import { createText } from '../ui/uiFactory';
import { HERO_MAP } from '../game/data';
import { ECONOMY, ELEMENTS, RARITY } from '../game/config';
import { calculateHeroStats, calculateEnemyStats } from '../game/heroStats';
import type { Directive, DirectiveMod } from '../game/director';
import { formatMods, generateDirectiveByDeepSeek, getDirectorApiKey, pickLocalDirective } from '../game/director';
import stagesJson from '../configs/stages.json';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 关卡配置
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface StageEnemy {
  name: string; element: string; rarity: string;
  skills: string[]; bossMult?: number;
}

interface StageConfig {
  id: number; name: string; zone: string;
  isBoss: boolean; isElite: boolean;
  levelOffset: number; enemies: StageEnemy[];
}

const STAGES = stagesJson as unknown as StageConfig[];
const STAGE_MAP = new Map<number, StageConfig>(STAGES.map((s) => [s.id, s]));

/** 快捷创建 FighterSnapshot */
function fighter(
  id: string, name: string, side: Side,
  hp: number, atk: number, def: number, spd: number,
  skills: string[] = [], element?: string,
): FighterSnapshot {
  return { id, name, side, hp, maxHp: hp, atk, def, spd, element, skills };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BattleScene v0.92
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default class BattleScene extends BaseScene {
  private readonly game: GameApp;
  private readonly engine: BattleEngine;
  private readonly title;
  private readonly directiveText;
  private readonly btnSpeed;
  private readonly btnRestart;

  private speedIdx = 1;
  private static readonly SPEEDS = [0.75, 1, 1.5, 2] as const;

  // ── 结算状态 ──
  private resolved  = false;
  private winner:   Side | 'Draw' | null = null;
  private winRunId  = 0;
  private endDelay  = 0;
  private deadGrace = 0;

  private directive: Directive | null = null;
  private directiveModMap: Partial<Record<DirectiveMod['type'], number>> = {};
  private runId     = 0;
  private locking   = false;

  private getModValue(type: DirectiveMod['type']): number | null {
    const v = this.directiveModMap[type];
    return Number.isFinite(v) ? (v as number) : null;
  }

  private rebuildDirectiveModCache(): void {
    this.directiveModMap = {};
    const mods = this.directive?.mods ?? [];
    for (const m of mods) {
      const v = Number(m.value);
      if (Number.isFinite(v)) this.directiveModMap[m.type] = v;
    }
  }

  private applyMult(n: number, mult: number | null): number {
    if (!Number.isFinite(n)) return 0;
    if (mult == null || !Number.isFinite(mult)) return n;
    return Math.max(0, Math.round(n * mult));
  }

  private static readonly CHEST_PROB = [
    { key: 'chest_c', p: 0.60 },
    { key: 'chest_b', p: 0.25 },
    { key: 'chest_a', p: 0.12 },
    { key: 'chest_s', p: 0.03 },
  ] as const;

  constructor(game: GameApp) {
    super('battle');
    this.game = game;
    this.engine = new BattleEngine({ stepIntervalTicks: 44 });

    // 拦截引擎事件：检测 dead/battleEnd
    const emit = this.engine.emit.bind(this.engine);
    (this.engine as any).emit = (e: any) => {
      emit(e);
      if (e.type === 'dead') this.deadGrace = 80;
      if (e.type === 'battleEnd' && !this.resolved && !this.winner) {
        this.winner   = e.payload?.winner;
        this.winRunId = this.runId;
        this.endDelay = Math.max(70, this.deadGrace);
      }
    };

    // ── UI ──
    this.title = createText('战斗', 34, 0xffffff, '900');
    this.title.anchor.set(0.5);
    this.directiveText = createText('', 16, 0xffe3a3, '800');
    this.directiveText.anchor.set(0.5);
    (this.directiveText.style as any).wordWrap = true;
    (this.directiveText.style as any).align = 'center';
    this.root.addChild(this.title, this.directiveText, this.engine.view.root);

    this.btnSpeed = new UIButton('⚡x1', 130, 52);
    this.btnSpeed.on('pointertap', () => this.cycleSpeed());

    this.btnRestart = new UIButton('重新开始', 170, 52);
    this.btnRestart.on('pointertap', () => { void this.startBattle(); });

    this.root.addChild(this.btnSpeed, this.btnRestart);
  }

  // ━━ 生命周期 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  override onEnter(): void {
    this.game.bottomNav.visible = false;
    this.speedIdx = 1;
    this.applySpeed(1);
    void this.startBattle();
  }

  override onExit(): void {
    this.game.bottomNav.visible = true;
  }

  override onResize(w: number, h: number): void {
    if ((this.title as any)?.destroyed) return;
    this.title.position.set(w / 2, 158);

    // AI Director line
    this.directiveText.position.set(w / 2, 198);
    (this.directiveText.style as any).wordWrapWidth = Math.max(200, w - 80);

    const cx = w / 2;
    this.btnSpeed.position.set(cx - 160, 228);
    this.btnRestart.position.set(cx + 10, 228);

    const root: any = this.engine?.view?.root;
    if (root && !root.destroyed) root.position.set((w - 700) / 2, 278);
  }

  override onUpdate(dt: number): void {
    this.engine.update(dt);
    if (this.deadGrace > 0) this.deadGrace -= dt;

    if (!this.winner || this.resolved) return;
    if (this.winRunId !== this.runId) { this.winner = null; return; }

    this.endDelay -= dt;
    if (this.endDelay <= 0 && !this.engine.view.isAnimating()) {
      const w = this.winner;
      this.winner = null;
      this.settle(w);
    }
  }

  // ━━ 战斗初始化 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private async startBattle(): Promise<void> {
    if (this.locking) return;
    this.runId++;
    const rid = this.runId;
    this.resetState();
    this.lockButton(rid);

    const heroes = this.getValidHeroes();
    if (!heroes) return;

    // Ensure AI Director directive for this stage (per-stage, cached)
    const stageNow = this.game.state.stage;
    this.directive = await this.ensureDirectiveForStage(stageNow);
    this.rebuildDirectiveModCache();

    // Ignore stale async completion when a newer restart already began.
    if (this.runId !== rid) return;

    const teamA = this.buildPlayerTeam(heroes);
    const { teamB, title } = this.buildEnemyTeam(heroes);
    this.title.text = title;
    this.directiveText.text = this.directive
      ? `🎬 ${this.directive.title}  ·  ${this.directive.desc}\n${formatMods(this.directive.mods)}`
      : '';
    this.engine.start({ teamA, teamB });
  }

  private async ensureDirectiveForStage(stage: number): Promise<Directive | null> {
    if (!this.game.state.directorEnabled) {
      this.game.state.setDirectorDirective(stage, null);
      return null;
    }

    // Use cached directive if available for this stage
    if (this.game.state.directorStage === stage && this.game.state.directorDirective) {
      return this.game.state.directorDirective as Directive;
    }

    const snapshot = this.game.state.getSnapshot();
    const apiKey = getDirectorApiKey();
    if (!apiKey) {
      const local = pickLocalDirective(stage);
      this.game.state.setDirectorDirective(stage, local);
      return local;
    }

    // Try LLM generation (short timeout). Fallback is built-in inside generateDirectiveByDeepSeek.
    this.game.toast.show('🎬 导演生成本关词条中…', 1.2);
    const directive = await generateDirectiveByDeepSeek({
      apiKey,
      model: this.game.state.directorModel,
      stage,
      snapshot,
      timeoutMs: 2500,
    });
    this.game.state.setDirectorDirective(stage, directive);
    return directive;
  }

  private resetState(): void {
    this.resolved = false;
    this.winner = null;
    this.winRunId = 0;
    this.endDelay = 0;
    this.deadGrace = 0;
    this.directiveModMap = {};
    this.engine.view.stopAllAnimations();
    this.applySpeed(BattleScene.SPEEDS[this.speedIdx] ?? 1);
  }

  private lockButton(rid: number): void {
    this.locking = true;
    this.btnRestart.setDisabled(true);
    setTimeout(() => {
      if (this.runId === rid) { this.locking = false; this.btnRestart.setDisabled(false); }
    }, 300);
  }

  // ── 队伍构建 ──

  private getValidHeroes(): any[] | null {
    const ids = this.game.state.getPartyHeroes().slice(0, 5);
    if (!ids.length) {
      this.game.toast.show('请先上阵至少1名英雄', 2);
      this.game.goTo('home', { animate: false });
      return null;
    }

    const owned = ids.map(id => this.game.state.getOwnedHero(id)).filter(Boolean).slice(0, 5);
    const valid = owned.filter((h: any) => HERO_MAP[h.heroId]);

    if (valid.length !== owned.length) {
      const slots = (this.game.state.partySlots ?? Array(5).fill(null))
        .map((id: any) => id && HERO_MAP[id] ? id : null);
      this.game.state.setPartySlots(slots);
    }
    if (!valid.length) {
      this.game.toast.show('队伍英雄无效，请重新上阵', 2);
      this.game.state.setPartySlots([]);
      this.game.goTo('home', { animate: false });
      return null;
    }
    return valid;
  }

  private buildPlayerTeam(heroes: any[]): FighterSnapshot[] {
    return heroes.map((o, i) => {
      const def = HERO_MAP[o.heroId];
      const stats = calculateHeroStats(o.level || 1, def?.rarity ?? RARITY.R, o.stars || 0, def?.profession);
      const hpMult = this.getModValue('ally_hp_mult');
      const atkMult = this.getModValue('ally_atk_mult');
      const spdMult = this.getModValue('ally_spd_mult');
      return fighter(
        `p${i + 1}:${o.heroId}`, def?.name ?? `英雄${i + 1}`, 'A',
        this.applyMult(stats.hp, hpMult), this.applyMult(stats.atk, atkMult), stats.def, this.applyMult(stats.spd, spdMult),
        def?.skills ?? [], def?.element,
      );
    });
  }

  private buildEnemyTeam(heroes: any[]): { teamB: FighterSnapshot[]; title: string } {
    const stage = this.game.state.stage;
    const hpMult = this.getModValue('enemy_hp_mult');
    const atkMult = this.getModValue('enemy_atk_mult');
    const spdMult = this.getModValue('enemy_spd_mult');
    const conf  = STAGE_MAP.get(stage);
    const avgLv = Math.max(1, Math.round(heroes.reduce((s: number, h: any) => s + (h.level || 1), 0) / heroes.length));

    if (conf) {
      const baseLv = Math.min(60, avgLv + 2 + (conf.levelOffset ?? 0));
      const teamB = conf.enemies.map((e, i) => {
        const r = e.rarity ?? (baseLv >= 20 ? RARITY.SR : RARITY.R);
        const s = calculateEnemyStats(baseLv, r, i);
        const m = e.bossMult ?? 1;
        return fighter(`e${i + 1}`, e.name, 'B',
          this.applyMult((s.hp * m) | 0, hpMult), this.applyMult((s.atk * m) | 0, atkMult), (s.def * m) | 0, this.applyMult(s.spd, spdMult),
          e.skills ?? [], e.element ?? ELEMENTS[i % ELEMENTS.length]);
      });
      return { teamB, title: `${conf.zone} · 第${stage}关` };
    }

    // 无配置：程序化生成
    const boost = ((stage - 1) / 3) | 0;
    const lv = Math.min(60, avgLv + 2 + boost);
    const boss = stage % 10 === 0;
    const cnt = boss ? 4 : 3;
    const m = boss ? 1.25 : 1;
    const pool = [['sk_fireball'], ['sk_poison'], ['sk_slow', 'sk_shield']];
    const teamB = Array.from({ length: cnt }, (_, i) => {
      const s = calculateEnemyStats(lv, lv >= 20 ? RARITY.SR : RARITY.R, i);
      return fighter(`e${i + 1}`, `敌人${i + 1}`, 'B',
        this.applyMult((s.hp * m) | 0, hpMult), this.applyMult((s.atk * m) | 0, atkMult), (s.def * m) | 0, this.applyMult(s.spd, spdMult),
        pool[i % pool.length]!, ELEMENTS[i % ELEMENTS.length]);
    });
    return { teamB, title: `第${stage}关` };
  }

  // ── 速度控制 ──

  private cycleSpeed(): void {
    this.speedIdx = (this.speedIdx + 1) % BattleScene.SPEEDS.length;
    this.applySpeed(BattleScene.SPEEDS[this.speedIdx]!, true);
  }

  private applySpeed(mult: number, toast = false): void {
    this.engine.setSpeed(mult);
    const m = this.engine.getSpeed();
    this.btnSpeed.setLabel(m === 1 ? '⚡x1' : `⚡x${m}`);
    if (toast) this.game.toast.show(`战斗速度：x${m}`, 1);
  }

  // ━━ 战斗结算 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private settle(winner: Side | 'Draw'): void {
    if (this.resolved) return;
    this.resolved = true;

    // 计算统计数据
    this.engine.stats.evaluate();
    const teamA = this.engine.stats.getTeam('A');
    const teamB = this.engine.stats.getTeam('B');
    const mvp   = this.engine.stats.getMVP();

    const modal = this.game.modal;
    const layer = modal.useLayer(PopupLayers.BATTLE_RESULT);
    const pw = modal.panel.width;
    const ph = modal.panel.height;

    const isWin = winner === 'A';
    const stage = this.game.state.stage;
    const conf  = STAGE_MAP.get(stage);
    const isBoss  = conf?.isBoss ?? (stage % 10 === 0);
    const isElite = conf?.isElite ?? false;

    // ── 标题 ──
    const t = createText(
      isWin ? '🎉 胜利！' : winner === 'B' ? '💀 失败' : '⚔ 平局',
      36, 0xffffff, '900',
    );
    t.anchor.set(0.5);
    t.position.set(pw / 2, 50);
    layer.addChild(t);

    // ── 奖励文字 ──
    const lines = isWin ? this.grantRewards(stage, isBoss, isElite) : [winner === 'Draw' ? '平局，无奖励' : '失败，无奖励'];
    const rewardStr = lines.join('  ·  ');
    const rewardT = createText(rewardStr, 16, 0xffe3a3, '700');
    rewardT.anchor.set(0.5);
    rewardT.position.set(pw / 2, 95);
    Object.assign(rewardT.style, { wordWrap: true, wordWrapWidth: pw - 60, align: 'center', lineHeight: 22 });
    layer.addChild(rewardT);

    // ── 统计面板（滚动区域） ──
    const scrollY = 130;
    const btnAreaH = 170;
    const scrollH = ph - scrollY - btnAreaH;

    // 计算归一化最大值（两队合并）
    const maxStats: Record<string, number> = {};
    for (const key of ['damageDealt', 'damageTaken', 'healingDone', 'shielding'] as const) {
      const maxA = this.engine.stats.getMaxStat('A', key);
      const maxB = this.engine.stats.getMaxStat('B', key);
      maxStats[key] = Math.max(maxA, maxB);
    }

    const statsPanel = buildStatsPanel({
      panelW: pw, panelH: ph,
      teamA, teamB, mvp, maxStats,
    });

    const scroll = new ScrollView(pw - 20, scrollH);
    scroll.position.set(10, scrollY);
    scroll.content.addChild(statsPanel);
    // 估算内容高度：MVP(90) + 2队 x (标签22 + 4类别 x (18 + 角色数x24 + 6) + 评级(20+角色数x24+4))
    const teamSize = Math.max(teamA.length, teamB.length);
    const estH = 90 + 2 * (22 + 4 * (18 + teamSize * 24 + 6) + 20 + teamSize * 24 + 4) + 60;
    scroll.setContentHeight(Math.max(scrollH, estH));
    layer.addChild(scroll);

    // ── 下一关信息 ──
    const nextStage = isWin ? stage + 1 : stage;
    const nc = STAGE_MAP.get(nextStage);
    const bossTag = (nc?.isBoss ?? (nextStage % 10 === 0)) ? '【Boss】' : (nc?.isElite ? '【精英】' : '');
    const nextInfo = isWin
      ? `下一关：第 ${nextStage} 关${nc?.zone ? ` · ${nc.zone}` : ''}${bossTag}`
      : '';
    if (nextInfo) {
      const nextT = createText(nextInfo, 15, 0x8899bb, '600');
      nextT.anchor.set(0.5);
      nextT.position.set(pw / 2, ph - btnAreaH + 5);
      layer.addChild(nextT);
    }

    // ── 按钮 ──
    const btnMain = new UIButton(isWin ? '下一关' : '再战一次', 260, 70);
    btnMain.position.set((pw - 260) / 2, ph - 145);
    btnMain.on('pointertap', () => { modal.close(); void this.startBattle(); });

    const btnHome = new UIButton('返回主城', 260, 70);
    btnHome.position.set((pw - 260) / 2, ph - 65);
    btnHome.on('pointertap', () => { modal.close(); this.game.goTo('home', { animate: false }); });

    layer.addChild(btnMain, btnHome);
    modal.onClose = () => modal.clearLayer(PopupLayers.BATTLE_RESULT);
    modal.open();
  }

  private grantRewards(stage: number, isBoss: boolean, isElite: boolean): string[] {
    const heroes = this.game.state.getPartyHeroes().slice(0, 5)
      .map(id => this.game.state.getOwnedHero(id)).filter(Boolean);
    const valid = heroes.filter((h: any) => HERO_MAP[h.heroId]);
    const avgLv = valid.length > 0
      ? Math.max(1, Math.round(valid.reduce((s: number, h: any) => s + (h.level || 1), 0) / valid.length))
      : 1;

    const lines: string[] = [];

    // Compute deltas first, then apply as one atomic batch.
    let gold = Math.max(20, Math.round((60 + avgLv * 18) * (isElite ? 1.5 : 1)));
    let dia = 0;
    let shr = 0;
    let chestKey: string | null = null;
    let chestName: string | null = null;

    if (isBoss) {
      dia = Math.max(10, 20 + ((stage / 10) | 0) * 5);
      shr = Math.max(2, 6 + ((stage / 10) | 0));
      const chest = this.rollChest(stage);
      chestKey = chest.key;
      chestName = chest.name;
    }

    // AI Director reward modifiers (always apply on win)
    const goldMult = this.getModValue('gold_mult');
    if (goldMult) gold = Math.max(1, this.applyMult(gold, goldMult));
    const diaBonus = Math.max(0, Math.floor(this.getModValue('diamond_bonus') ?? 0));
    const shrBonus = Math.max(0, Math.floor(this.getModValue('shard_bonus') ?? 0));
    const chestBonus = Math.max(0, Math.floor(this.getModValue('chest_bonus') ?? 0));
    if (diaBonus) dia += diaBonus;
    if (shrBonus) shr += shrBonus;
    if (chestBonus > 0) {
      if (!chestKey) {
        const c = this.rollChest(stage);
        chestKey = c.key;
        chestName = c.name;
      }
      // Boss already gives one chest via chestKey; bonus adds one extra as the same type.
      // We encode "bonusChestCount" via inventory delta below.
    }

    this.game.state.withBatch(() => {
      // Currency (atomic)
      this.game.state.applyCurrencyDelta({ gold, diamonds: dia });
      // Inventory (atomic)
      const inv: Record<string, number> = {};
      if (isBoss || shrBonus > 0 || chestBonus > 0) {
        inv[ECONOMY.dupeShardKey] = (inv[ECONOMY.dupeShardKey] || 0) + shr;
        if (chestKey) inv[chestKey] = (inv[chestKey] || 0) + (isBoss ? 1 : 0) + chestBonus;
      }
      if (Object.keys(inv).length > 0) this.game.state.applyInventoryDeltas(inv);
      // Stage progress
      this.game.state.advanceStage(1);
    });

    lines.push(`金币 +${gold}`);
    if (dia > 0) lines.push(`钻石 +${dia}`);
    if (shr > 0) lines.push(`万能碎片 +${shr}`);
    if (chestKey && chestBonus > 0) {
      const cnt = (isBoss ? 1 : 0) + chestBonus;
      lines.push(`宝箱：${chestName ?? chestKey} x${cnt}`);
    } else if (isBoss && chestKey) {
      lines.push(`宝箱：${chestName ?? chestKey} x1`);
    }

    try {
      this.game.debug.info('BATTLE', 'rewards', { stage, isBoss, isElite, gold, dia, shr, chestKey });
    } catch (_) {}

    return lines;
  }

  private rollChest(stage: number): { key: string; name: string } {
    let r = Math.random();
    let key = 'chest_c';
    for (const c of BattleScene.CHEST_PROB) { r -= c.p; if (r <= 0) { key = c.key; break; } }
    if (stage % 50 === 0 && (key === 'chest_c' || key === 'chest_b')) key = 'chest_a';

    const NAMES: Record<string, string> = {
      chest_c: '普通宝箱', chest_b: '高级宝箱',
      chest_a: '史诗宝箱', chest_s: '传说宝箱',
    };
    return { key, name: (ECONOMY as any)[`${key}Name`] ?? NAMES[key] ?? key };
  }
}
