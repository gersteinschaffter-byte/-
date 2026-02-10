/**
 * Shared battle types.
 *
 * Phase 4 goal: keep logic and rendering separated.
 * - BattleLogic only deals with these data types.
 * - BattleView only consumes event payloads.
 */

export type Side = 'A' | 'B';

export interface FighterSnapshot {
  id: string;
  name: string;
  side: Side;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** Element type for elemental advantage (火/水/风/光/暗). */
  element?: string;
  /** Skill ids owned by the fighter (Phase 5+). Optional for MVP compatibility. */
  skills?: string[];
  /** Buff ids currently applied (Phase 5+). Optional for MVP compatibility. */
  buffs?: string[];
}

export interface BattleSetup {
  teamA: FighterSnapshot[];
  teamB: FighterSnapshot[];
  seed?: number;
}

export type BattleEvent =
  | { type: 'battleStart'; payload: { teamA: FighterSnapshot[]; teamB: FighterSnapshot[] } }
  | { type: 'roundStart'; payload: { round: number } }
  | { type: 'actorTurn'; payload: { round: number; actorId: string } }
  | { type: 'skillUse'; payload: { actorId: string; skillId: string; skillName: string } }
  | { type: 'heal'; payload: { sourceId: string; targetId: string; amount: number; targetHp: number; targetMaxHp: number } }
  | {
      type: 'damage';
      payload: { sourceId: string; targetId: string; amount: number; targetHp: number; targetMaxHp: number; elementBonus?: number };
    }
  | { type: 'buffAdd'; payload: { sourceId: string; targetId: string; buffId: string; stacks: number } }
  | { type: 'buffRemove'; payload: { targetId: string; buffId: string } }
  | { type: 'dead'; payload: { targetId: string } }
  | { type: 'battleEnd'; payload: { winner: Side | 'Draw' } };


/**
 * Minimal observer used by BattleLogic.
 * We keep it super small to avoid any Pixi dependency.
 */
export interface BattleEventEmitter {
  emit(e: BattleEvent): void;
}
