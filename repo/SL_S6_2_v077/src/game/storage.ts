import { ECONOMY, STORAGE_KEY } from './config';

export interface OwnedHero {
  heroId: string;
  level: number;
  stars: number;
  obtainedAt: number;
}

export interface PersistedState {
  version: number;
  diamonds: number;
  gold: number;
  /**
   * Player progress stage (1-based).
   *
   * v0.0.8+: stage is a first-class field (migrated from legacy inventory key).
   */
  stage: number;
  inventory: Record<string, number>;
  heroes: OwnedHero[];
  /**
   * Party hero ids (max 5, no duplicates).
   * v0.0.19+: first-class field.
   */
  partyHeroIds: string[];
  lastLoginAt: number;
}

export function defaultState(): PersistedState {
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
    lastLoginAt: Date.now(),
  };
}

export function loadStateFromStorage(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw) as Partial<PersistedState>;
    if (!s || typeof s !== 'object') return defaultState();

    // Normalize inventory first (and allow safe migration edits).
    const inventory = ((s.inventory ?? {}) as Record<string, number>) ?? {};

    // Stage migration (legacy): some builds stored stage in inventory['battle_stage'].
    const legacyStageRaw = (inventory as any)['battle_stage'];
    const legacyStage = Number(legacyStageRaw ?? 0);

    // New persisted stage field.
    let stage = Number((s as any).stage ?? 1);
    if (!Number.isFinite(stage) || stage < 1) stage = 1;
    stage = Math.floor(stage);

    if (Number.isFinite(legacyStage) && legacyStage > 0) {
      stage = Math.max(stage, Math.floor(legacyStage));
      // Clean legacy key so it won't pollute inventory/Bag UI.
      delete (inventory as any)['battle_stage'];
    }

    const partyHeroIdsRaw = (s as any).partyHeroIds;
    const partyHeroIds = Array.isArray(partyHeroIdsRaw)
      ? Array.from(
          new Set(
            (partyHeroIdsRaw as any[])
              .filter((x) => typeof x === "string" && String(x).trim())
              .map((x) => String(x)),
          ),
        ).slice(0, 5)
      : [];

    const normalized: PersistedState = {
      version: Number(s.version ?? 1),
      diamonds: Number(s.diamonds ?? 0),
      gold: Number(s.gold ?? 0),
      stage,
      inventory,
      heroes: (s.heroes ?? []) as OwnedHero[],
      partyHeroIds,
      lastLoginAt: Number(s.lastLoginAt ?? Date.now()),
    };
    return normalized;
  } catch (e) {
    console.warn('loadState failed', e);
    return defaultState();
  }
}

export function saveStateToStorage(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('saveState failed', e);
  }
}

export function resetStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
