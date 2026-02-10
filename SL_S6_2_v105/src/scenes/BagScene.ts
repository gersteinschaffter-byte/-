import { Container, Graphics } from 'pixi.js';
import type GameApp from '../core/GameApp';
import BaseScene from './BaseScene';
import { ECONOMY } from '../game/config';
import { createText, formatNumber, roundedRect, drawPanel } from '../ui/uiFactory';
import UIButton from '../ui/components/UIButton';
import { PopupLayers } from '../ui/PopupLayers';

export default class BagScene extends BaseScene {
  private readonly game: GameApp;
  private readonly title;
  private readonly panel: Graphics;
  private readonly list: Container;
  private unsubs: Array<() => void> = [];

  constructor(game: GameApp) {
    super('bag');
    this.game = game;

    this.title = createText('背包', 44, 0xffffff, '900');
    this.title.anchor.set(0.5);
    this.root.addChild(this.title);

    this.panel = drawPanel(680, 920, 0.96);
    this.root.addChild(this.panel);

    this.list = new Container();
    this.panel.addChild(this.list);
  }

  public override onEnter(): void {
    // Data-driven: redraw when inventory changes.
    this.unsubs.forEach((u) => {
      try { u(); } catch (_) {}
    });
    this.unsubs = [];
    this.unsubs.push(this.game.state.on('inventoryChanged', () => this.drawList()));
    this.drawList();
  }

  public override onExit(): void {
    this.unsubs.forEach((u) => {
      try { u(); } catch (_) {}
    });
    this.unsubs = [];
  }

  public override onResize(w: number, _h: number): void {
    if (!this.title || (this.title as any).destroyed) return;
    this.title.position.set(w / 2, 170);
    this.panel.position.set((w - 680) / 2, 260);
    this.list.position.set(46, 70);
    this.drawList();
  }


  private isChestKey(key: string): boolean {
    return key === 'chest_c' || key === 'chest_b' || key === 'chest_a' || key === 'chest_s';
  }

  private randInt(min: number, max: number): number {
    const a = Math.min(min, max);
    const b = Math.max(min, max);
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  private openChestModal(chestKey: string, chestName: string): void {
    const modal = this.game.modal;
    const layer = modal.useLayer(PopupLayers.BAG_OPEN);
    const panelW = modal.panel.width;
    const panelH = modal.panel.height;

    const title = createText(chestName, 36, 0xffffff, '900');
    title.anchor.set(0.5);
    title.position.set(panelW / 2, 90);

    const hint = createText('开启后随机获得：钻石 + 万能碎片 + 金币', 20, 0xcfe3ff, '700');
    hint.anchor.set(0.5);
    hint.position.set(panelW / 2, 150);

    const qty = this.game.state.getInventory(chestKey);
    const qtyText = createText(`当前数量：x${formatNumber(qty)}`, 22, 0xffe3a3, '800');
    qtyText.anchor.set(0.5);
    qtyText.position.set(panelW / 2, 210);

    const btnClose = new UIButton('关闭', 240, 80);
    btnClose.position.set(80, panelH - 140);
    btnClose.on('pointertap', () => modal.close());

    const btnOpen = new UIButton('开启 x1', 240, 80);
    btnOpen.position.set(panelW - 320, panelH - 140);

    btnOpen.setDisabled(qty <= 0);
    btnOpen.on('pointertap', () => this.openChestOnce(chestKey, chestName));

    // Live refresh while modal is open.
    const prevOnClose = modal.onClose;
    const unSub = this.game.state.on('inventoryChanged', () => {
      const q = this.game.state.getInventory(chestKey);
      qtyText.text = `当前数量：x${formatNumber(q)}`;
      btnOpen.setDisabled(q <= 0);
    });
    modal.onClose = () => {
      try { unSub(); } catch (_) {}
      modal.onClose = prevOnClose;
      prevOnClose?.();
    };

    layer.addChild(title, hint, qtyText, btnClose, btnOpen);
    modal.open();
  }

  private openChestOnce(chestKey: string, chestName: string): void {
    let dMin = 0, dMax = 0, sMin = 0, sMax = 0, gMin = 0, gMax = 0;
    switch (chestKey) {
      case 'chest_c':
        dMin = 3; dMax = 6; sMin = 8; sMax = 15; gMin = 50; gMax = 120;
        break;
      case 'chest_b':
        dMin = 8; dMax = 15; sMin = 18; sMax = 35; gMin = 120; gMax = 260;
        break;
      case 'chest_a':
        dMin = 18; dMax = 35; sMin = 40; sMax = 80; gMin = 260; gMax = 600;
        break;
      case 'chest_s':
        dMin = 40; dMax = 80; sMin = 90; sMax = 160; gMin = 600; gMax = 1500;
        break;
      default:
        this.game.toast.show('未知宝箱。', 2);
        return;
    }

    // Spend + grant must be atomic to avoid losing a chest when something goes wrong.
    if (this.game.state.getInventory(chestKey) <= 0) {
      this.game.toast.show('宝箱不足。', 2);
      return;
    }

    const shardKey = ECONOMY.dupeShardKey;

    const diamonds = this.randInt(dMin, dMax);
    const shards = this.randInt(sMin, sMax);
    const gold = this.randInt(gMin, gMax);

    const ok = this.game.state.withBatch(() => {
      const pay = this.game.state.trySpendInventory({ [chestKey]: 1 });
      if (!pay.ok) return false;
      this.game.state.applyCurrencyDelta({ diamonds, gold });
      this.game.state.applyInventoryDeltas({ [shardKey]: shards });
      return true;
    });
    if (!ok) {
      this.game.toast.show('宝箱不足。', 2);
      return;
    }

    // Result popup
    const modal = this.game.modal;
    const layer = modal.useLayer(PopupLayers.BAG_REWARD);
    const panelW = modal.panel.width;
    const panelH = modal.panel.height;

    const title = createText(`开启：${chestName}`, 34, 0xffffff, '900');
    title.anchor.set(0.5);
    title.position.set(panelW / 2, 90);

    const line = createText(`获得：💎 +${formatNumber(diamonds)}  🧩 +${formatNumber(shards)}  🪙 +${formatNumber(gold)}`, 22, 0xd7e6ff, '800');
    line.anchor.set(0.5);
    line.position.set(panelW / 2, 170);
    line.style.align = 'center';
    line.style.wordWrap = true;
    line.style.wordWrapWidth = panelW - 90;

    const btnOk = new UIButton('确定', 240, 80);
    btnOk.position.set((panelW - 240) / 2, panelH - 140);
    btnOk.on('pointertap', () => modal.close());

    layer.addChild(title, line, btnOk);
    modal.open();

    this.game.toast.show('开启成功！', 2);
  }

  private drawList(): void {
    this.list.removeChildren();
    const s = this.game.state.getSnapshot();

    const header = createText('资源与道具', 28, 0xffffff, '900');
    header.position.set(0, 0);
    this.list.addChild(header);

    const items = [
      { key: ECONOMY.summonTicketKey, name: ECONOMY.summonTicketName, icon: '🎫' },
      { key: 'exp_small', name: '小经验药水', icon: '🧪' },
      { key: ECONOMY.dupeShardKey, name: '万能碎片', icon: '🧩' },

      // Boss chests
      { key: 'chest_c', name: (ECONOMY as any).chest_cName ?? '普通宝箱', icon: '📦' },
      { key: 'chest_b', name: (ECONOMY as any).chest_bName ?? '高级宝箱', icon: '🎁' },
      { key: 'chest_a', name: (ECONOMY as any).chest_aName ?? '史诗宝箱', icon: '🟣' },
      { key: 'chest_s', name: (ECONOMY as any).chest_sName ?? '传说宝箱', icon: '🟡' },
    ];

    let y = 60;
    for (const it of items) {
      const row = new Container();
      const bg = new Graphics();
      bg.beginFill(0x000000, 0.2);
      roundedRect(bg, 0, 0, 588, 84, 18);
      bg.endFill();
      row.addChild(bg);

      const t = createText(`${it.icon}  ${it.name}`, 24, 0xd7e6ff, '800');
      t.anchor.set(0, 0.5);
      t.position.set(18, 42);
      row.addChild(t);

      const v = createText('x' + formatNumber(s.inventory[it.key] || 0), 26, 0xffffff, '900');
      v.anchor.set(1, 0.5);
      v.position.set(570, 42);
      row.addChild(v);

      row.position.set(0, y);
      // Chest open entry (tap row to open modal)
      if (this.isChestKey(it.key)) {
        const q = s.inventory[it.key] || 0;
        row.interactive = q > 0;
        row.cursor = q > 0 ? 'pointer' : 'default';
        row.alpha = q > 0 ? 1 : 0.65;
        if (q > 0) row.on('pointertap', () => this.openChestModal(it.key, it.name));
      }
      this.list.addChild(row);
      y += 98;
    }

    const tip = createText('抽卡优先消耗召唤券；重复英雄会转化为万能碎片。Boss关胜利会掉落宝箱，可在背包中开启。', 18, 0xcfe3ff, '700');
    tip.position.set(0, y + 20);
    tip.style.wordWrap = true;
    tip.style.wordWrapWidth = 588;
    this.list.addChild(tip);
  }

  // Phase 2: this scene is fully data-driven via subscriptions.
}
