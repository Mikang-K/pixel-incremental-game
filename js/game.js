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
      const pic = pics[state.pictureIndex];
      const trait = (pic.traits || {})[parseInt(pic.rows[Math.floor(i / pic.tier)][i % pic.tier], 16)];
      let drops = cell.dropsBase * cell.dropsGrowth ** state.pictureIndex * dropsMultiplier();
      if (trait === 'yellow' && level('ruleYellow')) drops *= config.rules.yellow.dropsMultiplier;
      state.drops += drops;
      if (trait === 'red' && level('ruleRed')) state.heatUntil = state.time + config.rules.red.heatSeconds;
      if (trait === 'blue' && level('ruleBlue')) {
        const x = i % pic.tier, y = Math.floor(i / pic.tier);
        const bleed = cellRequired() * config.rules.blue.bleedFraction;
        if (y > 0) addWork(i - pic.tier, bleed);
        if (y < pic.tier - 1) addWork(i + pic.tier, bleed);
        if (x > 0) addWork(i - 1, bleed);
        if (x < pic.tier - 1) addWork(i + 1, bleed);
      }
    }

    const TYPES = Object.keys(config.fairies);

    function spend(cost) {
      if (state.drops < cost) return false;
      state.drops -= cost;
      return true;
    }

    const fairyCost = (type) => config.fairies[type].baseCost * config.fairies[type].costGrowth ** state.fairies[type];

    function buyFairy(type) {
      if (!config.fairies[type] || !spend(fairyCost(type))) return false;
      state.fairies[type]++;
      return true;
    }

    const upgradeCost = (id) => config.upgrades[id].baseCost * config.upgrades[id].costGrowth ** level(id);

    function buyUpgrade(id) {
      const upgrade = config.upgrades[id];
      if (!upgrade || level(id) >= (upgrade.maxLevel || Infinity) || !spend(upgradeCost(id))) return false;
      state.upgrades[id] = level(id) + 1;
      return true;
    }

    function workPerSecond(type) {
      if (!type) return TYPES.reduce((sum, t) => sum + workPerSecond(t), 0);
      const heat = state.time < state.heatUntil ? config.rules.red.heatMultiplier : 1;
      return state.fairies[type] * config.fairies[type].workPerSecond
        * config.upgrades[type + 'Speed'].multiplier ** level(type + 'Speed') * heat
        * config.eyeUpgrades.globalSpeed.multiplier ** eyeLevel('globalSpeed');
    }

    const eyeLevel = (id) => state.eyeUpgrades[id] || 0;
    const eyeUpgradeCost = (id) => config.eyeUpgrades[id].baseCost * config.eyeUpgrades[id].costGrowth ** eyeLevel(id);

    function buyEyeUpgrade(id) {
      const upgrade = config.eyeUpgrades[id];
      if (!upgrade || eyeLevel(id) >= (upgrade.maxLevel || Infinity)) return false;
      const cost = eyeUpgradeCost(id);
      if (state.eyes < cost) return false;
      state.eyes -= cost;
      state.eyeUpgrades[id] = eyeLevel(id) + 1;
      return true;
    }

    const offlineEfficiency = () => Math.min(1,
      config.offline.baseEfficiency + config.eyeUpgrades.offlineEfficiency.addPerLevel * eyeLevel('offlineEfficiency'));

    const canPrestige = () => state.awaitingPrestige && !state.finished;

    function prestige() {
      if (!canPrestige()) return false;
      const tiers = [...new Set(pics.map((p) => p.tier))];
      state.eyes += config.prestige.eyesBase * (tiers.indexOf(pics[state.pictureIndex].tier) + 1);
      state.drops = 0;
      state.upgrades = {};
      state.heatUntil = 0;
      for (const type of TYPES) state.fairies[type] = 0;
      state.fairies.brush = config.eyeUpgrades.startFairies.brushPerLevel * eyeLevel('startFairies');
      state.pictureIndex++;
      state.work = zeros(pics[state.pictureIndex]);
      state.awaitingPrestige = false;
      return true;
    }

    function autoBuy() {
      if (!eyeLevel('autoBuy')) return;
      const cheapest = TYPES.reduce((a, b) => (fairyCost(a) <= fairyCost(b) ? a : b));
      buyFairy(cheapest);
    }

    // 그 요정 종류가 지금 칠하는 칸: 안 끝난 칸을 번호순으로 spread개.
    function targets(type) {
      const found = [];
      const spread = config.fairies[type].spread;
      for (let i = 0; i < state.work.length && found.length < spread; i++) if (!isCellDone(i)) found.push(i);
      return found;
    }

    function tick(dt) {
      if (!(dt > 0)) return;
      while (dt > EPS) {
        if (!picture()) { state.time += dt; return; }
        const step = Math.min(dt, config.tick.maxStepSeconds);
        dt -= step;
        autoBuy();
        for (const type of TYPES) {
          let pool = workPerSecond(type) * step;
          while (pool > EPS && picture()) {
            const cells = targets(type);
            const share = pool / cells.length;
            pool = 0;
            // 도중에 그림이 바뀌거나 칸이 먼저 차면 addWork가 남은 양을 돌려준다
            for (const i of cells) pool += picture() ? addWork(i, share) : share;
          }
        }
        state.time += step;
      }
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

    return {
      state, picture, cellRequired, isCellDone, click, progress, dropsMultiplier,
      fairyCost, buyFairy, upgradeCost, buyUpgrade, workPerSecond, targets, tick,
      eyeUpgradeCost, buyEyeUpgrade, offlineEfficiency, canPrestige, prestige,
    };
  }

  return { create, formatNumber };
})();

if (typeof module !== 'undefined') module.exports = Game;
