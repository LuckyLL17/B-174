/**
 * pipeReactor.js
 * 模块二：管道/微反应器结晶数字孪生 (核心)
 * 模拟 PFR 模型，支持多点进料和变径
 */

const PipeReactor = {
    /**
     * 执行管道仿真
     * @param {Object} params 
     * @returns {Object} 结果 { distance, S, nucleationRate, growthRate, d50 }
     */
    simulate(params) {
        const {
            pipeSegments, // [{ length(m), diameter(mm) }, ...]
            feeds,        // [{ position(m), flow(L/h), conc(mol/L), nh3, naoh type... }]
            baseParams    // { initFlow, initConc, initPH, initTemp ... }
        } = params;
        
        // 离散化步长 dx (m)
        const dx = 0.1; 
        
        // 计算总长
        const totalLength = pipeSegments.reduce((sum, seg) => sum + seg.length, 0);
        const steps = Math.ceil(totalLength / dx);
        
        // 状态变量
        let currentFlow = baseParams.initFlow; // L/h
        let currentConc = baseParams.initConc; // mol/L
        let currentNH3 = baseParams.initNH3;
        let currentPH = baseParams.initPH;
        let currentTemp = baseParams.initTemp;
        
        // 晶体矩量
        let totalNuclei = 0; // #/s flux
        let currentD50 = 0;  // um
        
        // 结果数组
        const results = {
            distance: [],
            S: [],
            B: [],
            G: [],
            D50: [], // um
            residenceTime: [] // s (cumulative)
        };
        
        let cumulativeTime = 0;
        let cumulativeDist = 0;
        
        // 当前管段索引
        let segIdx = 0;
        let segDistStart = 0;

        for (let i = 0; i < steps; i++) {
            const x = i * dx;
            
            // 1. 确定管段参数
            let seg = pipeSegments[segIdx];
            if (x > segDistStart + seg.length && segIdx < pipeSegments.length - 1) {
                segDistStart += seg.length;
                segIdx++;
                seg = pipeSegments[segIdx];
            }
            
            // 2. 检查进料点 (简单的位置匹配)
            // 查找在这个 dx 范围内的进料
            const feed = feeds.find(f => f.position >= x && f.position < x + dx);
            if (feed) {
                // 混合计算
                // 新流量
                const newFlow = currentFlow + feed.flow;
                
                // 浓度混合 (C1Q1 + C2Q2) / (Q1+Q2)
                currentConc = FluidDynamics.calculateMixConcentration(currentFlow, currentConc, feed.flow, feed.conc);
                currentNH3 = FluidDynamics.calculateMixConcentration(currentFlow, currentNH3, feed.flow, feed.nh3 || 0);
                
                // 温度/pH 混合 (简化加权)
                currentTemp = FluidDynamics.calculateMixTemperature(currentFlow, currentTemp, feed.flow, feed.temp || currentTemp);
                // pH 实际上是对数关系，不能简单平均，这里工程简化，或假设进料预调了 pH
                // 如果进料是 NaOH，会剧烈改变 pH。这里假设 feed.ph 是混合后的有效 pH 贡献
                // 为简便，若 feed 有 pH 设定，则更新为 target pH (控制逻辑)
                if (feed.targetPH) currentPH = feed.targetPH;
                
                currentFlow = newFlow;
            }
            
            // 3. 流体动力学
            const area = FluidDynamics.calculateArea(seg.diameter);
            const v = FluidDynamics.calculateVelocity(currentFlow, area);
            const dt = FluidDynamics.calculateResidenceTime(dx, v);
            cumulativeTime += dt;
            
            // 4. 动力学计算
            const cStar = Kinetics.calculateEquilibriumConc(currentPH, currentTemp, currentNH3);
            const S = Kinetics.calculateSupersaturation(currentConc, cStar);
            
            const B = Kinetics.calculateNucleationRate(S); // #/m3/s
            const G = Kinetics.calculateGrowthRate(S, '001'); // m/s (使用 001 代表主轴)
            
            // 5. 质量平衡与粒径更新
            // dM0 = B * A * dx (Total nuclei generated in this slice volume)
            // 这里我们追踪"流体微元"随时间的变化 (LaGrange perspective fits PFR)
            
            // 在微元内：
            // 新增晶核数 density
            const newNucleiDensity = B * dt; // #/m3
            
            // 现有粒子生长
            // L_new = L_old + G * dt
            currentD50 += G * dt * 1e6; // m -> um
            
            // 如果之前没有晶核，且现在爆发成核
            if (currentD50 === 0 && newNucleiDensity > 1e3) {
                currentD50 = 0.1; // 初始核大小 0.1 um
            }
            
            // 消耗浓度
            // dC = - (Consumption by Nucl + Growth)
            // Mass growth approx: Area * G * Rho
            // 简化：正比于 G 和 S
            let dC = 0;
            if (S > 1) {
                dC = (currentConc - cStar) * 0.05 * dt; // 消耗系数
                if (dC > currentConc) dC = currentConc;
                currentConc -= dC;
            }
            
            // 6. 记录结果
            results.distance.push(x.toFixed(2));
            results.S.push(S);
            results.B.push(B);
            results.G.push(G);
            results.D50.push(currentD50);
            results.residenceTime.push(cumulativeTime);
            
            cumulativeDist = x;
        }
        
        return results;
    }
};

window.PipeReactor = PipeReactor;
