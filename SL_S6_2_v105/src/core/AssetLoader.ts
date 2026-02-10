import { Assets, type ResolverManifest } from 'pixi.js';

/**
 * AssetLoader is a tiny wrapper around PixiJS `Assets`.
 *
 * Stage 5 intent:
 * - Keep loading *scene-oriented* by bundles (home/summon/heroes/battle...).
 * - Avoid sprinkling `Assets.load()` around the codebase.
 * - Make it easy to add real textures/sheets later without refactoring scenes.
 */
export default class AssetLoader {
  private initialized = false;

  /** Initialize Assets once with a manifest (safe to pass an empty manifest). */
  public async init(manifest: ResolverManifest): Promise<void> {
    if (this.initialized) return;
    await Assets.init({ manifest });
    this.initialized = true;
  }

  private ensureInit(): void {
    // In early prototype stages, scenes might call load before init.
    if (!this.initialized) this.initialized = true;
  }

  /** Load a named bundle (defined in the manifest). */
  public async loadBundle(bundle: string): Promise<void> {
    this.ensureInit();
    await Assets.loadBundle(bundle);
  }

  /** Optional: unload a bundle to reclaim memory. */
  public async unloadBundle(bundle: string): Promise<void> {
    try {
      await Assets.unloadBundle(bundle);
    } catch {
      // ignore
    }
  }
}
