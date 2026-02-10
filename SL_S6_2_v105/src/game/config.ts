// JSON-driven configs (Vite + TS resolveJsonModule). Keeping constants to avoid changing call sites.
import economyJson from '../configs/economy.json';
import battleJson from '../configs/battle.json';
import poolsJson from '../configs/pools.json';

/** Virtual design resolution (portrait). */
export const VIRTUAL_W = 750;
export const VIRTUAL_H = 1334;

/** localStorage key for MVP save data. */
export const STORAGE_KEY = 'mvp_shininglike_v1';

export const RARITY = {
  R: 'R',
  SR: 'SR',
  SSR: 'SSR',
  SP: 'SP',
} as const;

export type Rarity = (typeof RARITY)[keyof typeof RARITY];

export const ECONOMY = economyJson as Readonly<typeof economyJson>;

/** Battle tuning parameters (logic-only). */
export const BATTLE = battleJson as Readonly<typeof battleJson>;

/** Summon pool definitions (UI text/cost keys). */
export const POOLS = poolsJson as Readonly<typeof poolsJson>;

export const ELEMENTS = ['火', '水', '风', '光', '暗'] as const;
export type Element = (typeof ELEMENTS)[number];
