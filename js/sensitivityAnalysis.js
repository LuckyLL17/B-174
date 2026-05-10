/**
 * sensitivityAnalysis.js
 * 灵敏度分析核心模块
 * 计算各工艺参数对输出指标(D50、固含率)的影响权重
 */

const SensitivityAnalysis = {
    /**
     * 定义反应釜模块的参数配置
     */
    KETTLE_PARAMS: [
        { key: 'saltConc', label: '金属盐浓度', unit: 'mol/L', min: 1.0, max: 3.0, default: 2.0 },
        { key: 'nh3Conc', label: '氨水浓度', unit: 'mol/L', min: 0.2, max: 1.0, default: 0.5 },
        { key: 'naohConc', label: '碱液浓度', unit: 'mol/L', min: 2.0, max: 6.0, default: 4.0 },
        { key: 'feedRate', label: '进料速度', unit: 'L/h', min: 5, max: 20, default: 10 },
        { key: 'stirSpeed', label: '搅拌转速', unit: 'rpm', min: 300, max: 900, default: 600 },
        { key: 'totalTime', label: '反应时间', unit: 'h', min: 4, max: 20, default: 10 },
        { key: 'phCurve', label: 'pH值', unit: '', min: 10.0, max: 12.0, default: 11.0 },
        { key: 'tempCurve', label: '温度', unit: '°C', min: 45, max: 70, default: 55 }
    ],

    /**
     * 定义管道模块的参数配置
     */
    PIPE_PARAMS: [
        { key: 'initFlow', label: '初始流量', unit: 'L/h', min: 100, max: 500, default: 200 },
        { key: 'initConc', label: '初始金属浓度', unit: 'mol/L', min: 1.0, max: 3.0, default: 2.0 },
        { key: 'initNH3', label: '初始氨水浓度', unit: 'mol/L', min: 0.3, max: 1.0, default: 0.5 },
        { key: 'initPH', label: '初始pH', unit: '', min: 10.5, max: 12.0, default: 11.2 },
        { key: 'initTemp', label: '温度', unit: '°C', min: 50, max: 80, default: 60 },
        { key: 'pipeLength', label: '管道长度', unit: 'm', min: 20, max: 100, default: 50 },
        { key: 'pipeDiameter', label: '管道直径', unit: 'mm', min: 10, max: 50, default: 20 }
    ],

    /**
     * 执行灵敏度分析
     * @param {string} moduleType - 模块类型 'kettle' 或 'pipe'
     * @param {Object} baseParams - 基准参数
     * @param {number} perturbation - 扰动比例 (默认 ±10%)
     * @returns {Object} 灵敏度分析结果
     */
    analyze(moduleType, baseParams, perturbation = 0.1) {
        const params = moduleType === 'kettle' ? this.KETTLE_PARAMS : this.PIPE_PARAMS;
        const baselineResult = this._runSimulation(moduleType, baseParams);
        const baselineD50 = this._getFinalD50(baselineResult, moduleType);
        const baselineSolid = this._getFinalSolid(baselineResult, moduleType);

        const results = {
            baseline: { d50: baselineD50, solidContent: baselineSolid },
            parameters: []
        };

        for (const param of params) {
            const paramResults = this._analyzeSingleParam(
                moduleType,
                baseParams,
                param,
                perturbation,
                baselineD50,
                baselineSolid
            );
            results.parameters.push(paramResults);
        }

        results.ranking = this._calculateRanking(results.parameters);

        return results;
    },

    /**
     * 分析单个参数的影响
     */
    _analyzeSingleParam(moduleType, baseParams, param, perturbation, baselineD50, baselineSolid) {
        const originalValue = baseParams[param.key] !== undefined ? baseParams[param.key] : param.default;
        const delta = originalValue * perturbation;

        const lowValue = Math.max(param.min, originalValue - delta);
        const highValue = Math.min(param.max, originalValue + delta);

        const lowParams = { ...baseParams, [param.key]: lowValue };
        const highParams = { ...baseParams, [param.key]: highValue };

        const lowResult = this._runSimulation(moduleType, lowParams);
        const highResult = this._runSimulation(moduleType, highParams);

        const lowD50 = this._getFinalD50(lowResult, moduleType);
        const highD50 = this._getFinalD50(highResult, moduleType);
        const lowSolid = this._getFinalSolid(lowResult, moduleType);
        const highSolid = this._getFinalSolid(highResult, moduleType);

        const d50Sensitivity = this._calculateSensitivity(
            baselineD50, lowD50, highD50,
            originalValue, lowValue, highValue
        );

        const solidSensitivity = this._calculateSensitivity(
            baselineSolid, lowSolid, highSolid,
            originalValue, lowValue, highValue
        );

        return {
            key: param.key,
            label: param.label,
            unit: param.unit,
            baselineValue: originalValue,
            lowValue,
            highValue,
            d50: {
                baseline: baselineD50,
                low: lowD50,
                high: highD50,
                changeLow: lowD50 - baselineD50,
                changeHigh: highD50 - baselineD50,
                changePercentLow: ((lowD50 - baselineD50) / baselineD50 * 100),
                changePercentHigh: ((highD50 - baselineD50) / baselineD50 * 100),
                sensitivity: d50Sensitivity
            },
            solidContent: {
                baseline: baselineSolid,
                low: lowSolid,
                high: highSolid,
                changeLow: lowSolid - baselineSolid,
                changeHigh: highSolid - baselineSolid,
                changePercentLow: ((lowSolid - baselineSolid) / baselineSolid * 100),
                changePercentHigh: ((highSolid - baselineSolid) / baselineSolid * 100),
                sensitivity: solidSensitivity
            },
            combinedWeight: Math.abs(d50Sensitivity) + Math.abs(solidSensitivity)
        };
    },

    /**
     * 计算灵敏度指数
     * 使用归一化的斜率 |ΔY/Y| / |ΔX/X|
     */
    _calculateSensitivity(baselineY, lowY, highY, baselineX, lowX, highX) {
        if (baselineY === 0 || baselineX === 0) return 0;

        const changeY = highY - lowY;
        const changeX = highX - lowX;

        if (changeX === 0) return 0;

        const normalizedY = changeY / baselineY;
        const normalizedX = changeX / baselineX;

        return normalizedY / normalizedX;
    },

    /**
     * 计算参数权重排名
     */
    _calculateRanking(parameters) {
        const sorted = [...parameters].sort((a, b) => b.combinedWeight - a.combinedWeight);
        return sorted.map((p, idx) => ({
            rank: idx + 1,
            key: p.key,
            label: p.label,
            weight: p.combinedWeight,
            d50Sensitivity: p.d50.sensitivity,
            solidSensitivity: p.solidContent.sensitivity
        }));
    },

    /**
     * 运行仿真获取结果
     */
    _runSimulation(moduleType, params) {
        if (moduleType === 'kettle') {
            return ReactionKettle.simulate(params);
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
            return PipeReactor.simulate(pipeParams);
        }
    },

    /**
     * 获取最终D50值
     */
    _getFinalD50(result, moduleType) {
        if (moduleType === 'kettle') {
            return result.d50[result.d50.length - 1] || 0;
        } else {
            return result.D50[result.D50.length - 1] || 0;
        }
    },

    /**
     * 获取最终固含率
     */
    _getFinalSolid(result, moduleType) {
        if (moduleType === 'kettle') {
            return result.solidContent[result.solidContent.length - 1] || 0;
        } else {
            return (result.S[result.S.length - 1] || 1) * 10;
        }
    }
};

window.SensitivityAnalysis = SensitivityAnalysis;
