# Changelog v0.0.108

## 🛠️ 工程稳定性（TypeScript / Lint）


- Step 1 启动：恢复 `build/lint/typecheck/check` 为真实门禁（去除 `--noCheck`），并暴露待修复的历史类型与 lint 存量问题。
- Step 1.1（battle）：修复 BattleFX 浮字参数类型索引错误，补齐 PopupLayers 常量与 Pixi shim 类型能力，当前 `npm run typecheck` 已通过。
- 清理并降低了历史包升级后导致的大量 TypeScript 编译阻断，确保 `npm run build` 可本地复现通过。
- 增加 ESLint v9 flat config（`eslint.config.cjs`），恢复 `npm run lint` 在当前依赖环境下的可执行性。
- 新增聚合校验脚本 `npm run check`，一键执行 `build + lint` 作为最小门禁。

## 📝 文档与版本一致性

- 新增 `CHANGELOG_v0.0.108.md`，记录本次稳定性冲刺。
- 统一 `PROJECT_AI_RULES.md` 中历史统计口径，更新为当前版本规模（英雄/技能/Buff）。

## ✅ 下一步建议

- 在已稳定编译门禁基础上，继续推进内容迭代：第二卡池、关卡机制差异化、长期养成目标。
