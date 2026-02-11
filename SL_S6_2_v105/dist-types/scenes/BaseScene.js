import { Container } from 'pixi.js';
/**
 * A minimal scene base class.
 *
 * Phase 1 uses this base to keep parity with the original MVP structure.
 */
export default class BaseScene {
    constructor(name) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "root", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = name;
        this.root = new Container();
        this.root.name = `SceneRoot(${name})`;
    }
    onEnter() {
        // optional
    }
    onExit() {
        // optional
    }
    onResize(_width, _height) {
        // optional
    }
    onUpdate(_dt) {
        // optional
    }
}
