import type GameApp from '../../core/GameApp';
import { Container, Graphics, Text } from 'pixi.js';
import UIButton from '../../ui/components/UIButton';
import HeroCard from '../../ui/components/HeroCard';
import ScrollView from '../../ui/components/ScrollView';
import { createText, rarityLabel, roundedRect } from '../../ui/uiFactory';
import { type HeroDef } from '../../game/data';

export type SummonResultItem = {
  hero: HeroDef;
  rewardNote: string;
  isNew: boolean;
};

/**
 * A scene-independent helper that renders summon results inside the global Modal.
 *
 * We keep using the global `Modal` for Phase-3, but hide its implementation details
 * behind this small helper to avoid scenes directly manipulating modal internals.
 */
export default class SummonResultPopup {
  private readonly game: GameApp;
  // Keep latest wheel-unbind function so modal close can safely cleanup in both single/multi cases.
  private unbindWheel?: () => void;

  constructor(game: GameApp) {
    this.game = game;
  }

  /** Show a single hero result (with big card + glow). */
  public showSingle(item: SummonResultItem): void {
    const modal = this.game.modal;
    modal.content.removeChildren();

    const panelW = modal.panel.width;
    const panelH = modal.panel.height;

    const title = createText('获得英雄', 36, 0xffffff, '900');
    title.anchor.set(0.5);
    title.position.set(panelW / 2, 72);

    const card = new HeroCard(item.hero, this.game.state.getOwnedHero(item.hero.id));
    card.scale.set(1.32);
    card.position.set((panelW - card.w * 1.32) / 2, 160);

    // Subtle glow pulse (no external tween lib)
    let t = 0;
    const tick = (dt: number) => {
      t += dt / 60;
      const s = 1 + Math.sin(t * 6) * 0.02;
      card.scale.set(1.32 * s);
      card.glow.alpha = 0.1 + (Math.sin(t * 10) + 1) * 0.08;
      if (!modal.visible) this.game.pixi.ticker.remove(tick);
    };
    this.game.pixi.ticker.add(tick);

    const meta = createText(`${item.hero.element} · ${rarityLabel(item.hero.rarity)}`, 24, 0xd7e6ff, '800');
    meta.anchor.set(0.5);
    meta.position.set(panelW / 2, 610);

    const tag = item.isNew ? 'NEW' : 'DUP';
    const tagBox = this.smallTag(tag, item.isNew ? 0x62ffb8 : 0xffe3a3);
    tagBox.position.set(panelW / 2 - 54, 648);

    const note = createText(item.rewardNote, 20, 0xffe3a3, '800');
    note.anchor.set(0.5);
    note.position.set(panelW / 2, 690);

    const btnOk = new UIButton('确定', 320, 86);
    btnOk.position.set((panelW - 320) / 2, panelH - 140);
    btnOk.on('pointertap', () => modal.close());

    modal.content.addChild(title, card, meta, tagBox, note, btnOk);
    modal.onClose = () => {
      // Cleanup: unbind wheel and clear content when modal closes.
      // No ScrollView in single-result popup, but we still defensively cleanup any previous binding.
      this.unbindWheel?.();
      this.unbindWheel = undefined;
      modal.content.removeChildren();
    };
    modal.open();
  }

  /** Show ten results as a scrollable list. */
  public showMulti(items: SummonResultItem[]): void {
    const modal = this.game.modal;
    modal.content.removeChildren();

    const panelW = modal.panel.width;
    const panelH = modal.panel.height;

    const title = createText('十连结果', 36, 0xffffff, '900');
    title.anchor.set(0.5);
    title.position.set(panelW / 2, 72);

    const hint = createText('上下滑动查看全部结果', 18, 0xcfe3ff, '700');
    hint.anchor.set(0.5);
    hint.position.set(panelW / 2, 112);

    const viewW = panelW - 80;
    const viewH = panelH - 260;
    const list = new ScrollView(viewW, viewH);
    // Bind wheel on canvas for desktop; unbind when modal closes to avoid stacking listeners.
    this.unbindWheel?.(); // avoid leaking previous binding if modal re-opens rapidly
    this.unbindWheel = list.bindWheel(this.game.pixi.view);
    list.position.set(40, 150);

    // Build rows
    let yy = 0;
    for (const it of items) {
      const row = this.buildRow(viewW, it);
      row.position.set(0, yy);
      list.content.addChild(row);
      yy += 132;
    }

    const btnOk = new UIButton('确定', 320, 86);
    btnOk.position.set((panelW - 320) / 2, panelH - 140);
    btnOk.on('pointertap', () => modal.close());

    modal.content.addChild(title, hint, list, btnOk);
    modal.onClose = () => {
      // Cleanup: unbind wheel and clear content when modal closes.
      this.unbindWheel?.();
      this.unbindWheel = undefined;
      modal.content.removeChildren();
    };
    modal.open();
  }

  private buildRow(w: number, it: SummonResultItem): Container {
    const row = new Container();
    const bg = new Graphics();
    bg.beginFill(0x000000, 0.18);
    roundedRect(bg, 0, 0, w, 120, 22);
    bg.endFill();
    row.addChild(bg);

    const card = new HeroCard(it.hero, this.game.state.getOwnedHero(it.hero.id));
    card.scale.set(0.68);
    card.position.set(12, 12);
    row.addChild(card);

    const name = createText(it.hero.name, 22, 0xffffff, '900');
    name.anchor.set(0, 0.5);
    name.position.set(150, 38);
    row.addChild(name);

    const meta = createText(`${it.hero.element} · ${rarityLabel(it.hero.rarity)}`, 16, 0xd7e6ff, '700');
    meta.anchor.set(0, 0.5);
    meta.position.set(150, 66);
    row.addChild(meta);

    const note = createText(it.rewardNote, 16, 0xffe3a3, '700');
    note.anchor.set(0, 0.5);
    note.position.set(150, 92);
    note.style.wordWrap = true;
    note.style.wordWrapWidth = w - 170;
    row.addChild(note);

    const tagBox = this.smallTag(it.isNew ? 'NEW' : 'DUP', it.isNew ? 0x62ffb8 : 0xffe3a3);
    tagBox.position.set(w - 120, 36);
    row.addChild(tagBox);

    return row;
  }

  private smallTag(label: string, color: number): Container {
    const c = new Container();
    const g = new Graphics();
    g.beginFill(color, 0.22);
    g.lineStyle({ width: 2, color, alpha: 0.55 });
    roundedRect(g, 0, 0, 108, 44, 16);
    g.endFill();
    c.addChild(g);
    const t = createText(label, 18, color, '900');
    t.anchor.set(0.5);
    t.position.set(54, 22);
    c.addChild(t);
    return c;
  }
}