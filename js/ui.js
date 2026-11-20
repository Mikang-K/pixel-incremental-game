'use strict';
// 화면: 그리기, 확대 이동, 입력, 연출, 패널, 저장. 규칙은 전부 Game에 있고 여기서는 읽고 전달만 한다.
(function () {
  const $ = (id) => document.getElementById(id);
  const W = CONFIG.painting.width, H = CONFIG.painting.height;

  const NAMES = {
    handSpeed: '손 빠르기', pointsPerPixel: '픽셀당 포인트', brushSize: '붓 크기',
    fairyHire: '요정 고용', fairySpeed: '요정 속도',
  };
  const DESCRIPTIONS = {
    handSpeed: '손으로 1초에 칠할 수 있는 픽셀이 늘어납니다.',
    pointsPerPixel: '픽셀을 칠할 때 받는 포인트가 늘어납니다.',
    brushSize: '한 번에 칠하는 붓이 조금 커집니다. 최대 3x3.',
    fairyHire: '요정이 칠한 곳의 가장자리에서 알아서 색을 번져 갑니다.',
    fairySpeed: '모든 요정이 더 빨리 칠합니다.',
  };

  const UNITS = [[1e12, '조'], [1e8, '억'], [1e4, '만'], [1e3, '천']];
  function fmt(n) {
    if (!Number.isFinite(n)) return '무한';
    if (n >= 1e16) return n.toExponential(1); // 조 단위를 넘으면 지수로 짧게
    for (const [value, unit] of UNITS) if (n >= value) return (n / value).toFixed(1) + unit;
    return String(Math.floor(n));
  }
  const fmtRate = (n) => (n < 100 ? String(Math.round(n * 10) / 10) : fmt(n));
  function fmtTime(seconds) {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
    return h ? `${h}시간 ${m}분` : `${m}분`;
  }

  // 저장소 접근이 막힌 브라우저에서도 게임은 돌아야 한다.
  let storage;
  try { storage = window.localStorage; storage.getItem(CONFIG.save.storageKey); } catch (e) {
    storage = { getItem: () => null, setItem: () => {} };
  }

  let g;
  let living = null;
  let finishedShown = false;
  const save = () => { if (g) Save.store(storage, g, CONFIG); };

  // ---------- 그림 픽셀 ----------
  const display = document.createElement('canvas');
  display.width = W; display.height = H;
  const dctx = display.getContext('2d');
  let colorData, grayData, displayData;

  function prepareImages(img) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cctx = c.getContext('2d');
    cctx.drawImage(img, 0, 0, W, H);
    colorData = cctx.getImageData(0, 0, W, H).data;
    grayData = new Uint8ClampedArray(colorData.length);
    for (let p = 0; p < colorData.length; p += 4) {
      // 밝기 차이를 눌러 바랜 느낌을 낸다. 칠한 곳과 한눈에 구별된다.
      const l = 70 + 0.3 * (0.299 * colorData[p] + 0.587 * colorData[p + 1] + 0.114 * colorData[p + 2]);
      grayData[p] = grayData[p + 1] = grayData[p + 2] = l;
      grayData[p + 3] = 255;
    }
    displayData = dctx.createImageData(W, H);
  }

  function rebuildDisplay() {
    const d = displayData.data;
    for (let i = 0, p = 0; i < W * H; i++, p += 4) {
      const src = g.painted[i] ? colorData : grayData;
      d[p] = src[p]; d[p + 1] = src[p + 1]; d[p + 2] = src[p + 2]; d[p + 3] = 255;
    }
    dctx.putImageData(displayData, 0, 0);
  }

  // 새로 칠한 픽셀만 색으로 바꾸고, 바뀐 범위의 사각형만 캔버스에 올린다.
  function applyPainted(list) {
    if (!list.length) return;
    const d = displayData.data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (const i of list) {
      const p = i * 4;
      d[p] = colorData[p]; d[p + 1] = colorData[p + 1]; d[p + 2] = colorData[p + 2];
      const x = i % W, y = (i - x) / W;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    dctx.putImageData(displayData, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }

  // ---------- 보기 (확대와 이동) ----------
  const view = $('view');
  const vctx = view.getContext('2d');
  const cam = { scale: 1, ox: 0, oy: 0 };
  const fitScale = () => Math.min(view.width / W, view.height / H);

  // 확대 범위를 지키고, 그림이 화면 밖으로 다 나가지 않게 붙잡는다.
  function clampCam() {
    cam.scale = Math.min(CONFIG.ui.maxPixelSize, Math.max(fitScale(), cam.scale));
    const w = W * cam.scale, h = H * cam.scale;
    cam.ox = w <= view.width ? (view.width - w) / 2 : Math.min(0, Math.max(view.width - w, cam.ox));
    cam.oy = h <= view.height ? (view.height - h) / 2 : Math.min(0, Math.max(view.height - h, cam.oy));
  }
  function resize() {
    const r = view.getBoundingClientRect();
    view.width = Math.max(1, Math.round(r.width));
    view.height = Math.max(1, Math.round(r.height));
    clampCam();
  }
  function fit() {
    cam.scale = fitScale();
    clampCam();
  }
  function zoomAt(sx, sy, factor) {
    const px = (sx - cam.ox) / cam.scale, py = (sy - cam.oy) / cam.scale;
    cam.scale = Math.min(CONFIG.ui.maxPixelSize, Math.max(fitScale(), cam.scale * factor));
    cam.ox = sx - px * cam.scale;
    cam.oy = sy - py * cam.scale;
    clampCam();
  }
  function centerOn(px, py) {
    cam.ox = view.width / 2 - px * cam.scale;
    cam.oy = view.height / 2 - py * cam.scale;
    clampCam();
  }
  const toPixel = (sx, sy) => [Math.floor((sx - cam.ox) / cam.scale), Math.floor((sy - cam.oy) / cam.scale)];

  // ---------- 연출 상태 ----------
  const sparkles = [];
  const dots = [];
  const fairyTargets = [];

  // ---------- 입력 ----------
  let mode = null; // 'paint' | 'pan'
  let last = null;
  let spaceDown = false;
  let hover = null;

  function canvasPoint(e) {
    const r = view.getBoundingClientRect();
    return [(e.clientX - r.left) * (view.width / r.width), (e.clientY - r.top) * (view.height / r.height)];
  }
  function paintAt(x, y) {
    const off = Math.floor((g.brushSize() - 1) / 2); // 붓 가운데가 커서에 오도록
    if (g.paint(x - off, y - off)) sparkles.push({ x, y, t: performance.now(), size: g.brushSize() });
  }
  // 빠르게 끌어도 빈칸이 생기지 않게 지난 위치와 지금 위치를 선으로 잇는다.
  function paintLine([x0, y0], [x1, y1]) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (let guard = 0; guard < 10000; guard++) {
      paintAt(x, y);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  view.addEventListener('contextmenu', (e) => e.preventDefault());
  view.addEventListener('pointerdown', (e) => {
    view.setPointerCapture(e.pointerId);
    const pt = canvasPoint(e);
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceDown)) {
      mode = 'pan'; last = pt; view.classList.add('panning');
    } else if (e.button === 0 && !finishedShown) {
      mode = 'paint'; last = toPixel(...pt); paintAt(...last);
    }
  });
  view.addEventListener('pointermove', (e) => {
    const pt = canvasPoint(e);
    hover = toPixel(...pt);
    if (mode === 'pan') {
      cam.ox += pt[0] - last[0]; cam.oy += pt[1] - last[1]; last = pt; clampCam();
    } else if (mode === 'paint') {
      const cur = toPixel(...pt);
      paintLine(last, cur);
      last = cur;
    }
  });
  const endDrag = () => { mode = null; last = null; view.classList.remove('panning'); };
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);
  view.addEventListener('pointerleave', () => { hover = null; });
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(...canvasPoint(e), Math.pow(1.0015, -e.deltaY));
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) { spaceDown = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });

  // ---------- 작은 전체 지도 ----------
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');
  minimap.width = 300; minimap.height = Math.round(300 * H / W);
  let minimapAt = -1e9;
  function drawMinimap(now) {
    if (now - minimapAt < 200) return;
    minimapAt = now;
    const k = minimap.width / W;
    mctx.drawImage(display, 0, 0, minimap.width, minimap.height);
    const x = Math.max(0, -cam.ox / cam.scale * k), y = Math.max(0, -cam.oy / cam.scale * k);
    const w = Math.min(minimap.width - x, view.width / cam.scale * k), h = Math.min(minimap.height - y, view.height / cam.scale * k);
    mctx.strokeStyle = '#f2c94c';
    mctx.lineWidth = 2;
    mctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  minimap.addEventListener('click', (e) => {
    const r = minimap.getBoundingClientRect();
    centerOn((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
    minimapAt = -1e9;
  });

  // ---------- 그리기 ----------
  function drawEffects(now) {
    const s = cam.scale;
    // 칠한 자리에 남는 짧은 반짝임
    if (sparkles.length > 300) sparkles.splice(0, sparkles.length - 300);
    for (let k = sparkles.length - 1; k >= 0; k--) {
      const p = sparkles[k], age = (now - p.t) / 450;
      if (age >= 1) { sparkles.splice(k, 1); continue; }
      const size = Math.max(3, s * p.size) * (1 + age * 1.5);
      vctx.globalAlpha = 1 - age;
      vctx.fillStyle = '#fff6c8';
      vctx.fillRect(cam.ox + (p.x + 0.5) * s - size / 2, cam.oy + (p.y + 0.5) * s - size / 2, size, size);
    }
    vctx.globalAlpha = 1;

    // 요정 빛 점: 요정이 최근 칠한 자리로 날아간다
    const want = Math.min(CONFIG.ui.maxFairyDots, g.fairyCount());
    while (dots.length < want) dots.push({ x: W / 2, y: H / 2, tx: W / 2, ty: H / 2 });
    dots.length = want;
    for (const d of dots) {
      if (Math.hypot(d.tx - d.x, d.ty - d.y) < 1 && fairyTargets.length) {
        const i = fairyTargets.shift();
        d.tx = i % W; d.ty = Math.floor(i / W);
      }
      d.x += (d.tx - d.x) * 0.15; d.y += (d.ty - d.y) * 0.15;
      const sx = cam.ox + (d.x + 0.5) * s, sy = cam.oy + (d.y + 0.5) * s;
      vctx.fillStyle = 'rgba(255, 240, 170, 0.35)';
      vctx.fillRect(sx - 4, sy - 4, 8, 8);
      vctx.fillStyle = '#fffbe6';
      vctx.fillRect(sx - 2, sy - 2, 4, 4);
    }

    // 확대했을 때 붓이 칠할 자리를 보여 준다
    if (hover && s >= 4 && !mode && !finishedShown) {
      const size = g.brushSize(), off = Math.floor((size - 1) / 2);
      vctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      vctx.lineWidth = 1;
      vctx.strokeRect(cam.ox + (hover[0] - off) * s + 0.5, cam.oy + (hover[1] - off) * s + 0.5, size * s - 1, size * s - 1);
    }
  }

  function render(now) {
    vctx.fillStyle = '#070a14';
    vctx.fillRect(0, 0, view.width, view.height);
    vctx.imageSmoothingEnabled = false;
    vctx.drawImage(display, cam.ox, cam.oy, W * cam.scale, H * cam.scale);
    if (living) living.draw(vctx, { scale: cam.scale, offsetX: cam.ox, offsetY: cam.oy }, now);
    drawEffects(now);
  }

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('toasts').append(el);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => el.remove(), 3600);
  }

  // ---------- 위쪽 띠와 강화 패널 ----------
  function drawTop() {
    const p = g.progress();
    $('points').textContent = fmt(g.state.points);
    $('hand').textContent = `${fmtRate(g.handRate())}/초`;
    $('handBudget').textContent = `남은 ${Math.floor(g.handBudget())}`;
    $('fairy').textContent = g.fairyCount()
      ? `${g.fairyCount()}마리, ${fmtRate(g.fairyRate())}/초`
      : (g.fairiesUnlocked() ? '고용 가능' : '아직 없음');
    $('percent').textContent = `${(Math.floor((p.painted / p.total) * 10000) / 100).toFixed(2)}%`;
    $('count').textContent = `${p.painted.toLocaleString()} / ${p.total.toLocaleString()} 픽셀`;
  }

  const rows = [];
  function buildList() {
    const list = $('list');
    list.replaceChildren();
    rows.length = 0;
    for (const id of Object.keys(CONFIG.upgrades)) {
      const row = document.createElement('div');
      row.className = 'item';
      const head = document.createElement('div');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = NAMES[id] || id;
      const count = document.createElement('span');
      count.className = 'count';
      head.append(name, ' ', count);
      const button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', () => { g.buy(id); });
      const desc = document.createElement('div');
      desc.className = 'desc';
      row.append(head, button, desc);
      list.append(row);
      rows.push(() => {
        const locked = g.isLocked(id);
        const max = CONFIG.upgrades[id].maxLevel;
        const done = max !== undefined && g.level(id) >= max;
        row.classList.toggle('locked', locked);
        count.textContent = id === 'fairyHire' ? `${g.level(id)}마리` : `${g.level(id)}단계`;
        desc.textContent = locked
          ? `칠한 픽셀이 ${CONFIG.fairies.unlockAtPainted.toLocaleString()}개를 넘으면 열립니다.`
          : DESCRIPTIONS[id];
        button.textContent = locked ? '잠김' : done ? '최대' : fmt(Math.ceil(g.cost(id)));
        button.disabled = !g.canBuy(id);
      });
    }
  }

  // ---------- 끝 ----------
  function showFinish() {
    finishedShown = true;
    fit();
    $('finishText').textContent = `걸린 시간 ${fmtTime(g.state.time)}, 찍은 픽셀 ${g.total.toLocaleString()}개. 이제 그림이 살아 움직입니다.`;
    $('finish').hidden = false;
  }
  $('closeFinish').addEventListener('click', () => { $('finish').hidden = true; });

  function handleEvents() {
    for (const e of g.drainEvents()) {
      const region = g.regions[e.region];
      if (e.type === 'regionStarted' && g.state.paintedCount > 1) toast(`${region.name} 영역을 칠하기 시작했습니다`);
      else if (e.type === 'regionCompleted') toast(`${region.name} 영역을 다 채웠습니다`);
      else if (e.type === 'fairiesUnlocked') toast('요정이 찾아왔습니다. 이제 고용할 수 있습니다');
      else if (e.type === 'finished') showFinish();
    }
  }

  // ---------- 설정 ----------
  const message = (text) => { $('settingsMessage').textContent = text; };
  const BAD = '저장 문자열이 올바르지 않습니다. 지금 진행은 그대로입니다.';
  $('openSettings').addEventListener('click', () => { message(''); $('saveText').value = ''; $('settings').showModal(); });
  $('closeSettings').addEventListener('click', () => $('settings').close());
  $('exportSave').addEventListener('click', () => {
    save();
    $('saveText').value = Save.serialize(g);
    $('saveText').select();
    message('문자열을 복사해 보관하세요.');
  });
  $('downloadSave').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([Save.serialize(g)], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'starry-night-save.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('파일로 받았습니다.');
  });
  function importText(text) {
    const loaded = Save.deserialize(String(text).trim(), CONFIG);
    if (!loaded) { message(BAD); return; }
    start(loaded);
    save();
    message('불러왔습니다.');
  }
  $('importSave').addEventListener('click', () => importText($('saveText').value));
  $('importFile').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', () => {
    const file = $('fileInput').files[0];
    $('fileInput').value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { message(BAD); return; } // 저장 파일은 이보다 훨씬 작다
    const reader = new FileReader();
    reader.onload = () => importText(reader.result);
    reader.onerror = () => message(BAD);
    reader.readAsText(file);
  });
  $('resetSave').addEventListener('click', () => {
    if (!window.confirm('칠한 픽셀과 강화를 모두 지우고 처음부터 시작할까요? 되돌릴 수 없습니다.')) return;
    start(null);
    save();
    message('처음부터 다시 시작합니다.');
  });

  // ---------- 시작과 루프 ----------
  function start(saved) {
    g = Game.create(CONFIG, REGIONS, saved || undefined);
    g.drainEvents(); g.drainPainted(); g.drainFairyPainted();
    rebuildDisplay();
    living = typeof Living !== 'undefined' ? Living.create(g, colorData) : null;
    finishedShown = false;
    $('finish').hidden = true;
    sparkles.length = 0; dots.length = 0; fairyTargets.length = 0;
    buildList();
    fit();
    minimapAt = -1e9;
    if (g.state.paintedCount === g.total) showFinish();
  }

  let lastFrame = 0, sinceSave = 0;
  function frame(now) {
    const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    step(now, dt);
    if (dt > 0 && dt <= CONFIG.frame.maxGapSeconds) sinceSave += dt;
    if (sinceSave >= CONFIG.save.intervalSeconds) { sinceSave = 0; save(); }
    requestAnimationFrame(frame);
  }
  function step(now, dt) {
    g.tick(dt); // 절전 등으로 생긴 큰 간격은 규칙이 버린다
    applyPainted(g.drainPainted());
    for (const i of g.drainFairyPainted()) fairyTargets.push(i);
    if (fairyTargets.length > 200) fairyTargets.splice(0, fairyTargets.length - 200);
    handleEvents();
    render(now);
    drawMinimap(now);
    drawTop();
    for (const update of rows) update();
  }

  const img = new Image();
  img.onload = () => {
    prepareImages(img);
    resize();
    start(Save.load(storage, CONFIG));
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    window.addEventListener('pagehide', save); // 새로 고침이나 창 닫기
    requestAnimationFrame(frame);
  };
  img.src = PAINTING_IMAGE;

  // 콘솔에서 상태를 들여다보거나 시험할 때 쓴다.
  window.starry = {
    get game() { return g; },
    // 화면 갱신과 상관없이 프레임 작업 n번의 평균 시간(ms)을 잰다. 창이 가려져 있어도 쓸 수 있다.
    bench(n = 60, dt = 1 / 60) {
      const t0 = performance.now();
      for (let k = 0; k < n; k++) step(t0 + k * dt * 1000, dt);
      return (performance.now() - t0) / n;
    },
    // 손 예산을 무시하고 영역 하나를 통째로 칠한다(연출 확인용).
    fillRegion(id) {
      const r = g.regions.findIndex((x) => x.id === id);
      const keep = g.state.upgrades.handSpeed;
      g.state.upgrades.handSpeed = 1e8;
      g.tick(1);
      for (let i = 0; i < g.total; i++) if (g.regionIndex[i] === r && !g.painted[i]) g.paint(i % W, Math.floor(i / W));
      if (keep === undefined) delete g.state.upgrades.handSpeed; else g.state.upgrades.handSpeed = keep;
      return g.regions[r];
    },
  };
})();
