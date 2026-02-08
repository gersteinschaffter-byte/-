import { defaultState, loadStateFromStorage, resetStorage, saveStateToStorage } from '../game/storage';
import type { OwnedHero, PersistedState } from '../game/storage';

/**
 * All supported GameState events.
 */
export type GameStateEvent = 'currencyChanged' | 'heroesChanged' | 'inventoryChanged' | 'stageChanged' | 'partyChanged' | 'anyChanged';

export type CurrencyPayload = { gold: number; diamonds: number };
export type HeroesPayload = { heroes: OwnedHero[] };
export type InventoryPayload = { inventory: Record<string, number> };
export type StagePayload = { stage: number };
export type PartyPayload = { partyHeroIds: string[] };

export type GameStateEventPayloadMap = {
  currencyChanged: CurrencyPayload;
  heroesChanged: HeroesPayload;
  inventoryChanged: InventoryPayload;
  stageChanged: StagePayload;
  partyChanged: PartyPayload;
  anyChanged: Readonly<PersistedState>;
};

type Handler<T> = (payload: T) => void;

/**
 * A minimal typed event emitter (observer pattern).
 * We keep this local to avoid extra dependencies.
 */
class Emitter {
  private listeners = new Map<GameStateEvent, Set<Handler<any>>>();

  public on<E extends GameStateEvent>(event: E, handler: Handler<GameStateEventPayloadMap[E]>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler as Handler<any>);
    this.listeners.set(event, set);
    return () => this.off(event, handler);
  }

  public off<E extends GameStateEvent>(event: E, handler: Handler<GameStateEventPayloadMap[E]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(handler as Handler<any>);
  }

  public emit<E extends GameStateEvent>(event: E, payload: GameStateEventPayloadMap[E]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    // Copy to avoid issues if handlers unsubscribe during emit.
    [...set].forEach((fn) => {
      try {
        (fn as Handler<GameStateEventPayloadMap[E]>)(payload);
      } catch (e) {
        console.warn(`[GameState] handler error for ${event}`, e);
      }
    });
  }
}

/**
 * GameState is the single source of truth for runtime data.
 *
 * ✅ Phase 2 upgrade: observer/event based.
 * - All mutations go through methods on this class.
 * - After mutation: persist to localStorage + emit events.
 * - UI/Scenes subscribe to events and refresh themselves.
 */
export default class GameState {
  private state: PersistedState;
  private emitter = new Emitter();

  constructor() {
    this.state = loadStateFromStorage();
  }

  // ---------------------------
  // Subscribe
  // ---------------------------

  public on<E extends GameStateEvent>(event: E, handler: Handler<GameStateEventPayloadMap[E]>): () => void {
    return this.emitter.on(event, handler);
  }

  public off<E extends GameStateEvent>(event: E, handler: Handler<GameStateEventPayloadMap[E]>): void {
    this.emitter.off(event, handler);
  }

  // ---------------------------
  // Read
  // ---------------------------

  /**
   * Readonly snapshot (defensive copy) so outside code cannot mutate state silently.
   */
  public getSnapshot(): Readonly<PersistedState> {
    // structuredClone is widely available on modern browsers.
    // Fallback to JSON for older environments.
    const anyGlobal = globalThis as any;
    if (typeof anyGlobal.structuredClone === 'function') {
      return anyGlobal.structuredClone(this.state) as PersistedState;
    }
    return JSON.parse(JSON.stringify(this.state)) as PersistedState;
  }

  public get gold(): number {
    return this.state.gold;
  }

  public get diamonds(): number {
    return this.state.diamonds;
  }

  public get inventory(): Readonly<Record<string, number>> {
    return this.state.inventory;
  }

  public get stage(): number {
    return Math.max(1, Math.floor(this.state.stage || 1));
  }

  public get heroes(): ReadonlyArray<OwnedHero> {
    return this.state.heroes;
  }

  public get partyHeroIds(): ReadonlyArray<string> {
    return this.state.partyHeroIds ?? [];
  }

  // ---------------------------
  // Progress
  // ---------------------------

  /**
   * Set current stage (1-based). Will be persisted and emit stageChanged.
   */
  public setStage(stage: number): void {
    const next = Math.max(1, Math.floor(Number(stage) || 1));
    if (this.state.stage === next) return;
    this.state.stage = next;
    this.persistAndEmit({ stage: true });
  }

  /**
   * Advance stage by delta (default +1).
   */
  public advanceStage(delta = 1): void {
    const d = Math.floor(Number(delta) || 0);
    if (!Number.isFinite(d) || d === 0) return;
    this.setStage(this.state.stage + d);
  }

  public getInventory(key: string): number {
    return this.state.inventory[key] || 0;
  }

  public hasHero(heroId: string): boolean {
    return this.state.heroes.some((h) => h.heroId === heroId);
  }

  public getOwnedHero(heroId: string): OwnedHero | undefined {
    return this.state.heroes.find((h) => h.heroId === heroId);
  }

  // ---------------------------
  // Party (max 5)
  // ---------------------------

  public isInParty(heroId: string): boolean {
    return (this.state.partyHeroIds ?? []).includes(heroId);
  }

  public setPartyHeroIds(ids: string[]): void {
    const next = Array.from(new Set((ids ?? []).filter((x) => typeof x === "string" && String(x).trim()).map((x) => String(x)))).slice(0, 5);
    this.state.partyHeroIds = next;
    this.persistAndEmit({ party: true });
  }

  public addToParty(heroId: string): { ok: boolean; reason?: string } {
    if (!heroId) return { ok: false, reason: "参数错误" };
    if (!this.hasHero(heroId)) return { ok: false, reason: "未拥有该英雄" };
    const cur = [...(this.state.partyHeroIds ?? [])];
    if (cur.includes(heroId)) return { ok: false, reason: "已在队伍中" };
    if (cur.length >= 5) return { ok: false, reason: "队伍已满（5/5）" };
    cur.push(heroId);
    this.state.partyHeroIds = cur;
    this.persistAndEmit({ party: true });
    return { ok: true };
  }

  public removeFromParty(heroId: string): void {
    const cur = [...(this.state.partyHeroIds ?? [])];
    const next = cur.filter((id) => id !== heroId);
    if (next.length === cur.length) return;
    this.state.partyHeroIds = next;
    this.persistAndEmit({ party: true });
  }

  public toggleParty(heroId: string): { ok: boolean; reason?: string } {
    if (this.isInParty(heroId)) {
      this.removeFromParty(heroId);
      return { ok: true };
    }
    return this.addToParty(heroId);
  }


  // ---------------------------
  // Mutate (all writes go through these methods)
  // ---------------------------

  /**
   * Generic partial update.
   * Use this for state fields that don't yet have dedicated helpers.
   */
  public update(partial: Partial<PersistedState>): void {
    const before = this.state;
    const next: PersistedState = {
      ...before,
      ...partial,
      inventory: partial.inventory ? { ...partial.inventory } : before.inventory,
       heroes: partial.heroes ? [...partial.heroes] : before.heroes,
      partyHeroIds: partial.partyHeroIds ? [...partial.partyHeroIds] : before.partyHeroIds,
    };
    this.state = next;
    this.persistAndEmit({ currency: true, inventory: true, heroes: true, stage: true, party: true });
  }

  public addGold(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    this.state.gold = Math.max(0, Math.floor(this.state.gold + delta));
    this.persistAndEmit({ currency: true });
  }

  public addDiamonds(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    this.state.diamonds = Math.max(0, Math.floor(this.state.diamonds + delta));
    this.persistAndEmit({ currency: true });
  }

  /**
   * Spend diamonds. Returns false if not enough.
   */
  public spendDiamonds(cost: number): boolean {
    cost = Math.max(0, Math.floor(cost));
    if (this.state.diamonds < cost) return false;
    this.state.diamonds -= cost;
    this.persistAndEmit({ currency: true });
    return true;
  }


  /**
   * Try spend gold. Returns false if not enough.
   */
  public trySpendGold(cost: number): boolean {
    cost = Math.max(0, Math.floor(cost));
    if (cost === 0) return true;
    if (this.state.gold < cost) return false;
    this.state.gold -= cost;
    this.persistAndEmit({ currency: true });
    return true;
  }

  /**
   * Try spend diamonds. Returns false if not enough.
   * (Wrapper for spendDiamonds to keep a consistent try* API.)
   */
  public trySpendDiamonds(cost: number): boolean {
    return this.spendDiamonds(cost);
  }

  /**
   * Try consume inventory item. Returns false if not enough.
   * This prevents negative inventory from accidental addInventory(key, -x).
   */
  public tryConsumeInventory(key: string, amount: number): boolean {
    if (!key) return false;
    amount = Math.max(0, Math.floor(amount));
    if (amount === 0) return true;
    const cur = this.state.inventory[key] || 0;
    if (cur < amount) return false;
    const next = Math.max(0, Math.floor(cur - amount));
    this.state.inventory[key] = next;
    this.persistAndEmit({ inventory: true });
    return true;
  }

  public addInventory(key: string, delta: number): void {
    if (!key) return;
    if (!Number.isFinite(delta) || delta === 0) return;
    const cur = this.state.inventory[key] || 0;
    const next = Math.max(0, Math.floor(cur + delta));
    this.state.inventory[key] = next;
    this.persistAndEmit({ inventory: true });
  }

  public setInventory(key: string, value: number): void {
    if (!key) return;
    this.state.inventory[key] = Math.max(0, Math.floor(value));
    this.persistAndEmit({ inventory: true });
  }

  /**
   * Add a new hero to collection.
   * If the hero already exists, this method does nothing.
   */
  public addHero(heroId: string): boolean {
    if (!heroId) return false;
    if (this.hasHero(heroId)) return false;
    this.state.heroes.push({ heroId, level: 1, stars: 0, obtainedAt: Date.now() });
    this.persistAndEmit({ heroes: true });
    return true;
  }

  /**
   * Try level up hero, spending gold.
   */
  public tryLevelUpHero(heroId: string, goldCost: number, levelCap: number): { ok: boolean; reason?: string } {
    const owned = this.getOwnedHero(heroId);
    if (!owned) return { ok: false, reason: '未拥有该英雄，无法升级。' };
    if (owned.level >= levelCap) return { ok: false, reason: '已达等级上限。' };
    goldCost = Math.max(0, Math.floor(goldCost));
    if (this.state.gold < goldCost) return { ok: false, reason: '金币不足！' };

    this.state.gold -= goldCost;
    owned.level += 1;
    this.persistAndEmit({ currency: true, heroes: true });
    return { ok: true };
  }

  public hardReset(): void {
    resetStorage();
    this.state = defaultState();
    this.persistAndEmit({ currency: true, inventory: true, heroes: true, stage: true, party: true });
  }

  // ---------------------------
  // Internals
  // ---------------------------

  private persistAndEmit(flags: { currency?: boolean; inventory?: boolean; heroes?: boolean; stage?: boolean; party?: boolean }): void {
    // Persist first, so if any UI reads localStorage for debug it stays consistent.
    saveStateToStorage(this.state);

    if (flags.currency) {
      this.emitter.emit('currencyChanged', { gold: this.state.gold, diamonds: this.state.diamonds });
    }
    if (flags.inventory) {
      this.emitter.emit('inventoryChanged', { inventory: { ...this.state.inventory } });
    }
    if (flags.heroes) {
      this.emitter.emit('heroesChanged', { heroes: [...this.state.heroes] });
    }

    if (flags.party) {
      this.emitter.emit('partyChanged', { partyHeroIds: [...(this.state.partyHeroIds ?? [])] });
    }

    if (flags.stage) {
      this.emitter.emit('stageChanged', { stage: this.stage });
    }

    this.emitter.emit('anyChanged', this.getSnapshot());
  }
}
