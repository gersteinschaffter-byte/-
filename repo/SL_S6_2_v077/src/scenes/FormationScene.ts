import { Container, Graphics } from 'pixi.js';
import type GameApp from '../core/GameApp';
import BaseScene from './BaseScene';
import { HEROES, HERO_MAP } from '../game/data';
import HeroCard from '../ui/components/HeroCard';
import ScrollView from '../ui/components/ScrollView';
import UIButton from '../ui/components/UIButton';
import { createText, drawPanel, roundedRect } from '../ui/uiFactory';

const MAX_SLOTS = 5;

type SlotUI = {
  container: Container;
  bg: Graphics;
  indexText: any;
  nameText: any;
  hintText: any;
  w: number;
  h: number;
};

export default class FormationScene extends BaseScene {
  private readonly game: GameApp;
  private readonly title;
  private readonly hint;
  private readonly actionHint;
  private readonly panel: Graphics;
  private readonly slotsContainer: Container;
  private readonly slotActionBar: Container;
  private readonly btnRemove;
  private readonly btnReplace;
  private readonly btnSave;
  private readonly scroll: ScrollView;
  private readonly heroListContainer: Container;
  private readonly emptyHeroText;
  private readonly slotUIs: SlotUI[] = [];

  private heroCards = new Map<string, HeroCard>();
  private heroOrder: string[] = [];

  private pendingSlots: Array<string | null> = Array(MAX_SLOTS).fill(null);
  private selectedSlotIndex: number | null = null;
  private choosingHero = false;
  private scrollViewW = 0;
  private scrollViewH = 0;

  private unsubs: Array<() => void> = [];

  constructor(game: GameApp) {
    super('formation');
    this.game = game;

    this.title = createText('布阵', 44, 0xffffff, '900');
    this.title.anchor.set(0.5);
    this.root.addChild(this.title);

    this.hint = createText('点击英雄卡：空槽位自动上阵；点击槽位可选择/交换', 18, 0xcfe3ff, '700');
    this.hint.anchor.set(0.5);
    this.root.addChild(this.hint);

    this.actionHint = createText('', 18, 0xffe29a, '800');
    this.actionHint.anchor.set(0.5);
    this.root.addChild(this.actionHint);

    this.panel = drawPanel(700, 1060, 0.96);
    this.root.addChild(this.panel);

    this.slotsContainer = new Container();
    this.panel.addChild(this.slotsContainer);

    this.slotActionBar = new Container();
    this.panel.addChild(this.slotActionBar);

    this.btnRemove = new UIButton('移除', 180, 64);
    this.btnReplace = new UIButton('更换', 180, 64);
    this.slotActionBar.addChild(this.btnRemove, this.btnReplace);
    this.slotActionBar.visible = false;

    this.btnSave = new UIButton('保存阵容', 260, 72);
    this.root.addChild(this.btnSave);

    this.scroll = new ScrollView(660, 600);
    this.panel.addChild(this.scroll);

    this.heroListContainer = new Container();
    this.scroll.content.addChild(this.heroListContainer);

    this.emptyHeroText = createText('暂无已拥有英雄', 22, 0x9fb3d9, '700');
    this.emptyHeroText.anchor.set(0.5);
    this.heroListContainer.addChild(this.emptyHeroText);

    this.btnSave.on('pointertap', () => this.saveFormation());
    this.btnRemove.on('pointertap', () => this.removeSelectedSlotHero());
    this.btnReplace.on('pointertap', () => this.enableReplaceMode());

    this.buildSlotUI();
  }

  public override onEnter(): void {
    this.loadFromState();
    this.rebuildHeroList();
    this.updateSlotUI();
    this.updateActionHint();

    this.unsubs.forEach((u) => {
      try { u(); } catch (_) {}
    });
    this.unsubs = [];
    this.unsubs.push(this.game.state.on('heroesChanged', () => {
      this.rebuildHeroList();
      this.updateSlotUI();
    }));
  }

  public override onExit(): void {
    this.unsubs.forEach((u) => {
      try { u(); } catch (_) {}
    });
    this.unsubs = [];
  }

  public override onResize(w: number, h: number): void {
    this.title.position.set(w / 2, 110);
    this.hint.position.set(w / 2, 156);
    this.actionHint.position.set(w / 2, 184);

    this.panel.position.set((w - this.panel.width) / 2, 210);

    const panelW = this.panel.width;
    const panelH = this.panel.height;

    this.layoutSlots(panelW);
    this.layoutActionBar(panelW);

    const scrollTop = 300;
    const scrollPadding = 20;
    const scrollW = panelW - scrollPadding * 2;
    const scrollH = panelH - scrollTop - 120;

    this.scroll.position.set(scrollPadding, scrollTop);
    this.scroll.resize(scrollW, scrollH);
    this.scrollViewW = scrollW;
    this.scrollViewH = scrollH;

    this.layoutHeroCards();
    if (this.heroOrder.length === 0) {
      this.emptyHeroText.position.set(this.scrollViewW / 2, 80);
      this.scroll.setContentHeight(Math.max(this.scrollViewH, 160));
    }

    this.btnSave.position.set((w - 260) / 2, h - 120);

    this.updateSlotUI();
    this.updateActionHint();
  }

  private buildSlotUI(): void {
    for (let i = 0; i < MAX_SLOTS; i += 1) {
      const container = new Container();
      const bg = new Graphics();
      const indexText = createText(`槽位 ${i + 1}`, 18, 0xcfe3ff, '800');
      indexText.anchor.set(0.5);
      const nameText = createText('空位', 20, 0xffffff, '800');
      nameText.anchor.set(0.5);
      const hintText = createText('', 16, 0x9fb3d9, '700');
      hintText.anchor.set(0.5);

      container.addChild(bg, indexText, nameText, hintText);
      container.interactive = true;
      container.cursor = 'pointer';
      container.on('pointertap', () => this.handleSlotTap(i));

      this.slotUIs.push({ container, bg, indexText, nameText, hintText, w: 0, h: 0 });
      this.slotsContainer.addChild(container);
    }
  }

  private layoutSlots(panelW: number): void {
    const gap = 12;
    const slotW = Math.floor((panelW - gap * 4) / 5);
    const slotH = 96;
    for (let i = 0; i < this.slotUIs.length; i += 1) {
      const slot = this.slotUIs[i];
      slot.container.position.set(i * (slotW + gap), 20);
      slot.w = slotW;
      slot.h = slotH;

      slot.bg.clear();
      slot.bg.lineStyle(2, 0x365a9a, 0.9);
      slot.bg.beginFill(0x0e1733, 0.95);
      roundedRect(slot.bg, 0, 0, slotW, slotH, 16);
      slot.bg.endFill();

      slot.indexText.position.set(slotW / 2, 22);
      slot.nameText.position.set(slotW / 2, 50);
      slot.hintText.position.set(slotW / 2, 74);
    }
  }

  private layoutActionBar(panelW: number): void {
    this.slotActionBar.position.set((panelW - 380) / 2, 130);
    this.btnRemove.position.set(0, 0);
    this.btnReplace.position.set(200, 0);
  }

  private handleSlotTap(index: number): void {
    if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== index) {
      this.swapSlots(this.selectedSlotIndex, index);
      return;
    }

    const heroId = this.pendingSlots[index];

    this.selectedSlotIndex = index;
    if (!heroId) {
      this.choosingHero = true;
    } else {
      this.choosingHero = false;
    }

    this.updateSlotUI();
    this.updateActionHint();
  }

  private swapSlots(a: number, b: number): void {
    const tmp = this.pendingSlots[a];
    this.pendingSlots[a] = this.pendingSlots[b];
    this.pendingSlots[b] = tmp ?? null;
    this.selectedSlotIndex = null;
    this.choosingHero = false;
    this.updateSlotUI();
    this.updateActionHint();
  }

  private removeSelectedSlotHero(): void {
    if (this.selectedSlotIndex === null) return;
    const heroId = this.pendingSlots[this.selectedSlotIndex];
    if (!heroId) return;
    this.pendingSlots[this.selectedSlotIndex] = null;
    this.selectedSlotIndex = null;
    this.choosingHero = false;
    this.updateSlotUI();
    this.updateActionHint();
  }

  private enableReplaceMode(): void {
    if (this.selectedSlotIndex === null) return;
    if (!this.pendingSlots[this.selectedSlotIndex]) return;
    this.choosingHero = true;
    this.updateSlotUI();
    this.updateActionHint();
  }

  private onHeroTap(heroId: string): void {
    if (this.choosingHero && this.selectedSlotIndex !== null) {
      this.placeHeroInSlot(heroId, this.selectedSlotIndex);
      this.selectedSlotIndex = null;
      this.choosingHero = false;
      this.updateSlotUI();
      this.updateActionHint();
      return;
    }

    const emptyIndex = this.pendingSlots.findIndex((slotId) => !slotId);
    if (emptyIndex === -1) {
      this.game.toast.show('队伍已满，请先选择槽位更换', 2);
      return;
    }

    this.placeHeroInSlot(heroId, emptyIndex);
    this.updateSlotUI();
    this.updateActionHint();
  }

  private placeHeroInSlot(heroId: string, slotIndex: number): void {
    this.pendingSlots = this.pendingSlots.map((id, idx) => (idx === slotIndex ? id : id === heroId ? null : id));
    this.pendingSlots[slotIndex] = heroId;
  }

  private loadFromState(): void {
    const raw = [...(this.game.state.partyHeroIds ?? [])].slice(0, MAX_SLOTS);
    this.pendingSlots = Array.from({ length: MAX_SLOTS }, (_, i) => raw[i] ?? null);
    this.selectedSlotIndex = null;
    this.choosingHero = false;
  }

  private updateSlotUI(): void {
    const inParty = new Set(this.pendingSlots.filter((id): id is string => !!id));
    for (let i = 0; i < this.slotUIs.length; i += 1) {
      const slot = this.slotUIs[i];
      const heroId = this.pendingSlots[i];
      const hero = heroId ? HERO_MAP[heroId] : null;

      slot.nameText.text = hero ? hero.name : '空位';
      slot.hintText.text = hero ? `Lv.${this.game.state.getOwnedHero(heroId!)?.level ?? 1}` : '点击选择';

      const isSelected = this.selectedSlotIndex === i;
      slot.bg.clear();
      slot.bg.lineStyle(3, isSelected ? 0xffd07a : 0x365a9a, isSelected ? 1 : 0.9);
      slot.bg.beginFill(0x0e1733, 0.95);
      roundedRect(slot.bg, 0, 0, slot.w || 1, slot.h || 1, 16);
      slot.bg.endFill();

      if (!hero) {
        slot.hintText.text = isSelected && this.choosingHero ? '选择英雄' : '点击选择';
      }
    }

    this.slotActionBar.visible = this.selectedSlotIndex !== null && !!this.pendingSlots[this.selectedSlotIndex];
    this.btnReplace.setDisabled(!(this.selectedSlotIndex !== null && this.pendingSlots[this.selectedSlotIndex]));

    for (const id of this.heroOrder) {
      const card = this.heroCards.get(id);
      if (card) card.setInParty(inParty.has(id));
    }
  }

  private updateActionHint(): void {
    if (this.selectedSlotIndex === null) {
      this.actionHint.text = '';
      return;
    }

    if (this.choosingHero) {
      this.actionHint.text = `已选择槽位 ${this.selectedSlotIndex + 1}，请点击英雄放入`;
      return;
    }

    if (this.pendingSlots[this.selectedSlotIndex]) {
      this.actionHint.text = `已选择槽位 ${this.selectedSlotIndex + 1}：可移除/更换，或点另一个槽位交换`;
      return;
    }

    this.actionHint.text = `已选择槽位 ${this.selectedSlotIndex + 1}，点击英雄放入`;
  }

  private rebuildHeroList(): void {
    this.heroCards.clear();
    this.heroOrder = [];
    this.heroListContainer.removeChildren();
    this.heroListContainer.addChild(this.emptyHeroText);

    const ownedMap = new Map(this.game.state.heroes.map((h) => [h.heroId, h]));
    const ownedHeroes = HEROES.filter((h) => ownedMap.has(h.id));

    if (ownedHeroes.length === 0) {
      this.emptyHeroText.visible = true;
      this.emptyHeroText.position.set(this.scrollViewW / 2, 80);
      this.scroll.setContentHeight(Math.max(this.scrollViewH, 160));
      return;
    }

    this.emptyHeroText.visible = false;

    for (const hero of ownedHeroes) {
      const owned = ownedMap.get(hero.id);
      if (!owned) continue;
      const card = new HeroCard(hero, owned);
      card.on('pointertap', () => this.onHeroTap(hero.id));
      this.heroCards.set(hero.id, card);
      this.heroOrder.push(hero.id);
      this.heroListContainer.addChild(card);
    }

    this.layoutHeroCards();
    this.updateSlotUI();
  }

  private layoutHeroCards(): void {
    const count = this.heroOrder.length;
    if (count === 0) return;

    const cardW = 214;
    const cardH = 268;
    const gapX = 14;
    const gapY = 16;
    const maxCols = 3;
    const cols = Math.max(1, Math.min(maxCols, Math.floor((this.scrollViewW + gapX) / (cardW + gapX))));
    const totalW = cols * cardW + (cols - 1) * gapX;
    const startX = Math.max(0, Math.floor((this.scrollViewW - totalW) / 2));

    for (let i = 0; i < count; i += 1) {
      const id = this.heroOrder[i];
      const card = this.heroCards.get(id);
      if (!card) continue;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = 10 + row * (cardH + gapY);
      card.position.set(x, y);
    }

    const rows = Math.ceil(count / cols);
    const contentH = 10 + rows * (cardH + gapY);
    this.scroll.setContentHeight(Math.max(this.scrollViewH, contentH));
  }

  private saveFormation(): void {
    const next = this.pendingSlots.filter((id): id is string => !!id);
    this.game.state.setPartyHeroIds(next);
    this.game.toast.show('阵容已保存', 1.5);
    this.game.goTo('heroes', { animate: false });
  }
}
