/**
 * components.js
 * UI组件模块 - 负责渲染新功能的界面元素
 */

const AdvancedToolsUI = {
    /**
     * 当前激活的子模块
     */
    activeSubModule: null,

    /**
     * 初始化所有高级工具UI
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        this.render();
    },

    /**
     * 渲染主界面
     */
    render() {
        this.container.innerHTML = `
            <div class="advanced-tools-container">
                <div class="module-selector advanced-selector">
                    <button class="sub-module-btn active" data-submodule="sensitivity">灵敏度分析</button>
                    <button class="sub-module-btn" data-submodule="optimizer">参数优化器</button>
                    <button class="sub-module-btn" data-submodule="doe">DOE实验设计</button>
                </div>
                
                <div id="sensitivity-panel" class="sub-panel active"></div>
                <div id="optimizer-panel" class="sub-panel"></div>
                <div id="doe-panel" class="sub-panel"></div>
            </div>
        `;

        this._bindSubModuleSwitcher();
        this._renderSensitivityPanel();
        this._renderOptimizerPanel();
        this._renderDOEPanel();
    },

    /**
     * 绑定子模块切换
     */
    _bindSubModuleSwitcher() {
        this.container.querySelectorAll('.sub-module-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const subModule = e.target.dataset.submodule;
                this._switchSubModule(subModule);
            });
        });
    },

    /**
     * 切换子模块
     */
    _switchSubModule(subModule) {
        this.activeSubModule = subModule;

        this.container.querySelectorAll('.sub-module-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.submodule === subModule) {
                btn.classList.add('active');
            }
        });

        this.container.querySelectorAll('.sub-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${subModule}-panel`).classList.add('active');
    },

    /**
     * 渲染灵敏度分析面板
     */
    _renderSensitivityPanel() {
        const panel = document.getElementById('sensitivity-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-content">
                <div class="input-section">
                    <h3>灵敏度分析配置</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>选择模块</label>
                            <select id="sa-module">
                                <option value="kettle">反应釜模块</option>
                                <option value="pipe">管道模块</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>扰动比例</label>
                            <select id="sa-perturbation">
                                <option value="0.05">±5%</option>
                                <option value="0.1" selected>±10%</option>
                                <option value="0.15">±15%</option>
                                <option value="0.2">±20%</option>
                            </select>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-primary" id="sa-run-btn">执行分析</button>
                        <button class="btn btn-secondary" id="sa-export-btn">导出结果</button>
                    </div>
                </div>
                <div id="sa-results" class="results-section" style="display:none;">
                    <div class="chart-container">
                        <h3>参数权重排名</h3>
                        <div class="canvas-wrapper">
                            <canvas id="sa-chart-ranking" class="chart-canvas"></canvas>
                        </div>
                    </div>
                    <div class="data-table-container">
                        <h3>详细分析结果</h3>
                        <div class="table-wrapper">
                            <table id="sa-results-table" class="data-table">
                                <thead>
                                    <tr>
                                        <th>排名</th>
                                        <th>参数名称</th>
                                        <th>基准值</th>
                                        <th>D50灵敏度</th>
                                        <th>固含率灵敏度</th>
                                        <th>综合权重</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染优化器面板
     */
    _renderOptimizerPanel() {
        const panel = document.getElementById('optimizer-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-content">
                <div class="input-section">
                    <h3>优化配置</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>选择模块</label>
                            <select id="opt-module">
                                <option value="kettle">反应釜模块</option>
                                <option value="pipe">管道模块</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>优化算法</label>
                            <select id="opt-algorithm">
                                <option value="pattern">模式搜索</option>
                                <option value="random">随机搜索</option>
                                <option value="grid">网格搜索</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>优化目标</label>
                            <select id="opt-objective">
                                <option value="d50">目标粒径 D50</option>
                                <option value="solidContent">固含率</option>
                                <option value="both">D50 + 固含率</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>迭代次数</label>
                            <input type="number" id="opt-iterations" value="50" min="10" max="200">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>目标 D50 (μm)</label>
                            <input type="number" id="opt-target-d50" value="10" step="0.5">
                        </div>
                        <div class="form-group">
                            <label>目标固含率 (%)</label>
                            <input type="number" id="opt-target-solid" value="15" step="1">
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-primary" id="opt-run-btn">开始优化</button>
                        <button class="btn btn-secondary" id="opt-apply-btn">应用到主模块</button>
                    </div>
                </div>
                <div id="opt-results" class="results-section" style="display:none;">
                    <div class="chart-container">
                        <h3>优化收敛过程</h3>
                        <div class="canvas-wrapper">
                            <canvas id="opt-chart-convergence" class="chart-canvas"></canvas>
                        </div>
                    </div>
                    <div class="optimized-params">
                        <h3>最优参数组合</h3>
                        <div id="opt-best-params" class="params-grid"></div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染DOE面板
     */
    _renderDOEPanel() {
        const panel = document.getElementById('doe-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-content">
                <div class="input-section">
                    <h3>实验设计配置</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>选择模块</label>
                            <select id="doe-module">
                                <option value="kettle">反应釜模块</option>
                                <option value="pipe">管道模块</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>DOE方法</label>
                            <select id="doe-method">
                                <option value="central_composite">中心复合设计</option>
                                <option value="box_behnken">Box-Behnken</option>
                                <option value="full_factorial">全因子设计</option>
                                <option value="fractional">部分因子设计</option>
                                <option value="latin_hypercube">拉丁超立方</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>实验次数</label>
                            <input type="number" id="doe-samples" value="20" min="10" max="100">
                        </div>
                        <div class="form-group">
                            <label>中心点数量</label>
                            <input type="number" id="doe-center" value="3" min="1" max="10">
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-primary" id="doe-run-btn">生成并执行</button>
                        <button class="btn btn-secondary" id="doe-export-btn">导出设计矩阵</button>
                    </div>
                </div>
                <div id="doe-results" class="results-section" style="display:none;">
                    <div class="chart-container">
                        <h3>响应曲面分析</h3>
                        <div class="canvas-wrapper">
                            <canvas id="doe-chart-response" class="chart-canvas"></canvas>
                        </div>
                    </div>
                    <div class="chart-container">
                        <h3>主效应分析</h3>
                        <div class="canvas-wrapper">
                            <canvas id="doe-chart-effects" class="chart-canvas"></canvas>
                        </div>
                    </div>
                    <div class="data-table-container">
                        <h3>实验设计矩阵</h3>
                        <div class="table-wrapper">
                            <table id="doe-design-table" class="data-table">
                                <thead></thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 格式化数值显示
     */
    _formatNumber(value, decimals = 3) {
        if (value === null || value === undefined || isNaN(value)) return '-';
        if (Math.abs(value) < 0.001 && value !== 0) {
            return value.toExponential(2);
        }
        if (Math.abs(value) >= 1000) {
            return value.toExponential(2);
        }
        return value.toFixed(decimals);
    },

    /**
     * 更新灵敏度分析结果
     */
    updateSensitivityResults(results) {
        const resultsSection = document.getElementById('sa-results');
        if (!resultsSection) {
            console.error('找不到 sa-results 元素');
            return;
        }
        resultsSection.style.display = 'block';

        const tbody = document.querySelector('#sa-results-table tbody');
        if (!tbody) {
            console.error('找不到 sa-results-table tbody');
            return;
        }
        tbody.innerHTML = '';

        console.log('灵敏度分析结果:', results);
        console.log('排名:', results.ranking);

        for (const item of results.ranking) {
            const param = results.parameters.find(p => p.key === item.key);
            if (!param) continue;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.rank}</td>
                <td>${item.label}</td>
                <td>${this._formatNumber(param.baselineValue)} ${param.unit}</td>
                <td>${this._formatNumber(item.d50Sensitivity)}</td>
                <td>${this._formatNumber(item.solidSensitivity)}</td>
                <td><strong>${this._formatNumber(item.weight)}</strong></td>
            `;
            tbody.appendChild(row);
        }
    },

    /**
     * 更新优化器结果
     */
    updateOptimizerResults(results) {
        const resultsSection = document.getElementById('opt-results');
        resultsSection.style.display = 'block';

        const paramsGrid = document.getElementById('opt-best-params');
        paramsGrid.innerHTML = '';

        const paramConfig = results.config.moduleType === 'kettle'
            ? SensitivityAnalysis.KETTLE_PARAMS
            : SensitivityAnalysis.PIPE_PARAMS;

        const achievedInfo = document.createElement('div');
        achievedInfo.className = 'achieved-info';
        achievedInfo.innerHTML = `
            <div class="achieved-item">
            <span class="label">目标 D50:</span>
            <span class="value">${results.config.targetD50} μm</span>
        </div>
        <div class="achieved-item">
            <span class="label">实际 D50:</span>
            <span class="value highlight">${results.achievedD50.toFixed(2)} μm</span>
        </div>
        <div class="achieved-item">
            <span class="label">目标固含率:</span>
            <span class="value">${results.config.targetSolid}%</span>
        </div>
        <div class="achieved-item">
            <span class="label">实际固含率:</span>
            <span class="value highlight">${results.achievedSolid.toFixed(2)}%</span>
        </div>
        <div class="achieved-item">
            <span class="label">优化误差:</span>
            <span class="value">${(results.bestScore * 100).toFixed(2)}%</span>
        </div>
    `;
    paramsGrid.appendChild(achievedInfo);

        const paramsContainer = document.createElement('div');
        paramsContainer.className = 'params-list';
        
        for (const param of paramConfig) {
            const value = results.bestParams[param.key];
            if (value !== undefined) {
                const paramItem = document.createElement('div');
                paramItem.className = 'param-item';
                paramItem.innerHTML = `
                    <span class="label">${param.label}:</span>
                    <span class="value">${value.toFixed(3)} ${param.unit}</span>
                `;
                paramsContainer.appendChild(paramItem);
            }
        }
        paramsGrid.appendChild(paramsContainer);
    },

    /**
     * 更新DOE结果
     */
    updateDOEResults(results) {
        const resultsSection = document.getElementById('doe-results');
        resultsSection.style.display = 'block';

        const table = document.getElementById('doe-design-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        const factorKeys = results.factors.map(f => f.key);
        const factorLabels = results.factors.map(f => f.label);

        thead.innerHTML = `
            <tr>
                <th>Run</th>
                ${factorLabels.map(l => `<th>${l}</th>`).join('')}
                <th>D50 (μm)</th>
                <th>固含率 (%)</th>
            </tr>
        `;

        tbody.innerHTML = '';
        for (const exp of results.experiments) {
            const row = document.createElement('tr');
            
            let rowHtml = `<td>${exp.runId}</td>`;
            
            for (const k of factorKeys) {
                rowHtml += `<td>${exp.factors[k].toFixed(3)}</td>`;
            }
            
            rowHtml += `
                <td>${exp.response.d50.toFixed(2)}</td>
                <td>${exp.response.solidContent.toFixed(2)}</td>
            `;
            
            row.innerHTML = rowHtml;
            tbody.appendChild(row);
        }
    },

    /**
     * 获取灵敏度分析配置
     */
    getSensitivityConfig() {
        return {
            moduleType: document.getElementById('sa-module').value,
            perturbation: parseFloat(document.getElementById('sa-perturbation').value)
        };
    },

    /**
     * 获取优化器配置
     */
    getOptimizerConfig() {
        return {
            moduleType: document.getElementById('opt-module').value,
            algorithm: document.getElementById('opt-algorithm').value,
            objective: document.getElementById('opt-objective').value,
            iterations: parseInt(document.getElementById('opt-iterations').value),
            targetD50: parseFloat(document.getElementById('opt-target-d50').value),
            targetSolid: parseFloat(document.getElementById('opt-target-solid').value)
        };
    },

    /**
     * 获取DOE配置
     */
    getDOEConfig() {
        return {
            moduleType: document.getElementById('doe-module').value,
            method: document.getElementById('doe-method').value,
            numSamples: parseInt(document.getElementById('doe-samples').value),
            centerPoints: parseInt(document.getElementById('doe-center').value)
        };
    },

    /**
     * 获取模块的基准参数
     */
    getBaseParams(moduleType) {
        const params = moduleType === 'kettle'
            ? SensitivityAnalysis.KETTLE_PARAMS
            : SensitivityAnalysis.PIPE_PARAMS;
        
        const baseParams = {};
        for (const param of params) {
            baseParams[param.key] = param.default;
        }
        return baseParams;
    },

    /**
     * 获取DOE因子配置
     */
    getDOEFactors(moduleType) {
        return moduleType === 'kettle'
            ? SensitivityAnalysis.KETTLE_PARAMS.slice(0, 4)
            : SensitivityAnalysis.PIPE_PARAMS.slice(0, 4);
    }
};

window.AdvancedToolsUI = AdvancedToolsUI;
