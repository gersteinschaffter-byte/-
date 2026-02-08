import type { FighterSnapshot } from './BattleTypes';
import type { BuffId } from './SkillTypes';
import type { BuffRegistry } from './SkillRegistry';

export interface BuffInstance {
  id: BuffId;
  stacks: number;
  expiresRound?: number;
}

/**
 * BuffSystem (placeholder)
 *
 * Only manages data structure and duration bookkeeping.
 * Actual stat modifications/hooks can be added later without rewriting BattleLogic.
 */
export default class BuffSystem {
  private readonly map = new Map<string, BuffInstance[]>(); // fighterId -> buffs

  constructor(private readonly registry: BuffRegistry) {}

  public init(fighters: FighterSnapshot[]): void {
    this.map.clear();
    for (const f of fighters) {
      const initial = (f.buffs ?? []).map((id) => ({ id, stacks: 1 }));
      this.map.set(f.id, initial);
    }
  }

  public addBuff(sourceId: string, targetId: string, buffId: BuffId, stacks = 1, currentRound = 0): void {
    void sourceId;
    const def = this.registry.get(buffId);
    const list = this.map.get(targetId) ?? [];
    const existing = list.find((b) => b.id === buffId);
    if (existing) {
      const max = def?.maxStacks ?? 99;
      existing.stacks = Math.min(max, existing.stacks + stacks);
      if (def?.durationRounds != null) existing.expiresRound = currentRound + def.durationRounds;
    } else {
      const inst: BuffInstance = { id: buffId, stacks: Math.max(1, stacks) };
      if (def?.durationRounds != null) inst.expiresRound = currentRound + def.durationRounds;
      list.push(inst);
    }
    this.map.set(targetId, list);
  }

  public removeBuff(targetId: string, buffId: BuffId): void {
    const list = this.map.get(targetId);
    if (!list) return;
    this.map.set(
      targetId,
      list.filter((b) => b.id !== buffId),
    );
  }

  /** Call on round start to expire duration buffs. */
  public onRoundStart(round: number): void {
    for (const [fid, list] of this.map.entries()) {
      const next = list.filter((b) => b.expiresRound == null || b.expiresRound > round);
      this.map.set(fid, next);
    }
  }

  public getBuffs(fighterId: string): BuffInstance[] {
    return this.map.get(fighterId) ?? [];
  }
}
