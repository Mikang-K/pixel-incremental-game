'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PICTURES = require('../js/pictures.js');

const count = (tier) => PICTURES.filter((p) => p.tier === tier).length;

test('모든 그림이 형식을 지킨다', () => {
  const ids = new Set();
  for (const p of PICTURES) {
    assert.ok(p.id && !ids.has(p.id), `id 중복 또는 없음: ${p.id}`); ids.add(p.id);
    assert.ok(p.title && p.artist && Number.isInteger(p.year), p.id);
    assert.equal(p.rows.length, p.tier, p.id);
    assert.ok(p.palette.length >= 2 && p.palette.length <= 16, p.id);
    for (const c of p.palette) assert.match(c, /^#[0-9a-f]{6}$/, p.id);
    for (const row of p.rows) {
      assert.equal(row.length, p.tier, `${p.id}: ${row}`);
      for (const ch of row) assert.ok(parseInt(ch, 16) < p.palette.length, `${p.id}: ${ch}`);
    }
    for (const [k, v] of Object.entries(p.traits || {})) {
      assert.ok(Number(k) < p.palette.length, p.id);
      assert.ok(['blue', 'yellow', 'red'].includes(v), p.id);
    }
  }
});
test('단계마다 색 규칙 세 계열이 모두 한 번 이상 나온다', () => {
  for (const tier of new Set(PICTURES.map((p) => p.tier))) {
    const seen = new Set(PICTURES.filter((p) => p.tier === tier).flatMap((p) => Object.values(p.traits || {})));
    assert.deepEqual([...seen].sort(), ['blue', 'red', 'yellow'], `${tier}x${tier}`);
  }
});
test('8x8 그림은 8장', () => assert.equal(count(8), 8));
test('16x16 그림은 8장', () => assert.equal(count(16), 8));
test('32x32 그림은 6장', () => assert.equal(count(32), 6));
