/**
 * kinetics.js
 * NCM 前驱体共沉淀核心动力学模型
 * 包含成核、生长及过饱和度计算
 */

const Kinetics = {
  // 物理常数
  CONSTANTS: {
    R: 8.314, // J/(mol·K)
    T0: 273.15, // K
  },

  // 默认动力学参数 (需要根据工业数据校准，此处为典型工程预估值)
  Params: {
    kb: 1.5e8, // 成核速率常数 #/s/m^3
    n: 2.5, // 成核级数

    // 晶面生长参数
    growth: {
      "001": { kg: 2.0e-7, m: 1.2 }, // m/s
      101: { kg: 5.5e-7, m: 1.5 }, // m/s
    },
  },

  /**
   * 计算成核速率 B
   * B = kb * (S - 1)^n
   * @param {number} S 过饱和度
   * @returns {number} 成核速率 (#/m^3·s)
   */
  calculateNucleationRate(S) {
    if (S <= 1) return 0;
    return this.Params.kb * Math.pow(S - 1, this.Params.n);
  },

  /**
   * 计算晶体生长速率 G
   * G_j = k_gj * (S - 1)^(m_j)
   * @param {number} S 过饱和度
   * @param {string} face 晶面 ('001' 或 '101')
   * @returns {number} 生长速率 (m/s)
   */
  calculateGrowthRate(S, face) {
    if (S <= 1) return 0;
    const p = this.Params.growth[face];
    if (!p) return 0;
    return p.kg * Math.pow(S - 1, p.m);
  },

  /**
   * 计算平衡溶解度 C* (简化工程模型)
   * Log(Ksp) 随温度和 pH 变化
   * 这里采用简化的经验公式估算总金属离子平衡浓度
   * @param {number} pH
   * @param {number} T 温度 (Celsius)
   * @param {number} nh3Conc 氨浓度 (mol/L) - 络合效应
   * @returns {number} 平衡浓度 (mol/L)
   */
  calculateEquilibriumConc(pH, T, nh3Conc) {
    // 简化的溶度积计算，考虑 M(OH)2 沉淀
    // Log(C*) ~ -A*pH + B*Log[NH3] + C/T + D

    const tempK = T + 273.15;

    // 经验系数，仅用于演示趋势
    // pH 越高，溶解度越低
    // NH3 浓度越高，络合效应导致溶解度升高
    // 温度越高，溶解度通常略有升高

    // Base Ksp contribution (pH effect)
    const logC_pH = -2.0 * pH + 14.0;

    // Complexation effect ([M(NH3)n]2+)
    // [M_total] = [M2+] + [M(NH3)2+]...
    // Log(C_complex) ~ n * Log[NH3]
    const logC_NH3 = 2.5 * Math.log10(Math.max(nh3Conc, 0.01));

    // Temperature effect
    const logC_T = -1000 / tempK;

    // Combine
    const logC_Star = logC_pH + logC_NH3 + logC_T + 5.0; // Offset adjustment for realistic scale

    return Math.pow(10, logC_Star);
  },

  /**
   * 计算过饱和度 S
   * S = C / C*
   * @param {number} currentConc 当前金属离子总浓度
   * @param {number} equilibriumConc 平衡浓度
   * @returns {number} 过饱和度
   */
  calculateSupersaturation(currentConc, equilibriumConc) {
    if (equilibriumConc <= 1e-12) return 100; // 防止除零，极大过饱和
    return currentConc / equilibriumConc;
  },
};

// 暴露接口供其他模块使用
window.Kinetics = Kinetics;
