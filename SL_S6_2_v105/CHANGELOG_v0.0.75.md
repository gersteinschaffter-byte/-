# Changelog v0.0.75

## 新增内容

### 关卡配置化（stages.json）
- ✅ 新增 `src/configs/stages.json`，定义 100 个关卡
- 10 个区域主题：幽暗森林 → 冰封荒原 → 熔岩裂谷 → 风暴高原 → 神殿废墟 → 深渊裂隙 → 天空之城 → 魔焰地狱 → 诸神黄昏 → 混沌虚空
- 每 10 关一个 Boss 关卡（共 10 个 Boss），每 5 关一个精英关卡
- 敌人数量随关卡递增：2 → 3 → 4 → 5
- 5 个难度梯度（tier1-5），敌人稀有度从 R 逐步提升到 SSR
- Boss 关卡额外属性倍率 1.2x ~ 1.7x

### BattleScene 重构
- ✅ `BattleScene.ts` 现在从 `stages.json` 读取敌人配置
- 战斗标题显示区域名和关卡号（如「幽暗森林 · 第1关」）
- 结算弹窗显示下一关的区域和类型（Boss / 精英）
- 精英关卡胜利金币奖励 +50%
- 超过 100 关后自动降级为原有的程序化生成逻辑（向前兼容）

### 30 个新英雄（h021 - h050）
- R × 10：焰舞、浪潮、风笛、星尘、夜刺、灼光、清泉、翔羽、辉石、墨痕
- SR × 8：凤鸣、碧澜、旋风、圣裁、幽冥、赤焰、冰凌、疾风
- SSR × 8：炎帝、沧海、风神、天照、冥王、烈焰、寒冰、苍穹
- SP × 4：天命、永夜、凰焰、沧溟
- 英雄总数：20 → 50
- 五元素分布均衡

### 12 个新技能
- 主动技能（4）：雷霆一击、暴风雪、裂地斩、天罚、万物回春
- 被动技能（7）：狂暴之力、削弱之触、铁壁之阵、疾风步、生命之泉、诅咒之言、赋能
- 技能总数：8 → 20

### 5 个新 Buff
- 狂暴（atkPct +35%）、虚弱（atkPct -15%）、铁壁（defPct +30%）
- 加速（spdFlat +25）、诅咒（defPct -20%）
- 全部使用现有 statMod 类型，无需改动 BuffSystem
- Buff 总数：4 → 9

## 数据版本
- `DATA_VERSION` 升级为 `data-v2`

## Notes
- 所有新技能复用现有 effectType / trigger / target，无需改动 SkillSystem 或 BattleLogic
- 所有新 Buff 复用现有 statMod 字段（atkPct / defPct / spdFlat / dmgReduce），无需改动 BuffSystem
- stages.json 纯数据驱动，符合项目 configs → logic 解耦原则
