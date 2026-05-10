/**
 * main.js
 * 主控制器：处理 UI 交互与模块调度
 */

document.addEventListener('DOMContentLoaded', () => {
    // 初始化图表实例
    const chartInstances = {};
    
    // 存储高级工具结果
    let currentSensitivityResult = null;
    let currentOptimizerResult = null;
    let currentDOEResult = null;
    
    // 初始化
    initModuleSwitcher();
    initSimulateButtons();
    initExportButtons();
    initAdvancedTools();

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
        const chartGroups = ['kettle', 'pipe', 'advanced'];
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

    /**
     * 初始化高级工具
     */
    function initAdvancedTools() {
        AdvancedToolsUI.init('advanced-tools-container');
        bindSensitivityButtons();
        bindOptimizerButtons();
        bindDOEButtons();
    }

    /**
     * 绑定灵敏度分析按钮
     */
    function bindSensitivityButtons() {
        document.getElementById('sa-run-btn').addEventListener('click', runSensitivityAnalysis);
        document.getElementById('sa-export-btn').addEventListener('click', exportSensitivityResults);
    }

    /**
     * 确保高级工具图表可见
     */
    function ensureAdvancedChartsVisible() {
        const chartContainer = document.getElementById('advanced-panel-charts');
        if (chartContainer) {
            chartContainer.style.display = 'contents';
        }
        switchModule('advanced');
    }

    /**
     * 运行灵敏度分析
     */
    function runSensitivityAnalysis() {
        const config = AdvancedToolsUI.getSensitivityConfig();
        const baseParams = AdvancedToolsUI.getBaseParams(config.moduleType);

        try {
            ensureAdvancedChartsVisible();
            initChartsForModule('advanced');

            currentSensitivityResult = SensitivityAnalysis.analyze(
                config.moduleType,
                baseParams,
                config.perturbation
            );

            AdvancedToolsUI.updateSensitivityResults(currentSensitivityResult);
            renderSensitivityCharts(currentSensitivityResult);
        } catch (e) {
            console.error('灵敏度分析错误:', e);
            alert('灵敏度分析执行失败，请查看控制台');
        }
    }

    /**
     * 渲染灵敏度分析图表
     */
    function renderSensitivityCharts(results) {
        const labels = results.ranking.map(r => r.label);
        const weights = results.ranking.map(r => r.weight);
        const d50Sens = results.ranking.map(r => Math.abs(r.d50Sensitivity));
        const solidSens = results.ranking.map(r => Math.abs(r.solidSensitivity));

        chartInstances['adv-chart-1'].render_bar_chart({
            labels,
            datasets: [
                { label: '综合权重', data: weights, color: '#007bff' }
            ]
        }, { title: '参数综合权重排名', xLabel: '参数', yLabel: '权重' });

        chartInstances['adv-chart-2'].render_bar_chart({
            labels,
            datasets: [
                { label: 'D50灵敏度', data: d50Sens, color: '#ffc107' },
                { label: '固含率灵敏度', data: solidSens, color: '#28a745' }
            ]
        }, { title: '各指标灵敏度对比', xLabel: '参数', yLabel: '灵敏度指数' });
    }

    /**
     * 导出灵敏度分析结果
     */
    function exportSensitivityResults() {
        if (!currentSensitivityResult) {
            alert('请先执行灵敏度分析');
            return;
        }

        const rows = currentSensitivityResult.ranking.map(r => {
            const param = currentSensitivityResult.parameters.find(p => p.key === r.key);
            return [
                r.rank,
                r.label,
                param.baselineValue,
                param.d50.baseline,
                param.d50.changePercentLow,
                param.d50.changePercentHigh,
                r.d50Sensitivity,
                param.solidContent.baseline,
                param.solidContent.changePercentLow,
                param.solidContent.changePercentHigh,
                r.solidSensitivity,
                r.weight
            ];
        });

        Exporter.exportCSV(
            'sensitivity_analysis.csv',
            ['排名', '参数', '基准值', 'D50基准', 'D50变化%(-)', 'D50变化%(+)', 'D50灵敏度',
             '固含率基准', '固含率变化%(-)', '固含率变化%(+)', '固含率灵敏度', '综合权重'],
            rows
        );
    }

    /**
     * 绑定优化器按钮
     */
    function bindOptimizerButtons() {
        document.getElementById('opt-run-btn').addEventListener('click', runOptimizer);
        document.getElementById('opt-apply-btn').addEventListener('click', applyOptimizedParams);
    }

    /**
     * 运行优化器
     */
    function runOptimizer() {
        const config = AdvancedToolsUI.getOptimizerConfig();

        try {
            initChartsForModule('advanced');

            currentOptimizerResult = Optimizer.optimize(config);
            AdvancedToolsUI.updateOptimizerResults(currentOptimizerResult);
            renderOptimizerCharts(currentOptimizerResult);
        } catch (e) {
            console.error('优化器错误:', e);
            alert('优化执行失败，请查看控制台');
        }
    }

    /**
     * 渲染优化器图表
     */
    function renderOptimizerCharts(results) {
        const history = results.history;
        const iterations = history.map((_, i) => i + 1);
        const scores = history.map(h => h.score * 100);

        chartInstances['adv-chart-1'].render_line_chart({
            labels: iterations,
            datasets: [
                { label: '优化误差 (%)', data: scores, color: '#dc3545' }
            ]
        }, { title: '优化收敛过程', xLabel: '迭代次数', yLabel: '误差 (%)' });

        const paramKeys = Object.keys(results.bestParams).slice(0, 6);
        const paramLabels = paramKeys.map(k => {
            const config = results.config.moduleType === 'kettle'
                ? SensitivityAnalysis.KETTLE_PARAMS
                : SensitivityAnalysis.PIPE_PARAMS;
            const param = config.find(p => p.key === k);
            return param ? param.label : k;
        });
        const paramValues = paramKeys.map(k => results.bestParams[k]);

        chartInstances['adv-chart-2'].render_bar_chart({
            labels: paramLabels,
            datasets: [
                { label: '最优值', data: paramValues, color: '#6f42c1' }
            ]
        }, { title: '最优参数组合', xLabel: '参数', yLabel: '值' });
    }

    /**
     * 应用优化后的参数到主模块
     */
    function applyOptimizedParams() {
        if (!currentOptimizerResult) {
            alert('请先执行参数优化');
            return;
        }

        const { moduleType, bestParams } = currentOptimizerResult;

        if (moduleType === 'kettle') {
            if (bestParams.saltConc) document.getElementById('k-salt').value = bestParams.saltConc.toFixed(2);
            if (bestParams.nh3Conc) document.getElementById('k-nh3').value = bestParams.nh3Conc.toFixed(2);
            if (bestParams.naohConc) document.getElementById('k-naoh').value = bestParams.naohConc.toFixed(2);
            if (bestParams.feedRate) document.getElementById('k-flow').value = bestParams.feedRate.toFixed(0);
            if (bestParams.stirSpeed) document.getElementById('k-stir').value = bestParams.stirSpeed.toFixed(0);
            if (bestParams.totalTime) document.getElementById('k-time').value = bestParams.totalTime.toFixed(0);
            if (bestParams.phCurve) document.getElementById('k-ph').value = bestParams.phCurve.toFixed(1);
            if (bestParams.tempCurve) document.getElementById('k-temp').value = bestParams.tempCurve.toFixed(0);
        } else {
            if (bestParams.initFlow) document.getElementById('p-flow').value = bestParams.initFlow.toFixed(0);
            if (bestParams.initConc) document.getElementById('p-salt').value = bestParams.initConc.toFixed(2);
            if (bestParams.initNH3) document.getElementById('p-nh3').value = bestParams.initNH3.toFixed(2);
            if (bestParams.initPH) document.getElementById('p-ph').value = bestParams.initPH.toFixed(1);
            if (bestParams.initTemp) document.getElementById('p-temp').value = bestParams.initTemp.toFixed(0);
            if (bestParams.pipeLength) document.getElementById('p-len').value = bestParams.pipeLength.toFixed(0);
            if (bestParams.pipeDiameter) document.getElementById('p-dia').value = bestParams.pipeDiameter.toFixed(0);
        }

        alert('最优参数已应用到主模块面板');
    }

    /**
     * 绑定DOE按钮
     */
    function bindDOEButtons() {
        document.getElementById('doe-run-btn').addEventListener('click', runDOE);
        document.getElementById('doe-export-btn').addEventListener('click', exportDOEResults);
    }

    /**
     * 运行DOE
     */
    function runDOE() {
        const config = AdvancedToolsUI.getDOEConfig();
        const factors = AdvancedToolsUI.getDOEFactors(config.moduleType);

        try {
            initChartsForModule('advanced');

            const design = DOE.generateDesign({
                method: config.method,
                factors,
                numSamples: config.numSamples,
                centerPoints: config.centerPoints
            });

            currentDOEResult = DOE.executeExperiments(design, config.moduleType);
            AdvancedToolsUI.updateDOEResults(currentDOEResult);
            renderDOECharts(currentDOEResult);
        } catch (e) {
            console.error('DOE错误:', e);
            alert('实验设计执行失败，请查看控制台');
        }
    }

    /**
     * 渲染DOE图表
     */
    function renderDOECharts(results) {
        const runIds = results.experiments.map(e => e.runId);
        const d50Values = results.experiments.map(e => e.response.d50);
        const solidValues = results.experiments.map(e => e.response.solidContent);

        chartInstances['adv-chart-1'].render_line_chart({
            labels: runIds,
            datasets: [
                { label: 'D50 (μm)', data: d50Values, color: '#ffc107' },
                { label: '固含率 (%)', data: solidValues, color: '#28a745' }
            ]
        }, { title: '各实验响应值', xLabel: '实验编号', yLabel: '响应值' });

        const factorKeys = Object.keys(results.analysis.effects);
        const factorLabels = factorKeys.map(k => {
            const factor = results.factors.find(f => f.key === k);
            return factor ? factor.label : k;
        });
        const d50Effects = factorKeys.map(k => results.analysis.effects[k]?.d50 || 0);
        const solidEffects = factorKeys.map(k => results.analysis.effects[k]?.solidContent || 0);

        chartInstances['adv-chart-2'].render_bar_chart({
            labels: factorLabels,
            datasets: [
                { label: 'D50效应', data: d50Effects, color: '#ffc107' },
                { label: '固含率效应', data: solidEffects, color: '#28a745' }
            ]
        }, { title: '因子主效应分析', xLabel: '因子', yLabel: '效应值' });
    }

    /**
     * 导出DOE结果
     */
    function exportDOEResults() {
        if (!currentDOEResult) {
            alert('请先执行实验设计');
            return;
        }

        const factorKeys = currentDOEResult.factors.map(f => f.key);
        const factorLabels = currentDOEResult.factors.map(f => f.label);

        const rows = currentDOEResult.experiments.map(exp => [
            exp.runId,
            ...factorKeys.map(k => exp.factors[k]),
            exp.response.d50,
            exp.response.solidContent,
            exp.response.supersaturation
        ]);

        Exporter.exportCSV(
            'doe_results.csv',
            ['Run', ...factorLabels, 'D50(μm)', '固含率(%)', '最大过饱和度'],
            rows
        );
    }
});
