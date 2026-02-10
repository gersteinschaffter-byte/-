import { Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import { createText, roundedRect } from '../uiFactory';
import { theme, darken, lighten } from '../theme';

// ============================================================================
// UIButton v0.80 — 商业手游级按钮组件
//
// 视觉分层（从后到前）:
//   Layer 0: 多层外发光（霓虹辉光，3层递减）
//   Layer 1: 投影（按钮底部柔和阴影）
//   Layer 2: 主体填充（canvas 纵向渐变 texture）
//   Layer 3: 金属双线边框（外暗内亮）
//   Layer 4: 顶部高光条（玻璃质感白色渐变）
//   Layer 5: 底部暗边（增加立体感）
//   Layer 6: 文字（带投影）
//
// 交互状态:
//   Normal  → 低强度外发光 + 标准渐变
//   Hover   → 高强度外发光 + 亮色渐变 + 边框变亮
//   Pressed → 缩放0.94 + 渐变反转（暗→亮） + 内阴影 + 外发光消失
//   Disabled→ 整体半透明 + 灰化
// ============================================================================

/** 辅助：hex 拆 [r,g,b] */
function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/** 辅助：生成纵向渐变 canvas → Texture (缓存友好) */
function makeGradientTexture(
  w: number,
  h: number,
  topColor: number,
  bottomColor: number,
  radius: number,
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d')!;

  // 纵向渐变
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  const [r1, g1, b1] = hexToRgb(topColor);
  const [r2, g2, b2] = hexToRgb(bottomColor);
  grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
  grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);

  // 带圆角的填充
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

/** 辅助：生成顶部高光条 canvas → Texture */
function makeHighlightTexture(w: number, h: number, radius: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.beginPath();
  const rr = Math.min(radius, w / 2, h / 2);
  ctx.moveTo(rr, 0);
  ctx.lineTo(w - rr, 0);
  ctx.quadraticCurveTo(w, 0, w, rr);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.lineTo(0, rr);
  ctx.quadraticCurveTo(0, 0, rr, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  return Texture.from(canvas);
}

export default class UIButton extends Container {
  public readonly w: number;
  public readonly h: number;
  public readonly bg: Graphics;
  public readonly glow: Graphics;
  public readonly txt: Text;
  private _hover = false;
  private _pressed = false;
  private _disabled = false;

  // ★ v0.80 新增内部图层
  private readonly shadowLayer: Graphics;       // 投影
  private readonly gradientSprite: Sprite;       // 渐变填充
  private readonly borderLayer: Graphics;        // 金属边框
  private readonly highlightSprite: Sprite;      // 顶部高光
  private readonly bottomEdge: Graphics;         // 底部暗边
  private readonly innerShadow: Graphics;        // 按压内阴影

  // Texture 缓存（避免每次 draw 创建）
  private normalTex: Texture | null = null;
  private hoverTex: Texture | null = null;
  private pressedTex: Texture | null = null;
  private highlightTex: Texture | null = null;

  constructor(label: string, w = 260, h = 86) {
    super();
    this.w = w;
    this.h = h;

    const radius = 22;

    // ── Layer 0: 外发光 ──
    this.glow = new Graphics();
    this.addChild(this.glow);

    // ── Layer 1: 投影 ──
    this.shadowLayer = new Graphics();
    this.addChild(this.shadowLayer);

    // ── Layer 2: 渐变填充（Sprite） ──
    this.gradientSprite = new Sprite();
    this.addChild(this.gradientSprite);

    // ── Layer 3: 金属边框（bg 保持公开名，兼容外部引用） ──
    this.bg = new Graphics();
    this.addChild(this.bg);

    // ── Layer 3.5: 边框绘制层 ──
    this.borderLayer = new Graphics();
    this.addChild(this.borderLayer);

    // ── Layer 4: 顶部高光 ──
    this.highlightSprite = new Sprite();
    this.addChild(this.highlightSprite);

    // ── Layer 5: 底部暗边 ──
    this.bottomEdge = new Graphics();
    this.addChild(this.bottomEdge);

    // ── Layer 5.5: 按压内阴影 ──
    this.innerShadow = new Graphics();
    this.addChild(this.innerShadow);

    // ── Layer 6: 文字 ──
    this.txt = createText(label, 30, theme.colors.text.primary, '800');
    this.txt.anchor.set(0.5);
    this.txt.position.set(w / 2, h / 2);
    this.addChild(this.txt);

    // 预生成 textures
    this.buildTextures(radius);

    // 交互
    this.interactive = true;
    this.cursor = 'pointer';
    this.on('pointerdown', () => this.setPressed(true));
    this.on('pointerup', () => this.setPressed(false));
    this.on('pointerupoutside', () => this.setPressed(false));
    this.on('pointerover', () => this.setHover(true));
    this.on('pointerout', () => this.setHover(false));

    this.draw();
  }

  // ── 预生成所有 texture（构造时调用一次） ──

  private buildTextures(radius: number): void {
    const { buttonFace, buttonFaceHover } = theme.gradients;
    const w = this.w;
    const h = this.h;

    // Normal 渐变
    this.normalTex = makeGradientTexture(w, h, buttonFace.top, buttonFace.bottom, radius);

    // Hover 渐变（更亮）
    this.hoverTex = makeGradientTexture(w, h, buttonFaceHover.top, buttonFaceHover.bottom, radius);

    // Pressed 渐变（反转：暗→亮）
    this.pressedTex = makeGradientTexture(
      w, h,
      darken(buttonFace.bottom, 0.2),
      lighten(buttonFace.top, 0.05),
      radius,
    );

    // 高光条（上半部分）
    this.highlightTex = makeHighlightTexture(w, Math.round(h * 0.45), radius);
  }

  // ── 公开 API（保持不变） ──

  public setLabel(label: string): void {
    this.txt.text = label;
    this.fitLabel();
  }

  private fitLabel(): void {
    const maxW = Math.max(10, this.w - 24);
    this.txt.scale.set(1);
    if (this.txt.width > maxW) {
      const r = maxW / this.txt.width;
      this.txt.scale.set(Math.max(0.72, Math.min(1, r)));
    }
    this.txt.position.set(this.w / 2, this.h / 2);
  }

  public setDisabled(disabled: boolean): void {
    const next = !!disabled;
    if (this._disabled === next) return;
    this._disabled = next;

    this.interactive = !next;
    this.cursor = next ? 'default' : 'pointer';
    if (next) {
      this._hover = false;
      this._pressed = false;
      this.alpha = 0.5;
    } else {
      this.alpha = 1;
    }
    this.draw();
  }

  private setHover(v: boolean): void {
    if (this._disabled) return;
    this._hover = v;
    this.draw();
  }

  private setPressed(v: boolean): void {
    if (this._disabled) return;
    this._pressed = v;
    this.draw();
  }

  // ══════════════════════════════════════════════════════
  // ★ 核心绘制方法 — 商业级视觉
  // ══════════════════════════════════════════════════════

  private draw(): void {
    const w = this.w;
    const h = this.h;
    const radius = 22;
    const colors = theme.colors;
    const glowCfg = theme.glow.button;

    // ── 状态判定 ──
    const isDisabled = this._disabled;
    const isPressed = this._pressed && !isDisabled;
    const isHover = this._hover && !isPressed && !isDisabled;
    const isNormal = !isDisabled && !isPressed && !isHover;

    // ── 确定颜色 ──
    let borderBright = colors.border.subtle;
    let borderDark = darken(colors.border.subtle, 0.5);
    let glowColor = glowCfg.color;

    if (isPressed) {
      borderBright = colors.accent;
      borderDark = darken(colors.accent, 0.4);
      glowColor = colors.accent;
    } else if (isHover) {
      borderBright = colors.border.light;
      borderDark = darken(colors.border.light, 0.3);
      glowColor = lighten(glowCfg.color, 0.2);
    }

    // ────────────────────────────────────────────────────
    // Layer 0: 多层外发光（霓虹辉光）
    // ────────────────────────────────────────────────────
    this.glow.clear();

    if (!isDisabled && !isPressed) {
      // 3层递减发光，从外到内
      const glowLayers = isHover
        ? [
            { expand: 16, alpha: 0.25, lineW: 12 },
            { expand: 10, alpha: 0.18, lineW: 8 },
            { expand: 5,  alpha: 0.10, lineW: 4 },
          ]
        : [
            // Normal 状态也有微弱辉光（呼吸感）
            { expand: 10, alpha: 0.08, lineW: 6 },
            { expand: 5,  alpha: 0.05, lineW: 3 },
          ];

      for (const layer of glowLayers) {
        this.glow.lineStyle(layer.lineW, glowColor, layer.alpha);
        roundedRect(
          this.glow,
          -layer.expand,
          -layer.expand,
          w + layer.expand * 2,
          h + layer.expand * 2,
          radius + layer.expand * 0.5,
        );
      }

      // Hover 时额外加一层内侧柔光
      if (isHover) {
        this.glow.lineStyle(2, 0xffffff, 0.08);
        roundedRect(this.glow, 2, 2, w - 4, h - 4, radius - 1);
      }
    }

    // ────────────────────────────────────────────────────
    // Layer 1: 投影
    // ────────────────────────────────────────────────────
    this.shadowLayer.clear();

    if (!isPressed) {
      // 柔和底部投影
      this.shadowLayer.beginFill(0x000000, 0.30);
      roundedRect(this.shadowLayer, 3, 5, w, h, radius);
      this.shadowLayer.endFill();

      this.shadowLayer.beginFill(0x000000, 0.15);
      roundedRect(this.shadowLayer, 1, 8, w + 2, h, radius + 2);
      this.shadowLayer.endFill();
    }

    // ────────────────────────────────────────────────────
    // Layer 2: 渐变填充（切换 texture）
    // ────────────────────────────────────────────────────
    if (isPressed && this.pressedTex) {
      this.gradientSprite.texture = this.pressedTex;
    } else if (isHover && this.hoverTex) {
      this.gradientSprite.texture = this.hoverTex;
    } else if (this.normalTex) {
      this.gradientSprite.texture = this.normalTex;
    }
    this.gradientSprite.position.set(0, 0);

    // ────────────────────────────────────────────────────
    // Layer 3: 金属双线边框
    // ────────────────────────────────────────────────────
    this.bg.clear();
    this.borderLayer.clear();

    // 外层暗边（阴刻效果）
    this.borderLayer.lineStyle(3, borderDark, 0.8);
    roundedRect(this.borderLayer, 0, 0, w, h, radius);

    // 内层亮边（高光）
    this.borderLayer.lineStyle(1.5, borderBright, isHover ? 0.9 : 0.6);
    roundedRect(this.borderLayer, 1.5, 1.5, w - 3, h - 3, radius - 1);

    // Hover 时顶部额外一条极细白线
    if (isHover) {
      this.borderLayer.lineStyle(1, 0xffffff, 0.15);
      // 只画顶部弧线部分
      const g = this.borderLayer;
      g.moveTo(radius + 4, 2);
      g.lineTo(w - radius - 4, 2);
    }

    // ────────────────────────────────────────────────────
    // Layer 4: 顶部高光条
    // ────────────────────────────────────────────────────
    if (this.highlightTex) {
      this.highlightSprite.texture = this.highlightTex;
      this.highlightSprite.position.set(0, 0);
      this.highlightSprite.alpha = isPressed ? 0.2 : 1;
    }

    // ────────────────────────────────────────────────────
    // Layer 5: 底部暗边（立体感）
    // ────────────────────────────────────────────────────
    this.bottomEdge.clear();

    if (!isPressed) {
      this.bottomEdge.beginFill(0x000000, 0.20);
      // 底部条
      const edgeH = 6;
      roundedRect(this.bottomEdge, 4, h - edgeH - 2, w - 8, edgeH, 3);
      this.bottomEdge.endFill();
    }

    // ────────────────────────────────────────────────────
    // Layer 5.5: 按压内阴影
    // ────────────────────────────────────────────────────
    this.innerShadow.clear();

    if (isPressed) {
      // 顶部内阴影（凹陷感）
      this.innerShadow.beginFill(0x000000, 0.35);
      roundedRect(this.innerShadow, 3, 3, w - 6, 12, radius - 2);
      this.innerShadow.endFill();

      // 整体内边缘暗化
      this.innerShadow.lineStyle(2, 0x000000, 0.25);
      roundedRect(this.innerShadow, 3, 3, w - 6, h - 6, radius - 2);
    }

    // ────────────────────────────────────────────────────
    // 缩放 + 文字颜色
    // ────────────────────────────────────────────────────
    this.scale.set(isPressed ? 0.94 : 1);

    if (isDisabled) {
      (this.txt.style as any).fill = colors.text.disabled;
    } else if (isPressed) {
      // 按下时文字微微下移 1px（物理反馈）
      this.txt.position.set(this.w / 2, this.h / 2 + 1);
      (this.txt.style as any).fill = colors.text.secondary;
    } else {
      this.txt.position.set(this.w / 2, this.h / 2);
      (this.txt.style as any).fill = colors.text.primary;
    }
  }

  // ── 销毁 ──

  public override destroy(): void {
    this.normalTex?.destroy(true);
    this.hoverTex?.destroy(true);
    this.pressedTex?.destroy(true);
    this.highlightTex?.destroy(true);
    this.normalTex = null;
    this.hoverTex = null;
    this.pressedTex = null;
    this.highlightTex = null;
    super.destroy({ children: true });
  }
}
