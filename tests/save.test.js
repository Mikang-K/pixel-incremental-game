'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../js/game.js');
const Save = require('../js/save.js');
const { testConfig, testRegions } = require('./fixtures.js');

const unpack = (text) => JSON.parse(decodeURIComponent(atob(text)));
const pack = (o) => btoa(encodeURIComponent(JSON.stringify(o)));

test('저장했다 불러오면 칠한 픽셀과 포인트와 강화가 같다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.paint(1, 1); g.paint(2, 1); g.state.points = 42; g.state.upgrades.handSpeed = 2; g.state.time = 7;
  const back = Save.deserialize(Save.serialize(g), testConfig());
  assert.equal(back.points, 42);
  assert.equal(back.time, 7);
  assert.equal(back.fairiesUnlocked, false);
  assert.deepEqual(back.upgrades, { handSpeed: 2 });
  assert.deepEqual([...back.painted], [...g.painted]);
  const h = Game.create(testConfig(), testRegions(), back);
  assert.equal(h.state.paintedCount, 2);
  assert.equal(h.regions.reduce((a, r) => a + r.painted, 0), 2);
});
test('맨 앞 픽셀부터 칠해져 있어도 저장했다 불러올 수 있다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.paint(0, 0);
  assert.deepEqual([...Save.deserialize(Save.serialize(g), testConfig()).painted], [...g.painted]);
});
test('요정이 열린 상태가 저장된다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.state.fairiesUnlocked = true;
  assert.equal(Save.deserialize(Save.serialize(g), testConfig()).fairiesUnlocked, true);
});
test('칠한 곳이 뭉쳐 있으면 저장 문자열이 짧다', () => {
  const config = testConfig(); config.painting = { width: 1280, height: 1014 };
  const g = Game.create(config, testRegions());
  for (let i = 0; i < 400000; i++) g.painted[i] = 1;
  assert.ok(Save.serialize(g).length < 2000);
  assert.equal(Save.deserialize(Save.serialize(g), config).painted.reduce((a, b) => a + b, 0), 400000);
});
test('깨지거나 다른 게임의 문자열은 null', () => {
  for (const t of ['', 'abc', null, 42, undefined, btoa('{"a":1}'), pack(null), pack([])])
    assert.equal(Save.deserialize(t, testConfig()), null);
});
test('해상도가 바뀐 설정에서는 예전 저장을 쓰지 않는다', () => {
  const g = Game.create(testConfig(), testRegions());
  const other = testConfig(); other.painting = { width: 12, height: 8 };
  assert.equal(Save.deserialize(Save.serialize(g), other), null);
});
test('값이 이상한 저장은 null', () => {
  const g = Game.create(testConfig(), testRegions());
  g.paint(3, 3);
  const cases = [
    (o) => { o.version = 1; }, (o) => { o.points = -1; }, (o) => { o.points = 'x'; }, (o) => { o.time = Infinity; },
    (o) => { o.upgrades = { 없는강화: 1 }; }, (o) => { o.upgrades = { brushSize: 9 }; }, (o) => { o.upgrades = { handSpeed: 1.5 }; },
    (o) => { o.upgrades = null; }, (o) => { o.fairiesUnlocked = 'yes'; },
    (o) => { o.painted = '1'; }, (o) => { o.painted = 'zz,1'; }, (o) => { o.painted = '1,0,79'; }, (o) => { o.painted = 5; },
  ];
  for (const breakIt of cases) {
    const o = unpack(Save.serialize(g)); breakIt(o);
    assert.equal(Save.deserialize(pack(o), testConfig()), null, JSON.stringify(o).slice(0, 80));
  }
});
test('저장소에 넣고 꺼낼 수 있고 저장소가 예외를 던져도 죽지 않는다', () => {
  const data = {};
  const ok = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  const g = Game.create(testConfig(), testRegions()); g.paint(0, 0);
  Save.store(ok, g, testConfig());
  assert.equal(Save.load(ok, testConfig()).painted[0], 1);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(Save.load(bad, testConfig()), null);
  Save.store(bad, g, testConfig());
});
