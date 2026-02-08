import { Container, Graphics, Text } from 'pixi.js';
import { roundedRect } from '../uiFactory';
import { createText } from '../uiFactory';
import type { SceneKey } from '../../core/types';
import { theme } from '../theme';
import { getSafeAreaInsets } from '../safeArea';
import { getResponsivePadding } from '../responsive';

/**
 * 优化后的TabButton - 横向布局
 * 图标和文字并排，节省垂直空间
 */
class TabButton extends Container {
  public w: number;
  public h: number;
  private selected = false;
  private isHover = false;
  private isPressed = false;
  private readonly bg: Graphics;
  private readonly glow: Graphics;
  private readonly iconTxt: Text;
  private readonly labTxt: Text;
  private readonly layout: 'horizontal' | 'vertical';

  constructor(icon: string, label: string, w = 160, h = 64, layout: 'horizontal' | 'vertical' = 'horizontal') {
    super();
    this.w = w;
    this.h = h;
    this.layout = layout;
    
    // 外发光
    this.glow = new Graphics();
    this.addChild(this.glow);
    
    // 背景
    this.bg = new Graphics();
    this.addChild(this.bg);

    // 图标
    this.iconTxt = createText(icon, 28, theme.colors.text.tertiary, '900');
    this.iconTxt.anchor.set(0.5);
    this.addChild(this.iconTxt);

    // 文字
    this.labTxt = createText(label, 18, theme.colors.text.secondary, '700');
    this.labTxt.anchor.set(0.5);
    this.addChild(this.labTxt);

    this.interactive = true;
    this.cursor = 'pointer';
    this.on('pointerdown', () => this.press(true));
    this.on('pointerup', () => this.press(false));
    this.on('pointerupoutside', () => this.press(false));
    this.on('pointerover', () => this.hover(true));
    this.on('pointerout', () => this.hover(false));

    this.draw();
  }

  public setSelected(v: boolean): void {
    this.selected = v;
    this.draw();
  }

  private hover(v: boolean): void {
    this.isHover = v;
    this.draw();
  }

  private press(v: boolean): void {
    this.isPressed = v;
    this.draw();
  }

  public draw(): void {
    const w = this.w;
    const h = this.h;
    
    this.glow.clear();
    this.bg.clear();

    // 颜色选择
    const colors = theme.colors;
    const baseColor = this.selected ? colors.primaryLight : colors.primaryDark;
    const borderColor = this.selected 
      ? colors.accentBright 
      : this.isHover 
        ? colors.border.light 
        : colors.border.subtle;
    const glowAlpha = this.selected ? 0.25 : this.isHover ? 0.18 : 0.08;

    // 外发光
    this.glow.lineStyle(8, borderColor, glowAlpha);
    roundedRect(this.glow, 2, 3, w - 4, h - 6, 18);

    // 主背景
    this.bg.lineStyle(2, borderColor, 1);
    this.bg.beginFill(baseColor, 0.98);
    roundedRect(this.bg, 0, 0, w, h, 18);
    this.bg.endFill();

    // 选中时顶部高亮条
    if (this.selected) {
      this.bg.lineStyle(0);
      this.bg.beginFill(colors.accent, 0.8);
      roundedRect(this.bg, w * 0.25, 4, w * 0.5, 3, 2);
      this.bg.endFill();
    }

    // 按压缩放
    this.scale.set(this.isPressed ? 0.95 : 1);

    // 文字颜色
    (this.iconTxt.style as any).fill = this.selected ? colors.text.primary : colors.text.tertiary;
    (this.labTxt.style as any).fill = this.selected ? colors.text.primary : colors.text.secondary;

    // 布局 - 横向排列
    if (this.layout === 'horizontal') {
      const iconX = w * 0.3;
      const labelX = w * 0.65;
      this.iconTxt.position.set(iconX, h / 2);
      this.labTxt.position.set(labelX, h / 2);
    } else {
      // 纵向排列（兼容）
      this.iconTxt.position.set(w / 2, h * 0.35);
      this.labTxt.position.set(w / 2, h * 0.7);
    }
  }
}

/**
 * 优化后的BottomNav
 * 
 * 改进点:
 * 1. 高度从150px降至72px+安全区域
 * 2. 横向图标+文字布局
 * 3. 适配刘海屏和手势栏
 * 4. 响应式间距
 */
export default class BottomNav extends Container {
  private readonly bg: Graphics;
  private readonly tabRow: Container;
  private readonly tabs: Array<{
    key: SceneKey;
    btn: TabButton;
  }>;

  constructor() {
    super();
    this.bg = new Graphics();
    this.addChild(this.bg);

    const tabDefs: Array<{ key: SceneKey; icon: string; label: string }> = [
      { key: 'home', icon: '🏠', label: '主城' },
      { key: 'summon', icon: '🎴', label: '抽卡' },
      { key: 'heroes', icon: '🦸', label: '英雄' },
      { key: 'bag', icon: '🎒', label: '背包' },
    ];

    // 使用横向布局
    this.tabs = tabDefs.map((t) => ({ ...t, btn: new TabButton(t.icon, t.label, 160, 64, 'horizontal') }));

    this.tabRow = new Container();
    this.addChild(this.tabRow);
    for (const t of this.tabs) this.tabRow.addChild(t.btn);
  }

  public bind(onSelect: (key: SceneKey) => void): void {
    for (const t of this.tabs) {
      t.btn.on('pointertap', () => onSelect(t.key));
    }
  }

  public setActive(key: SceneKey): void {
    for (const t of this.tabs) t.btn.setSelected(t.key === key);
  }

  public resize(w: number, h: number): void {
    this.layout(w, h);
  }

  private layout(w: number, h: number): void {
    const insets = getSafeAreaInsets();
    const padding = getResponsivePadding(w);
    
    // 新的紧凑高度
    const barH = theme.layout.bottomNavHeight + insets.bottom;
    const y = h - barH;
    this.position.set(0, y);

    // 背景
    this.bg.clear();
    this.bg.beginFill(theme.colors.background.elevated, 0.95);
    this.bg.lineStyle(2, theme.colors.border.default, 0.5);
    roundedRect(this.bg, padding, 0, w - padding * 2, barH - insets.bottom, 24);
    this.bg.endFill();

    // 顶部装饰线
    this.bg.lineStyle(2, theme.colors.border.light, 0.15);
    this.bg.moveTo(padding + 20, 8);
    this.bg.lineTo(w - padding - 20, 8);

    // 计算Tab按钮尺寸
    const tabPadding = padding + 12;
    const gap = Math.max(8, w * 0.02);
    const totalW = w - tabPadding * 2;
    const btnW = Math.floor((totalW - gap * 3) / 4);
    const btnH = 56; // 紧凑高度

    this.tabRow.position.set(tabPadding, 12);

    // 布局每个Tab
    for (let i = 0; i < this.tabs.length; i++) {
      const b = this.tabs[i].btn;
      b.w = btnW;
      b.h = btnH;
      b.draw();
      b.position.set(i * (btnW + gap), 0);
    }
  }
  
  // 获取总高度（包含安全区域）
  public getTotalHeight(): number {
    const insets = getSafeAreaInsets();
    return theme.layout.bottomNavHeight + insets.bottom;
  }
}
