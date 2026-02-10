# v0.0.97

## Fixes
- 修复【英雄详情弹窗偶发空白】问题：全局 Modal 在多个场景复用，其他弹窗会 `modal.content.removeChildren()` 导致 HeroesScene 缓存的 heroModalRefs 变成“已脱离树”的陈旧引用。
  - 现在在构建英雄详情弹窗前会校验缓存引用是否仍挂在 modal.content 下；若已脱离则自动重建。
  - 弹窗关闭时主动清理 heroModalRefs，避免后续被其他弹窗清空内容后再打开出现空白。

## Notes
- 该修复不会影响其他弹窗逻辑，只增强 HeroesScene 对“共享 Modal”环境的鲁棒性。
