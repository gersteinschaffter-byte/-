import type { BattleEventEmitter, BattleSetup, FighterSnapshot, Side } from './BattleTypes';
import type { SkillRuntimeAPI } from './SkillTypes';
import { BATTLE } from '../game/config';
import SkillSystem from './SkillSystem';
import BuffSystem from './BuffSystem';
import { SkillRegistry, BuffRegistry } from './SkillRegistry';
import { getBuffJson, getSkillName } from './SkillDefs';

/**
 * BattleLogic — pure simulation layer (no Pixi).
 *
 * Architecture:
 * - Per-actor stepping (one action per step()) for paced animation.
 * - Skill system: passive triggers (chance-based) + active skills (CD-based).
 * - Buff stat mods: atkPct/atkFlat, defFlat/defPct, dmgReduce, spdFlat.
 * - DoT ticks at configurable granularity (per-round or per-turn).
 * - Elemental advantage system (5-element cycle + light/dark mutual).
 * - O(1) fighter lookup via fighterMap.
 */

/* ── Elemental advantage table ───────────────────────────
 *   火 → 风 (1.3x)   水 → 火 (1.3x)   风 → 水 (1.3x)
 *   光 ↔ 暗 (1.25x mutual)
 *   Being countered = 0.8x (inverse of advantage)
 *   Neutral = 1.0x
 */
const ELEMENT_ADVANTAGE: Record<string, Record<string, number>> = {
  '火': { '风': 1.3, '水': 0.8 },
  '水': { '火': 1.3, '风': 0.8 },
  '风': { '水': 1.3, '火': 0.8 },
  '光': { '暗': 1.25 },
  '暗': { '光': 1.25 },
};

function getElementMultiplier(attackerElement?: string, defenderElement?: string): number {
  if (!attackerElement || !defenderElement || attackerElement === defenderElement) return 1;
  return ELEMENT_ADVANTAGE[attackerElement]?.[defenderElement] ?? 1;
}

export default class BattleLogic {
  private readonly emitter: BattleEventEmitter;
  private readonly rng: () => number;

  // Public so BattleEngine can register skills/buffs from JSON config.
  public readonly skillRegistry = new SkillRegistry();
  public readonly buffRegistry = new BuffRegistry();
  private readonly skillSystem = new SkillSystem(this.skillRegistry);
  private readonly buffSystem = new BuffSystem(this.buffRegistry);

  private round = 0;
  private over = false;

  // Step state: we advance one actor action per step() for clear pacing.
  private phase: 'idle' | 'turns' = 'idle';
  private turnOrder: string[] = [];
  private turnIndex = 0;

  private teamA: FighterSnapshot[] = [];
  private teamB: FighterSnapshot[] = [];
  /** O(1) lookup map — rebuilt on init(). */
  private fighterMap = new Map<string, FighterSnapshot>();

  /** Active skill cooldowns per fighter (skillId -> remaining turns). */
  private skillCooldowns = new Map<string, Record<string, number>>();

  constructor(emitter: BattleEventEmitter, rng?: () => number) {
    this.emitter = emitter;
    this.rng = rng ?? Math.random;
  }

  public init(setup: BattleSetup): void {
    this.round = 0;
    this.over = false;
    this.phase = 'idle';
    this.turnOrder = [];
    this.turnIndex = 0;
    this.teamA = setup.teamA.map((f) => ({ ...f, shield: Math.max(0, Math.floor(f.shield ?? 0)), maxShield: Math.max(1, Math.floor(f.maxShield ?? f.maxHp ?? 1)) }));
    this.teamB = setup.teamB.map((f) => ({ ...f, shield: Math.max(0, Math.floor(f.shield ?? 0)), maxShield: Math.max(1, Math.floor(f.maxShield ?? f.maxHp ?? 1)) }));
    this.fighterMap = new Map<string, FighterSnapshot>();
    for (const f of [...this.teamA, ...this.teamB]) this.fighterMap.set(f.id, f);
    this.skillCooldowns = new Map();
    for (const f of [...this.teamA, ...this.teamB]) {
      this.skillCooldowns.set(f.id, {});
    }
    this.buffSystem.init([...this.teamA, ...this.teamB]);

    this.emitter.emit({
      type: 'battleStart',
      payload: {
        teamA: this.teamA.map((f) => ({ ...f })),
        teamB: this.teamB.map((f) => ({ ...f })),
      },
    });

    // onBattleStart skill triggers (e.g. warcry).
    const api = this.getSkillApi();
    for (const f of [...this.teamA, ...this.teamB]) {
      this.emitSkillFired(f.id, this.skillSystem.tryTrigger('onBattleStart', f, { round: 0, actorId: f.id }, api));
    }
  }

  public runToEnd(maxRounds = 30): void {
    // Safety runner for debugging: keep stepping until battle ends or maxRounds reached.
    // With per-actor stepping, cap total steps by an upper bound.
    const maxSteps = maxRounds * 32; // enough for typical party sizes
    for (let i = 0; i < maxSteps && !this.over; i++) this.step();
    if (!this.over) this.finish('Draw');
  }

  /**
   * Advance simulation by ONE actor action.
   * Each step performs:
   * - (when starting a new round) roundStart + DoT + onRoundStart skills + build turn order
   * - (during turns) a single actorTurn (onTurnStart skills + basic attack + resulting buffs)
   */
  public step(): void {
    if (this.over) return;

    // Start a new round if needed.
    if (this.phase === 'idle' || this.turnIndex >= this.turnOrder.length) {
      this.beginRound();
      // beginRound may end the battle (DoT / aura etc.)
      if (this.over) return;
    }

    // Execute exactly one alive actor action per step.
    while (this.turnIndex < this.turnOrder.length && !this.over) {
      const actorId = this.turnOrder[this.turnIndex++];
      const actor = this.findFighter(actorId);
      if (!actor || actor.hp <= 0) continue;

      const api = this.getSkillApi();
      this.emitter.emit({ type: 'actorTurn', payload: { round: this.round, actorId: actor.id } });

      // 0) Active skill cooldowns tick down once per actor action.
      this.tickCooldowns(actor.id);

      // 1) Turn-start DoT ticks (poison-per-turn, etc.)
      this.applyBuffDotsFor(actor.id, 'turn');
      this.checkBattleEnd();
      if (this.over) break;

      // 2) Active skill check (cooldown-based "big moves").
      const activeSkillId = this.tryPerformActiveSkill(actor);
      if (activeSkillId) {
        this.emitSkillFired(actor.id, [activeSkillId]);
      } else {
        // 3) Passive onTurnStart skills (chance-based).
        const firedOnTurnStart = this.skillSystem.tryTrigger('onTurnStart', actor, { round: this.round, actorId: actor.id }, api);
        this.emitSkillFired(actor.id, firedOnTurnStart);

        // 4) If no skill fired, fall back to a basic attack.
        if (firedOnTurnStart.length === 0) {
          this.performBasicAttack(actor);
        }
      }

      this.checkBattleEnd();
      break; // Only one actor action per step.
    }

    // If we exhausted the turn list, next step will begin a new round.
    if (!this.over && this.turnIndex >= this.turnOrder.length) {
      this.phase = 'idle';
      if (this.round >= 30) this.finish('Draw');
    }
  }

  public isOver(): boolean { return this.over; }
  public getRound(): number { return this.round; }

  // ── Round orchestration ──────────────────────────

  private beginRound(): void {
    if (this.over) return;

    this.round += 1;
    this.emitter.emit({ type: 'roundStart', payload: { round: this.round } });
    this.buffSystem.onRoundStart(this.round);

    // DoT ticks (poison etc.)
    this.applyBuffDots();
    this.checkBattleEnd();
    if (this.over) return;

    // onRoundStart skill triggers (e.g. aura heal)
    const api = this.getSkillApi();
    for (const f of this.getAllAlive()) {
      this.emitSkillFired(f.id, this.skillSystem.tryTrigger('onRoundStart', f, { round: this.round, actorId: f.id }, api));
    }
    this.checkBattleEnd();
    if (this.over) return;

    // Sort by effective SPD (buff-aware) and store turn order for this round.
    this.turnOrder = this.getAllAlive()
      .sort((a, b) => this.getEffectiveSpd(b) - this.getEffectiveSpd(a) || a.id.localeCompare(b.id))
      .map((f) => f.id);
    this.turnIndex = 0;
    this.phase = 'turns';
  }


  // ── Attack ─────────────────────────────────────────

  private performBasicAttack(actor: FighterSnapshot): void {
    const enemyTeam = actor.side === 'A' ? this.teamB : this.teamA;
    const targets = enemyTeam.filter((t) => t.hp > 0);
    if (targets.length === 0) return;

    const target = this.chooseTarget(actor, targets);
    const api = this.getSkillApi();

    this.emitSkillFired(actor.id, this.skillSystem.tryTrigger('onBeforeAttack', actor, { round: this.round, actorId: actor.id, targetId: target.id }, api));

    // Damage = (effectiveATK × variance - effectiveDEF × 0.3) × elementMult, then reduced by dmgReduce buffs.
    const variance = BATTLE.damageVarianceMin + this.rng() * (BATTLE.damageVarianceMax - BATTLE.damageVarianceMin);
    const effectiveAtk = this.getEffectiveAtk(actor);
    const effectiveDef = this.getEffectiveDef(target);
    const elementMult = getElementMultiplier(actor.element, target.element);
    const rawDmg = Math.floor((effectiveAtk * variance - effectiveDef * 0.3) * elementMult);
    const reduction = this.getDmgReduction(target);
    const dmg = Math.max(1, Math.floor(rawDmg * (1 - reduction)));

    this.emitSkillFired(actor.id, this.skillSystem.tryTrigger('onBeforeDamage', actor, { round: this.round, actorId: actor.id, targetId: target.id }, api));
    this.dealDamage(actor.id, target.id, dmg, elementMult !== 1 ? elementMult : undefined);
    this.emitSkillFired(actor.id, this.skillSystem.tryTrigger('onAfterDamage', actor, { round: this.round, actorId: actor.id, targetId: target.id }, api));
    this.emitSkillFired(actor.id, this.skillSystem.tryTrigger('onAfterAttack', actor, { round: this.round, actorId: actor.id, targetId: target.id }, api));
  }

  /**
   * Active skill flow:
   * - Each fighter can have 0+ active skills with cooldownTurns.
   * - If any active skill is off cooldown, we cast the highest priority one and consume the action.
   */
  private tryPerformActiveSkill(actor: FighterSnapshot): string | undefined {
    const skillIds = actor.skills ?? [];
    if (skillIds.length === 0) return undefined;
    const cds = this.skillCooldowns.get(actor.id) ?? {};

    const candidates: { id: string; prio: number; cd: number }[] = [];
    for (const id of skillIds) {
      const s = this.skillRegistry.get(id);
      if (!s || s.mode !== 'active') continue;
      const cdTurns = Math.max(1, s.cooldownTurns ?? 3);
      const remaining = cds[id] ?? 0;
      if (remaining > 0) continue;
      candidates.push({ id, prio: s.priority ?? 0, cd: cdTurns });
    }

    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => b.prio - a.prio || a.id.localeCompare(b.id));
    const chosen = candidates[0]!;

    // Provide a reasonable default targetId so "current"-target skills behave like attacks.
    const enemyTeam = actor.side === 'A' ? this.teamB : this.teamA;
    const targets = enemyTeam.filter((t) => t.hp > 0);
    const target = targets.length > 0 ? this.chooseTarget(actor, targets) : undefined;

    const api = this.getSkillApi();
    const ok = this.skillSystem.executeSkill(chosen.id, actor, { round: this.round, actorId: actor.id, targetId: target?.id }, api);
    if (!ok) return undefined;

    // Put skill on cooldown.
    cds[chosen.id] = chosen.cd;
    this.skillCooldowns.set(actor.id, cds);
    return chosen.id;
  }

  private tickCooldowns(actorId: string): void {
    const cds = this.skillCooldowns.get(actorId);
    if (!cds) return;
    for (const k of Object.keys(cds)) {
      if (cds[k] > 0) cds[k] -= 1;
      if (cds[k] <= 0) delete cds[k];
    }
  }

  /**
   * Pick an attack target from alive candidates.
   *
   * Heuristic:
   * - Prefer lowest HP% (finish off weak targets).
   * - If tie, prefer the one with more buffs (sets up future dispel logic).
   * - Stable tie-break by id.
   */
  private chooseTarget(_actor: FighterSnapshot, candidates: FighterSnapshot[]): FighterSnapshot {
    return [...candidates]
      .sort((a, b) => {
        const aHpPct = a.maxHp > 0 ? a.hp / a.maxHp : 0;
        const bHpPct = b.maxHp > 0 ? b.hp / b.maxHp : 0;
        if (aHpPct !== bHpPct) return aHpPct - bHpPct; // ascending

        const aBuffs = this.buffSystem.getBuffs(a.id).length;
        const bBuffs = this.buffSystem.getBuffs(b.id).length;
        if (aBuffs !== bBuffs) return bBuffs - aBuffs; // descending

        return a.id.localeCompare(b.id);
      })[0];
  }

  // ── Skill API (extended) ───────────────────────────

  private getSkillApi(): SkillRuntimeAPI {
    return {
      dealDamage: (s, t, a) => this.dealDamage(s, t, a),
      heal:       (s, t, a) => this.heal(s, t, a),
      addBuff:    (s, t, b, n) => this.addBuff(s, t, b, n ?? 1),
      removeBuff: (t, b) => this.removeBuff(t, b),
      addShield:  (s, t, a) => this.addShield(s, t, a),
      // Extended helpers used by SkillDefs effects.
      getAtk: (id: string) => {
        const f = this.findFighter(id);
        return f ? this.getEffectiveAtk(f) : 0;
      },
      getAliveEnemyIds: (id: string) => {
        const f = this.findFighter(id);
        if (!f) return [];
        return (f.side === 'A' ? this.teamB : this.teamA).filter((t) => t.hp > 0).map((t) => t.id);
      },
      getAliveAllyIds: (id: string) => {
        const f = this.findFighter(id);
        if (!f) return [];
        return (f.side === 'A' ? this.teamA : this.teamB).filter((t) => t.hp > 0).map((t) => t.id);
      },
      getLowestHpAllyId: (id: string) => {
        const f = this.findFighter(id);
        if (!f) return undefined;
        const alive = (f.side === 'A' ? this.teamA : this.teamB).filter((t) => t.hp > 0);
        if (alive.length === 0) return undefined;
        alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
        return alive[0]!.id;
      },
      getCurrentHp: (id: string) => {
        const f = this.findFighter(id);
        return f?.hp ?? 0;
      },
      getMaxHp: (id: string) => {
        const f = this.findFighter(id);
        return f?.maxHp ?? 0;
      },
      getBuffIds: (id: string) => this.buffSystem.getBuffs(id).map((b) => b.id),
    } as any;
  }

  // ── Buff stat helpers ──────────────────────────────

  private getEffectiveAtk(f: FighterSnapshot): number {
    let atk = f.atk;
    for (const bi of this.buffSystem.getBuffs(f.id)) {
      const bdef = getBuffJson(bi.id);
      const mod = bdef?.statMod;
      if (mod?.atkFlat) atk += mod.atkFlat * bi.stacks;
      if (mod?.atkPct) atk = Math.floor(atk * (1 + mod.atkPct * bi.stacks));
    }
    return Math.max(0, Math.floor(atk));
  }

  private getEffectiveDef(f: FighterSnapshot): number {
    let df = f.def ?? 0;
    for (const bi of this.buffSystem.getBuffs(f.id)) {
      const bdef = getBuffJson(bi.id);
      const mod = bdef?.statMod;
      if (mod?.defFlat) df += mod.defFlat * bi.stacks;
      if (mod?.defPct) df = Math.floor(df * (1 + mod.defPct * bi.stacks));
    }
    return Math.max(0, Math.floor(df));
  }

  private getDmgReduction(f: FighterSnapshot): number {
    let r = 0;
    for (const bi of this.buffSystem.getBuffs(f.id)) {
      const def = getBuffJson(bi.id);
      if (def?.statMod?.dmgReduce) r += def.statMod.dmgReduce * bi.stacks;
    }
    return Math.min(0.75, r);
  }

  private getEffectiveSpd(f: FighterSnapshot): number {
    let spd = f.spd;
    for (const bi of this.buffSystem.getBuffs(f.id)) {
      const def = getBuffJson(bi.id);
      if (def?.statMod?.spdFlat) spd += def.statMod.spdFlat * bi.stacks;
    }
    return Math.max(1, spd);
  }

  private applyBuffDots(): void {
    for (const f of this.getAllAlive()) {
      this.applyBuffDotsFor(f.id, 'round');
    }
  }

  private applyBuffDotsFor(fighterId: string, tick: 'round' | 'turn'): void {
    const f = this.findFighter(fighterId);
    if (!f || f.hp <= 0) return;
    for (const bi of this.buffSystem.getBuffs(f.id)) {
      const def = getBuffJson(bi.id);
      const dot = def?.dot;
      const dotTick = dot?.tick ?? 'round';
      if (dot?.hpPct && dotTick === tick) {
        const dmg = Math.max(1, Math.floor(f.maxHp * dot.hpPct * bi.stacks));
        this.dealDamage(f.id, f.id, dmg);
      }
    }
  }

  // ── Skill event emission ────────────────────────────

  private emitSkillFired(actorId: string, firedIds: string[]): void {
    for (const id of firedIds) {
      this.emitter.emit({ type: 'skillUse', payload: { actorId, skillId: id, skillName: getSkillName(id) } });
    }
  }

  // ── Primitives ─────────────────────────────────────

  private findFighter(id: string): FighterSnapshot | undefined {
    return this.fighterMap.get(id);
  }

  private dealDamage(sourceId: string, targetId: string, amount: number, elementBonus?: number): void {
    const target = this.findFighter(targetId);
    if (!target || target.hp <= 0) return;

    const a = Math.max(1, Math.floor(amount));
    const shieldNow = Math.max(0, Math.floor(target.shield ?? 0));
    const absorbed = Math.min(shieldNow, a);
    const rest = Math.max(0, a - absorbed);

    if (absorbed > 0) target.shield = shieldNow - absorbed;
    if (rest > 0) target.hp = Math.max(0, target.hp - rest);

    this.emitter.emit({
      type: 'damage',
      payload: {
        sourceId,
        targetId,
        amount: a,
        absorbed,
        targetHp: target.hp,
        targetMaxHp: target.maxHp,
        targetShield: Math.max(0, Math.floor(target.shield ?? 0)),
        targetMaxShield: Math.max(1, Math.floor(target.maxShield ?? target.maxHp)),
        elementBonus,
      },
    });

    if (target.hp <= 0) this.emitter.emit({ type: 'dead', payload: { targetId } });
  }

  private heal(sourceId: string, targetId: string, amount: number): void {
    const target = this.findFighter(targetId);
    if (!target || target.hp <= 0) return;
    const a = Math.max(1, Math.floor(amount));
    target.hp = Math.min(target.maxHp, target.hp + a);
    this.emitter.emit({
      type: 'heal',
      payload: {
        sourceId,
        targetId,
        amount: a,
        targetHp: target.hp,
        targetMaxHp: target.maxHp,
        targetShield: Math.max(0, Math.floor(target.shield ?? 0)),
        targetMaxShield: Math.max(1, Math.floor(target.maxShield ?? target.maxHp)),
      },
    });
  }

  private addShield(sourceId: string, targetId: string, amount: number): void {
    const target = this.findFighter(targetId);
    if (!target || target.hp <= 0) return;
    const a = Math.max(1, Math.floor(amount));
    const cap = Math.max(1, Math.floor(target.maxShield ?? target.maxHp));
    const before = Math.max(0, Math.floor(target.shield ?? 0));
    const next = Math.min(cap, before + a);
    const gained = Math.max(0, next - before);
    target.shield = next;
    target.maxShield = cap;
    if (gained <= 0) return;
    this.emitter.emit({ type: 'shield', payload: { sourceId, targetId, amount: gained, targetShield: next, targetMaxShield: cap } });
  }

  private addBuff(sourceId: string, targetId: string, buffId: string, stacks = 1): void {
    this.buffSystem.addBuff(sourceId, targetId, buffId, stacks, this.round);
    this.emitter.emit({ type: 'buffAdd', payload: { sourceId, targetId, buffId, stacks } });
  }

  private removeBuff(targetId: string, buffId: string): void {
    this.buffSystem.removeBuff(targetId, buffId);
    this.emitter.emit({ type: 'buffRemove', payload: { targetId, buffId } });
  }

  private checkBattleEnd(): void {
    const aAlive = this.teamA.some((f) => f.hp > 0);
    const bAlive = this.teamB.some((f) => f.hp > 0);
    if (aAlive && bAlive) return;
    if (aAlive && !bAlive) this.finish('A');
    else if (!aAlive && bAlive) this.finish('B');
    else this.finish('Draw');
  }

  private finish(winner: Side | 'Draw'): void {
    if (this.over) return;
    this.over = true;
    this.emitter.emit({ type: 'battleEnd', payload: { winner } });
  }

  private getAllAlive(): FighterSnapshot[] {
    return [...this.teamA, ...this.teamB].filter((f) => f.hp > 0);
  }
}
