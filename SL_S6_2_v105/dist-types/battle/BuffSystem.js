/**
 * BuffSystem (placeholder)
 *
 * Only manages data structure and duration bookkeeping.
 * Actual stat modifications/hooks can be added later without rewriting BattleLogic.
 */
export default class BuffSystem {
    constructor(registry) {
        Object.defineProperty(this, "registry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: registry
        });
        Object.defineProperty(this, "map", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        }); // fighterId -> buffs
    }
    init(fighters) {
        this.map.clear();
        for (const f of fighters) {
            const initial = (f.buffs ?? []).map((id) => ({ id, stacks: 1 }));
            this.map.set(f.id, initial);
        }
    }
    addBuff(sourceId, targetId, buffId, stacks = 1, currentRound = 0) {
        void sourceId;
        const def = this.registry.get(buffId);
        const list = this.map.get(targetId) ?? [];
        const existing = list.find((b) => b.id === buffId);
        if (existing) {
            const max = def?.maxStacks ?? 99;
            existing.stacks = Math.min(max, existing.stacks + stacks);
            if (def?.durationRounds != null)
                existing.expiresRound = currentRound + def.durationRounds;
        }
        else {
            const inst = { id: buffId, stacks: Math.max(1, stacks) };
            if (def?.durationRounds != null)
                inst.expiresRound = currentRound + def.durationRounds;
            list.push(inst);
        }
        this.map.set(targetId, list);
    }
    removeBuff(targetId, buffId) {
        const list = this.map.get(targetId);
        if (!list)
            return;
        this.map.set(targetId, list.filter((b) => b.id !== buffId));
    }
    /** Call on round start to expire duration buffs. */
    onRoundStart(round) {
        for (const [fid, list] of this.map.entries()) {
            const next = list.filter((b) => b.expiresRound == null || b.expiresRound > round);
            this.map.set(fid, next);
        }
    }
    getBuffs(fighterId) {
        return this.map.get(fighterId) ?? [];
    }
}
