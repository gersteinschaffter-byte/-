import { Container, DisplayObject } from 'pixi.js';
/**
 * UI layer keys. The order (from back to front) is fixed by UIManager.
 */
export var UILayerKey;
(function (UILayerKey) {
    UILayerKey["Background"] = "Background";
    UILayerKey["Scene"] = "Scene";
    UILayerKey["UI"] = "UI";
    UILayerKey["Popup"] = "Popup";
    UILayerKey["Toast"] = "Toast";
})(UILayerKey || (UILayerKey = {}));
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
    constructor() {
        /** Root container holding all layers, usually attached to the "world" container. */
        Object.defineProperty(this, "root", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Container()
        });
        Object.defineProperty(this, "layers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
    getLayer(key) {
        return this.layers[key];
    }
    /**
     * Adds a display object to a specific layer.
     *
     * Note: this method intentionally does NOT sort by zIndex.
     * If you want intra-layer z-ordering, use addChildAt in the caller.
     */
    addToLayer(layer, obj) {
        this.layers[layer].addChild(obj);
    }
    removeFromLayer(layer, obj) {
        this.layers[layer].removeChild(obj);
    }
    /** Removes all children from a layer (useful when switching scenes). */
    clearLayer(layer) {
        this.layers[layer].removeChildren();
    }
}
