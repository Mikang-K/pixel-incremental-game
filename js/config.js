'use strict';
// 모든 균형 숫자는 여기에만 둔다. tools/simulate.js로 결과를 보며 조정한다.
const CONFIG = {
  // 칸의 필요 작업량과 방울. 지수는 그림 순번(0부터). tierWorkGrowth는 해상도 단계(0부터)마다 한 번 더 곱한다.
  cell: { workBase: 18, workGrowth: 1.25, tierWorkGrowth: 1.8, dropsBase: 1, dropsGrowth: 1.2 },
  click: { basePower: 1 },
  fairies: {
    brush: { baseCost: 8, costGrowth: 1.15, workPerSecond: 0.5, spread: 1 },
    roller: { baseCost: 400, costGrowth: 1.15, workPerSecond: 6, spread: 3 },
    spray: { baseCost: 9000, costGrowth: 1.15, workPerSecond: 60, spread: 9 },
  },
  upgrades: {
    // 클릭 힘은 값이 가파르게 오른다. 초반에는 손으로, 이후에는 요정이 주력이 되게 하려는 것.
    clickPower: { baseCost: 4, costGrowth: 6, multiplier: 2 },
    brushSpeed: { baseCost: 100, costGrowth: 3, multiplier: 2 },
    rollerSpeed: { baseCost: 2500, costGrowth: 3, multiplier: 2 },
    spraySpeed: { baseCost: 50000, costGrowth: 3, multiplier: 2 },
    cellDrops: { baseCost: 200, costGrowth: 2.5, multiplier: 1.5 },
    ruleBlue: { baseCost: 300, costGrowth: 1, maxLevel: 1 },
    ruleYellow: { baseCost: 1500, costGrowth: 1, maxLevel: 1 },
    ruleRed: { baseCost: 6000, costGrowth: 1, maxLevel: 1 },
  },
  rules: {
    blue: { bleedFraction: 0.25 },
    yellow: { dropsMultiplier: 5 },
    red: { heatSeconds: 5, heatMultiplier: 2 },
  },
  gallery: { bonusPerPicture: 0.1 },
  prestige: { eyesBase: 3 },
  eyeUpgrades: {
    startFairies: { baseCost: 1, costGrowth: 2, brushPerLevel: 5 },
    offlineEfficiency: { baseCost: 2, costGrowth: 2, addPerLevel: 0.1 },
    globalSpeed: { baseCost: 1, costGrowth: 2, multiplier: 2 },
    autoBuy: { baseCost: 3, costGrowth: 1, maxLevel: 1 },
  },
  offline: { maxSeconds: 28800, baseEfficiency: 0.5 },
  save: { intervalSeconds: 10, storageKey: 'lostCanvasSave' },
  tick: { maxStepSeconds: 1 },
  ui: { maxFairyDots: 20 },
};

if (typeof module !== 'undefined') module.exports = CONFIG;
