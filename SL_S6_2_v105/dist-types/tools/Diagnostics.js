function isNonNegInt(n) {
    return Number.isFinite(n) && Math.floor(n) === n && n >= 0;
}
function uniq(arr) {
    return Array.from(new Set(arr));
}
export function runDiagnostics(state) {
    const snap = state.getSnapshot();
    const errors = [];
    const warnings = [];
    // Currency
    if (!isNonNegInt(snap.gold))
        errors.push(`gold 非法: ${String(snap.gold)}`);
    if (!isNonNegInt(snap.diamonds))
        errors.push(`diamonds 非法: ${String(snap.diamonds)}`);
    // Stage
    if (!isNonNegInt(snap.stage) || snap.stage < 1)
        errors.push(`stage 非法: ${String(snap.stage)}`);
    // Inventory
    if (!snap.inventory || typeof snap.inventory !== 'object') {
        errors.push('inventory 缺失或类型错误');
    }
    else {
        for (const [k, v] of Object.entries(snap.inventory)) {
            if (!isNonNegInt(v))
                errors.push(`inventory[${k}] 非法: ${String(v)}`);
        }
    }
    // Heroes
    if (!Array.isArray(snap.heroes)) {
        errors.push('heroes 缺失或类型错误');
    }
    else {
        const ids = snap.heroes.map((h) => String(h.heroId ?? '')).filter(Boolean);
        if (ids.length !== uniq(ids).length)
            warnings.push('heroes 存在重复 heroId（可能是历史坏档）');
        for (const h of snap.heroes) {
            const id = String(h.heroId ?? '');
            if (!id)
                errors.push('heroes 存在空 heroId');
            if (!isNonNegInt(h.level) || h.level < 1)
                warnings.push(`hero(${id}) level 异常: ${String(h.level)}`);
            if (!isNonNegInt(h.stars) || h.stars < 1)
                warnings.push(`hero(${id}) stars 异常: ${String(h.stars)}`);
            if (!Number.isFinite(Number(h.obtainedAt)))
                warnings.push(`hero(${id}) obtainedAt 异常: ${String(h.obtainedAt)}`);
        }
    }
    // Party
    const slots = Array.isArray(snap.partySlots) ? snap.partySlots : [];
    if (slots.length !== 5)
        warnings.push(`partySlots 长度异常: ${slots.length}（期望 5）`);
    const used = slots.filter((x) => typeof x === 'string' && !!x);
    if (used.length !== uniq(used).length)
        errors.push('队伍上阵出现重复英雄');
    for (const id of used) {
        if (!snap.heroes?.some((h) => h.heroId === id))
            errors.push(`队伍引用了未拥有英雄: ${id}`);
    }
    return { errors, warnings, snapshot: snap };
}
export function formatDiagnosticsReport(result, version) {
    const s = result.snapshot;
    const time = new Date().toISOString();
    const heroCount = Array.isArray(s.heroes) ? s.heroes.length : 0;
    const partyCount = Array.isArray(s.partySlots) ? s.partySlots.filter(Boolean).length : 0;
    const invKeys = s.inventory ? Object.keys(s.inventory).length : 0;
    const lines = [];
    lines.push('=== DIAGNOSTICS REPORT ===');
    lines.push(`Time: ${time}`);
    lines.push(`Version: ${version}`);
    lines.push(`Snapshot: stage=${s.stage} gold=${s.gold} diamonds=${s.diamonds} heroes=${heroCount} party=${partyCount}/5 invKeys=${invKeys}`);
    lines.push('');
    lines.push(`Summary: errors=${result.errors.length} warnings=${result.warnings.length}`);
    lines.push('');
    if (result.errors.length === 0 && result.warnings.length === 0) {
        lines.push('✅ 未发现确定性异常（本地规则检查通过）');
    }
    else {
        if (result.errors.length) {
            lines.push('❌ Errors:');
            for (const e of result.errors)
                lines.push(`- ${e}`);
        }
        if (result.warnings.length) {
            lines.push('⚠️ Warnings:');
            for (const w of result.warnings)
                lines.push(`- ${w}`);
        }
    }
    return lines.join('\n');
}
