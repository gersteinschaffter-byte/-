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
};
export const ECONOMY = economyJson;
/** Battle tuning parameters (logic-only). */
export const BATTLE = battleJson;
/** Summon pool definitions (UI text/cost keys). */
export const POOLS = poolsJson;
export const ELEMENTS = ['火', '水', '风', '光', '暗'];
