function isNonNegInt(n) {
    return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}
/**
 * Local (offline) diagnostics.
 *
 * Goal: catch deterministic problems that indicate a bug or data corruption.
 * - no network
 * - no LLM
 * - designed for on-device reporting
 */
export function runDiagnostics(game) {
    const time = new Date().toISOString();
    const version = String(game.versionLabel?.text || '').split(' ')[0] || '';
    const s = game.state.getSnapshot();
    const items = [];
    const push = (level, code, message, details) => items.push({ level, code, message, details });
    // ---------------------------
    // Basic numeric integrity
    // ---------------------------
    if (!isNonNegInt(s.stage) || s.stage < 1)
        push('ERROR', 'STATE_STAGE_INVALID', `关卡 stage 非法：${String(s.stage)}`);
    if (!isNonNegInt(s.gold))
        push('ERROR', 'STATE_GOLD_INVALID', `金币 gold 非法：${String(s.gold)}`);
    if (!isNonNegInt(s.diamonds))
        push('ERROR', 'STATE_DIAMONDS_INVALID', `钻石 diamonds 非法：${String(s.diamonds)}`);
    // inventory values
    const inv = s.inventory || {};
    for (const [k, v] of Object.entries(inv)) {
        if (!isNonNegInt(v))
            push('ERROR', 'STATE_INVENTORY_VALUE_INVALID', `背包数值非法：${k}=${String(v)}`);
    }
    // heroes array
    const heroes = s.heroes || [];
    const heroIdSet = new Set();
    for (const h of heroes) {
        const id = String(h?.heroId ?? '');
        if (!id) {
            push('ERROR', 'HERO_ID_MISSING', '发现 heroId 为空的英雄条目');
            continue;
        }
        if (heroIdSet.has(id))
            push('WARN', 'HERO_DUPLICATE', `英雄重复拥有（同 heroId 多条记录）：${id}`);
        heroIdSet.add(id);
        const level = Number(h?.level);
        const stars = Number(h?.stars);
        if (!Number.isFinite(level) || level < 1)
            push('WARN', 'HERO_LEVEL_SUSPICIOUS', `英雄等级异常：${id} level=${String(h?.level)}`);
        if (!Number.isFinite(stars) || stars < 1)
            push('WARN', 'HERO_STARS_SUSPICIOUS', `英雄星级异常：${id} stars=${String(h?.stars)}`);
    }
    // party integrity
    const slots = (s.partySlots ?? [null, null, null, null, null]);
    if (!Array.isArray(slots) || slots.length !== 5) {
        push('ERROR', 'PARTY_SLOTS_SHAPE_INVALID', `队伍槽位结构异常：length=${slots?.length}`);
    }
    else {
        const used = new Set();
        slots.forEach((id, idx) => {
            if (!id)
                return;
            if (!heroIdSet.has(id))
                push('ERROR', 'PARTY_HERO_NOT_OWNED', `队伍槽位包含未拥有英雄：slot=${idx + 1} heroId=${id}`);
            if (used.has(id))
                push('WARN', 'PARTY_DUPLICATE', `队伍重复上阵：heroId=${id}`);
            used.add(id);
        });
    }
    // sanity on key consumables
    const tickets = inv['ticket_normal'] ?? 0;
    if (!isNonNegInt(tickets))
        push('ERROR', 'TICKET_INVALID', `召唤券 ticket_normal 非法：${String(tickets)}`);
    const shards = inv['shard_universal'] ?? 0;
    if (!isNonNegInt(shards))
        push('ERROR', 'SHARD_INVALID', `万能碎片 shard_universal 非法：${String(shards)}`);
    // ---------------------------
    // Log-based heuristics (best-effort)
    // ---------------------------
    // These are warnings only; logs may be truncated.
    const logText = game.debug.getText();
    if (logText.includes('handler error'))
        push('WARN', 'LOG_HANDLER_ERROR', '检测到 GameState handler error（可能有 UI 订阅报错）');
    if (logText.includes('NaN'))
        push('WARN', 'LOG_NAN', '日志中出现 NaN 字样（可能存在数值计算异常）');
    const errors = items.filter((i) => i.level === 'ERROR').length;
    const warnings = items.filter((i) => i.level === 'WARN').length;
    return {
        time,
        version,
        summary: { errors, warnings },
        items,
        snapshot: {
            stage: s.stage,
            gold: s.gold,
            diamonds: s.diamonds,
            heroes: (s.heroes || []).length,
            partyFilled: (s.partySlots || []).filter(Boolean).length,
            inventoryKeys: Object.keys(inv).length,
        },
    };
}
export function formatDiagnosticReport(r) {
    const lines = [];
    lines.push('=== DIAGNOSTICS REPORT ===');
    lines.push(`Time: ${r.time}`);
    lines.push(`Version: ${r.version}`);
    lines.push(`Snapshot: stage=${r.snapshot.stage} gold=${r.snapshot.gold} diamonds=${r.snapshot.diamonds} heroes=${r.snapshot.heroes} party=${r.snapshot.partyFilled}/5 invKeys=${r.snapshot.inventoryKeys}`);
    lines.push('');
    lines.push(`Summary: errors=${r.summary.errors} warnings=${r.summary.warnings}`);
    lines.push('');
    if (r.items.length === 0) {
        lines.push('✅ 未发现确定性异常（本地规则检查通过）');
    }
    else {
        for (const it of r.items) {
            lines.push(`[${it.level}] ${it.code}: ${it.message}`);
            if (it.details != null) {
                try {
                    lines.push(`  details: ${JSON.stringify(it.details)}`);
                }
                catch {
                    // ignore
                }
            }
        }
    }
    return lines.join('\n');
}
