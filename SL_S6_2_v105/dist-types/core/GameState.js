import { defaultState, loadStateFromStorage, resetStorage, saveStateToStorage } from '../game/storage';
/**
 * A minimal typed event emitter (observer pattern).
 * We keep this local to avoid extra dependencies.
 */
class Emitter {
    constructor() {
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    on(event, handler) {
        const set = this.listeners.get(event) ?? new Set();
        set.add(handler);
        this.listeners.set(event, set);
        return () => this.off(event, handler);
    }
    off(event, handler) {
        const set = this.listeners.get(event);
        if (!set)
            return;
        set.delete(handler);
    }
    emit(event, payload) {
        const set = this.listeners.get(event);
        if (!set || set.size === 0)
            return;
        // Copy to avoid issues if handlers unsubscribe during emit.
        [...set].forEach((fn) => {
            try {
                fn(payload);
            }
            catch (e) {
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
    constructor() {
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "emitter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Emitter()
        });
        // ---------------------------
        // Batch / Transaction
        // ---------------------------
        Object.defineProperty(this, "batchDepth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "pendingFlags", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "pendingPersist", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.state = loadStateFromStorage();
    }
    /**
     * Run a group of mutations as a single transaction:
     * - persist once
     * - emit events once (merged flags)
     */
    withBatch(fn) {
        this.batchDepth += 1;
        try {
            return fn();
        }
        finally {
            this.batchDepth = Math.max(0, this.batchDepth - 1);
            if (this.batchDepth === 0)
                this.flushBatch();
        }
    }
    // ---------------------------
    // Subscribe
    // ---------------------------
    on(event, handler) {
        return this.emitter.on(event, handler);
    }
    off(event, handler) {
        this.emitter.off(event, handler);
    }
    // ---------------------------
    // Read
    // ---------------------------
    /**
     * Readonly snapshot (defensive copy) so outside code cannot mutate state silently.
     */
    getSnapshot() {
        // structuredClone is widely available on modern browsers.
        // Fallback to JSON for older environments.
        const anyGlobal = globalThis;
        if (typeof anyGlobal.structuredClone === 'function') {
            return anyGlobal.structuredClone(this.state);
        }
        return JSON.parse(JSON.stringify(this.state));
    }
    get gold() {
        return this.state.gold;
    }
    get diamonds() {
        return this.state.diamonds;
    }
    get inventory() {
        return this.state.inventory;
    }
    get stage() {
        return Math.max(1, Math.floor(this.state.stage || 1));
    }
    get heroes() {
        return this.state.heroes;
    }
    get partyHeroIds() {
        return this.state.partyHeroIds ?? [];
    }
    get partySlots() {
        return this.state.partySlots ?? [null, null, null, null, null];
    }
    // ---------------------------
    // AI Director (settings + cache)
    // ---------------------------
    get directorEnabled() {
        return Boolean(this.state.directorEnabled ?? true);
    }
    get directorModel() {
        const m = this.state.directorModel;
        return m === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
    }
    get directorStage() {
        return Math.max(0, Math.floor(Number(this.state.directorStage ?? 0) || 0));
    }
    get directorDirective() {
        return this.state.directorDirective ?? null;
    }
    setDirectorEnabled(enabled) {
        this.state.directorEnabled = Boolean(enabled);
        this.persistAndEmit({});
    }
    setDirectorModel(model) {
        this.state.directorModel = model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
        this.persistAndEmit({});
    }
    setDirectorDirective(stage, directive) {
        this.state.directorStage = Math.max(0, Math.floor(Number(stage) || 0));
        this.state.directorDirective = directive ?? null;
        this.persistAndEmit({});
    }
    // ---------------------------
    // Progress
    // ---------------------------
    /**
     * Set current stage (1-based). Will be persisted and emit stageChanged.
     */
    setStage(stage) {
        const next = Math.max(1, Math.floor(Number(stage) || 1));
        if (this.state.stage === next)
            return;
        this.state.stage = next;
        this.persistAndEmit({ stage: true });
    }
    /**
     * Advance stage by delta (default +1).
     */
    advanceStage(delta = 1) {
        const d = Math.floor(Number(delta) || 0);
        if (!Number.isFinite(d) || d === 0)
            return;
        this.setStage(this.state.stage + d);
    }
    getInventory(key) {
        return this.state.inventory[key] || 0;
    }
    hasHero(heroId) {
        return this.state.heroes.some((h) => h.heroId === heroId);
    }
    getOwnedHero(heroId) {
        return this.state.heroes.find((h) => h.heroId === heroId);
    }
    // ---------------------------
    // Party (max 5)
    // ---------------------------
    getPartyHeroes() {
        return (this.state.partySlots ?? []).filter((id) => !!id);
    }
    isInParty(heroId) {
        return this.getPartyHeroes().includes(heroId);
    }
    setPartyHeroIds(ids) {
        const slots = this.normalizeSlots(ids ?? []);
        this.setPartySlots(slots);
    }
    setPartySlots(slots) {
        const next = this.normalizeSlots(slots);
        this.state.partySlots = next;
        this.state.partyHeroIds = next.filter((id) => !!id);
        this.persistAndEmit({ party: true });
    }
    setSlot(index, heroId) {
        if (!Number.isFinite(index))
            return;
        const idx = Math.max(0, Math.min(4, Math.floor(index)));
        if (heroId) {
            this.removeHeroFromSlots(heroId);
        }
        const next = [...(this.state.partySlots ?? [null, null, null, null, null])];
        next[idx] = heroId ?? null;
        this.setPartySlots(next);
    }
    swapSlots(a, b) {
        const idxA = Math.max(0, Math.min(4, Math.floor(a)));
        const idxB = Math.max(0, Math.min(4, Math.floor(b)));
        if (idxA === idxB)
            return;
        const next = [...(this.state.partySlots ?? [null, null, null, null, null])];
        const tmp = (next[idxA] ?? null);
        next[idxA] = (next[idxB] ?? null);
        next[idxB] = tmp;
        this.setPartySlots(next);
    }
    removeHeroFromSlots(heroId) {
        if (!heroId)
            return;
        const next = (this.state.partySlots ?? [null, null, null, null, null]).map((id) => (id === heroId ? null : id));
        if (next.every((id, idx) => id === (this.state.partySlots ?? [null, null, null, null, null])[idx])) {
            return;
        }
        this.setPartySlots(next);
    }
    addToParty(heroId) {
        if (!heroId)
            return { ok: false, reason: "参数错误" };
        if (!this.hasHero(heroId))
            return { ok: false, reason: "未拥有该英雄" };
        if (this.isInParty(heroId))
            return { ok: false, reason: "已在队伍中" };
        const slots = [...(this.state.partySlots ?? [null, null, null, null, null])];
        const emptyIndex = slots.findIndex((slotId) => !slotId);
        if (emptyIndex === -1)
            return { ok: false, reason: "队伍已满（5/5）" };
        slots[emptyIndex] = heroId;
        this.setPartySlots(slots);
        return { ok: true };
    }
    removeFromParty(heroId) {
        this.removeHeroFromSlots(heroId);
    }
    toggleParty(heroId) {
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
    update(partial) {
        const before = this.state;
        const partySlots = partial.partySlots
            ? this.normalizeSlots(partial.partySlots)
            : partial.partyHeroIds
                ? this.normalizeSlots(partial.partyHeroIds)
                : before.partySlots;
        const next = {
            ...before,
            ...partial,
            inventory: partial.inventory ? { ...partial.inventory } : before.inventory,
            heroes: partial.heroes ? [...partial.heroes] : before.heroes,
            partyHeroIds: partySlots.filter((id) => !!id),
            partySlots,
        };
        this.state = next;
        this.persistAndEmit({ currency: true, inventory: true, heroes: true, stage: true, party: true });
    }
    addGold(delta) {
        this.applyCurrencyDelta({ gold: delta });
    }
    addDiamonds(delta) {
        this.applyCurrencyDelta({ diamonds: delta });
    }
    /**
     * Apply currency deltas (positive or negative). Negative deltas are clamped at 0.
     * ✅ Preferred unified API for currency updates.
     */
    applyCurrencyDelta(delta) {
        const g = Number(delta.gold ?? 0);
        const d = Number(delta.diamonds ?? 0);
        if ((!Number.isFinite(g) || g === 0) && (!Number.isFinite(d) || d === 0))
            return;
        if (Number.isFinite(g) && g !== 0)
            this.state.gold = Math.max(0, Math.floor(this.state.gold + Math.floor(g)));
        if (Number.isFinite(d) && d !== 0)
            this.state.diamonds = Math.max(0, Math.floor(this.state.diamonds + Math.floor(d)));
        this.persistAndEmit({ currency: true });
    }
    /**
     * Try spend currency as a single atomic operation.
     * If not enough currency, no changes are applied.
     */
    trySpendCurrency(cost) {
        const g = Math.max(0, Math.floor(Number(cost.gold ?? 0)));
        const d = Math.max(0, Math.floor(Number(cost.diamonds ?? 0)));
        if (g === 0 && d === 0)
            return { ok: true };
        if (this.state.gold < g)
            return { ok: false, reason: '金币不足！' };
        if (this.state.diamonds < d)
            return { ok: false, reason: '钻石不足！' };
        this.state.gold -= g;
        this.state.diamonds -= d;
        this.persistAndEmit({ currency: true });
        return { ok: true };
    }
    /**
     * Spend diamonds. Returns false if not enough.
     */
    spendDiamonds(cost) {
        cost = Math.max(0, Math.floor(cost));
        return this.trySpendCurrency({ diamonds: cost }).ok;
    }
    /**
     * Try spend gold. Returns false if not enough.
     */
    trySpendGold(cost) {
        cost = Math.max(0, Math.floor(cost));
        if (cost === 0)
            return true;
        return this.trySpendCurrency({ gold: cost }).ok;
    }
    /**
     * Try spend diamonds. Returns false if not enough.
     * (Wrapper for spendDiamonds to keep a consistent try* API.)
     */
    trySpendDiamonds(cost) {
        return this.spendDiamonds(cost);
    }
    /**
     * Try consume inventory item. Returns false if not enough.
     * This prevents negative inventory from accidental addInventory(key, -x).
     */
    tryConsumeInventory(key, amount) {
        if (!key)
            return false;
        amount = Math.max(0, Math.floor(amount));
        if (amount === 0)
            return true;
        const cur = this.state.inventory[key] || 0;
        if (cur < amount)
            return false;
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
    applyInventoryDeltas(deltas) {
        if (!deltas)
            return;
        let changed = false;
        for (const [key, raw] of Object.entries(deltas)) {
            if (!key)
                continue;
            const d = Math.floor(Number(raw) || 0);
            if (d === 0)
                continue;
            const cur = this.state.inventory[key] || 0;
            const next = Math.max(0, Math.floor(cur + d));
            if (next === cur)
                continue;
            this.state.inventory[key] = next;
            changed = true;
        }
        if (changed)
            this.persistAndEmit({ inventory: true });
    }
    /**
     * Try spend multiple inventory keys as one atomic operation.
     * If any key is not enough, no changes are applied.
     */
    trySpendInventory(costs) {
        if (!costs)
            return { ok: true };
        // validate
        for (const [key, raw] of Object.entries(costs)) {
            const amt = Math.max(0, Math.floor(Number(raw) || 0));
            if (!key || amt === 0)
                continue;
            const cur = this.state.inventory[key] || 0;
            if (cur < amt)
                return { ok: false, reason: `${key} 不足` };
        }
        // apply
        let changed = false;
        for (const [key, raw] of Object.entries(costs)) {
            const amt = Math.max(0, Math.floor(Number(raw) || 0));
            if (!key || amt === 0)
                continue;
            const cur = this.state.inventory[key] || 0;
            this.state.inventory[key] = Math.max(0, Math.floor(cur - amt));
            changed = true;
        }
        if (changed)
            this.persistAndEmit({ inventory: true });
        return { ok: true };
    }
    addInventory(key, delta) {
        if (!key)
            return;
        if (!Number.isFinite(delta) || delta === 0)
            return;
        const cur = this.state.inventory[key] || 0;
        const next = Math.max(0, Math.floor(cur + delta));
        this.state.inventory[key] = next;
        this.persistAndEmit({ inventory: true });
    }
    setInventory(key, value) {
        if (!key)
            return;
        this.state.inventory[key] = Math.max(0, Math.floor(value));
        this.persistAndEmit({ inventory: true });
    }
    /**
     * Add a new hero to collection.
     * If the hero already exists, this method does nothing.
     */
    addHero(heroId) {
        if (!heroId)
            return false;
        if (this.hasHero(heroId))
            return false;
        // Stars are 1-based in UI/logic; keep persisted data consistent.
        this.state.heroes.push({ heroId, level: 1, stars: 1, obtainedAt: Date.now() });
        this.persistAndEmit({ heroes: true });
        return true;
    }
    /**
     * Add multiple heroes as a batch (recommended).
     * Returns how many were newly added.
     */
    addHeroes(heroIds) {
        const added = [];
        const duplicates = [];
        if (!Array.isArray(heroIds) || heroIds.length === 0)
            return { added, duplicates };
        for (const id of heroIds) {
            if (!id)
                continue;
            if (this.hasHero(id)) {
                duplicates.push(id);
                continue;
            }
            this.state.heroes.push({ heroId: id, level: 1, stars: 1, obtainedAt: Date.now() });
            added.push(id);
        }
        if (added.length > 0)
            this.persistAndEmit({ heroes: true });
        return { added, duplicates };
    }
    /**
     * Try level up hero, spending gold.
     */
    tryLevelUpHero(heroId, goldCost, levelCap) {
        const owned = this.getOwnedHero(heroId);
        if (!owned)
            return { ok: false, reason: '未拥有该英雄，无法升级。' };
        if (owned.level >= levelCap)
            return { ok: false, reason: '已达等级上限。' };
        goldCost = Math.max(0, Math.floor(goldCost));
        if (goldCost > 0 && this.state.gold < goldCost)
            return { ok: false, reason: '金币不足！' };
        // Batch to make this operation atomic (single persist + single emit).
        return this.withBatch(() => {
            const pay = this.trySpendCurrency({ gold: goldCost });
            if (!pay.ok)
                return pay;
            owned.level += 1;
            this.persistAndEmit({ heroes: true });
            return { ok: true };
        });
    }
    /**
     * Try star up hero, spending universal shards.
     * ✅ Atomic: either both spend + starUp happen, or neither.
     */
    tryStarUpHero(heroId, shardKey, shardCost, maxStars = 5) {
        const owned = this.getOwnedHero(heroId);
        if (!owned)
            return { ok: false, reason: '未拥有该英雄，无法升星。' };
        const curStars = Math.max(1, Math.floor(owned.stars || 0));
        if (curStars >= maxStars)
            return { ok: false, reason: '已满星。', stars: curStars };
        shardCost = Math.max(0, Math.floor(shardCost));
        if (!shardKey)
            return { ok: false, reason: '碎片配置错误。' };
        if (shardCost > 0 && (this.state.inventory[shardKey] || 0) < shardCost)
            return { ok: false, reason: '碎片不足。', stars: curStars };
        return this.withBatch(() => {
            const pay = this.trySpendInventory({ [shardKey]: shardCost });
            if (!pay.ok)
                return { ok: false, reason: '碎片不足。', stars: curStars };
            owned.stars = curStars + 1;
            this.persistAndEmit({ heroes: true });
            return { ok: true, stars: owned.stars };
        });
    }
    hardReset() {
        resetStorage();
        this.state = defaultState();
        this.persistAndEmit({ currency: true, inventory: true, heroes: true, stage: true, party: true });
    }
    // ---------------------------
    // Internals
    // ---------------------------
    persistAndEmit(flags) {
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
    flushBatch() {
        if (!this.pendingPersist)
            return;
        const flags = this.pendingFlags;
        this.pendingFlags = {};
        this.pendingPersist = false;
        // Persist once
        saveStateToStorage(this.state);
        if (flags.currency)
            this.emitter.emit('currencyChanged', { gold: this.state.gold, diamonds: this.state.diamonds });
        if (flags.inventory)
            this.emitter.emit('inventoryChanged', { inventory: { ...this.state.inventory } });
        if (flags.heroes)
            this.emitter.emit('heroesChanged', { heroes: [...this.state.heroes] });
        if (flags.party) {
            this.emitter.emit('partyChanged', {
                partyHeroIds: [...(this.state.partyHeroIds ?? [])],
                partySlots: [...(this.state.partySlots ?? [null, null, null, null, null])],
            });
        }
        if (flags.stage)
            this.emitter.emit('stageChanged', { stage: this.stage });
        this.emitter.emit('anyChanged', this.getSnapshot());
    }
    normalizeSlots(input) {
        const slots = Array.from({ length: 5 }, (_, i) => {
            const v = input?.[i];
            return typeof v === 'string' && String(v).trim() ? String(v) : null;
        });
        const seen = new Set();
        return slots.map((id) => {
            if (!id)
                return null;
            if (seen.has(id))
                return null;
            seen.add(id);
            return id;
        });
    }
}
