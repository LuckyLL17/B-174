/**
 * doe.js
 * 实验设计 (Design of Experiments) 核心模块
 * 提供多种DOE方法用于设计空间探索
 */

const DOE = {
    /**
     * DOE方法类型
     */
    METHODS: {
        FULL_FACTORIAL: { key: 'full_factorial', label: '全因子设计', description: '所有因子水平组合' },
        FRACTIONAL_FACTORIAL: { key: 'fractional', label: '部分因子设计', description: '筛选关键因子' },
        CENTRAL_COMPOSITE: { key: 'central_composite', label: '中心复合设计', description: '响应曲面分析' },
        BOX_BEHNKEN: { key: 'box_behnken', label: 'Box-Behnken', description: '三水平响应曲面' },
        LATIN_HYPERCUBE: { key: 'latin_hypercube', label: '拉丁超立方', description: '空间填充采样' }
    },

    /**
     * 响应分析结果
     */
    RESPONSE_METRICS: ['d50', 'solidContent', 'supersaturation', 'growthRate'],

    /**
     * 生成实验设计矩阵
     * @param {Object} config - 配置参数
     * @returns {Object} 设计矩阵和分析结果
     */
    generateDesign(config) {
        const {
            method = 'central_composite',
            factors,
            numSamples = 20,
            levels = 2,
            centerPoints = 3
        } = config;

        let design;

        switch (method) {
            case 'full_factorial':
                design = this._fullFactorial(factors, levels);
                break;
            case 'fractional':
                design = this._fractionalFactorial(factors, levels);
                break;
            case 'central_composite':
                design = this._centralComposite(factors, centerPoints);
                break;
            case 'box_behnken':
                design = this._boxBehnken(factors, centerPoints);
                break;
            case 'latin_hypercube':
                design = this._latinHypercube(factors, numSamples);
                break;
            default:
                design = this._centralComposite(factors, centerPoints);
        }

        return {
            method,
            factors,
            runs: design.runs,
            numRuns: design.runs.length,
            factorInfo: design.factorInfo
        };
    },

    /**
     * 执行所有实验并获取响应
     */
    executeExperiments(design, moduleType) {
        const results = design.runs.map((run, index) => {
            const response = this._runExperiment(run, moduleType);
            return {
                runId: index + 1,
                factors: { ...run },
                response
            };
        });

        return {
            ...design,
            experiments: results,
            analysis: this._analyzeResults(results, design.factors)
        };
    },

    /**
     * 全因子设计
     */
    _fullFactorial(factors, levels = 2) {
        const factorInfo = factors.map(f => ({
            ...f,
            levels: this._generateLevels(f.min, f.max, levels)
        }));

        let runs = [{}];

        for (const factor of factorInfo) {
            const newRuns = [];
            for (const run of runs) {
                for (const level of factor.levels) {
                    newRuns.push({ ...run, [factor.key]: level });
                }
            }
            runs = newRuns;
        }

        return { runs, factorInfo };
    },

    /**
     * 部分因子设计 (2^(k-p))
     */
    _fractionalFactorial(factors, levels = 2) {
        const k = factors.length;
        const p = Math.max(0, k - 4);
        const fraction = Math.pow(2, -p);

        const full = this._fullFactorial(factors, levels);
        const numRuns = Math.ceil(full.runs.length * fraction);

        return {
            runs: full.runs.slice(0, numRuns),
            factorInfo: full.factorInfo
        };
    },

    /**
     * 中心复合设计 (CCD)
     */
    _centralComposite(factors, centerPoints = 3) {
        const k = factors.length;
        const alpha = Math.pow(Math.pow(2, k), 0.25);
        const runs = [];

        const factorInfo = factors.map(f => ({
            ...f,
            center: (f.min + f.max) / 2,
            range: (f.max - f.min) / 2
        }));

        for (let i = 0; i < Math.pow(2, k); i++) {
            const run = {};
            for (let j = 0; j < k; j++) {
                const coded = ((i >> j) & 1) ? 1 : -1;
                const f = factorInfo[j];
                run[f.key] = f.center + coded * f.range / alpha;
            }
            runs.push(run);
        }

        for (let j = 0; j < k; j++) {
            const f = factorInfo[j];
            const runAxialPlus = {};
            const runAxialMinus = {};
            for (let m = 0; m < k; m++) {
                const fm = factorInfo[m];
                if (m === j) {
                    runAxialPlus[fm.key] = fm.center + alpha * fm.range;
                    runAxialMinus[fm.key] = fm.center - alpha * fm.range;
                } else {
                    runAxialPlus[fm.key] = fm.center;
                    runAxialMinus[fm.key] = fm.center;
                }
            }
            runs.push(runAxialPlus, runAxialMinus);
        }

        for (let i = 0; i < centerPoints; i++) {
            const run = {};
            for (const f of factorInfo) {
                run[f.key] = f.center;
            }
            runs.push(run);
        }

        return { runs, factorInfo };
    },

    /**
     * Box-Behnken 设计
     */
    _boxBehnken(factors, centerPoints = 3) {
        const k = factors.length;
        const runs = [];

        const factorInfo = factors.map(f => ({
            ...f,
            center: (f.min + f.max) / 2,
            range: (f.max - f.min) / 2
        }));

        for (let i = 0; i < k; i++) {
            for (let j = i + 1; j < k; j++) {
                for (const ci of [-1, 1]) {
                    for (const cj of [-1, 1]) {
                        const run = {};
                        for (let m = 0; m < k; m++) {
                            const f = factorInfo[m];
                            if (m === i) {
                                run[f.key] = f.center + ci * f.range;
                            } else if (m === j) {
                                run[f.key] = f.center + cj * f.range;
                            } else {
                                run[f.key] = f.center;
                            }
                        }
                        runs.push(run);
                    }
                }
            }
        }

        for (let i = 0; i < centerPoints; i++) {
            const run = {};
            for (const f of factorInfo) {
                run[f.key] = f.center;
            }
            runs.push(run);
        }

        return { runs, factorInfo };
    },

    /**
     * 拉丁超立方采样
     */
    _latinHypercube(factors, numSamples) {
        const k = factors.length;
        const runs = [];

        const factorInfo = factors.map(f => ({ ...f }));

        for (let i = 0; i < numSamples; i++) {
            const run = {};
            for (const f of factorInfo) {
                const interval = (f.max - f.min) / numSamples;
                const lower = f.min + i * interval;
                run[f.key] = lower + Math.random() * interval;
            }
            runs.push(run);
        }

        for (let j = 0; j < k; j++) {
            for (let i = runs.length - 1; i > 0; i--) {
                const randIdx = Math.floor(Math.random() * (i + 1));
                const fKey = factors[j].key;
                [runs[i][fKey], runs[randIdx][fKey]] = [runs[randIdx][fKey], runs[i][fKey]];
            }
        }

        return { runs, factorInfo };
    },

    /**
     * 生成水平值
     */
    _generateLevels(min, max, numLevels) {
        const levels = [];
        for (let i = 0; i < numLevels; i++) {
            levels.push(min + (max - min) * i / (numLevels - 1));
        }
        return levels;
    },

    /**
     * 运行单个实验
     */
    _runExperiment(factors, moduleType) {
        let result;
        if (moduleType === 'kettle') {
            result = ReactionKettle.simulate(factors);
            return {
                d50: result.d50[result.d50.length - 1] || 0,
                solidContent: result.solidContent[result.solidContent.length - 1] || 0,
                supersaturation: Math.max(...result.supersaturation),
                avgGrowthRate: result.d50[result.d50.length - 1] / (factors.totalTime * 3600)
            };
        } else {
            const pipeParams = {
                pipeSegments: [{ length: factors.pipeLength || 50, diameter: factors.pipeDiameter || 20 }],
                baseParams: {
                    initFlow: factors.initFlow,
                    initConc: factors.initConc,
                    initNH3: factors.initNH3,
                    initPH: factors.initPH,
                    initTemp: factors.initTemp
                },
                feeds: []
            };
            result = PipeReactor.simulate(pipeParams);
            return {
                d50: result.D50[result.D50.length - 1] || 0,
                solidContent: (result.S[result.S.length - 1] || 1) * 10,
                supersaturation: Math.max(...result.S),
                avgGrowthRate: result.G.reduce((a, b) => a + b, 0) / result.G.length
            };
        }
    },

    /**
     * 分析实验结果
     */
    _analyzeResults(experiments, factors) {
        const responses = ['d50', 'solidContent', 'supersaturation', 'avgGrowthRate'];
        const analysis = {};

        for (const resp of responses) {
            const values = experiments.map(e => e.response[resp]);
            analysis[resp] = {
                min: Math.min(...values),
                max: Math.max(...values),
                mean: values.reduce((a, b) => a + b, 0) / values.length,
                std: this._stdDev(values),
                range: Math.max(...values) - Math.min(...values)
            };
        }

        analysis.effects = this._calculateMainEffects(experiments, factors, responses);

        return analysis;
    },

    /**
     * 计算主效应
     */
    _calculateMainEffects(experiments, factors, responses) {
        const effects = {};

        for (const factor of factors) {
            effects[factor.key] = {};

            const sorted = [...experiments].sort((a, b) => a.factors[factor.key] - b.factors[factor.key]);
            const midPoint = Math.floor(sorted.length / 2);

            const lowGroup = sorted.slice(0, midPoint);
            const highGroup = sorted.slice(midPoint);

            for (const resp of responses) {
                const lowMean = lowGroup.reduce((a, e) => a + e.response[resp], 0) / lowGroup.length;
                const highMean = highGroup.reduce((a, e) => a + e.response[resp], 0) / highGroup.length;
                effects[factor.key][resp] = highMean - lowMean;
            }
        }

        return effects;
    },

    /**
     * 计算标准差
     */
    _stdDev(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    },

    /**
     * 预测响应值 (基于线性模型)
     */
    predictResponse(factorValues, experiments, targetResponse) {
        const factors = Object.keys(factorValues);

        let sumWeights = 0;
        let weightedSum = 0;

        for (const exp of experiments) {
            let distance = 0;
            for (const f of factors) {
                const fMin = Math.min(...experiments.map(e => e.factors[f]));
                const fMax = Math.max(...experiments.map(e => e.factors[f]));
                const range = fMax - fMin || 1;
                distance += Math.pow((factorValues[f] - exp.factors[f]) / range, 2);
            }
            const weight = 1 / (distance + 1e-10);
            sumWeights += weight;
            weightedSum += weight * exp.response[targetResponse];
        }

        return weightedSum / sumWeights;
    }
};

window.DOE = DOE;
