'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../js/game.js');
const REGIONS = require('../js/regions.js');
const CONFIG = require('../js/config.js');
const { testRegions } = require('./fixtures.js');

test('모든 픽셀이 정확히 한 영역에 속한다', () => {
  const { index, sizes } = Game.rasterizeRegions(testRegions(), 10, 8);
  assert.equal(index.length, 80);
  assert.equal(sizes.reduce((a, b) => a + b, 0), 80);
  for (const r of index) assert.ok(r < 3);
});
test('도형 안의 픽셀은 그 영역, 밖은 나머지 영역', () => {
  const { index } = Game.rasterizeRegions(testRegions(), 10, 8);
  assert.equal(index[2 * 10 + 2], 0);
  assert.equal(index[7 * 10 + 9], 1);
  assert.equal(index[0], 2);
});
test('앞에 적힌 영역이 겹친 픽셀을 가져간다', () => {
  const r = [{ id: 'a', shapes: [{ poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }] },
    { id: 'b', shapes: [{ circle: [0.5, 0.5, 0.3] }] }, { id: 'c', rest: true }];
  const { sizes } = Game.rasterizeRegions(r, 10, 8);
  assert.deepEqual(sizes, [80, 0, 0]);
});
test('타원 도형도 픽셀로 바뀐다', () => {
  const r = [{ id: 'e', shapes: [{ ellipse: [0.5, 0.5, 0.3, 0.1] }] }, { id: 'c', rest: true }];
  const { index, sizes } = Game.rasterizeRegions(r, 10, 8);
  assert.equal(index[4 * 10 + 5], 0);
  assert.equal(index[0], 1);
  assert.ok(sizes[0] > 0 && sizes[0] < 80);
});
test('실제 영역 데이터는 rest 영역이 정확히 하나이고 맨 끝이며 id가 겹치지 않는다', () => {
  assert.equal(REGIONS.filter((r) => r.rest).length, 1);
  assert.equal(REGIONS[REGIONS.length - 1].rest, true);
  assert.equal(new Set(REGIONS.map((r) => r.id)).size, REGIONS.length);
  for (const r of REGIONS) assert.ok(['twinkle', 'glow', 'flow', 'ripple', 'sway', 'flicker', 'none'].includes(r.effect), r.id);
});
test('실제 해상도에서 영역이 비어 있지 않다', () => {
  const { sizes } = Game.rasterizeRegions(REGIONS, CONFIG.painting.width, CONFIG.painting.height);
  REGIONS.forEach((r, i) => assert.ok(sizes[i] > 0, r.id));
});
