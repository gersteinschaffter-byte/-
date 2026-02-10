import { Graphics, Text, TextStyle } from 'pixi.js';
import { RARITY, type Element, type Rarity } from '../game/config';

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function formatNumber(n: number): string {
  const x = Math.floor(Number(n) || 0);
  return x.toString();
}

export function createText(
  txt: string,
  size = 28,
  color = 0xffffff,
  weight: string | number = '700',
): Text {
  const style = new TextStyle({
    fontFamily:
      'system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Microsoft YaHei, sans-serif',
    fontSize: size,
    fill: color,
    fontWeight: weight,
    letterSpacing: 0.5,
    dropShadow: true,
    dropShadowAlpha: 0.35,
    dropShadowBlur: 4,
    dropShadowAngle: Math.PI / 3,
    dropShadowDistance: 3,
  });
  return new Text(txt, style);
}

/**
 * Compatible rounded rect drawing. Pixi v7 has drawRoundedRect, but
 * some environments historically had issues, so we keep the fallback.
 */
export function roundedRect(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (typeof (g as any).drawRoundedRect === 'function') {
    (g as any).drawRoundedRect(x, y, w, h, rr);
    return;
  }
  const x2 = x + w,
    y2 = y + h;
  g.moveTo(x + rr, y);
  g.lineTo(x2 - rr, y);
  g.quadraticCurveTo(x2, y, x2, y + rr);
  g.lineTo(x2, y2 - rr);
  g.quadraticCurveTo(x2, y2, x2 - rr, y2);
  g.lineTo(x + rr, y2);
  g.quadraticCurveTo(x, y2, x, y2 - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
}

export function drawPanel(w: number, h: number, alpha = 0.95): Graphics {
  const g = new Graphics();
  g.beginFill(0x0e1733, alpha);
  g.lineStyle(2, 0x2a4a8d, 0.9);
  roundedRect(g, 0, 0, w, h, 20);
  g.endFill();

  // subtle top sheen
  const sheen = new Graphics();
  sheen.beginFill(0xffffff, 0.06);
  roundedRect(sheen, 8, 8, w - 16, Math.min(90, h - 16), 16);
  sheen.endFill();
  g.addChild(sheen);
  return g;
}

export function rarityLabel(r: Rarity): string {
  return r === RARITY.SP ? 'SP' : r === RARITY.SSR ? 'SSR' : r === RARITY.SR ? 'SR' : 'R';
}

export function rarityColor(r: Rarity): number {
  switch (r) {
    case RARITY.SP:
      return 0xffb400;
    case RARITY.SSR:
      return 0xc46cff;
    case RARITY.SR:
      return 0x4bcbff;
    default:
      return 0x8fffa3;
  }
}

export function elementColor(el: Element): number {
  switch (el) {
    case '火':
      return 0xff5a5a;
    case '水':
      return 0x52a7ff;
    case '风':
      return 0x6bffb8;
    case '光':
      return 0xffe07a;
    case '暗':
      return 0xb08cff;
    default:
      return 0xffffff;
  }
}
