import UIManager, { UILayerKey } from './UIManager';
import { Tween, TweenRunner, easeOutCubic, easeInCubic } from '../fx/Tween';
/**
 * SceneManager v0.86 — 修复 animated 过渡后 onResize 保证调用
 *
 * ★ 问题分析:
 *   goTo() 调用顺序: changeScene(next) → scenes.resize(w,h)
 *   animated 路径中 this.current 在回调内才更新为 next，
 *   所以 scenes.resize() 实际调的是 OLD scene 的 onResize。
 *   导致 new scene 永远不会收到 onResize → 布局全部为默认(0,0)。
 *
 * ★ 修复: SceneManager 记住最后 resize 尺寸，
 *   animated 过渡中 onEnter 后立即补调 onResize。
 */
export default class SceneManager {
    constructor(ui, assets) {
        Object.defineProperty(this, "ui", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "assets", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "current", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "currentBundle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "transitionRunner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new TweenRunner()
        });
        Object.defineProperty(this, "isTransitioning", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // ★ 记住最后的 resize 尺寸
        Object.defineProperty(this, "lastW", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastH", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.ui = ui;
        this.assets = assets;
    }
    getCurrent() {
        return this.current;
    }
    changeScene(next, opts = {}) {
        const animate = opts.animate ?? false;
        if (this.isTransitioning) {
            this.finishTransitionImmediate();
        }
        const sceneLayer = this.ui.getLayer(UILayerKey.Scene);
        const old = this.current;
        if (!animate || !old) {
            // ── 瞬切 ──
            if (old) {
                old.onExit();
                sceneLayer.removeChild(old.root);
            }
            this.swapBundles(next);
            this.current = next;
            next.root.alpha = 1;
            next.root.x = 0;
            sceneLayer.addChild(next.root);
            next.onEnter();
            // ★ 瞬切也保证 onResize（虽然 goTo 后面也会调）
            if (this.lastW > 0 && this.lastH > 0) {
                next.onResize(this.lastW, this.lastH);
            }
            return;
        }
        // ── 淡入淡出过渡 ──
        this.isTransitioning = true;
        this.transitionRunner.clear();
        const FADE_OUT = 8;
        const FADE_IN = 10;
        this.transitionRunner.add(Tween.to(old.root, { alpha: 0 }, FADE_OUT, easeInCubic, () => {
            old.onExit();
            sceneLayer.removeChild(old.root);
            old.root.alpha = 1;
            this.swapBundles(next);
            this.current = next;
            next.root.alpha = 0;
            next.root.x = 0;
            sceneLayer.addChild(next.root);
            next.onEnter();
            // ★ 关键修复：animated 过渡中，goTo 的 resize 调的是旧场景，
            //   新场景必须在这里补调 onResize
            if (this.lastW > 0 && this.lastH > 0) {
                next.onResize(this.lastW, this.lastH);
            }
            this.transitionRunner.add(Tween.to(next.root, { alpha: 1 }, FADE_IN, easeOutCubic, () => {
                this.isTransitioning = false;
            }));
        }));
    }
    finishTransitionImmediate() {
        this.transitionRunner.clear();
        this.isTransitioning = false;
        if (this.current) {
            this.current.root.alpha = 1;
        }
    }
    swapBundles(next) {
        if (this.currentBundle) {
            void this.assets.unloadBundle(this.currentBundle);
        }
        this.currentBundle = next.bundle ?? null;
        if (this.currentBundle) {
            void this.assets.loadBundle(this.currentBundle);
        }
    }
    resize(width, height) {
        this.lastW = width;
        this.lastH = height;
        this.current?.onResize(width, height);
    }
    update(dt) {
        if (!this.transitionRunner.isIdle()) {
            this.transitionRunner.update(dt);
        }
        this.current?.onUpdate(dt);
    }
}
