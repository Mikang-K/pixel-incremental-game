'use strict';
// 화면: 그리기, 입력, 게임 루프, 자동 저장. 규칙은 전부 Game에 있고 여기서는 읽고 전달만 한다.
(function () {
  const $ = (id) => document.getElementById(id);
  const PICS = PICTURES.slice().sort((a, b) => a.tier - b.tier); // Game과 같은 순서
  const BY_ID = new Map(PICS.map((p) => [p.id, p]));
  const TYPES = Object.keys(CONFIG.fairies);

  const NAMES = {
    brush: '붓 요정', roller: '롤러 요정', spray: '분무 요정',
    clickPower: '클릭 힘', brushSpeed: '붓 요정 속도', rollerSpeed: '롤러 요정 속도', spraySpeed: '분무 요정 속도',
    cellDrops: '칸당 방울', ruleBlue: '번짐(파랑)', ruleYellow: '금빛(노랑)', ruleRed: '열기(빨강)',
    startFairies: '시작 요정', offlineEfficiency: '오프라인 효율', globalSpeed: '전체 속도', autoBuy: '자동 구매',
  };
  const DESCRIPTIONS = {
    brush: '한 칸씩 꾸준히 칠합니다.', roller: '세 칸에 나눠 칠합니다.', spray: '아홉 칸에 한꺼번에 뿌립니다.',
    clickPower: '한 번 누를 때 칠하는 양이 늘어납니다.', brushSpeed: '붓 요정이 빨라집니다.',
    rollerSpeed: '롤러 요정이 빨라집니다.', spraySpeed: '분무 요정이 빨라집니다.',
    cellDrops: '칸을 완성할 때 방울을 더 받습니다.',
    ruleBlue: '파란 칸을 완성하면 옆 칸으로 색이 번집니다.',
    ruleYellow: '노란 칸을 완성하면 방울을 훨씬 많이 받습니다.',
    ruleRed: '붉은 칸을 완성하면 잠깐 모든 요정이 빨라집니다.',
    startFairies: '눈을 뜬 직후 붓 요정을 데리고 시작합니다.',
    offlineEfficiency: '게임을 닫아 둔 동안 요정이 더 열심히 일합니다.',
    globalSpeed: '모든 요정이 영원히 빨라집니다.',
    autoBuy: '방울이 모이면 가장 싼 요정을 알아서 고용합니다.',
  };
  const DOT_COLORS = { brush: '#fff3b0', roller: '#9be7ff', spray: '#ffb3de' };

  const fmt = Game.formatNumber;
  const fmtRate = (n) => (n < 100 ? n.toFixed(1) : fmt(n));

  // 저장소 접근이 막힌 브라우저에서도 게임은 돌아야 한다.
  let storage;
  try { storage = window.localStorage; storage.getItem(CONFIG.save.storageKey); } catch (e) {
    storage = { getItem: () => null, setItem: () => {} };
  }

  let g;
  let tab = 'fairies';
  let rows = [];
  let galleryShown = -1;
  const start = (saved) => { g = Game.create(CONFIG, PICTURES, saved || undefined); galleryShown = -1; buildList(); };
  const save = () => Save.store(storage, g.state, Date.now(), CONFIG);

  // ---------- 그림 그리기 ----------
  const grays = new Map();
  function gray(hex) {
    if (!grays.has(hex)) {
      const n = parseInt(hex.slice(1), 16);
      // 밝기 차이를 눌러 바랜 느낌을 낸다. 흑백 그림도 칠한 칸과 구별된다.
      const l = Math.round(70 + 0.3 * (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)));
      grays.set(hex, `rgb(${l},${l},${l})`);
    }
    return grays.get(hex);
  }

  // fraction(i)가 없으면 완성본. 진행 중인 칸은 아래에서부터 색이 차오른다.
  function paintPicture(ctx, pic, ox, oy, cell, fraction) {
    for (let y = 0; y < pic.tier; y++) {
      for (let x = 0; x < pic.tier; x++) {
        const color = pic.palette[parseInt(pic.rows[y][x], 16)];
        const f = fraction ? fraction(y * pic.tier + x) : 1;
        ctx.fillStyle = f >= 1 ? color : gray(color);
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
        if (f > 0 && f < 1) {
          const h = Math.ceil(cell * f);
          ctx.fillStyle = color;
          ctx.fillRect(ox + x * cell, oy + (y + 1) * cell - h, cell, h);
        }
      }
    }
  }

  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  function fitCanvas(units) {
    const stage = $('stage');
    const size = Math.min(stage.clientWidth - 48, stage.clientHeight - 84);
    const cell = Math.max(1, Math.floor(size / units));
    if (canvas.width !== cell * units) canvas.width = canvas.height = cell * units;
    return cell;
  }

  const dots = {};
  function drawDots(pic, cell, now) {
    const size = Math.min(8, Math.max(2, Math.floor(cell / 6)));
    TYPES.forEach((type, t) => {
      const cells = g.targets(type);
      const count = Math.min(g.state.fairies[type], CONFIG.ui.maxFairyDots);
      const list = dots[type] || (dots[type] = []);
      list.length = cells.length ? count : 0;
      for (let j = 0; j < list.length; j++) {
        const i = cells[j % cells.length];
        const angle = now / 300 + j * 2.4 + t;
        const tx = (i % pic.tier + 0.5) * cell + Math.cos(angle) * cell * 0.3;
        const ty = (Math.floor(i / pic.tier) + 0.5) * cell + Math.sin(angle) * cell * 0.3;
        const d = list[j] || (list[j] = { x: tx, y: ty });
        d.x += (tx - d.x) * 0.2; d.y += (ty - d.y) * 0.2;
        ctx.fillStyle = '#000';
        ctx.fillRect(Math.round(d.x - size / 2) - 1, Math.round(d.y - size / 2) - 1, size + 2, size + 2);
        ctx.fillStyle = DOT_COLORS[type] || '#fff';
        ctx.fillRect(Math.round(d.x - size / 2), Math.round(d.y - size / 2), size, size);
      }
    });
  }

  function drawMosaic() {
    const done = g.state.gallery.map((id) => BY_ID.get(id));
    const cols = Math.ceil(Math.sqrt(done.length));
    const maxTier = Math.max(...done.map((p) => p.tier));
    const unit = fitCanvas(cols * maxTier); // 가장 큰 그림의 한 칸 크기
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    done.forEach((pic, n) => {
      const tile = unit * maxTier;
      paintPicture(ctx, pic, (n % cols) * tile, Math.floor(n / cols) * tile, tile / pic.tier);
    });
  }

  function drawStage(now) {
    const s = g.state;
    const overlay = $('overlay');
    const pic = g.picture();
    $('strokeButton').hidden = !pic;
    overlay.hidden = !!pic;
    overlay.classList.toggle('ending', s.finished);
    $('prestigeButton').hidden = s.finished;
    canvas.style.cursor = pic ? 'crosshair' : 'default';
    if (pic) {
      const cell = fitCanvas(pic.tier);
      const required = g.cellRequired();
      paintPicture(ctx, pic, 0, 0, cell, (i) => (g.isCellDone(i) ? 1 : s.work[i] / required));
      drawDots(pic, cell, now);
    } else if (s.finished) {
      drawMosaic();
      $('overlayText').textContent = `모든 그림을 되살렸습니다. 색을 되찾은 ${s.gallery.length}장이 한 폭으로 모였습니다.`;
    } else {
      const last = PICS[s.pictureIndex];
      const next = PICS[s.pictureIndex + 1];
      paintPicture(ctx, last, 0, 0, fitCanvas(last.tier));
      $('overlayText').textContent = `${last.tier}x${last.tier} 그림을 모두 되살렸습니다.\n`
        + `더 고운 눈을 뜨면 ${next.tier}x${next.tier} 그림이 보입니다.\n`
        + '물감 방울, 요정, 강화는 사라지고 갤러리와 눈은 남습니다.';
    }
  }

  // ---------- 위쪽 띠, 갤러리 ----------
  function drawTop() {
    const s = g.state;
    const pic = g.picture();
    $('drops').textContent = fmt(s.drops);
    $('rate').textContent = fmtRate(g.workPerSecond());
    if (pic) {
      const p = g.progress();
      $('pictureTitle').textContent = `${pic.title}, ${pic.artist}, ${pic.year}`;
      $('pictureProgress').textContent = `그림 ${s.gallery.length + 1}/${PICS.length}, ${p.done}/${p.total}칸`;
    } else {
      $('pictureTitle').textContent = s.finished ? '모든 그림을 되살렸습니다' : '더 고운 눈을 기다리는 중';
      $('pictureProgress').textContent = `그림 ${s.gallery.length}/${PICS.length}`;
    }
  }

  function drawGallery() {
    if (galleryShown === g.state.gallery.length) return;
    galleryShown = g.state.gallery.length;
    const box = $('gallery');
    box.querySelectorAll('.thumb').forEach((el) => el.remove());
    $('galleryEmpty').hidden = galleryShown > 0;
    for (const id of g.state.gallery) {
      const pic = BY_ID.get(id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'thumb';
      button.title = `${pic.title}, ${pic.artist}, ${pic.year}`;
      button.setAttribute('aria-label', button.title);
      const c = document.createElement('canvas');
      c.width = c.height = pic.tier;
      paintPicture(c.getContext('2d'), pic, 0, 0, 1);
      button.append(c);
      box.append(button);
    }
    box.scrollLeft = box.scrollWidth;
  }

  // ---------- 오른쪽 패널 ----------
  const maxed = (config, level) => level >= (config.maxLevel || Infinity);
  const ITEMS = {
    fairies: () => TYPES.map((type) => ({
      id: type, unit: '방울',
      count: () => `${g.state.fairies[type]}마리`,
      cost: () => g.fairyCost(type), funds: () => g.state.drops, buy: () => g.buyFairy(type), done: () => false,
    })),
    upgrades: () => Object.keys(CONFIG.upgrades).map((id) => ({
      id, unit: '방울',
      count: () => (CONFIG.upgrades[id].maxLevel === 1 ? '' : `${g.state.upgrades[id] || 0}단계`),
      cost: () => g.upgradeCost(id), funds: () => g.state.drops, buy: () => g.buyUpgrade(id),
      done: () => maxed(CONFIG.upgrades[id], g.state.upgrades[id] || 0),
    })),
    eyes: () => Object.keys(CONFIG.eyeUpgrades).map((id) => ({
      id, unit: '눈',
      count: () => (CONFIG.eyeUpgrades[id].maxLevel === 1 ? '' : `${g.state.eyeUpgrades[id] || 0}단계`),
      cost: () => g.eyeUpgradeCost(id), funds: () => g.state.eyes, buy: () => g.buyEyeUpgrade(id),
      done: () => maxed(CONFIG.eyeUpgrades[id], g.state.eyeUpgrades[id] || 0),
    })),
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function buildList() {
    const list = $('list');
    list.replaceChildren();
    rows = [];
    if (tab === 'eyes') {
      const eyes = el('p', 'eyes');
      list.append(eyes, el('p', 'note', '한 해상도의 그림을 모두 되살리면 더 고운 눈을 뜰 수 있습니다. 그때 얻는 눈으로 사라지지 않는 강화를 삽니다.'));
      rows.push(() => { eyes.textContent = `눈 ${fmt(g.state.eyes)}개`; });
    }
    for (const item of ITEMS[tab]()) {
      const row = el('div', 'item');
      const head = el('div');
      const count = el('span', 'count');
      head.append(el('span', 'name', NAMES[item.id] || item.id), ' ', count);
      const button = el('button');
      button.type = 'button';
      button.addEventListener('click', () => { item.buy(); });
      row.append(head, button, el('div', 'desc', DESCRIPTIONS[item.id] || ''));
      list.append(row);
      rows.push(() => {
        const done = item.done();
        count.textContent = item.count();
        button.textContent = done ? '완료' : `${fmt(Math.ceil(item.cost()))} ${item.unit}`;
        button.disabled = done || item.funds() < item.cost();
      });
    }
  }

  document.querySelectorAll('#tabs button').forEach((button) => {
    button.addEventListener('click', () => {
      tab = button.dataset.tab;
      document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b === button)));
      buildList();
    });
  });

  // ---------- 입력 ----------
  let visited = null; // 한 번 끄는 동안 이미 칠한 칸
  function strokeAt(event) {
    const pic = g.picture();
    if (!pic) return;
    const x = Math.floor((event.offsetX / canvas.clientWidth) * pic.tier);
    const y = Math.floor((event.offsetY / canvas.clientHeight) * pic.tier);
    const key = y * pic.tier + x;
    if (visited.has(key)) return;
    visited.add(key);
    g.click(x, y);
  }
  canvas.addEventListener('pointerdown', (event) => {
    visited = new Set();
    canvas.setPointerCapture(event.pointerId);
    strokeAt(event);
  });
  canvas.addEventListener('pointermove', (event) => { if (visited) strokeAt(event); });
  const endStroke = () => { visited = null; };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  // 키보드로도 칠할 수 있게: 안 끝난 첫 칸에 붓질 한 번.
  $('strokeButton').addEventListener('click', () => {
    const pic = g.picture();
    const i = pic && g.targets('brush')[0];
    if (pic && i !== undefined) g.click(i % pic.tier, Math.floor(i / pic.tier));
  });
  $('prestigeButton').addEventListener('click', () => { if (g.prestige()) { buildList(); save(); } });

  // ---------- 설정, 알림 ----------
  function notice(text) { $('noticeText').textContent = text; $('notice').showModal(); }
  $('closeNotice').addEventListener('click', () => $('notice').close());
  $('openSettings').addEventListener('click', () => {
    $('settingsMessage').textContent = '';
    $('saveText').value = '';
    $('settings').showModal();
  });
  $('closeSettings').addEventListener('click', () => $('settings').close());
  $('exportSave').addEventListener('click', () => {
    save();
    $('saveText').value = Save.serialize(g.state);
    $('saveText').select();
    $('settingsMessage').textContent = '문자열을 복사해 보관하세요.';
  });
  $('importSave').addEventListener('click', () => {
    const loaded = Save.deserialize($('saveText').value.trim(), PICTURES);
    if (!loaded) { $('settingsMessage').textContent = '저장 문자열이 올바르지 않습니다. 지금 진행은 그대로입니다.'; return; }
    start(loaded);
    save();
    $('settingsMessage').textContent = '불러왔습니다.';
  });
  $('resetSave').addEventListener('click', () => {
    if (!window.confirm('모든 진행을 지우고 처음부터 시작할까요? 되돌릴 수 없습니다.')) return;
    start(null);
    save();
    $('settingsMessage').textContent = '처음부터 다시 시작합니다.';
  });

  // ---------- 시작과 루프 ----------
  start(Save.load(storage, CONFIG, PICTURES));
  const away = Save.applyOffline(g, Date.now(), CONFIG);
  if (away.cells > 0) {
    notice(`자리를 비운 동안 요정들이 ${fmt(away.cells)}칸을 칠했습니다.`
      + (away.pictures ? ` 그림 ${away.pictures}장을 완성했습니다.` : ''));
  }

  let last = performance.now();
  let sinceSave = 0;
  function frame(now) {
    // 탭이 가려졌다 돌아오면 dt가 크다. 규칙 쪽이 잘게 나눠 처리한다.
    const dt = Math.min(Math.max(0, (now - last) / 1000), CONFIG.offline.maxSeconds);
    last = now;
    g.tick(dt);
    sinceSave += dt;
    if (sinceSave >= CONFIG.save.intervalSeconds) { sinceSave = 0; save(); }
    drawStage(now);
    drawTop();
    drawGallery();
    for (const update of rows) update();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save); // 새로 고침이나 창 닫기에서는 위 이벤트가 안 올 수 있다

  // 콘솔에서 상태를 들여다보거나 시험할 때 쓴다.
  window.lostCanvas = { get game() { return g; } };
})();
