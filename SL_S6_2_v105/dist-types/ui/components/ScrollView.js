import { Container, Graphics, Rectangle, Ticker } from 'pixi.js';
import { clamp } from '../uiFactory';
/**
 * A minimal vertical ScrollView for PixiJS.
 *
 * Phase-3 purpose:
 * - Probability / hero pool previews
 * - Result list for multi-summon
 *
 * Features:
 * - Masked viewport
 * - Drag to scroll (touch friendly)
 * - Wheel scroll (desktop friendly)
 */
export default class ScrollView extends Container {
    constructor(w, h) {
        super();
        /** viewport width */
        Object.defineProperty(this, "viewW", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** viewport height */
        Object.defineProperty(this, "viewH", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "maskG", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "content", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Invisible spacer to control content height explicitly (used by long text panels)
        Object.defineProperty(this, "spacer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scrollY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "dragStartY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "dragStartScrollY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "dragging", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "scrolling", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "dragThreshold", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 6
        });
        Object.defineProperty(this, "prevContentEventMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "prevInteractiveChildren", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        // Phase 2: inertial scrolling + indicator
        Object.defineProperty(this, "velocity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "friction", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.92
        });
        Object.defineProperty(this, "bar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "thumb", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "boundTicker", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.viewW = w;
        this.viewH = h;
        // Pixi v7 events: make sure the ScrollView always receives pointer events.
        // Also set a hitArea so dragging works even if the content is sparse.
        this.eventMode = 'static';
        this.hitArea = new Rectangle(0, 0, w, h);
        this.content = new Container();
        // Content remains interactive (buttons/text inside still work).
        // We'll temporarily disable child interactions only during an actual scroll gesture.
        this.content.eventMode = 'static';
        this.addChild(this.content);
        // spacer keeps content.height >= requested height even if last item is small
        this.spacer = new Graphics();
        this.spacer.beginFill(0x000000, 0);
        this.spacer.drawRect(0, 0, 1, 1);
        this.spacer.endFill();
        this.content.addChild(this.spacer);
        this.maskG = new Graphics();
        this.addChild(this.maskG);
        this.content.mask = this.maskG;
        this.bar = new Graphics();
        this.thumb = new Graphics();
        this.addChild(this.bar);
        this.addChild(this.thumb);
        // Enable touch dragging.
        this.interactive = true;
        // Default: allow children inside content, but we'll temporarily disable
        // them when the user is actively scrolling (to avoid tap/scroll fights).
        this.on('pointerdown', (e) => this.onDown(e));
        this.on('pointerup', (e) => this.onUp(e));
        this.on('pointerupoutside', () => this.onUp());
        this.on('pointermove', (e) => this.onMove(e));
        this.redrawMask();
    }
    /**
     * Bind wheel scrolling to a DOM element (usually the PIXI canvas).
     * Some environments do not dispatch wheel events on Pixi Containers reliably,
     * so we listen on the canvas and do hit-testing against this ScrollView bounds.
     *
     * Returns an unbind function to avoid leaking listeners when popups close.
     */
    bindWheel(dom) {
        const handler = (evt) => {
            // Convert client coords to canvas pixel coords (handles CSS scaling).
            const rect = dom.getBoundingClientRect();
            const scaleX = rect.width > 0 ? dom.width / rect.width : 1;
            const scaleY = rect.height > 0 ? dom.height / rect.height : 1;
            const x = (evt.clientX - rect.left) * scaleX;
            const y = (evt.clientY - rect.top) * scaleY;
            const b = this.getBounds(); // global bounds in world/canvas coords
            if (x < b.x || x > b.x + b.width || y < b.y || y > b.y + b.height)
                return;
            evt.preventDefault(); // prevent page scroll when wheel is over this ScrollView
            this.scrollBy(evt.deltaY * 0.65);
        };
        dom.addEventListener('wheel', handler, { passive: false });
        // unbind: caller must invoke on close/destroy to prevent duplicate bindings
        return () => dom.removeEventListener('wheel', handler);
    }
    /** Update the viewport size and redraw the mask. */
    resize(w, h) {
        this.viewW = w;
        this.viewH = h;
        this.redrawMask();
        this.applyScroll();
        this.updateIndicator();
    }
    /** Scroll to a specific offset (0 means top). */
    scrollTo(y) {
        this.scrollY = y;
        this.applyScroll();
    }
    /** Scroll by delta pixels (positive = scroll down). */
    scrollBy(dy) {
        this.scrollY += dy;
        this.applyScroll();
    }
    /**
     * Explicitly set the content height.
     * Pixi's Container.height is derived from children bounds, so if the last element is short
     * we add/move an invisible spacer to ensure scroll range is correct.
     */
    setContentHeight(h) {
        const hh = Math.max(0, Math.floor(h));
        this.spacer.y = Math.max(0, hh - 1);
        // keep spacer within width so bounds are stable
        this.spacer.x = 0;
        this.applyScroll();
        this.updateIndicator();
    }
    /** Max scroll range based on content height. */
    getMaxScroll() {
        // content.height is bounds-based, safe after children added.
        const overflow = Math.max(0, this.content.height - this.viewH);
        return overflow;
    }
    applyScroll() {
        const max = this.getMaxScroll();
        this.scrollY = clamp(this.scrollY, 0, max);
        this.content.y = -this.scrollY;
        this.updateIndicator();
    }
    redrawMask() {
        this.maskG.clear();
        this.maskG.beginFill(0xffffff, 1);
        this.maskG.drawRect(0, 0, this.viewW, this.viewH);
        this.maskG.endFill();
        this.maskG.hitArea = new Rectangle(0, 0, this.viewW, this.viewH);
    }
    updateIndicator() {
        const max = this.getMaxScroll();
        const show = max > 8;
        this.bar.visible = show;
        this.thumb.visible = show;
        if (!show)
            return;
        const pad = 6;
        const trackW = 6;
        const trackH = Math.max(24, this.viewH - pad * 2);
        const trackX = this.viewW - trackW - pad;
        const trackY = pad;
        this.bar.clear();
        this.bar.beginFill(0x000000, 0.18);
        this.bar.drawRoundedRect(trackX, trackY, trackW, trackH, 6);
        this.bar.endFill();
        const ratio = this.viewH / (this.content.height || this.viewH);
        const thumbH = Math.max(28, Math.floor(trackH * Math.min(1, ratio)));
        const t = max <= 0 ? 0 : this.scrollY / max;
        const thumbY = trackY + Math.floor((trackH - thumbH) * t);
        this.thumb.clear();
        this.thumb.beginFill(0xffffff, 0.45);
        this.thumb.drawRoundedRect(trackX, thumbY, trackW, thumbH, 6);
        this.thumb.endFill();
    }
    onDown(e) {
        this.dragging = true;
        this.scrolling = false;
        this.dragStartY = e.global.y;
        this.dragStartScrollY = this.scrollY;
        this.velocity = 0;
        // Ensure we still receive move/up even if the finger starts on a child.
        // (Pixi events bubble, but some children may stopPropagation.)
        try {
            e.stopPropagation?.();
        }
        catch {
            // ignore
        }
    }
    onMove(e) {
        if (!this.dragging)
            return;
        const dy = e.global.y - this.dragStartY;
        // If the finger moved enough, treat it as a scroll gesture and temporarily
        // disable children interactions so taps/buttons don't "fight" with scrolling.
        if (!this.scrolling && Math.abs(dy) >= this.dragThreshold) {
            this.scrolling = true;
            this.prevContentEventMode = this.content.eventMode;
            this.prevInteractiveChildren = this.content.interactiveChildren;
            this.content.eventMode = 'none';
            this.content.interactiveChildren = false;
        }
        // If we're scrolling, prevent event propagation so parent containers
        // (and overlays) don't treat it as a tap.
        if (this.scrolling) {
            try {
                e.stopPropagation?.();
            }
            catch {
                // ignore
            }
        }
        // Dragging down should scroll up.
        this.scrollY = this.dragStartScrollY - dy;
        this.velocity = dy;
        this.applyScroll();
    }
    onUp(e) {
        const wasScrolling = this.scrolling;
        this.dragging = false;
        // Restore child interactions.
        if (this.prevInteractiveChildren !== null) {
            this.content.interactiveChildren = this.prevInteractiveChildren;
            this.prevInteractiveChildren = null;
        }
        if (this.prevContentEventMode !== null) {
            this.content.eventMode = this.prevContentEventMode;
            this.prevContentEventMode = null;
        }
        this.scrolling = false;
        // If this gesture was a scroll, prevent it from triggering clicks/taps
        // on children (HeroCard, buttons, etc.).
        if (wasScrolling) {
            try {
                e?.stopPropagation?.();
            }
            catch { }
        }
    }
}
