# v0.0.99

工程化（A：弹窗/Layer 规范收口）

## ✅ 新增
- 新增 `src/ui/PopupLayers.ts`：集中管理全局 Modal 的 layer/namespace 名称，禁止散落的字符串。
- `Modal` 新增 `openLayer(name, builder, clear=true)`：统一安全入口（切 layer → 可选清理 → 构建内容 → open）。
- `Modal` 新增 `clearAllLayers()`：极少数场景需要“一键清空全部 layer”时使用。

## ✅ 约束/防回归
- 在 `Modal` 构造时对 `modal.content.removeChildren()` 加“硬禁用”保护：
  - 任何人误用会直接抛错并提示改用 `useLayer/clearLayer/clearAllLayers`。

## ✅ 代码迁移
- 所有已 Layer 化的弹窗调用统一改为使用 `PopupLayers.*` 常量：
  - 英雄详情 / 抽卡结果 / 背包开箱 / 战斗结算 / 确认框 / 运行异常弹窗
