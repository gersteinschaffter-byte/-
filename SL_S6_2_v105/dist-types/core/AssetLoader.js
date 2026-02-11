import { Assets } from 'pixi.js';
/**
 * AssetLoader is a tiny wrapper around PixiJS `Assets`.
 *
 * Stage 5 intent:
 * - Keep loading *scene-oriented* by bundles (home/summon/heroes/battle...).
 * - Avoid sprinkling `Assets.load()` around the codebase.
 * - Make it easy to add real textures/sheets later without refactoring scenes.
 */
export default class AssetLoader {
    constructor() {
        Object.defineProperty(this, "initialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    /** Initialize Assets once with a manifest (safe to pass an empty manifest). */
    async init(manifest) {
        if (this.initialized)
            return;
        await Assets.init({ manifest });
        this.initialized = true;
    }
    ensureInit() {
        // In early prototype stages, scenes might call load before init.
        if (!this.initialized)
            this.initialized = true;
    }
    /** Load a named bundle (defined in the manifest). */
    async loadBundle(bundle) {
        this.ensureInit();
        await Assets.loadBundle(bundle);
    }
    /** Optional: unload a bundle to reclaim memory. */
    async unloadBundle(bundle) {
        try {
            await Assets.unloadBundle(bundle);
        }
        catch {
            // ignore
        }
    }
}
