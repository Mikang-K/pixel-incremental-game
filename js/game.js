'use strict';
// 게임 규칙. 화면을 모른다. 브라우저(전역 Game)와 Node(require) 양쪽에서 돈다.
const Game = (function () {
  const EPS = 1e-9;
  const UNITS = [[1e12, '조'], [1e8, '억'], [1e4, '만'], [1e3, '천']];

  function formatNumber(n) {
    for (const [value, unit] of UNITS) if (n >= value) return (n / value).toFixed(1) + unit;
    return String(Math.floor(n));
  }

  function create(config, pictures, savedState) {
    const pics = pictures.slice().sort((a, b) => a.tier - b.tier);
    const zeros = (pic) => new Array(pic.tier * pic.tier).fill(0);
    const state = savedState || {
      version: 1, drops: 0, pictureIndex: 0, work: zeros(pics[0]),
      fairies: { brush: 0, roller: 0, spray: 0 }, upgrades: {}, gallery: [],
      eyes: 0, eyeUpgrades: {}, heatUntil: 0, time: 0,
      awaitingPrestige: false, finished: false, lastSeen: 0,
    };
    let depth = 0; // 번짐으로 칸 완성이 이어지는 동안에는 그림 완성 판정을 미룬다

    const level = (id) => state.upgrades[id] || 0;
    const picture = () => (state.awaitingPrestige || state.finished ? null : pics[state.pictureIndex]);
    const cellRequired = () => config.cell.workBase * config.cell.workGrowth ** state.pictureIndex;
    const isCellDone = (i) => state.work[i] >= cellRequired() - EPS;

    function dropsMultiplier() {
      return (1 + config.gallery.bonusPerPicture * state.gallery.length)
        * config.upgrades.cellDrops.multiplier ** level('cellDrops');
    }

    function progress() {
      let done = 0;
      for (let i = 0; i < state.work.length; i++) if (isCellDone(i)) done++;
      return { done, total: state.work.length };
    }

    function finishPicture() {
      const pic = pics[state.pictureIndex];
      state.gallery.push(pic.id);
      const next = pics[state.pictureIndex + 1];
      if (!next) { state.finished = true; state.work = []; }
      else if (next.tier !== pic.tier) { state.awaitingPrestige = true; state.work = []; }
      else { state.pictureIndex++; state.work = zeros(next); }
    }

    function completeCell(i) {
      const cell = config.cell;
      state.drops += cell.dropsBase * cell.dropsGrowth ** state.pictureIndex * dropsMultiplier();
    }

    // 칸에 작업량을 더하고 남은 양을 돌려준다.
    function addWork(i, amount) {
      if (isCellDone(i)) return amount;
      const required = cellRequired();
      const need = required - state.work[i];
      if (amount < need - EPS) { state.work[i] += amount; return 0; }
      state.work[i] = required;
      depth++;
      completeCell(i);
      depth--;
      if (depth === 0 && progress().done === state.work.length) finishPicture();
      return amount - need;
    }

    function click(x, y) {
      const pic = picture();
      if (!pic || !Number.isInteger(x) || !Number.isInteger(y)) return false;
      if (x < 0 || y < 0 || x >= pic.tier || y >= pic.tier) return false;
      const i = y * pic.tier + x;
      if (isCellDone(i)) return false;
      addWork(i, config.click.basePower * config.upgrades.clickPower.multiplier ** level('clickPower'));
      return true;
    }

    return { state, picture, cellRequired, isCellDone, click, progress, dropsMultiplier };
  }

  return { create, formatNumber };
})();

if (typeof module !== 'undefined') module.exports = Game;
