import { Container, DisplayObject } from 'pixi.js';
import { clamp } from './uiFactory';

/**
 * FlexContainer (Phase 2)
 * A tiny flex-like layout helper for PixiJS scenes.
 *
 * Goals:
 * - Reduce hard-coded pixel positioning
 * - Make rows/columns with gap + basic justify/align
 *
 * NOTE: This is intentionally minimal; it does not attempt full CSS flex parity.
 */
export default class FlexContainer extends Container {
  private direction: 'row' | 'column' = 'row';
  private gap = 0;
  private justify: 'start' | 'center' | 'end' | 'space-between' = 'start';
  private align: 'start' | 'center' | 'end' = 'center';

  public setDirection(dir: 'row' | 'column'): this {
    this.direction = dir;
    return this;
  }

  public setGap(gap: number): this {
    this.gap = Math.max(0, gap);
    return this;
  }

  public setJustify(j: 'start' | 'center' | 'end' | 'space-between'): this {
    this.justify = j;
    return this;
  }

  public setAlign(a: 'start' | 'center' | 'end'): this {
    this.align = a;
    return this;
  }

  /**
   * Layout children within maxMain (width for row, height for column).
   * Cross axis alignment uses current bounds.
   */
  public layout(maxMain: number): void {
    const kids = this.children.filter((c) => c.visible) as DisplayObject[];
    if (kids.length === 0) return;

    const sizes = kids.map((k) => (this.direction === 'row' ? k.width : k.height));
    const totalSize = sizes.reduce((a, b) => a + b, 0);
    const totalGap = this.gap * Math.max(0, kids.length - 1);
    const used = totalSize + totalGap;
    const free = Math.max(0, maxMain - used);

    let start = 0;
    let stepGap = this.gap;

    if (this.justify === 'center') start = free / 2;
    if (this.justify === 'end') start = free;
    if (this.justify === 'space-between' && kids.length > 1) {
      stepGap = this.gap + free / (kids.length - 1);
      start = 0;
    }

    let cursor = start;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (this.direction === 'row') {
        k.x = cursor;
        // cross align (y)
        const cross = this.height;
        if (this.align === 'start') k.y = 0;
        else if (this.align === 'end') k.y = Math.max(0, cross - k.height);
        else k.y = Math.max(0, (cross - k.height) / 2);
        cursor += k.width + stepGap;
      } else {
        k.y = cursor;
        const cross = this.width;
        if (this.align === 'start') k.x = 0;
        else if (this.align === 'end') k.x = Math.max(0, cross - k.width);
        else k.x = Math.max(0, (cross - k.width) / 2);
        cursor += k.height + stepGap;
      }
    }
  }

  public clampToBounds(maxW: number, maxH: number): void {
    this.x = clamp(this.x, 0, maxW - this.width);
    this.y = clamp(this.y, 0, maxH - this.height);
  }
}
