# CHANGELOG v0.0.80 — 阶段1：渐变背景系统

## 🎨 新增

### GradientBackground 组件 (`src/ui/components/GradientBackground.ts`)
- **Layer 0**: 纵向5色线性渐变底色（canvas texture，高性能）
- **Layer 1**: 4个氛围光晕球（ADD 混合模式，径向衰减）
- **Layer 2**: 四边暗角（vignette 效果）
- **Layer 3**: 160颗星点 + 实时闪烁动画
- **Layer 4**: 极细水平扫描线（科幻质感）

### theme.ts 扩展
- 新增 `gradients` 渐变色组配置
- 新增 `glow` 发光参数
- 新增 `animation` 动画时长
- 新增 `particles` 粒子参数
- 新增 `colors.rarity` 稀有度色彩

## 🔧 修改

### GameApp.ts
- `bg` 字段从 `Graphics` 替换为 `GradientBackground` 实例
- `drawBackground()` 委托给 `GradientBackground.resize()`
- `tick()` 中添加 `bg.onUpdate(dt)` 驱动星点闪烁

## ⚡ 性能策略
- 渐变底色使用 1px 宽 canvas → texture → sprite 拉伸（零每帧开销）
- 氛围光晕和暗角仅在 resize 时重绘
- 星点闪烁使用数学函数（无粒子系统开销）
- 扫描线一次绘制，不每帧更新
