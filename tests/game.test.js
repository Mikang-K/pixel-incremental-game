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

// 프레스티지, 눈 강화, 결말
function finishTier(g) { g.state.fairies.spray = 1000; g.tick(100000); }
test('단계를 끝내기 전에는 프레스티지할 수 없다', () => {
  const g = Game.create(testConfig(), testPictures());
  assert.equal(g.canPrestige(), false);
  assert.equal(g.prestige(), false);
});
test('프레스티지는 방울과 요정과 강화를 지우고 갤러리와 눈을 남긴다', () => {
  const g = Game.create(testConfig(), testPictures());
  finishTier(g); g.state.upgrades.clickPower = 3;
  assert.equal(g.prestige(), true);
  assert.equal(g.state.drops, 0);
  assert.deepEqual(g.state.fairies, { brush: 0, roller: 0, spray: 0 });
  assert.deepEqual(g.state.upgrades, {});
  assert.equal(g.state.gallery.length, 2);
  assert.equal(g.state.eyes, 3);
  assert.equal(g.picture().tier, 4);
  assert.equal(g.state.work.length, 16);
});
test('시작 요정 강화는 프레스티지 뒤 붓 요정을 준다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.eyes = 1; assert.equal(g.buyEyeUpgrade('startFairies'), true);
  assert.equal(g.state.eyes, 0);
  finishTier(g); g.prestige();
  assert.equal(g.state.fairies.brush, 5);
});
test('눈이 모자라면 눈 강화를 살 수 없다', () => {
  const g = Game.create(testConfig(), testPictures());
  assert.equal(g.buyEyeUpgrade('globalSpeed'), false);
  assert.deepEqual(g.state.eyeUpgrades, {});
});
test('전체 속도 강화는 작업량을 곱한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.eyes = 2; g.buyEyeUpgrade('globalSpeed'); g.state.fairies.brush = 2;
  assert.equal(g.workPerSecond(), 2);
});
test('오프라인 효율 강화는 효율을 더하되 1을 넘지 않는다', () => {
  const g = Game.create(testConfig(), testPictures());
  assert.equal(g.offlineEfficiency(), 0.5);
  g.state.eyeUpgrades.offlineEfficiency = 2;
  assert.equal(g.offlineEfficiency(), 0.7);
  g.state.eyeUpgrades.offlineEfficiency = 50;
  assert.equal(g.offlineEfficiency(), 1);
});
test('자동 구매는 가장 싼 요정을 산다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.eyeUpgrades.autoBuy = 1; g.state.drops = 15;
  g.tick(1);
  assert.equal(g.state.fairies.brush, 1);
});
test('마지막 그림까지 끝내면 게임이 끝난 상태가 된다', () => {
  const g = Game.create(testConfig(), testPictures());
  finishTier(g); g.prestige(); finishTier(g);
  assert.equal(g.state.finished, true);
  assert.equal(g.canPrestige(), false);
  assert.equal(g.state.gallery.length, 3);
});
test('해상도 단계가 오르면 칸의 필요 작업량에 단계 배율이 곱해진다', () => {
  const config = testConfig();
  config.cell.tierWorkGrowth = 3;
  const g = Game.create(config, testPictures());
  assert.equal(g.cellRequired(), 2);
  finishTier(g); g.prestige();
  assert.equal(g.cellRequired(), 6);
});
