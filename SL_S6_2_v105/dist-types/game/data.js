import { ELEMENTS, RARITY } from './config';
// Configs are JSON so balancing/content updates don't require touching TS logic.
import heroesJson from '../configs/heroes.json';
import summonProbJson from '../configs/summon_prob.json';
// 50 heroes, placeholders (no IP). Loaded from JSON for easy content iteration.
export const HEROES = heroesJson.map((h) => ({
    ...h,
    // Ensure we always use canonical rarity values.
    rarity: RARITY[h.rarity] ?? h.rarity,
}));
export const HERO_MAP = Object.fromEntries(HEROES.map((h) => [h.id, h]));
export function groupByRarity() {
    const map = {
        [RARITY.R]: [],
        [RARITY.SR]: [],
        [RARITY.SSR]: [],
        [RARITY.SP]: [],
    };
    for (const h of HEROES)
        map[h.rarity].push(h);
    return map;
}
export const HERO_BY_RARITY = groupByRarity();
// Probability table for summon. Loaded from JSON for easy balancing.
export const SUMMON_PROB = summonProbJson.map((it) => ({
    rarity: RARITY[it.rarity] ?? it.rarity,
    p: it.p,
}));
export { ELEMENTS };
