'use strict';
// 모든 균형 숫자는 여기에만 둔다. tools/simulate.js로 결과를 보며 조정한다.
const CONFIG = {
  // 칸의 필요 작업량과 방울. 지수는 그림 순번(0부터).
  cell: { workBase: 3, workGrowth: 1.45, dropsBase: 1, dropsGrowth: 1.35 },
  click: { basePower: 1 },
  fairies: {
    brush: { baseCost: 15, costGrowth: 1.15, workPerSecond: 0.5, spread: 1 },
    roller: { baseCost: 400, costGrowth: 1.15, workPerSecond: 6, spread: 3 },
    spray: { baseCost: 9000, costGrowth: 1.15, workPerSecond: 60, spread: 9 },
  },
  upgrades: {
    clickPower: { baseCost: 10, costGrowth: 2, multiplier: 2 },
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
    offlineEfficiency: { baseCost: 1, costGrowth: 2, addPerLevel: 0.1 },
    globalSpeed: { baseCost: 2, costGrowth: 2, multiplier: 2 },
    autoBuy: { baseCost: 3, costGrowth: 1, maxLevel: 1 },
  },
  offline: { maxSeconds: 28800, baseEfficiency: 0.5 },
  save: { intervalSeconds: 10, storageKey: 'lostCanvasSave' },
  tick: { maxStepSeconds: 1 },
  ui: { maxFairyDots: 20 },
};

if (typeof module !== 'undefined') module.exports = CONFIG;
