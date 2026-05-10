const SensitivityAnalysis = {
    analyze(params, simulateFn, options = {}) {
        const {
            perturbation = 0.05,
            targets = ['d50', 'solidContent'],
            paramDefs = null
        } = options;

        const paramKeys = paramDefs ? Object.keys(paramDefs) : Object.keys(params);
        const baseResult = simulateFn(params);

        const baseValues = {};
        targets.forEach(t => {
            const arr = baseResult[t];
            if (arr && arr.length > 0) {
                baseValues[t] = arr[arr.length - 1];
            } else {
                baseValues[t] = NaN;
            }
        });

        const sensitivities = {};

        paramKeys.forEach(key => {
            const original = params[key];
            if (typeof original !== 'number' || !isFinite(original)) return;

            const step = original * perturbation;
            if (step === 0) return;

            const upperParams = Object.assign({}, params);
            upperParams[key] = original + step;
            const upperResult = simulateFn(upperParams);

            const lowerParams = Object.assign({}, params);
            lowerParams[key] = original - step;
            const lowerResult = simulateFn(lowerParams);

            sensitivities[key] = {
                originalValue: original,
                perturbation: perturbation * 100,
                effects: {}
            };

            targets.forEach(t => {
                const baseVal = baseValues[t];
                const arrUp = upperResult[t];
                const arrLo = lowerResult[t];
                const upVal = (arrUp && arrUp.length > 0) ? arrUp[arrUp.length - 1] : NaN;
                const loVal = (arrLo && arrLo.length > 0) ? arrLo[arrLo.length - 1] : NaN;

                if (!isFinite(baseVal) || !isFinite(upVal) || !isFinite(loVal)) {
                    sensitivities[key].effects[t] = {
                        baseValue: baseVal,
                        upperValue: upVal,
                        lowerValue: loVal,
                        absoluteSensitivity: NaN,
                        normalizedSensitivity: NaN,
                        percentChange: NaN
                    };
                    return;
                }

                const dUp = (upVal - baseVal) / step;
                const dLo = (baseVal - loVal) / step;
                const centralDiffSensitivity = (dUp + dLo) / 2;

                const normalizedSensitivity = baseVal !== 0
                    ? centralDiffSensitivity * (original / baseVal)
                    : centralDiffSensitivity;

                sensitivities[key].effects[t] = {
                    baseValue: baseVal,
                    upperValue: upVal,
                    lowerValue: loVal,
                    absoluteSensitivity: centralDiffSensitivity,
                    normalizedSensitivity: normalizedSensitivity,
                    percentChange: baseVal !== 0
                        ? ((upVal - baseVal) / baseVal) * 100
                        : 0
                };
            });
        });

        const weights = {};
        targets.forEach(t => {
            weights[t] = {};
            let totalAbsSens = 0;
            paramKeys.forEach(key => {
                if (sensitivities[key] && isFinite(sensitivities[key].effects[t].normalizedSensitivity)) {
                    totalAbsSens += Math.abs(sensitivities[key].effects[t].normalizedSensitivity);
                }
            });
            paramKeys.forEach(key => {
                if (sensitivities[key] && isFinite(sensitivities[key].effects[t].normalizedSensitivity)) {
                    const absSens = Math.abs(sensitivities[key].effects[t].normalizedSensitivity);
                    weights[t][key] = totalAbsSens > 0
                        ? (absSens / totalAbsSens) * 100
                        : 0;
                } else {
                    weights[t][key] = 0;
                }
            });
        });

        return {
            baseResult,
            sensitivities,
            weights,
            targets,
            paramKeys,
            perturbation
        };
    },

    generateReport(result) {
        const lines = [];
        lines.push('=== 灵敏度分析报告 ===');
        lines.push(`扰动比例: ${result.perturbation * 100}%`);
        lines.push('');

        result.targets.forEach(t => {
            lines.push(`--- 目标指标: ${t} ---`);
            const sorted = result.paramKeys
                .filter(k => result.sensitivities[k])
                .sort((a, b) => {
                    return Math.abs(result.sensitivities[b].effects[t].normalizedSensitivity) -
                           Math.abs(result.sensitivities[a].effects[t].normalizedSensitivity);
                });

            sorted.forEach(key => {
                const s = result.sensitivities[key];
                const e = s.effects[t];
                lines.push(`  ${key}: 原始值=${s.originalValue.toFixed(4)}, 归一化灵敏度=${e.normalizedSensitivity.toFixed(4)}, 权重=${result.weights[t][key].toFixed(2)}%, 变化率=${e.percentChange.toFixed(4)}%`);
            });
            lines.push('');
        });

        return lines.join('\n');
    }
};

window.SensitivityAnalysis = SensitivityAnalysis;
