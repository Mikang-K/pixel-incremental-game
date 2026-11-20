'use strict';
// 저장과 불러오기. 저장 문자열은 밖에서 들어오는 값이므로 불러올 때 전부 확인한다.
const Save = (function () {
  const VERSION = 2;
  const isNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

  // 칠한 픽셀을 구간 길이로 줄인다. 칠하지 않은 구간부터 시작하고(첫 값이 0이면 칠한 구간부터) 36진수로 쉼표로 잇는다.
  function encodeRuns(painted) {
    const runs = [];
    let current = 0, length = 0;
    for (let i = 0; i < painted.length; i++) {
      if (painted[i] === current) { length++; continue; }
      runs.push(length.toString(36));
      current = painted[i];
      length = 1;
    }
    runs.push(length.toString(36));
    return runs.join(',');
  }

  function decodeRuns(text, total) {
    if (typeof text !== 'string' || !/^[0-9a-z]+(,[0-9a-z]+)*$/.test(text)) return null;
    const runs = text.split(',').map((r) => parseInt(r, 36));
    if (runs.some((r, k) => !Number.isSafeInteger(r) || (r === 0 && k > 0))) return null;
    if (runs.reduce((a, b) => a + b, 0) !== total) return null;
    const painted = new Uint8Array(total);
    let at = 0;
    runs.forEach((length, k) => { if (k % 2) painted.fill(1, at, at + length); at += length; });
    return painted;
  }

  function serialize(g) {
    const s = g.state;
    return btoa(encodeURIComponent(JSON.stringify({
      version: VERSION, width: g.width, height: g.height, points: s.points, upgrades: s.upgrades,
      time: s.time, fairiesUnlocked: s.fairiesUnlocked, painted: encodeRuns(g.painted),
    })));
  }

  function validUpgrades(upgrades, config) {
    if (!upgrades || typeof upgrades !== 'object' || Array.isArray(upgrades)) return false;
    return Object.entries(upgrades).every(([id, level]) => {
      const upgrade = config.upgrades[id];
      return upgrade && Number.isInteger(level) && level >= 0 && level <= (upgrade.maxLevel ?? Infinity);
    });
  }

  function deserialize(text, config) {
    let s;
    try { s = JSON.parse(decodeURIComponent(atob(text))); } catch (e) { return null; }
    if (!s || typeof s !== 'object' || s.version !== VERSION) return null;
    const { width, height } = config.painting;
    if (s.width !== width || s.height !== height) return null;
    if (!isNumber(s.points) || !isNumber(s.time) || typeof s.fairiesUnlocked !== 'boolean') return null;
    if (!validUpgrades(s.upgrades, config)) return null;
    const painted = decodeRuns(s.painted, width * height);
    if (!painted) return null;
    return { points: s.points, upgrades: s.upgrades, time: s.time, fairiesUnlocked: s.fairiesUnlocked, painted };
  }

  function load(storage, config) {
    try { return deserialize(storage.getItem(config.save.storageKey), config); } catch (e) { return null; }
  }

  function store(storage, g, config) {
    // 저장 공간이 막혀 있어도(사생활 보호 모드 등) 게임은 계속 돈다
    try { storage.setItem(config.save.storageKey, serialize(g)); } catch (e) { /* 무시 */ }
  }

  return { serialize, deserialize, load, store };
})();

if (typeof module !== 'undefined') module.exports = Save;
