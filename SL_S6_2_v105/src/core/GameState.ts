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
export type PartyPayload = { partyHeroIds: string[]; partySlots: Array<string | null> };

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

  // ---------------------------
  // Batch / Transaction
  // ---------------------------
  private batchDepth = 0;
  private pendingFlags: { currency?: boolean; inventory?: boolean; heroes?: boolean; stage?: boolean; party?: boolean } = {};
  private pendingPersist = false;

  constructor() {
    this.state = loadStateFromStorage();
  }

  /**
   * Run a group of mutations as a single transaction:
   * - persist once
   * - emit events once (merged flags)
   */
  public withBatch<T>(fn: () => T): T {
    this.batchDepth += 1;
    try {
      return fn();
    } finally {
      this.batchDepth = Math.max(0, this.batchDepth - 1);
      if (this.batchDepth === 0) this.flushBatch();
    }
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

  public get partySlots(): ReadonlyArray<string | null> {
    return this.state.partySlots ?? [null, null, null, null, null];
  }

  // ---------------------------
  // AI Director (settings + cache)
  // ---------------------------

  public get directorEnabled(): boolean {
    return Boolean((this.state as any).directorEnabled ?? true);
  }

  public get directorModel(): 'deepseek-chat' | 'deepseek-reasoner' {
    const m = (this.state as any).directorModel;
    return m === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
  }

  public get directorStage(): number {
    return Math.max(0, Math.floor(Number((this.state as any).directorStage ?? 0) || 0));
  }

  public get directorDirective(): any | null {
    return (this.state as any).directorDirective ?? null;
  }

  public setDirectorEnabled(enabled: boolean): void {
    (this.state as any).directorEnabled = Boolean(enabled);
    this.persistAndEmit({});
  }

  public setDirectorModel(model: 'deepseek-chat' | 'deepseek-reasoner'): void {
    (this.state as any).directorModel = model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
    this.persistAndEmit({});
  }

  public setDirectorDirective(stage: number, directive: any | null): void {
    (this.state as any).directorStage = Math.max(0, Math.floor(Number(stage) || 0));
    (this.state as any).directorDirective = directive ?? null;
    this.persistAndEmit({});
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

  public getPartyHeroes(): string[] {
    return (this.state.partySlots ?? []).filter((id): id is string => !!id);
  }

  public isInParty(heroId: string): boolean {
    return this.getPartyHeroes().includes(heroId);
  }

  public setPartyHeroIds(ids: string[]): void {
    const slots = this.normalizeSlots(ids ?? []);
    this.setPartySlots(slots);
  }

  public setPartySlots(slots: Array<string | null>): void {
    const next = this.normalizeSlots(slots);
    this.state.partySlots = next;
    this.state.partyHeroIds = next.filter((id): id is string => !!id);
    this.persistAndEmit({ party: true });
  }

  public setSlot(index: number, heroId: string | null): void {
    if (!Number.isFinite(index)) return;
    const idx = Math.max(0, Math.min(4, Math.floor(index)));
    if (heroId) {
      this.removeHeroFromSlots(heroId);
    }
    const next = [...(this.state.partySlots ?? [null, null, null, null, null])];
    next[idx] = heroId ?? null;
    this.setPartySlots(next);
  }

  public swapSlots(a: number, b: number): void {
    const idxA = Math.max(0, Math.min(4, Math.floor(a)));
    const idxB = Math.max(0, Math.min(4, Math.floor(b)));
    if (idxA === idxB) return;
    const next = [...(this.state.partySlots ?? [null, null, null, null, null])];
    const tmp: string | null = (next[idxA] ?? null) as string | null;
    next[idxA] = (next[idxB] ?? null) as string | null;
    next[idxB] = tmp;
    this.setPartySlots(next);
  }

  public removeHeroFromSlots(heroId: string): void {
    if (!heroId) return;
    const next = (this.state.partySlots ?? [null, null, null, null, null]).map((id) => (id === heroId ? null : id));
    if (next.every((id, idx) => id === (this.state.partySlots ?? [null, null, null, null, null])[idx])) {
      return;
    }
    this.setPartySlots(next);
  }

  public addToParty(heroId: string): { ok: boolean; reason?: string } {
    if (!heroId) return { ok: false, reason: "参数错误" };
    if (!this.hasHero(heroId)) return { ok: false, reason: "未拥有该英雄" };
    if (this.isInParty(heroId)) return { ok: false, reason: "已在队伍中" };
    const slots = [...(this.state.partySlots ?? [null, null, null, null, null])];
    const emptyIndex = slots.findIndex((slotId) => !slotId);
    if (emptyIndex === -1) return { ok: false, reason: "队伍已满（5/5）" };
    slots[emptyIndex] = heroId;
    this.setPartySlots(slots);
    return { ok: true };
  }

  public removeFromParty(heroId: string): void {
    this.removeHeroFromSlots(heroId);
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
    const partySlots = partial.partySlots
      ? this.normalizeSlots(partial.partySlots)
      : partial.partyHeroIds
        ? this.normalizeSlots(partial.partyHeroIds)
        : before.partySlots;
    const next: PersistedState = {
      ...before,
      ...partial,
      inventory: partial.inventory ? { ...partial.inventory } : before.inventory,
       heroes: partial.heroes ? [...partial.heroes] : before.heroes,
      partyHeroIds: partySlots.filter((id): id is string => !!id),
      partySlots,
    };
    this.state = next;
    this.persistAndEmit({ currency: true, inventory: true, heroes: true, stage: true, party: true });
  }

  public addGold(delta: number): void {
    this.applyCurrencyDelta({ gold: delta });
  }

  public addDiamonds(delta: number): void {
    this.applyCurrencyDelta({ diamonds: delta });
  }

  /**
   * Apply currency deltas (positive or negative). Negative deltas are clamped at 0.
   * ✅ Preferred unified API for currency updates.
   */
  public applyCurrencyDelta(delta: Partial<CurrencyPayload>): void {
    const g = Number(delta.gold ?? 0);
    const d = Number(delta.diamonds ?? 0);
    if ((!Number.isFinite(g) || g === 0) && (!Number.isFinite(d) || d === 0)) return;
    if (Number.isFinite(g) && g !== 0) this.state.gold = Math.max(0, Math.floor(this.state.gold + Math.floor(g)));
    if (Number.isFinite(d) && d !== 0) this.state.diamonds = Math.max(0, Math.floor(this.state.diamonds + Math.floor(d)));
    this.persistAndEmit({ currency: true });
  }

  /**
   * Try spend currency as a single atomic operation.
   * If not enough currency, no changes are applied.
   */
  public trySpendCurrency(cost: Partial<CurrencyPayload>): { ok: boolean; reason?: string } {
    const g = Math.max(0, Math.floor(Number(cost.gold ?? 0)));
    const d = Math.max(0, Math.floor(Number(cost.diamonds ?? 0)));
    if (g === 0 && d === 0) return { ok: true };
    if (this.state.gold < g) return { ok: false, reason: '金币不足！' };
    if (this.state.diamonds < d) return { ok: false, reason: '钻石不足！' };
    this.state.gold -= g;
    this.state.diamonds -= d;
    this.persistAndEmit({ currency: true });
    return { ok: true };
  }

  /**
   * Spend diamonds. Returns false if not enough.
   */
  public spendDiamonds(cost: number): boolean {
    cost = Math.max(0, Math.floor(cost));
    return this.trySpendCurrency({ diamonds: cost }).ok;
  }


  /**
   * Try spend gold. Returns false if not enough.
   */
  public trySpendGold(cost: number): boolean {
    cost = Math.max(0, Math.floor(cost));
    if (cost === 0) return true;
    return this.trySpendCurrency({ gold: cost }).ok;
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

  /**
   * Apply multiple inventory deltas at once.
   * - Positive adds
   * - Negative spends
   * - Values are clamped at 0
   */
  public applyInventoryDeltas(deltas: Record<string, number>): void {
    if (!deltas) return;
    let changed = false;
    for (const [key, raw] of Object.entries(deltas)) {
      if (!key) continue;
      const d = Math.floor(Number(raw) || 0);
      if (d === 0) continue;
      const cur = this.state.inventory[key] || 0;
      const next = Math.max(0, Math.floor(cur + d));
      if (next === cur) continue;
      this.state.inventory[key] = next;
      changed = true;
    }
    if (changed) this.persistAndEmit({ inventory: true });
  }

  /**
   * Try spend multiple inventory keys as one atomic operation.
   * If any key is not enough, no changes are applied.
   */
  public trySpendInventory(costs: Record<string, number>): { ok: boolean; reason?: string } {
    if (!costs) return { ok: true };
    // validate
    for (const [key, raw] of Object.entries(costs)) {
      const amt = Math.max(0, Math.floor(Number(raw) || 0));
      if (!key || amt === 0) continue;
      const cur = this.state.inventory[key] || 0;
      if (cur < amt) return { ok: false, reason: `${key} 不足` };
    }
    // apply
    let changed = false;
    for (const [key, raw] of Object.entries(costs)) {
      const amt = Math.max(0, Math.floor(Number(raw) || 0));
      if (!key || amt === 0) continue;
      const cur = this.state.inventory[key] || 0;
      this.state.inventory[key] = Math.max(0, Math.floor(cur - amt));
      changed = true;
    }
    if (changed) this.persistAndEmit({ inventory: true });
    return { ok: true };
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
    // Stars are 1-based in UI/logic; keep persisted data consistent.
    this.state.heroes.push({ heroId, level: 1, stars: 1, obtainedAt: Date.now() });
    this.persistAndEmit({ heroes: true });
    return true;
  }

  /**
   * Add multiple heroes as a batch (recommended).
   * Returns how many were newly added.
   */
  public addHeroes(heroIds: string[]): { added: string[]; duplicates: string[] } {
    const added: string[] = [];
    const duplicates: string[] = [];
    if (!Array.isArray(heroIds) || heroIds.length === 0) return { added, duplicates };
    for (const id of heroIds) {
      if (!id) continue;
      if (this.hasHero(id)) {
        duplicates.push(id);
        continue;
      }
      this.state.heroes.push({ heroId: id, level: 1, stars: 1, obtainedAt: Date.now() });
      added.push(id);
    }
    if (added.length > 0) this.persistAndEmit({ heroes: true });
    return { added, duplicates };
  }

  /**
   * Try level up hero, spending gold.
   */
  public tryLevelUpHero(heroId: string, goldCost: number, levelCap: number): { ok: boolean; reason?: string } {
    const owned = this.getOwnedHero(heroId);
    if (!owned) return { ok: false, reason: '未拥有该英雄，无法升级。' };
    if (owned.level >= levelCap) return { ok: false, reason: '已达等级上限。' };
    goldCost = Math.max(0, Math.floor(goldCost));
    if (goldCost > 0 && this.state.gold < goldCost) return { ok: false, reason: '金币不足！' };

    // Batch to make this operation atomic (single persist + single emit).
    return this.withBatch(() => {
      const pay = this.trySpendCurrency({ gold: goldCost });
      if (!pay.ok) return pay;
      owned.level += 1;
      this.persistAndEmit({ heroes: true });
      return { ok: true };
    });
  }

  /**
   * Try star up hero, spending universal shards.
   * ✅ Atomic: either both spend + starUp happen, or neither.
   */
  public tryStarUpHero(heroId: string, shardKey: string, shardCost: number, maxStars = 5): { ok: boolean; reason?: string; stars?: number } {
    const owned = this.getOwnedHero(heroId);
    if (!owned) return { ok: false, reason: '未拥有该英雄，无法升星。' };
    const curStars = Math.max(1, Math.floor(owned.stars || 0));
    if (curStars >= maxStars) return { ok: false, reason: '已满星。', stars: curStars };
    shardCost = Math.max(0, Math.floor(shardCost));
    if (!shardKey) return { ok: false, reason: '碎片配置错误。' };
    if (shardCost > 0 && (this.state.inventory[shardKey] || 0) < shardCost) return { ok: false, reason: '碎片不足。', stars: curStars };

    return this.withBatch(() => {
      const pay = this.trySpendInventory({ [shardKey]: shardCost });
      if (!pay.ok) return { ok: false, reason: '碎片不足。', stars: curStars };
      owned.stars = curStars + 1;
      this.persistAndEmit({ heroes: true });
      return { ok: true, stars: owned.stars };
    });
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
    // If we are in a batch, defer persist + emit.
    if (this.batchDepth > 0) {
      this.pendingFlags.currency = this.pendingFlags.currency || !!flags.currency;
      this.pendingFlags.inventory = this.pendingFlags.inventory || !!flags.inventory;
      this.pendingFlags.heroes = this.pendingFlags.heroes || !!flags.heroes;
      this.pendingFlags.stage = this.pendingFlags.stage || !!flags.stage;
      this.pendingFlags.party = this.pendingFlags.party || !!flags.party;
      this.pendingPersist = true;
      return;
    }

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
      this.emitter.emit('partyChanged', {
        partyHeroIds: [...(this.state.partyHeroIds ?? [])],
        partySlots: [...(this.state.partySlots ?? [null, null, null, null, null])],
      });
    }

    if (flags.stage) {
      this.emitter.emit('stageChanged', { stage: this.stage });
    }

    this.emitter.emit('anyChanged', this.getSnapshot());
  }

  private flushBatch(): void {
    if (!this.pendingPersist) return;
    const flags = this.pendingFlags;
    this.pendingFlags = {};
    this.pendingPersist = false;
    // Persist once
    saveStateToStorage(this.state);

    if (flags.currency) this.emitter.emit('currencyChanged', { gold: this.state.gold, diamonds: this.state.diamonds });
    if (flags.inventory) this.emitter.emit('inventoryChanged', { inventory: { ...this.state.inventory } });
    if (flags.heroes) this.emitter.emit('heroesChanged', { heroes: [...this.state.heroes] });
    if (flags.party) {
      this.emitter.emit('partyChanged', {
        partyHeroIds: [...(this.state.partyHeroIds ?? [])],
        partySlots: [...(this.state.partySlots ?? [null, null, null, null, null])],
      });
    }
    if (flags.stage) this.emitter.emit('stageChanged', { stage: this.stage });

    this.emitter.emit('anyChanged', this.getSnapshot());
  }

  private normalizeSlots(input: Array<string | null | undefined>): Array<string | null> {
    const slots = Array.from({ length: 5 }, (_, i) => {
      const v = input?.[i];
      return typeof v === 'string' && String(v).trim() ? String(v) : null;
    });
    const seen = new Set<string>();
    return slots.map((id) => {
      if (!id) return null;
      if (seen.has(id)) return null;
      seen.add(id);
      return id;
    });
  }
}
