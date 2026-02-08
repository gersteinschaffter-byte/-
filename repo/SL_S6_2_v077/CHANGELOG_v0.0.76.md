# v0.0.76 变更记录

## 目的
解决 HeroesScene 在“上阵/下阵/升级/升星”操作时明显卡顿的问题（移动端更明显）。

## 主要改动
- HeroesScene：英雄列表网格改为缓存复用 HeroCard，刷新时仅更新 owned/party 状态与位置，避免每次全量销毁重建 Pixi 对象。
- HeroesScene：英雄详情弹窗在上阵/下阵/升级/升星后优先使用 updateHeroModal() 就地更新（HP/ATK/DEF/SPD 与按钮文案），减少整套 Modal 重建带来的卡顿。
- HeroesScene：新增 PERF_DEBUG 性能埋点与刷新合并，定位并削减「全量重建 UI + 多次刷新叠加」导致的卡顿；点击耗时以控制台输出为准（state 更新与 UI 更新分段，通常为个位数~十几 ms 级别，需在设备上查看日志确认）。
- 版本号更新：v0.0.75 -> v0.0.76

## 文件
- 修改：src/scenes/HeroesScene.ts
- 修改：src/game/version.ts
- 修改：package.json
- 新增：CHANGELOG_v0.0.76.md
