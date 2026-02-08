import { Container, Graphics, Rectangle } from 'pixi.js';
import UIButton from './UIButton';
import { clamp, drawPanel } from '../uiFactory';

/**
 * Simple global modal (popup) container.
 *
 * In phase 1 we keep the old MVP structure:
 * - semi-transparent overlay
 * - center panel
 * - `content` container for scene-specific popup UI
 */
export default class Modal extends Container {
  private readonly overlay: Graphics;
  public readonly panel: Graphics;
  public readonly content: Container;
  private readonly btnClose: UIButton;
  public onClose: (() => void) | null = null;
  private readonly ticker?: { add(fn: (dt: number) => void): void; remove(fn: (dt: number) => void): void };

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
