'use strict';
// 모든 균형 숫자와 해상도는 여기에만 둔다. tools/simulate.js로 결과를 보며 조정한다.
const CONFIG = {
  // 원작 비율 약 5:4. 바꾸면 tools/build-painting.ps1로 그림을 다시 만든다.
  painting: { width: 1280, height: 1014 },
  hand: { baseRate: 2, burstSeconds: 2 }, // 손으로 찍는 초당 한도, 쌓아 둘 수 있는 초
  points: { perPixel: 1 },
  fairies: { unlockAtPainted: 27000, baseRate: 0.03 }, // 열리는 칠한 픽셀 수, 한 마리의 초당 픽셀
  // 강화 하나하나의 효과를 작게, 값은 완만하게: 며칠짜리 진행에서도 몇 분마다 살 것이 생기게 한다.
  upgrades: {
    handSpeed: { baseCost: 20, costGrowth: 1.235, add: 0.5 },
    pointsPerPixel: { baseCost: 500, costGrowth: 6, multiplier: 1.25 },
    brushSize: { baseCost: 1500, costGrowth: 20, maxLevel: 2 }, // 1, 2x2, 3x3
    fairyHire: { baseCost: 100, costGrowth: 1.007 },
    fairySpeed: { baseCost: 6000, costGrowth: 1.3, multiplier: 1.08 },
  },
  regions: { firstTouchBonus: 25, completeBonusPerPixel: 0.2 },
  frame: { maxGapSeconds: 5 }, // 이보다 긴 프레임 간격(절전 등)은 진행에 넣지 않는다
  save: { intervalSeconds: 10, storageKey: 'starryNightSave' },
  ui: {
    maxPixelSize: 24, maxFairyDots: 40,
    keyboardPanSpeed: 600, keyboardFastMultiplier: 2,
    keyboardZoomPerSecond: 2, keyboardMaxFrameSeconds: 0.05,
  },
};

if (typeof module !== 'undefined') module.exports = CONFIG;
