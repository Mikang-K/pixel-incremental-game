'use strict';
// 화면 없이 게임을 끝까지 돌려 단계별 소요 시간을 본다. js/config.js를 조정할 때 쓴다.
// 사용: node tools/simulate.js [초당 클릭 수=3]
const CONFIG = require('../js/config.js');
const PICTURES = require('../js/pictures.js');
const Game = require('../js/game.js');

// 설계 문서 5장의 목표. 단계별 [최소, 최대] 분.
const TIER_MINUTES = [[15, 30], [30, 55], [50, 90]];
const TOTAL_MIN_MINUTES = 120;
const MAX_IDLE_GAP_SECONDS = 180; // 구매도 그림 완성도 없이 기다리기만 하는 구간의 한도
const GIVE_UP_SECONDS = 24 * 3600;

const clicksPerSecond = Number(process.argv[2] || 3);
const g = Game.create(CONFIG, PICTURES);
const firstType = Object.keys(CONFIG.fairies)[0];

// 살 수 있는 것 중 가장 싼 것을 산다. 산 것이 있으면 true.
function buyCheapest(options) {
  let bought = false;
  for (;;) {
    const open = options.filter((o) => !o.done()).sort((a, b) => a.cost() - b.cost())[0];
    if (!open || !open.buy()) return bought;
    bought = true;
  }
}
const maxed = (config, level) => level >= (config.maxLevel || Infinity);
const shop = [
  ...Object.keys(CONFIG.fairies).map((t) => ({ cost: () => g.fairyCost(t), buy: () => g.buyFairy(t), done: () => false })),
  ...Object.keys(CONFIG.upgrades).map((id) => ({
    cost: () => g.upgradeCost(id), buy: () => g.buyUpgrade(id), done: () => maxed(CONFIG.upgrades[id], g.state.upgrades[id] || 0),
  })),
];
const eyeShop = Object.keys(CONFIG.eyeUpgrades).map((id) => ({
  cost: () => g.eyeUpgradeCost(id), buy: () => g.buyEyeUpgrade(id), done: () => maxed(CONFIG.eyeUpgrades[id], g.state.eyeUpgrades[id] || 0),
}));

let t = 0, lastEvent = 0, longestGap = 0, gapAt = 0, tierStart = 0;
const tierSeconds = [];
while (!g.state.finished && t < GIVE_UP_SECONDS) {
  for (let i = 0; i < clicksPerSecond; i++) {
    const pic = g.picture();
    const cell = pic && g.targets(firstType)[0];
    if (cell === undefined || cell === null) break;
    g.click(cell % pic.tier, Math.floor(cell / pic.tier));
  }
  const gallery = g.state.gallery.length;
  g.tick(1);
  t++;
  let event = g.state.gallery.length !== gallery;
  if (buyCheapest(shop)) event = true;
  if (g.canPrestige()) {
    tierSeconds.push(t - tierStart);
    tierStart = t;
    g.prestige();
    buyCheapest(eyeShop);
    event = true;
  }
  if (event) {
    if (t - lastEvent > longestGap) { longestGap = t - lastEvent; gapAt = t; }
    lastEvent = t;
  }
}
if (g.state.finished) tierSeconds.push(t - tierStart);

const problems = [];
const minutes = (s) => (s / 60).toFixed(1);
console.log(`초당 클릭 ${clicksPerSecond}회`);
tierSeconds.forEach((s, i) => {
  const range = TIER_MINUTES[i];
  const ok = !range || (s / 60 >= range[0] && s / 60 <= range[1]);
  console.log(`  ${i + 1}단계: ${minutes(s)}분${range ? ` (목표 ${range[0]}에서 ${range[1]}분)` : ''}${ok ? '' : '  <- 범위 밖'}`);
  if (!ok) problems.push(`${i + 1}단계`);
});
console.log(`  합계: ${minutes(t)}분 (목표 ${TOTAL_MIN_MINUTES}분 이상)`);
console.log(`  가장 긴 빈 구간: ${longestGap}초, ${minutes(gapAt)}분 무렵 (한도 ${MAX_IDLE_GAP_SECONDS}초)`);
if (!g.state.finished) problems.push('24시간 안에 끝나지 않음');
if (t / 60 < TOTAL_MIN_MINUTES) problems.push('합계');
if (longestGap > MAX_IDLE_GAP_SECONDS) problems.push('빈 구간');
if (problems.length) { console.log(`실패: ${problems.join(', ')}`); process.exitCode = 1; } else console.log('통과');
