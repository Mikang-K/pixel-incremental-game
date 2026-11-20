'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../js/game.js');
const { testConfig, testRegions } = require('./fixtures.js');

test('누른 자리가 칠해지고 포인트를 받는다', () => {
  const g = Game.create(testConfig(), testRegions());
  assert.equal(g.paint(0, 0), 1);
  assert.equal(g.painted[0], 1);
  assert.equal(g.state.paintedCount, 1);
  assert.equal(g.state.points, 1 + 25);
});
test('칠한 자리, 그림 밖, 정수가 아닌 좌표는 아무 일도 없다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.paint(0, 0); const p = g.state.points;
  for (const [x, y] of [[0, 0], [-1, 0], [10, 0], [0, 8], [0.5, 1], [NaN, 1]]) assert.equal(g.paint(x, y), 0);
  assert.equal(g.state.points, p);
});
test('손 예산을 다 쓰면 더 칠해지지 않고 시간이 지나면 다시 찬다', () => {
  const g = Game.create(testConfig(), testRegions());
  let n = 0; for (let i = 0; i < 20; i++) n += g.paint(i % 10, Math.floor(i / 10));
  assert.equal(n, 8);
  g.tick(0.5);
  assert.equal(g.paint(9, 7), 1);
  assert.equal(g.paint(8, 7), 1);
  assert.equal(g.paint(7, 7), 0);
});
test('너무 큰 프레임 간격은 진행에 넣지 않는다', () => {
  const g = Game.create(testConfig(), testRegions());
  for (let i = 0; i < 8; i++) g.paint(i, 0);
  g.tick(6); g.tick(-1); g.tick(NaN);
  assert.equal(g.handBudget(), 0);
  assert.equal(g.state.time, 0);
});
test('붓 크기 강화는 정사각형으로 칠하고 그림 밖은 건너뛴다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.state.points = 1e6;
  assert.equal(g.buy('brushSize'), true);
  assert.equal(g.paint(9, 7), 1);
  assert.equal(g.paint(0, 0), 4);
  assert.equal(g.buy('brushSize'), true);
  assert.equal(g.buy('brushSize'), false);
});
test('손 예산이 모자라면 붓의 일부만 칠한다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.state.points = 1e6; g.buy('brushSize');
  for (let i = 0; i < 6; i++) g.paint(i, 7);   // 2x2 붓이 아래줄에 걸쳐 2+1x5 = 7픽셀, 예산 1 남음
  assert.equal(g.paint(0, 0), 1);
});
test('강화 값은 살수록 오르고 포인트가 모자라면 못 산다', () => {
  const g = Game.create(testConfig(), testRegions());
  assert.equal(g.buy('handSpeed'), false);
  g.state.points = 26;
  assert.equal(g.buy('handSpeed'), true);
  assert.equal(g.state.points, 16);
  assert.equal(g.cost('handSpeed'), 16);
  assert.equal(g.handRate(), 5);
  assert.equal(g.level('handSpeed'), 1);
  assert.equal(g.buy('없는강화'), false);
});
test('픽셀당 포인트 강화는 받는 포인트를 곱한다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.state.points = 50; g.buy('pointsPerPixel');
  assert.equal(g.pointsPerPixel(), 1.5);
});
test('요정 강화는 처음에 잠겨 있다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.state.points = 1e9;
  assert.equal(g.isLocked('fairyHire'), true);
  assert.equal(g.canBuy('fairyHire'), false);
  assert.equal(g.buy('fairyHire'), false);
});
test('영역을 처음 칠하면 시작, 다 채우면 완성 사건과 보너스', () => {
  const g = Game.create(testConfig(), testRegions());
  const dot = g.regions.findIndex((r) => r.id === 'dot');
  const cells = [...g.regionIndex.keys()].filter((i) => g.regionIndex[i] === dot);
  g.drainEvents();
  for (const i of cells) { g.tick(1); g.paint(i % 10, Math.floor(i / 10)); }
  const ev = g.drainEvents();
  assert.deepEqual(ev[0], { type: 'regionStarted', region: dot });
  assert.deepEqual(ev[ev.length - 1], { type: 'regionCompleted', region: dot });
  assert.equal(g.regions[dot].painted, cells.length);
  assert.equal(g.state.points, cells.length + 25 + cells.length * 0.2);
});
test('마지막 픽셀을 칠하면 끝 사건', () => {
  const g = Game.create(testConfig(), testRegions());
  for (let i = 0; i < 80; i++) { g.tick(1); g.paint(i % 10, Math.floor(i / 10)); }
  assert.equal(g.state.paintedCount, 80);
  assert.ok(g.drainEvents().some((e) => e.type === 'finished'));
});
test('칠한 픽셀 목록은 꺼낼 때마다 비워진다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.paint(3, 1);
  assert.deepEqual(g.drainPainted(), [13]);
  assert.deepEqual(g.drainPainted(), []);
});
