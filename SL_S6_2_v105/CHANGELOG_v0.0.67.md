# Changelog v0.0.67

- Phase 2：加入 Skeleton（骨架屏）占位与 shimmer：
  - HeroesScene：首次进入英雄列表时先显示骨架卡片，再渲染真实卡片（减少移动端“突然弹出”的割裂感）
  - Hero 详情弹窗：打开时先显示骨架，再延迟构建真实内容（降低卡顿感）
  - Summon 概率 & 奖池预览：首次展开时先骨架占位，再渲染真实内容

- 修正版本号一致性：
  - package.json -> 0.0.67
  - src/game/version.ts -> v0.0.67

