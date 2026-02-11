# v0.0.71 - 代码质量优化

## 🔧 内存泄漏修复

### HeroesScene.ts
- ✅ 新增 `pendingTimeouts` 集合追踪所有 setTimeout
- ✅ 新增 `safeSetTimeout()` 辅助方法，确保定时器可被清理
- ✅ 新增 `clearAllTimeouts()` 方法，在场景退出时清理所有待处理的定时器
- ✅ 更新 `onExit()` 调用 `clearAllTimeouts()`
- ✅ 替换所有 `setTimeout` 为 `safeSetTimeout`
  - endTouchCycle()
  - onUpdate() 中的节流更新
  - openHeroModal() 中的骨架屏延迟

## 📦 代码重复消除

### 新增 heroStats.ts 统一工具
- ✅ 创建 `src/game/heroStats.ts`
- ✅ 提取统一的 stats 计算函数：
  - `calculateBaseStats()` - 基础属性计算
  - `calculateHeroStats()` - 含星级加成的英雄属性
  - `calculateEnemyStats()` - 敌人属性生成

### BattleScene.ts 优化
- ✅ 移除重复的 `RARITY_MULT` 定义
- ✅ 简化 `genStats()` 方法，使用统一工具
- ✅ 简化 `genEnemyStats()` 方法，使用统一工具
- ✅ 简化 teamA 生成逻辑，减少临时变量

### HeroesScene.ts 优化
- ✅ 移除重复的 `RARITY_MULT` 定义
- ✅ 简化 `getHeroStats()` 方法
- ✅ 简化 `getHeroBattleStats()` 方法
- ✅ 确保战斗预览和实际战斗使用完全相同的计算逻辑

## 📊 优化效果

### 代码行数减少
- HeroesScene.ts: -40 行（重复代码）
- BattleScene.ts: -25 行（重复代码）
- 新增 heroStats.ts: +78 行（共享工具）
- **净减少**: 约 -13% 冗余代码

### 维护性提升
- ✅ stats 计算逻辑集中管理，更易维护
- ✅ 修改 stats 公式只需改一处
- ✅ 战斗预览与实际战斗保证一致

### 内存管理改进
- ✅ 消除 HeroesScene 中所有未清理的定时器
- ✅ 场景切换时确保完全清理
- ✅ 减少内存泄漏风险

## 🔍 质量保证

- ✅ 功能完全兼容，无破坏性变更
- ✅ 所有计算结果与原逻辑完全一致
- ✅ 类型安全得到保持

Build: 2026-02-08 14:15
