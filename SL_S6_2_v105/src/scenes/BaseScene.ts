import { Container } from 'pixi.js';
import type { IScene } from '../core/types';

/**
 * A minimal scene base class.
 *
 * Phase 1 uses this base to keep parity with the original MVP structure.
 */
export default abstract class BaseScene implements IScene {
  public readonly name: string;
  public readonly root: Container;

  protected constructor(name: string) {
    this.name = name;
    this.root = new Container();
    this.root.name = `SceneRoot(${name})`;
  }

  public onEnter(): void {
    // optional
  }

  public onExit(): void {
    // optional
  }

  public onResize(_width: number, _height: number): void {
    // optional
  }

  public onUpdate(_dt: number): void {
    // optional
  }
}
