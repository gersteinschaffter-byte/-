import { Container, Graphics, Text } from 'pixi.js';

/**
 * Simple toast/notification manager.
 *
 * Stage 5 intent:
 * - Keep transient notifications in one place.
 * - Render in UIManager.Toast layer so it's always top-most.
 */
export default class ToastManager extends Container {
  private current: Container | null = null;
  private timer = 0;
  private duration = 0;

  private viewW: number;
  private viewH: number;

  constructor(viewW: number, viewH: number) {
    super();
    this.name = 'ToastManager';
    this.viewW = viewW;
    this.viewH = viewH;
  }

  public resize(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    if (this.current) this.current.x = w / 2;
  }

  /** Show a toast message for `durationSec` seconds. */
  public show(message: string, durationSec = 1.6): void {
    this.removeChildren();
    this.current = this.buildToast(message);
    this.addChild(this.current);
    this.timer = 0;
    this.duration = Math.max(0.6, durationSec);
  }

  /** Called from GameApp ticker. */
  public update(dtFrames: number): void {
    if (!this.current) return;

    this.timer += dtFrames / 60;
    const t = this.timer;
    const d = this.duration;

    // Fade out near the end.
    const fadeStart = Math.max(0.2, d - 0.4);
    if (t >= fadeStart) {
      const p = Math.min(1, (t - fadeStart) / (d - fadeStart));
      this.current.alpha = 1 - p;
      this.current.y = this.viewH * 0.22 - p * 12;
    }

    if (t >= d) {
      this.removeChildren();
      this.current = null;
    }
  }

  private buildToast(message: string): Container {
    const root = new Container();
    root.x = this.viewW / 2;
    root.y = this.viewH * 0.22;
    root.alpha = 1;

    const paddingX = 20;
    const paddingY = 10;
    const text = new Text(message, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      fontSize: 22,
      fill: 0xffffff,
      align: 'center',
    });
    text.anchor.set(0.5);
    text.position.set(0, 0);

    const bw = Math.max(220, text.width + paddingX * 2);
    const bh = Math.max(44, text.height + paddingY * 2);

    const bg = new Graphics();
    bg.beginFill(0x000000, 0.6);
    bg.drawRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
    bg.endFill();

    root.addChild(bg, text);
    return root;
  }
}
