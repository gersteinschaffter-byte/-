# CHANGELOG v0.0.83 — 阶段4：简单动画系统

## 🎨 新增

### Tween 引擎升级 (`src/fx/Tween.ts`)
- 新增 `Tween.delayed()` — 带延迟启动的补间动画
- 新增 `onStart` 回调 — 动画首帧时触发
- 延迟期间不捕获初始值（允许 layout 先完成）
- **12种缓动函数库：**
  - `linear` — 线性
  - `easeOutCubic` / `easeInCubic` / `easeInOutCubic` — 三次方
  - `easeOutQuad` / `easeInQuad` — 二次方
  - `easeOutQuart` — 四次方
  - `easeOutBack` — 回弹（超过目标再回来）
  - `easeOutElastic` — 弹性（弹簧效果）
  - `easeOutBounce` — 弹跳（落地弹跳）
  - `easeOutExpo` — 指数（极快启动慢停）
  - `easeInOutSine` — 正弦（最温和 S 曲线）

### SimpleAnimator 工具类 (`src/fx/SimpleAnimator.ts`)
高级动画 API，所有方法返回 `TweenRunner`：

| 方法 | 效果 | 默认帧数 |
|------|------|---------|
| `fadeIn(target, dur, delay)` | alpha 0→1 | 20帧(333ms) |
| `fadeOut(target, dur, delay)` | alpha 1→0 | 15帧(250ms) |
| `slideIn(target, dir, dist)` | 位移+淡入 | 25帧(416ms) |
| `slideOut(target, dir, dist)` | 位移+淡出 | 20帧(333ms) |
| `popIn(target, dur, delay)` | scale 0.3→1 回弹 | 18帧(300ms) |
| `scaleIn(target, dur, delay)` | scale 0.85→1 柔和 | 22帧(367ms) |
| `stagger(targets, animFn, gap)` | 交错动画 | 每项4帧(67ms) |
| `crossFade(old, new, dur)` | 场景交叉淡入淡出 | 12帧(200ms) |
| `breathe(target, prop, min, max)` | 持续呼吸脉动 | 循环 |

### SceneManager 过渡动画 (`src/core/SceneManager.ts`)
- 旧场景淡出（8帧≈133ms）→ 新场景淡入（10帧≈166ms）
- 安全机制：过渡期间重复切换会立即完成当前过渡
- `animate=false` 保持瞬切行为（向后兼容）

## 🔧 修改

### HomeScene 入场动画 (`src/scenes/HomeScene.ts`)
- 标题：从上方滑入 + 淡入
- 副标题：延迟淡入
- 关卡文字：延迟淡入
- 4个按钮：从右侧交错滑入（每个间隔67ms）
- 提示文字：最后淡入
- 新增 `onUpdate` 驱动动画 runner

### GameApp.goTo 升级 (`src/core/GameApp.ts`)
- 默认启用过渡动画（首次加载 home 除外）
- `animate` 参数现在默认 true（有当前场景时）

### main.ts
- 底部导航切换启用过渡动画

## ⚡ 性能
- Tween 引擎零依赖，纯数学计算
- SimpleAnimator 不分配新对象（复用 runner）
- 过渡动画总时长仅 ~300ms，不阻塞交互
- 所有动画完成后 runner 自动清空（零持续开销）
