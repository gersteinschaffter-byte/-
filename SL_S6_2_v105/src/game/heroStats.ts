/**
 * HeroStatsCalculator - Unified hero stats calculation
 *
 * Consolidates stats calculation logic from BattleScene and HeroesScene
 * to ensure consistency and reduce code duplication.
 */

import { PROFESSION, RARITY } from './config';
import type { Profession } from './config';

export interface HeroStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

// Stats multipliers by rarity (matches both BattleScene and HeroesScene)
const RARITY_MULT: Record<string, number> = {
  [RARITY.R]: 1.0,
  [RARITY.SR]: 1.25,
  [RARITY.SSR]: 1.6,
  [RARITY.SP]: 2.0,
};

const PROFESSION_MULT: Record<Profession, HeroStats> = {
  [PROFESSION.WARRIOR]: { hp: 1.08, atk: 1.08, def: 1.05, spd: 1.0 },
  [PROFESSION.TANK]: { hp: 1.25, atk: 0.85, def: 1.22, spd: 0.94 },
  [PROFESSION.SUPPORT]: { hp: 1.0, atk: 0.88, def: 1.0, spd: 1.06 },
  [PROFESSION.MAGE]: { hp: 0.9, atk: 1.2, def: 0.92, spd: 1.02 },
  [PROFESSION.ASSASSIN]: { hp: 0.82, atk: 1.3, def: 0.82, spd: 1.16 },
};

function getProfessionMult(profession?: Profession): HeroStats {
  if (!profession) return PROFESSION_MULT[PROFESSION.WARRIOR];
  return PROFESSION_MULT[profession] ?? PROFESSION_MULT[PROFESSION.WARRIOR];
}

/**
 * Calculate base hero stats without any bonuses
 */
export function calculateBaseStats(level: number, rarity: string, profession?: Profession): HeroStats {
  const lv = Math.max(1, Math.floor(level));
  const base = RARITY_MULT[rarity] ?? 1.0;
  const p = getProfessionMult(profession);

  return {
    hp: Math.round((200 * base + lv * 40 * base) * p.hp),
    atk: Math.round((30 * base + lv * 8 * base) * p.atk),
    def: Math.round(((10 + lv * 1.4) * base) * p.def),
    spd: Math.round((90 + lv * 1) * p.spd),
  };
}

/**
 * Calculate hero stats with star bonus applied
 */
export function calculateHeroStats(level: number, rarity: string, stars: number, profession?: Profession): HeroStats {
  const baseStats = calculateBaseStats(level, rarity, profession);
  const actualStars = Math.max(1, stars || 0);
  const starMult = 1 + 0.1 * (actualStars - 1);

  return {
    hp: Math.round(baseStats.hp * starMult),
    atk: Math.round(baseStats.atk * starMult),
    def: Math.round(baseStats.def * starMult),
    spd: baseStats.spd, // Speed is not affected by stars
  };
}

/**
 * Calculate enemy stats (for battle generation)
 */
export function calculateEnemyStats(level: number, rarity: string, index: number): HeroStats {
  const lv = Math.max(1, Math.floor(level));
  const base = (RARITY_MULT[rarity] ?? 1.0) * 0.95;
  const slotMul = 1 + (index - 1) * 0.06; // -6%, 0%, +6%

  return {
    hp: Math.round((220 * base + lv * 42 * base) * slotMul),
    atk: Math.round((28 * base + lv * 7.5 * base) * slotMul),
    def: Math.round((8 + lv * 1.1) * base),
    spd: Math.round(88 + lv * 1 + index),
  };
}
