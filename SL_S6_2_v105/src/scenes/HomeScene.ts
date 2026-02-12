import type GameApp from '../core/GameApp';
import BaseScene from './BaseScene';
import UIButton from '../ui/components/UIButton';
import { createText } from '../ui/uiFactory';
import { formatMods, generateDirectiveByDeepSeek, getDirectorApiKey, pickLocalDirective } from '../game/director';

/**
 * HomeScene v0.86 — 彻底移除入场动画，保证首次加载正常
 *
 * 此前三版动画方案均因 onEnter/onResize/onUpdate 时序冲突而导致
 * 首次加载 UI 错乱。根本原因：PixiJS 场景切换的生命周期（特别是
 * animated 过渡中 onResize 延迟调用）与动画系统的 alpha/position
 * 操纵存在不可调和的竞争条件。
 *
 * 决策：移除首页入场动画，保留场景过渡动画（SceneManager crossfade）。
 */
export default class HomeScene extends BaseScene {
  private readonly game: GameApp;
  private readonly title;
  private readonly sub;
  private readonly stageText;
  private readonly directorText;
  private readonly btnSummon;
  private readonly btnHeroes;
  private readonly btnBag;
  private readonly btnBattle;
  private readonly tip;

  private unlistenStage?: () => void;

  constructor(game: GameApp) {
    super('home');
    this.game = game;

    this.title = createText('主城', 48, 0xffffff, '900');
    this.title.anchor.set(0.5);
    this.root.addChild(this.title);

    this.sub = createText('MVP：抽卡 · 英雄 · 背包', 22, 0xcfe3ff, '700');
    this.sub.anchor.set(0.5);
    this.root.addChild(this.sub);

    this.stageText = createText('当前关卡：第 1 关', 24, 0xe6f2ff, '800');
    this.stageText.anchor.set(0.5);
    this.root.addChild(this.stageText);

    this.directorText = createText('', 16, 0xffe3a3, '800');
    this.directorText.anchor.set(0.5);
    (this.directorText.style as any).wordWrap = true;
    (this.directorText.style as any).align = 'center';
    this.root.addChild(this.directorText);

    this.btnSummon = new UIButton('进入抽卡', 420, 92);
    this.btnHeroes = new UIButton('英雄', 420, 92);
    this.btnBag = new UIButton('背包', 420, 92);
    this.btnBattle = new UIButton('挑战第 1 关', 420, 92);

    this.btnSummon.on('pointertap', () => this.game.goTo('summon'));
    this.btnHeroes.on('pointertap', () => this.game.goTo('heroes'));
    this.btnBag.on('pointertap', () => this.game.goTo('bag'));
    this.btnBattle.on('pointertap', () => {
      const partyCount = this.game.state.getPartyHeroes().length;
      if (partyCount <= 0) {
        this.game.toast.show('队伍为空：请去【英雄】页，点英雄卡牌→上阵至少1名英雄', 2);
        return;
      }
      this.game.goTo('battle');
    });

    this.root.addChild(this.btnSummon, this.btnHeroes, this.btnBag, this.btnBattle);

    this.tip = createText('提示：右上角 ⚙ 可重置存档', 20, 0xd0e2ff, '700');
    this.tip.anchor.set(0.5);
    this.root.addChild(this.tip);
  }

  private formatStage(stage: number): { stageText: string; btnText: string } {
    const s = Math.max(1, Math.floor(stage || 1));
    const isBoss = s % 10 === 0;
    const bossTag = isBoss ? '【Boss】' : '';
    return {
      stageText: `当前关卡：第 ${s} 关${bossTag}`,
      btnText: `挑战第 ${s} 关${bossTag}`,
    };
  }

  private applySingleLineEllipsis(t: any, maxW: number): void {
    if (!t) return;
    if (t.width <= maxW) return;
    const raw = String(t.text ?? '');
    let s = raw;
    while (s.length > 0 && t.width > maxW) {
      s = s.slice(0, -1);
      t.text = s + '…';
    }
  }

  private updateStageUI(): void {
    const stage = this.game.state.stage;
    const f = this.formatStage(stage);
    this.stageText.text = f.stageText;
    this.btnBattle.setLabel(f.btnText);
    // director preview (may be empty until generated)
    const dOn = this.game.state.directorEnabled;
    const cached = (this.game.state.directorStage === stage && this.game.state.directorDirective)
      ? this.game.state.directorDirective
      : null;
    if (!dOn) {
      this.directorText.text = '🎬 AI导演：已关闭';
    } else if (cached) {
      this.directorText.text = `🎬 ${cached.title}  ·  ${cached.desc}\n${formatMods(cached.mods)}`;
    } else {
      this.directorText.text = `🎬 AI导演：已开启（${this.game.state.directorModel}）`;
    }
  }

  private async prewarmDirector(): Promise<void> {
    const stage = this.game.state.stage;
    if (!this.game.state.directorEnabled) return;
    if (this.game.state.directorStage === stage && this.game.state.directorDirective) return;

    const snapshot = this.game.state.getSnapshot();
    const apiKey = getDirectorApiKey();
    if (!apiKey) {
      const local = pickLocalDirective(stage);
      this.game.state.setDirectorDirective(stage, local);
      return;
    }
    const directive = await generateDirectiveByDeepSeek({
      apiKey,
      model: this.game.state.directorModel,
      stage,
      snapshot,
      timeoutMs: 2500,
    });
    this.game.state.setDirectorDirective(stage, directive);
  }

  // ══════════════════════════════════════════════════════
  // 生命周期 — 纯静态，无动画
  // ══════════════════════════════════════════════════════

  public override onEnter(): void {
    this.updateStageUI();
    void this.prewarmDirector().then(() => this.updateStageUI());
    this.unlistenStage?.();
    this.unlistenStage = this.game.state.on('stageChanged', () => this.updateStageUI());
  }

  public override onExit(): void {
    this.unlistenStage?.();
    this.unlistenStage = undefined;
  }

  public override onResize(w: number, h: number): void {
    if (!this.title || (this.title as any).destroyed) return;

    this.title.position.set(w / 2, 210);
    this.sub.position.set(w / 2, 270);

    this.stageText.position.set(w / 2, 338);

    this.directorText.position.set(w / 2, 375);
    (this.directorText.style as any).wordWrapWidth = Math.max(200, w - 80);
    (this.stageText.style as any).wordWrap = false;
    (this.stageText.style as any).wordWrapWidth = w - 80;
    this.applySingleLineEllipsis(this.stageText, Math.max(120, w - 80));

    const y0 = 445;
    this.btnSummon.position.set((w - 420) / 2, y0);
    this.btnHeroes.position.set((w - 420) / 2, y0 + 120);
    this.btnBag.position.set((w - 420) / 2, y0 + 240);
    this.btnBattle.position.set((w - 420) / 2, y0 + 360);

    this.tip.position.set(w / 2, h - 110);
  }
}
