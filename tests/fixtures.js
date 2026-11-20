'use strict';
// 검사용 설정과 영역. js/config.js를 읽지 않는다: 균형 조정이 검사를 깨면 안 된다.

function testConfig() {
  return {
    painting: { width: 10, height: 8 },
    hand: { baseRate: 4, burstSeconds: 2 },
    points: { perPixel: 1 },
    fairies: { unlockAtPainted: 5, baseRate: 2 },
    upgrades: {
      handSpeed: { baseCost: 10, costGrowth: 1.6, add: 1 },
      pointsPerPixel: { baseCost: 50, costGrowth: 1.9, multiplier: 1.5 },
      brushSize: { baseCost: 2000, costGrowth: 40, maxLevel: 2 },
      fairyHire: { baseCost: 300, costGrowth: 1.18 },
      fairySpeed: { baseCost: 1500, costGrowth: 2.2, multiplier: 1.4 },
    },
    regions: { firstTouchBonus: 25, completeBonusPerPixel: 0.2 },
    frame: { maxGapSeconds: 5 },
    save: { intervalSeconds: 10, storageKey: 'starryNightSave' },
    ui: { maxPixelSize: 24, maxFairyDots: 40 },
  };
}

function testRegions() {
  return [
    { id: 'dot', name: '점', effect: 'twinkle', shapes: [{ circle: [0.25, 0.25, 0.1] }] },
    { id: 'box', name: '상자', effect: 'none', shapes: [{ poly: [[0.6, 0.5], [1, 0.5], [1, 1], [0.6, 1]] }] },
    { id: 'rest', name: '나머지', effect: 'ripple', rest: true },
  ];
}

module.exports = { testConfig, testRegions };
