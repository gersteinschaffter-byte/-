# Changelog v0.0.79

## Fixes
- 修复 `src/game/version.ts` 缺少导出导致的 Vite/ESBuild 编译失败：
  - 现在稳定导出 `GAME_VERSION / DATA_VERSION / BUILD_TIME`。
- 同步 `package.json` 版本号到 `0.0.79`。
