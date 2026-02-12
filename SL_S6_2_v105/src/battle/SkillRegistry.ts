import type { Buff, BuffId, Skill, SkillId } from './SkillTypes';

/**
 * Central registries to avoid if-else chains.
 *
 * In later phases, these can be loaded from JSON config.
 */
export class SkillRegistry {
  private readonly skills = new Map<SkillId, Skill>();

  public register(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  public get(id: SkillId): Skill | undefined {
    return this.skills.get(id);
  }
}

export class BuffRegistry {
  private readonly buffs = new Map<BuffId, Buff>();

  public register(buff: Buff): void {
    this.buffs.set(buff.id, buff);
  }

  public get(id: BuffId): Buff | undefined {
    return this.buffs.get(id);
  }
}
