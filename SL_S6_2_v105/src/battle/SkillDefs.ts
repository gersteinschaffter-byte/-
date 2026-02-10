/**
 * SkillDefs — JSON-driven skill & buff factory.
 *
 * Reads configs/skills.json + configs/buffs.json, builds runtime Skill/Buff
 * objects, and registers them. Adding a new skill = one JSON entry, zero TS.
 */

import type { Skill, Trigger, Effect, TriggerType, SkillRuntimeAPI, EffectContext, TriggerContext, Buff } from './SkillTypes';
import { SkillRegistry, BuffRegistry } from './SkillRegistry';

import skillsJson from '../configs/skills.json';
import buffsJson from '../configs/buffs.json';

/* ── JSON shapes ─────────────────────────────────────── */

interface SkillJson {
  id: string;
  name: string;
  /** passive skills: use trigger+chance. active skills: use mode+cooldownTurns. */
  mode?: 'passive' | 'active';
  trigger: TriggerType;
  chance: number;          // 0‒1 (used by passive skills)
  cooldownTurns?: number;  // used by active skills
  priority?: number;       // used by active skills
  effectType:
    | 'damage'
    | 'heal'
    | 'addBuff'
    | 'removeBuff'
    | 'damageByTargetMaxHpPct'
    | 'healByTargetMaxHpPct'
    | 'removeRandomBuff'
    | 'addShieldBySourceAtkPct'
    | 'addShieldByTargetMaxHpPct'
    | 'addShieldFlat';
  power?: number;          // ATK multiplier
  hpPct?: number;          // target max-hp ratio for HP-based effects
  shieldPct?: number;      // shield ratio (source atk / target max-hp)
  shieldValue?: number;    // flat shield value
  buffId?: string;
  buffStacks?: number;
  removeCount?: number;
  target: 'current' | 'self' | 'allEnemy' | 'allAlly' | 'lowestAlly' | 'randomEnemy';
}

interface BuffJson {
  id: string;
  name: string;
  icon?: string;
  durationRounds?: number;
  maxStacks?: number;
  statMod?: { atkPct?: number; atkFlat?: number; dmgReduce?: number; spdFlat?: number; defFlat?: number; defPct?: number };
  dot?: { hpPct?: number; tick?: 'round' | 'turn' };
}

/* ── Extended runtime API surface ────────────────────── */

export interface SkillRuntimeAPIEx extends SkillRuntimeAPI {
  getAtk(fighterId: string): number;
  getAliveEnemyIds(fighterId: string): string[];
  getAliveAllyIds(fighterId: string): string[];
  getLowestHpAllyId(fighterId: string): string | undefined;
  getCurrentHp(fighterId: string): number;
  getMaxHp(fighterId: string): number;
  getBuffIds(fighterId: string): string[];
}

/* ── Factories ───────────────────────────────────────── */

function makeTrigger(type: TriggerType, chance: number): Trigger {
  return {
    type,
    match(_ctx: TriggerContext): boolean {
      return chance >= 1 || Math.random() < chance;
    },
  };
}

function makeEffect(def: SkillJson): Effect {
  const { effectType, power, hpPct, shieldPct, shieldValue, buffId, buffStacks, removeCount, target } = def;
  return {
    type: effectType,
    apply(ctx: EffectContext, api: SkillRuntimeAPI): void {
      const ex = api as unknown as SkillRuntimeAPIEx;
      const targets = resolveTargets(target, ctx, ex);
      for (const tid of targets) {
        switch (effectType) {
          case 'damage': {
            const atk = ex.getAtk(ctx.sourceId);
            api.dealDamage(ctx.sourceId, tid, Math.max(1, Math.floor(atk * (power ?? 1))));
            break;
          }
          case 'heal': {
            const atk = ex.getAtk(ctx.sourceId);
            api.heal(ctx.sourceId, tid, Math.max(1, Math.floor(atk * (power ?? 1))));
            break;
          }
          case 'damageByTargetMaxHpPct': {
            const maxHp = ex.getMaxHp(tid);
            const ratio = Math.max(0, hpPct ?? 0);
            api.dealDamage(ctx.sourceId, tid, Math.max(1, Math.floor(maxHp * ratio)));
            break;
          }
          case 'healByTargetMaxHpPct': {
            const maxHp = ex.getMaxHp(tid);
            const ratio = Math.max(0, hpPct ?? 0);
            api.heal(ctx.sourceId, tid, Math.max(1, Math.floor(maxHp * ratio)));
            break;
          }
          case 'addShieldBySourceAtkPct': {
            const atk = ex.getAtk(ctx.sourceId);
            const ratio = Math.max(0, shieldPct ?? 0);
            api.addShield(ctx.sourceId, tid, Math.max(1, Math.floor(atk * ratio)));
            break;
          }
          case 'addShieldByTargetMaxHpPct': {
            const maxHp = ex.getMaxHp(tid);
            const ratio = Math.max(0, shieldPct ?? 0);
            api.addShield(ctx.sourceId, tid, Math.max(1, Math.floor(maxHp * ratio)));
            break;
          }
          case 'addShieldFlat': {
            api.addShield(ctx.sourceId, tid, Math.max(1, Math.floor(shieldValue ?? 1)));
            break;
          }
          case 'addBuff':
            if (buffId) api.addBuff(ctx.sourceId, tid, buffId, Math.max(1, Math.floor(buffStacks ?? 1)));
            break;
          case 'removeBuff':
            if (buffId) api.removeBuff(tid, buffId);
            break;
          case 'removeRandomBuff': {
            const ids = ex.getBuffIds(tid);
            const n = Math.max(1, Math.floor(removeCount ?? 1));
            for (let i = 0; i < n && ids.length > 0; i++) {
              const idx = Math.floor(Math.random() * ids.length);
              const bid = ids.splice(idx, 1)[0];
              if (bid) api.removeBuff(tid, bid);
            }
            break;
          }
        }
      }
    },
  };
}

function resolveTargets(strategy: string, ctx: EffectContext, api: SkillRuntimeAPIEx): string[] {
  switch (strategy) {
    case 'self':       return [ctx.sourceId];
    case 'current':    return [ctx.targetId];
    case 'allEnemy':   return api.getAliveEnemyIds(ctx.sourceId);
    case 'allAlly':    return api.getAliveAllyIds(ctx.sourceId);
    case 'lowestAlly': { const id = api.getLowestHpAllyId(ctx.sourceId); return id ? [id] : [ctx.sourceId]; }
    case 'randomEnemy': {
      const ids = api.getAliveEnemyIds(ctx.sourceId);
      if (ids.length <= 0) return [ctx.targetId];
      const id = ids[Math.floor(Math.random() * ids.length)];
      return id ? [id] : [ctx.targetId];
    }
    default:           return [ctx.targetId];
  }
}

/* ── Public registration ─────────────────────────────── */

export function registerAllSkillsAndBuffs(skillReg: SkillRegistry, buffReg: BuffRegistry): void {
  for (const bj of buffsJson as BuffJson[]) {
    buffReg.register({ id: bj.id, name: bj.name, maxStacks: bj.maxStacks, durationRounds: bj.durationRounds } as Buff);
  }
  for (const sj of skillsJson as SkillJson[]) {
    const mode = sj.mode ?? 'passive';
    const skill: Skill = {
      id: sj.id,
      name: sj.name,
      mode,
      cooldownTurns: sj.cooldownTurns,
      priority: sj.priority,
      // Active skills are chosen by BattleLogic when off cooldown,
      // so they do not participate in chance-based trigger scanning.
      triggers: mode === 'active' ? [] : [makeTrigger(sj.trigger, sj.chance)],
      effects: [makeEffect(sj)],
    };
    skillReg.register(skill);
  }
}

/* ── Buff config lookup (used by BuffSystem / BattleLogic) ── */

export function getBuffJson(buffId: string): BuffJson | undefined {
  return (buffsJson as BuffJson[]).find((b) => b.id === buffId);
}

export function getSkillName(skillId: string): string {
  const s = (skillsJson as SkillJson[]).find((x) => x.id === skillId);
  return s?.name ?? skillId;
}
