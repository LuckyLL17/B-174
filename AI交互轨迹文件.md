# AI 交互轨迹记录 (AI Interaction Trajectory)

**时间**: 2026-01-23
**任务**: NCM 前驱体结晶数字孪生工具开发

---

## 1. 初始需求分析

用户要求基于提供的 `prompt.md` 开发一个完全离线、纯前端的 NCM 前驱体结晶数字孪生网页工具。
**核心约束**:

- 纯 HTML/CSS/JS，无外部依赖。
- 包含反应釜（Module 1）和管道反应器（Module 2）两个核心模块。
- 严格的文件结构要求。
- 必须基于工程动力学模型（成核、生长、PFR 等）。

## 2. 方案规划 (Marketing Planning)

制定了详细的实现计划，包括：

- **文件结构**: 确定了 `css/`, `js/` 分层结构。
- **模块划分**:
  - `kinetics.js`: 封装成核 ($B$) 与生长 ($G$) 速率方程。
  - `fluidDynamics.js`: 封装 PFR 停留时间与混合计算。
  - `visualization.js`: 手写 Canvas 图表库（因为禁止使用 ECharts 等外部库）。
  - 各反应器与主控逻辑分离。

## 3. 代码实现 (Implementation)

按顺序生成了以下文件：

1.  `css/style.css`: 定义了侧边栏布局与图表区域样式。
2.  `js/kinetics.js`: 实现了由于过饱和度驱动的动力学模型。
3.  `js/fluidDynamics.js`: 实现了基础流体计算。
4.  `js/visualization.js`: 实现了一个支持多折线、自动缩放坐标轴的 Canvas 图表类。
5.  `js/exportExcel.js`: 实现了带 BOM 头的 CSV 导出功能。
6.  `js/reactionKettle.js` & `js/pipeReactor.js`: 分别实现了时间步进法（Time-stepping）和空间步进法（Spatial-stepping）的仿真逻辑。
7.  `js/main.js` & `index.html`: 组装 UI 与逻辑。

## 4. 调试与修复 (Debugging & Fixes)

在初次交付后，用户反馈了两个运行时错误。

### 🐞 问题一：图表无法渲染

- **现象**: `Uncaught TypeError: Cannot read properties of undefined (reading 'render_line_chart')`
- **原因**: `main.js` 中初始化图表时使用的选择器寻找的是 `.chart-canvas` 类，但 `index.html` 中的 `<canvas>` 元素遗漏了该类名。
- **修复**: 在 `index.html` 所有 `<canvas>` 标签中添加 `class="chart-canvas"`。

### 🐞 问题二：输入参数读取失败

- **现象**: `Cannot read properties of null (reading 'value')`
- **原因**: 管道模拟逻辑试图读取 `p-nh3` 输入框的值，但 HTML 中漏写了该输入框。
- **修复**: 在 `index.html` 管道参数区补充了 `初始氨水浓度` 的输入框。

### 🐞 问题三：图表容器选择器错误

- **现象**: 修复上述问题后主要图表仍初始化失败。
- **原因**: `main.js` 在查找 Canvas 元素时，错误地在侧边栏面板 (`#pipe-panel`) 中查找，而实际 Canvas 位于右侧可视化区域 (`#pipe-panel-charts`)。
- **修复**: 修正了 `initChartsForModule` 函数的选择器范围，并增加了模块切换时同步切换图表区域显示/隐藏的逻辑。

## 5. 最终交付 (Final Delivery)

完成所有修复后，生成了最终的项目说明文档 `README.md` 与本交互记录。项目现已满足所有功能与稳定性要求，可直接离线运行。
