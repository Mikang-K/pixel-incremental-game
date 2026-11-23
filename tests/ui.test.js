'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { testConfig, testRegions } = require('./fixtures.js');

function setup() {
  const elements = new Map(), raf = [];
  let transform, image, now = 1000;
  function element(id = '') {
    const listeners = {};
    const ctx = new Proxy({}, { get: (o, k) => o[k] || (k === 'getImageData' || k === 'createImageData'
      ? () => ({ data: new Uint8ClampedArray(320) })
      : (...args) => { if (id === 'view' && k === 'drawImage') transform = args.slice(1); }) });
    return { listeners, children: [], hidden: true, open: false,
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(k, fn) { (listeners[k] ||= []).push(fn); },
      emit(k, args = {}) { const e = { target: this, preventDefault() { this.prevented = true; }, ...args }; for (const fn of listeners[k] || []) fn(e); return e; },
      getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 80 }),
      append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; },
      setPointerCapture() {}, focus() { document.activeElement = this; document.emit('focusin', { target: this }); },
      showModal() { this.open = true; }, close() { this.open = false; },
    };
  }
  const document = element();
  document.hidden = false;
  document.body = element(); document.activeElement = document.body;
  document.getElementById = id => { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); };
  document.createElement = () => element();
  const window = element(); window.localStorage = { getItem: () => null, setItem() {} };
  const config = testConfig();
  Object.assign(config.ui, { keyboardPanSpeed: 600, keyboardFastMultiplier: 2, keyboardZoomPerSecond: 2, keyboardMaxFrameSeconds: 0.05 });
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/ui.js'), 'utf8'), {
    window, document, CONFIG: config, REGIONS: testRegions(),
    Game: require('../js/game.js'), Save: require('../js/save.js'), PAINTING_IMAGE: '',
    Image: function () { image = this; }, performance: { now: () => now },
    requestAnimationFrame: fn => raf.push(fn), setTimeout() {},
  });
  image.onload();
  const frame = (dt = 1 / 60) => { now += dt * 1000; raf.shift()(now); };
  frame();
  const key = (code, extra = {}) => window.emit('keydown', { code, target: document.activeElement, ...extra });
  const up = code => window.emit('keyup', { code });
  const view = document.getElementById('view');
  const zoom = () => view.emit('wheel', { clientX: 50, clientY: 40, deltaY: -Math.log(2) / Math.log(1.0015) });
  return { window, document, view, frame, key, up, zoom, el: document.getElementById, camera: () => transform.slice(), game: () => window.starry.game };
}

test('E 확대, WASD 이동, 키 해제 시 정지, F 전체 보기', () => {
  const s = setup(); s.key('KeyE'); s.frame(); s.up('KeyE');
  assert.ok(s.camera()[2] > 100);
  s.zoom(); s.frame(); const before = s.camera();
  s.key('KeyD'); s.frame(); s.up('KeyD'); assert.ok(s.camera()[0] < before[0]);
  const stopped = s.camera(); s.frame(); assert.deepEqual(s.camera(), stopped);
  s.key('KeyF'); s.up('KeyF'); s.frame(); assert.deepEqual(s.camera(), [0, 0, 100, 80]);
  assert.equal(s.game().state.paintedCount, 0);
});

test('설정, 다른 요소 포커스, 조합키와 IME는 화면을 조작하지 않는다', () => {
  for (const extra of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }]) {
    const s = setup(); assert.ok(!s.key('KeyE', extra).prevented); s.frame(); assert.equal(s.camera()[2], 100);
  }
  const s = setup(); s.el('settings').open = true; s.key('KeyE'); s.frame(); assert.equal(s.camera()[2], 100);
  s.el('settings').open = false; s.document.activeElement = s.el('saveText');
  s.key('KeyE'); s.frame(); assert.equal(s.camera()[2], 100);
});

test('창 전환, 탭 숨김과 드래그는 누른 카메라 키를 정리한다', () => {
  for (const reset of [s => s.window.emit('blur'), s => { s.document.hidden = true; s.document.emit('visibilitychange'); },
    s => s.el('openSettings').emit('click'), s => s.el('saveText').focus()]) {
    const s = setup(); s.zoom(); s.frame(); s.key('KeyD'); reset(s);
    const before = s.camera(); s.frame(); assert.deepEqual(s.camera(), before);
  }
  const s = setup(); s.zoom(); s.frame();
  s.view.emit('pointerdown', { button: 2, clientX: 50, clientY: 40 });
  s.key('KeyD'); const before = s.camera(); s.frame(); assert.deepEqual(s.camera(), before);
  s.view.emit('pointerup'); s.key('KeyD', { repeat: true }); s.frame(); assert.deepEqual(s.camera(), before);
});

test('커서 중심 확대 뒤 클릭 좌표와 Space 끌기가 유지된다', () => {
  const s = setup(); s.view.emit('pointermove', { clientX: 30, clientY: 30 });
  s.key('KeyE', { key: 'ㄷ' }); s.frame(); s.up('KeyE');
  const [ox, oy, width] = s.camera(); const scale = width / 10;
  assert.ok(Math.abs((30 - ox) / scale - 3) < 1e-9);
  s.view.emit('pointerdown', { button: 0, clientX: 30, clientY: 30 });
  assert.equal(s.game().painted[Math.floor((30 - oy) / scale) * 10 + 3], 1);
  s.view.emit('pointerup'); s.zoom(); s.frame();
  s.key('Space'); s.view.emit('pointerdown', { button: 0, clientX: 50, clientY: 40 });
  const before = s.camera(); s.view.emit('pointermove', { clientX: 55, clientY: 40 }); s.frame();
  assert.ok(s.camera()[0] > before[0]);
});

test('프레임 속도, 대각선과 Shift 가속, 반대 방향 상쇄', () => {
  function travel(hz, codes, extra = {}) {
    const s = setup(); s.zoom(); s.frame(); const before = s.camera();
    for (const code of codes) s.key(code, extra);
    for (let i = 0; i < hz / 60; i++) s.frame(1 / hz);
    const after = s.camera(); return Math.hypot(after[0] - before[0], after[1] - before[1]);
  }
  const straight = travel(60, ['KeyD']);
  assert.ok(straight > 0);
  assert.ok(Math.abs(travel(120, ['KeyD']) - straight) < 1e-8);
  assert.ok(Math.abs(travel(60, ['KeyD', 'KeyS']) - straight) < 1e-8);
  assert.ok(Math.abs(travel(60, ['KeyD'], { shiftKey: true }) - straight * 2) < 1e-8);
  assert.equal(travel(60, ['KeyD', 'KeyA']), 0);
});

test('전체 보기 우선, F 반복 무시와 긴 프레임 이동 제한', () => {
  const s = setup(); s.zoom(); s.frame();
  const before = s.camera(); s.key('KeyD'); s.frame(3); s.up('KeyD');
  assert.ok(Math.abs(s.camera()[0] - before[0] + 30) < 1e-8);
  s.key('KeyF'); s.key('KeyE'); s.frame(); assert.deepEqual(s.camera(), [0, 0, 100, 80]);
  s.up('KeyE'); s.zoom(); s.frame(); const enlarged = s.camera();
  s.key('KeyF', { repeat: true }); s.frame(); assert.deepEqual(s.camera(), enlarged);
});
