# v0.0.98

## 修复 / 优化

### 全局弹窗：引入「命名空间 Layer」机制（防互相踩踏）
- `Modal` 新增 `useLayer(name)` / `getLayer(name)` / `clearLayer(name)` / `setActiveLayer(name)`。
- 以后各功能弹窗只操作自己的 Layer，不再对 `modal.content` 做全量清空，避免：
  - 抽卡/背包/战斗结算等弹窗清空内容后，英雄详情弹窗变成“只有右上角✕、内容空白”的问题。

### 已完成改造的弹窗
- 英雄详情（HeroesScene）→ `hero_detail` layer（支持缓存、不会被其它弹窗清空）
- 抽卡结果（SummonResultPopup）→ `summon_result` layer
- 背包开宝箱/奖励（BagScene）→ `bag_open` / `bag_reward` layer
- 战斗结算（BattleScene）→ `battle_result` layer
- 通用确认框（openConfirm）→ `confirm` layer
- 运行异常弹窗（GameApp runtime error guard）→ `runtime_error` layer

## 开发注意事项
- 新弹窗请使用：`const layer = modal.useLayer('your_popup_name');`
- 不要再调用：`modal.content.removeChildren()`（会清空所有 Layer）。
