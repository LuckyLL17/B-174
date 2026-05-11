/**
 * reactionKettle.js
 * 模块一：反应釜共沉淀数字孪生
 * 模拟连续搅拌槽反应器 (CSTR) 或 间歇反应器 (Batch) 过程
 */

const ReactionKettle = {
    /**
     * 执行仿真计算
     * @param {Object} params 输入参数对象
     * @returns {Object} 结果数据 { timeSeries, metrics }
     */
    simulate(params) {
        // 解构参数
        const {
            saltConc, // 金属盐浓度 mol/L
            nh3Conc,  // 氨水浓度 mol/L
            naohConc, // 碱浓度 mol/L
            feedRate, // 加药速度 L/h
            stirSpeed, // 搅拌转速 rpm
            totalTime, // 反应总时间 h
            phCurve,   // pH 控制目标 (常数或数组)
            tempCurve, // 温度控制目标 (C)
            kettleVolume // 反应釜体积 L (底液)
        } = params;

        // 初始化状态变量
        let currentVol = kettleVolume || 10.0; // 初始底液
        let metalAmount = 0; // mol
        let particleCount = 1e9; // 初始晶种数 (假设)
        let totalCrystalMass = 0; // g
        
        // 粒径分布矩 (Moments)
        // M0 = Total Number
        // M1 = Total Length
        // M3 ~ Mass
        let M0 = 1e9;
        let M1 = 1e-6 * M0; // 初始平均 1um
        let M3 = Math.pow(1e-6, 3) * M0; 

        // 仿真步长 (秒)
        const dt = 10; 
        const totalSteps = (totalTime * 3600) / dt;
        
        // 结果存储
        const results = {
            time: [], // h
            conc: [], // mol/L (Free Metal)
            solidContent: [], // %
            d50: [], // um
            supersaturation: []
        };

        // 循环计算
        for (let step = 0; step < totalSteps; step++) {
            const t_sec = step * dt;
            const t_hr = t_sec / 3600;

            // 1. 获取当前控制参数 (pH, T)
            // 简单处理：假设为常数
            const currentPH = typeof phCurve === 'number' ? phCurve : (Array.isArray(phCurve) ? phCurve[0] : 11.0); 
            const currentT = typeof tempCurve === 'number' ? tempCurve : (Array.isArray(tempCurve) ? tempCurve[0] : 55);

            // 2. 进料 (Mass Balance)
            // Feed rate L/h -> L/s
            const flow_Ls = feedRate / 3600;
            const dVol = flow_Ls * dt;
            const dMetalIn = saltConc * flow_Ls * dt; // mol
            
            // 3. 反应 (结晶消耗)
            // 计算平衡浓度
            // 假设反应釜内氨浓度主要由进料和底液平衡决定，这里简化为与输入氨浓度成比例
            // 实际工业中会有单独的氨水进料管道，这里简化模型
            const effectiveNH3 = 0.5 * nh3Conc; 
            const cStar = Kinetics.calculateEquilibriumConc(currentPH, currentT, effectiveNH3);
            
            // 当前虚拟浓度 (如果不沉淀)
            const totalMetal = metalAmount + dMetalIn;
            const tempVol = currentVol + dVol;
            const cVirtual = totalMetal / tempVol;

            // 计算过饱和度
            const S = Kinetics.calculateSupersaturation(cVirtual, cStar);
            
            // 动力学速率
            // 成核 B (#/m3/s) -> 总成核数 = B * Vol * dt
            const B = Kinetics.calculateNucleationRate(S);
            const newNuclei = B * (tempVol / 1000) * dt; // Vol in L -> m3
            
            // 生长 G (m/s) -> 粒径增加 dL = G * dt
            // 取平均生长速率 (001 + 101) / 2
            const G_001 = Kinetics.calculateGrowthRate(S, '001');
            const G_101 = Kinetics.calculateGrowthRate(S, '101');
            const G_avg = (G_001 + G_101) / 2;
            
            // 4. 更新矩量 (Moment Transformation)
            // dM0/dt = B
            // dM1/dt = G * M0
            // dM3/dt = 3 * G * M2 ... 简化: Mass Growth
            
            // 消耗金属量 dMass (mol)
            // m_crystal = rho * kv * L^3
            // dMass/dt approx proportional to G * SurfaceArea
            // 这里使用简化质量平衡：根据过饱和度消耗
            
            // 消耗速率 (First order approximation for consumption to maintain realistic S)
            // dC/dt = -k * (C - C*)
            let consumedMetal = 0;
            if (S > 1) {
                // 消耗量受生长限制
                consumedMetal = (cVirtual - cStar) * 0.1 * dt; // 动力学限制系数
                if (consumedMetal > (totalMetal - cStar * tempVol)) consumedMetal = totalMetal - cStar * tempVol; 
            }
            
            // 5. 更新状态
            metalAmount = totalMetal - consumedMetal;
            totalCrystalMass += consumedMetal * 92.0; // 假设 M(OH)2 摩尔质量 ~92 (Ni0.8...)
            currentVol = tempVol;
            
            // 更新平均粒径 (简化模型：质量/数量 开立方)
            // Particle Mass ~ TotalMass / TotalNumber
            M0 += newNuclei;
            const avgMass = totalCrystalMass / M0; // g
            // m = rho * 4/3 * pi * r^3
            // r = (m / rho / 4/3 / pi)^(1/3)
            // D = 2r
            const rho = 3.5; // g/cm3
            const r_cm = Math.pow(avgMass / rho / (4/3 * Math.PI), 1.0/3.0);
            const d50_um = r_cm * 10000 * 2; // cm -> um

            // 记录数据 (每 60 步记录一次，即 10min)
            if (step % 60 === 0) {
                results.time.push(t_hr);
                results.conc.push(metalAmount / currentVol);
                results.solidContent.push((totalCrystalMass / (currentVol * 1000)) * 100); // % w/v approx
                results.d50.push(isNaN(d50_um) ? 0 : d50_um);
                results.supersaturation.push(S);
            }
        }

        return results;
    }
};

window.ReactionKettle = ReactionKettle;
