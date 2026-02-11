import { Container, Graphics, Rectangle } from 'pixi.js';
import UIButton from './UIButton';
import { clamp, drawPanel } from '../uiFactory';

/**
 * Global modal (popup) container.
 *
 * ⚠️ Shared modal warning
 * This modal instance is shared across scenes/popups. If different features call
 * `modal.content.removeChildren()` they will wipe each other's UI and cause
 * "blank modal" issues.
 *
 * ✅ Solution: namespaced layers
 * Use `modal.useLayer('someName')` to get a dedicated container for a popup.
 * This will:
 * - hide other layers
 * - optionally clear only that layer
 */
export default class Modal extends Container {
  private readonly overlay: Graphics;
  public readonly panel: Graphics;

  /** Root container under the panel. Do NOT call removeChildren() on this in new code. */
  public readonly content: Container;

  private readonly btnClose: UIButton;
  public onClose: (() => void) | null = null;
  private readonly ticker?: { add(fn: (dt: number) => void): void; remove(fn: (dt: number) => void): void };

  private readonly layers = new Map<string, Container>();
  private activeLayer: string | null = null;

  constructor(
    w: number,
    h: number,
    ticker?: { add(fn: (dt: number) => void): void; remove(fn: (dt: number) => void): void },
  ) {
    super();
    this.ticker = ticker;

    this.overlay = new Graphics();
    this.addChild(this.overlay);

    this.panel = drawPanel(Math.min(640, w - 80), Math.min(980, h - 140), 0.98);
    this.addChild(this.panel);

    this.content = new Container();
    this.panel.addChild(this.content);

    // Engineering guard:
    // The modal instance is shared globally. Calling `modal.content.removeChildren()`
    // will wipe ALL popup layers and can easily cause "blank modal" bugs.
    // To keep future code safe, we prevent this operation and provide layer APIs instead.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.content as any).removeChildren = (..._args: any[]) => {
      throw new Error(
        '[Modal] Forbidden: do not call modal.content.removeChildren(). ' +
          'Use modal.useLayer(name), modal.clearLayer(name), or modal.clearAllLayers() instead.',
      );
    };

    // Create default layer for backward compatibility.
    this.getLayer('default');
    this.setActiveLayer('default');

    this.btnClose = new UIButton('✕', 74, 74);
    this.btnClose.txt.style.fontSize = 34;
    this.btnClose.txt.position.set(74 / 2, 74 / 2 + 2);
    this.btnClose.position.set(this.panel.width - 74 - 18, 18);
    this.btnClose.on('pointertap', () => this.close());
    this.panel.addChild(this.btnClose);

    this.overlay.interactive = true;
    this.overlay.on('pointertap', (e) => {
      try {
        (e as any).stopPropagation?.();
      } catch (_) {}
      this.close();
    });

    this.visible = false;
    this.interactive = false;
    this.interactiveChildren = false;

    this.layout(w, h);
  }

  /** Clear ALL layers (rare). Prefer clearLayer(name) in normal gameplay. */
  public clearAllLayers(): void {
    for (const layer of this.layers.values()) layer.removeChildren();
  }

  /**
   * Unified safe entry:
   * - switches to a named layer
   * - (optionally) clears only that layer
   * - runs builder
   * - opens modal
   */
  public openLayer(name: string, build: (layer: Container) => void, clear: boolean = true): void {
    const layer = this.useLayer(name, clear);
    build(layer);
    this.open();
  }

  /** Get a dedicated namespaced layer under modal.content (created on demand). */
  public getLayer(name: string): Container {
    const key = String(name || 'default');
    const exist = this.layers.get(key);
    if (exist) return exist;

    const layer = new Container();
    // Helpful during debugging in Pixi inspectors.
    (layer as any).name = `modalLayer:${key}`;
    layer.position.set(0, 0);
    this.layers.set(key, layer);
    this.content.addChild(layer);
    return layer;
  }

  /**
   * Use a layer as the active popup UI.
   * - hides other layers
   * - optionally clears only this layer
   */
  public useLayer(name: string, clear: boolean = true): Container {
    const layer = this.getLayer(name);
    if (clear) layer.removeChildren();
    this.setActiveLayer(name);
    return layer;
  }

  /** Clear the specified layer only. */
  public clearLayer(name: string): void {
    this.getLayer(name).removeChildren();
  }

  /** Hide all layers except the active one (or show all if active is null). */
  public setActiveLayer(name: string | null): void {
    const key = name ? String(name) : null;
    this.activeLayer = key;
    for (const [k, layer] of this.layers.entries()) {
      layer.visible = key === null ? true : k === key;
    }
  }

  public resize(w: number, h: number): void {
    this.layout(w, h);
  }

  public open(): void {
    this.visible = true;
    this.interactive = true;
    this.interactiveChildren = true;
    this.alpha = 0;

    // Fade-in animation (optional: requires ticker hooks)
    if (!this.ticker) {
      this.alpha = 1;
      return;
    }
    let t = 0;
    const tick = (dt: number) => {
      t += dt / 60;
      this.alpha = clamp(t * 2, 0, 1);
      if (this.alpha >= 1) this.ticker!.remove(tick);
    };
    this.ticker.add(tick);
  }

  public close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.interactive = false;
    this.interactiveChildren = false;
    this.onClose?.();
  }

  private layout(w: number, h: number): void {
    this.overlay.clear();
    this.overlay.beginFill(0x000000, 0.6);
    this.overlay.drawRect(0, 0, w, h);
    this.overlay.endFill();
    this.overlay.hitArea = new Rectangle(0, 0, w, h);

    this.panel.position.set((w - this.panel.width) / 2, (h - this.panel.height) / 2);
    this.content.position.set(0, 0);
  }
}
