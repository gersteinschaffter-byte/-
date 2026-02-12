# CHANGELOG v0.0.81 — 阶段2：按钮视觉升级

## 🎨 升级

### UIButton 完全重写 (`src/ui/components/UIButton.ts`)

#### 视觉分层（7层）
| 层级 | 内容 | 描述 |
|------|------|------|
| Layer 0 | 多层外发光 | Normal: 2层微弱辉光；Hover: 3层强霓虹光 |
| Layer 1 | 投影 | 双层柔和底部阴影（按下时消失） |
| Layer 2 | 渐变填充 | Canvas → Texture 平滑纵向渐变 |
| Layer 3 | 金属双线边框 | 外层暗边（阴刻）+ 内层亮边（高光） |
| Layer 4 | 顶部高光条 | 白色渐变 0.18→0 的玻璃质感 |
| Layer 5 | 底部暗边 | 增加按钮立体感 |
| Layer 6 | 文字 | 带投影的标签文字 |

#### 交互状态
- **Normal**: 低强度外发光 + 标准渐变（深蓝→中蓝）
- **Hover**: 3层霓虹强发光 + 明亮渐变 + 边框变亮 + 内侧微光
- **Pressed**: 缩放0.94 + 渐变反转（暗→亮）+ 顶部内阴影（凹陷感）+ 文字下移1px
- **Disabled**: alpha 0.5 + 灰色边框

#### 技术特点
- 4张 Canvas Texture 在构造时预生成（normal / hover / pressed / highlight）
- draw() 时只切换 texture + 重绘 Graphics，零 canvas 操作
- 保持完整的公开 API 兼容（setLabel / setDisabled / bg / glow / txt）

## ⚡ 性能
- Texture 预生成策略：每个按钮实例构造时创建4张小 canvas texture
- draw() 无 canvas 操作，仅 Graphics 指令（极低开销）
- destroy() 正确释放所有 texture 避免内存泄漏
