# v0.0.78

本次为 **布阵系统 Phase 1（基础框架）** 的代码合并版本，基于 codex/addphase-1-q2i4yj 导出的仓库内容整理进 FULL 包。

## 新增
- 新增【布阵】场景：`src/scenes/FormationScene.ts`
- 新增布阵相关数据与存档接口：`src/game/formation.ts`

## 调整
- 场景层级/切换逻辑调整：`SceneManager`、`HomeScene`、`HeroesScene`、`BattleScene` 等
- 部分 UI 组件与布局调整：`UIManager`、`BottomNav`、`TopBar` 等
- 资源/配置与入口初始化微调：`GameApp`、`game/data.ts`、`game/config.ts` 等

## 备注
- 本版本主要完成“可进入布阵/可保存基础布阵数据/为后续拖拽与上阵做铺垫”的骨架；后续 Phase 2/3 将继续补齐交互与规则。
