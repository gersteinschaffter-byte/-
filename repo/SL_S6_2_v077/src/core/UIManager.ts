import { Container, DisplayObject } from 'pixi.js';

/**
 * UI layer keys. The order (from back to front) is fixed by UIManager.
 */
export enum UILayerKey {
  Background = 'Background',
  Scene = 'Scene',
  UI = 'UI',
  Popup = 'Popup',
  Toast = 'Toast',
}

/**
 * UIManager manages a stable display hierarchy (layers) so that scenes and
 * UI components never fight over z-order.
 *
 * Why this matters:
 * - Scenes should never cover global UI.
 * - Popups should always be above scenes.
 * - Toasts/notifications should always be top-most.
 */
export default class UIManager {
  /** Root container holding all layers, usually attached to the "world" container. */
  public readonly root = new Container();

  private readonly layers: Record<UILayerKey, Container>;

  constructor() {
    // Keep the layer order deterministic.
    const background = new Container();
    const scene = new Container();
    const ui = new Container();
    const popup = new Container();
    const toast = new Container();

    background.name = 'Layer.Background';
    scene.name = 'Layer.Scene';
    ui.name = 'Layer.UI';
    popup.name = 'Layer.Popup';
    toast.name = 'Layer.Toast';

    this.layers = {
      [UILayerKey.Background]: background,
      [UILayerKey.Scene]: scene,
      [UILayerKey.UI]: ui,
      [UILayerKey.Popup]: popup,
      [UILayerKey.Toast]: toast,
    };

    // Add in strict order.
    this.root.addChild(background, scene, ui, popup, toast);
  }

  public getLayer(key: UILayerKey): Container {
    return this.layers[key];
  }

  /**
   * Adds a display object to a specific layer.
   *
   * Note: this method intentionally does NOT sort by zIndex.
   * If you want intra-layer z-ordering, use addChildAt in the caller.
   */
  public addToLayer(layer: UILayerKey, obj: DisplayObject): void {
    this.layers[layer].addChild(obj);
  }

  public removeFromLayer(layer: UILayerKey, obj: DisplayObject): void {
    this.layers[layer].removeChild(obj);
  }

  /** Removes all children from a layer (useful when switching scenes). */
  public clearLayer(layer: UILayerKey): void {
    this.layers[layer].removeChildren();
  }
}
