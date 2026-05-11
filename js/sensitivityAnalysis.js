/**
 * sensitivityAnalysis.js
 * 灵敏度分析模块 - 计算各参数对D50、固含率影响权重
 */

const SensitivityAnalysis = {
    defaultParams: {
        saltConc: { min: 1.0, max: 3.0, default: 2.0, label: '金属盐浓度' },
        nh3Conc: { min: 0.2, max: 1.0, default: 0.5, label: '氨水浓度' },
        naohConc: { min: 2.0, max: 6.0, default: 4.0, label: '碱液浓度' },
        feedRate: { min: 5, max: 20, default: 10, label: '进料速度' },
        phCurve: { min: 10.0, max: 12.0, default: 11.0, label: 'pH值' },
        tempCurve: { min: 40, max: 70, default: 55, label: '温度' },
        stirSpeed: { min: 300, max: 900, default: 600, label: '搅拌转速' },
        totalTime: { min: 4, max: 20, default: 10, label: '反应时间' }
    },

    analyze(baseParams, options = {}) {
        const {
            paramRange = 0.1,
            numSteps = 5,
            targetOutputs = ['d50', 'solidContent']
        } = options;

        const results = {
            parameters: {},
            rankings: {}
        };

        for (const paramName in this.defaultParams) {
            const paramInfo = this.defaultParams[paramName];
            const baseValue = baseParams[paramName] !== undefined ? baseParams[paramName] : paramInfo.default;
            
            const paramResults = this.analyzeParameter(
                paramName, 
                baseValue, 
                baseParams, 
                paramRange, 
                numSteps,
                targetOutputs
            );
            
            results.parameters[paramName] = paramResults;
        }

        results.rankings = this.calculateRankings(results.parameters, targetOutputs);

        return results;
    },

    analyzeParameter(paramName, baseValue, baseParams, paramRange, numSteps, targetOutputs) {
        const paramResults = {
            label: this.defaultParams[paramName]?.label || paramName,
            baseValue: baseValue,
            values: [],
            outputs: {}
        };

        targetOutputs.forEach(output => {
            paramResults.outputs[output] = [];
        });

        const minVal = baseValue * (1 - paramRange);
        const maxVal = baseValue * (1 + paramRange);
        const step = (maxVal - minVal) / (numSteps - 1);

        for (let i = 0; i < numSteps; i++) {
            const value = minVal + step * i;
            paramResults.values.push(value);

            const testParams = { ...baseParams, [paramName]: value };
            const simulationResult = ReactionKettle.simulate(testParams);
            
            const finalIndex = simulationResult.d50.length - 1;
            
            targetOutputs.forEach(output => {
                paramResults.outputs[output].push(simulationResult[output][finalIndex]);
            });
        }

        paramResults.sensitivity = this.calculateSensitivity(
            paramResults.values,
            paramResults.outputs,
            baseValue,
            targetOutputs
        );

        return paramResults;
    },

    calculateSensitivity(values, outputs, baseValue, targetOutputs) {
        const sensitivity = {};
        
        targetOutputs.forEach(output => {
            const outputData = outputs[output];
            const baseOutputIndex = Math.floor(values.length / 2);
            const baseOutput = outputData[baseOutputIndex];

            let totalChange = 0;
            let totalValueChange = 0;

            for (let i = 0; i < values.length; i++) {
                if (i === baseOutputIndex) continue;
                const valueRatio = Math.abs((values[i] - baseValue) / baseValue);
                const outputRatio = Math.abs((outputData[i] - baseOutput) / baseOutput);
                if (valueRatio > 0) {
                    totalChange += outputRatio / valueRatio;
                    totalValueChange += 1;
                }
            }

            sensitivity[output] = totalValueChange > 0 ? totalChange / totalValueChange : 0;
        });

        return sensitivity;
    },

    calculateRankings(parameters, targetOutputs) {
        const rankings = {};
        
        targetOutputs.forEach(output => {
            const ranking = [];
            for (const paramName in parameters) {
                ranking.push({
                    param: paramName,
                    label: parameters[paramName].label,
                    weight: parameters[paramName].sensitivity[output]
                });
            }
            ranking.sort((a, b) => b.weight - a.weight);
            rankings[output] = ranking;
        });

        rankings.combined = this.calculateCombinedRanking(rankings, targetOutputs);

        return rankings;
    },

    calculateCombinedRanking(rankings, targetOutputs) {
        const combined = {};
        
        targetOutputs.forEach(output => {
            rankings[output].forEach((item, index) => {
                if (!combined[item.param]) {
                    combined[item.param] = { param: item.param, label: item.label, totalWeight: 0 };
                }
                combined[item.param].totalWeight += item.weight;
            });
        });

        const result = Object.values(combined);
        result.sort((a, b) => b.totalWeight - a.totalWeight);
        
        return result.map(item => ({
            ...item,
            avgWeight: item.totalWeight / targetOutputs.length
        }));
    },

    generateReport(results) {
        const report = {
            title: '灵敏度分析报告',
            timestamp: new Date().toISOString(),
            summary: [],
            details: []
        };

        for (const paramName in results.parameters) {
            const param = results.parameters[paramName];
            const detail = {
                parameter: paramName,
                label: param.label,
                baseValue: param.baseValue,
                sensitivities: {}
            };

            for (const output in param.sensitivity) {
                detail.sensitivities[output] = param.sensitivity[output].toFixed(4);
            }

            report.details.push(detail);
        }

        report.summary.push({
            target: 'D50灵敏度排名',
            rankings: results.rankings.d50.map(r => `${r.label}: ${r.weight.toFixed(4)}`)
        });

        report.summary.push({
            target: '固含率灵敏度排名',
            rankings: results.rankings.solidContent.map(r => `${r.label}: ${r.weight.toFixed(4)}`)
        });

        report.summary.push({
            target: '综合灵敏度排名',
            rankings: results.rankings.combined.map(r => `${r.label}: ${r.avgWeight.toFixed(4)}`)
        });

        return report;
    }
};

window.SensitivityAnalysis = SensitivityAnalysis;
