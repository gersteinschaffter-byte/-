import { ELEMENTS, PROFESSION, RARITY } from './config';
import heroesJson from '../configs/heroes.json';
import stagesJson from '../configs/stages.json';
import summonProbJson from '../configs/summon_prob.json';
import poolsJson from '../configs/pools.json';
import skillsJson from '../configs/skills.json';
function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
}
function pushOnce(arr, msg) {
    if (!arr.includes(msg))
        arr.push(msg);
}
/**
 * Validate JSON configs at runtime.
 *
 * Why:
 * - Most game rules come from JSON configs.
 * - A tiny typo can silently break mechanics or crash later.
 *
 * This validator is intentionally lightweight (no extra deps).
 */
export function validateConfigs() {
    const errors = [];
    const warnings = [];
    // ----------------------
    // heroes.json
    // ----------------------
    const heroes = heroesJson;
    if (!Array.isArray(heroes) || heroes.length === 0) {
        errors.push('[heroes.json] 必须是非空数组');
    }
    else {
        const ids = new Set();
        for (let i = 0; i < heroes.length; i++) {
            const h = heroes[i] || {};
            const path = `[heroes.json][${i}]`;
            if (typeof h.id !== 'string' || !h.id.trim())
                errors.push(`${path}.id 缺失或不是字符串`);
            if (typeof h.name !== 'string' || !h.name.trim())
                warnings.push(`${path}.name 缺失或不是字符串（仅影响显示）`);
            if (typeof h.id === 'string') {
                if (ids.has(h.id))
                    errors.push(`${path}.id 重复：${h.id}`);
                ids.add(h.id);
            }
            const rOk = Object.values(RARITY).includes(h.rarity);
            if (!rOk)
                errors.push(`${path}.rarity 非法：${h.rarity}（必须是 ${Object.values(RARITY).join('/')}）`);
            const eOk = ELEMENTS.includes(h.element);
            if (!eOk)
                errors.push(`${path}.element 非法：${h.element}（必须是 ${ELEMENTS.join('/')}）`);
            const pOk = Object.values(PROFESSION).includes(h.profession);
            if (!pOk)
                errors.push(`${path}.profession 非法：${h.profession}（必须是 ${Object.values(PROFESSION).join('/')}）`);
            if (h.skills != null) {
                if (!Array.isArray(h.skills)) {
                    errors.push(`${path}.skills 必须是数组`);
                }
            }
        }
    }
    // ----------------------
    // skills.json
    // ----------------------
    const skills = skillsJson;
    const skillIds = new Set();
    if (!Array.isArray(skills) || skills.length === 0) {
        warnings.push('[skills.json] 为空或不是数组（将导致技能引用无效）');
    }
    else {
        for (let i = 0; i < skills.length; i++) {
            const s = skills[i] || {};
            const path = `[skills.json][${i}]`;
            if (typeof s.id !== 'string' || !s.id.trim()) {
                errors.push(`${path}.id 缺失或不是字符串`);
                continue;
            }
            if (skillIds.has(s.id))
                errors.push(`${path}.id 重复：${s.id}`);
            skillIds.add(s.id);
            if (typeof s.name !== 'string' || !s.name.trim())
                warnings.push(`${path}.name 缺失或不是字符串（仅影响显示）`);
            if (s.power != null && !isFiniteNumber(s.power))
                errors.push(`${path}.power 必须是数字`);
            if (s.chance != null && !isFiniteNumber(s.chance))
                errors.push(`${path}.chance 必须是数字`);
        }
    }
    // Validate hero.skills exist in skills.json
    if (Array.isArray(heroes) && skillIds.size > 0) {
        for (let i = 0; i < heroes.length; i++) {
            const h = heroes[i] || {};
            if (!Array.isArray(h.skills))
                continue;
            for (const sk of h.skills) {
                if (typeof sk !== 'string') {
                    errors.push(`[heroes.json][${i}].skills 存在非字符串项：${String(sk)}`);
                    continue;
                }
                if (!skillIds.has(sk))
                    errors.push(`[heroes.json][${i}].skills 引用了不存在的技能：${sk}`);
            }
        }
    }
    // ----------------------
    // summon_prob.json
    // ----------------------
    const prob = summonProbJson;
    const requiredR = [RARITY.R, RARITY.SR, RARITY.SSR, RARITY.SP];
    if (!Array.isArray(prob) || prob.length === 0) {
        errors.push('[summon_prob.json] 必须是非空数组');
    }
    else {
        let sum = 0;
        const seen = new Set();
        for (let i = 0; i < prob.length; i++) {
            const it = prob[i] || {};
            const path = `[summon_prob.json][${i}]`;
            if (!requiredR.includes(it.rarity))
                errors.push(`${path}.rarity 非法：${it.rarity}`);
            if (seen.has(it.rarity))
                errors.push(`${path}.rarity 重复：${it.rarity}`);
            seen.add(it.rarity);
            if (!isFiniteNumber(it.p) || it.p < 0)
                errors.push(`${path}.p 必须是 >=0 的数字`);
            sum += isFiniteNumber(it.p) ? it.p : 0;
        }
        for (const r of requiredR) {
            if (!seen.has(r))
                errors.push(`[summon_prob.json] 缺少稀有度条目：${r}`);
        }
        // The project uses percentage weights (0..100). Allow small numeric drift.
        if (Math.abs(sum - 100) > 0.01) {
            warnings.push(`[summon_prob.json] 概率总和应为 100（当前=${sum}）`);
        }
    }
    // ----------------------
    // pools.json
    // ----------------------
    const pools = poolsJson;
    if (!pools || typeof pools !== 'object') {
        errors.push('[pools.json] 必须是对象（key->pool）');
    }
    else {
        const keys = Object.keys(pools);
        if (keys.length === 0)
            errors.push('[pools.json] 不能为空（至少一个卡池）');
        for (const k of keys) {
            const p = pools[k] || {};
            const path = `[pools.json].${k}`;
            if (typeof p.id !== 'string' || !p.id.trim())
                errors.push(`${path}.id 缺失或不是字符串`);
            if (typeof p.ticketKey !== 'string' || !p.ticketKey.trim())
                errors.push(`${path}.ticketKey 缺失或不是字符串`);
            if (!isFiniteNumber(p.diamondCost) || p.diamondCost < 0)
                errors.push(`${path}.diamondCost 必须是 >=0 的数字`);
            if (typeof p.title !== 'string')
                warnings.push(`${path}.title 缺失或不是字符串（仅影响显示）`);
        }
    }
    // ----------------------
    // stages.json
    // ----------------------
    const stages = stagesJson;
    if (!Array.isArray(stages) || stages.length === 0) {
        errors.push('[stages.json] 必须是非空数组');
    }
    else {
        const ids = new Set();
        for (let i = 0; i < stages.length; i++) {
            const s = stages[i] || {};
            const path = `[stages.json][${i}]`;
            if (!Number.isInteger(s.id))
                errors.push(`${path}.id 必须是整数`);
            if (Number.isInteger(s.id)) {
                if (ids.has(s.id))
                    errors.push(`${path}.id 重复：${s.id}`);
                ids.add(s.id);
            }
            if (!Array.isArray(s.enemies) || s.enemies.length === 0)
                errors.push(`${path}.enemies 必须是非空数组`);
            if (!isFiniteNumber(s.levelOffset))
                errors.push(`${path}.levelOffset 必须是数字`);
            if (Array.isArray(s.enemies)) {
                for (let j = 0; j < s.enemies.length; j++) {
                    const e = s.enemies[j] || {};
                    const ep = `${path}.enemies[${j}]`;
                    if (typeof e.name !== 'string')
                        warnings.push(`${ep}.name 缺失或不是字符串（仅影响显示）`);
                    if (!Object.values(RARITY).includes(e.rarity))
                        errors.push(`${ep}.rarity 非法：${e.rarity}`);
                    if (!ELEMENTS.includes(e.element))
                        errors.push(`${ep}.element 非法：${e.element}`);
                    if (e.bossMult != null && (!isFiniteNumber(e.bossMult) || e.bossMult <= 0)) {
                        errors.push(`${ep}.bossMult 必须是 >0 的数字`);
                    }
                    if (!Array.isArray(e.skills))
                        errors.push(`${ep}.skills 必须是数组`);
                    if (Array.isArray(e.skills) && skillIds.size > 0) {
                        for (const sk of e.skills) {
                            if (typeof sk !== 'string') {
                                errors.push(`${ep}.skills 存在非字符串项：${String(sk)}`);
                                continue;
                            }
                            if (!skillIds.has(sk))
                                errors.push(`${ep}.skills 引用了不存在的技能：${sk}`);
                        }
                    }
                }
            }
        }
    }
    // Deduplicate very noisy warnings
    const uniqWarnings = Array.from(new Set(warnings));
    return { errors, warnings: uniqWarnings };
}
/** Useful for copying into bug reports. */
export function formatValidationReport(r) {
    const lines = [];
    lines.push('CONFIG VALIDATION REPORT');
    lines.push('------------------------');
    lines.push(`Errors: ${r.errors.length}`);
    for (const e of r.errors)
        lines.push(`- ${e}`);
    lines.push('');
    lines.push(`Warnings: ${r.warnings.length}`);
    for (const w of r.warnings)
        lines.push(`- ${w}`);
    return lines.join('\n');
}
