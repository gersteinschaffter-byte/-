/**
 * SkillDefs — JSON-driven skill & buff factory.
 *
 * Reads configs/skills.json + configs/buffs.json, builds runtime Skill/Buff
 * objects, and registers them. Adding a new skill = one JSON entry, zero TS.
 */
import { SkillRegistry, BuffRegistry } from './SkillRegistry';
import skillsJson from '../configs/skills.json';
import buffsJson from '../configs/buffs.json';
/* ── Factories ───────────────────────────────────────── */
function makeTrigger(type, chance) {
    return {
        type,
        match(_ctx) {
            return chance >= 1 || Math.random() < chance;
        },
    };
}
function makeEffect(def) {
    const { effectType, power, buffId, target } = def;
    return {
        type: effectType,
        apply(ctx, api) {
            const ex = api;
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
                    case 'addBuff':
                        if (buffId)
                            api.addBuff(ctx.sourceId, tid, buffId, 1);
                        break;
                    case 'removeBuff':
                        if (buffId)
                            api.removeBuff(tid, buffId);
                        break;
                }
            }
        },
    };
}
function resolveTargets(strategy, ctx, api) {
    switch (strategy) {
        case 'self': return [ctx.sourceId];
        case 'current': return [ctx.targetId];
        case 'allEnemy': return api.getAliveEnemyIds(ctx.sourceId);
        case 'allAlly': return api.getAliveAllyIds(ctx.sourceId);
        case 'lowestAlly': {
            const id = api.getLowestHpAllyId(ctx.sourceId);
            return id ? [id] : [ctx.sourceId];
        }
        default: return [ctx.targetId];
    }
}
/* ── Public registration ─────────────────────────────── */
export function registerAllSkillsAndBuffs(skillReg, buffReg) {
    for (const bj of buffsJson) {
        buffReg.register({ id: bj.id, name: bj.name, maxStacks: bj.maxStacks, durationRounds: bj.durationRounds });
    }
    for (const sj of skillsJson) {
        const mode = sj.mode ?? 'passive';
        const skill = {
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
export function getBuffJson(buffId) {
    return buffsJson.find((b) => b.id === buffId);
}
export function getSkillName(skillId) {
    const s = skillsJson.find((x) => x.id === skillId);
    return s?.name ?? skillId;
}
