import { Container, Graphics, Text, Sprite, Texture, BLEND_MODES } from 'pixi.js';
import { RARITY } from '../../game/config';
import { createText, elementColor, rarityColor, rarityLabel, roundedRect } from '../uiFactory';
import { darken, lighten } from '../theme';
// ============================================================================
// HeroCard v0.81 — 商业手游级卡片组件
//
// 视觉分层（从后到前）:
//   Layer 0: 投影（柔和底部阴影）
//   Layer 1: 稀有度外发光（多层霓虹光，稀有度越高越强）
//   Layer 2: 卡片主体（渐变填充 canvas texture）
//   Layer 3: 稀有度边框（双线金属边 + 角装饰）
//   Layer 4: 头像区域（暗底 + 属性辐射光 + 角色首字母）
//   Layer 5: 渐变底部信息条（左→右稀有度色渐变）
//   Layer 6: 名字 + 等级/星
//   Layer 7: 稀有度标签 + 属性徽章
//   Layer 8: glow 呼吸层（外部可控 alpha）
//   Layer 9: 锁定遮罩 / 上阵徽章
//
// 稀有度视觉强度:
//   R   → 1层微弱发光, 单线边框, 无角装饰
//   SR  → 2层发光, 双线边框, 无角装饰
//   SSR → 3层强发光, 双线金属边 + 角装饰
//   SP  → 3层最强发光(金色), 双线金属边 + 角装饰 + 金色顶部光带
// ============================================================================
/** 辅助：hex → [r,g,b] */
function hexToRgb(hex) {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}
/** 辅助：生成卡片主体渐变 texture（一次性） */
function makeCardBodyTexture(w, h, topColor, bottomColor, radius) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    const [r1, g1, b1] = hexToRgb(topColor);
    const [r2, g2, b2] = hexToRgb(bottomColor);
    grad.addColorStop(0, `rgba(${r1},${g1},${b1},0.98)`);
    grad.addColorStop(1, `rgba(${r2},${g2},${b2},0.98)`);
    ctx.beginPath();
    const rr = Math.min(radius, w / 2, h / 2);
    ctx.moveTo(rr, 0);
    ctx.lineTo(w - rr, 0);
    ctx.quadraticCurveTo(w, 0, w, rr);
    ctx.lineTo(w, h - rr);
    ctx.quadraticCurveTo(w, h, w - rr, h);
    ctx.lineTo(rr, h);
    ctx.quadraticCurveTo(0, h, 0, h - rr);
    ctx.lineTo(0, rr);
    ctx.quadraticCurveTo(0, 0, rr, 0);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    return Texture.from(canvas);
}
/** 辅助：生成底部信息条渐变 texture */
function makeBarTexture(w, h, leftColor, rightColor, radius) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    const [r1, g1, b1] = hexToRgb(leftColor);
    const [r2, g2, b2] = hexToRgb(rightColor);
    grad.addColorStop(0, `rgba(${r1},${g1},${b1},0.5)`);
    grad.addColorStop(1, `rgba(${r2},${g2},${b2},0.25)`);
    ctx.beginPath();
    const rr = Math.min(radius, w / 2, h / 2);
    ctx.moveTo(rr, 0);
    ctx.lineTo(w - rr, 0);
    ctx.quadraticCurveTo(w, 0, w, rr);
    ctx.lineTo(w, h - rr);
    ctx.quadraticCurveTo(w, h, w - rr, h);
    ctx.lineTo(rr, h);
    ctx.quadraticCurveTo(0, h, 0, h - rr);
    ctx.lineTo(0, rr);
    ctx.quadraticCurveTo(0, 0, rr, 0);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    return Texture.from(canvas);
}
/** 稀有度等级 → 发光层数和强度 */
function rarityGlowConfig(rarity) {
    switch (rarity) {
        case RARITY.SP:
            return {
                layers: [
                    { expand: 14, alpha: 0.30, lineW: 10 },
                    { expand: 8, alpha: 0.20, lineW: 6 },
                    { expand: 4, alpha: 0.12, lineW: 3 },
                ],
            };
        case RARITY.SSR:
            return {
                layers: [
                    { expand: 12, alpha: 0.22, lineW: 8 },
                    { expand: 6, alpha: 0.14, lineW: 5 },
                    { expand: 3, alpha: 0.08, lineW: 2 },
                ],
            };
        case RARITY.SR:
            return {
                layers: [
                    { expand: 8, alpha: 0.14, lineW: 5 },
                    { expand: 4, alpha: 0.08, lineW: 3 },
                ],
            };
        default: // R
            return {
                layers: [
                    { expand: 5, alpha: 0.06, lineW: 3 },
                ],
            };
    }
}
export default class HeroCard extends Container {
    constructor(hero, owned) {
        super();
        Object.defineProperty(this, "w", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 214
        });
        Object.defineProperty(this, "h", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 268
        });
        Object.defineProperty(this, "hero", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "owned", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "inParty", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // ── 图层字段 ──
        Object.defineProperty(this, "shadowLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 0
        Object.defineProperty(this, "neonGlow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 1
        Object.defineProperty(this, "bodySprite", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 2
        Object.defineProperty(this, "bg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 3 (边框)
        Object.defineProperty(this, "cornerDeco", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 3.5
        Object.defineProperty(this, "portrait", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 4
        Object.defineProperty(this, "barSprite", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 5
        Object.defineProperty(this, "bottomBar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 5 fallback
        Object.defineProperty(this, "nameTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 6
        Object.defineProperty(this, "subTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 6
        Object.defineProperty(this, "rarityRibbon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 7
        Object.defineProperty(this, "rarityRibbonBg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rarityRibbonTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "elementBadge", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 7
        Object.defineProperty(this, "elementBadgeBg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "elementBadgeTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "glow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 8 (外部可控)
        Object.defineProperty(this, "lockOverlay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 9
        Object.defineProperty(this, "lockBg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lockTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "partyBadge", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Layer 9
        Object.defineProperty(this, "partyBadgeBg", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "partyBadgeTxt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Texture 缓存
        Object.defineProperty(this, "bodyTex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "barTex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.hero = hero;
        this.owned = owned;
        const rc = rarityColor(hero.rarity);
        // ── Layer 0: 投影 ──
        this.shadowLayer = new Graphics();
        this.addChild(this.shadowLayer);
        // ── Layer 1: 稀有度外发光 ──
        this.neonGlow = new Graphics();
        this.addChild(this.neonGlow);
        // ── Layer 2: 卡片主体渐变 ──
        this.bodySprite = new Sprite();
        this.addChild(this.bodySprite);
        this.bodyTex = makeCardBodyTexture(this.w, this.h, lighten(0x0e1733, 0.08), // 顶部稍亮
        darken(0x0e1733, 0.15), // 底部更深
        18);
        this.bodySprite.texture = this.bodyTex;
        // ── Layer 3: 边框 ──
        this.bg = new Graphics();
        this.addChild(this.bg);
        // ── Layer 3.5: 角装饰 ──
        this.cornerDeco = new Graphics();
        this.addChild(this.cornerDeco);
        // ── Layer 4: 头像 ──
        this.portrait = new Container();
        this.addChild(this.portrait);
        // ── Layer 5: 底部信息条 ──
        this.bottomBar = new Graphics();
        this.addChild(this.bottomBar);
        this.barSprite = new Sprite();
        this.addChild(this.barSprite);
        const barW = this.w - 20;
        const barH = 72;
        this.barTex = makeBarTexture(barW, barH, darken(rc, 0.3), darken(rc, 0.6), 16);
        this.barSprite.texture = this.barTex;
        // ── Layer 6: 文字 ──
        this.nameTxt = createText(hero.name, 24, 0xffffff, '800');
        this.nameTxt.anchor.set(0, 0.5);
        this.addChild(this.nameTxt);
        this.subTxt = createText('', 18, 0xcfe3ff, '700');
        this.subTxt.anchor.set(0, 0.5);
        this.addChild(this.subTxt);
        // ── Layer 7: 稀有度标签 ──
        this.rarityRibbon = new Container();
        this.rarityRibbon.zIndex = 60;
        this.rarityRibbonBg = new Graphics();
        this.rarityRibbonTxt = createText(rarityLabel(hero.rarity), 16, 0xffffff, '900');
        this.rarityRibbonTxt.anchor.set(0.5);
        this.rarityRibbon.addChild(this.rarityRibbonBg, this.rarityRibbonTxt);
        this.addChild(this.rarityRibbon);
        // ── Layer 7: 属性徽章 ──
        this.elementBadge = new Container();
        this.elementBadge.zIndex = 60;
        this.elementBadgeBg = new Graphics();
        this.elementBadgeTxt = createText(String(hero.element || '').slice(0, 1), 16, 0xffffff, '900');
        this.elementBadgeTxt.anchor.set(0.5);
        this.elementBadge.addChild(this.elementBadgeBg, this.elementBadgeTxt);
        this.addChild(this.elementBadge);
        // ── Layer 8: 呼吸发光层（外部可控 alpha） ──
        this.glow = new Graphics();
        this.addChild(this.glow);
        // ── Layer 9: 锁定遮罩 ──
        this.lockOverlay = new Container();
        this.lockOverlay.zIndex = 80;
        this.lockBg = new Graphics();
        this.lockTxt = createText('未拥有', 20, 0xffffff, '900');
        this.lockTxt.anchor.set(0.5);
        this.lockOverlay.addChild(this.lockBg, this.lockTxt);
        this.addChild(this.lockOverlay);
        // ── Layer 9: 上阵徽章 ──
        this.partyBadge = new Container();
        this.partyBadge.zIndex = 50;
        this.partyBadgeBg = new Graphics();
        this.partyBadgeTxt = createText('上阵中', 16, 0xffffff, '900');
        this.partyBadgeTxt.anchor.set(0.5);
        this.partyBadge.addChild(this.partyBadgeBg, this.partyBadgeTxt);
        this.addChild(this.partyBadge);
        this.interactive = true;
        this.cursor = 'pointer';
        this.draw();
        this.refresh();
    }
    // ══════════════════════════════════════════════════════
    // ★ 核心绘制
    // ══════════════════════════════════════════════════════
    draw() {
        const w = this.w;
        const h = this.h;
        const radius = 18;
        const rc = rarityColor(this.hero.rarity);
        const ec = elementColor(this.hero.element);
        const isHigh = this.hero.rarity === RARITY.SSR || this.hero.rarity === RARITY.SP;
        const isSP = this.hero.rarity === RARITY.SP;
        // ────────────────────────────────────────────────────
        // Layer 0: 投影
        // ────────────────────────────────────────────────────
        this.shadowLayer.clear();
        // 第一层：宽阴影
        this.shadowLayer.beginFill(0x000000, 0.25);
        roundedRect(this.shadowLayer, 4, 6, w, h, radius);
        this.shadowLayer.endFill();
        // 第二层：窄阴影（更深）
        this.shadowLayer.beginFill(0x000000, 0.15);
        roundedRect(this.shadowLayer, 2, 10, w + 2, h - 2, radius + 2);
        this.shadowLayer.endFill();
        // ────────────────────────────────────────────────────
        // Layer 1: 稀有度外发光（霓虹多层）
        // ────────────────────────────────────────────────────
        this.neonGlow.clear();
        const glowCfg = rarityGlowConfig(this.hero.rarity);
        for (const layer of glowCfg.layers) {
            this.neonGlow.lineStyle(layer.lineW, rc, layer.alpha);
            roundedRect(this.neonGlow, -layer.expand, -layer.expand, w + layer.expand * 2, h + layer.expand * 2, radius + layer.expand * 0.4);
        }
        // ────────────────────────────────────────────────────
        // Layer 3: 边框（金属双线）
        // ────────────────────────────────────────────────────
        this.bg.clear();
        // 外层暗边
        this.bg.lineStyle(3, darken(rc, 0.4), 0.8);
        roundedRect(this.bg, 0, 0, w, h, radius);
        // 内层亮边
        this.bg.lineStyle(1.5, rc, isHigh ? 0.9 : 0.6);
        roundedRect(this.bg, 2, 2, w - 4, h - 4, radius - 1);
        // SP 金色：额外顶部光带
        if (isSP) {
            this.bg.lineStyle(1, 0xffffff, 0.12);
            const g = this.bg;
            g.moveTo(radius + 6, 3);
            g.lineTo(w - radius - 6, 3);
        }
        // ────────────────────────────────────────────────────
        // Layer 3.5: 角装饰（SSR / SP）
        // ────────────────────────────────────────────────────
        this.cornerDeco.clear();
        if (isHigh) {
            const dLen = 18; // 装饰线长度
            const dOff = 6; // 距角偏移
            const dColor = isSP ? 0xffd700 : rc;
            const dAlpha = isSP ? 0.7 : 0.5;
            this.cornerDeco.lineStyle(2, dColor, dAlpha);
            // 左上角
            this.cornerDeco.moveTo(dOff, dOff + dLen);
            this.cornerDeco.lineTo(dOff, dOff);
            this.cornerDeco.lineTo(dOff + dLen, dOff);
            // 右上角
            this.cornerDeco.moveTo(w - dOff - dLen, dOff);
            this.cornerDeco.lineTo(w - dOff, dOff);
            this.cornerDeco.lineTo(w - dOff, dOff + dLen);
            // 左下角
            this.cornerDeco.moveTo(dOff, h - dOff - dLen);
            this.cornerDeco.lineTo(dOff, h - dOff);
            this.cornerDeco.lineTo(dOff + dLen, h - dOff);
            // 右下角
            this.cornerDeco.moveTo(w - dOff - dLen, h - dOff);
            this.cornerDeco.lineTo(w - dOff, h - dOff);
            this.cornerDeco.lineTo(w - dOff, h - dOff - dLen);
        }
        // ────────────────────────────────────────────────────
        // Layer 4: 头像区域
        // ────────────────────────────────────────────────────
        this.portrait.removeChildren();
        // 暗底
        const p = new Graphics();
        p.beginFill(0x000000, 0.30);
        roundedRect(p, 14, 14, w - 28, 150, 16);
        p.endFill();
        // 属性辐射光（从中心向外衰减）
        const radGlow = new Graphics();
        const cx = w / 2;
        const cy = 14 + 75;
        const rings = 5;
        for (let i = rings; i >= 0; i--) {
            const t = i / rings;
            const r = 55 * t;
            const alpha = 0.12 * (1 - t) * (1 - t);
            radGlow.beginFill(ec, alpha);
            radGlow.drawCircle(cx, cy, Math.max(1, r));
            radGlow.endFill();
        }
        radGlow.blendMode = BLEND_MODES.ADD;
        // 角色环
        const ring = new Graphics();
        // 外环暗边
        ring.lineStyle(7, darken(ec, 0.5), 0.6);
        ring.drawCircle(cx, cy, 51);
        // 主环
        ring.lineStyle(5, ec, 0.95);
        ring.beginFill(0xffffff, 0.08);
        ring.drawCircle(cx, cy, 50);
        ring.endFill();
        // 内环高光
        ring.lineStyle(1, lighten(ec, 0.4), 0.3);
        ring.drawCircle(cx, cy, 46);
        // 首字母
        const letter = createText(this.hero.name.slice(0, 1), 54, 0xffffff, '900');
        letter.anchor.set(0.5);
        letter.position.set(cx, cy);
        this.portrait.addChild(p, radGlow, ring, letter);
        // ────────────────────────────────────────────────────
        // Layer 5: 渐变底部信息条
        // ────────────────────────────────────────────────────
        const barH = 72;
        const barX = 10;
        const barY = h - barH - 10;
        const barW = w - 20;
        this.bottomBar.clear();
        // 不再用 bottomBar Graphics 填充，改用 barSprite 渐变
        this.barSprite.position.set(barX, barY);
        // 底部条顶部细分割线（稀有度色）
        this.bottomBar.lineStyle(1, rc, 0.3);
        this.bottomBar.moveTo(barX + 8, barY);
        this.bottomBar.lineTo(barX + barW - 8, barY);
        // 文字定位
        this.nameTxt.position.set(18, barY + 22);
        this.subTxt.position.set(18, barY + 48);
        // ────────────────────────────────────────────────────
        // Layer 7: 稀有度标签
        // ────────────────────────────────────────────────────
        const rrW = 70;
        const rrH = 26;
        this.rarityRibbon.position.set(12, 12);
        this.rarityRibbonBg.clear();
        // 标签底色渐变效果（用两层模拟）
        this.rarityRibbonBg.beginFill(darken(rc, 0.3), 0.95);
        roundedRect(this.rarityRibbonBg, 0, 0, rrW, rrH, 10);
        this.rarityRibbonBg.endFill();
        // 上半高光
        this.rarityRibbonBg.beginFill(rc, 0.6);
        roundedRect(this.rarityRibbonBg, 1, 1, rrW - 2, rrH / 2, 9);
        this.rarityRibbonBg.endFill();
        // 边框
        this.rarityRibbonBg.lineStyle(1, lighten(rc, 0.3), 0.5);
        roundedRect(this.rarityRibbonBg, 0, 0, rrW, rrH, 10);
        this.rarityRibbonTxt.position.set(rrW / 2, rrH / 2 + 0.5);
        // ────────────────────────────────────────────────────
        // Layer 7: 属性徽章
        // ────────────────────────────────────────────────────
        const ebR = 16;
        this.elementBadge.position.set(w - 12 - ebR * 2, 12);
        this.elementBadgeBg.clear();
        // 暗底
        this.elementBadgeBg.beginFill(0x0e1733, 0.9);
        this.elementBadgeBg.drawRoundedRect(0, 0, ebR * 2, ebR * 2, ebR);
        this.elementBadgeBg.endFill();
        // 属性色边框
        this.elementBadgeBg.lineStyle(3, ec, 1);
        this.elementBadgeBg.drawRoundedRect(0, 0, ebR * 2, ebR * 2, ebR);
        // 内圈高光
        this.elementBadgeBg.lineStyle(1, lighten(ec, 0.4), 0.25);
        this.elementBadgeBg.drawRoundedRect(2, 2, ebR * 2 - 4, ebR * 2 - 4, ebR - 1);
        this.elementBadgeTxt.position.set(ebR, ebR + 0.5);
        // ────────────────────────────────────────────────────
        // Layer 8: 呼吸发光层
        // 注意：外部通过 card.glow.alpha 控制此层透明度做呼吸动画
        // ────────────────────────────────────────────────────
        this.glow.clear();
        // 多层内发光
        const glowInset = 4;
        // 外圈柔光
        this.glow.beginFill(rc, 0.06);
        roundedRect(this.glow, glowInset, glowInset, w - glowInset * 2, h - glowInset * 2, 16);
        this.glow.endFill();
        // 边缘线发光
        this.glow.lineStyle(3, rc, 0.15);
        roundedRect(this.glow, glowInset + 2, glowInset + 2, w - glowInset * 2 - 4, h - glowInset * 2 - 4, 14);
        // SP/SSR额外强发光
        if (isHigh) {
            this.glow.lineStyle(6, rc, 0.08);
            roundedRect(this.glow, -2, -2, w + 4, h + 4, radius + 1);
        }
        // ────────────────────────────────────────────────────
        // Layer 9: 上阵徽章
        // ────────────────────────────────────────────────────
        const bw = 74;
        const bh = 28;
        this.partyBadge.position.set(w - 14 - bw, 12);
        this.partyBadgeBg.clear();
        this.partyBadgeBg.beginFill(darken(0x2bc26b, 0.2), 0.95);
        roundedRect(this.partyBadgeBg, 0, 0, bw, bh, 10);
        this.partyBadgeBg.endFill();
        // 高光
        this.partyBadgeBg.beginFill(0x2bc26b, 0.5);
        roundedRect(this.partyBadgeBg, 1, 1, bw - 2, bh / 2, 9);
        this.partyBadgeBg.endFill();
        this.partyBadgeBg.lineStyle(1, lighten(0x2bc26b, 0.3), 0.4);
        roundedRect(this.partyBadgeBg, 0, 0, bw, bh, 10);
        this.partyBadgeTxt.position.set(bw / 2, bh / 2 + 0.5);
        // ────────────────────────────────────────────────────
        // Layer 9: 锁定遮罩
        // ────────────────────────────────────────────────────
        this.lockBg.clear();
        this.lockBg.beginFill(0x000000, 0.45);
        roundedRect(this.lockBg, 6, 6, w - 12, h - 12, 16);
        this.lockBg.endFill();
        // 锁图标圆底
        this.lockBg.beginFill(0x000000, 0.35);
        this.lockBg.drawCircle(w / 2, h / 2, 30);
        this.lockBg.endFill();
        this.lockBg.lineStyle(2, 0xffffff, 0.15);
        this.lockBg.drawCircle(w / 2, h / 2, 30);
        this.lockTxt.position.set(w / 2, h / 2);
    }
    // ── 公开 API ──
    setOwned(owned) {
        this.owned = owned;
        this.refresh();
    }
    setInParty(inParty) {
        this.inParty = !!inParty;
        this.refresh();
    }
    refresh() {
        if (this.owned) {
            const lv = this.owned.level || 1;
            const stars = Math.max(0, Math.min(5, this.owned.stars || 0));
            const starStr = stars > 0 ? ' ' + '★'.repeat(stars) : '';
            this.subTxt.text = `Lv.${lv}${starStr}`;
            this.alpha = 1;
        }
        else {
            this.subTxt.text = '';
            this.alpha = 0.6;
        }
        this.partyBadge.visible = this.inParty;
        this.lockOverlay.visible = !this.owned;
    }
    // ── 销毁 ──
    destroy() {
        this.bodyTex?.destroy(true);
        this.barTex?.destroy(true);
        this.bodyTex = null;
        this.barTex = null;
        super.destroy({ children: true });
    }
}
