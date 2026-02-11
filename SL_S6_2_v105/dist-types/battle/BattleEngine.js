import BattleLogic from './BattleLogic';
import BattleView from './BattleView';
import { registerAllSkillsAndBuffs } from './SkillDefs';
import { BattleStatsCollector } from './BattleStats';
/**
 * BattleEngine
 *
 * Orchestrates the battle by:
 * - creating BattleLogic (simulation)
 * - forwarding logic events to BattleView (presentation)
 * - controlling step cadence so animations can be seen
 */
export default class BattleEngine {
    constructor(opts = {}) {
        Object.defineProperty(this, "view", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "logic", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "stats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new BattleStatsCollector()
        });
        // Step pacing (in ticks). Smaller = faster.
        Object.defineProperty(this, "stepIntervalTicks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "stepAcc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // Speed multiplier (affects both simulation cadence and animation playback).
        // 1.0 = normal; <1 slower; >1 faster.
        Object.defineProperty(this, "speed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        // Keep a lightweight event log for potential replay (phase 4+).
        Object.defineProperty(this, "log", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.stepIntervalTicks = opts.stepIntervalTicks ?? 44;
        this.view = new BattleView();
        this.logic = new BattleLogic(this);
        // Populate skill & buff registries from JSON config.
        registerAllSkillsAndBuffs(this.logic.skillRegistry, this.logic.buffRegistry);
    }
    /** Set battle speed multiplier. Clamped to a sane range. */
    setSpeed(mult) {
        const m = Number.isFinite(mult) ? mult : 1;
        this.speed = Math.max(0.5, Math.min(4, m));
    }
    getSpeed() {
        return this.speed;
    }
    /** Start a new battle and reset internal pacing. */
    start(setup) {
        this.log.length = 0;
        this.stepAcc = 0;
        this.logic.init(setup);
    }
    /**
     * Update engine each tick.
     * - advances animations (view)
     * - advances simulation at a fixed cadence
     */
    update(dt) {
        const scaledDt = dt * this.speed;
        this.view.update(scaledDt);
        if (this.logic.isOver())
            return;
        this.stepAcc += scaledDt;
        if (this.stepAcc >= this.stepIntervalTicks) {
            this.stepAcc = 0;
            this.logic.step();
        }
    }
    emit(e) {
        this.log.push(e);
        // Reset stats before forwarding battleStart
        if (e.type === 'battleStart') {
            this.stats.reset(e.payload.teamA, e.payload.teamB);
            this.view.build(e.payload.teamA, e.payload.teamB);
        }
        this.stats.onEvent(e);
        this.view.onEvent(e);
    }
    /** Retrieve a snapshot of emitted events. Useful for debugging or replay. */
    getEventLog() {
        return [...this.log];
    }
}
