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
  /**
   * Fixed party slots (length 5, no duplicates).
   * v0.0.77+: slot-based formation.
   */
  partySlots: Array<string | null>;
  lastLoginAt: number;

  /**
   * AI Director settings & cached directive for current stage.
   *
   * IMPORTANT: API key is NEVER persisted here (it stays in sessionStorage).
   */
  directorEnabled: boolean;
  directorModel: 'deepseek-chat' | 'deepseek-reasoner';
  directorStage: number;
  directorDirective: any | null;
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
    partySlots: [null, null, null, null, null],
    lastLoginAt: Date.now(),

    // AI Director (enabled by default; if no key or request fails, we fall back to local templates)
    directorEnabled: true,
    directorModel: 'deepseek-chat',
    directorStage: 0,
    directorDirective: null,
  };
}

function normalizePartyIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.filter((x) => typeof x === 'string' && String(x).trim()).map((x) => String(x)),
    ),
  ).slice(0, 5);
}

function normalizePartySlots(input: unknown, fallbackIds: string[]): Array<string | null> {
  const rawSlots = Array.isArray(input) ? input : null;
  const slots = Array.from({ length: 5 }, (_, i) => {
    const v = rawSlots ? rawSlots[i] : fallbackIds[i];
    return typeof v === 'string' && String(v).trim() ? String(v) : null;
  });
  const seen = new Set<string>();
  return slots.map((id) => {
    if (!id) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    return id;
  });
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

    const partyHeroIds = normalizePartyIds((s as any).partyHeroIds);
    const partySlots = normalizePartySlots((s as any).partySlots, partyHeroIds);

    const normalized: PersistedState = {
      version: Number(s.version ?? 1),
      diamonds: Number(s.diamonds ?? 0),
      gold: Number(s.gold ?? 0),
      stage,
      inventory,
      heroes: (s.heroes ?? []) as OwnedHero[],
      partyHeroIds: partySlots.filter((id): id is string => !!id),
      partySlots,
      lastLoginAt: Number(s.lastLoginAt ?? Date.now()),

      directorEnabled: Boolean((s as any).directorEnabled ?? true),
      directorModel: ((s as any).directorModel === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat'),
      directorStage: Math.max(0, Math.floor(Number((s as any).directorStage ?? 0) || 0)),
      directorDirective: (s as any).directorDirective ?? null,
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
