'use strict';
// 검사용 설정과 그림. js/config.js를 읽지 않는다: 균형 조정이 검사를 깨면 안 된다.

function testConfig() {
  return {
    cell: { workBase: 2, workGrowth: 1, tierWorkGrowth: 1, dropsBase: 1, dropsGrowth: 1.35 },
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
}

function testPictures() {
  const palette = ['#000000', '#0000ff', '#ffff00', '#ff0000'];
  return [
    { id: 't1', title: '시험 1', artist: '시험', year: 1, tier: 2, palette,
      traits: { 1: 'blue', 2: 'yellow', 3: 'red' }, rows: ['01', '23'] },
    { id: 't2', title: '시험 2', artist: '시험', year: 2, tier: 2, palette, rows: ['00', '11'] },
    { id: 't3', title: '시험 3', artist: '시험', year: 3, tier: 4, palette,
      rows: ['0000', '0110', '0110', '0000'] },
  ];
}

module.exports = { testConfig, testPictures };
