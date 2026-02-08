import type GameApp from '../core/GameApp';
import BaseScene from './BaseScene';
import BattleEngine from '../battle/BattleEngine';
import type { FighterSnapshot, Side } from '../battle/BattleTypes';
import UIButton from '../ui/components/UIButton';
import { createText } from '../ui/uiFactory';
import { HERO_MAP } from '../game/data';
import { ECONOMY, ELEMENTS, RARITY } from '../game/config';
import { calculateHeroStats, calculateEnemyStats } from '../game/heroStats';
import stagesJson from '../configs/stages.json';

/* ── Stage config types ──────────────────────────────── */

interface StageEnemy {
  name: string;
  element: string;
  rarity: string;
  skills: string[];
  bossMult?: number;
}

interface StageConfig {
  id: number;
  name: string;
  zone: string;
  isBoss: boolean;
  isElite: boolean;
  levelOffset: number;
  enemies: StageEnemy[];
}

const STAGES: StageConfig[] = stagesJson as unknown as StageConfig[];

/**
 * BattleScene
 *
 * v0.0.75: Read enemy composition from stages.json config.
 * Fallback to procedural generation for stages beyond config range.
 */
export default class BattleScene extends BaseScene {
  private readonly game: GameApp;
  private readonly engine: BattleEngine;
  private readonly title;
  private readonly btnRestart;
  private readonly btnSpeed;
  private readonly hint;

  private speedIdx = 1;
  private static readonly SPEEDS = [0.75, 1, 1.5, 2] as const;

  private battleResolved = false;
  private pendingWinner: Side | 'Draw' | null = null;
  private endDelayTicks = 0;
  private deadGraceTicks = 0;

  // 防止连点重开导致旧战斗的延迟结算/动画回调误触发
  private battleRunId = 0;
  private pendingWinnerRunId = 0;
  private isRestarting = false;

  // Boss chest drop rates (boss win only)
  private static readonly CHEST_PROB = [
    { key: 'chest_c', p: 0.6 },
    { key: 'chest_b', p: 0.25 },
    { key: 'chest_a', p: 0.12 },
    { key: 'chest_s', p: 0.03 },
  ] as const;

  constructor(game: GameApp) {
    super('battle');
    this.game = game;
    this.engine = new BattleEngine({ stepIntervalTicks: 44 });

    // Intercept battle end to trigger settlement (rewards + popup).
    const rawEmit = this.engine.emit.bind(this.engine);
    (this.engine as any).emit = (e: any) => {
      rawEmit(e);
      if (e.type === 'dead') {
        this.deadGraceTicks = 80;
      }
      if (e?.type === 'battleEnd') {
        if (this.battleResolved || this.pendingWinner) return;
        const winner: Side | 'Draw' = e.payload?.winner;
        this.pendingWinner = winner;
        this.pendingWinnerRunId = this.battleRunId;
        const baseDelay = 70;
        this.endDelayTicks = Math.max(baseDelay, this.deadGraceTicks);
      }
    };

    this.title = createText('战斗', 40, 0xffffff, '900');
    this.title.anchor.set(0.5);
    this.root.addChild(this.title);

    this.root.addChild(this.engine.view.root);

    this.btnRestart = new UIButton('重新开始', 240, 78);
    this.btnRestart.on('pointertap', () => this.startBattleFromState());
    this.root.addChild(this.btnRestart);

    this.btnSpeed = new UIButton('速度 x1', 200, 64);
    this.btnSpeed.on('pointertap', () => this.cycleSpeed());
    this.root.addChild(this.btnSpeed);

    this.hint = createText('自动回合制：使用玩家队伍 + 胜利奖励 ✅', 18, 0xd7e6ff, '800');
    this.hint.anchor.set(0.5);
    this.root.addChild(this.hint);
  }

  public override onEnter(): void {
    this.game.bottomNav.visible = false;
    this.speedIdx = 1;
    this.applySpeed(BattleScene.SPEEDS[this.speedIdx] ?? 1);
    this.startBattleFromState();
  }

  public override onExit(): void {
    this.game.bottomNav.visible = true;
  }

  public override onResize(w: number, h: number): void {
    if (!this.title || (this.title as any).destroyed) return;
    this.title.position.set(w / 2, 92);
    const root: any = (this.engine as any)?.view?.root;
    if (root && !root.destroyed) root.position.set((w - 720) / 2, 120);
    if (this.btnRestart && !(this.btnRestart as any).destroyed) this.btnRestart.position.set((w - 240) / 2, h - 156);
    if (this.btnSpeed && !(this.btnSpeed as any).destroyed) this.btnSpeed.position.set(w - 200 - 18, 28);
    if (this.hint && !(this.hint as any).destroyed) this.hint.position.set(w / 2, h - 76);
  }

  public override onUpdate(dt: number): void {
    this.engine.update(dt);

    if (this.deadGraceTicks > 0) this.deadGraceTicks -= dt;

    if (this.pendingWinner && !this.battleResolved) {
      if (this.pendingWinnerRunId !== this.battleRunId) {
        this.pendingWinner = null;
        this.pendingWinnerRunId = 0;
        return;
      }
      
      this.endDelayTicks -= dt;
      if (this.endDelayTicks <= 0 && !this.engine.view.isAnimating()) {
        const winner = this.pendingWinner;
        this.pendingWinner = null;
        this.pendingWinnerRunId = 0;
        this.onBattleEnd(winner);
      }
    }
  }

  /* ── Stage config lookup ───────────────────────────── */

  private getStageConfig(stage: number): StageConfig | undefined {
    return STAGES.find((s) => s.id === stage);
  }

  private startBattleFromState(): void {
    if (this.isRestarting) return;
    
    this.battleRunId++;
    const currentRunId = this.battleRunId;
    
    this.battleResolved = false;
    this.pendingWinner = null;
    this.pendingWinnerRunId = 0;
    this.endDelayTicks = 0;
    this.deadGraceTicks = 0;
    
    this.engine.view.stopAllAnimations();
    this.applySpeed(BattleScene.SPEEDS[this.speedIdx] ?? 1);
    
    this.isRestarting = true;
    this.btnRestart.setDisabled(true);
    setTimeout(() => {
      if (this.battleRunId === currentRunId) {
        this.isRestarting = false;
        this.btnRestart.setDisabled(false);
      }
    }, 300);

    const rawParty = this.game.state.getPartyHeroes().slice(0, 5);
    if (rawParty.length < 1) {
      this.game.toast.show("请先上阵至少1名英雄", 2);
      this.game.goTo("home", { animate: false });
      return;
    }

    const ownedHeroes = rawParty
      .map((id) => this.game.state.getOwnedHero(id))
      .filter((h): h is any => !!h)
      .slice(0, 5);

    const validHeroes = ownedHeroes.filter((h) => !!HERO_MAP[h.heroId]);
    if (validHeroes.length !== ownedHeroes.length) {
      const nextSlots = (this.game.state.partySlots ?? [null, null, null, null, null]).map((id) =>
        id && HERO_MAP[id] ? id : null,
      );
      this.game.state.setPartySlots(nextSlots);
    }

    if (validHeroes.length < 1) {
      this.game.toast.show("队伍英雄无效，请重新上阵", 2);
      this.game.state.setPartySlots([]);
      this.game.goTo("home", { animate: false });
      return;
    }

    const mk = (id: string, name: string, side: 'A' | 'B', hp: number, atk: number, def: number, spd: number, skills?: string[], element?: string): FighterSnapshot => ({
      id, name, side, hp, maxHp: hp, atk, def, spd, element, skills,
    });

    // --- Team A: player's owned heroes ---
    const teamA: FighterSnapshot[] = validHeroes.map((o, idx) => {
      const def = HERO_MAP[o.heroId];
      const rarity = def?.rarity ?? RARITY.R;
      const name = def?.name ?? `英雄${idx + 1}`;
      const stars = o.stars || 0;
      const { hp, atk, def: df, spd } = calculateHeroStats(o.level || 1, rarity, stars);
      const skills = def?.skills ?? [];
      const element = def?.element;
      return mk(`p${idx + 1}:${o.heroId}`, name, 'A', hp, atk, df, spd, skills, element);
    });

    // --- Team B: read from stage config or fallback ---
    const stage = this.getCurrentStage();
    const stageConf = this.getStageConfig(stage);
    const avgLv = Math.max(1, Math.round(validHeroes.reduce((s, h) => s + (h.level || 1), 0) / validHeroes.length));

    let teamB: FighterSnapshot[];

    if (stageConf) {
      // Config-driven enemy generation
      const levelOffset = stageConf.levelOffset ?? 0;
      const enemyBaseLv = Math.min(60, avgLv + 2 + levelOffset);

      teamB = stageConf.enemies.map((enemy, i) => {
        const r = enemy.rarity ?? (enemyBaseLv >= 20 ? RARITY.SR : RARITY.R);
        const { hp, atk, def: df, spd } = calculateEnemyStats(enemyBaseLv, r, i);
        const mult = enemy.bossMult ?? 1;
        const hp2 = Math.round(hp * mult);
        const atk2 = Math.round(atk * mult);
        const def2 = Math.round(df * mult);
        const element = enemy.element ?? ELEMENTS[i % ELEMENTS.length];
        return mk(`e${i + 1}`, enemy.name, 'B', hp2, atk2, def2, spd, enemy.skills ?? [], element);
      });

      // Update title with stage zone info
      this.title.text = `${stageConf.zone} · 第${stage}关`;
    } else {
      // Fallback: procedural generation for stages beyond config
      teamB = this.generateFallbackEnemies(stage, avgLv, mk);
      this.title.text = `第${stage}关`;
    }

    this.engine.start({ teamA, teamB });
  }

  /**
   * Fallback enemy generation for stages beyond the 100-stage config.
   * Preserves original procedural logic.
   */
  private generateFallbackEnemies(
    stage: number,
    avgLv: number,
    mk: (id: string, name: string, side: 'A' | 'B', hp: number, atk: number, def: number, spd: number, skills?: string[], element?: string) => FighterSnapshot,
  ): FighterSnapshot[] {
    const stageBoost = Math.floor((stage - 1) / 3);
    const enemyLv = Math.min(60, avgLv + 2 + stageBoost);
    const isBossStage = stage % 10 === 0;
    const enemyCount = isBossStage ? 4 : 3;
    const bossMult = isBossStage ? 1.25 : 1;
    const enemySkillPool: string[][] = [['sk_fireball'], ['sk_poison'], ['sk_slow', 'sk_shield']];
    return Array.from({ length: enemyCount }).map((_, i) => {
      const r = enemyLv >= 20 ? RARITY.SR : RARITY.R;
      const { hp, atk, def: df, spd } = this.genEnemyStats(enemyLv, r, i);
      const hp2 = Math.round(hp * bossMult);
      const atk2 = Math.round(atk * bossMult);
      const def2 = Math.round(df * bossMult);
      const skills = enemySkillPool[i % enemySkillPool.length] ?? [];
      const element = ELEMENTS[i % ELEMENTS.length];
      return mk(`e${i + 1}`, `敌人${i + 1}`, 'B', hp2, atk2, def2, spd, skills, element);
    });
  }

  private cycleSpeed(): void {
    this.speedIdx = (this.speedIdx + 1) % BattleScene.SPEEDS.length;
    this.applySpeed(BattleScene.SPEEDS[this.speedIdx] ?? 1, true);
  }

  private applySpeed(mult: number, showToast = false): void {
    this.engine.setSpeed(mult);
    const m = this.engine.getSpeed();
    const label = m === 1 ? '速度 x1' : `速度 x${m}`;
    this.btnSpeed.setLabel(label);
    if (showToast) this.game.toast.show(`战斗速度：x${m}`, 1);
  }

  private getCurrentStage(): number {
    return this.game.state.stage;
  }

  private rollBossChest(stage: number): string {
    let r = Math.random();
    let picked = 'chest_c';
    for (const it of BattleScene.CHEST_PROB) {
      r -= it.p;
      if (r <= 0) {
        picked = it.key;
        break;
      }
    }
    if (stage % 50 === 0 && (picked === 'chest_c' || picked === 'chest_b')) {
      picked = 'chest_a';
    }
    return picked;
  }

  private genEnemyStats(level: number, rarity: string, index: number): { hp: number; atk: number; def: number; spd: number } {
    return calculateEnemyStats(level, rarity, index);
  }

  private onBattleEnd(winner: Side | 'Draw'): void {
    if (this.battleResolved) return;
    this.battleResolved = true;

    const modal = this.game.modal;
    modal.content.removeChildren();

    const panelW = modal.panel.width;
    const panelH = modal.panel.height;

    const isWin = winner === 'A';
    const stage = this.getCurrentStage();
    const stageConf = this.getStageConfig(stage);
    const isBoss = stageConf ? stageConf.isBoss : (stage % 10 === 0);
    const isElite = stageConf?.isElite ?? false;

    const title = createText(isWin ? '胜利！' : winner === 'B' ? '失败' : '平局', 44, 0xffffff, '900');
    title.anchor.set(0.5);
    title.position.set(panelW / 2, 86);

    const lines: string[] = [];
    if (isWin) {
      const partyIds = this.game.state.getPartyHeroes().slice(0, 5);
      const partyHeroes = partyIds.map((id) => this.game.state.getOwnedHero(id)).filter((h): h is any => !!h);
      const partyValid = partyHeroes.filter((h) => !!HERO_MAP[h.heroId]);
      const avgLv = partyValid.length > 0 ? Math.max(1, Math.round(partyValid.reduce((s, h) => s + (h.level || 1), 0) / partyValid.length)) : 1;

      // Gold reward: base + scaling. Elite stages get 50% bonus.
      const goldMult = isElite ? 1.5 : 1;
      const gold = Math.max(20, Math.round((60 + avgLv * 18) * goldMult));
      this.game.state.addGold(gold);
      lines.push(`金币 +${gold}`);

      this.game.state.advanceStage(1);

      if (isBoss) {
        const diamonds = Math.max(10, 20 + Math.floor(stage / 10) * 5);
        const shards = Math.max(2, 6 + Math.floor(stage / 10));
        this.game.state.addDiamonds(diamonds);
        this.game.state.addInventory(ECONOMY.dupeShardKey, shards);
        lines.push(`钻石 +${diamonds}`);
        lines.push(`万能碎片 +${shards}`);

        const chestKey = this.rollBossChest(stage);
        this.game.state.addInventory(chestKey, 1);
        const econ = ECONOMY as any;
        const chestName =
          chestKey === 'chest_c'
            ? econ.chest_cName ?? '普通宝箱'
            : chestKey === 'chest_b'
              ? econ.chest_bName ?? '高级宝箱'
              : chestKey === 'chest_a'
                ? econ.chest_aName ?? '史诗宝箱'
                : econ.chest_sName ?? '传说宝箱';
        lines.push(`宝箱：${chestName} x1`);
      }
    } else {
      lines.push(winner === 'Draw' ? '本次战斗平局，无奖励。' : '本次战斗失败，无奖励。');
    }

    const rewardText = isWin ? `获得奖励：\n${lines.join('\n')}` : lines[0];
    const nextStage = isWin ? stage + 1 : stage;
    const nextConf = this.getStageConfig(nextStage);
    const nextBossTag = (nextConf?.isBoss ?? (nextStage % 10 === 0)) ? '【Boss】' : (nextConf?.isElite ? '【精英】' : '');
    const nextZone = nextConf?.zone ? `· ${nextConf.zone}` : '';
    const nextLine = isWin ? `\n\n下一关：第 ${nextStage} 关${nextZone}${nextBossTag}` : '';
    const desc = createText(rewardText + nextLine, 24, 0xffe3a3, '800');
    desc.anchor.set(0.5);
    desc.position.set(panelW / 2, 186);
    (desc.style as any).align = 'center';
    (desc.style as any).lineHeight = 34;
    (desc.style as any).wordWrap = true;
    (desc.style as any).wordWrapWidth = panelW - 80;

    const btnHome = new UIButton('返回主城', 320, 86);
    btnHome.position.set((panelW - 320) / 2, panelH - 160);
    btnHome.on('pointertap', () => {
      modal.close();
      this.game.goTo('home', { animate: false });
    });

    const btnPrimary = new UIButton(isWin ? '下一关' : '再战一次', 320, 86);
    btnPrimary.position.set((panelW - 320) / 2, panelH - 260);
    btnPrimary.on('pointertap', () => {
      modal.close();
      this.startBattleFromState();
    });

    modal.content.addChild(title, desc, btnPrimary, btnHome);
    modal.onClose = () => {
      modal.content.removeChildren();
    };
    modal.open();
  }
}
