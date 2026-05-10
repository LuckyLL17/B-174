const DOEDesign = {
    fullFactorial(paramDefs, levels = 2) {
        const paramKeys = Object.keys(paramDefs);
        if (paramKeys.length === 0) return [];

        const levelValues = {};
        paramKeys.forEach(k => {
            const def = paramDefs[k];
            levelValues[k] = [];
            if (levels === 2) {
                levelValues[k].push(def.min, def.max);
            } else {
                for (let i = 0; i < levels; i++) {
                    levelValues[k].push(def.min + (def.max - def.min) * i / (levels - 1));
                }
            }
        });

        const experiments = [];

        const iterate = (idx, current) => {
            if (idx === paramKeys.length) {
                experiments.push(Object.assign({}, current));
                return;
            }
            const key = paramKeys[idx];
            levelValues[key].forEach(val => {
                current[key] = val;
                iterate(idx + 1, current);
            });
            delete current[key];
        };

        iterate(0, {});
        return this._addMetadata(experiments, 'full_factorial', paramKeys);
    },

    fractionalFactorial(paramDefs, resolution = 'IV') {
        const paramKeys = Object.keys(paramDefs);
        const n = paramKeys.length;

        const baseExperiments = this.fullFactorial(
            this._subsetDefs(paramDefs, paramKeys.slice(0, Math.ceil(n / 2))),
            2
        );

        const experiments = baseExperiments.map(exp => {
            const fullExp = Object.assign({}, exp);
            const generatorKeys = paramKeys.slice(Math.ceil(n / 2));
            generatorKeys.forEach((key, idx) => {
                const baseKey1 = paramKeys[idx * 2 % Math.ceil(n / 2)];
                const baseKey2 = paramKeys[(idx * 2 + 1) % Math.ceil(n / 2)];
                const mid = (paramDefs[key].min + paramDefs[key].max) / 2;
                const halfRange = (paramDefs[key].max - paramDefs[key].min) / 2;
                const sign = (exp[baseKey1] > mid ? 1 : -1) * (exp[baseKey2] > mid ? 1 : -1);
                fullExp[key] = mid + sign * halfRange;
            });
            return fullExp;
        });

        return this._addMetadata(experiments, 'fractional_factorial', paramKeys);
    },

    latinHypercube(paramDefs, numSamples = 20) {
        const paramKeys = Object.keys(paramDefs);
        const n = paramKeys.length;
        const experiments = [];

        const permutations = [];
        paramKeys.forEach(() => {
            const perm = Array.from({ length: numSamples }, (_, i) => i);
            for (let i = perm.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [perm[i], perm[j]] = [perm[j], perm[i]];
            }
            permutations.push(perm);
        });

        for (let s = 0; s < numSamples; s++) {
            const exp = {};
            paramKeys.forEach((key, dim) => {
                const def = paramDefs[key];
                const bin = permutations[dim][s];
                const binWidth = (def.max - def.min) / numSamples;
                const low = def.min + bin * binWidth;
                const high = low + binWidth;
                exp[key] = low + Math.random() * (high - low);
            });
            experiments.push(exp);
        }

        return this._addMetadata(experiments, 'latin_hypercube', paramKeys);
    },

    centralComposite(paramDefs, alpha = 'rotatable', starPoints = 'face') {
        const paramKeys = Object.keys(paramDefs);
        const n = paramKeys.length;

        let alphaVal;
        if (alpha === 'rotatable') {
            alphaVal = Math.pow(Math.pow(2, n), 0.25);
        } else if (alpha === 'orthogonal') {
            alphaVal = Math.sqrt(n);
        } else {
            alphaVal = typeof alpha === 'number' ? alpha : Math.pow(2, n * 0.25);
        }

        if (starPoints === 'face') {
            alphaVal = 1.0;
        }

        const factorialExps = this.fullFactorial(paramDefs, 2);
        const codedToNatural = (codedVec) => {
            const exp = {};
            paramKeys.forEach((key, i) => {
                const def = paramDefs[key];
                const center = (def.max + def.min) / 2;
                const halfRange = (def.max - def.min) / 2;
                exp[key] = center + codedVec[i] * halfRange * (codedVec[i] > 1 || codedVec[i] < -1 ? (alphaVal - 1) : 1);
            });
            return exp;
        };

        const starExps = [];
        for (let i = 0; i < n; i++) {
            for (let sign = -1; sign <= 1; sign += 2) {
                const coded = new Array(n).fill(0);
                coded[i] = sign * alphaVal;
                const def = paramDefs[paramKeys[i]];
                const center = (def.max + def.min) / 2;
                const halfRange = (def.max - def.min) / 2;
                const exp = {};
                paramKeys.forEach((key, j) => {
                    const d = paramDefs[key];
                    const c = (d.max + d.min) / 2;
                    const hr = (d.max - d.min) / 2;
                    if (j === i) {
                        exp[key] = c + sign * hr * alphaVal;
                        exp[key] = Math.max(d.min, Math.min(d.max, exp[key]));
                    } else {
                        exp[key] = c;
                    }
                });
                starExps.push(exp);
            }
        }

        const centerExp = {};
        paramKeys.forEach(key => {
            const def = paramDefs[key];
            centerExp[key] = (def.max + def.min) / 2;
        });
        const centerExps = Array(3).fill(null).map(() => Object.assign({}, centerExp));

        const experiments = [...factorialExps, ...starExps, ...centerExps];
        return this._addMetadata(experiments, 'central_composite', paramKeys);
    },

    evaluate(experiments, simulateFn, targets = ['d50', 'solidContent']) {
        return experiments.map((exp, idx) => {
            try {
                const result = simulateFn(exp);
                const evaluation = { experimentIndex: idx, params: exp, results: {} };
                targets.forEach(t => {
                    if (result[t]) {
                        const arr = result[t];
                        evaluation.results[t] = {
                            final: arr[arr.length - 1],
                            min: Math.min(...arr),
                            max: Math.max(...arr),
                            mean: arr.reduce((s, v) => s + v, 0) / arr.length
                        };
                    }
                });
                return evaluation;
            } catch (e) {
                return { experimentIndex: idx, params: exp, results: null, error: e.message };
            }
        });
    },

    analyzeDesignSpace(evaluations, paramDefs, targets) {
        const paramKeys = Object.keys(paramDefs);
        const validEvals = evaluations.filter(e => e.results !== null);

        if (validEvals.length === 0) return null;

        const analysis = { targets: {}, feasibleRegion: null };

        targets.forEach(t => {
            const values = validEvals
                .map(e => e.results[t] ? e.results[t].final : null)
                .filter(v => v !== null);

            if (values.length === 0) return;

            values.sort((a, b) => a - b);
            const n = values.length;
            const mean = values.reduce((s, v) => s + v, 0) / n;
            const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
            const std = Math.sqrt(variance);

            analysis.targets[t] = {
                min: values[0],
                max: values[n - 1],
                mean,
                std,
                median: n % 2 === 0 ? (values[n / 2 - 1] + values[n / 2]) / 2 : values[Math.floor(n / 2)],
                q1: values[Math.floor(n * 0.25)],
                q3: values[Math.floor(n * 0.75)]
            };
        });

        const paramRanges = {};
        paramKeys.forEach(key => {
            const vals = validEvals.map(e => e.params[key]).sort((a, b) => a - b);
            paramRanges[key] = { min: vals[0], max: vals[vals.length - 1] };
        });
        analysis.paramRanges = paramRanges;

        return analysis;
    },

    _subsetDefs(paramDefs, keys) {
        const subset = {};
        keys.forEach(k => { subset[k] = paramDefs[k]; });
        return subset;
    },

    _addMetadata(experiments, method, paramKeys) {
        return experiments.map((exp, i) => ({
            index: i,
            method,
            params: exp,
            paramKeys
        }));
    }
};

window.DOEDesign = DOEDesign;
