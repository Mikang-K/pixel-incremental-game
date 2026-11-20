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

// 요정
const paintRange = (g, from, to) => { for (let i = from; i < to; i++) { g.tick(1); g.paint(i % 10, Math.floor(i / 10)); } };
const withFairies = (seed, fairies) => {
  const config = { ...testConfig(), seed };
  config.fairies = { ...config.fairies, ...fairies };
  return config;
};
test('정해진 수만큼 칠하기 전에는 요정이 잠겨 있고 넘으면 열린다', () => {
  const g = Game.create(testConfig(), testRegions());
  paintRange(g, 0, 4);
  assert.equal(g.fairiesUnlocked(), false);
  paintRange(g, 4, 5);
  assert.equal(g.fairiesUnlocked(), true);
  assert.equal(g.isLocked('fairyHire'), false);
  assert.ok(g.drainEvents().some((e) => e.type === 'fairiesUnlocked'));
});
test('요정은 칠한 곳과 맞닿은 자리부터 칠한다', () => {
  const g = Game.create(withFairies(1, { unlockAtPainted: 1 }), testRegions());
  g.paint(5, 4); g.drainPainted();
  g.state.points = 1e6; g.buy('fairyHire');
  assert.equal(g.fairyCount(), 1);
  assert.equal(g.fairyRate(), 2);
  g.tick(1);
  const got = g.drainPainted();
  assert.equal(got.length, 2);
  for (const i of got) {
    const x = i % 10, y = Math.floor(i / 10);
    assert.ok(Math.abs(x - 5) + Math.abs(y - 4) <= 2, `멀리 떨어진 픽셀 ${i}`);
  }
  assert.deepEqual(g.drainFairyPainted(), got);
});
test('요정의 소수 작업량은 다음 tick으로 넘어간다', () => {
  const g = Game.create(withFairies(1, { unlockAtPainted: 1 }), testRegions());
  g.paint(0, 0); g.state.points = 1e6; g.buy('fairyHire'); g.drainPainted();
  g.tick(0.25); assert.equal(g.drainPainted().length, 0);
  g.tick(0.25); assert.equal(g.drainPainted().length, 1);
});
test('요정은 남은 픽셀을 모두 채우고 멈춘다', () => {
  const g = Game.create(withFairies(3, { unlockAtPainted: 1, baseRate: 1000 }), testRegions());
  g.paint(0, 0); g.state.points = 1e6; g.buy('fairyHire');
  g.tick(1);
  assert.equal(g.state.paintedCount, 80);
  g.tick(1);
  assert.ok(g.drainEvents().some((e) => e.type === 'finished'));
});
test('칠한 곳이 없어도 요정은 빈 자리를 찾아 칠한다', () => {
  const g = Game.create(withFairies(2, { unlockAtPainted: 0 }), testRegions());
  assert.equal(g.fairiesUnlocked(), true);
  g.state.points = 1e6; g.buy('fairyHire');
  g.tick(1);
  assert.equal(g.state.paintedCount, 2);
});
test('요정 속도 강화는 요정 작업량을 곱한다', () => {
  const g = Game.create(withFairies(1, { unlockAtPainted: 0 }), testRegions());
  g.state.points = 1e6; g.buy('fairyHire'); g.buy('fairySpeed');
  assert.ok(Math.abs(g.fairyRate() - 2.8) < 1e-9);
});
test('요정이 칠한 목록은 상한까지만 보관한다', () => {
  const config = withFairies(4, { unlockAtPainted: 0, baseRate: 1000 });
  config.ui = { ...config.ui, maxFairyDots: 3 };
  const g = Game.create(config, testRegions());
  g.state.points = 1e6; g.buy('fairyHire');
  g.tick(1);
  assert.equal(g.drainFairyPainted().length, 3);
});

test('붓이 왼쪽과 위쪽 밖으로 걸쳐도 안쪽은 칠한다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.state.points = 1e6; g.buy('brushSize'); g.buy('brushSize');   // 3x3
  assert.equal(g.paint(-1, -1), 4);
  g.tick(2);
  assert.equal(g.paint(-1, 4), 6);                                 // x 0..1, y 4..6
  assert.equal(g.paint(-3, 0), 0);                                 // 붓 전체가 밖
});
