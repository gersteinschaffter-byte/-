import { Container, Graphics, Text } from 'pixi.js';
import UIButton from './UIButton';
import { createText, formatNumber } from '../uiFactory';
import { openDevPanel } from './DevPanel';
import type GameApp from '../../core/GameApp';
import { theme } from '../theme';
import { getSafeAreaInsets } from '../safeArea';
import { getResponsivePadding } from '../responsive';

/**
 * 优化后的顶部导航栏
 * 
 * 改进点:
 * 1. 响应式布局（百分比而非固定像素）
 * 2. 安全区域适配（iOS刘海屏）
 * 3. 更清晰的视觉层级
 * 4. 货币信息独立一行，可选显示
 */
export default class TopBar extends Container {
  private readonly game: GameApp;
  
  // 导航层（返回/设置）
  private readonly navRow: Container;
  private readonly navBg: Graphics;
  private readonly backBtn: UIButton;
  private readonly resetBtn: UIButton;
  
  // 货币层
  private readonly currencyRow: Container;
  private readonly currencyBg: Graphics;
  private readonly diamondTxt: Text;
  private readonly goldTxt: Text;
  
  private currencyVisible = true;

  constructor(game: GameApp) {
    super();
    this.game = game;

    // === 导航层 ===
    this.navRow = new Container();
    this.navBg = new Graphics();
    this.navRow.addChild(this.navBg);
    
    this.backBtn = new UIButton('← 返回', 140, 52);
    this.backBtn.txt.style.fontSize = 24;
    this.backBtn.on('pointertap', () => this.game.goTo('home', { animate: false }));
    this.backBtn.visible = false;
    this.navRow.addChild(this.backBtn);
    
    this.resetBtn = new UIButton('⚙', 56, 52);
    this.resetBtn.txt.style.fontSize = 26;
    // Gear now opens the Dev Panel (includes reset, logs, etc.)
    this.resetBtn.on('pointertap', () => openDevPanel(this.game));
    this.navRow.addChild(this.resetBtn);
    
    this.addChild(this.navRow);

    // === 货币层 ===
    this.currencyRow = new Container();
    this.currencyBg = new Graphics();
    this.currencyRow.addChild(this.currencyBg);
    
    this.diamondTxt = createText('', 22, theme.colors.text.secondary, '700');
    this.diamondTxt.anchor.set(0, 0.5);
    
    this.goldTxt = createText('', 22, theme.colors.text.secondary, '700');
    this.goldTxt.anchor.set(0, 0.5);
    
    this.currencyRow.addChild(this.diamondTxt, this.goldTxt);
    this.addChild(this.currencyRow);

    // Data-driven: subscribe to state changes.
    this.game.state.on('currencyChanged', (p) => {
      this.diamondTxt.text = '💎 ' + formatNumber(p.diamonds);
      this.goldTxt.text = '🪙 ' + formatNumber(p.gold);
    });

    // Initial render
    const s = this.game.state.getSnapshot();
    this.diamondTxt.text = '💎 ' + formatNumber(s.diamonds);
    this.goldTxt.text = '🪙 ' + formatNumber(s.gold);
  }

  public setBackVisible(visible: boolean): void {
    this.backBtn.visible = visible;
  }
  
  public setCurrencyVisible(visible: boolean): void {
    this.currencyVisible = visible;
    this.currencyRow.visible = visible;
  }

  public resize(w: number, _h: number): void {
    const insets = getSafeAreaInsets();
    const padding = getResponsivePadding(w);
    const navHeight = theme.layout.topBarHeight;
    const currencyHeight = this.currencyVisible ? theme.layout.topBarCurrencyHeight : 0;
    
    // === 导航层布局 ===
    this.navBg.clear();
    this.navBg.beginFill(theme.colors.background.elevated, 0.95);
    this.navBg.drawRect(0, 0, w, navHeight);
    this.navBg.endFill();
    
    this.navRow.position.set(0, insets.top);
    
    // 按钮位置 - 响应式间距
    this.backBtn.position.set(padding, (navHeight - 52) / 2);
    this.resetBtn.position.set(w - padding - 56, (navHeight - 52) / 2);
    
    // === 货币层布局 ===
    if (this.currencyVisible) {
      this.currencyBg.clear();
      this.currencyBg.beginFill(theme.colors.background.elevated, 0.85);
      this.currencyBg.drawRect(0, 0, w, currencyHeight);
      this.currencyBg.endFill();
      
      // 添加顶部分隔线
      this.currencyBg.lineStyle(1, theme.colors.border.subtle, 0.3);
      this.currencyBg.moveTo(padding, 0);
      this.currencyBg.lineTo(w - padding, 0);
      
      this.currencyRow.position.set(0, insets.top + navHeight);
      
      // 货币信息居中排列，留出更多呼吸空间
      const currencySpacing = Math.min(w * 0.4, 200);
      const centerX = w / 2;
      this.diamondTxt.position.set(centerX - currencySpacing / 2, currencyHeight / 2);
      this.goldTxt.position.set(centerX + currencySpacing / 2, currencyHeight / 2);
    }
  }

  // 获取总高度（用于其他组件布局）
  public getTotalHeight(): number {
    const insets = getSafeAreaInsets();
    const currencyHeight = this.currencyVisible ? theme.layout.topBarCurrencyHeight : 0;
    return insets.top + theme.layout.topBarHeight + currencyHeight;
  }
}
