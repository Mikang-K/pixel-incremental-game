# 별이 빛나는 밤 한 장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 명화 22장 게임을 걷어 내고, 「별이 빛나는 밤」 한 장(약 130만 픽셀)을 손으로 골라 찍다가 점점 요정이 알아서 번져 가며 완성하는 PC 브라우저 게임으로 바꾼다.

**Architecture:** 규칙(`js/game.js`)은 픽셀마다 칠함 여부와 영역 번호를 배열로 들고 있는 순수 자바스크립트이고, 화면을 모르며 Node에서 검사와 시뮬레이션이 돈다. 영역은 정규화 좌표의 도형 목록(`js/regions.js`)을 규칙이 시작할 때 픽셀로 바꾼다. 그림 색은 화면만 필요하므로 PNG를 데이터 주소 문자열로 담은 `js/painting-image.js`를 화면만 읽는다.

**Tech Stack:** HTML, CSS, Canvas 2D, 순수 자바스크립트(빌드, 의존성 없음), Node 내장 `node:test`, 그림 변환은 Windows PowerShell의 .NET `System.Drawing`.

**Spec:** `docs/superpowers/specs/2026-11-20-starry-night-design.md`

## Global Constraints

- `index.html`을 더블클릭(file://)해서 실행된다. ES 모듈, fetch, 번들러, npm 의존성 없음. 일반 `<script src>`와 전역(`CONFIG`, `REGIONS`, `PAINTING_IMAGE`, `Game`, `Save`).
- 각 js 파일 끝에 `if (typeof module !== 'undefined') module.exports = ...`.
- 균형 숫자와 해상도는 `js/config.js`에만 둔다. 다른 파일에 숫자 상수를 박지 않는다(화면 연출의 순수 미술 값은 예외).
- 화면 글자는 한글, 가운뎃점을 쓰지 않는다. 최소 화면 폭 1280px.
- 게임이 열려 있을 때만 진행한다. 오프라인 진행, 프레스티지, 줄 단위 칠하기, 작업 영역 지정은 만들지 않는다.
- 붓 크기는 최대 3x3.
- 그림 원본은 퍼블릭 도메인 스캔. 내려받기 전에 파일명, 주소, 크기를 사용자에게 알리고 허락을 받는다. 원본 대용량 파일은 저장소에 넣지 않는다(`.gitignore`).
- 로그 파일이 필요하면 저장소 루트 `logs/`.
- 작업마다 커밋한다. 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- 검사 명령: `node --test` (저장소 루트, 자동 탐색).

## Review Focus

1. 해상도 설정을 바꾼 뒤 예전 저장을 불러올 때: 깨지지 않고 새 게임으로 시작한다. (Task 4)
2. 컴퓨터가 잠들었다 깨서 프레임 사이 간격이 매우 클 때: 그 간격은 진행에 들어가지 않는다. (Task 3, Task 6)
3. 그림 가장자리, 이미 칠한 자리, 손 찍기 한도를 다 쓴 상태에서 누르기: 칠해지지 않고 포인트도 없다. 붓이 그림 밖으로 걸칠 때는 안쪽만 칠한다. (Task 2)
4. 아무것도 칠하지 않은 상태에서 요정이 열렸을 때, 남은 픽셀이 하나뿐일 때: 요정이 멈추거나 무한 반복하지 않는다. (Task 3)
5. 저장 문자열이 잘렸거나 다른 게임의 문자열일 때, 파일 불러오기로 그림 파일 같은 엉뚱한 파일을 고를 때: 현재 진행을 유지하고 안내 문구를 띄운다. (Task 4, Task 6)

## File Structure

```
index.html                 화면 뼈대 (다시 씀)
style.css                  배색과 배치 (이전 것 유지, 필요한 만큼 수정)
js/config.js               CONFIG: 해상도, 손, 요정, 강화, 영역 보너스, 저장, 프레임 간격 한도 (다시 씀)
js/regions.js              REGIONS: 영역 목록과 도형(정규화 좌표) (새로)
js/painting-image.js       PAINTING_IMAGE: PNG 데이터 주소 문자열 (생성물, 새로)
js/game.js                 Game: 규칙 (다시 씀)
js/save.js                 Save: 직렬화, 압축, 검증, 저장소 (다시 씀)
js/ui.js                   화면: 그리기, 확대 이동, 입력, 연출, 패널, 저장 (다시 씀)
js/living.js               살아나는 영역 연출 (새로)
tests/fixtures.js          작은 설정과 작은 영역 (다시 씀)
tests/regions.test.js      영역 데이터와 픽셀화 (새로)
tests/game.test.js         (다시 씀)
tests/save.test.js         (다시 씀)
tools/build-painting.ps1   원본 그림을 해상도에 맞춰 줄이고 painting-image.js 생성 (새로)
tools/regions.html         그림 위에 영역을 색으로 겹쳐 보는 확인 페이지 (새로)
tools/simulate.js          속도 시뮬레이션 (다시 씀)
지움: js/pictures.js, tests/pictures.test.js, tools/preview.html
```

## 공통 정의 (모든 작업이 참조)

`CONFIG` 시작값. Task 7에서 시뮬레이션을 보며 조정한다.

```js
const CONFIG = {
  painting: { width: 1280, height: 1014 },
  hand: { baseRate: 3, burstSeconds: 2 },              // 초당 손 찍기 한도, 쌓아 둘 수 있는 초
  points: { perPixel: 1 },
  fairies: { unlockAtPainted: 15000, baseRate: 2 },    // 열리는 칠한 픽셀 수, 한 마리 초당 픽셀
  upgrades: {
    handSpeed:     { baseCost: 10,   costGrowth: 1.6,  add: 1 },          // 손 한도 +1/초
    pointsPerPixel:{ baseCost: 50,   costGrowth: 1.9,  multiplier: 1.5 },
    brushSize:     { baseCost: 2000, costGrowth: 40,   maxLevel: 2 },     // 1 -> 2x2 -> 3x3
    fairyHire:     { baseCost: 300,  costGrowth: 1.18 },                  // 요정 +1, 잠김
    fairySpeed:    { baseCost: 1500, costGrowth: 2.2,  multiplier: 1.4 }, // 잠김
  },
  regions: { firstTouchBonus: 25, completeBonusPerPixel: 0.2 },
  frame: { maxGapSeconds: 5 },
  save: { intervalSeconds: 10, storageKey: 'starryNightSave' },
  ui: { minZoom: 'fit', maxPixelSize: 24, maxFairyDots: 40 },
};
```

영역 데이터. 좌표는 0에서 1(가로는 width, 세로는 height 기준).

```js
REGIONS = [
  { id: 'star-1', name: '별', effect: 'twinkle', shapes: [{ circle: [cx, cy, r] }] },   // 별 11개, r은 가로 기준
  { id: 'moon', name: '달', effect: 'glow', shapes: [...] },
  { id: 'windows', name: '마을 창문 불빛', effect: 'flicker', shapes: [{ circle: [...] }, ...] },
  { id: 'cypress', name: '사이프러스', effect: 'sway', shapes: [{ poly: [[x, y], ...] }] },
  { id: 'village', name: '교회와 마을', effect: 'none', shapes: [...] },
  { id: 'swirl', name: '큰 소용돌이', effect: 'flow', shapes: [{ ellipse: [cx, cy, rx, ry] }] },
  { id: 'hills', name: '언덕', effect: 'none', shapes: [...] },
  { id: 'sky', name: '하늘', effect: 'ripple', rest: true },   // 정확히 하나, 맨 끝
];
```

규칙: 목록 앞쪽 도형이 이긴다. `rest: true` 영역은 어느 도형에도 들지 않은 모든 픽셀을 받는다. 도형 종류는 `circle`, `ellipse`, `poly` 세 가지.

---

### Task 1: 영역 데이터와 픽셀화, 이전 게임 걷어 내기

**Files:**
- Delete: `js/pictures.js`, `tests/pictures.test.js`, `tools/preview.html`, `tests/game.test.js`, `tests/save.test.js`(Task 2, 4에서 새로 씀)
- Create: `js/regions.js`(이 작업에서는 별 하나, 달, 하늘 정도의 임시 도형. 진짜 경계는 Task 5), `tests/regions.test.js`
- Rewrite: `js/config.js`(공통 정의), `tests/fixtures.js`
- Modify: `js/game.js`에 `Game.rasterizeRegions`만 남기고 나머지는 Task 2에서 다시 씀. 이전 코드는 지운다.

**Interfaces:**
- Produces: `Game.rasterizeRegions(regions, width, height) -> { index: Uint8Array(width*height), sizes: number[] }`. 픽셀 중심 `((x + 0.5) / width, (y + 0.5) / height)`로 판정. 원과 타원의 반지름은 가로 기준 정규화 값이며 세로 판정에는 `width / height`를 곱해 실제로 둥글게 한다. 다각형은 짝홀 규칙.
- `tests/fixtures.js`: `testConfig()`(공통 정의를 글자 그대로 복사하되 `painting: { width: 10, height: 8 }`, `hand.baseRate: 4`, `fairies.unlockAtPainted: 5`), `testRegions()`:

```js
[
  { id: 'dot', name: '점', effect: 'twinkle', shapes: [{ circle: [0.25, 0.25, 0.1] }] },
  { id: 'box', name: '상자', effect: 'none', shapes: [{ poly: [[0.6, 0.5], [1, 0.5], [1, 1], [0.6, 1]] }] },
  { id: 'rest', name: '나머지', effect: 'ripple', rest: true },
]
```

- [ ] **Step 1: 실패하는 검사** (`tests/regions.test.js`)

```js
test('모든 픽셀이 정확히 한 영역에 속한다', () => {
  const { index, sizes } = Game.rasterizeRegions(testRegions(), 10, 8);
  assert.equal(index.length, 80);
  assert.equal(sizes.reduce((a, b) => a + b, 0), 80);
  for (const r of index) assert.ok(r < 3);
});
test('도형 안의 픽셀은 그 영역, 밖은 나머지 영역', () => {
  const { index } = Game.rasterizeRegions(testRegions(), 10, 8);
  assert.equal(index[2 * 10 + 2], 0);   // 원 중심 근처 (x=2,y=2)
  assert.equal(index[7 * 10 + 9], 1);   // 오른쪽 아래 상자
  assert.equal(index[0], 2);
});
test('앞에 적힌 영역이 겹친 픽셀을 가져간다', () => {
  const r = [{ id: 'a', shapes: [{ poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }] },
             { id: 'b', shapes: [{ circle: [0.5, 0.5, 0.3] }] }, { id: 'c', rest: true }];
  const { sizes } = Game.rasterizeRegions(r, 10, 8);
  assert.deepEqual(sizes, [80, 0, 0]);
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
```

- [ ] **Step 2:** `node --test` 실행, 실패 확인.
- [ ] **Step 3:** 구현. 도형마다 경계 상자를 미리 구해 그 안의 픽셀만 검사한다(130만 픽셀 x 20여 도형).
- [ ] **Step 4:** `node --test` 통과. `node -e "console.time('r');require('./js/game.js').rasterizeRegions(require('./js/regions.js'),1280,1014);console.timeEnd('r')"`가 1초 안쪽.
- [ ] **Step 5:** 커밋 `refactor: 명화 22장을 걷어 내고 영역 픽셀화 추가`

### Task 2: 손으로 찍기, 포인트, 강화, 영역 사건

**Files:** Rewrite `js/game.js`(Task 1의 `rasterizeRegions` 유지), Create `tests/game.test.js`

**Interfaces:**
- Produces:
  - `Game.create(config, regions, saved?) -> g`. `saved`는 Task 4의 `Save.deserialize` 결과(`{ points, upgrades, time, painted: Uint8Array }`) 또는 없음.
  - `g.width`, `g.height`, `g.total`, `g.regions`(`[{ id, name, effect, size, painted }]`, `painted`는 칠한 수), `g.regionIndex`(Uint8Array), `g.painted`(Uint8Array, 0 또는 1)
  - `g.state`: `{ points, upgrades: {}, time, paintedCount }`
  - `g.paint(x, y) -> number` 새로 칠한 픽셀 수. 붓은 `(x, y)`를 왼쪽 위로 하는 `size x size` 정사각형(size = 1 + brushSize 레벨). 그림 밖, 칠한 픽셀은 건너뛴다. 손 예산(`g.handBudget()`)이 칠할 픽셀 수만큼 있어야 하고 모자라면 있는 만큼만 칠한다.
  - `g.handRate() -> number` = `hand.baseRate + handSpeed.add * 레벨`, `g.handBudget() -> number`(시작값 `handRate * burstSeconds`, 최대도 같음)
  - `g.tick(dt)`: `dt`가 0 이하, 숫자 아님, `frame.maxGapSeconds` 초과면 아무것도 안 한다(시간도 안 셈). 손 예산을 `handRate * dt`만큼 채운다(상한까지). Task 3이 요정을 여기에 붙인다.
  - `g.cost(id) -> number` = `baseCost * costGrowth ** 레벨`, `g.canBuy(id) -> boolean`, `g.buy(id) -> boolean`, `g.isLocked(id) -> boolean`(Task 3 전까지는 `fairyHire`, `fairySpeed`가 항상 잠김), `g.level(id)`
  - `g.pointsPerPixel() -> number` = `points.perPixel * pointsPerPixel.multiplier ** 레벨`
  - `g.drainPainted() -> number[]` 마지막 호출 뒤 칠해진 픽셀 번호(화면 갱신용). `g.drainEvents() -> Array<{ type: 'regionStarted' | 'regionCompleted' | 'finished' | 'fairiesUnlocked', region? }>`
  - 영역 보너스: 영역의 첫 픽셀을 칠하면 `regions.firstTouchBonus` 포인트, 영역을 다 채우면 `size * completeBonusPerPixel` 포인트. 마지막 픽셀이 칠해지면 `finished` 사건.

픽셀 하나를 칠하는 일은 내부 함수 `paintPixel(i, by)` 하나로 모은다(포인트, 영역 수, 사건, drain 목록). Task 3의 요정도 이 함수를 쓴다.

- [ ] **Step 1: 실패하는 검사** (`tests/game.test.js`, `testConfig()`과 `testRegions()` 사용, 10x8)

```js
test('누른 자리가 칠해지고 포인트를 받는다', () => {
  const g = Game.create(testConfig(), testRegions());
  assert.equal(g.paint(0, 0), 1);
  assert.equal(g.painted[0], 1);
  assert.equal(g.state.paintedCount, 1);
  assert.equal(g.state.points, 1 + 25);           // 픽셀 1 + 나머지 영역 첫 칠 보너스
});
test('칠한 자리, 그림 밖, 정수가 아닌 좌표는 아무 일도 없다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.paint(0, 0); const p = g.state.points;
  for (const [x, y] of [[0, 0], [-1, 0], [10, 0], [0, 8], [0.5, 1], [NaN, 1]]) assert.equal(g.paint(x, y), 0);
  assert.equal(g.state.points, p);
});
test('손 예산을 다 쓰면 더 칠해지지 않고 시간이 지나면 다시 찬다', () => {
  const g = Game.create(testConfig(), testRegions());   // 한도 4/초, 2초치 = 8
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
  assert.equal(g.paint(9, 7), 1);      // 2x2 중 그림 안은 한 칸
  assert.equal(g.paint(0, 0), 4);
  assert.equal(g.buy('brushSize'), true);
  assert.equal(g.buy('brushSize'), false);   // 최대 3x3
});
test('강화 값은 살수록 오르고 포인트가 모자라면 못 산다', () => {
  const g = Game.create(testConfig(), testRegions());
  assert.equal(g.buy('handSpeed'), false);
  g.state.points = 26;
  assert.equal(g.buy('handSpeed'), true);
  assert.equal(g.state.points, 16);
  assert.equal(g.cost('handSpeed'), 16);
  assert.equal(g.handRate(), 5);
  assert.equal(g.buy('없는강화'), false);
});
test('요정 강화는 처음에 잠겨 있다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.state.points = 1e9;
  assert.equal(g.isLocked('fairyHire'), true);
  assert.equal(g.buy('fairyHire'), false);
});
test('영역을 처음 칠하면 시작, 다 채우면 완성 사건과 보너스', () => {
  const g = Game.create(testConfig(), testRegions());
  g.state.points = 0;
  const dot = g.regions.findIndex((r) => r.id === 'dot');
  const cells = [...g.regionIndex.keys()].filter((i) => g.regionIndex[i] === dot);
  g.drainEvents();
  for (const i of cells) { g.tick(1); g.paint(i % 10, Math.floor(i / 10)); }
  const ev = g.drainEvents();
  assert.deepEqual(ev[0], { type: 'regionStarted', region: dot });
  assert.deepEqual(ev[ev.length - 1], { type: 'regionCompleted', region: dot });
  assert.equal(g.regions[dot].painted, cells.length);
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
```

- [ ] **Step 2:** 실패 확인. **Step 3:** 구현. **Step 4:** `node --test` 통과.
- [ ] **Step 5:** 커밋 `feat: 손으로 찍기와 강화, 영역 사건`

### Task 3: 요정 (늦게 열리고 칠한 곳에서 번짐)

**Files:** Modify `js/game.js`, `tests/game.test.js`

**Interfaces:**
- Consumes: Task 2의 `paintPixel`, `tick`, `isLocked`.
- Produces: `g.fairyCount() -> number`(= `fairyHire` 레벨), `g.fairyRate() -> number` = `fairyCount * fairies.baseRate * fairySpeed.multiplier ** 레벨`, `g.fairiesUnlocked() -> boolean`(`paintedCount >= fairies.unlockAtPainted`이 한 번이라도 참이 된 뒤 영구. `create` 시점에도 판정한다. 상태 `state.fairiesUnlocked`에 저장). 열리는 순간 `fairiesUnlocked` 사건. 요정 칠은 `drainPainted`에 섞여 나오고, 별도로 `g.drainFairyPainted() -> number[]`로도 꺼낼 수 있다(화면의 빛 점 연출용, 상한 없이 쌓이지 않게 마지막 `ui.maxFairyDots`개만 보관).
- `tick(dt)`에서 요정 작업량 `fairyRate * dt`를 누적하고 정수 부분만큼 픽셀을 칠한다(소수는 다음 tick으로 이월).

**다음 픽셀 고르기** (검사만으로 정해지지 않으므로 명시):

1. 가장자리 목록: 안 칠한 픽셀 중 칠한 픽셀과 상하좌우로 맞닿은 것들의 배열과 "목록에 있음" 표시 배열. 픽셀이 칠해질 때마다(손이든 요정이든) 그 이웃 중 안 칠했고 목록에 없는 것을 넣는다. 저장에서 불러올 때는 전체를 한 번 훑어 다시 만든다.
2. 고르기: 목록에서 무작위로 둘을 뽑아(이미 칠해진 것이면 버리고 다시 뽑기, 버릴 때는 끝 원소와 바꿔 지움) 그중 "영역이 시작은 됐고 완성 비율이 더 높은" 쪽을 고른다. 이 두 후보 비교가 이미 시작된 영역을 조금 더 자주 채우는 장치다.
3. 목록이 비었으면(아무것도 안 칠했거나 칠한 곳이 모두 둘러싸여 끝난 경우) 안 칠한 픽셀을 무작위 위치부터 훑어 하나 찾는다. 하나도 없으면 멈춘다.
4. 무작위 함수는 `Game.create`에 `config.seed`가 있으면 그 값으로 시작하는 작은 의사 난수(mulberry32)를 쓴다. 검사와 시뮬레이션이 같은 결과를 내게 하려는 것이다.

- [ ] **Step 1: 실패하는 검사**

```js
const paintRange = (g, from, to) => { for (let i = from; i < to; i++) { g.tick(1); g.paint(i % 10, Math.floor(i / 10)); } };
test('정해진 수만큼 칠하기 전에는 요정이 잠겨 있고 넘으면 열린다', () => {
  const g = Game.create(testConfig(), testRegions());   // 5픽셀에서 열림
  paintRange(g, 0, 4);
  assert.equal(g.fairiesUnlocked(), false);
  paintRange(g, 4, 5);
  assert.equal(g.fairiesUnlocked(), true);
  assert.equal(g.isLocked('fairyHire'), false);
  assert.ok(g.drainEvents().some((e) => e.type === 'fairiesUnlocked'));
});
test('요정은 칠한 곳과 맞닿은 자리부터 칠한다', () => {
  const config = { ...testConfig(), seed: 1 };
  config.fairies = { ...config.fairies, unlockAtPainted: 1 };
  const g = Game.create(config, testRegions());
  g.paint(5, 4); g.drainPainted();
  g.state.points = 1e6; g.buy('fairyHire');
  g.tick(1);                                     // 초당 2
  const got = g.drainPainted();
  assert.equal(got.length, 2);
  for (const i of got) {
    const x = i % 10, y = Math.floor(i / 10);
    assert.ok(Math.abs(x - 5) + Math.abs(y - 4) <= 2, `멀리 떨어진 픽셀 ${i}`);
  }
});
test('요정의 소수 작업량은 다음 tick으로 넘어간다', () => {
  const config = { ...testConfig(), seed: 1 };
  config.fairies = { ...config.fairies, unlockAtPainted: 1 };
  const g = Game.create(config, testRegions());
  g.paint(0, 0); g.state.points = 1e6; g.buy('fairyHire'); g.drainPainted();
  g.tick(0.25); assert.equal(g.drainPainted().length, 0);
  g.tick(0.25); assert.equal(g.drainPainted().length, 1);
});
test('요정은 남은 픽셀을 모두 채우고 멈춘다', () => {
  const config = { ...testConfig(), seed: 3 };
  config.fairies = { ...config.fairies, unlockAtPainted: 1, baseRate: 1000 };
  const g = Game.create(config, testRegions());
  g.paint(0, 0); g.state.points = 1e6; g.buy('fairyHire');
  g.tick(1);
  assert.equal(g.state.paintedCount, 80);
  g.tick(1);                                      // 끝난 뒤에도 문제없이 돌아온다
  assert.ok(g.drainEvents().some((e) => e.type === 'finished'));
});
test('칠한 곳이 없어도 요정은 빈 자리를 찾아 칠한다', () => {
  const config = { ...testConfig(), seed: 2 };
  config.fairies = { ...config.fairies, unlockAtPainted: 0 };
  const g = Game.create(config, testRegions());
  g.state.points = 1e6; g.buy('fairyHire');
  g.tick(1);
  assert.equal(g.state.paintedCount, 2);
});
```

- [ ] **Step 2:** 실패 확인. **Step 3:** 구현. **Step 4:** 통과 확인.
- [ ] **Step 5:** `node -e`로 1280x1014, 요정 초당 10만 픽셀, `tick(1)` 15번이 2초 안쪽인지 확인(가장자리 목록이 커져도 느려지지 않는지).
- [ ] **Step 6:** 커밋 `feat: 칠한 곳에서 번져 가는 요정`

### Task 4: 저장 (압축, 검증, 파일)

**Files:** Rewrite `js/save.js`, Create `tests/save.test.js`

**Interfaces:**
- Consumes: `g.state`, `g.painted`, `g.width`, `g.height`
- Produces:
  - `Save.serialize(g) -> string`: `btoa(encodeURIComponent(JSON.stringify({ version: 2, width, height, points, upgrades, time, fairiesUnlocked, painted: rle })))`. `rle`는 칠하지 않은 구간부터 시작하는 구간 길이들을 36진수로 쉼표로 이은 문자열(`"0"`이 첫 값이면 칠한 구간부터).
  - `Save.deserialize(text, config) -> { points, upgrades, time, fairiesUnlocked, painted: Uint8Array } | null`. 다음이면 null: 문자열 아님, 해독 실패, `version !== 2`, `width`/`height`가 `config.painting`과 다름, 숫자가 아니거나 음수인 값, `upgrades`에 `config.upgrades`에 없는 키나 음이 아닌 정수가 아닌 값, `maxLevel` 초과, 구간 길이 합이 `width*height`가 아님, 구간에 0이 첫 자리 말고 있음.
  - `Save.load(storage, config) -> 위와 같음 | null`, `Save.store(storage, g, config)`: 둘 다 예외를 삼킨다.
  - `Game.create`는 `saved.painted`로 `paintedCount`, 영역별 `painted`, 가장자리 목록을 다시 계산한다.

- [ ] **Step 1: 실패하는 검사**

```js
test('저장했다 불러오면 칠한 픽셀과 포인트와 강화가 같다', () => {
  const g = Game.create(testConfig(), testRegions());
  g.paint(1, 1); g.paint(2, 1); g.state.points = 42; g.state.upgrades.handSpeed = 2;
  const back = Save.deserialize(Save.serialize(g), testConfig());
  assert.equal(back.points, 42);
  assert.deepEqual(back.upgrades, { handSpeed: 2 });
  assert.deepEqual([...back.painted], [...g.painted]);
  const h = Game.create(testConfig(), testRegions(), back);
  assert.equal(h.state.paintedCount, 2);
  assert.equal(h.regions.reduce((a, r) => a + r.painted, 0), 2);
});
test('칠한 곳이 뭉쳐 있으면 저장 문자열이 짧다', () => {
  const config = testConfig(); config.painting = { width: 1280, height: 1014 };
  const g = Game.create(config, testRegions());
  for (let i = 0; i < 400000; i++) g.painted[i] = 1;   // 앞쪽 30%를 칠한 상태 흉내
  assert.ok(Save.serialize(g).length < 2000);
});
test('깨지거나 다른 게임의 문자열은 null', () => {
  for (const t of ['', 'abc', null, 42, btoa('{"a":1}'), btoa(encodeURIComponent('null'))])
    assert.equal(Save.deserialize(t, testConfig()), null);
});
test('해상도가 바뀐 설정에서는 예전 저장을 쓰지 않는다', () => {
  const g = Game.create(testConfig(), testRegions());
  const other = testConfig(); other.painting = { width: 12, height: 8 };
  assert.equal(Save.deserialize(Save.serialize(g), other), null);
});
test('값이 이상한 저장은 null', () => {
  const g = Game.create(testConfig(), testRegions());
  const raw = () => JSON.parse(decodeURIComponent(atob(Save.serialize(g))));
  const pack = (o) => btoa(encodeURIComponent(JSON.stringify(o)));
  const cases = [
    (o) => { o.version = 1; }, (o) => { o.points = -1; }, (o) => { o.points = 'x'; },
    (o) => { o.upgrades = { 없는강화: 1 }; }, (o) => { o.upgrades = { brushSize: 9 }; },
    (o) => { o.painted = '1'; }, (o) => { o.painted = 'zz,1'; },
  ];
  for (const breakIt of cases) { const o = raw(); breakIt(o); assert.equal(Save.deserialize(pack(o), testConfig()), null); }
});
test('저장소에 넣고 꺼낼 수 있고 저장소가 예외를 던져도 죽지 않는다', () => {
  const data = {};
  const ok = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  const g = Game.create(testConfig(), testRegions()); g.paint(0, 0);
  Save.store(ok, g, testConfig());
  assert.equal(Save.load(ok, testConfig()).painted[0], 1);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(Save.load(bad, testConfig()), null);
  Save.store(bad, g, testConfig());
});
```

- [ ] **Step 2:** 실패 확인. **Step 3:** 구현. **Step 4:** 통과 확인.
- [ ] **Step 5:** 커밋 `feat: 압축 저장과 검증`

### Task 5: 그림 원본, 변환, 영역 경계

**Files:** Create `tools/build-painting.ps1`, `js/painting-image.js`(생성물), `tools/regions.html`; Modify `js/regions.js`, `.gitignore`(`source/`), `README.md`(출처)

- [ ] **Step 1: 멈추고 사용자에게 허락받기.** 받을 파일: 위키미디어 공용의 `Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg`를 가로 2560픽셀로 줄인 판. 주소 `https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/2560px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg`. 받기 전에 `curl -sI`로 실제 크기를 확인해 함께 알린다. 허락이 없으면 이 작업을 멈추고 다음 작업들은 임시 그림(같은 해상도의 단색 그라데이션을 PowerShell로 생성)으로 진행한 뒤 보고한다.
- [ ] **Step 2:** 허락받으면 `source/starry-night-2560.jpg`로 받는다(`source/`는 git 제외).
- [ ] **Step 3:** `tools/build-painting.ps1 -Source <jpg> -Width <w> -Height <h>`: `System.Drawing`으로 고품질 축소(HighQualityBicubic) 후 PNG로 만들고, base64를 `js/painting-image.js`에 `const PAINTING_IMAGE = 'data:image/png;base64,...';`로 쓴다. 폭과 높이 기본값은 `js/config.js`에서 읽지 않고 인자로 받는다(스크립트가 단순하도록). 원작 비율과 달라지면 경고를 출력한다.
- [ ] **Step 4:** 실행: `powershell -NoProfile -File tools/build-painting.ps1 -Source source/starry-night-2560.jpg -Width 1280 -Height 1014`. 결과 파일 크기를 확인한다(수 MB 이하).
- [ ] **Step 5:** `tools/regions.html`: `../js/config.js`, `../js/regions.js`, `../js/painting-image.js`, `../js/game.js`를 싣고, 그림 위에 `rasterizeRegions` 결과를 영역마다 반투명 색으로 겹쳐 그리고 영역 이름과 픽셀 수 표를 보여 준다.
- [ ] **Step 6:** `js/regions.js`에 실제 경계를 적는다: 별 11개(id `star-1`에서 `star-11`), `moon`, `windows`, `cypress`, `village`, `swirl`, `hills`, `sky`(rest). 미리보기 페이지를 브라우저로 열어 스크린샷으로 보며 맞춘다. 기준: 별과 달 영역이 그 빛무리를 대략 덮고, 사이프러스가 줄기와 불꽃 모양 윤곽을 따르며, 별 하나는 수천 픽셀 규모.
- [ ] **Step 7:** `node --test` 통과(Task 1의 "실제 해상도에서 영역이 비어 있지 않다").
- [ ] **Step 8:** README에 출처(작품명, 작가, 연도, 위키미디어 공용 주소, 퍼블릭 도메인)를 적는다.
- [ ] **Step 9:** 커밋 `feat: 별이 빛나는 밤 그림과 영역`

### Task 6: 화면 (그리기, 확대 이동, 찍기, 패널, 저장)

**Files:** Rewrite `index.html`, `js/ui.js`; Modify `style.css`

**Interfaces:**
- Consumes: `CONFIG`, `REGIONS`, `PAINTING_IMAGE`, `Game`의 모든 공개 함수, `Save`. Task 7의 `Living`은 아직 없으므로 `typeof Living !== 'undefined'`일 때만 호출한다.

그리기 방식 (구현자가 정해도 되지만 아래 기준을 만족해야 함):
- 시작할 때 `PAINTING_IMAGE`를 그림 크기의 화면 밖 캔버스에 그려 색 픽셀(`ImageData`)을 얻는다. 데이터 주소 이미지라 file://에서도 읽힌다.
- 회색 픽셀은 이전 버전의 바랜 회색 공식(밝기 `70 + 0.3 * 원래 밝기`)으로 한 번 계산한다.
- 표시용 `ImageData`를 회색으로 만들고 칠한 픽셀만 색으로 바꾼다. 매 프레임 `drainPainted()`로 바뀐 픽셀만 고치고, 바뀐 범위의 사각형만 `putImageData`한다.
- 화면 캔버스에는 확대 배율과 이동값으로 `drawImage`(부드럽게 처리 끔)한다.

화면 요소 (설계 문서 3장):
- 위쪽 띠: 포인트, 손 찍기 초당 한도와 남은 예산, 요정 초당 픽셀(열리기 전에는 "아직 없음"), 진행률(소수 둘째 자리 %, 찍은 픽셀 / 전체).
- 확대 이동: 휠로 커서 기준 확대 축소(최소는 그림 전체가 화면에 맞는 배율, 최대는 픽셀 하나가 `ui.maxPixelSize` 화면 픽셀). 가운데 또는 오른쪽 버튼 끌기, 또는 스페이스를 누른 채 왼쪽 끌기로 이동. 처음 시작할 때는 화면에 맞춤.
- 찍기: 왼쪽 버튼 누르기와 끌기. 끄는 동안 지난 위치와 지금 위치 사이의 픽셀을 선으로 이어 `g.paint`(빠르게 끌어도 빈칸이 생기지 않게). 손 예산이 모자라면 칠해지지 않는다.
- 작은 전체 지도: 오른쪽 패널 위쪽. 그림 축소판, 현재 보이는 범위 사각형, 눌러서 이동.
- 오른쪽 패널: 강화 목록(이름, 레벨, 값, 설명, 사기 단추). 잠긴 강화는 "칠한 픽셀 N개를 넘으면 열립니다"로 표시.
- 연출: 손으로 칠한 픽셀과 요정이 칠한 픽셀(`drainFairyPainted`)에 짧은 반짝임. 요정 빛 점은 최근 칠한 자리로 날아가는 작은 점, 최대 `ui.maxFairyDots`개. 영역 시작과 완성, 요정 열림은 화면 위쪽에 잠깐 뜨는 알림(영역 이름 포함).
- 끝: `finished` 사건이 오면 화면을 그림 전체에 맞추고 "모든 픽셀을 되살렸습니다"와 걸린 시간(`state.time`), 찍은 픽셀 수를 짧게 보여 준다.
- 설정: 내보내기(글상자와 "파일로 받기", 파일 이름 `starry-night-save.txt`), 가져오기(글상자 또는 "파일에서 불러오기"), 초기화(확인 후). 가져오기 실패 시 "저장 문자열이 올바르지 않습니다. 지금 진행은 그대로입니다."
- 루프: `requestAnimationFrame`의 실제 경과 시간으로 `g.tick(dt)`(큰 간격은 규칙이 버린다). `save.intervalSeconds`마다, `visibilitychange`로 숨겨질 때, `pagehide` 때 저장.
- 한글 이름표: 손 빠르기, 픽셀당 포인트, 붓 크기, 요정 고용, 요정 속도.

- [ ] **Step 1:** 구현.
- [ ] **Step 2:** `node --test` 통과(규칙을 건드리지 않았는지).
- [ ] **Step 3:** 브라우저에서 확인하고 스크린샷을 남긴다:
  - 처음 화면에 회색 그림 전체가 보이고 콘솔 오류가 없다.
  - 확대해서 누르고 끌면 픽셀이 색을 되찾고, 빠르게 끌어도 선이 끊기지 않으며, 예산이 바닥나면 멈춘다.
  - 휠 확대가 커서 위치를 기준으로 하고, 끌어서 이동되며, 전체 지도 사각형이 따라온다.
  - 콘솔에서 포인트를 넣어 강화를 사면 패널이 바뀌고, 요정이 열리면 알림과 빛 점이 나온다.
  - 새로 고침해도 진행이 남는다. 가져오기에 `abc`, 파일 불러오기에 아무 그림 파일을 넣으면 안내가 뜨고 진행이 유지된다.
  - 콘솔에서 요정을 크게 늘려 끝까지 가면 끝 화면이 나온다.
  - 성능: 요정이 초당 수천 픽셀을 칠하는 상태에서 개발자 도구 성능 표시로 프레임이 55 이상.
- [ ] **Step 4:** 커밋 `feat: 한 장짜리 게임 화면`

### Task 7: 살아나는 영역

**Files:** Create `js/living.js`; Modify `index.html`(스크립트 추가), `js/ui.js`(호출)

**Interfaces:**
- Produces: `Living.create(g, colorImageData) -> living`, `living.draw(ctx, view, now)`. `view`는 `{ scale, offsetX, offsetY }`(그림 좌표 `(x, y)`가 화면 `(x * scale + offsetX, y * scale + offsetY)`). 완성된 영역(`g.regions[i].painted === size`)만 그린다. 진행 상태를 바꾸지 않는다.

효과별 최소 기준 (세부는 구현자가):
- `twinkle`(별): 영역 중심에 빛무리가 천천히 커졌다 작아진다. 별마다 주기와 시작 박자가 다르다.
- `glow`(달): 은은한 빛무리가 아주 느리게 숨 쉬듯 변한다.
- `flow`(소용돌이): 영역 안 픽셀의 밝기가 소용돌이 중심을 도는 방향으로 흐르는 띠처럼 바뀐다.
- `ripple`(하늘): 아주 느리고 옅은 밝기 일렁임.
- `sway`(사이프러스): 영역 픽셀을 줄마다 가로로 조금씩 밀어 위쪽일수록 크게 흔들린다.
- `flicker`(창문): 영역을 이루는 원 도형마다 따로 켜졌다 꺼진다.
- 성능: 연출은 영역 경계 상자 크기의 작은 캔버스에 미리 잘라 둔 색을 쓰고, 큰 영역(하늘, 소용돌이)은 낮은 해상도로 계산해 늘려 그린다. 모든 영역이 완성된 상태에서도 프레임 55 이상.

- [ ] **Step 1:** 구현.
- [ ] **Step 2:** 브라우저에서 콘솔로 영역을 하나씩 다 채워(예: `lostCanvas` 같은 디버그 핸들로 해당 영역 픽셀을 칠함) 효과마다 스크린샷과 확인. 모든 영역을 채운 끝 화면에서 프레임 확인.
- [ ] **Step 3:** `node --test` 통과. 커밋 `feat: 완성된 영역이 살아 움직임`

### Task 8: 속도 시뮬레이션과 숫자 조정

**Files:** Rewrite `tools/simulate.js`; Modify `js/config.js`

**Interfaces:**
- Consumes: `CONFIG`, `REGIONS`, `Game`.
- Produces: `run(config, options) -> { finished, seconds, firstPurchase, unlockAt, crossoverAt, progressAt1h, firstRegionAt, longestGap }`(모두 초 또는 비율), 명령줄 `node tools/simulate.js`는 결과와 통과 여부를 출력하고 실패면 종료 코드 1.

시뮬레이션 플레이어 (설계 문서 5장):
- 손으로 찍기: 요정이 손보다 느린 동안은 매초 50% 확률로, 이후에는 10% 확률로 그 초에 손 예산만큼 칠한다. 칠할 자리는 "시작됐고 아직 안 끝난 영역 중 가장 작은 영역"의 안 칠한 픽셀, 없으면 가장 작은 안 시작한 영역. 붓 크기가 커지면 그만큼 칠한다.
- 매초 살 수 있는 가장 싼 강화를 산다.
- `seed` 고정.

통과 기준:

| 항목 | 범위 |
|---|---|
| 첫 구매 | 60초 이하 |
| 첫 영역 완성 | 600초 이하 |
| 요정 열림 | 45분에서 90분 |
| 1시간 진행률 | 10% 미만 |
| 요정이 손보다 빨라지는 시점 | 전체의 35%에서 65% |
| 전체 | 15시간에서 25시간 |
| 구매나 영역 완성 사이 최장 대기 | 300초 이하 |

- [ ] **Step 1:** `tools/simulate.js` 작성, 시작값으로 실행해 결과를 본다(실패 예상).
- [ ] **Step 2:** `js/config.js`의 값과 필요하면 해상도를 조정해 종료 코드 0을 만든다. 해상도를 바꾸면 Task 5의 변환을 다시 돌리고 영역 미리보기를 다시 확인한다.
- [ ] **Step 3:** 브라우저에서 처음 5분을 직접 해 보고 첫 구매가 1분 안에 오는지 확인.
- [ ] **Step 4:** `node --test` 통과. README의 상태와 실행 방법 갱신(`index.html`, `node --test`, `node tools/simulate.js`, `tools/regions.html`, 그림 다시 만들기).
- [ ] **Step 5:** 커밋 `feat: 속도 시뮬레이션과 균형 조정`
