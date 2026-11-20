'use strict';
// 다 채운 영역이 그림 안에서 움직이는 연출. 칠한 그림 위에 덧그리기만 하고 진행 상태는 건드리지 않는다.
// 효과: twinkle(별), glow(달), flow(소용돌이), ripple(하늘), sway(사이프러스), flicker(창문 불빛).
const Living = (function () {
  const TAU = Math.PI * 2;
  const CELL = 6; // 흐름과 일렁임은 이 크기의 칸 단위로 낮은 해상도에서 계산해 늘려 그린다

  function create(g, colorData) {
    const W = g.width, H = g.height;
    const defs = typeof REGIONS !== 'undefined' ? REGIONS : [];

    // 영역마다 경계 상자
    const boxes = g.regions.map(() => ({ x0: W, y0: H, x1: -1, y1: -1 }));
    for (let i = 0; i < g.total; i++) {
      const b = boxes[g.regionIndex[i]], x = i % W, y = (i - x) / W;
      if (x < b.x0) b.x0 = x;
      if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y;
      if (y > b.y1) b.y1 = y;
    }

    const effects = g.regions.map((region, r) => {
      const box = boxes[r];
      if (box.x1 < 0) return null;
      const seed = r * 1.7 + 0.3;
      switch (region.effect) {
        case 'twinkle': return twinkle(box, seed);
        case 'glow': return glow(box);
        case 'flow': return flow(g, r, box);
        case 'ripple': return ripple(g, r, box);
        case 'sway': return sway(g, r, box, colorData);
        case 'flicker': return flicker(defs.find((d) => d.id === region.id), W, H);
        default: return null;
      }
    });

    function draw(ctx, view, now) {
      const t = now / 1000;
      ctx.save();
      g.regions.forEach((region, r) => {
        if (effects[r] && region.painted === region.size) effects[r](ctx, view, t);
      });
      ctx.restore();
    }
    return { draw };
  }

  const toScreen = (view, x, y) => [x * view.scale + view.offsetX, y * view.scale + view.offsetY];

  function radialGlow(ctx, view, cx, cy, radius, color, alpha) {
    const [sx, sy] = toScreen(view, cx, cy);
    const sr = radius * view.scale;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, `rgba(${color}, ${alpha})`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 별: 빛무리가 천천히 커졌다 작아진다. 별마다 주기와 박자가 다르다.
  function twinkle(box, seed) {
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, r = (box.x1 - box.x0) / 2;
    const period = 2.2 + (seed * 7.3) % 2.5;
    return (ctx, view, t) => {
      const k = 0.5 + 0.5 * Math.sin((t / period) * TAU + seed * 5);
      radialGlow(ctx, view, cx, cy, r * (0.9 + 0.5 * k), '255, 240, 170', 0.12 + 0.3 * k);
      // 가운데 반짝이는 십자
      const [sx, sy] = toScreen(view, cx, cy);
      const len = r * view.scale * (0.3 + 0.5 * k), w = Math.max(1, view.scale * 0.8);
      ctx.globalAlpha = 0.25 + 0.5 * k;
      ctx.fillStyle = '#fffbe6';
      ctx.fillRect(sx - len, sy - w / 2, len * 2, w);
      ctx.fillRect(sx - w / 2, sy - len, w, len * 2);
      ctx.globalAlpha = 1;
    };
  }

  // 달: 은은한 빛무리가 숨 쉬듯 아주 느리게 변한다.
  function glow(box) {
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, r = (box.x1 - box.x0) / 2;
    return (ctx, view, t) => {
      const k = 0.5 + 0.5 * Math.sin((t / 7) * TAU);
      radialGlow(ctx, view, cx, cy, r * 1.4, '255, 225, 120', 0.1 + 0.15 * k);
    };
  }

  // 영역의 낮은 해상도 가리개: 칸 가운데가 영역에 속하면 1.
  function lowMask(g, r, box) {
    const cols = Math.ceil((box.x1 - box.x0 + 1) / CELL), rows = Math.ceil((box.y1 - box.y0 + 1) / CELL);
    const mask = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = Math.min(box.x1, box.x0 + i * CELL + (CELL >> 1)), y = Math.min(box.y1, box.y0 + j * CELL + (CELL >> 1));
        mask[j * cols + i] = g.regionIndex[y * g.width + x] === r ? 1 : 0;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = cols; canvas.height = rows;
    const cctx = canvas.getContext('2d');
    return { cols, rows, mask, canvas, cctx, image: cctx.createImageData(cols, rows) };
  }

  // 낮은 해상도에서 칸마다 밝기를 정해 부드럽게 늘려 더한다.
  function lightField(g, r, box, brightness, color) {
    const m = lowMask(g, r, box);
    return (ctx, view, t) => {
      const d = m.image.data;
      for (let j = 0, k = 0; j < m.rows; j++) {
        for (let i = 0; i < m.cols; i++, k++) {
          const a = m.mask[k] ? brightness(box.x0 + i * CELL, box.y0 + j * CELL, t) : 0;
          d[k * 4] = color[0]; d[k * 4 + 1] = color[1]; d[k * 4 + 2] = color[2];
          d[k * 4 + 3] = Math.max(0, Math.min(255, a * 255));
        }
      }
      m.cctx.putImageData(m.image, 0, 0);
      const [sx, sy] = toScreen(view, box.x0, box.y0);
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(m.canvas, sx, sy, m.cols * CELL * view.scale, m.rows * CELL * view.scale);
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false;
    };
  }

  // 소용돌이: 밝은 띠가 중심을 돌며 흐른다.
  function flow(g, r, box) {
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    return lightField(g, r, box, (x, y, t) => {
      const dx = x - cx, dy = y - cy;
      const band = Math.sin(Math.atan2(dy, dx) * 2 + Math.hypot(dx, dy) * 0.06 - t * 0.9);
      return Math.max(0, band) ** 6 * 0.28;
    }, [200, 220, 255]);
  }

  // 하늘: 아주 느리고 옅은 일렁임.
  function ripple(g, r, box) {
    return lightField(g, r, box, (x, y, t) => {
      const v = Math.sin(x * 0.02 + t * 0.35) * Math.sin(y * 0.03 - t * 0.25 + x * 0.004);
      return Math.max(0, v) * 0.09;
    }, [170, 200, 255]);
  }

  // 사이프러스: 줄마다 가로로 조금씩 밀어 위쪽일수록 크게 흔들린다.
  function sway(g, r, box, colorData) {
    const w = box.x1 - box.x0 + 1, h = box.y1 - box.y0 + 1;
    const sprite = document.createElement('canvas');
    sprite.width = w; sprite.height = h;
    const sctx = sprite.getContext('2d');
    const img = sctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (box.y0 + y) * g.width + box.x0 + x;
        if (g.regionIndex[i] !== r) continue;
        const p = (y * w + x) * 4;
        img.data[p] = colorData[i * 4]; img.data[p + 1] = colorData[i * 4 + 1];
        img.data[p + 2] = colorData[i * 4 + 2]; img.data[p + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);
    const STRIP = 3;
    return (ctx, view, t) => {
      ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < h; y += STRIP) {
        const lift = 1 - y / h; // 위쪽일수록 1
        const dx = Math.sin(t * 1.1 + y * 0.012) * 2.2 * lift * lift;
        const [sx, sy] = toScreen(view, box.x0 + dx, box.y0 + y);
        const sh = Math.min(STRIP, h - y);
        ctx.drawImage(sprite, 0, y, w, sh, sx, sy, w * view.scale, sh * view.scale);
      }
    };
  }

  // 창문 불빛: 창마다 따로 켜졌다 꺼진다.
  function flicker(def, W, H) {
    const lights = ((def && def.shapes) || []).filter((s) => s.circle).map((s, k) => ({
      x: s.circle[0] * W, y: s.circle[1] * H, r: s.circle[2] * W * 2.2,
      rate: 0.35 + ((k * 0.37) % 0.5), phase: k * 2.1,
    }));
    return (ctx, view, t) => {
      for (const l of lights) {
        const on = Math.sin(t * l.rate * TAU * 0.25 + l.phase) > -0.35;
        const flick = 0.85 + 0.15 * Math.sin(t * 9 + l.phase * 3);
        if (on) radialGlow(ctx, view, l.x, l.y, l.r, '255, 200, 90', 0.55 * flick);
      }
    };
  }

  return { create };
})();

if (typeof module !== 'undefined') module.exports = Living;
