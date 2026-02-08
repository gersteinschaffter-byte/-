import type { ResolverManifest } from 'pixi.js';

/**
 * PixiJS Assets manifest.
 *
 * Stage 5 note:
 * - The MVP is mostly Graphics/Text, so bundles are empty for now.
 * - As you add textures/sheets, put them into the corresponding bundle.
 */
export const ASSET_MANIFEST: ResolverManifest = {
  bundles: [
    { name: 'home', assets: [] },
    { name: 'summon', assets: [] },
    { name: 'heroes', assets: [] },
    { name: 'bag', assets: [] },
    { name: 'battle', assets: [] },
  ],
};
