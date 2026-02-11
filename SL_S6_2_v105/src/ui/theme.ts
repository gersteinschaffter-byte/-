/**
 * Design Token System v0.80
 * 统一的设计变量系统，便于维护和主题切换
 *
 * v0.80 新增：
 * - gradients: 渐变色组（背景、按钮、卡片）
 * - glow: 发光参数
 * - animation: 动画时长
 * - particles: 粒子参数
 */

export const theme = {
  colors: {
    primary: 0x1a2f63,
    primaryDark: 0x0f1d3a,
    primaryLight: 0x223a72,
    secondary: 0x3f6cc7,
    accent: 0x69a8ff,
    accentBright: 0x9bd0ff,
    
    text: {
      primary: 0xffffff,
      secondary: 0xcfe3ff,
      tertiary: 0xd7e6ff,
      disabled: 0x7a8ba8,
    },
    
    background: {
      base: 0x0b1020,
      elevated: 0x071129,
      panel: 0x0e1733,
      overlay: 0x000000,
    },
    
    border: {
      default: 0x2f57a8,
      light: 0x69a8ff,
      subtle: 0x3f6cc7,
    },
    
    state: {
      hover: 0x223a72,
      pressed: 0x1b2e5a,
      disabled: 0x1a2f63,
      success: 0x2bc26b,
      warning: 0xffa726,
      error: 0xff5252,
    },

    // ★ v0.80 新增：稀有度色彩
    rarity: {
      R: 0x8fffa3,
      SR: 0x4bcbff,
      SSR: 0xc46cff,
      SP: 0xffb400,
    },
  },

  // ★ v0.80 新增：渐变色组
  gradients: {
    // 主背景纵向渐变色带（从上到下）
    background: [
      { pos: 0.0,  color: 0x060b1a },
      { pos: 0.25, color: 0x0a1230 },
      { pos: 0.5,  color: 0x0d1b3e },
      { pos: 0.75, color: 0x150e30 },
      { pos: 1.0,  color: 0x0a0818 },
    ],
    // 按钮渐变填充
    buttonFace:      { top: 0x2a4a8a, bottom: 0x1a2f63 },
    buttonFaceHover: { top: 0x3a5a9a, bottom: 0x2a3f73 },
    // 卡片底条
    cardBar: { left: 0x1a2f63, right: 0x69a8ff },
  },

  // ★ v0.80 新增：发光参数
  glow: {
    button: { color: 0x69a8ff, blur: 12, intensity: 0.6 },
    card:   { blur: 8, intensity: 0.4 },
    accent: { color: 0x69a8ff, blur: 20, intensity: 0.3 },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 10,
    md: 18,
    lg: 26,
    xl: 36,
  },

  typography: {
    h1: { size: 48, weight: '900' as const },
    h2: { size: 44, weight: '900' as const },
    h3: { size: 34, weight: '800' as const },
    body: { size: 24, weight: '700' as const },
    bodyMedium: { size: 20, weight: '700' as const },
    caption: { size: 18, weight: '700' as const },
    small: { size: 16, weight: '700' as const },
  },

  shadows: {
    sm: { blur: 4, alpha: 0.2 },
    md: { blur: 8, alpha: 0.25 },
    lg: { blur: 12, alpha: 0.3 },
  },
  
  layout: {
    topBarHeight: 64,
    topBarCurrencyHeight: 44,
    bottomNavHeight: 72,
    minTouchTarget: 44,
    maxContentWidth: 720,
  },

  // ★ v0.80 新增：动画参数
  animation: {
    fast: 200,
    normal: 350,
    slow: 600,
    verySlow: 1000,
  },

  // ★ v0.80 新增：粒子参数
  particles: {
    bgCount: 35,
    bgMinSize: 1,
    bgMaxSize: 3,
    bgSpeed: 0.3,
  },
};

// 工具函数：颜色混合
export function mixColors(color1: number, color2: number, ratio: number): number {
  const r1 = (color1 >> 16) & 0xff;
  const g1 = (color1 >> 8) & 0xff;
  const b1 = color1 & 0xff;
  
  const r2 = (color2 >> 16) & 0xff;
  const g2 = (color2 >> 8) & 0xff;
  const b2 = color2 & 0xff;
  
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  
  return (r << 16) | (g << 8) | b;
}

// 工具函数：颜色变亮
export function lighten(color: number, amount: number): number {
  return mixColors(color, 0xffffff, amount);
}

// 工具函数：颜色变暗
export function darken(color: number, amount: number): number {
  return mixColors(color, 0x000000, amount);
}
