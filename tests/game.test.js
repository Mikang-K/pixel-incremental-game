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

// 요정, 강화, 색 규칙
test('방울이 모자라면 요정을 살 수 없다', () => {
  const g = Game.create(testConfig(), testPictures());
  assert.equal(g.buyFairy('brush'), false);
  assert.equal(g.state.fairies.brush, 0);
});
test('요정 값은 살수록 오른다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.drops = 1000;
  assert.equal(g.fairyCost('brush'), 15);
  assert.equal(g.buyFairy('brush'), true);
  assert.equal(g.state.drops, 985);
  assert.ok(Math.abs(g.fairyCost('brush') - 17.25) < 1e-9);
});
test('붓 요정은 번호순 첫 칸을 칠한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2;
  g.tick(1);
  assert.deepEqual(g.state.work, [1, 0, 0, 0]);
  assert.deepEqual(g.targets('brush'), [0]);
});
test('롤러 요정은 세 칸에 나눠 칠한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.roller = 1;
  g.tick(0.5);
  assert.deepEqual(g.state.work, [1, 1, 1, 0]);
});
test('큰 dt는 그림을 넘어가며 작업량을 잃지 않는다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2;
  g.tick(11);
  assert.equal(g.state.pictureIndex, 1);
  assert.equal(g.state.work.reduce((a, b) => a + b, 0), 3);
});
test('대기 중이거나 끝난 뒤의 tick은 멈추지 않고 돌아온다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.spray = 100;
  g.tick(100000);
  assert.equal(g.state.awaitingPrestige, true);
  assert.equal(g.state.time, 100000);
});
test('0 이하이거나 숫자가 아닌 dt는 무시한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2;
  g.tick(-5); g.tick(NaN); g.tick(0);
  assert.deepEqual(g.state.work, [0, 0, 0, 0]);
  assert.equal(g.state.time, 0);
});
test('강화는 요정 속도를 곱한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 1; g.state.drops = 100;
  assert.equal(g.buyUpgrade('brushSpeed'), true);
  assert.equal(g.workPerSecond('brush'), 1);
});
test('한 번만 살 수 있는 강화는 두 번 살 수 없다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.drops = 1e6;
  assert.equal(g.buyUpgrade('ruleBlue'), true);
  assert.equal(g.buyUpgrade('ruleBlue'), false);
  assert.equal(g.buyUpgrade('없는강화'), false);
});
test('파랑은 옆 칸으로 번진다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.upgrades.ruleBlue = 1;
  g.click(1, 0); g.click(1, 0);
  assert.equal(g.state.work[0], 0.5);
  assert.equal(g.state.work[3], 0.5);
});
test('노랑은 방울을 곱해 준다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.upgrades.ruleYellow = 1;
  g.click(0, 1); g.click(0, 1);
  assert.equal(g.state.drops, 5);
});
test('빨강은 잠깐 요정을 빠르게 한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.upgrades.ruleRed = 1; g.state.fairies.brush = 2;
  g.click(1, 1); g.click(1, 1);
  assert.equal(g.workPerSecond(), 2);
  g.tick(6);
  assert.equal(g.workPerSecond(), 1);
});
test('규칙을 열지 않았으면 색 효과가 없다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.click(1, 0); g.click(1, 0);
  assert.equal(g.state.work[0], 0);
});
