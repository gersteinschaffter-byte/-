# v0.0.69

- 修复：连点"重新开始"时，上一局的延迟结算残留回调可能落到已重置对象上，导致报错 `Cannot read properties of null (reading 'position')`。
- 处理：为每局战斗引入 runId 防抖/隔离；重开时清理 pendingWinner/endDelayTicks/deadGraceTicks，并短暂禁用按钮防止连点。
- 新增：BattleView.stopAllAnimations() 方法，用于在重新开始战斗时清空所有正在运行的动画
- 新增：TweenRunner.clear() 方法，用于清空所有待执行的tween
- 优化：在onUpdate中检查runId，确保只处理当前批次的战斗结算，避免旧战斗的延迟回调执行

Build: 2026-02-08 13:14
