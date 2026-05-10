/**
 * optimizer.js
 * 工艺参数优化器核心模块
 * 基于目标粒径反推最优工艺参数
 */

const Optimizer = {
    /**
     * 优化目标配置
     */
    OBJECTIVES: {
        D50: { key: 'd50', label: '目标粒径 D50', unit: 'μm' },
        SOLID_CONTENT: { key: 'solidContent', label: '固含率', unit: '%' },
        BOTH: { key: 'both', label: 'D50 + 固含率', unit: '' }
    },

    /**
     * 优化算法类型
     */
    ALGORITHMS: {
        GRID_SEARCH: { key: 'grid', label: '网格搜索', description: '遍历所有参数组合' },
        RANDOM_SEARCH: { key: 'random', label: '随机搜索', description: '随机采样参数空间' },
        PATTERN_SEARCH: { key: 'pattern', label: '模式搜索', description: '梯度下降式搜索' }
    },

    /**
     * 执行参数优化
     * @param {Object} config - 优化配置
     * @returns {Object} 优化结果
     */
    optimize(config) {
        const {
            moduleType = 'kettle',
            targetD50,
            targetSolid,
            objective = 'd50',
            algorithm = 'pattern',
            constraints = {},
            iterations = 50,
            initialParams = null
        } = config;

        const paramConfig = moduleType === 'kettle' 
            ? SensitivityAnalysis.KETTLE_PARAMS 
            : SensitivityAnalysis.PIPE_PARAMS;

        const bounds = this._extractBounds(paramConfig, constraints);
        const startParams = initialParams || this._getDefaultParams(paramConfig);

        let bestResult;

        switch (algorithm) {
            case 'grid':
                bestResult = this._gridSearch(moduleType, bounds, targetD50, targetSolid, objective, paramConfig);
                break;
            case 'random':
                bestResult = this._randomSearch(moduleType, bounds, targetD50, targetSolid, objective, iterations);
                break;
            case 'pattern':
            default:
                bestResult = this._patternSearch(moduleType, bounds, targetD50, targetSolid, objective, startParams, iterations);
                break;
        }

        return {
            ...bestResult,
            config: { moduleType, targetD50, targetSolid, objective, algorithm, iterations },
            history: bestResult.history || []
        };
    },

    /**
     * 模式搜索优化 (Hooke-Jeeves)
     */
    _patternSearch(moduleType, bounds, targetD50, targetSolid, objective, startParams, iterations) {
        let currentParams = { ...startParams };
        let currentScore = this._evaluate(moduleType, currentParams, targetD50, targetSolid, objective);
        let stepSize = this._calculateInitialStep(bounds);
        const history = [{ params: { ...currentParams }, score: currentScore }];

        for (let iter = 0; iter < iterations; iter++) {
            let improved = false;

            for (const key of Object.keys(bounds)) {
                for (const direction of [-1, 1]) {
                    const testParams = { ...currentParams };
                    testParams[key] = this._clamp(
                        currentParams[key] + direction * stepSize[key],
                        bounds[key].min,
                        bounds[key].max
                    );

                    const testScore = this._evaluate(moduleType, testParams, targetD50, targetSolid, objective);

                    if (testScore < currentScore) {
                        currentParams = testParams;
                        currentScore = testScore;
                        improved = true;
                    }
                }
            }

            if (!improved) {
                for (const key of Object.keys(stepSize)) {
                    stepSize[key] *= 0.5;
                }
            }

            history.push({ params: { ...currentParams }, score: currentScore });

            const totalStep = Object.values(stepSize).reduce((a, b) => a + b, 0);
            if (totalStep < 1e-6) break;
        }

        const finalResult = this._runAndExtract(moduleType, currentParams);

        return {
            bestParams: currentParams,
            bestScore: currentScore,
            achievedD50: finalResult.d50,
            achievedSolid: finalResult.solid,
            convergence: currentScore,
            history
        };
    },

    /**
     * 网格搜索
     */
    _gridSearch(moduleType, bounds, targetD50, targetSolid, objective, paramConfig) {
        const gridPoints = 5;
        const paramKeys = Object.keys(bounds).slice(0, 4);
        const grids = {};

        for (const key of paramKeys) {
            const { min, max } = bounds[key];
            grids[key] = [];
            for (let i = 0; i < gridPoints; i++) {
                grids[key].push(min + (max - min) * i / (gridPoints - 1));
            }
        }

        let bestParams = null;
        let bestScore = Infinity;
        const history = [];

        for (const p1 of grids[paramKeys[0]] || []) {
            for (const p2 of grids[paramKeys[1]] || []) {
                for (const p3 of grids[paramKeys[2]] || []) {
                    for (const p4 of grids[paramKeys[3]] || []) {
                        const params = this._getDefaultParams(paramConfig);
                        if (paramKeys[0]) params[paramKeys[0]] = p1;
                        if (paramKeys[1]) params[paramKeys[1]] = p2;
                        if (paramKeys[2]) params[paramKeys[2]] = p3;
                        if (paramKeys[3]) params[paramKeys[3]] = p4;

                        const score = this._evaluate(moduleType, params, targetD50, targetSolid, objective);
                        history.push({ params: { ...params }, score });

                        if (score < bestScore) {
                            bestScore = score;
                            bestParams = { ...params };
                        }
                    }
                }
            }
        }

        const finalResult = this._runAndExtract(moduleType, bestParams);

        return {
            bestParams,
            bestScore,
            achievedD50: finalResult.d50,
            achievedSolid: finalResult.solid,
            convergence: bestScore,
            history
        };
    },

    /**
     * 随机搜索
     */
    _randomSearch(moduleType, bounds, targetD50, targetSolid, objective, iterations) {
        let bestParams = null;
        let bestScore = Infinity;
        const history = [];

        for (let i = 0; i < iterations; i++) {
            const params = {};
            for (const [key, { min, max }] of Object.entries(bounds)) {
                params[key] = min + Math.random() * (max - min);
            }

            const score = this._evaluate(moduleType, params, targetD50, targetSolid, objective);
            history.push({ params: { ...params }, score });

            if (score < bestScore) {
                bestScore = score;
                bestParams = { ...params };
            }
        }

        const finalResult = this._runAndExtract(moduleType, bestParams);

        return {
            bestParams,
            bestScore,
            achievedD50: finalResult.d50,
            achievedSolid: finalResult.solid,
            convergence: bestScore,
            history
        };
    },

    /**
     * 评估参数组合的得分（目标函数）
     */
    _evaluate(moduleType, params, targetD50, targetSolid, objective) {
        const result = this._runAndExtract(moduleType, params);
        let score = 0;

        if (objective === 'd50' || objective === 'both') {
            const d50Error = Math.abs(result.d50 - targetD50) / targetD50;
            score += d50Error * (objective === 'both' ? 0.5 : 1);
        }

        if (objective === 'solidContent' || objective === 'both') {
            const solidError = Math.abs(result.solid - targetSolid) / targetSolid;
            score += solidError * (objective === 'both' ? 0.5 : 1);
        }

        return score;
    },

    /**
     * 运行仿真并提取关键指标
     */
    _runAndExtract(moduleType, params) {
        let result;
        if (moduleType === 'kettle') {
            result = ReactionKettle.simulate(params);
            return {
                d50: result.d50[result.d50.length - 1] || 0,
                solid: result.solidContent[result.solidContent.length - 1] || 0
            };
        } else {
            const pipeParams = {
                pipeSegments: [{ length: params.pipeLength || 50, diameter: params.pipeDiameter || 20 }],
                baseParams: {
                    initFlow: params.initFlow,
                    initConc: params.initConc,
                    initNH3: params.initNH3,
                    initPH: params.initPH,
                    initTemp: params.initTemp
                },
                feeds: []
            };
            result = PipeReactor.simulate(pipeParams);
            return {
                d50: result.D50[result.D50.length - 1] || 0,
                solid: (result.S[result.S.length - 1] || 1) * 10
            };
        }
    },

    /**
     * 从参数配置提取边界
     */
    _extractBounds(paramConfig, constraints) {
        const bounds = {};
        for (const param of paramConfig) {
            const constraint = constraints[param.key];
            bounds[param.key] = {
                min: constraint?.min ?? param.min,
                max: constraint?.max ?? param.max
            };
        }
        return bounds;
    },

    /**
     * 获取默认参数
     */
    _getDefaultParams(paramConfig) {
        const params = {};
        for (const param of paramConfig) {
            params[param.key] = param.default;
        }
        return params;
    },

    /**
     * 计算初始步长
     */
    _calculateInitialStep(bounds) {
        const step = {};
        for (const [key, { min, max }] of Object.entries(bounds)) {
            step[key] = (max - min) * 0.1;
        }
        return step;
    },

    /**
     * 限制值在范围内
     */
    _clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
};

window.Optimizer = Optimizer;
