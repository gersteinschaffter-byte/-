import { Container, Graphics, Ticker } from 'pixi.js';
import { clamp } from '../uiFactory';

/**
 * Lightweight skeleton placeholder with a subtle shimmer.
 * - Pure UI utility: no game logic changes.
 * - Use for lists/modals to avoid "blank + sudden pop" feeling on mobile.
 */
export default class SkeletonBlock extends Container {
  private base: Graphics;
  private shine: Graphics;
  private w: number;
  private h: number;
  private r: number;
  private t = 0;

  constructor(w: number, h: number, radius = 16) {
    super();
    this.w = w;
    this.h = h;
    this.r = radius;

    this.base = new Graphics();
    this.shine = new Graphics();

    this.addChild(this.base, this.shine);
    this.redraw();

    // Shimmer animation (safe even if Ticker not running in some tests).
    try {
      Ticker.shared.add(this.tick);
      this.on('removed', () => {
        try { Ticker.shared.remove(this.tick); } catch (_) {}
      });
    } catch (_) {}
  }

  private redraw(): void {
    this.base.clear();
    this.base.beginFill(0xffffff, 0.08);
    this.base.drawRoundedRect(0, 0, this.w, this.h, this.r);
    this.base.endFill();

    // Shine overlay (diagonal band)
    this.shine.clear();
    this.shine.beginFill(0xffffff, 0.10);
    // Draw a wide band then clip by base via mask-like bounds (cheap approach).
    const bandW = Math.max(80, Math.floor(this.w * 0.35));
    this.shine.drawRoundedRect(-bandW, 0, bandW, this.h, this.r);
    this.shine.endFill();

    // Slight skew to look like a diagonal shimmer.
    (this.shine as any).skew.set(-0.25, 0);
  }

  private tick = (dt: number) => {
    this.t += dt / 60;
    const bandW = Math.max(80, Math.floor(this.w * 0.35));
    const span = this.w + bandW * 2;
    // Move left -> right looping.
    const x = (this.t * 220) % span - bandW;
    this.shine.x = clamp(x, -bandW, this.w + bandW);
    this.shine.y = 0;
  };

  public setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.redraw();
  }
}
