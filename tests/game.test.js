'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../js/game.js');
const { testConfig, testPictures } = require('./fixtures.js');

test('클릭은 클릭 힘만큼 작업량을 더한다', () => {
  const g = Game.create(testConfig(), testPictures());
  assert.equal(g.click(0, 0), true);
  assert.equal(g.state.work[0], 1);
  assert.equal(g.isCellDone(0), false);
});
test('칸이 차면 방울을 주고 더는 클릭되지 않는다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.click(0, 0); g.click(0, 0);
  assert.equal(g.isCellDone(0), true);
  assert.equal(g.state.drops, 1);
  assert.equal(g.click(0, 0), false);
  assert.equal(g.state.drops, 1);
});
test('캔버스 밖 좌표는 무시한다', () => {
  const g = Game.create(testConfig(), testPictures());
  assert.equal(g.click(-1, 0), false);
  assert.equal(g.click(2, 0), false);
  assert.equal(g.click(0.5, 0), false);
});
test('그림을 완성하면 갤러리에 걸리고 다음 그림으로 넘어간다', () => {
  const g = Game.create(testConfig(), testPictures());
  for (let i = 0; i < 4; i++) { g.click(i % 2, i >> 1); g.click(i % 2, i >> 1); }
  assert.deepEqual(g.state.gallery, [testPictures()[0].id]);
  assert.equal(g.state.pictureIndex, 1);
  assert.deepEqual(g.state.work, [0, 0, 0, 0]);
  assert.equal(g.dropsMultiplier(), 1.1);
  assert.deepEqual(g.progress(), { done: 0, total: 4 });
});
test('한 단계의 마지막 그림을 끝내면 프레스티지를 기다린다', () => {
  const g = Game.create(testConfig(), testPictures());
  for (let p = 0; p < 2; p++)
    for (let i = 0; i < 4; i++) { g.click(i % 2, i >> 1); g.click(i % 2, i >> 1); }
  assert.equal(g.state.awaitingPrestige, true);
  assert.equal(g.picture(), null);
  assert.equal(g.click(0, 0), false);
});
test('큰 수는 한글 단위로 줄여 쓴다', () => {
  assert.equal(Game.formatNumber(999), '999');
  assert.equal(Game.formatNumber(1200), '1.2천');
  assert.equal(Game.formatNumber(34000), '3.4만');
  assert.equal(Game.formatNumber(150000000), '1.5억');
  assert.equal(Game.formatNumber(2e12), '2.0조');
});
