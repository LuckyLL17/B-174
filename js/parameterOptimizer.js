/**
 * parameterOptimizer.js
 * 参数优化器模块 - 目标粒径反推最优工艺参数
 */

const ParameterOptimizer = {
    paramRanges: {
        saltConc: { min: 1.0, max: 3.0, default: 2.0, label: '金属盐浓度' },
        nh3Conc: { min: 0.2, max: 1.0, default: 0.5, label: '氨水浓度' },
        naohConc: { min: 2.0, max: 6.0, default: 4.0, label: '碱液浓度' },
        feedRate: { min: 5, max: 20, default: 10, label: '进料速度' },
        phCurve: { min: 10.0, max: 12.0, default: 11.0, label: 'pH值' },
        tempCurve: { min: 40, max: 70, default: 55, label: '温度' },
        stirSpeed: { min: 300, max: 900, default: 600, label: '搅拌转速' },
        totalTime: { min: 4, max: 20, default: 10, label: '反应时间' }
    },

    optimize(targets, constraints = {}, options = {}) {
        const {
            method = 'gradient',
            maxIterations = 50,
            tolerance = 1e-4,
            initialParams = null
        } = options;

        let result;

        switch (method) {
            case 'grid':
                result = this.gridSearch(targets, constraints, options);
                break;
            case 'random':
                result = this.randomSearch(targets, constraints, options);
                break;
            case 'gradient':
            default:
                result = this.gradientDescent(targets, constraints, {
                    maxIterations,
                    tolerance,
                    initialParams
                });
                break;
        }

        return this.formatResult(result, targets);
    },

    gradientDescent(targets, constraints, options) {
        const {
            maxIterations = 50,
            tolerance = 1e-4,
            initialParams = null,
            learningRate = 0.1
        } = options;

        let params = initialParams ? { ...initialParams } : this.getDefaultParams();
        let bestParams = { ...params };
        let bestError = Infinity;
        const history = [];

        for (let iter = 0; iter < maxIterations; iter++) {
            const currentResult = this.evaluateParams(params);
            const error = this.calculateError(currentResult, targets, constraints);

            history.push({ iteration: iter, params: { ...params }, error, result: currentResult });

            if (error < bestError) {
                bestError = error;
                bestParams = { ...params };
            }

            if (error < tolerance) {
                break;
            }

            const gradients = this.calculateGradients(params, targets, constraints);

            for (const paramName in gradients) {
                const range = this.paramRanges[paramName];
                const paramRange = range.max - range.min;
                params[paramName] -= learningRate * gradients[paramName] * paramRange;
                params[paramName] = Math.max(range.min, Math.min(range.max, params[paramName]));
            }
        }

        const finalResult = this.evaluateParams(bestParams);

        return {
            optimalParams: bestParams,
            optimalResult: finalResult,
            finalError: bestError,
            history,
            converged: bestError < tolerance
        };
    },

    gridSearch(targets, constraints, options) {
        const { gridSize = 3 } = options;

        const paramNames = Object.keys(this.paramRanges);
        const gridPoints = {};

        paramNames.forEach(paramName => {
            const range = this.paramRanges[paramName];
            const step = (range.max - range.min) / (gridSize - 1);
            gridPoints[paramName] = [];
            for (let i = 0; i < gridSize; i++) {
                gridPoints[paramName].push(range.min + step * i);
            }
        });

        const results = [];
        const combinations = this.generateCombinations(gridPoints);

        combinations.forEach(params => {
            const result = this.evaluateParams(params);
            const error = this.calculateError(result, targets, constraints);
            results.push({ params, result, error });
        });

        results.sort((a, b) => a.error - b.error);

        return {
            optimalParams: results[0].params,
            optimalResult: results[0].result,
            finalError: results[0].error,
            allResults: results.slice(0, 10),
            converged: results[0].error < 1e-4
        };
    },

    randomSearch(targets, constraints, options) {
        const { numSamples = 100 } = options;

        const results = [];

        for (let i = 0; i < numSamples; i++) {
            const params = this.generateRandomParams();
            const result = this.evaluateParams(params);
            const error = this.calculateError(result, targets, constraints);
            results.push({ params, result, error });
        }

        results.sort((a, b) => a.error - b.error);

        return {
            optimalParams: results[0].params,
            optimalResult: results[0].result,
            finalError: results[0].error,
            allResults: results.slice(0, 10),
            converged: results[0].error < 1e-4
        };
    },

    generateRandomParams() {
        const params = {};
        for (const paramName in this.paramRanges) {
            const range = this.paramRanges[paramName];
            params[paramName] = range.min + Math.random() * (range.max - range.min);
        }
        return params;
    },

    generateCombinations(gridPoints) {
        const paramNames = Object.keys(gridPoints);
        const combinations = [{}];

        paramNames.forEach(paramName => {
            const newCombinations = [];
            combinations.forEach(combo => {
                gridPoints[paramName].forEach(value => {
                    newCombinations.push({ ...combo, [paramName]: value });
                });
            });
            combinations.length = 0;
            combinations.push(...newCombinations);
        });

        return combinations;
    },

    calculateGradients(params, targets, constraints) {
        const gradients = {};
        const epsilon = 0.01;

        for (const paramName in this.paramRanges) {
            const range = this.paramRanges[paramName];
            const delta = (range.max - range.min) * epsilon;

            const paramsPlus = { ...params, [paramName]: params[paramName] + delta };
            const paramsMinus = { ...params, [paramName]: params[paramName] - delta };

            const resultPlus = this.evaluateParams(paramsPlus);
            const resultMinus = this.evaluateParams(paramsMinus);

            const errorPlus = this.calculateError(resultPlus, targets, constraints);
            const errorMinus = this.calculateError(resultMinus, targets, constraints);

            gradients[paramName] = (errorPlus - errorMinus) / (2 * delta);
        }

        return gradients;
    },

    evaluateParams(params) {
        const result = ReactionKettle.simulate(params);
        const finalIndex = result.d50.length - 1;

        return {
            d50: result.d50[finalIndex],
            solidContent: result.solidContent[finalIndex],
            supersaturation: result.supersaturation[finalIndex],
            fullResult: result
        };
    },

    calculateError(result, targets, constraints) {
        let totalError = 0;
        let weightSum = 0;

        if (targets.d50 !== undefined) {
            const weight = targets.d50Weight || 1;
            const normalizedError = Math.abs(result.d50 - targets.d50) / targets.d50;
            totalError += weight * normalizedError;
            weightSum += weight;
        }

        if (targets.solidContent !== undefined) {
            const weight = targets.solidContentWeight || 0.5;
            const normalizedError = Math.abs(result.solidContent - targets.solidContent) / targets.solidContent;
            totalError += weight * normalizedError;
            weightSum += weight;
        }

        if (constraints.minD50 !== undefined && result.d50 < constraints.minD50) {
            totalError += 10 * (constraints.minD50 - result.d50) / constraints.minD50;
        }

        if (constraints.maxD50 !== undefined && result.d50 > constraints.maxD50) {
            totalError += 10 * (result.d50 - constraints.maxD50) / constraints.maxD50;
        }

        if (constraints.minSolidContent !== undefined && result.solidContent < constraints.minSolidContent) {
            totalError += 10 * (constraints.minSolidContent - result.solidContent) / constraints.minSolidContent;
        }

        if (constraints.maxSolidContent !== undefined && result.solidContent > constraints.maxSolidContent) {
            totalError += 10 * (result.solidContent - constraints.maxSolidContent) / constraints.maxSolidContent;
        }

        return weightSum > 0 ? totalError / weightSum : totalError;
    },

    getDefaultParams() {
        const params = {};
        for (const paramName in this.paramRanges) {
            params[paramName] = this.paramRanges[paramName].default;
        }
        return params;
    },

    formatResult(result, targets) {
        const formatted = {
            success: result.converged,
            optimalParameters: {},
            predictedOutputs: {
                d50: result.optimalResult.d50,
                solidContent: result.optimalResult.solidContent
            },
            targetOutputs: {
                d50: targets.d50,
                solidContent: targets.solidContent
            },
            deviation: {
                d50: targets.d50 ? Math.abs(result.optimalResult.d50 - targets.d50) / targets.d50 * 100 : null,
                solidContent: targets.solidContent ? Math.abs(result.optimalResult.solidContent - targets.solidContent) / targets.solidContent * 100 : null
            },
            fullResult: result.optimalResult.fullResult
        };

        for (const paramName in result.optimalParams) {
            formatted.optimalParameters[paramName] = {
                value: result.optimalParams[paramName],
                label: this.paramRanges[paramName]?.label || paramName
            };
        }

        return formatted;
    },

    generateOptimizationReport(result) {
        return {
            title: '参数优化报告',
            timestamp: new Date().toISOString(),
            status: result.success ? '优化成功' : '未完全收敛',
            targets: result.targetOutputs,
            predicted: result.predictedOutputs,
            deviation: result.deviation,
            parameters: result.optimalParameters
        };
    }
};

window.ParameterOptimizer = ParameterOptimizer;
