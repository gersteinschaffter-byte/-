import { Application, Container, Graphics, Text } from 'pixi.js';
import GameState from './GameState';
import SceneManager from './SceneManager';
import UIManager, { UILayerKey } from './UIManager';
import AssetLoader from './AssetLoader';
import TopBar from '../ui/components/TopBar';
import BottomNav from '../ui/components/BottomNav';
import Modal from '../ui/components/Modal';
import ToastManager from '../ui/components/ToastManager';
import GradientBackground from '../ui/components/GradientBackground';
import { PopupLayers } from '../ui/PopupLayers';
import DebugLogger from './DebugLogger';
import { VIRTUAL_H, VIRTUAL_W } from '../game/config';
import { ASSET_MANIFEST } from '../game/assetManifest';
import { BUILD_TIME, DATA_VERSION, GAME_VERSION } from '../game/version';
/**
 * GameApp is the only "entry point" of the runtime.
 *
 * Responsibilities:
 * - create PixiJS Application
 * - mount renderer view to DOM
 * - manage virtual resolution scaling
 * - own global managers: UIManager / SceneManager / GameState
 * - wire up global UI (TopBar / BottomNav / Modal)
 */
export default class GameApp {
    constructor(opts = {}) {
        Object.defineProperty(this, "pixi", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * Root world container in virtual coordinates.
         * This container will be scaled to match screen size.
         */
        Object.defineProperty(this, "world", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ui", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scenes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "state", {
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
        Object.defineProperty(this, "topBar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bottomNav", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "modal", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "toast", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "debug", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rotateTipEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rotateTipDismissed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "isDesktop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "bg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "versionLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sceneRegistry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        // ---------------------------
        // Runtime error guards
        // ---------------------------
        Object.defineProperty(this, "_lastErrKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "_lastErrAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        const mountId = opts.mountId ?? 'game';
        const rotateTipId = opts.rotateTipId ?? 'rotateTip';
        this.pixi = new Application({
            width: VIRTUAL_W,
            height: VIRTUAL_H,
            backgroundAlpha: 0,
            antialias: true,
            resolution: Math.min(2, window.devicePixelRatio || 1),
            autoDensity: true,
        });
        // Expose for debugging on device.
        window.__APP__ = this.pixi;
        const mount = document.getElementById(mountId);
        if (!mount) {
            throw new Error(`Cannot find mount element: #${mountId}`);
        }
        mount.appendChild(this.pixi.view);
        this.rotateTipEl = document.getElementById(rotateTipId);
        // Orientation overlay: allow desktop to pass through; mobile landscape can show once and be dismissible.
        this.isDesktop = this.detectDesktop();
        try {
            this.rotateTipDismissed = sessionStorage.getItem('rotateTipDismissed') === '1';
        }
        catch (_) {
            this.rotateTipDismissed = false;
        }
        if (this.rotateTipEl) {
            this.rotateTipEl.style.cursor = 'pointer';
            this.rotateTipEl.addEventListener('click', () => {
                this.rotateTipDismissed = true;
                try {
                    sessionStorage.setItem('rotateTipDismissed', '1');
                }
                catch (_) { }
                this.rotateTipEl && (this.rotateTipEl.style.display = 'none');
            });
        }
        // ★ v0.80: 多层渐变背景（替代纯色+简单圆形）
        // 背景在屏幕坐标系绘制，放在 stage 最底层
        this.bg = new GradientBackground();
        this.pixi.stage.addChild(this.bg);
        // Version marker (for quickly verifying you opened the latest build)
        // Version label helps quickly verify new packages / data changes.
        this.versionLabel = new Text(`${GAME_VERSION} ${BUILD_TIME} ${DATA_VERSION}`, {
            fontSize: 14,
            fill: 0xffffff,
            fontWeight: '700',
        });
        this.versionLabel.alpha = 0.55;
        this.versionLabel.eventMode = 'none';
        this.pixi.stage.addChild(this.versionLabel);
        // Scaled world container (virtual coordinates)
        this.world = new Container();
        this.pixi.stage.addChild(this.world);
        // Managers
        this.ui = new UIManager();
        this.world.addChild(this.ui.root);
        this.assets = new AssetLoader();
        this.scenes = new SceneManager(this.ui, this.assets);
        this.state = new GameState();
        this.debug = new DebugLogger(500);
        try {
            window.__DEBUG_LOG__ = this.debug;
        }
        catch (_) { }
        this.debug.info('BOOT', 'game start', { version: GAME_VERSION, build: BUILD_TIME, data: DATA_VERSION });
        // Lightweight state logging for bug reports.
        this.state.on('currencyChanged', (p) => this.debug.info('STATE', 'currencyChanged', p));
        this.state.on('inventoryChanged', (p) => this.debug.info('STATE', 'inventoryChanged', { keys: Object.keys(p.inventory || {}).length }));
        this.state.on('stageChanged', (p) => this.debug.info('STATE', 'stageChanged', p));
        this.state.on('partyChanged', (p) => this.debug.info('STATE', 'partyChanged', { slots: p.partySlots }));
        this.state.on('heroesChanged', (p) => this.debug.info('STATE', 'heroesChanged', { count: (p.heroes || []).length }));
        // Safe to call with an empty manifest in MVP. Later fill bundles with real assets.
        void this.assets.init(ASSET_MANIFEST);
        // Global UI (phase 1 keeps previous MVP UI style)
        this.topBar = new TopBar(this);
        this.bottomNav = new BottomNav();
        this.modal = new Modal(VIRTUAL_W, VIRTUAL_H, this.pixi.ticker);
        this.toast = new ToastManager(VIRTUAL_W, VIRTUAL_H);
        this.ui.addToLayer(UILayerKey.UI, this.topBar);
        this.ui.addToLayer(UILayerKey.UI, this.bottomNav);
        this.ui.addToLayer(UILayerKey.Popup, this.modal);
        this.ui.addToLayer(UILayerKey.Toast, this.toast);
        // Global events
        window.addEventListener('resize', () => this.applyScale());
        window.addEventListener('orientationchange', () => setTimeout(() => this.applyScale(), 120));
        this.installRuntimeErrorGuards();
    }
    /** Register scenes (called once in bootstrap). */
    registerScenes(scenes) {
        this.sceneRegistry = scenes;
    }
    /**
     * Navigate to a scene by key.
     *
     * ★ v0.82: 默认启用淡入淡出过渡动画。
     * 传 animate: false 可跳过动画（用于首次加载等场景）。
     */
    goTo(key, opts = {}) {
        const next = this.sceneRegistry[key];
        if (!next) {
            console.warn(`[GameApp] Scene not registered: ${key}`);
            return;
        }
        // Close global modal before switching to avoid invisible overlays.
        try {
            this.modal.close();
        }
        catch (_) { }
        // ★ v0.82: 默认启用动画（首次加载 home 除外）
        const animate = opts.animate ?? (this.scenes.getCurrent() !== null);
        this.scenes.changeScene(next, { animate });
        this.scenes.resize(VIRTUAL_W, VIRTUAL_H);
        this.bottomNav.setActive(key);
        this.topBar.setBackVisible(key !== 'home');
        // Back visibility affects layout of currency labels.
        this.topBar.resize(VIRTUAL_W, VIRTUAL_H);
    }
    hardReset() {
        this.state.hardReset();
        this.goTo('home', { animate: false });
    }
    /** Main loop hook */
    tick(dt) {
        this.scenes.update(dt);
        this.toast.update(dt);
        // ★ v0.80: 驱动背景星点闪烁动画
        this.bg.onUpdate(dt);
    }
    detectDesktop() {
        const ua = navigator.userAgent || '';
        const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
        const maxTouch = navigator.maxTouchPoints || 0;
        const hasTouch = maxTouch > 0 || 'ontouchstart' in window;
        const fine = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
        const bigScreen = Math.max(window.screen?.width || 0, window.screen?.height || 0) >= 900;
        // Treat as desktop when it's not a mobile UA and either pointer is fine or screen is large.
        return !isMobileUA && (!hasTouch || fine || bigScreen);
    }
    /**
     * Apply virtual scaling (letterboxed) + redraw background.
     */
    applyScale() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        // Orientation overlay (HTML #rotateTip)
        // - Desktop: always hidden (do not block)
        // - Mobile: when landscape, show once and allow dismiss
        if (this.rotateTipEl) {
            if (this.isDesktop || this.rotateTipDismissed) {
                this.rotateTipEl.style.display = 'none';
            }
            else {
                const isPortrait = h >= w;
                this.rotateTipEl.style.display = isPortrait ? 'none' : 'flex';
            }
        }
        const scale = Math.min(w / VIRTUAL_W, h / VIRTUAL_H);
        this.world.scale.set(scale);
        this.world.position.set((w - VIRTUAL_W * scale) / 2, (h - VIRTUAL_H * scale) / 2);
        this.pixi.renderer.resize(w, h);
        this.drawBackground(w, h);
        // Keep version text visible above the bottom nav (does not block input)
        // BottomNav layout: barH=150 and y = VIRTUAL_H - barH - 10 (virtual coords)
        // Convert the nav top edge to real screen coords using world scale + letterbox offset.
        const navTopScreenY = this.world.position.y + (VIRTUAL_H - 150 - 10) * scale;
        const margin = 8;
        const ySafe = Math.max(10, navTopScreenY - margin - this.versionLabel.height);
        this.versionLabel.position.set(10, ySafe);
        // Layout virtual UI
        this.topBar.resize(VIRTUAL_W, VIRTUAL_H);
        this.bottomNav.resize(VIRTUAL_W, VIRTUAL_H);
        this.modal.resize(VIRTUAL_W, VIRTUAL_H);
        this.toast.resize(VIRTUAL_W, VIRTUAL_H);
        this.scenes.resize(VIRTUAL_W, VIRTUAL_H);
    }
    installRuntimeErrorGuards() {
        const w = window;
        // Expose latest runtime error for quick device debugging/screenshots.
        if (!w.__LAST_RUNTIME_ERROR__)
            w.__LAST_RUNTIME_ERROR__ = null;
        const nowMs = () => Date.now();
        const makeKey = (msg, stack) => {
            const top = (stack || '').split('\\n')[0] || '';
            return `${msg}@@${top}`;
        };
        const showPopup = (msg, stack) => {
            const time = nowMs();
            const key = makeKey(msg, stack);
            // De-dup within a short window (3~5s)
            if (key === this._lastErrKey && time - this._lastErrAt < 4500)
                return;
            this._lastErrKey = key;
            this._lastErrAt = time;
            w.__LAST_RUNTIME_ERROR__ = { message: msg, stack: stack || '(no stack)', time, scene: this.scenes?.current?.name };
            // Console keeps full stack (no truncation)
            if (stack)
                console.error('[RuntimeError]', msg, '\n', stack);
            else
                console.error('[RuntimeError]', msg);
            // Show a single top-level modal (Popup layer)
            try {
                const layer = this.modal.useLayer(PopupLayers.RUNTIME_ERROR);
                const maxLines = 18;
                const lines = (stack || '(no stack)').split('\\n');
                // Try to surface the first in-project source location (src/...:line:col) even if stack is long.
                const firstSrc = lines.find((l) => /src\//.test(l));
                const shown = lines.slice(0, maxLines);
                if (firstSrc && !shown.includes(firstSrc))
                    shown.unshift(firstSrc, '---');
                if (lines.length > maxLines)
                    shown.push('... (truncated)');
                const title = new Text('运行异常（可截图发我）', { fontSize: 20, fill: 0xffffff, fontWeight: '700' });
                const msgText = new Text(`Error: ${msg}`, { fontSize: 14, fill: 0xffffff });
                msgText.style.wordWrap = true;
                msgText.style.wordWrapWidth = VIRTUAL_W - 120;
                const stackText = new Text(shown.join('\\n'), { fontSize: 12, fill: 0xffffff, fontFamily: 'monospace' });
                stackText.style.wordWrap = true;
                stackText.style.wordWrapWidth = VIRTUAL_W - 120;
                title.x = 0;
                title.y = 0;
                msgText.x = 0;
                msgText.y = title.y + title.height + 10;
                stackText.x = 0;
                stackText.y = msgText.y + msgText.height + 12;
                layer.addChild(title, msgText, stackText);
                this.modal.onClose = () => this.modal.clearLayer(PopupLayers.RUNTIME_ERROR);
                // Leave extra bottom safe area so it won't be covered by nav
                this.modal.open();
                this.modal.resize(VIRTUAL_W, VIRTUAL_H);
            }
            catch (e) {
                // Fallback to toast if modal fails
                try {
                    this.toast.show('运行异常（可截图发我）');
                }
                catch { }
            }
        };
        // Boot error helper (callable anywhere)
        w.__SHOW_BOOT_ERROR__ = (msg) => {
            showPopup(String(msg || 'Unknown boot error'), '(boot)');
        };
        // window.onerror
        window.addEventListener('error', (ev) => {
            const anyEv = ev;
            const err = anyEv.error;
            const msg = err?.message || anyEv.message || 'Unknown error';
            const stack = err?.stack;
            showPopup(String(msg), stack);
        });
        // window.onunhandledrejection
        window.addEventListener('unhandledrejection', (ev) => {
            const reason = ev.reason;
            const msg = reason?.message || String(reason || 'Unhandled rejection');
            const stack = reason?.stack;
            showPopup(String(msg), stack);
        });
    }
    drawBackground(w, h) {
        // ★ v0.80: 委托给 GradientBackground 组件
        this.bg.resize(w, h);
    }
}
