# Changelog v0.0.102

## 工程化：D（GameState 写法统一）

### ✅ GameState 新增/强化
- 新增 `withBatch(fn)`：把一组状态变更合并为 **一次存档 + 一次事件广播**（避免十连/多步流程刷屏、减少 UI 反复刷新）。
- `persistAndEmit` 支持批处理：批处理中只累计脏标记，退出批处理后统一 `flushBatch()`。
- 统一经济接口：
  - `applyCurrencyDelta({ gold?, diamonds? })`
  - `trySpendCurrency({ gold?, diamonds? })`（原子扣款：不够则不改动）
- 统一背包接口：
  - `applyInventoryDeltas({ key: delta, ... })`
  - `trySpendInventory({ key: amount, ... })`（原子扣除：不够则不改动）

### ✅ 业务侧迁移
- 抽卡流程（SummonScene）：
  - 抽卡消耗与出货入库整体使用 `withBatch` 包裹，避免十连时 `heroesChanged / inventoryChanged` 多次触发。

### 📝 兼容性
- 保留旧方法（如 `addGold/addDiamonds/addInventory/tryConsumeInventory/...`），内部逐步引导到统一接口；老代码不受影响。
