# 项目改动准则（AI 必读）

> 该文档用于指导后续所有改代码/改 UI 的原则与注意事项。

# SL_S6_2_v062 深度报告（给 AI 的“可理解 + 可扩展”版本）

> 适用包：`SL_S6_2_v062_FULL.zip`  
> 项目类型：PixiJS + TypeScript + Vite（纯前端离线可跑）  
> 核心范式：**数据驱动内容（configs/*.json） + 事件驱动状态（GameState） + Scene 页面模块化 + Battle(Logic/View) 解耦**

---

## 1. 一句话概括这个游戏
这是一个 **抽卡（Summon）→ 英雄养成（Heroes）→ 自动回合战斗推关（Battle）→ 宝箱/资源回流（Bag）** 的闭环游戏。  
内容主要由 `src/configs/*.json` 驱动，玩家进度与资源由 `src/core/GameState.ts` 统一管理并持久化。

---

## 2. 版本 v062 的关键变化（相对近期版本）
### 2.1 v0.0.62（最新）
- ✅ 修复：`ScrollView` 缺少 `setContentHeight()`，导致英雄详情弹窗点击崩溃
- ✅ 优化：`ScrollView` 增加“隐形 spacer”，让滚动范围稳定（避免最后元素太短导致滚动高度不准）

来源：`CHANGELOG_v0.0.62.md`

### 2.2 v0.0.61（紧急修复）
- ✅ 修复：英雄详情页崩溃（缺失 `getHeroStats()`）
- ✅ 修复/优化：英雄详情页属性展示与滚动显示稳定性

来源：`CHANGELOG_v0.0.61.md`

### 2.3 v0.0.56（UI 优化 Phase 1）
- ✅ 主题系统（`src/ui/theme.ts`）
- ✅ 响应式工具（`src/ui/responsive.ts`）
- ✅ 安全区域适配（`src/ui/safeArea.ts`）
- ✅ 关键组件优化：`UIButton / TopBar / BottomNav`

来源：`UI_OPTIMIZATION_GUIDE.md` 与 `CHANGELOG_v0.0.56.md`

---

## 3. 目录结构（AI 快速定位“改哪里”）

### 3.1 内容配置（策划表）
路径：`src/configs/`
- `heroes.json`：英雄定义（50 个）
- `skills.json`：技能定义（20 个）
- `buffs.json`：Buff/DeBuff（9 个）
- `pools.json`：卡池定义（当前 1 个 normal）
- `summon_prob.json`：稀有度概率
- `economy.json`：经济 key 与基础参数
- `battle.json`：伤害波动参数
- `stages.json`：关卡定义（100 个关卡，含敌人阵容/区域/Boss标记）

### 3.2 核心框架（运行时）
路径：`src/core/`
- `GameApp.ts`：应用入口、尺寸缩放、挂载 UI 层
- `SceneManager.ts`：切场景
- `UIManager.ts`：UI 分层（Scene/UI/Popup/Toast 等）
- `GameState.ts`：**唯一可信玩家状态**（事件 + 持久化）
- `AssetLoader.ts`：资源加载（结合 manifest）

### 3.3 页面 Scenes（玩法页面）
路径：`src/scenes/`
- `HomeScene.ts`：主城入口
- `SummonScene.ts`：抽卡（含子组件 `scenes/summon/*`）
- `HeroesScene.ts`：英雄列表/详情/升级/上阵
- `BagScene.ts`：背包 + 开宝箱
- `BattleScene.ts`：战斗入口与结算

### 3.4 UI 组件系统（v056+）
路径：`src/ui/`
- `theme.ts`：设计 token（颜色/字体/圆角/间距）
- `responsive.ts`：断点/自适应布局工具
- `safeArea.ts`：刘海屏/手势栏安全区
- `components/*`：`UIButton、TopBar、BottomNav、Modal、ScrollView、ToastManager、HeroCard`

### 3.5 战斗系统
路径：`src/battle/`
- `BattleEngine.ts`：驱动器（节奏/事件流）
- `BattleLogic.ts`：**纯结算**（回合/技能/buff/伤害）
- `BattleView.ts`：**纯表现**（飘字/动画）
- `SkillSystem.ts / BuffSystem.ts`：技能与 buff 的执行
- `SkillRegistry.ts / SkillDefs.ts`：技能注册与配置桥接
- `BattleTypes.ts / SkillTypes.ts`：类型定义
- `FighterNode.ts`：战斗单位节点（表现层）

---

## 4. 游戏内容资产盘点（v062 现状）
### 4.1 英雄（20 个）
稀有度分布：
- R：8
- SR：5
- SSR：5
- SP：2

元素分布（非常规整）：
- 火/水/风/光/暗：各 4

> AI 新增英雄时：保持 `id` 唯一 + `skills[]` 必须存在于 skills.json。

### 4.2 技能（8 个）
effectType 分布：
- `addBuff`：4
- `damage`：2
- `heal`：2

触发点（trigger）覆盖：
- `onBattleStart / onRoundStart / onTurnStart / onBeforeAttack / onAfterAttack`

目标（target）覆盖：
- `current / self / allEnemy / lowestAlly / allAlly`

> AI 新增技能时：优先复用现有 `effectType/trigger/target`，否则需要改 `SkillSystem.ts`。

### 4.3 Buff（4 个）
当前 buff 模型支持：
- `durationRounds`：持续回合
- `maxStacks`：叠层
- `statMod`：属性修改（如 atkPct / dmgReduce / spdFlat）
- `dot.hpPct`：持续扣血（按最大生命百分比）

> AI 新增 buff 字段时：如果出现新的 `statMod.xxx`，需确保 `BuffSystem.ts` 能解释这个字段。

### 4.4 抽卡概率（summon_prob.json）
- SP：0.5%
- SSR：2%
- SR：18%
- R：79.5%

### 4.5 卡池（pools.json）
仅 `normal`：
- 优先票：`ticket_normal`
- 无票用钻：`300`

---

## 5. 玩家状态与存档（AI 必须按这套改）
### 5.1 PersistedState（存档结构）
位置：`src/game/storage.ts`
关键字段：
- `diamonds, gold`
- `stage`（关卡进度，独立字段）
- `inventory: Record<string, number>`（背包）
- `heroes: OwnedHero[]`（已拥有英雄）
- `partyHeroIds: string[]`（上阵队伍，最多 5）
- `lastLoginAt`

### 5.2 GameState：唯一写入口
位置：`src/core/GameState.ts`

**AI 禁止直接改 state 对象字段！**  
必须使用：
- 货币：`addGold / addDiamonds / trySpendGold / trySpendDiamonds`
- 背包：`addInventory / tryConsumeInventory`
- 英雄：`addHero / tryLevelUpHero`
- 关卡：`advanceStage / setStage`
- 队伍：`addToParty / removeFromParty / toggleParty / setPartyHeroIds`

GameState 同时提供事件：
- `currencyChanged / inventoryChanged / heroesChanged / stageChanged / partyChanged / anyChanged`  
UI/Scene 通过订阅事件来刷新显示。

---

## 6. 四大玩法页面的“真实规则”（按代码）
> 下面都是从 v062 源码中提炼的“可执行规则”，AI 扩展/改动必须保持一致性。

### 6.1 Summon（抽卡）
位置：`src/scenes/SummonScene.ts`

**消耗规则：**
1) 优先扣 `ticket_normal`（有多少扣多少）
2) 票不够时用钻石补齐：`diamondCost * count`

**产出规则：**
1) 先按 `summon_prob.json` 抽稀有度
2) 从 `HERO_BY_RARITY[rarity]` 随机抽英雄
3) 若重复英雄 → 转万能碎片（`shard_universal`）  
   - SP：+20
   - SSR：+12
   - SR：+6
   - R：+3
4) 若新英雄 → `GameState.addHero(hero.id)`

### 6.2 Heroes（英雄列表/详情/升级/上阵）
位置：`src/scenes/HeroesScene.ts`

**关键点：**
- 详情页使用 `ScrollView` 展示属性、技能、按钮等
- v061 增加了 `getHeroStats()`，避免崩溃
- v062 为 ScrollView 增加 `setContentHeight()` 与 spacer，避免详情页滚动高度错误导致点击崩溃

### 6.3 Bag（背包与宝箱）
位置：`src/scenes/BagScene.ts`

**宝箱 key：**
- `chest_c / chest_b / chest_a / chest_s`

**开箱规则（先扣 1 再奖励）**：
- chest_c：钻石 3~6；碎片 8~15；金币 50~120  
- chest_b：钻石 8~15；碎片 18~35；金币 120~260  
- chest_a：钻石 18~35；碎片 40~80；金币 260~600  
- chest_s：钻石 40~80；碎片 90~160；金币 600~1500  

奖励写入方式：
- 钻石：`addDiamonds`
- 金币：`addGold`
- 碎片：`addInventory(shard_universal, n)`

### 6.4 Battle（战斗与结算）
位置：`src/scenes/BattleScene.ts`

**Boss 宝箱掉率（仅 Boss 胜利）**：
- chest_c：0.60
- chest_b：0.25
- chest_a：0.12
- chest_s：0.03

**保底规则：**
- 当 `stage % 50 == 0`：最低保证 chest_a（若抽到 c/b 则提升为 a）

---

## 7. 战斗系统：分层与扩展点（AI 必读）
目标：保证“新增机制”不会把逻辑与表现搅在一起。

### 7.1 三段式结构
1) `BattleLogic.ts`：纯结算（技能触发、buff、伤害公式、胜负）
2) `BattleEngine.ts`：节奏与事件流（把逻辑事件按时间播放）
3) `BattleView.ts`：纯表现（动画、飘字、受击反馈）

**扩展原则：**
- 新 `effectType` → 改 `SkillSystem.ts`
- 新 `statMod` 字段 → 改 `BuffSystem.ts`
- 新表现 → 改 `BattleView.ts` / `fx/*`，不要改结算

---

## 8. UI/交互体系（v056+ 的“可复用资产”）
### 8.1 主题与响应式
- `theme.ts`：统一颜色/字体/圆角/间距 token
- `responsive.ts`：断点（xs/sm/md/lg）与布局辅助
- `safeArea.ts`：安全区域（刘海/手势栏）

### 8.2 关键组件
- `UIButton`：带按压缩放/发光/阴影反馈
- `TopBar`：安全区+响应式布局
- `BottomNav`：紧凑横向布局
- `Modal`：通用弹窗（用于抽卡结果、宝箱开启等）
- `ScrollView`：纵向滚动容器（v062 已支持 setContentHeight + spacer）
- `ToastManager`：轻提示

---

## 9. 运行与交付（Termux 一键命令）
包内自带脚本：
- `termux_run.sh`
- `termux_clean_run.sh`
- `verify_project.sh`

### 9.1 Termux 快速启动（建议）
在 Termux 里进入项目目录后：
```bash
bash termux_run.sh
```

若遇到依赖或缓存问题：
```bash
bash termux_clean_run.sh
```

---

## 10. AI 扩展任务清单（高频需求 → 改动点）
### A) 新增英雄（最推荐：纯内容改动）
- 改：`src/configs/heroes.json`
- 必要时增：`src/configs/skills.json`
- 不需要动逻辑（只要 effectType/trigger/target 不新增）

### B) 新增卡池（需要 UI 轻改）
- 改：`src/configs/pools.json`（新增 pool）
- 改：`SummonScene.ts`（支持切池 + 读取对应配置）
- 可选：为新池增加独立概率表

### C) 新增技能效果类型（需要改 SkillSystem）
- 改：`skills.json` 增 effectType
- 改：`SkillSystem.ts` 增执行分支
- 可选：`BattleView.ts` 加视觉反馈

### D) 内容化关卡（从“缩放生成敌人”升级为“关卡表”）
- 新增：`src/configs/stages.json`（关卡表：怪物阵容/奖励/机制）
- 改：`BattleScene.ts`（敌人与奖励从关卡表读取）

---

## 11. 已知风险点与自检（AI 防踩坑）
1) ❌ 直接改 state 字段（UI 不刷新/存档不一致）  
   ✅ 必须走 GameState 方法
2) ❌ 新 skill 引用不存在的 buffId  
   ✅ buffs.json 必须有对应 id
3) ❌ ScrollView 没有设置内容高度导致滚动范围不正确  
   ✅ 复杂长内容场景（英雄详情/概率表）建议调用 `setContentHeight()`
4) ❌ partyHeroIds 超过 5 或重复  
   ✅ 由 GameState 统一裁剪，但最好源头保证合法

---

## 12. AI 用“统一术语表”（避免误解）
- **Content（内容）**：heroes/skills/buffs/pools/economy 等 configs JSON
- **State（状态）**：玩家资源与进度（GameState / PersistedState）
- **Logic（逻辑）**：抽卡概率、战斗结算、奖励算法（不做 UI）
- **View（表现）**：动画、飘字、按钮反馈（不改数值）
- **Scene（页面）**：Home/Summon/Heroes/Bag/Battle

---

# 附：v062 的关键“代码级事实摘要”
- 抽卡重复英雄转万能碎片：SP20 / SSR12 / SR6 / R3（`SummonScene.ts`）
- Boss 掉宝箱概率：c0.6 / b0.25 / a0.12 / s0.03，50关保底 a（`BattleScene.ts`）
- 宝箱奖励范围：见 `BagScene.ts` 的四档 switch
- ScrollView v062 支持 `setContentHeight()` 且内置 spacer 保证 bounds 稳定（`ScrollView.ts`）

