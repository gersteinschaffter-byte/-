/**
 * HeroStatsCalculator - Unified hero stats calculation
 * 
 * Consolidates stats calculation logic from BattleScene and HeroesScene
 * to ensure consistency and reduce code duplication.
 */

import { RARITY } from './config';

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

/**
 * Calculate base hero stats without any bonuses
 */
export function calculateBaseStats(level: number, rarity: string): HeroStats {
  const lv = Math.max(1, Math.floor(level));
  const base = RARITY_MULT[rarity] ?? 1.0;
  
  return {
    hp: Math.round(200 * base + lv * 40 * base),
    atk: Math.round(30 * base + lv * 8 * base),
    def: Math.round((10 + lv * 1.4) * base),
    spd: Math.round(90 + lv * 1),
  };
}

/**
 * Calculate hero stats with star bonus applied
 */
export function calculateHeroStats(level: number, rarity: string, stars: number): HeroStats {
  const baseStats = calculateBaseStats(level, rarity);
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
