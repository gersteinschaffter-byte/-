import { Graphics } from 'pixi.js';
import type GameApp from '../core/GameApp';
import BaseScene from './BaseScene';
import { ECONOMY, POOLS, RARITY } from '../game/config';
import { HERO_BY_RARITY } from '../game/data';
import { pickRarityByProb, randomPick } from '../game/random';
import { drawPanel } from '../ui/uiFactory';
import SummonHeader from './summon/SummonHeader';
import SummonBanner from './summon/SummonBanner';
import SummonActionBar from './summon/SummonActionBar';
import SummonInfoPanel from './summon/SummonInfoPanel';
import SummonResultPopup, { type SummonResultItem } from './summon/SummonResultPopup';
import { SUMMON_ACTION_H, SUMMON_BANNER_H, SUMMON_HEADER_H, SUMMON_INFO_COLLAPSED_H, SUMMON_PANEL_H, SUMMON_PANEL_W } from './summon/SummonLayout';

export default class SummonScene extends BaseScene {
  private readonly game: GameApp;
  private readonly panel: Graphics;
  private readonly header: SummonHeader;
  private readonly banner: SummonBanner;
  private readonly actions: SummonActionBar;
  private readonly info: SummonInfoPanel;
  private readonly popup: SummonResultPopup;
  private busy = false;
  private unsubs: Array<() => void> = [];

  constructor(game: GameApp) {
    super('summon');
    this.game = game;

    // New layout: header -> banner -> action -> collapsible info
    this.panel = drawPanel(SUMMON_PANEL_W, SUMMON_PANEL_H, 0.96);
    this.root.addChild(this.panel);

    this.header = new SummonHeader(SUMMON_PANEL_W);
    this.panel.addChild(this.header);

    this.banner = new SummonBanner(SUMMON_PANEL_W, SUMMON_BANNER_H, this.game.pixi.ticker);
    this.panel.addChild(this.banner);

    this.actions = new SummonActionBar(SUMMON_PANEL_W);
    this.panel.addChild(this.actions);

    this.info = new SummonInfoPanel(SUMMON_PANEL_W, SUMMON_INFO_COLLAPSED_H, 300, this.game.pixi.view);
    this.panel.addChild(this.info);

    this.popup = new SummonResultPopup(this.game);

    this.header.btnProb.on('pointertap', () => this.info.setExpanded(!this.info.isExpanded()));
    this.actions.btnOne.on('pointertap', () => void this.trySummon(1));
    this.actions.btnTen.on('pointertap', () => void this.trySummon(10));

  }

  public override onEnter(): void {
    // Data-driven: update cost/labels when inventory/diamonds change.
    this.unsubs.forEach((u) => {
      try { u(); } catch (_) {}
    });
    this.unsubs = [];
    this.unsubs.push(this.game.state.on('inventoryChanged', () => this.refresh()));
    this.unsubs.push(this.game.state.on('currencyChanged', () => this.refresh()));
    this.refresh();
  }

  public override onExit(): void {
    this.unsubs.forEach((u) => {
      try { u(); } catch (_) {}
    });
    this.unsubs = [];
  }

  public override onResize(w: number, _h: number): void {
    // Center the summon panel in virtual coordinates.
    if (!this.panel || (this.panel as any).destroyed) return;
    this.panel.position.set((w - SUMMON_PANEL_W) / 2, 190);

    this.header.position.set(0, 0);
    this.banner.position.set(0, SUMMON_HEADER_H);
    this.actions.position.set(0, SUMMON_HEADER_H + SUMMON_BANNER_H);
    this.info.position.set(0, SUMMON_HEADER_H + SUMMON_BANNER_H + SUMMON_ACTION_H);
  }

  public refresh(): void {
    const pool = POOLS.normal; // JSON-driven summon pool definition (text/cost keys)
    const s = this.game.state.getSnapshot();
    const ticket = s.inventory[pool.ticketKey] || 0;
    const cost = pool.diamondCost;
    this.header.setPoolTitle(pool.title);
    // Use templates from config so changing pool texts doesn't require touching scene code.
    const left = pool.descLeft.replace('{ticketCount}', String(ticket));
    const right = pool.descRight.replace('{diamondCost}', String(cost));
    this.header.setCostDesc(`${left}   ·   ${right}`);
    // Button labels reflect the true cost rule: tickets first, diamonds fill the gap.
    const oneLabel = ticket > 0 ? `${ECONOMY.summonTicketName}-1` : `💎${cost}`;
    const useTenTickets = Math.max(0, Math.min(10, ticket));
    const tenRemain = 10 - useTenTickets;
    const tenLabel = tenRemain <= 0
      ? `${ECONOMY.summonTicketName}x10`
      : useTenTickets > 0
        ? `${ECONOMY.summonTicketName}x${useTenTickets}+💎${cost * tenRemain}`
        : `💎${cost * 10}`;
    this.actions.setButtonLabels(`单抽 (${oneLabel})`, `十连 (${tenLabel})`);

    // True disabled state (prevents useless taps).
    const diamonds = s.diamonds || 0;
    const canOne = !this.busy && (ticket >= 1 || diamonds >= cost);
    // Mixed resource support: ticket + diamonds/cost must cover 10 pulls.
    const canTen = !this.busy && (ticket + Math.floor(diamonds / cost) >= 10);
    this.actions.btnOne.setDisabled(!canOne);
    this.actions.btnTen.setDisabled(!canTen);
  }

  private async trySummon(count: 1 | 10): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.refresh();

    try {
      // Spend cost first (tickets priority, then diamonds)
      if (!this.spendSummonCost(count)) {
        this.busy = false;
        return;
      }

      // Pre-result FX
      await this.banner.playSummonFx();

      // Produce results (batch state mutations to avoid many emits / UI refreshes)
      const results: SummonResultItem[] = this.game.state.withBatch(() => {
        const arr: SummonResultItem[] = [];
        for (let i = 0; i < count; i++) arr.push(this.rollOne());
        return arr;
      });

      // Log results (hero ids + new/dupe) for bug reports.
      try {
        this.game.debug.info(
          'SUMMON',
          'result',
          results.map((r) => ({ id: r.hero.id, rarity: r.hero.rarity, isNew: r.isNew })),
        );
      } catch (_) {}

      // Show popup (always in PopupLayer)
      if (count === 1) this.popup.showSingle(results[0]);
      else this.popup.showMulti(results);
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  private spendSummonCost(count: number): boolean {
    return this.game.state.withBatch(() => {
      const pool = POOLS.normal;
      const cost = pool.diamondCost;

      // Tickets priority: use as many tickets as possible, then pay diamonds for the rest.
      const haveTickets = this.game.state.getInventory(pool.ticketKey);
      const useTickets = Math.max(0, Math.min(count, haveTickets));
      if (useTickets > 0) {
        // This should always succeed because we cap by haveTickets.
        this.game.state.tryConsumeInventory(pool.ticketKey, useTickets);
      }

      const remain = count - useTickets;
      if (remain <= 0) {
        try {
          this.game.debug.info('SUMMON', 'spend', { count, tickets: useTickets, diamonds: 0 });
        } catch (_) {}
        return true;
      }

      const dia = cost * remain;
      if (!this.game.state.trySpendDiamonds(dia)) {
        // Refund consumed tickets if diamonds are not enough.
        if (useTickets > 0) this.game.state.addInventory(pool.ticketKey, useTickets);
        this.game.toast.show('钻石不足！', 2);
        return false;
      }
      // Log spend summary (helps debug payment issues).
      try {
        this.game.debug.info('SUMMON', 'spend', { count, tickets: useTickets, diamonds: dia });
      } catch (_) {}
      return true;
    });
  }

  private rollOne(): SummonResultItem {
    const rarity = pickRarityByProb();
    const hero = randomPick(HERO_BY_RARITY[rarity]);
    const owned = this.game.state.getOwnedHero(hero.id);

    let rewardNote = '';
    let isNew = false;
    if (owned) {
      const shardAdd = rarity === RARITY.SP ? 20 : rarity === RARITY.SSR ? 12 : rarity === RARITY.SR ? 6 : 3;
      this.game.state.addInventory(ECONOMY.dupeShardKey, shardAdd);
      rewardNote = `重复英雄已转化为万能碎片 +${shardAdd}`;
    } else {
      this.game.state.addHero(hero.id);
      rewardNote = '新英雄加入队伍！';
      isNew = true;
    }

    return { hero, rewardNote, isNew };
  }
}
