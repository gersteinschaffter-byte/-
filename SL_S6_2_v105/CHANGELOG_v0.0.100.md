# v0.0.100 (FULL)

## B — 配置校验器（Config Validator）✅

### 新增
- 启动时自动校验 `src/configs/*.json`（heroes / skills / summon_prob / pools / stages）。
- 若发现 **错误/警告**，自动弹出「配置校验报告」：
  - ✅ 可一键复制报告文本（方便你发我定位）。
  - ✅ 仍可选择“继续进入”用于快速预览/对照。

### 校验范围
- `heroes.json`
  - id 必须存在且唯一
  - rarity 必须是 R / SR / SSR / SP
  - element 必须是允许的元素
  - skills 若存在必须是数组；并校验技能 id 是否存在于 skills.json
- `skills.json`
  - id 必须存在且唯一
  - power / chance（若存在）必须是数字
- `summon_prob.json`
  - 必须包含 R / SR / SSR / SP 且不重复
  - p 必须是 >= 0 的数字
  - 概率总和建议为 100（不为 100 会给警告）
- `pools.json`
  - 必须至少包含一个卡池
  - ticketKey / diamondCost 等关键字段必须合法
- `stages.json`
  - stage id 必须是整数且唯一
  - enemies 必须是非空数组
  - 敌人的 rarity/element/skills 引用必须合法
