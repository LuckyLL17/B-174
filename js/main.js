/**
 * main.js
 * 主控制器：处理 UI 交互与模块调度
 */

document.addEventListener('DOMContentLoaded', () => {
    // 初始化图表实例
    const chartInstances = {};
    
    // 初始化
    initModuleSwitcher();
    initSimulateButtons();
    initExportButtons();

    // 默认加载反应釜模块
    switchModule('kettle');

    // 绑定图变尺寸自适应
    window.addEventListener('resize', () => {
        // 重绘所有可视图表
        // 简化处理：点击计算时会重绘
    });

    /**
     * 模块切换逻辑
     */
    function switchModule(moduleId) {
        // 按钮状态
        document.querySelectorAll('.module-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.module === moduleId) btn.classList.add('active');
        });

        // 侧边栏面板显示
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${moduleId}-panel`).classList.add('active');

        // 图表区域显示 (Toggle visibility)
        const chartGroups = ['kettle', 'pipe'];
        chartGroups.forEach(m => {
            const chartContainer = document.getElementById(`${m}-panel-charts`);
            if (chartContainer) {
                if (m === moduleId) {
                    chartContainer.style.display = 'contents';
                } else {
                    chartContainer.style.display = 'none';
                }
            }
        });

        // 初始化/重置对应图表容器
        initChartsForModule(moduleId);
    }

    function initModuleSwitcher() {
        document.querySelectorAll('.module-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchModule(e.target.dataset.module);
            });
        });
    }

    /**
     * 初始化图表对象
     */
    function initChartsForModule(moduleId) {
        // Fix: Select correctly from the chart container, not the sidebar panel
        const containers = document.querySelectorAll(`#${moduleId}-panel-charts .chart-canvas`);
        containers.forEach(canvas => {
            if (!chartInstances[canvas.id]) {
                chartInstances[canvas.id] = new ChartRenderer(canvas.id);
            }
        });
    }

    /**
     * 绑定计算按钮
     */
    function initSimulateButtons() {
        // 反应釜计算
        document.getElementById('kettle-calc-btn').addEventListener('click', runKettleSimulation);
        
        // 管道计算
        document.getElementById('pipe-calc-btn').addEventListener('click', runPipeSimulation);
    }

    /**
     * 运行反应釜模拟
     */
    function runKettleSimulation() {
        const params = {
            saltConc: parseFloat(document.getElementById('k-salt').value) || 2.0,
            nh3Conc: parseFloat(document.getElementById('k-nh3').value) || 0.5,
            naohConc: parseFloat(document.getElementById('k-naoh').value) || 4.0,
            feedRate: parseFloat(document.getElementById('k-flow').value) || 10,
            stirSpeed: parseFloat(document.getElementById('k-stir').value) || 600,
            totalTime: parseFloat(document.getElementById('k-time').value) || 4,
            phCurve: parseFloat(document.getElementById('k-ph').value) || 11.0,
            tempCurve: parseFloat(document.getElementById('k-temp').value) || 55
        };

        const results = ReactionKettle.simulate(params);

        // 绘制图表
        // 1. 浓度曲线
        chartInstances['k-chart-1'].render_line_chart({
            labels: results.time,
            datasets: [
                { label: '[M] (mol/L)', data: results.conc, color: '#007bff' },
                { label: 'S (Supersat)', data: results.supersaturation, color: '#dc3545' }
            ]
        }, { title: '浓度与过饱和度随时间变化', xLabel: 'Time (h)', yLabel: 'Value' });

        // 2. 固含与粒径
        chartInstances['k-chart-2'].render_line_chart({
            labels: results.time,
            datasets: [
                { label: 'Solid (%)', data: results.solidContent, color: '#28a745' },
                { label: 'D50 (um)', data: results.d50, color: '#ffc107' }
            ]
        }, { title: '产品性质随时间变化', xLabel: 'Time (h)', yLabel: 'Value' });

        // 保存结果供导出
        window.currentKettleResults = results;
    }

    /**
     * 运行管道模拟
     */
    function runPipeSimulation() {
        // 构建简单的单段或两段管道参数 (UI简化为固定模板)
        const pipeLen = parseFloat(document.getElementById('p-len').value) || 20;
        const pipeDia = parseFloat(document.getElementById('p-dia').value) || 25; // mm
        
        const params = {
            pipeSegments: [
                { length: pipeLen, diameter: pipeDia }
            ],
            baseParams: {
                initFlow: parseFloat(document.getElementById('p-flow').value) || 100,
                initConc: parseFloat(document.getElementById('p-salt').value) || 2.0,
                initNH3: parseFloat(document.getElementById('p-nh3').value) || 0.5,
                initPH: parseFloat(document.getElementById('p-ph').value) || 11.2,
                initTemp: parseFloat(document.getElementById('p-temp').value) || 60
            },
            feeds: [
                // 演示用：在中间位置补碱
                // { position: pipeLen/2, flow: 10, conc: 0, targetPH: 11.5 }
            ]
        };
        
        // 检查是否有多级加料
        if (document.getElementById('p-multi-feed').checked) {
            params.feeds.push({
                position: pipeLen * 0.3,
                flow: params.baseParams.initFlow * 0.2, // 20% flow
                conc: 0,
                targetPH: 11.5,
                temp: 60
            });
             console.log("Multi-feed enabled");
        }

        const results = PipeReactor.simulate(params);

        // 绘制图表
        // 1. S & D50 Profile
        chartInstances['p-chart-1'].render_line_chart({
            labels: results.distance.map(Number),
            datasets: [
                { label: 'S (Supersat)', data: results.S, color: '#dc3545' },
                { label: 'D50 (um)', data: results.D50, color: '#ffc107' }
            ]
        }, { title: '沿程过饱和度与粒径分布', xLabel: 'Distance (m)', yLabel: 'Value' });

        // 2. Nucleation & Growth Rates
        // log scale for B usually better, but linear for now
        chartInstances['p-chart-2'].render_line_chart({
            labels: results.distance.map(Number),
            datasets: [
                { label: 'B (#/m3s / 1e8)', data: results.B.map(v => v/1e8), color: '#6f42c1' },
                { label: 'G (um/s)', data: results.G.map(v => v * 1e6), color: '#20c997' }
            ]
        }, { title: '沿程动力学速率', xLabel: 'Distance (m)', yLabel: 'Rate' });

        window.currentPipeResults = results;
    }

    /**
     * 导出按钮
     */
    function initExportButtons() {
        document.getElementById('kettle-export-btn').addEventListener('click', () => {
            if (!window.currentKettleResults) {
                alert('请先运行计算');
                return;
            }
            const res = window.currentKettleResults;
            const rows = res.time.map((t, i) => [
                t, res.conc[i], res.supersaturation[i], res.solidContent[i], res.d50[i]
            ]);
            Exporter.exportCSV('kettle_simulation_data.csv', ['Time(h)', 'Conc(mol/L)', 'S', 'Solid(%)', 'D50(um)'], rows);
        });

        document.getElementById('pipe-export-btn').addEventListener('click', () => {
             if (!window.currentPipeResults) {
                alert('请先运行计算');
                return;
            }
            const res = window.currentPipeResults;
            const rows = res.distance.map((d, i) => [
                d, res.residenceTime[i], res.S[i], res.D50[i], res.B[i], res.G[i]
            ]);
            Exporter.exportCSV('pipe_simulation_data.csv', ['Distance(m)', 'Time(s)', 'S', 'D50(um)', 'B(#/s)', 'G(m/s)'], rows);
        });
    }
});
