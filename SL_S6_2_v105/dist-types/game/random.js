import { RARITY } from './config';
import { SUMMON_PROB } from './data';
export function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
export function pickRarityByProb() {
    const r = Math.random() * 100;
    let acc = 0;
    for (const it of SUMMON_PROB) {
        acc += it.p;
        if (r <= acc)
            return it.rarity;
    }
    return RARITY.R;
}
