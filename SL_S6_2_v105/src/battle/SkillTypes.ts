/**
 * Skill/Trigger/Effect data contracts.
 *
 * Goal (Phase 5+):
 * - Keep BattleLogic free of "giant if-else" skill trees.
 * - Skills are registered in a map and executed via small composable interfaces.
 * - Triggers decide WHEN a skill may fire; Effects decide WHAT happens.
 */

export type SkillId = string;
export type BuffId = string;

export type TriggerType =
  | 'onBattleStart'
  | 'onRoundStart'
  | 'onTurnStart'
  | 'onBeforeAttack'
  | 'onAfterAttack'
  | 'onBeforeDamage'
  | 'onAfterDamage'
  | 'onDead';

export interface TriggerContext {
  round: number;
  actorId: string;
  targetId?: string;
}

export interface Trigger {
  type: TriggerType;
  /** Return true if this trigger should fire for the given context. */
  match(ctx: TriggerContext): boolean;
}

export type EffectType = 'damage' | 'heal' | 'addBuff' | 'removeBuff';

export interface EffectContext {
  round: number;
  sourceId: string;
  targetId: string;
}

export interface Effect {
  type: EffectType;
  apply(ctx: EffectContext, api: SkillRuntimeAPI): void;
}

export interface Skill {
  id: SkillId;
  name: string;
  /**
   * Skill mode:
   * - passive: fires via Trigger rules (chance-based etc.)
   * - active: chosen at actor action time when off cooldown
   */
  mode?: 'passive' | 'active';
  /** Cooldown in actor turns (only for active skills). */
  cooldownTurns?: number;
  /** Higher priority active skills are chosen first. */
  priority?: number;
  /** Skills can have multiple triggers and effects. */
  triggers: Trigger[];
  effects: Effect[];
}

export interface Buff {
  id: BuffId;
  name: string;
  /** Stack/refresh rules are intentionally left as data; implementation can evolve. */
  maxStacks?: number;
  durationRounds?: number;
}

/**
 * A small API surface that Skill/Effect implementations can use.
 * BattleLogic owns the actual data mutations; effects only call these methods.
 */
export interface SkillRuntimeAPI {
  dealDamage(sourceId: string, targetId: string, amount: number): void;
  heal(sourceId: string, targetId: string, amount: number): void;
  addBuff(sourceId: string, targetId: string, buffId: BuffId, stacks?: number): void;
  removeBuff(targetId: string, buffId: BuffId): void;
}
