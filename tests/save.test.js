'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../js/game.js');
const Save = require('../js/save.js');
const { testConfig, testPictures } = require('./fixtures.js');

test('저장했다 불러오면 상태가 같다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.drops = 42; g.click(0, 0);
  const back = Save.deserialize(Save.serialize(g.state), testPictures());
  assert.deepEqual(back, g.state);
});
test('깨진 문자열은 null', () => {
  assert.equal(Save.deserialize('아무말', testPictures()), null);
  assert.equal(Save.deserialize('', testPictures()), null);
  assert.equal(Save.deserialize(null, testPictures()), null);
  assert.equal(Save.deserialize(Buffer.from('{"a":1}').toString('base64'), testPictures()), null);
  assert.equal(Save.deserialize(Buffer.from('null').toString('base64'), testPictures()), null);
});
test('버전이 다르면 null', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.version = 2;
  assert.equal(Save.deserialize(Save.serialize(g.state), testPictures()), null);
});
test('그림 목록과 맞지 않는 저장은 null', () => {
  const broken = [
    (s) => { s.pictureIndex = 99; },
    (s) => { s.gallery = ['없는그림']; },
    (s) => { s.work = [0]; },
    (s) => { s.drops = 'many'; },
    (s) => { delete s.fairies; },
  ];
  for (const breakIt of broken) {
    const g = Game.create(testConfig(), testPictures());
    breakIt(g.state);
    assert.equal(Save.deserialize(Save.serialize(g.state), testPictures()), null);
  }
});
test('프레스티지 대기 중인 상태도 저장했다 불러올 수 있다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.spray = 1000; g.tick(100);
  assert.equal(g.state.awaitingPrestige, true);
  assert.deepEqual(Save.deserialize(Save.serialize(g.state), testPictures()), g.state);
});
test('오프라인 진행은 효율을 곱해 반영한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2; g.state.lastSeen = 1000;
  const r = Save.applyOffline(g, 1000 + 4000, testConfig());
  assert.equal(r.seconds, 4);
  assert.equal(r.cells, 1);
  assert.deepEqual(g.state.work, [2, 0, 0, 0]);
});
test('오프라인 동안 그림을 넘어가도 칠한 칸 수를 센다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2; g.state.lastSeen = 1000;
  const r = Save.applyOffline(g, 1000 + 20000, testConfig());   // 20초, 효율 0.5, 작업량 10
  assert.equal(r.cells, 5);
  assert.equal(r.pictures, 1);
});
test('시계가 뒤로 가면 오프라인 진행은 0', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2; g.state.lastSeen = 5000;
  assert.equal(Save.applyOffline(g, 1000, testConfig()).seconds, 0);
  assert.deepEqual(g.state.work, [0, 0, 0, 0]);
});
test('오프라인 시간은 한도에서 잘린다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.lastSeen = 1;
  assert.equal(Save.applyOffline(g, 1e12, testConfig()).seconds, 28800);
});
test('저장한 적이 없으면 오프라인 진행이 없다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2;
  assert.deepEqual(Save.applyOffline(g, 1e12, testConfig()), { seconds: 0, cells: 0, pictures: 0 });
});
test('저장소에 넣었다 꺼내면 상태와 저장 시각이 남는다', () => {
  const data = {};
  const storage = { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
  const g = Game.create(testConfig(), testPictures());
  g.state.drops = 7;
  assert.equal(Save.load(storage, testConfig(), testPictures()), null);
  Save.store(storage, g.state, 1234, testConfig());
  const back = Save.load(storage, testConfig(), testPictures());
  assert.equal(back.drops, 7);
  assert.equal(back.lastSeen, 1234);
});
test('저장소가 예외를 던져도 죽지 않는다', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(Save.load(bad, testConfig(), testPictures()), null);
  Save.store(bad, Game.create(testConfig(), testPictures()).state, 1, testConfig());
});
