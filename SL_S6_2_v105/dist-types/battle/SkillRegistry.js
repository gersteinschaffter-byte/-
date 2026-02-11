/**
 * Central registries to avoid if-else chains.
 *
 * In later phases, these can be loaded from JSON config.
 */
export class SkillRegistry {
    constructor() {
        Object.defineProperty(this, "skills", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    register(skill) {
        this.skills.set(skill.id, skill);
    }
    get(id) {
        return this.skills.get(id);
    }
}
export class BuffRegistry {
    constructor() {
        Object.defineProperty(this, "buffs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    register(buff) {
        this.buffs.set(buff.id, buff);
    }
    get(id) {
        return this.buffs.get(id);
    }
}
