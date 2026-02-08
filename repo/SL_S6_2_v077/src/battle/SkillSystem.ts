import type { FighterSnapshot } from './BattleTypes';
import type { EffectContext, SkillRuntimeAPI, TriggerContext, TriggerType } from './SkillTypes';
import type { SkillRegistry } from './SkillRegistry';

/**
 * SkillSystem
 *
 * Runtime executor that:
 * - looks up skills by id (registry)
 * - checks triggers
 * - applies effects through a small API
 *
 * This keeps BattleLogic clean: no giant switch/case per skill.
 */
export default class SkillSystem {
  constructor(private readonly registry: SkillRegistry) {}

  /**
   * Execute skills owned by `actor` for the given trigger.
   * Returns the list of skill ids that actually fired (for event emission).
   */
  public tryTrigger(trigger: TriggerType, actor: FighterSnapshot, ctx: TriggerContext, api: SkillRuntimeAPI): string[] {
    const skillIds = actor.skills ?? [];
    if (skillIds.length === 0) return [];

    const fired: string[] = [];
    for (const id of skillIds) {
      const s = this.registry.get(id);
      if (!s) continue;
      const ok = s.triggers.some((tr) => tr.type === trigger && tr.match(ctx));
      if (!ok) continue;
      fired.push(id);
      const ectx: EffectContext = {
        round: ctx.round,
        sourceId: ctx.actorId,
        targetId: ctx.targetId ?? ctx.actorId,
      };
      for (const eff of s.effects) {
        eff.apply(ectx, api);
      }
    }
    return fired;
  }

  /**
   * Execute a skill by id (used for active skills).
   * Returns true if the skill existed and was executed.
   */
  public executeSkill(skillId: string, actor: FighterSnapshot, ctx: TriggerContext, api: SkillRuntimeAPI): boolean {
    const s = this.registry.get(skillId);
    if (!s) return false;
    const ectx: EffectContext = {
      round: ctx.round,
      sourceId: ctx.actorId,
      targetId: ctx.targetId ?? ctx.actorId,
    };
    for (const eff of s.effects) {
      eff.apply(ectx, api);
    }
    return true;
  }
}
