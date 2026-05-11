/**
 * main.js
 * 主控制器：处理 UI 交互与模块调度
 */

document.addEventListener('DOMContentLoaded', () => {
    // 初始化图表实例
    const chartInstances = {};
    
    // 全局结果存储
    window.sensitivityResults = null;
    window.optimizerResults = null;
    window.doeDesign = null;
    window.doeResults = null;
    
    // 初始化
    initModuleSwitcher();
    initSimulateButtons();
    initExportButtons();
    initSensitivityAnalysis();
    initParameterOptimizer();
    initDOEDesign();

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
        const chartGroups = ['kettle', 'pipe', 'sensitivity', 'optimizer', 'doe'];
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

    function initSensitivityAnalysis() {
        document.getElementById('sa-calc-btn').addEventListener('click', () => {
            const params = {
                saltConc: parseFloat(document.getElementById('sa-salt').value) || 2.0,
                nh3Conc: parseFloat(document.getElementById('sa-nh3').value) || 0.5,
                naohConc: 4.0,
                feedRate: 10,
                stirSpeed: 600,
                totalTime: parseFloat(document.getElementById('sa-time').value) || 10,
                phCurve: parseFloat(document.getElementById('sa-ph').value) || 11.0,
                tempCurve: parseFloat(document.getElementById('sa-temp').value) || 55
            };

            const options = {
                paramRange: (parseFloat(document.getElementById('sa-range').value) || 10) / 100,
                numSteps: parseInt(document.getElementById('sa-steps').value) || 5
            };

            const results = SensitivityAnalysis.analyze(params, options);
            window.sensitivityResults = results;

            renderSensitivityCharts(results);
            renderSensitivityReport(results);
        });

        document.getElementById('sa-export-btn').addEventListener('click', () => {
            if (!window.sensitivityResults) {
                alert('请先运行分析');
                return;
            }
            const report = SensitivityAnalysis.generateReport(window.sensitivityResults);
            Exporter.exportCSV('sensitivity_analysis.csv', 
                ['参数', '标签', 'D50灵敏度', '固含率灵敏度'],
                report.details.map(d => [d.parameter, d.label, d.sensitivities.d50, d.sensitivities.solidContent])
            );
        });
    }

    function renderSensitivityCharts(results) {
        const d50Ranking = results.rankings.d50;
        const solidRanking = results.rankings.solidContent;
        const combinedRanking = results.rankings.combined;

        chartInstances['sa-chart-1'].render_bar_chart({
            labels: d50Ranking.map(r => r.label),
            datasets: [{ label: 'D50 灵敏度权重', data: d50Ranking.map(r => r.weight), color: '#dc3545' }]
        }, { title: 'D50 灵敏度权重排名', labels: d50Ranking.map(r => r.label) });

        chartInstances['sa-chart-2'].render_bar_chart({
            labels: solidRanking.map(r => r.label),
            datasets: [{ label: '固含率灵敏度权重', data: solidRanking.map(r => r.weight), color: '#28a745' }]
        }, { title: '固含率灵敏度权重排名', labels: solidRanking.map(r => r.label) });

        chartInstances['sa-chart-3'].render_bar_chart({
            labels: combinedRanking.map(r => r.label),
            datasets: [
                { label: 'D50权重', data: combinedRanking.map(r => results.parameters[r.param].sensitivity.d50), color: '#dc3545' },
                { label: '固含率权重', data: combinedRanking.map(r => results.parameters[r.param].sensitivity.solidContent), color: '#28a745' }
            ]
        }, { title: '综合灵敏度分析对比', labels: combinedRanking.map(r => r.label) });
    }

    function renderSensitivityReport(results) {
        const reportDiv = document.getElementById('sa-report');
        const d50Top = results.rankings.d50[0];
        const solidTop = results.rankings.solidContent[0];

        reportDiv.innerHTML = `
            <div class="report-section">
                <h4>📊 分析摘要</h4>
                <div class="param-item">
                    <span class="param-label">分析参数数量:</span>
                    <span class="param-value">${Object.keys(results.parameters).length}</span>
                </div>
                <div class="param-item">
                    <span class="param-label">对D50影响最大:</span>
                    <span class="param-value success">${d50Top.label} (${d50Top.weight.toFixed(4)})</span>
                </div>
                <div class="param-item">
                    <span class="param-label">对固含率影响最大:</span>
                    <span class="param-value success">${solidTop.label} (${solidTop.weight.toFixed(4)})</span>
                </div>
            </div>
            <div class="report-section">
                <h4>🏆 D50 灵敏度排名</h4>
                ${results.rankings.d50.map((r, i) => `
                    <div class="param-item">
                        <span class="param-label">${i + 1}. ${r.label}</span>
                        <span class="param-value">${r.weight.toFixed(4)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="report-section">
                <h4>🏆 固含率灵敏度排名</h4>
                ${results.rankings.solidContent.map((r, i) => `
                    <div class="param-item">
                        <span class="param-label">${i + 1}. ${r.label}</span>
                        <span class="param-value">${r.weight.toFixed(4)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function initParameterOptimizer() {
        document.getElementById('opt-calc-btn').addEventListener('click', () => {
            const targets = {
                d50: parseFloat(document.getElementById('opt-target-d50').value) || 10.0,
                d50Weight: parseFloat(document.getElementById('opt-d50-weight').value) || 1.0,
                solidContent: parseFloat(document.getElementById('opt-target-solid').value) || 15.0,
                solidContentWeight: parseFloat(document.getElementById('opt-solid-weight').value) || 0.5
            };

            const options = {
                method: document.getElementById('opt-method').value,
                maxIterations: parseInt(document.getElementById('opt-iterations').value) || 30
            };

            const result = ParameterOptimizer.optimize(targets, {}, options);
            window.optimizerResults = result;

            renderOptimizerCharts(result);
            renderOptimizerReport(result);
        });

        document.getElementById('opt-export-btn').addEventListener('click', () => {
            if (!window.optimizerResults) {
                alert('请先运行优化');
                return;
            }
            const result = window.optimizerResults;
            const rows = Object.entries(result.optimalParameters).map(([key, val]) => [
                key, val.label, val.value.toFixed(4)
            ]);
            Exporter.exportCSV('optimization_result.csv',
                ['参数名', '参数标签', '最优值'],
                rows
            );
        });
    }

    function renderOptimizerCharts(result) {
        result.fullResult = result.fullResult || {};

        if (result.fullResult.time) {
            chartInstances['opt-chart-2'].render_line_chart({
                labels: result.fullResult.time,
                datasets: [
                    { label: 'D50 (μm)', data: result.fullResult.d50, color: '#ffc107' },
                    { label: '固含率 (%)', data: result.fullResult.solidContent, color: '#28a745' }
                ]
            }, { title: '优化后粒径与固含率变化', xLabel: 'Time (h)', yLabel: 'Value' });
        }

        const paramNames = Object.keys(result.optimalParameters);
        const defaultParams = ParameterOptimizer.getDefaultParams();
        chartInstances['opt-chart-3'].render_bar_chart({
            labels: paramNames.map(n => result.optimalParameters[n].label),
            datasets: [
                { label: '默认值', data: paramNames.map(n => defaultParams[n]), color: '#6c757d' },
                { label: '优化值', data: paramNames.map(n => result.optimalParameters[n].value), color: '#007bff' }
            ]
        }, { title: '参数对比分析', labels: paramNames.map(n => result.optimalParameters[n].label) });

        chartInstances['opt-chart-1'].render_line_chart({
            labels: [1, 2, 3, 4, 5],
            datasets: [{ label: '误差收敛', data: [0.5, 0.3, 0.15, 0.08, 0.05], color: '#dc3545' }]
        }, { title: '优化收敛过程示意', xLabel: 'Iteration', yLabel: 'Error' });
    }

    function renderOptimizerReport(result) {
        const reportDiv = document.getElementById('opt-report');
        const statusClass = result.success ? 'success' : 'warning';
        const statusText = result.success ? '✓ 优化成功收敛' : '⚠ 未完全收敛';

        reportDiv.innerHTML = `
            <div class="report-section">
                <h4>🎯 优化状态</h4>
                <div class="param-item">
                    <span class="param-label">状态:</span>
                    <span class="param-value ${statusClass}">${statusText}</span>
                </div>
                <div class="param-item">
                    <span class="param-label">目标D50:</span>
                    <span class="param-value">${result.targetOutputs.d50?.toFixed(2)} μm</span>
                </div>
                <div class="param-item">
                    <span class="param-label">预测D50:</span>
                    <span class="param-value success">${result.predictedOutputs.d50?.toFixed(2)} μm</span>
                </div>
                <div class="param-item">
                    <span class="param-label">D50偏差:</span>
                    <span class="param-value">${result.deviation.d50?.toFixed(2)}%</span>
                </div>
                <div class="param-item">
                    <span class="param-label">目标固含率:</span>
                    <span class="param-value">${result.targetOutputs.solidContent?.toFixed(2)}%</span>
                </div>
                <div class="param-item">
                    <span class="param-label">预测固含率:</span>
                    <span class="param-value success">${result.predictedOutputs.solidContent?.toFixed(2)}%</span>
                </div>
                <div class="param-item">
                    <span class="param-label">固含率偏差:</span>
                    <span class="param-value">${result.deviation.solidContent?.toFixed(2)}%</span>
                </div>
            </div>
            <div class="report-section">
                <h4>⚙️ 最优工艺参数</h4>
                ${Object.entries(result.optimalParameters).map(([key, val]) => `
                    <div class="param-item">
                        <span class="param-label">${val.label}:</span>
                        <span class="param-value">${val.value.toFixed(4)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function initDOEDesign() {
        document.getElementById('doe-gen-btn').addEventListener('click', () => {
            const method = document.getElementById('doe-method').value;
            const levels = parseInt(document.getElementById('doe-levels').value) || 2;

            const factors = {
                saltConc: {
                    min: parseFloat(document.getElementById('doe-salt-min').value) || 1.5,
                    max: parseFloat(document.getElementById('doe-salt-max').value) || 2.5,
                    label: '金属盐浓度'
                },
                nh3Conc: {
                    min: parseFloat(document.getElementById('doe-nh3-min').value) || 0.3,
                    max: parseFloat(document.getElementById('doe-nh3-max').value) || 0.7,
                    label: '氨水浓度'
                },
                phCurve: {
                    min: parseFloat(document.getElementById('doe-ph-min').value) || 10.5,
                    max: parseFloat(document.getElementById('doe-ph-max').value) || 11.5,
                    label: 'pH值'
                }
            };

            const design = DOEDesign.generateDesign(method, factors, { levels });
            window.doeDesign = design;

            renderDOETable(design);
            renderDOEReport(design, null);
        });

        document.getElementById('doe-run-btn').addEventListener('click', () => {
            if (!window.doeDesign) {
                alert('请先生成实验设计');
                return;
            }
            const results = DOEDesign.runSimulations(window.doeDesign);
            window.doeResults = results;

            const analysis = DOEDesign.analyzeResults(results, window.doeDesign);
            renderDOECharts(results, analysis, window.doeDesign);
            renderDOEReport(window.doeDesign, analysis);
        });

        document.getElementById('doe-export-btn').addEventListener('click', () => {
            if (!window.doeDesign) {
                alert('请先生成实验设计');
                return;
            }
            const csv = DOEDesign.exportToCSV(window.doeDesign, window.doeResults);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'doe_design_results.csv';
            link.click();
        });
    }

    function renderDOETable(design) {
        const tableDiv = document.getElementById('doe-table');
        const matrix = DOEDesign.generateDesignMatrix(design);

        let html = '<table class="data-table"><thead><tr>';
        matrix[0].forEach(h => {
            html += `<th>${h}</th>`;
        });
        html += '</tr></thead><tbody>';

        for (let i = 1; i < matrix.length; i++) {
            html += '<tr>';
            matrix[i].forEach(cell => {
                html += `<td>${cell}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';
        tableDiv.innerHTML = html;
    }

    function renderDOECharts(results, analysis, design) {
        const scatterData = results.map(r => ({
            x: r.parameters.saltConc,
            y: r.outputs.d50
        }));

        chartInstances['doe-chart-1'].render_scatter_chart({
            datasets: [{ label: 'D50 vs 盐浓度', data: scatterData, color: '#007bff' }]
        }, { title: 'D50 响应面分析', xLabel: '盐浓度 (mol/L)', yLabel: 'D50 (μm)' });

        const factorNames = design.factorNames;
        const effectData = factorNames.map(f => analysis.effects[f]?.d50 || 0);

        chartInstances['doe-chart-2'].render_bar_chart({
            labels: factorNames.map(f => design.factors[f]?.label || f),
            datasets: [{ label: '主效应 (D50)', data: effectData, color: '#6610f2' }]
        }, { title: '各因子主效应图', labels: factorNames.map(f => design.factors[f]?.label || f) });
    }

    function renderDOEReport(design, analysis) {
        const reportDiv = document.getElementById('doe-report');

        let optimalHtml = '';
        if (analysis && analysis.optimalRuns) {
            optimalHtml = `
                <div class="report-section">
                    <h4>🏆 Top 5 最优实验</h4>
                    ${analysis.optimalRuns.map((run, i) => `
                        <div class="param-item">
                            <span class="param-label">实验 #${run.runId}:</span>
                            <span class="param-value">D50=${run.outputs.d50.toFixed(2)}μm, 固含率=${run.outputs.solidContent.toFixed(2)}%</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        let summaryHtml = '';
        if (analysis && analysis.summary) {
            summaryHtml = `
                <div class="report-section">
                    <h4>📊 响应统计</h4>
                    <div class="param-item">
                        <span class="param-label">D50范围:</span>
                        <span class="param-value">${analysis.summary.d50.min.toFixed(2)} - ${analysis.summary.d50.max.toFixed(2)} μm</span>
                    </div>
                    <div class="param-item">
                        <span class="param-label">D50均值:</span>
                        <span class="param-value">${analysis.summary.d50.mean.toFixed(2)} μm</span>
                    </div>
                    <div class="param-item">
                        <span class="param-label">固含率范围:</span>
                        <span class="param-value">${analysis.summary.solidContent.min.toFixed(2)} - ${analysis.summary.solidContent.max.toFixed(2)}%</span>
                    </div>
                    <div class="param-item">
                        <span class="param-label">固含率均值:</span>
                        <span class="param-value">${analysis.summary.solidContent.mean.toFixed(2)}%</span>
                    </div>
                </div>
            `;
        }

        reportDiv.innerHTML = `
            <div class="report-section">
                <h4>📋 设计信息</h4>
                <div class="param-item">
                    <span class="param-label">设计方法:</span>
                    <span class="param-value">${design.methodName}</span>
                </div>
                <div class="param-item">
                    <span class="param-label">因子数量:</span>
                    <span class="param-value">${design.numFactors}</span>
                </div>
                <div class="param-item">
                    <span class="param-label">实验次数:</span>
                    <span class="param-value success">${design.numRuns}</span>
                </div>
            </div>
            ${summaryHtml}
            ${optimalHtml}
        `;
    }
});
