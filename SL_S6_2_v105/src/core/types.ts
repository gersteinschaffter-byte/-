import type { Container } from 'pixi.js';

/**
 * Basic scene lifecycle.
 *
 * We keep the interface minimal in phase 1 so we can migrate existing
 * MVP logic with fewer changes. Later phases can extend it without
 * breaking scenes (Open/Closed Principle).
 */
export interface IScene {
  /** Root container that will be attached to the SceneLayer. */
  readonly root: Container;

  /** Unique scene key (e.g. "home", "summon"). */
  readonly name: string;

  /** Optional asset bundle name for this scene (loaded via AssetLoader). */
  readonly bundle?: string;

  /** Called when the scene becomes active. */
  onEnter(): void | Promise<void>;

  /** Called when the scene is removed from stage. */
  onExit(): void;

  /** Called when virtual viewport size changes (virtual coords). */
  onResize(width: number, height: number): void;

  /** Called every tick (dt is PIXI ticker delta). */
  onUpdate(dt: number): void;
}

export type SceneKey = 'home' | 'summon' | 'heroes' | 'bag' | 'battle' | 'formation';
