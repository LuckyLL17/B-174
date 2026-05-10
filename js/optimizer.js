const ProcessOptimizer = {
    optimize(config) {
        const {
            simulateFn,
            paramDefs,
            targetD50,
            targetSolidContent = null,
            initialParams,
            fixedParams = {},
            maxIter = 500,
            tol = 1e-4,
            onProgress = null
        } = config;

        const paramKeys = Object.keys(paramDefs);
        const n = paramKeys.length;

        const toVector = (params) => {
            return paramKeys.map(k => params[k]);
        };

        const toFullParams = (vec) => {
            const p = Object.assign({}, fixedParams);
            paramKeys.forEach((k, i) => { p[k] = vec[i]; });
            return p;
        };

        const clampParams = (vec) => {
            return vec.map((v, i) => {
                const def = paramDefs[paramKeys[i]];
                return Math.max(def.min, Math.min(def.max, v));
            });
        };

        const objective = (vec) => {
            const clamped = clampParams(vec);
            const params = toFullParams(clamped);
            try {
                const result = simulateFn(params);
                const d50Arr = result.d50;
                if (!d50Arr || d50Arr.length === 0) return 1e10;
                const d50 = d50Arr[d50Arr.length - 1];
                if (!isFinite(d50)) return 1e10;
                let cost = Math.pow((d50 - targetD50) / targetD50, 2);

                if (targetSolidContent !== null) {
                    const scArr = result.solidContent;
                    if (!scArr || scArr.length === 0) return 1e10;
                    const sc = scArr[scArr.length - 1];
                    if (!isFinite(sc)) return 1e10;
                    cost += Math.pow((sc - targetSolidContent) / targetSolidContent, 2);
                }

                if (!isFinite(cost)) return 1e10;
                return cost;
            } catch (e) {
                return 1e10;
            }
        };

        let simplex = [];
        const x0 = toVector(initialParams);
        simplex.push({ vec: x0.slice(), cost: objective(x0) });

        for (let i = 0; i < n; i++) {
            const xi = x0.slice();
            const step = (paramDefs[paramKeys[i]].max - paramDefs[paramKeys[i]].min) * 0.1;
            xi[i] = clampParams([x0[i] + step])[i];
            simplex.push({ vec: xi, cost: objective(xi) });
        }

        const alpha = 1.0;
        const gamma = 2.0;
        const rho = 0.5;
        const sigma = 0.5;

        let iter = 0;
        let bestCost = Infinity;
        let bestVec = null;
        const history = [];

        while (iter < maxIter) {
            simplex.sort((a, b) => a.cost - b.cost);

            if (simplex[0].cost < bestCost) {
                bestCost = simplex[0].cost;
                bestVec = simplex[0].vec.slice();
            }

            history.push({
                iteration: iter,
                cost: simplex[0].cost,
                params: toFullParams(clampParams(simplex[0].vec))
            });

            if (onProgress && iter % 20 === 0) {
                onProgress(iter, simplex[0].cost, toFullParams(clampParams(simplex[0].vec)));
            }

            if (Math.abs(simplex[0].cost - simplex[n].cost) < tol && iter > 10) {
                break;
            }

            const centroid = new Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    centroid[j] += simplex[i].vec[j];
                }
            }
            for (let j = 0; j < n; j++) {
                centroid[j] /= n;
            }

            const reflected = centroid.map((c, j) => c + alpha * (c - simplex[n].vec[j]));
            const reflectedClamped = clampParams(reflected);
            const reflectedCost = objective(reflectedClamped);

            if (reflectedCost >= simplex[0].cost && reflectedCost < simplex[n - 1].cost) {
                simplex[n] = { vec: reflectedClamped, cost: reflectedCost };
            } else if (reflectedCost < simplex[0].cost) {
                const expanded = centroid.map((c, j) => c + gamma * (reflectedClamped[j] - c));
                const expandedClamped = clampParams(expanded);
                const expandedCost = objective(expandedClamped);

                if (expandedCost < reflectedCost) {
                    simplex[n] = { vec: expandedClamped, cost: expandedCost };
                } else {
                    simplex[n] = { vec: reflectedClamped, cost: reflectedCost };
                }
            } else {
                const contracted = centroid.map((c, j) => c + rho * (simplex[n].vec[j] - c));
                const contractedClamped = clampParams(contracted);
                const contractedCost = objective(contractedClamped);

                if (contractedCost < simplex[n].cost) {
                    simplex[n] = { vec: contractedClamped, cost: contractedCost };
                } else {
                    for (let i = 1; i <= n; i++) {
                        simplex[i].vec = simplex[0].vec.map((v, j) => v + sigma * (simplex[i].vec[j] - v));
                        simplex[i].vec = clampParams(simplex[i].vec);
                        simplex[i].cost = objective(simplex[i].vec);
                    }
                }
            }

            iter++;
        }

        simplex.sort((a, b) => a.cost - b.cost);
        const optimalParams = toFullParams(clampParams(simplex[0].vec));
        const optimalResult = simulateFn(optimalParams);
        const d50Arr = optimalResult.d50 || [];
        const finalD50 = d50Arr.length > 0 ? d50Arr[d50Arr.length - 1] : null;
        const scArr = optimalResult.solidContent || [];
        const finalSolidContent = scArr.length > 0 ? scArr[scArr.length - 1] : null;

        return {
            optimalParams,
            optimalResult,
            finalD50,
            finalSolidContent,
            cost: simplex[0].cost,
            iterations: iter,
            history,
            d50Error: (finalD50 !== null && isFinite(finalD50))
                ? Math.abs(finalD50 - targetD50) / targetD50 * 100
                : null,
            converged: iter < maxIter
        };
    },

    gridSearch(config) {
        const {
            simulateFn,
            paramDefs,
            targetD50,
            targetSolidContent = null,
            fixedParams = {},
            gridPoints = 5
        } = config;

        const paramKeys = Object.keys(paramDefs);
        const gridValues = {};
        paramKeys.forEach(k => {
            const def = paramDefs[k];
            const step = (def.max - def.min) / (gridPoints - 1);
            gridValues[k] = [];
            for (let i = 0; i < gridPoints; i++) {
                gridValues[k].push(def.min + step * i);
            }
        });

        let bestCost = Infinity;
        let bestParams = null;
        let bestResult = null;
        const allRuns = [];

        const iterate = (idx, currentParams) => {
            if (idx === paramKeys.length) {
                const fullParams = Object.assign({}, fixedParams, currentParams);
                try {
                    const result = simulateFn(fullParams);
                    const d50Arr = result.d50;
                    if (!d50Arr || d50Arr.length === 0) return;
                    const d50 = d50Arr[d50Arr.length - 1];
                    if (!isFinite(d50)) return;
                    let cost = Math.pow((d50 - targetD50) / targetD50, 2);

                    if (targetSolidContent !== null) {
                        const scArr = result.solidContent;
                        if (!scArr || scArr.length === 0) return;
                        const sc = scArr[scArr.length - 1];
                        if (!isFinite(sc)) return;
                        cost += Math.pow((sc - targetSolidContent) / targetSolidContent, 2);
                    }

                    allRuns.push({ params: Object.assign({}, fullParams), cost, d50 });

                    if (cost < bestCost) {
                        bestCost = cost;
                        bestParams = Object.assign({}, fullParams);
                        bestResult = result;
                    }
                } catch (e) {
                    // skip invalid parameter combos
                }
                return;
            }

            const key = paramKeys[idx];
            gridValues[key].forEach(val => {
                currentParams[key] = val;
                iterate(idx + 1, currentParams);
            });
            delete currentParams[key];
        };

        iterate(0, {});

        allRuns.sort((a, b) => a.cost - b.cost);

        const d50Arr = bestResult ? (bestResult.d50 || []) : [];
        const finalD50 = d50Arr.length > 0 ? d50Arr[d50Arr.length - 1] : null;
        const scArr2 = bestResult ? (bestResult.solidContent || []) : [];
        const finalSolidContent = scArr2.length > 0 ? scArr2[scArr2.length - 1] : null;

        return {
            optimalParams: bestParams || {},
            optimalResult: bestResult,
            cost: bestCost,
            totalRuns: allRuns.length,
            topRuns: allRuns.slice(0, 10),
            finalD50,
            finalSolidContent,
            d50Error: (finalD50 !== null && isFinite(finalD50))
                ? Math.abs(finalD50 - targetD50) / targetD50 * 100
                : null,
            iterations: allRuns.length,
            converged: bestCost < Infinity
        };
    }
};

window.ProcessOptimizer = ProcessOptimizer;
