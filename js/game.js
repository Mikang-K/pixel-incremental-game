'use strict';
// 게임 규칙. 화면을 모른다. 브라우저(전역 Game)와 Node(require) 양쪽에서 돈다.
const Game = (function () {
  // 도형을 픽셀 좌표의 판정 함수와 경계 상자로 바꾼다.
  function compileShape(shape, width, height) {
    if (shape.circle || shape.ellipse) {
      const [cx, cy, rx, ryRaw] = shape.circle ? [...shape.circle, shape.circle[2]] : shape.ellipse;
      const px = cx * width, py = cy * height, rxp = rx * width, ryp = ryRaw * width; // 반지름은 둘 다 가로 기준
      return {
        box: [px - rxp, py - ryp, px + rxp, py + ryp],
        hit: (x, y) => ((x - px) / rxp) ** 2 + ((y - py) / ryp) ** 2 <= 1,
      };
    }
    const pts = shape.poly.map(([x, y]) => [x * width, y * height]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return {
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      hit: (x, y) => { // 짝홀 규칙
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      },
    };
  }

  function rasterizeRegions(regions, width, height) {
    const UNSET = 255;
    const index = new Uint8Array(width * height).fill(UNSET);
    const sizes = new Array(regions.length).fill(0);
    const rest = regions.findIndex((r) => r.rest);
    regions.forEach((region, r) => {
      for (const shape of region.shapes || []) {
        const { box, hit } = compileShape(shape, width, height);
        const x0 = Math.max(0, Math.floor(box[0])), y0 = Math.max(0, Math.floor(box[1]));
        const x1 = Math.min(width - 1, Math.ceil(box[2])), y1 = Math.min(height - 1, Math.ceil(box[3]));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const i = y * width + x;
            if (index[i] === UNSET && hit(x + 0.5, y + 0.5)) { index[i] = r; sizes[r]++; }
          }
        }
      }
    });
    for (let i = 0; i < index.length; i++) if (index[i] === UNSET) { index[i] = rest; sizes[rest]++; }
    return { index, sizes };
  }

  // 검사와 시뮬레이션이 같은 결과를 내도록 씨앗을 받는 작은 의사 난수.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(config, regionList, saved) {
    const width = config.painting.width, height = config.painting.height, total = width * height;
    const { index: regionIndex, sizes } = rasterizeRegions(regionList, width, height);
    const regions = regionList.map((r, i) => ({ id: r.id, name: r.name, effect: r.effect, size: sizes[i], painted: 0 }));
    const painted = new Uint8Array(total);
    const state = {
      points: saved ? saved.points : 0,
      upgrades: saved ? { ...saved.upgrades } : {},
      time: saved ? saved.time : 0,
      paintedCount: 0,
      fairiesUnlocked: saved ? saved.fairiesUnlocked : false,
    };
    let paintedLog = [];
    let fairyLog = [];
    let events = [];
    let fairyWork = 0;
    const rand = mulberry32(config.seed ?? Math.floor(Math.random() * 2 ** 32));

    // 요정이 번져 나갈 자리: 안 칠한 픽셀 중 칠한 픽셀과 상하좌우로 맞닿은 것.
    // 칠해졌거나 중복된 항목은 꺼낼 때 버린다.
    const frontier = [];
    const inFrontier = new Uint8Array(total);
    function addNeighbors(i) {
      const x = i % width;
      if (x > 0) addFrontier(i - 1);
      if (x < width - 1) addFrontier(i + 1);
      if (i >= width) addFrontier(i - width);
      if (i < total - width) addFrontier(i + width);
    }
    function addFrontier(i) {
      if (!painted[i] && !inFrontier[i]) { inFrontier[i] = 1; frontier.push(i); }
    }

    if (saved) {
      painted.set(saved.painted);
      for (let i = 0; i < total; i++) if (painted[i]) { state.paintedCount++; regions[regionIndex[i]].painted++; }
      for (let i = 0; i < total; i++) if (painted[i]) addNeighbors(i);
    }
    if (state.paintedCount >= config.fairies.unlockAtPainted) state.fairiesUnlocked = true;

    const level = (id) => state.upgrades[id] || 0;
    const handRate = () => config.hand.baseRate + config.upgrades.handSpeed.add * level('handSpeed');
    const handMax = () => handRate() * config.hand.burstSeconds;
    let budget = handMax();
    const handBudget = () => budget;
    const pointsPerPixel = () => config.points.perPixel * config.upgrades.pointsPerPixel.multiplier ** level('pointsPerPixel');
    const brushSize = () => 1 + level('brushSize');

    // 픽셀 하나를 칠하는 일은 전부 여기를 지난다(손이든 요정이든).
    function paintPixel(i) {
      painted[i] = 1;
      state.paintedCount++;
      state.points += pointsPerPixel();
      paintedLog.push(i);
      addNeighbors(i);
      const r = regionIndex[i], region = regions[r];
      region.painted++;
      if (region.painted === 1) {
        state.points += config.regions.firstTouchBonus;
        events.push({ type: 'regionStarted', region: r });
      }
      if (region.painted === region.size) {
        state.points += region.size * config.regions.completeBonusPerPixel;
        events.push({ type: 'regionCompleted', region: r });
      }
      if (state.paintedCount === total) events.push({ type: 'finished' });
      if (!state.fairiesUnlocked && state.paintedCount >= config.fairies.unlockAtPainted) {
        state.fairiesUnlocked = true;
        events.push({ type: 'fairiesUnlocked' });
      }
    }

    const fairyCount = () => level('fairyHire');
    const fairyRate = () => fairyCount() * config.fairies.baseRate
      * config.upgrades.fairySpeed.multiplier ** level('fairySpeed');

    // 가장자리에서 무작위로 하나를 꺼낸다. 없으면 -1.
    function popFrontier() {
      while (frontier.length) {
        const k = Math.floor(rand() * frontier.length);
        const i = frontier[k];
        frontier[k] = frontier[frontier.length - 1];
        frontier.pop();
        inFrontier[i] = 0;
        if (!painted[i]) return i;
      }
      return -1;
    }
    // 시작된 영역일수록, 많이 찬 영역일수록 높다. 이미 시작된 영역을 조금 더 자주 채우게 한다.
    function score(i) {
      const region = regions[regionIndex[i]];
      return region.painted ? region.painted / region.size : -1;
    }
    function scanUnpainted() {
      if (state.paintedCount >= total) return -1;
      const start = Math.floor(rand() * total);
      for (let k = 0; k < total; k++) {
        const i = (start + k) % total;
        if (!painted[i]) return i;
      }
      return -1;
    }
    // 요정이 칠할 다음 픽셀: 가장자리 후보 둘 중 영역 점수가 높은 쪽.
    function nextFairyPixel() {
      const a = popFrontier();
      if (a < 0) return scanUnpainted();
      const b = popFrontier();
      if (b < 0) return a;
      const [keep, back] = score(b) > score(a) ? [b, a] : [a, b];
      addFrontier(back);
      return keep;
    }

    function paint(x, y) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return 0;
      const size = brushSize();
      let count = 0;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const px = x + dx, py = y + dy;
          if (px >= width || py >= height || budget < 1) continue;
          const i = py * width + px;
          if (painted[i]) continue;
          budget--;
          paintPixel(i);
          count++;
        }
      }
      return count;
    }

    function tick(dt) {
      if (!(dt > 0) || dt > config.frame.maxGapSeconds) return;
      state.time += dt;
      budget = Math.min(handMax(), budget + handRate() * dt);
      if (!state.fairiesUnlocked) return;
      fairyWork += fairyRate() * dt;
      while (fairyWork >= 1) {
        const i = nextFairyPixel();
        if (i < 0) { fairyWork = 0; break; }
        fairyWork--;
        paintPixel(i);
        fairyLog.push(i);
      }
      const max = config.ui.maxFairyDots;
      if (fairyLog.length > max) fairyLog = fairyLog.slice(-max);
    }

    const isLocked = (id) => !state.fairiesUnlocked && (id === 'fairyHire' || id === 'fairySpeed');
    const cost = (id) => config.upgrades[id].baseCost * config.upgrades[id].costGrowth ** level(id);
    function canBuy(id) {
      const upgrade = config.upgrades[id];
      return !!upgrade && !isLocked(id) && level(id) < (upgrade.maxLevel ?? Infinity) && state.points >= cost(id);
    }
    function buy(id) {
      if (!canBuy(id)) return false;
      state.points -= cost(id);
      state.upgrades[id] = level(id) + 1;
      return true;
    }

    const progress = () => ({ painted: state.paintedCount, total });
    const drainPainted = () => { const out = paintedLog; paintedLog = []; return out; };
    const drainEvents = () => { const out = events; events = []; return out; };
    const drainFairyPainted = () => { const out = fairyLog; fairyLog = []; return out; };
    const fairiesUnlocked = () => state.fairiesUnlocked;

    return {
      width, height, total, regions, regionIndex, painted, state,
      paint, tick, handRate, handBudget, pointsPerPixel, brushSize,
      level, cost, canBuy, buy, isLocked, progress, drainPainted, drainEvents,
      fairyCount, fairyRate, fairiesUnlocked, drainFairyPainted,
    };
  }

  return { rasterizeRegions, create };
})();

if (typeof module !== 'undefined') module.exports = Game;
