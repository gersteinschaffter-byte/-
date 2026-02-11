import type { Element, Profession, Rarity } from './config';
import { ELEMENTS, PROFESSION, RARITY } from './config';

// Configs are JSON so balancing/content updates don't require touching TS logic.
import heroesJson from '../configs/heroes.json';
import summonProbJson from '../configs/summon_prob.json';

export interface HeroDef {
  id: string;
  name: string;
  rarity: Rarity;
  element: Element;
  skills?: string[];
  profession: Profession;
}

// 50 heroes, placeholders (no IP). Loaded from JSON for easy content iteration.
export const HEROES: HeroDef[] = (heroesJson as unknown as HeroDef[]).map((h) => ({
  ...h,
  // Ensure we always use canonical rarity values.
  rarity: (RARITY as any)[(h as any).rarity] ?? (h as any).rarity,
  profession: (Object.values(PROFESSION) as string[]).includes((h as any).profession)
    ? (h as any).profession
    : PROFESSION.WARRIOR,
})) as HeroDef[];

export const HERO_MAP: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export function groupByRarity(): Record<Rarity, HeroDef[]> {
  const map: Record<Rarity, HeroDef[]> = {
    [RARITY.R]: [],
    [RARITY.SR]: [],
    [RARITY.SSR]: [],
    [RARITY.SP]: [],
  };
  for (const h of HEROES) map[h.rarity].push(h);
  return map;
}

export const HERO_BY_RARITY = groupByRarity();

// Probability table for summon. Loaded from JSON for easy balancing.
export const SUMMON_PROB: Array<{ rarity: Rarity; p: number }> = (summonProbJson as any).map((it: any) => ({
  rarity: (RARITY as any)[it.rarity] ?? it.rarity,
  p: it.p,
}));

export { ELEMENTS };
