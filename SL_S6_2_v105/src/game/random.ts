import type { Rarity } from './config';
import { RARITY } from './config';
import { SUMMON_PROB } from './data';

export function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function pickRarityByProb(): Rarity {
  const r = Math.random() * 100;
  let acc = 0;
  for (const it of SUMMON_PROB) {
    acc += it.p;
    if (r <= acc) return it.rarity;
  }
  return RARITY.R;
}
