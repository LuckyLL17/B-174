/**
 * fluidDynamics.js
 * 流体动力学计算模块
 * 核心模型：平推流反应器 (PFR)
 */

const FluidDynamics = {
    /**
     * 计算管道截面积
     * @param {number} diameter 管径 (mm)
     * @returns {number} 面积 (m^2)
     */
    calculateArea(diameter) {
        const d_m = diameter / 1000;
        return Math.PI * Math.pow(d_m / 2, 2);
    },

    /**
     * 计算流速 v
     * v = Q / A
     * @param {number} flowRate 流量 (L/h)
     * @param {number} area 截面积 (m^2)
     * @returns {number} 流速 (m/s)
     */
    calculateVelocity(flowRate, area) {
        // L/h -> m^3/s: / 1000 / 3600
        const q_m3s = flowRate / 1000 / 3600;
        if (area <= 0) return 0;
        return q_m3s / area;
    },

    /**
     * 计算雷诺数 Re (用于判断流型，虽然本项目简化为PFR，但保留以备参考)
     * Re = (rho * v * d) / mu
     * @param {number} v 流速 (m/s)
     * @param {number} d 管径 (m)
     * @param {number} rho 密度 (kg/m^3) 约 1100-1200
     * @param {number} mu 粘度 (Pa·s) 约 0.002-0.005
     */
    calculateReynolds(v, d, rho = 1200, mu = 0.003) {
        return (rho * v * d) / mu;
    },

    /**
     * 计算停留时间 tau
     * tau = L / v
     * @param {number} length 长度 (m)
     * @param {number} velocity 流速 (m/s)
     * @returns {number} 停留时间 (s)
     */
    calculateResidenceTime(length, velocity) {
        if (velocity <= 0) return 0;
        return length / velocity;
    },

    /**
     * 混合后的新浓度计算
     * C_mix = (Q1*C1 + Q2*C2) / (Q1 + Q2)
     */
    calculateMixConcentration(Q1, C1, Q2, C2) {
        return (Q1 * C1 + Q2 * C2) / (Q1 + Q2);
    },

    /**
     * 混合后的新温度计算 (假设比热容相同)
     * T_mix = (Q1*T1 + Q2*T2) / (Q1 + Q2)
     */
    calculateMixTemperature(Q1, T1, Q2, T2) {
        return (Q1 * T1 + Q2 * T2) / (Q1 + Q2);
    }
};

window.FluidDynamics = FluidDynamics;
