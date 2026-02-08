import type { IScene } from './types';
import UIManager, { UILayerKey } from './UIManager';
import type AssetLoader from './AssetLoader';

/**
 * SceneManager is responsible for switching between scenes.
 *
 * Phase 1 strategy: keep switching simple (mostly no-animation) to ensure the
 * existing MVP can be moved file-by-file without breaking.
 *
 * Later phases can extend this class with:
 * - transition animations
 * - scene stack (push/pop)
 * - async preload hooks
 */
export default class SceneManager {
  private readonly ui: UIManager;
  private readonly assets: AssetLoader;
  private current: IScene | null = null;
  private currentBundle: string | null = null;

  constructor(ui: UIManager, assets: AssetLoader) {
    this.ui = ui;
    this.assets = assets;
  }

  public getCurrent(): IScene | null {
    return this.current;
  }

  /**
   * Switch to another scene.
   * @param next Scene instance
   * @param opts animate is reserved for later (phase 1 keeps it false by default)
   */
  public changeScene(next: IScene, opts: { animate?: boolean } = {}): void {
    const animate = opts.animate ?? false;
    void animate; // reserved for later

    // Remove old scene
    if (this.current) {
      this.current.onExit();
      this.ui.getLayer(UILayerKey.Scene).removeChild(this.current.root);
    }

    // Unload previous bundle (best effort)
    if (this.currentBundle) {
      void this.assets.unloadBundle(this.currentBundle);
    }

    // Load next bundle (if any)
    this.currentBundle = next.bundle ?? null;
    if (this.currentBundle) {
      void this.assets.loadBundle(this.currentBundle);
    }

    // Add next scene
    this.current = next;
    next.root.x = 0;
    this.ui.getLayer(UILayerKey.Scene).addChild(next.root);
    next.onEnter();
  }

  public resize(width: number, height: number): void {
    this.current?.onResize(width, height);
  }

  public update(dt: number): void {
    this.current?.onUpdate(dt);
  }
}
