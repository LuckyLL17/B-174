/**
 * doeDesign.js
 * DOE实验设计模块 - 设计空间探索与分析
 */

const DOEDesign = {
    methods: {
        fullFactorial: '全因子设计',
        fractionalFactorial: '部分因子设计',
        centralComposite: '中心复合设计',
        boxBehnken: 'Box-Behnken设计',
        latinHypercube: '拉丁超立方采样',
        orthogonal: '正交设计'
    },

    defaultFactors: {
        saltConc: { min: 1.5, max: 2.5, default: 2.0, label: '金属盐浓度', type: 'continuous' },
        nh3Conc: { min: 0.3, max: 0.7, default: 0.5, label: '氨水浓度', type: 'continuous' },
        phCurve: { min: 10.5, max: 11.5, default: 11.0, label: 'pH值', type: 'continuous' },
        tempCurve: { min: 50, max: 60, default: 55, label: '温度', type: 'continuous' }
    },

    generateDesign(method, factors, options = {}) {
        factors = factors || this.defaultFactors;
        
        let result;

        switch (method) {
            case 'fullFactorial':
                result = this.fullFactorialDesign(factors, options);
                break;
            case 'fractionalFactorial':
                result = this.fractionalFactorialDesign(factors, options);
                break;
            case 'centralComposite':
                result = this.centralCompositeDesign(factors, options);
                break;
            case 'boxBehnken':
                result = this.boxBehnkenDesign(factors, options);
                break;
            case 'latinHypercube':
                result = this.latinHypercubeDesign(factors, options);
                break;
            case 'orthogonal':
                result = this.orthogonalDesign(factors, options);
                break;
            default:
                result = this.fullFactorialDesign(factors, options);
        }

        return this.formatDesignResult(result, method, factors);
    },

    fullFactorialDesign(factors, options = {}) {
        const { levels = 2 } = options;
        const factorNames = Object.keys(factors);
        const levelValues = {};

        factorNames.forEach(name => {
            const factor = factors[name];
            levelValues[name] = [];
            for (let i = 0; i < levels; i++) {
                const t = levels === 1 ? 0.5 : i / (levels - 1);
                levelValues[name].push(factor.min + t * (factor.max - factor.min));
            }
        });

        const runs = this.generateCombinations(levelValues);

        return {
            runs,
            factorNames,
            numRuns: runs.length,
            numFactors: factorNames.length,
            type: 'fullFactorial',
            levels
        };
    },

    fractionalFactorialDesign(factors, options = {}) {
        const { resolution = 3, levels = 2 } = options;
        const factorNames = Object.keys(factors);
        const numFactors = factorNames.length;

        let numRuns;
        if (resolution === 3) {
            numRuns = Math.pow(2, Math.ceil(Math.log2(numFactors + 1)));
        } else if (resolution === 4) {
            numRuns = Math.pow(2, Math.ceil(Math.log2(numFactors + 1)) + 1);
        } else {
            numRuns = Math.pow(2, numFactors);
        }

        numRuns = Math.min(numRuns, Math.pow(2, numFactors));

        const fullDesign = this.fullFactorialDesign(factors, { levels });
        const selectedRuns = [];
        for (let i = 0; i < Math.min(numRuns, fullDesign.runs.length); i++) {
            selectedRuns.push(fullDesign.runs[i]);
        }

        return {
            runs: selectedRuns,
            factorNames,
            numRuns: selectedRuns.length,
            numFactors: factorNames.length,
            type: 'fractionalFactorial',
            resolution,
            levels
        };
    },

    centralCompositeDesign(factors, options = {}) {
        const { alpha = 1, centerPoints = 5 } = options;
        const factorNames = Object.keys(factors);
        const numFactors = factorNames.length;
        const runs = [];

        const factorialDesign = this.fullFactorialDesign(factors, { levels: 2 });
        runs.push(...factorialDesign.runs);

        factorNames.forEach((name, idx) => {
            const factor = factors[name];
            const center = (factor.min + factor.max) / 2;
            const range = (factor.max - factor.min) / 2;

            const highRun = {};
            const lowRun = {};

            factorNames.forEach((n, i) => {
                const f = factors[n];
                const c = (f.min + f.max) / 2;
                highRun[n] = c;
                lowRun[n] = c;
            });

            highRun[name] = center + alpha * range;
            lowRun[name] = center - alpha * range;

            runs.push(highRun);
            runs.push(lowRun);
        });

        const centerRun = {};
        factorNames.forEach(name => {
            const factor = factors[name];
            centerRun[name] = (factor.min + factor.max) / 2;
        });
        for (let i = 0; i < centerPoints; i++) {
            runs.push({ ...centerRun });
        }

        return {
            runs,
            factorNames,
            numRuns: runs.length,
            numFactors: factorNames.length,
            type: 'centralComposite',
            alpha,
            centerPoints
        };
    },

    boxBehnkenDesign(factors, options = {}) {
        const { centerPoints = 3 } = options;
        const factorNames = Object.keys(factors);
        const numFactors = factorNames.length;
        const runs = [];

        for (let i = 0; i < numFactors; i++) {
            for (let j = i + 1; j < numFactors; j++) {
                const levels = [-1, 1];
                levels.forEach(li => {
                    levels.forEach(lj => {
                        const run = {};
                        factorNames.forEach((name, idx) => {
                            const factor = factors[name];
                            const center = (factor.min + factor.max) / 2;
                            const range = (factor.max - factor.min) / 2;

                            if (idx === i) {
                                run[name] = center + li * range;
                            } else if (idx === j) {
                                run[name] = center + lj * range;
                            } else {
                                run[name] = center;
                            }
                        });
                        runs.push(run);
                    });
                });
            }
        }

        const centerRun = {};
        factorNames.forEach(name => {
            const factor = factors[name];
            centerRun[name] = (factor.min + factor.max) / 2;
        });
        for (let i = 0; i < centerPoints; i++) {
            runs.push({ ...centerRun });
        }

        return {
            runs,
            factorNames,
            numRuns: runs.length,
            numFactors: factorNames.length,
            type: 'boxBehnken',
            centerPoints
        };
    },

    latinHypercubeDesign(factors, options = {}) {
        const { samples = 20 } = options;
        const factorNames = Object.keys(factors);
        const numFactors = factorNames.length;
        const runs = [];

        const permutations = [];
        factorNames.forEach(() => {
            const perm = [];
            for (let i = 0; i < samples; i++) perm.push(i);
            for (let i = perm.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [perm[i], perm[j]] = [perm[j], perm[i]];
            }
            permutations.push(perm);
        });

        for (let i = 0; i < samples; i++) {
            const run = {};
            factorNames.forEach((name, idx) => {
                const factor = factors[name];
                const rank = permutations[idx][i];
                const t = (rank + 0.5) / samples;
                run[name] = factor.min + t * (factor.max - factor.min);
            });
            runs.push(run);
        }

        return {
            runs,
            factorNames,
            numRuns: runs.length,
            numFactors: factorNames.length,
            type: 'latinHypercube',
            samples
        };
    },

    orthogonalDesign(factors, options = {}) {
        const { levels = 2 } = options;
        return this.fullFactorialDesign(factors, { levels });
    },

    generateCombinations(levelValues) {
        const factorNames = Object.keys(levelValues);
        const combinations = [{}];

        factorNames.forEach(factorName => {
            const newCombinations = [];
            combinations.forEach(combo => {
                levelValues[factorName].forEach(value => {
                    newCombinations.push({ ...combo, [factorName]: value });
                });
            });
            combinations.length = 0;
            combinations.push(...newCombinations);
        });

        return combinations;
    },

    runSimulations(design) {
        const results = [];

        design.runs.forEach((params, idx) => {
            const fullParams = {
                ...params,
                naohConc: 4.0,
                feedRate: 10,
                stirSpeed: 600,
                totalTime: 10
            };

            const result = ReactionKettle.simulate(fullParams);
            const finalIndex = result.d50.length - 1;

            results.push({
                runId: idx + 1,
                parameters: params,
                outputs: {
                    d50: result.d50[finalIndex],
                    solidContent: result.solidContent[finalIndex],
                    supersaturation: result.supersaturation[finalIndex]
                }
            });
        });

        return results;
    },

    analyzeResults(results, design) {
        const analysis = {
            summary: {},
            effects: {},
            interactions: {},
            optimalRuns: []
        };

        const outputs = ['d50', 'solidContent', 'supersaturation'];
        outputs.forEach(output => {
            const values = results.map(r => r.outputs[output]);
            analysis.summary[output] = {
                min: Math.min(...values),
                max: Math.max(...values),
                mean: values.reduce((a, b) => a + b, 0) / values.length,
                std: Math.sqrt(values.reduce((a, b) => a + Math.pow(b - values.reduce((x, y) => x + y, 0) / values.length, 2), 0) / values.length)
            };
        });

        design.factorNames.forEach(factorName => {
            analysis.effects[factorName] = {};
            outputs.forEach(output => {
                const factorValues = [...new Set(results.map(r => r.parameters[factorName]))].sort();
                if (factorValues.length >= 2) {
                    const lowVal = factorValues[0];
                    const highVal = factorValues[factorValues.length - 1];
                    const lowOutputs = results.filter(r => Math.abs(r.parameters[factorName] - lowVal) < 0.001).map(r => r.outputs[output]);
                    const highOutputs = results.filter(r => Math.abs(r.parameters[factorName] - highVal) < 0.001).map(r => r.outputs[output]);
                    
                    if (lowOutputs.length > 0 && highOutputs.length > 0) {
                        const lowMean = lowOutputs.reduce((a, b) => a + b, 0) / lowOutputs.length;
                        const highMean = highOutputs.reduce((a, b) => a + b, 0) / highOutputs.length;
                        analysis.effects[factorName][output] = highMean - lowMean;
                    }
                }
            });
        });

        const sortedResults = [...results].sort((a, b) => {
            const scoreA = a.outputs.d50 * 0.7 + a.outputs.solidContent * 0.3;
            const scoreB = b.outputs.d50 * 0.7 + b.outputs.solidContent * 0.3;
            return scoreB - scoreA;
        });
        analysis.optimalRuns = sortedResults.slice(0, 5);

        return analysis;
    },

    formatDesignResult(result, method, factors) {
        return {
            method: method,
            methodName: this.methods[method] || method,
            factors: factors,
            ...result,
            labeledRuns: result.runs.map((run, idx) => {
                const labeled = { runId: idx + 1 };
                for (const name in run) {
                    labeled[factors[name]?.label || name] = run[name];
                }
                return labeled;
            })
        };
    },

    generateDesignMatrix(design) {
        const matrix = [];
        
        const header = ['RunID'];
        design.factorNames.forEach(name => {
            header.push(design.factors[name]?.label || name);
        });
        matrix.push(header);

        design.runs.forEach((run, idx) => {
            const row = [idx + 1];
            design.factorNames.forEach(name => {
                row.push(run[name].toFixed(3));
            });
            matrix.push(row);
        });

        return matrix;
    },

    exportToCSV(design, results = null) {
        let csv = '';
        
        const header = ['RunID'];
        design.factorNames.forEach(name => {
            header.push(design.factors[name]?.label || name);
        });
        
        if (results) {
            header.push('D50 (μm)');
            header.push('固含率 (%)');
            header.push('过饱和度');
        }
        csv += header.join(',') + '\n';

        design.runs.forEach((run, idx) => {
            const row = [idx + 1];
            design.factorNames.forEach(name => {
                row.push(run[name].toFixed(3));
            });
            
            if (results && results[idx]) {
                row.push(results[idx].outputs.d50.toFixed(3));
                row.push(results[idx].outputs.solidContent.toFixed(3));
                row.push(results[idx].outputs.supersaturation.toFixed(3));
            }
            csv += row.join(',') + '\n';
        });

        return csv;
    }
};

window.DOEDesign = DOEDesign;
