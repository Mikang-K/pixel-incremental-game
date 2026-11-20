'use strict';
// 저장, 불러오기, 오프라인 진행. 저장 문자열은 밖에서 들어오는 값이므로 불러올 때 전부 확인한다.
const Save = (function () {
  const VERSION = 1;
  const isNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const isCounts = (o, keys) => o && typeof o === 'object'
    && (keys || Object.keys(o)).every((k) => Number.isInteger(o[k]) && o[k] >= 0);

  // btoa는 한글을 못 받는다. 나중에 들어올 그림 id가 한글이어도 저장되도록 한 번 감싼다.
  const serialize = (state) => btoa(encodeURIComponent(JSON.stringify(state)));

  function deserialize(text, pictures) {
    let s;
    try { s = JSON.parse(decodeURIComponent(atob(text))); } catch (e) { return null; }
    if (!s || typeof s !== 'object' || s.version !== VERSION) return null;
    const pics = pictures.slice().sort((a, b) => a.tier - b.tier);
    const pic = pics[s.pictureIndex];
    const ids = new Set(pics.map((p) => p.id));
    const ok = Number.isInteger(s.pictureIndex) && pic
      && ['drops', 'eyes', 'time', 'heatUntil', 'lastSeen'].every((k) => isNumber(s[k]))
      && isCounts(s.fairies, ['brush', 'roller', 'spray']) && isCounts(s.upgrades) && isCounts(s.eyeUpgrades)
      && Array.isArray(s.gallery) && s.gallery.every((id) => ids.has(id))
      && typeof s.awaitingPrestige === 'boolean' && typeof s.finished === 'boolean'
      && Array.isArray(s.work) && s.work.every(isNumber)
      && s.work.length === (s.awaitingPrestige || s.finished ? 0 : pic.tier * pic.tier);
    return ok ? s : null;
  }

  function applyOffline(g, nowMs, config) {
    if (!g.state.lastSeen) return { seconds: 0, cells: 0, pictures: 0 };
    const seconds = Math.max(0, Math.min(config.offline.maxSeconds, (nowMs - g.state.lastSeen) / 1000));
    const cells = g.paintedCells();
    const pictures = g.state.gallery.length;
    g.tick(seconds * g.offlineEfficiency());
    return { seconds, cells: g.paintedCells() - cells, pictures: g.state.gallery.length - pictures };
  }

  function load(storage, config, pictures) {
    try { return deserialize(storage.getItem(config.save.storageKey), pictures); } catch (e) { return null; }
  }

  function store(storage, state, nowMs, config) {
    state.lastSeen = nowMs;
    // 저장 공간이 막혀 있어도(사생활 보호 모드 등) 게임은 계속 돈다
    try { storage.setItem(config.save.storageKey, serialize(state)); } catch (e) { /* 무시 */ }
  }

  return { serialize, deserialize, applyOffline, load, store };
})();

if (typeof module !== 'undefined') module.exports = Save;
