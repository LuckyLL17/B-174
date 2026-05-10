NCM Digital Twin Tool
=====================

使用说明：
1. 直接在浏览器中打开 index.html 文件即可运行。
2. 无需安装任何依赖，无需网络连接。
3. 推荐使用 Chrome 或 Edge 浏览器。

文件说明：
- css/style.css: 样式文件
- js/main.js: 主逻辑控制
- js/pipeReactor.js: 管道反应器核心算法
- js/reactionKettle.js: 反应釜核心算法
- js/kinetics.js: 动力学计算库
- js/fluidDynamics.js: 流体计算库
- js/visualization.js: 图表绘制库
- js/exportExcel.js: 数据导出库

注意事项：
- 本工具为工程计算原型，参数基于典型 NCM 体系预设。
- 如需调整动力学常数，请修改 js/kinetics.js 中的 Params 对象。
