'use strict';
// 화면 없이 게임을 끝까지 돌려 속도를 본다. js/config.js의 숫자를 조정할 때 쓴다.
// 사용: node tools/simulate.js
// 기준 플레이어(설계 문서 5장): 요정이 손보다 느린 동안은 매초 50% 확률로, 그 뒤에는 10% 확률로
// 그 초에 손 예산만큼 칠한다. 칠할 자리는 시작했지만 덜 채운 영역 중 가장 작은 곳(없으면 가장 작은 새 영역).
// 매초 살 수 있는 가장 싼 강화를 산다.
const CONFIG = require('../js/config.js');
const REGIONS = require('../js/regions.js');
const Game = require('../js/game.js');

// 통과 기준 (설계 문서 5장과 계획 Task 8)
const LIMITS = {
  firstPurchase: [0, 60], // 초
  firstRegion: [0, 600], // 초
  unlock: [45 * 60, 90 * 60], // 초
  progressAt1h: [0, 0.1], // 비율
  crossoverShare: [0.15, 0.5], // 전체 시간 중 요정이 손보다 빨라지는 시점(중간보다 늦으면 손 노동이 너무 길다)
  total: [15 * 3600, 25 * 3600], // 초
  longestGap: [0, 300], // 구매나 영역 완성 사이 최장 대기(초)
};
const GIVE_UP = 60 * 3600;

function run(config = CONFIG, { seed = 7, giveUp = GIVE_UP } = {}) {
  const g = Game.create({ ...config, seed }, REGIONS);
  let rng = seed >>> 0;
  const rand = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };

  // 영역마다 픽셀 목록과 다음에 볼 위치
  const pixels = g.regions.map(() => []);
  for (let i = 0; i < g.total; i++) pixels[g.regionIndex[i]].push(i);
  const cursor = g.regions.map(() => 0);
  const bySize = g.regions.map((_, r) => r).sort((a, b) => g.regions[a].size - g.regions[b].size);
  function nextHandPixel() {
    const started = bySize.find((r) => g.regions[r].painted > 0 && g.regions[r].painted < g.regions[r].size);
    const r = started !== undefined ? started : bySize.find((r) => g.regions[r].painted === 0);
    if (r === undefined) return -1;
    while (cursor[r] < pixels[r].length && g.painted[pixels[r][cursor[r]]]) cursor[r]++;
    return cursor[r] < pixels[r].length ? pixels[r][cursor[r]] : -1;
  }

  const ids = Object.keys(config.upgrades);
  const out = { firstPurchase: null, firstRegion: null, unlock: null, crossover: null, progressAt1h: null, longestGap: 0, gapAt: 0 };
  let t = 0, lastEvent = 0;
  const event = () => {
    if (t - lastEvent > out.longestGap) { out.longestGap = t - lastEvent; out.gapAt = t; }
    lastEvent = t;
  };

  while (g.state.paintedCount < g.total && t < giveUp) {
    const fairyAhead = g.fairyRate() > g.handRate();
    if (fairyAhead && out.crossover === null) out.crossover = t;
    if (rand() < (fairyAhead ? 0.1 : 0.5)) {
      while (g.handBudget() >= 1) {
        const i = nextHandPixel();
        if (i < 0 || !g.paint(i % g.width, Math.floor(i / g.width))) break;
      }
    }
    g.tick(1);
    t++;
    for (const e of g.drainEvents()) {
      if (e.type === 'regionCompleted') { if (out.firstRegion === null) out.firstRegion = t; event(); }
      if (e.type === 'fairiesUnlocked') out.unlock = t;
    }
    g.drainPainted(); g.drainFairyPainted();
    for (;;) {
      const open = ids.filter((id) => g.canBuy(id)).sort((a, b) => g.cost(a) - g.cost(b))[0];
      if (!open) break;
      g.buy(open);
      if (out.firstPurchase === null) out.firstPurchase = t;
      event();
    }
    if (t === 3600) out.progressAt1h = g.state.paintedCount / g.total;
  }
  out.finished = g.state.paintedCount === g.total;
  out.total = t;
  out.crossoverShare = out.crossover === null ? null : out.crossover / t;
  out.levels = { ...g.state.upgrades };
  return out;
}

function check(r) {
  return Object.entries(LIMITS).map(([key, [lo, hi]]) => {
    const v = r[key];
    return { key, value: v, ok: v !== null && v !== undefined && v >= lo && v <= hi, lo, hi };
  });
}

function report() {
  const r = run();
  const show = (key, v) => {
    if (v === null || v === undefined) return '없음';
    if (key === 'progressAt1h' || key === 'crossoverShare') return `${(v * 100).toFixed(1)}%`;
    return v >= 3600 ? `${(v / 3600).toFixed(2)}시간` : v >= 60 ? `${(v / 60).toFixed(1)}분` : `${v}초`;
  };
  const names = {
    firstPurchase: '첫 구매', firstRegion: '첫 영역 완성', unlock: '요정 열림', progressAt1h: '1시간 진행률',
    crossoverShare: '요정이 손을 앞서는 시점', total: '완성까지', longestGap: '최장 대기',
  };
  const results = check(r);
  for (const c of results) {
    console.log(`${c.ok ? '  ' : '✗ '}${names[c.key]}: ${show(c.key, c.value)} (기준 ${show(c.key, c.lo)}에서 ${show(c.key, c.hi)})`);
  }
  console.log(`  최장 대기 위치: ${show('t', r.gapAt)} 무렵, 끝난 강화 단계: ${JSON.stringify(r.levels)}`);
  const failed = results.filter((c) => !c.ok);
  if (!r.finished) console.log(`✗ ${GIVE_UP / 3600}시간 안에 끝나지 않음`);
  if (failed.length || !r.finished) { console.log('실패'); process.exitCode = 1; } else console.log('통과');
}

if (require.main === module) report();
module.exports = { run, check, LIMITS };
