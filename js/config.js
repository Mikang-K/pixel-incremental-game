'use strict';
// 모든 균형 숫자와 해상도는 여기에만 둔다. tools/simulate.js로 결과를 보며 조정한다.
const CONFIG = {
  // 원작 비율 약 5:4. 바꾸면 tools/build-painting.ps1로 그림을 다시 만든다.
  painting: { width: 1280, height: 1014 },
  hand: { baseRate: 3, burstSeconds: 2 }, // 손으로 찍는 초당 한도, 쌓아 둘 수 있는 초
  points: { perPixel: 1 },
  fairies: { unlockAtPainted: 15000, baseRate: 2 }, // 열리는 칠한 픽셀 수, 한 마리의 초당 픽셀
  upgrades: {
    handSpeed: { baseCost: 10, costGrowth: 1.6, add: 1 },
    pointsPerPixel: { baseCost: 50, costGrowth: 1.9, multiplier: 1.5 },
    brushSize: { baseCost: 2000, costGrowth: 40, maxLevel: 2 }, // 1, 2x2, 3x3
    fairyHire: { baseCost: 300, costGrowth: 1.18 },
    fairySpeed: { baseCost: 1500, costGrowth: 2.2, multiplier: 1.4 },
  },
  regions: { firstTouchBonus: 25, completeBonusPerPixel: 0.2 },
  frame: { maxGapSeconds: 5 }, // 이보다 긴 프레임 간격(절전 등)은 진행에 넣지 않는다
  save: { intervalSeconds: 10, storageKey: 'starryNightSave' },
  ui: { maxPixelSize: 24, maxFairyDots: 40 },
};

if (typeof module !== 'undefined') module.exports = CONFIG;
