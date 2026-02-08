# Changelog v0.0.74

## Fixes
- 修复 `BattleView.ts` 的编译错误：
  - 去除重复声明的局部变量（`tar` / `contentH`）。
  - 修复 `renderLog()` 中多余的 `}`，避免导致 `update()` 方法解析失败。

## Notes
- 本版本为语法/编译层面的修复，不改动战斗逻辑与数值。
