import { Container, Graphics, Text } from 'pixi.js';
import { createText, roundedRect } from '../uiFactory';
import { theme, darken, lighten } from '../theme';

/**
 * 优化后的按钮组件
 * 
 * 改进点:
 * - 使用主题系统统一颜色
 * - 增强按压反馈（0.94缩放 + 内阴影）
 * - 添加悬停外发光效果
 * - 改进禁用状态视觉
 */
export default class UIButton extends Container {
  public readonly w: number;
  public readonly h: number;
  public readonly bg: Graphics;
  public readonly glow: Graphics;
  public readonly txt: Text;
  private _hover = false;
  private _pressed = false;
  private _disabled = false;

  constructor(label: string, w = 260, h = 86) {
    super();
    this.w = w;
    this.h = h;

    // 外发光层
    this.glow = new Graphics();
    this.addChild(this.glow);

    // 背景层
    this.bg = new Graphics();
    this.addChild(this.bg);

    // 文字层
    this.txt = createText(label, 30, theme.colors.text.primary, '800');
    this.txt.anchor.set(0.5);
    this.txt.position.set(w / 2, h / 2);
    this.addChild(this.txt);

    this.interactive = true;
    this.cursor = 'pointer';
    this.on('pointerdown', () => this.setPressed(true));
    this.on('pointerup', () => this.setPressed(false));
    this.on('pointerupoutside', () => this.setPressed(false));
    this.on('pointerover', () => this.setHover(true));
    this.on('pointerout', () => this.setHover(false));

    this.draw();
  }

  public setLabel(label: string): void {
    this.txt.text = label;
    this.fitLabel();
  }

  private fitLabel(): void {
    // Keep label inside the button without overflowing.
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

  private draw(): void {
    const w = this.w;
    const h = this.h;
    
    // 清空
    this.glow.clear();
    this.bg.clear();

    // 确定颜色
    const colors = theme.colors;
    let baseColor = colors.primary;
    let borderColor = colors.border.subtle;
    
    if (this._disabled) {
      baseColor = colors.state.disabled;
      borderColor = colors.border.subtle;
    } else if (this._pressed) {
      baseColor = colors.state.pressed;
      borderColor = colors.accent;
    } else if (this._hover) {
      baseColor = colors.state.hover;
      borderColor = colors.border.light;
    }

    // 外发光（仅在hover时）
    if (this._hover && !this._pressed && !this._disabled) {
      this.glow.lineStyle(10, borderColor, 0.3);
      roundedRect(this.glow, -5, -5, w + 10, h + 10, 27);
    }

    // 主背景
    this.bg.beginFill(baseColor, 0.98);
    this.bg.lineStyle(3, borderColor, 1);
    roundedRect(this.bg, 0, 0, w, h, 22);
    this.bg.endFill();

    // 内阴影（仅在按下时）
    if (this._pressed && !this._disabled) {
      this.bg.lineStyle(2, 0x000000, 0.4);
      roundedRect(this.bg, 3, 3, w - 6, h - 6, 19);
    }

    // 按压缩放效果 - 增强从0.98到0.94
    this.scale.set(this._pressed ? 0.94 : 1);

    // 文字颜色
    if (this._disabled) {
      (this.txt.style as any).fill = colors.text.disabled;
    } else {
      (this.txt.style as any).fill = colors.text.primary;
    }
  }
}