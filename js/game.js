'use strict';
// 게임 규칙. 화면을 모른다. 브라우저(전역 Game)와 Node(require) 양쪽에서 돈다.
const Game = (function () {
  // 도형을 픽셀 좌표의 판정 함수와 경계 상자로 바꾼다.
  function compileShape(shape, width, height) {
    if (shape.circle || shape.ellipse) {
      const [cx, cy, rx, ryRaw] = shape.circle ? [...shape.circle, shape.circle[2]] : shape.ellipse;
      const px = cx * width, py = cy * height, rxp = rx * width, ryp = ryRaw * width; // 반지름은 둘 다 가로 기준
      return {
        box: [px - rxp, py - ryp, px + rxp, py + ryp],
        hit: (x, y) => ((x - px) / rxp) ** 2 + ((y - py) / ryp) ** 2 <= 1,
      };
    }
    const pts = shape.poly.map(([x, y]) => [x * width, y * height]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return {
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      hit: (x, y) => { // 짝홀 규칙
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      },
    };
  }

  function rasterizeRegions(regions, width, height) {
    const UNSET = 255;
    const index = new Uint8Array(width * height).fill(UNSET);
    const sizes = new Array(regions.length).fill(0);
    const rest = regions.findIndex((r) => r.rest);
    regions.forEach((region, r) => {
      for (const shape of region.shapes || []) {
        const { box, hit } = compileShape(shape, width, height);
        const x0 = Math.max(0, Math.floor(box[0])), y0 = Math.max(0, Math.floor(box[1]));
        const x1 = Math.min(width - 1, Math.ceil(box[2])), y1 = Math.min(height - 1, Math.ceil(box[3]));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const i = y * width + x;
            if (index[i] === UNSET && hit(x + 0.5, y + 0.5)) { index[i] = r; sizes[r]++; }
          }
        }
      }
    });
    for (let i = 0; i < index.length; i++) if (index[i] === UNSET) { index[i] = rest; sizes[rest]++; }
    return { index, sizes };
  }

  return { rasterizeRegions };
})();

if (typeof module !== 'undefined') module.exports = Game;
