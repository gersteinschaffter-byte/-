# CHANGELOG v0.0.84 — 阶段5：粒子特效系统

## 🎨 新增

### ParticleSystem 粒子引擎 (`src/fx/ParticleSystem.ts`)

#### 核心架构
- **对象池预分配**: 构造时创建所有粒子对象，运行时零 GC
- **单 Graphics 绘制**: 所有活跃粒子在一次 clear+draw 中完成
- **帧率自适应**: dt 归一化处理，高低帧率表现一致

#### API
| 方法 | 描述 |
|------|------|
| `emitContinuous(config, w, h)` | 开始持续发射（按帧率累加发射） |
| `resizeEmitArea(w, h)` | 更新发射区域尺寸 |
| `stopContinuous()` | 停止持续发射 |
| `burst(config, x, y, count)` | 在指定位置瞬间爆发 count 个粒子 |
| `onUpdate(dt)` | 每帧驱动（物理+绘制） |
| `clearAll()` | 清空所有粒子 |
| `getAliveCount()` | 获取活跃粒子数（调试） |

#### 粒子属性
每个粒子支持：位置、速度、加速度、大小(渐变)、alpha(渐变)、颜色、旋转、生命周期

#### 5种预设
| 预设 | 用途 | 视觉效果 |
|------|------|---------|
| `DustMotes` | 背景氛围 | 缓慢漂浮的蓝紫色尘埃，ADD 混合 |
| `RisingMotes` | 能量感 | 向上飘升的白蓝光点 |
| `SummonBurst` | 普通抽卡揭示 | 金色中心放射火花（25粒子） |
| `RarityBurst` | SSR/SP 抽卡揭示 | 紫色强力放射火花（45粒子） |
| `CardSparkle` | 卡片周围微光 | 白色/金色/蓝色闪烁点 |

### EmitterConfig 配置接口
完全可自定义的发射器参数：
- `rate` — 持续发射速率（<1 为概率发射）
- `life` — 生命帧数范围
- `speedX/Y` — 初始速度范围
- `accelX/Y` — 加速度（重力等）
- `size` / `sizeEnd` — 初始/结束尺寸（线性插值）
- `alpha` / `alphaEnd` — 初始/结束透明度
- `colors` — 颜色数组（随机选取）
- `emitZone` — 发射区域（fullscreen / point / rect）
- `spread` — 点模式散布半径
- `blendMode` — 混合模式
- `drawGlow` — 是否绘制光晕
- `rotSpeed` — 旋转速度范围

## 🔧 修改

### GradientBackground (`src/ui/components/GradientBackground.ts`)
- 新增 Layer 5: 浮游尘埃粒子层（ParticleSystem + DustMotes 预设）
- resize 时自动初始化/更新粒子发射区域
- onUpdate 中驱动粒子系统

### SummonResultPopup (`src/scenes/summon/SummonResultPopup.ts`)
- `showSingle()` 新增粒子爆发效果：
  - R/SR: SummonBurst 金色爆发（25粒子）+ 低频微光（每45帧）
  - SSR/SP: RarityBurst 紫色强爆发（45粒子）+ 高频微光（每25帧）
  - 爆发延迟 8 帧后触发（配合入场节奏）
  - 持续 CardSparkle 微光闪烁环绕卡片
  - 关闭 modal 时正确清理粒子和 ticker

## ⚡ 性能
- 对象池：200 粒子预分配，运行时零 new/delete
- 单 Graphics：所有粒子在一个 draw call 内完成
- 背景尘埃：最多 60 个粒子，发射率 0.4/帧（实际屏幕上约 20-35 个同时存在）
- 抽卡爆发：80 粒子池，爆发后逐渐消亡，不持续占用
- 自动清理：modal 关闭时立即清空粒子池
