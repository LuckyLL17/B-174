const ProcessOptimizerUI = {
    chartInstances: {},
    currentResults: {},
    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;
        this._buildOptimizerPanel();
        this._buildSensitivityPanel();
        this._buildDOEPanel();
        this._bindEvents();
    },

    _fmt(val, digits = 4) {
        if (val === null || val === undefined || typeof val !== 'number' || !isFinite(val)) return '-';
        return val.toFixed(digits);
    },

    _buildOptimizerPanel() {
        const panel = document.getElementById('optimizer-sub-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div class="input-section">
                <h3>优化目标</h3>
                <div class="form-group">
                    <label>目标 D50 (μm)</label>
                    <input type="number" id="opt-target-d50" value="10" step="0.5">
                </div>
                <div class="form-group">
                    <label>目标固含率 (%) <span style="font-size:0.75rem;color:#999">可选</span></label>
                    <input type="number" id="opt-target-sc" value="" step="0.5" placeholder="留空则仅优化D50">
                </div>
            </div>
            <div class="input-section">
                <h3>优化设置</h3>
                <div class="form-group">
                    <label>优化方法</label>
                    <select id="opt-method">
                        <option value="nelder-mead">Nelder-Mead 单纯形法</option>
                        <option value="grid-search">网格搜索</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>最大迭代次数</label>
                    <input type="number" id="opt-max-iter" value="300" step="50">
                </div>
                <div class="form-group" id="opt-grid-points-group" style="display:none">
                    <label>网格密度</label>
                    <input type="number" id="opt-grid-points" value="5" step="1" min="3" max="10">
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" id="opt-run-btn">开始优化</button>
                <button class="btn btn-secondary" id="opt-export-btn">导出结果</button>
            </div>
        `;
    },

    _buildSensitivityPanel() {
        const panel = document.getElementById('sensitivity-sub-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div class="input-section">
                <h3>分析设置</h3>
                <div class="form-group">
                    <label>扰动比例 (%)</label>
                    <input type="number" id="sa-perturbation" value="5" step="1" min="1" max="50">
                </div>
                <div class="form-group">
                    <label>分析目标</label>
                    <div style="display:flex; gap:12px; margin-top:4px;">
                        <label style="display:flex;align-items:center;gap:4px;font-size:0.85rem;">
                            <input type="checkbox" id="sa-target-d50" checked style="width:auto;"> D50
                        </label>
                        <label style="display:flex;align-items:center;gap:4px;font-size:0.85rem;">
                            <input type="checkbox" id="sa-target-sc" checked style="width:auto;"> 固含率
                        </label>
                    </div>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" id="sa-run-btn">开始分析</button>
                <button class="btn btn-secondary" id="sa-export-btn">导出报告</button>
            </div>
        `;
    },

    _buildDOEPanel() {
        const panel = document.getElementById('doe-sub-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div class="input-section">
                <h3>实验设计方法</h3>
                <div class="form-group">
                    <label>DOE 方法</label>
                    <select id="doe-method">
                        <option value="full-factorial">全因子设计 (Full Factorial)</option>
                        <option value="fractional-factorial">部分因子设计 (Fractional)</option>
                        <option value="latin-hypercube" selected>拉丁超立方采样 (LHS)</option>
                        <option value="central-composite">中心复合设计 (CCD)</option>
                    </select>
                </div>
                <div class="form-group" id="doe-levels-group">
                    <label>因子水平数</label>
                    <input type="number" id="doe-levels" value="2" step="1" min="2" max="5">
                </div>
                <div class="form-group" id="doe-samples-group">
                    <label>采样数</label>
                    <input type="number" id="doe-samples" value="20" step="5" min="10" max="100">
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" id="doe-run-btn">生成实验方案</button>
                <button class="btn btn-secondary" id="doe-export-btn">导出方案</button>
            </div>
        `;
    },

    _bindEvents() {
        const self = this;

        const subBtns = document.querySelectorAll('#optimizer-panel .sub-tab-btn');
        const subPanels = document.querySelectorAll('#optimizer-panel .sub-panel');
        subBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                subBtns.forEach(b => b.classList.remove('active'));
                subPanels.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.sub).classList.add('active');
            });
        });

        const methodSelect = document.getElementById('opt-method');
        if (methodSelect) {
            methodSelect.addEventListener('change', () => {
                const gridGroup = document.getElementById('opt-grid-points-group');
                if (gridGroup) {
                    gridGroup.style.display = methodSelect.value === 'grid-search' ? 'block' : 'none';
                }
            });
        }

        const doeMethodSelect = document.getElementById('doe-method');
        if (doeMethodSelect) {
            doeMethodSelect.addEventListener('change', () => {
                const levelsGroup = document.getElementById('doe-levels-group');
                const samplesGroup = document.getElementById('doe-samples-group');
                const val = doeMethodSelect.value;
                if (levelsGroup) levelsGroup.style.display = (val === 'full-factorial') ? 'block' : 'none';
                if (samplesGroup) samplesGroup.style.display = (val === 'latin-hypercube') ? 'block' : 'none';
            });
            doeMethodSelect.dispatchEvent(new Event('change'));
        }

        const optRunBtn = document.getElementById('opt-run-btn');
        if (optRunBtn) {
            optRunBtn.addEventListener('click', () => self._runOptimizer());
        }

        const saRunBtn = document.getElementById('sa-run-btn');
        if (saRunBtn) {
            saRunBtn.addEventListener('click', () => self._runSensitivity());
        }

        const doeRunBtn = document.getElementById('doe-run-btn');
        if (doeRunBtn) {
            doeRunBtn.addEventListener('click', () => self._runDOE());
        }

        const optExportBtn = document.getElementById('opt-export-btn');
        if (optExportBtn) {
            optExportBtn.addEventListener('click', () => self._exportOptimizer());
        }

        const saExportBtn = document.getElementById('sa-export-btn');
        if (saExportBtn) {
            saExportBtn.addEventListener('click', () => self._exportSensitivity());
        }

        const doeExportBtn = document.getElementById('doe-export-btn');
        if (doeExportBtn) {
            doeExportBtn.addEventListener('click', () => self._exportDOE());
        }
    },

    _getCurrentKettleParams() {
        return {
            saltConc: parseFloat(document.getElementById('k-salt').value) || 2.0,
            nh3Conc: parseFloat(document.getElementById('k-nh3').value) || 0.5,
            naohConc: parseFloat(document.getElementById('k-naoh').value) || 4.0,
            feedRate: parseFloat(document.getElementById('k-flow').value) || 10,
            stirSpeed: parseFloat(document.getElementById('k-stir').value) || 600,
            totalTime: parseFloat(document.getElementById('k-time').value) || 10,
            phCurve: parseFloat(document.getElementById('k-ph').value) || 11.0,
            tempCurve: parseFloat(document.getElementById('k-temp').value) || 55
        };
    },

    _getParamDefs() {
        return {
            saltConc: { min: 0.5, max: 4.0, label: '金属盐浓度 (mol/L)' },
            nh3Conc: { min: 0.1, max: 2.0, label: '氨水浓度 (mol/L)' },
            naohConc: { min: 1.0, max: 8.0, label: '碱液浓度 (mol/L)' },
            feedRate: { min: 2, max: 30, label: '进料速度 (L/h)' },
            phCurve: { min: 9.0, max: 12.5, label: 'pH 设定值' },
            tempCurve: { min: 30, max: 80, label: '温度 (°C)' },
            stirSpeed: { min: 200, max: 1200, label: '搅拌转速 (rpm)' }
        };
    },

    _runOptimizer() {
        const params = this._getCurrentKettleParams();
        const paramDefs = this._getParamDefs();
        const targetD50 = parseFloat(document.getElementById('opt-target-d50').value) || 10;
        const scInput = document.getElementById('opt-target-sc').value;
        const targetSC = scInput ? parseFloat(scInput) : null;
        const method = document.getElementById('opt-method').value;
        const maxIter = parseInt(document.getElementById('opt-max-iter').value) || 300;
        const fixedParams = { totalTime: params.totalTime };

        let result;
        if (method === 'nelder-mead') {
            result = ProcessOptimizer.optimize({
                simulateFn: ReactionKettle.simulate.bind(ReactionKettle),
                paramDefs,
                targetD50,
                targetSolidContent: targetSC,
                initialParams: params,
                fixedParams,
                maxIter
            });
        } else {
            const gridPoints = parseInt(document.getElementById('opt-grid-points').value) || 5;
            result = ProcessOptimizer.gridSearch({
                simulateFn: ReactionKettle.simulate.bind(ReactionKettle),
                paramDefs,
                targetD50,
                targetSolidContent: targetSC,
                fixedParams,
                gridPoints
            });
        }

        this.currentResults.optimizer = result;

        const container = document.getElementById('opt-result-table');
        if (container) {
            const optParams = result.optimalParams || {};
            const optKeys = Object.keys(paramDefs);

            let html = '<table class="result-table"><thead><tr><th>参数</th><th>优化值</th><th>原始值</th></tr></thead><tbody>';
            optKeys.forEach(key => {
                const def = paramDefs[key];
                const label = def ? def.label : key;
                const optVal = optParams[key];
                const origVal = params[key];
                html += `<tr><td>${label}</td><td class="val-opt">${this._fmt(optVal)}</td><td class="val-orig">${this._fmt(origVal)}</td></tr>`;
            });
            html += '</tbody></table>';
            html += `<div class="opt-summary">
                <div class="opt-summary-item"><span class="opt-label">目标 D50</span><span class="opt-value">${targetD50} μm</span></div>
                <div class="opt-summary-item"><span class="opt-label">实际 D50</span><span class="opt-value">${this._fmt(result.finalD50)} μm</span></div>
                <div class="opt-summary-item"><span class="opt-label">相对误差</span><span class="opt-value">${this._fmt(result.d50Error, 2)}%</span></div>
                ${result.finalSolidContent !== null && result.finalSolidContent !== undefined ? `<div class="opt-summary-item"><span class="opt-label">固含率</span><span class="opt-value">${this._fmt(result.finalSolidContent)}%</span></div>` : ''}
                <div class="opt-summary-item"><span class="opt-label">迭代次数</span><span class="opt-value">${result.iterations || result.totalRuns || '-'}</span></div>
                <div class="opt-summary-item"><span class="opt-label">收敛状态</span><span class="opt-value">${result.converged !== undefined ? (result.converged ? '已收敛' : '未收敛') : '-'}</span></div>
            </div>`;
            container.innerHTML = html;
        }

        if (result.history && result.history.length > 1) {
            const canvas = document.getElementById('opt-chart');
            if (canvas && window.ChartRenderer) {
                if (!this.chartInstances['opt-chart']) {
                    this.chartInstances['opt-chart'] = new ChartRenderer('opt-chart');
                }
                const h = result.history;
                this.chartInstances['opt-chart'].render_line_chart({
                    labels: h.map(r => r.iteration),
                    datasets: [
                        { label: 'Cost', data: h.map(r => r.cost), color: '#dc3545' }
                    ]
                }, { title: '优化收敛曲线', xLabel: '迭代次数', yLabel: 'Cost' });
            }
        }
    },

    _runSensitivity() {
        const params = this._getCurrentKettleParams();
        const perturbation = (parseFloat(document.getElementById('sa-perturbation').value) || 5) / 100;
        const targets = [];
        if (document.getElementById('sa-target-d50').checked) targets.push('d50');
        if (document.getElementById('sa-target-sc').checked) targets.push('solidContent');
        if (targets.length === 0) {
            alert('请至少选择一个分析目标');
            return;
        }

        const paramDefs = this._getParamDefs();
        const result = SensitivityAnalysis.analyze(
            params,
            ReactionKettle.simulate.bind(ReactionKettle),
            { perturbation, targets, paramDefs }
        );

        this.currentResults.sensitivity = result;

        const container = document.getElementById('sa-result-area');
        if (container) {
            let html = '<div class="sa-weight-charts">';
            targets.forEach(t => {
                const tLabel = t === 'd50' ? 'D50' : '固含率';
                html += `<div class="sa-weight-chart-item"><h4>${tLabel} 影响权重</h4><div class="sa-bar-chart">`;
                const weights = result.weights[t] || {};
                const sortedKeys = Object.keys(weights).sort((a, b) => (weights[b] || 0) - (weights[a] || 0));
                sortedKeys.forEach(key => {
                    const w = weights[key] || 0;
                    const label = paramDefs[key] ? paramDefs[key].label : key;
                    html += `<div class="sa-bar-row">
                        <span class="sa-bar-label">${label}</span>
                        <div class="sa-bar-track"><div class="sa-bar-fill" style="width:${w}%"></div></div>
                        <span class="sa-bar-value">${this._fmt(w, 2)}%</span>
                    </div>`;
                });
                html += '</div></div>';
            });
            html += '</div>';

            html += '<table class="result-table sa-detail-table"><thead><tr><th>参数</th>';
            targets.forEach(t => {
                const tLabel = t === 'd50' ? 'D50' : '固含率';
                html += `<th>${tLabel} 灵敏度</th><th>${tLabel} 权重</th>`;
            });
            html += '</tr></thead><tbody>';
            result.paramKeys.forEach(key => {
                const s = result.sensitivities[key];
                if (!s) return;
                const label = paramDefs[key] ? paramDefs[key].label : key;
                html += `<tr><td>${label}</td>`;
                targets.forEach(t => {
                    const e = s.effects[t];
                    const w = result.weights[t] ? result.weights[t][key] : 0;
                    if (e && isFinite(e.normalizedSensitivity)) {
                        html += `<td>${this._fmt(e.normalizedSensitivity)}</td>`;
                    } else {
                        html += `<td>-</td>`;
                    }
                    html += `<td>${this._fmt(w, 2)}%</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';

            container.innerHTML = html;
        }
    },

    _runDOE() {
        const paramDefs = this._getParamDefs();
        const method = document.getElementById('doe-method').value;
        const levels = parseInt(document.getElementById('doe-levels').value) || 2;
        const samples = parseInt(document.getElementById('doe-samples').value) || 20;
        const fixedParams = { totalTime: parseFloat(document.getElementById('k-time').value) || 10 };

        let experiments;
        switch (method) {
            case 'full-factorial':
                experiments = DOEDesign.fullFactorial(paramDefs, levels);
                break;
            case 'fractional-factorial':
                experiments = DOEDesign.fractionalFactorial(paramDefs);
                break;
            case 'latin-hypercube':
                experiments = DOEDesign.latinHypercube(paramDefs, samples);
                break;
            case 'central-composite':
                experiments = DOEDesign.centralComposite(paramDefs);
                break;
            default:
                experiments = DOEDesign.latinHypercube(paramDefs, samples);
        }

        const wrappedSimulate = (params) => {
            return ReactionKettle.simulate(Object.assign({}, fixedParams, params));
        };

        const evaluations = DOEDesign.evaluate(
            experiments,
            wrappedSimulate,
            ['d50', 'solidContent']
        );

        const designSpace = DOEDesign.analyzeDesignSpace(evaluations, paramDefs, ['d50', 'solidContent']);

        this.currentResults.doe = { experiments, evaluations, designSpace, method };

        const container = document.getElementById('doe-result-area');
        if (container) {
            let html = `<div class="doe-summary">
                <div class="doe-summary-item"><span class="doe-label">实验方法</span><span class="doe-value">${method}</span></div>
                <div class="doe-summary-item"><span class="doe-label">实验次数</span><span class="doe-value">${experiments.length}</span></div>
            </div>`;

            if (designSpace && designSpace.targets) {
                html += '<div class="doe-space-stats">';
                ['d50', 'solidContent'].forEach(t => {
                    if (designSpace.targets[t]) {
                        const tLabel = t === 'd50' ? 'D50 (μm)' : '固含率 (%)';
                        const stats = designSpace.targets[t];
                        html += `<div class="doe-stat-card">
                            <h4>${tLabel} 分布</h4>
                            <div class="doe-stat-row"><span>最小值</span><span>${this._fmt(stats.min)}</span></div>
                            <div class="doe-stat-row"><span>最大值</span><span>${this._fmt(stats.max)}</span></div>
                            <div class="doe-stat-row"><span>均值</span><span>${this._fmt(stats.mean)}</span></div>
                            <div class="doe-stat-row"><span>标准差</span><span>${this._fmt(stats.std)}</span></div>
                            <div class="doe-stat-row"><span>中位数</span><span>${this._fmt(stats.median)}</span></div>
                        </div>`;
                    }
                });
                html += '</div>';
            }

            html += '<div class="doe-table-wrapper"><table class="result-table doe-table"><thead><tr><th>#</th>';
            const paramKeys = Object.keys(paramDefs);
            paramKeys.forEach(key => {
                html += `<th>${paramDefs[key].label}</th>`;
            });
            html += '<th>D50 (μm)</th><th>固含率 (%)</th></tr></thead><tbody>';

            evaluations.slice(0, 30).forEach((ev, i) => {
                html += `<tr><td>${i + 1}</td>`;
                paramKeys.forEach(key => {
                    const v = ev.params[key];
                    html += `<td>${v !== undefined && isFinite(v) ? v.toFixed(3) : '-'}</td>`;
                });
                const d50Val = ev.results && ev.results.d50 && isFinite(ev.results.d50.final) ? ev.results.d50.final.toFixed(4) : '-';
                const scVal = ev.results && ev.results.solidContent && isFinite(ev.results.solidContent.final) ? ev.results.solidContent.final.toFixed(4) : '-';
                html += `<td>${d50Val}</td><td>${scVal}</td></tr>`;
            });
            html += '</tbody></table></div>';

            if (experiments.length > 30) {
                html += `<p class="doe-more-hint">显示前 30 条，共 ${experiments.length} 条实验方案</p>`;
            }

            container.innerHTML = html;
        }

        this._drawDOEChart(evaluations, paramDefs);
    },

    _drawDOEChart(evaluations, paramDefs) {
        const canvas = document.getElementById('doe-chart');
        if (!canvas || !window.ChartRenderer) return;

        if (!this.chartInstances['doe-chart']) {
            this.chartInstances['doe-chart'] = new ChartRenderer('doe-chart');
        }

        const paramKeys = Object.keys(paramDefs);
        if (paramKeys.length < 2) return;

        const xKey = paramKeys[0];
        const yKey = paramKeys[1];

        const labels = evaluations.map((_, i) => i);
        const chart = this.chartInstances['doe-chart'];

        chart.render_line_chart({
            labels,
            datasets: [
                { label: paramDefs[xKey].label, data: evaluations.map(e => e.params[xKey] || 0), color: '#007bff' },
                { label: paramDefs[yKey].label, data: evaluations.map(e => e.params[yKey] || 0), color: '#28a745' },
                { label: 'D50 (μm)', data: evaluations.map(e => e.results && e.results.d50 && isFinite(e.results.d50.final) ? e.results.d50.final : 0), color: '#dc3545' }
            ]
        }, { title: 'DOE 实验参数分布', xLabel: '实验编号', yLabel: 'Value' });
    },

    _exportOptimizer() {
        const result = this.currentResults.optimizer;
        if (!result) { alert('请先运行优化'); return; }

        const headers = ['参数', '优化值'];
        const optParams = result.optimalParams || {};
        const rows = Object.keys(optParams).map(k => [k, typeof optParams[k] === 'number' && isFinite(optParams[k]) ? optParams[k].toFixed(6) : '-']);
        rows.push(['目标D50(um)', this._fmt(result.finalD50, 6)]);
        rows.push(['D50误差(%)', this._fmt(result.d50Error, 4)]);
        rows.push(['收敛', result.converged !== undefined ? (result.converged ? '是' : '否') : '-']);

        if (window.Exporter) {
            Exporter.exportCSV('optimizer_result.csv', headers, rows);
        }
    },

    _exportSensitivity() {
        const result = this.currentResults.sensitivity;
        if (!result) { alert('请先运行灵敏度分析'); return; }

        const headers = ['参数', '原始值'].concat(
            ...result.targets.map(t => [`${t}_灵敏度`, `${t}_权重(%)`])
        );
        const rows = result.paramKeys.map(key => {
            const s = result.sensitivities[key];
            if (!s) return [key, '-', ...result.targets.map(() => '-').flatMap(x => [x, x])];
            const row = [key, typeof s.originalValue === 'number' && isFinite(s.originalValue) ? s.originalValue.toFixed(6) : '-'];
            result.targets.forEach(t => {
                const e = s.effects ? s.effects[t] : null;
                const w = result.weights[t] ? result.weights[t][key] : null;
                row.push(e && isFinite(e.normalizedSensitivity) ? e.normalizedSensitivity.toFixed(6) : '-');
                row.push(w !== null && w !== undefined && isFinite(w) ? w.toFixed(4) : '-');
            });
            return row;
        });

        if (window.Exporter) {
            Exporter.exportCSV('sensitivity_result.csv', headers, rows);
        }
    },

    _exportDOE() {
        const data = this.currentResults.doe;
        if (!data) { alert('请先生成DOE方案'); return; }

        const paramDefs = this._getParamDefs();
        const paramKeys = Object.keys(paramDefs);
        const headers = ['实验编号'].concat(
            paramKeys.map(k => paramDefs[k].label),
            ['D50(um)', '固含率(%)']
        );
        const rows = data.evaluations.map((ev, i) => {
            const row = [i + 1];
            paramKeys.forEach(key => {
                const v = ev.params[key];
                row.push(v !== undefined && isFinite(v) ? v.toFixed(6) : '-');
            });
            const d50 = ev.results && ev.results.d50 && isFinite(ev.results.d50.final) ? ev.results.d50.final.toFixed(6) : '-';
            const sc = ev.results && ev.results.solidContent && isFinite(ev.results.solidContent.final) ? ev.results.solidContent.final.toFixed(6) : '-';
            row.push(d50);
            row.push(sc);
            return row;
        });

        if (window.Exporter) {
            Exporter.exportCSV('doe_experiments.csv', headers, rows);
        }
    }
};

window.ProcessOptimizerUI = ProcessOptimizerUI;
