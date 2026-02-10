import { Container, Graphics, Text } from 'pixi.js';
import { clamp, createText, roundedRect } from '../../ui/uiFactory';

/**
 * SummonBanner is a "marketing" area:
 * - Big banner placeholder
 * - Portal / light placeholder effect
 *
 * It also provides `playSummonFx` used before showing the result popup.
 */
export default class SummonBanner extends Container {
  private readonly bg: Graphics;
  private readonly portal: Graphics;
  private readonly shine: Graphics;
  private readonly label: Text;

  private readonly ticker?: { add(fn: (dt: number) => void): void; remove(fn: (dt: number) => void): void };

  constructor(w: number, h: number, ticker?: { add(fn: (dt: number) => void): void; remove(fn: (dt: number) => void): void }) {
    super();
    this.ticker = ticker;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.portal = new Graphics();
    this.addChild(this.portal);

    this.shine = new Graphics();
    this.shine.alpha = 0;
    this.addChild(this.shine);

    this.label = createText('召唤之门（占位 Banner）', 24, 0xeaf2ff, '800');
    this.label.anchor.set(0.5);
    this.addChild(this.label);

    this.resize(w, h);
  }

  public resize(w: number, h: number): void {
    this.bg.clear();
    this.bg.beginFill(0x0b1633, 0.65);
    roundedRect(this.bg, 0, 0, w, h, 26);
    this.bg.endFill();

    // soft frames
    this.bg.lineStyle({ width: 3, color: 0x6aa2ff, alpha: 0.22 });
    roundedRect(this.bg, 14, 14, w - 28, h - 28, 22);

    // Portal circle
    const cx = w * 0.5;
    const cy = h * 0.56;
    this.portal.clear();
    this.portal.beginFill(0x7b3fff, 0.18);
    this.portal.drawCircle(cx, cy, Math.min(w, h) * 0.22);
    this.portal.endFill();
    this.portal.beginFill(0x44e1ff, 0.08);
    this.portal.drawCircle(cx, cy, Math.min(w, h) * 0.32);
    this.portal.endFill();

    // Shine overlay
    this.shine.clear();
    this.shine.beginFill(0xffffff, 0.85);
    roundedRect(this.shine, 0, 0, w, h, 26);
    this.shine.endFill();

    this.label.position.set(w / 2, 56);
  }

  /**
   * A lightweight summoning visual: "light beam" + "flash".
   *
   * - No external tween lib: uses Pixi ticker
   * - Returns a promise that resolves when the animation ends
   */
  public playSummonFx(): Promise<void> {
    // If no ticker is available, just resolve immediately.
    if (!this.ticker) return Promise.resolve();

    this.shine.alpha = 0;
    let t = 0;

    return new Promise((resolve) => {
      const tick = (dt: number) => {
        t += dt / 60;

        // 0~0.2s fade in; 0.2~0.55 hold; 0.55~0.75 fade out
        let a = 0;
        if (t < 0.2) a = t / 0.2;
        else if (t < 0.55) a = 1;
        else a = 1 - (t - 0.55) / 0.2;
        this.shine.alpha = clamp(a, 0, 1) * 0.85;

        // portal breathing
        const s = 1 + Math.sin(t * 14) * 0.03;
        this.portal.scale.set(s);
        this.portal.alpha = 0.9;

        if (t >= 0.75) {
          this.shine.alpha = 0;
          this.portal.scale.set(1);
          this.portal.alpha = 1;
          this.ticker!.remove(tick);
          resolve();
        }
      };

      this.ticker!.add(tick);
    });
  }
}
