import { ECONOMY, STORAGE_KEY } from './config';
export function defaultState() {
    return {
        version: 1,
        diamonds: 1500,
        gold: 4000,
        stage: 1,
        inventory: {
            [ECONOMY.summonTicketKey]: 5,
            exp_small: 10,
            [ECONOMY.dupeShardKey]: 0,
        },
        heroes: [],
        partyHeroIds: [],
        partySlots: [null, null, null, null, null],
        lastLoginAt: Date.now(),
        // AI Director (enabled by default; if no key or request fails, we fall back to local templates)
        directorEnabled: true,
        directorModel: 'deepseek-chat',
        directorStage: 0,
        directorDirective: null,
    };
}
function normalizePartyIds(input) {
    if (!Array.isArray(input))
        return [];
    return Array.from(new Set(input.filter((x) => typeof x === 'string' && String(x).trim()).map((x) => String(x)))).slice(0, 5);
}
function normalizePartySlots(input, fallbackIds) {
    const rawSlots = Array.isArray(input) ? input : null;
    const slots = Array.from({ length: 5 }, (_, i) => {
        const v = rawSlots ? rawSlots[i] : fallbackIds[i];
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
export function loadStateFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return defaultState();
        const s = JSON.parse(raw);
        if (!s || typeof s !== 'object')
            return defaultState();
        // Normalize inventory first (and allow safe migration edits).
        const inventory = (s.inventory ?? {}) ?? {};
        // Stage migration (legacy): some builds stored stage in inventory['battle_stage'].
        const legacyStageRaw = inventory['battle_stage'];
        const legacyStage = Number(legacyStageRaw ?? 0);
        // New persisted stage field.
        let stage = Number(s.stage ?? 1);
        if (!Number.isFinite(stage) || stage < 1)
            stage = 1;
        stage = Math.floor(stage);
        if (Number.isFinite(legacyStage) && legacyStage > 0) {
            stage = Math.max(stage, Math.floor(legacyStage));
            // Clean legacy key so it won't pollute inventory/Bag UI.
            delete inventory['battle_stage'];
        }
        const partyHeroIds = normalizePartyIds(s.partyHeroIds);
        const partySlots = normalizePartySlots(s.partySlots, partyHeroIds);
        const normalized = {
            version: Number(s.version ?? 1),
            diamonds: Number(s.diamonds ?? 0),
            gold: Number(s.gold ?? 0),
            stage,
            inventory,
            heroes: (s.heroes ?? []),
            partyHeroIds: partySlots.filter((id) => !!id),
            partySlots,
            lastLoginAt: Number(s.lastLoginAt ?? Date.now()),
            directorEnabled: Boolean(s.directorEnabled ?? true),
            directorModel: (s.directorModel === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat'),
            directorStage: Math.max(0, Math.floor(Number(s.directorStage ?? 0) || 0)),
            directorDirective: s.directorDirective ?? null,
        };
        return normalized;
    }
    catch (e) {
        console.warn('loadState failed', e);
        return defaultState();
    }
}
export function saveStateToStorage(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    catch (e) {
        console.warn('saveState failed', e);
    }
}
export function resetStorage() {
    localStorage.removeItem(STORAGE_KEY);
}
