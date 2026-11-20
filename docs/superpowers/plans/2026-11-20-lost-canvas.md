# 색을 잃은 캔버스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 색을 잃은 명화를 픽셀 한 칸씩 복원하는 PC 브라우저용 인크리멘탈 게임의 첫 버전을 만든다.

**Architecture:** 게임 규칙은 화면을 모르는 순수 자바스크립트 파일 하나(`js/game.js`)에 두고, 브라우저와 Node 양쪽에서 돈다. 화면(`js/ui.js`)은 규칙의 상태를 읽어 캔버스에 그리고 입력을 전달만 한다. 균형 숫자는 `js/config.js`, 그림은 `js/pictures.js`에 데이터로 분리한다.

**Tech Stack:** HTML, CSS, Canvas 2D, 순수 자바스크립트(빌드 없음, 의존성 없음). 검사는 Node 내장 `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-20-lost-canvas-design.md`

## Global Constraints

- `index.html`을 더블클릭(file://)해서 실행된다. ES 모듈, fetch, 번들러, npm 의존성을 쓰지 않는다. 스크립트는 일반 `<script src>`로 싣고 전역(`CONFIG`, `PICTURES`, `Game`, `Save`)을 쓴다.
- 각 js 파일 끝에 `if (typeof module !== 'undefined') module.exports = ...`를 두어 Node에서 `require`로 읽는다.
- 균형 숫자(비용, 증가율, 배율, 오프라인 한도, 저장 주기)는 `js/config.js`에만 둔다. `game.js`, `save.js`, `ui.js`에 숫자 상수를 박지 않는다.
- 그림 수, 격자 크기, 색 수, 해상도 단계 수를 코드에 고정하지 않는다. 전부 `PICTURES`에서 읽는다.
- 화면 글자는 한글. 가운뎃점을 쓰지 않는다.
- 최소 화면 폭 1280px. 모바일 대응, 소리, 서버 없음.
- 그림은 저작권이 끝난 명화만 쓴다(작가 사후 70년 이상).
- 로그 파일이 필요하면 저장소 루트 `logs/`에 둔다.
- 작업마다 커밋한다. 커밋 메시지 끝: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`

## Review Focus

1. 저장 데이터가 깨졌거나 버전이 다를 때: 게임이 죽지 않고 새 게임으로 시작한다. (Task 4)
2. 시계가 뒤로 갔거나 며칠 만에 돌아왔을 때: 오프라인 시간은 0과 `offline.maxSeconds` 사이로 잘린다. (Task 4)
3. 탭이 백그라운드에 있다가 돌아와 `dt`가 매우 클 때: `tick`이 그림 여러 장을 넘어가도 작업량을 잃지 않고 멈추지 않는다. (Task 2)
4. 이미 칠한 칸, 캔버스 밖 좌표, 프레스티지 대기 중 클릭: 아무 일도 없고 방울도 생기지 않는다. (Task 1)
5. 가져오기 창에 아무 문자열이나 넣었을 때: 현재 진행이 유지되고 안내 문구가 뜬다. (Task 4, 5)

## File Structure

```
index.html              화면 뼈대, 스크립트 로드
style.css               배치와 픽셀 게임풍 스타일
js/config.js            CONFIG: 모든 균형 숫자
js/pictures.js          PICTURES: 그림 데이터 22장
js/game.js              Game: 규칙 전부 (화면 모름)
js/save.js              Save: 직렬화, 불러오기, 오프라인 계산
js/ui.js                그리기, 입력, 게임 루프, 자동 저장
tests/fixtures.js       검사용 작은 설정과 그림
tests/game.test.js
tests/save.test.js
tests/pictures.test.js
tools/preview.html      모든 그림을 크게 늘어놓아 보는 확인용 페이지
tools/simulate.js       화면 없이 끝까지 돌려 단계별 소요 시간을 출력
```

## 공통 정의 (모든 작업이 참조)

상태 객체. `Game.create`가 만들고 `Save`가 그대로 저장한다.

```js
state = {
  version: 1,
  drops: 0,                 // 물감 방울
  pictureIndex: 0,          // PICTURES(단계 오름차순 정렬) 안의 위치
  work: [],                 // 현재 그림의 칸별 누적 작업량, 길이 tier*tier
  fairies: { brush: 0, roller: 0, spray: 0 },
  upgrades: {},             // { upgradeId: level }
  gallery: [],              // 완성한 그림 id
  eyes: 0,                  // 프레스티지 재화
  eyeUpgrades: {},          // { eyeUpgradeId: level }
  heatUntil: 0,             // state.time 기준
  time: 0,                  // 누적 게임 시간(초)
  awaitingPrestige: false,  // 한 단계의 그림을 다 끝내고 대기 중
  finished: false,          // 마지막 단계까지 완료
  lastSeen: 0               // 마지막 저장 시각(ms), Save가 씀
}
```

그림 한 장.

```js
{ id: "pearl-earring", title: "진주 귀걸이를 한 소녀", artist: "요하네스 페르메이르", year: 1665,
  tier: 16, palette: ["#1a1c2c", ...], traits: { 3: "blue", 5: "yellow" },
  rows: ["0011...", ...] }   // 칸 글자는 팔레트 번호(16진수 한 글자)
```

`traits` 값은 `"blue"`, `"yellow"`, `"red"` 중 하나.

`CONFIG` 시작값. Task 9에서 시뮬레이션을 보며 조정한다.

```js
const CONFIG = {
  cell:    { workBase: 3, workGrowth: 1.45, dropsBase: 1, dropsGrowth: 1.35 }, // 지수는 pictureIndex
  click:   { basePower: 1 },
  fairies: {
    brush:  { baseCost: 15,   costGrowth: 1.15, workPerSecond: 0.5, spread: 1 },
    roller: { baseCost: 400,  costGrowth: 1.15, workPerSecond: 6,   spread: 3 },
    spray:  { baseCost: 9000, costGrowth: 1.15, workPerSecond: 60,  spread: 9 },
  },
  upgrades: {   // 효과: 레벨당 곱 또는 열림
    clickPower:  { baseCost: 10,   costGrowth: 2,   multiplier: 2 },
    brushSpeed:  { baseCost: 100,  costGrowth: 3,   multiplier: 2 },
    rollerSpeed: { baseCost: 2500, costGrowth: 3,   multiplier: 2 },
    spraySpeed:  { baseCost: 50000,costGrowth: 3,   multiplier: 2 },
    cellDrops:   { baseCost: 200,  costGrowth: 2.5, multiplier: 1.5 },
    ruleBlue:    { baseCost: 300,  costGrowth: 1,   maxLevel: 1 },
    ruleYellow:  { baseCost: 1500, costGrowth: 1,   maxLevel: 1 },
    ruleRed:     { baseCost: 6000, costGrowth: 1,   maxLevel: 1 },
  },
  rules:   { blue: { bleedFraction: 0.25 }, yellow: { dropsMultiplier: 5 },
             red: { heatSeconds: 5, heatMultiplier: 2 } },
  gallery: { bonusPerPicture: 0.1 },            // 방울 배율 = 1 + 0.1 * 장수
  prestige:{ eyesBase: 3 },                     // 얻는 눈 = eyesBase * (끝낸 단계 순번, 1부터)
  eyeUpgrades: {
    startFairies:      { baseCost: 1, costGrowth: 2, brushPerLevel: 5 },
    offlineEfficiency: { baseCost: 1, costGrowth: 2, addPerLevel: 0.1 },
    globalSpeed:       { baseCost: 2, costGrowth: 2, multiplier: 2 },
    autoBuy:           { baseCost: 3, costGrowth: 1, maxLevel: 1 },
  },
  offline: { maxSeconds: 28800, baseEfficiency: 0.5 },
  save:    { intervalSeconds: 10, storageKey: "lostCanvasSave" },
  tick:    { maxStepSeconds: 1 },
  ui:      { maxFairyDots: 20 },
};
```

---

### Task 1: 칠하기 규칙 (클릭, 칸 완성, 그림 완성, 갤러리)

**Files:**
- Create: `js/config.js`, `js/game.js`, `tests/fixtures.js`, `tests/game.test.js`, `.gitignore`(`logs/`)

**Interfaces:**
- Produces:
  - `Game.create(config, pictures, savedState?) -> g`. `pictures`를 `tier` 오름차순으로 안정 정렬해 쓴다. `savedState`가 없으면 새 상태.
  - `g.state`, `g.picture() -> picture | null`(대기 중이거나 끝났으면 null)
  - `g.cellRequired() -> number` = `workBase * workGrowth ** pictureIndex`
  - `g.isCellDone(index) -> boolean`
  - `g.click(x, y) -> boolean` 작업량을 더했으면 true
  - `g.progress() -> { done, total }`
  - `g.dropsMultiplier() -> number`
  - `Game.formatNumber(n) -> string`
- `tests/fixtures.js`: `testConfig()`(공통 정의의 시작값을 fixtures 안에 글자 그대로 따로 적어 돌려준다. `js/config.js`를 읽지 않는다. Task 9의 조정이 검사를 깨지 않게 하기 위해서다. 단 `cell.workBase: 2, workGrowth: 1`), `testPictures()`(2x2 그림 두 장 `tier: 2`와 4x4 그림 한 장 `tier: 4`. 첫 그림의 traits는 `{1:"blue", 2:"yellow", 3:"red"}`, rows `["01","23"]`).

- [ ] **Step 1:** `node --version`으로 Node 18 이상인지 확인한다. 없으면 멈추고 사용자에게 알린다.
- [ ] **Step 2: 실패하는 검사 작성** (`tests/game.test.js`, `node:test`와 `node:assert/strict`)

```js
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
```

- [ ] **Step 3:** `node --test tests/` 실행, 실패 확인.
- [ ] **Step 4:** `js/config.js`(공통 정의의 CONFIG)와 `js/game.js`를 구현한다. 칸 완성 시 방울 = `dropsBase * dropsGrowth ** pictureIndex * dropsMultiplier()`. 칸 완성 처리는 내부 함수 하나(`completeCell(index)`)로 모은다. Task 2의 색 규칙이 여기에 붙는다. 1000 미만은 내림한 정수, 그 이상은 소수 한 자리와 단위(천, 만, 억, 조).
- [ ] **Step 5:** `node --test tests/` 통과 확인.
- [ ] **Step 6:** 커밋 `feat: 칠하기 규칙과 갤러리`

### Task 2: 요정, 시간 진행, 강화, 색 규칙

**Files:**
- Modify: `js/game.js`, `tests/game.test.js`

**Interfaces:**
- Consumes: Task 1의 `g`, `completeCell`
- Produces:
  - `g.fairyCost(type) -> number` = `baseCost * costGrowth ** 보유수`
  - `g.buyFairy(type) -> boolean`, `g.upgradeCost(id) -> number`, `g.buyUpgrade(id) -> boolean`. 방울이 모자라거나 `maxLevel`에 닿았으면 false이고 상태가 바뀌지 않는다.
  - `g.workPerSecond(type?) -> number` 종류별 또는 합계. 강화, 열기, 눈 강화 배율 포함.
  - `g.tick(dt)` dt는 초.
  - `g.targets(type) -> number[]` 그 요정 종류가 지금 칠하는 칸 번호들(화면 연출용).

**tick 알고리즘** (서명과 검사만으로 정해지지 않으므로 명시):

1. `dt`를 `tick.maxStepSeconds` 이하 조각으로 나눠 반복한다. `picture()`가 null이면 시간만 더하고 끝낸다.
2. 조각마다 요정 종류별 작업량 풀 = `workPerSecond(type) * 조각`.
3. 풀을 그 종류의 목표 칸에 나눠 준다. 목표 칸 = 아직 안 끝난 칸을 번호순으로 훑어 앞에서부터 `spread`개. 균등하게 나누고, 칸이 차서 남는 양은 풀로 되돌려 다음 목표 칸에 쓴다. 풀이 0이 되거나 그림이 바뀌어 대기 상태가 될 때까지 반복한다.
4. 그림이 완성되어 다음 그림으로 넘어가면 남은 풀은 새 그림에 이어서 쓴다.

**색 규칙** (해당 `rule*` 강화가 열려 있을 때만, `completeCell` 안에서):
- blue: 상하좌우의 안 끝난 칸에 `cellRequired() * bleedFraction`을 더한다. 그로 인해 칸이 차면 같은 처리를 이어 간다.
- yellow: 그 칸의 방울에 `dropsMultiplier`를 곱한다.
- red: `heatUntil = time + heatSeconds`. `time < heatUntil`인 동안 모든 요정의 작업량에 `heatMultiplier`를 곱한다.

- [ ] **Step 1: 실패하는 검사 작성**

```js
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
  g.state.fairies.brush = 2;            // 초당 1
  g.tick(1);
  assert.deepEqual(g.state.work, [1, 0, 0, 0]);
  assert.deepEqual(g.targets('brush'), [0]);
});
test('롤러 요정은 세 칸에 나눠 칠한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.roller = 1;           // 초당 6
  g.tick(0.5);
  assert.deepEqual(g.state.work, [1, 1, 1, 0]);
});
test('큰 dt는 그림을 넘어가며 작업량을 잃지 않는다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2;            // 초당 1, 그림 한 장은 작업량 8
  g.tick(11);
  assert.equal(g.state.pictureIndex, 1);
  assert.equal(g.state.work.reduce((a, b) => a + b, 0), 3);
});
test('대기 중이거나 끝난 뒤의 tick은 멈추지 않고 돌아온다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.spray = 100;
  g.tick(100000);
  assert.equal(g.state.awaitingPrestige, true);
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
});
test('파랑은 옆 칸으로 번진다', () => {
  const g = Game.create(testConfig(), testPictures());   // 칸 1이 blue
  g.state.upgrades.ruleBlue = 1;
  g.click(1, 0); g.click(1, 0);
  assert.equal(g.state.work[0], 0.5);
  assert.equal(g.state.work[3], 0.5);
});
test('노랑은 방울을 곱해 준다', () => {
  const g = Game.create(testConfig(), testPictures());   // 칸 2가 yellow
  g.state.upgrades.ruleYellow = 1;
  g.click(0, 1); g.click(0, 1);
  assert.equal(g.state.drops, 5);
});
test('빨강은 잠깐 요정을 빠르게 한다', () => {
  const g = Game.create(testConfig(), testPictures());   // 칸 3이 red
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
```

- [ ] **Step 2:** `node --test tests/` 실패 확인.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** `node --test tests/` 통과 확인.
- [ ] **Step 5:** 커밋 `feat: 요정, 강화, 색 규칙`

### Task 3: 프레스티지, 눈 강화, 결말

**Files:**
- Modify: `js/game.js`, `tests/game.test.js`

**Interfaces:**
- Produces:
  - `g.canPrestige() -> boolean` = `awaitingPrestige && !finished`
  - `g.prestige() -> boolean`. 눈을 `eyesBase * (끝낸 단계 순번)`만큼 더하고, `drops`, `fairies`, `upgrades`, `heatUntil`을 초기화하고, `awaitingPrestige`를 풀고 다음 그림의 `work`를 준비한다. `gallery`, `eyes`, `eyeUpgrades`, `pictureIndex`는 유지. `startFairies` 레벨만큼 붓 요정을 준다.
  - `g.eyeUpgradeCost(id)`, `g.buyEyeUpgrade(id) -> boolean`
  - `g.offlineEfficiency() -> number` = `baseEfficiency + addPerLevel * 레벨`, 최대 1
  - `globalSpeed`는 `workPerSecond`에 곱한다. `autoBuy`가 있으면 `tick`의 조각마다 살 수 있는 가장 싼 요정을 하나 산다.
  - 마지막 단계의 마지막 그림을 끝내면 `finished = true`, `awaitingPrestige = false`.

- [ ] **Step 1: 실패하는 검사 작성**

```js
function finishTier(g) { g.state.fairies.spray = 1000; g.tick(100000); }
test('단계를 끝내기 전에는 프레스티지할 수 없다', () => {
  const g = Game.create(testConfig(), testPictures());
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
  finishTier(g); g.prestige();
  assert.equal(g.state.fairies.brush, 5);
});
test('전체 속도 강화는 작업량을 곱한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.eyes = 2; g.buyEyeUpgrade('globalSpeed'); g.state.fairies.brush = 2;
  assert.equal(g.workPerSecond(), 2);
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
```

- [ ] **Step 2:** 실패 확인. **Step 3:** 구현. **Step 4:** 통과 확인.
- [ ] **Step 5:** 커밋 `feat: 프레스티지와 눈 강화`

### Task 4: 저장과 오프라인 진행

**Files:**
- Create: `js/save.js`, `tests/save.test.js`

**Interfaces:**
- Consumes: `Game.create(config, pictures, savedState)`, `g.tick`, `g.offlineEfficiency`, `g.progress`
- Produces:
  - `Save.serialize(state) -> string` (JSON을 base64로)
  - `Save.deserialize(text, pictures) -> state | null`. JSON이 아니거나, `version !== 1`이거나, `pictureIndex`가 범위 밖이거나, `gallery`에 없는 그림 id가 있거나, `work` 길이가 현재 그림과 다르면 null.
  - `Save.applyOffline(g, nowMs, config) -> { seconds, cells, pictures }`. 경과 = `(nowMs - lastSeen) / 1000`을 0과 `offline.maxSeconds` 사이로 자르고, `g.tick(경과 * g.offlineEfficiency())`를 한 뒤 그동안 끝난 칸 수와 그림 수를 돌려준다. `lastSeen`이 0이면 아무것도 하지 않는다.
  - `Save.load(storage, config, pictures) -> state | null`, `Save.store(storage, state, nowMs, config)`. `storage`는 `localStorage`와 같은 `getItem`/`setItem` 객체(검사에서는 가짜를 넣는다). `getItem`이나 `setItem`이 예외를 던져도 잡고 null 또는 무시.

- [ ] **Step 1: 실패하는 검사 작성**

```js
test('저장했다 불러오면 상태가 같다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.drops = 42; g.click(0, 0);
  const back = Save.deserialize(Save.serialize(g.state), testPictures());
  assert.deepEqual(back, g.state);
});
test('깨진 문자열은 null', () => {
  assert.equal(Save.deserialize('아무말', testPictures()), null);
  assert.equal(Save.deserialize('', testPictures()), null);
  assert.equal(Save.deserialize(Buffer.from('{"a":1}').toString('base64'), testPictures()), null);
});
test('버전이 다르면 null', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.version = 2;
  assert.equal(Save.deserialize(Save.serialize(g.state), testPictures()), null);
});
test('그림 목록과 맞지 않는 저장은 null', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.pictureIndex = 99;
  assert.equal(Save.deserialize(Save.serialize(g.state), testPictures()), null);
});
test('오프라인 진행은 효율을 곱해 반영한다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2; g.state.lastSeen = 1000;
  const r = Save.applyOffline(g, 1000 + 4000, testConfig());   // 4초, 효율 0.5
  assert.equal(r.seconds, 4);
  assert.equal(r.cells, 1);
  assert.deepEqual(g.state.work, [2, 0, 0, 0]);
});
test('시계가 뒤로 가면 오프라인 진행은 0', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.fairies.brush = 2; g.state.lastSeen = 5000;
  assert.equal(Save.applyOffline(g, 1000, testConfig()).seconds, 0);
});
test('오프라인 시간은 한도에서 잘린다', () => {
  const g = Game.create(testConfig(), testPictures());
  g.state.lastSeen = 1;
  assert.equal(Save.applyOffline(g, 1e12, testConfig()).seconds, 28800);
});
test('저장소가 예외를 던져도 죽지 않는다', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(Save.load(bad, testConfig(), testPictures()), null);
  Save.store(bad, Game.create(testConfig(), testPictures()).state, 1, testConfig());
});
```

- [ ] **Step 2:** 실패 확인. **Step 3:** 구현(브라우저는 `btoa`/`atob`, Node는 `Buffer`. 한글이 들어가지 않도록 상태에는 id만 있으니 ASCII로 충분). **Step 4:** 통과 확인.
- [ ] **Step 5:** 커밋 `feat: 저장과 오프라인 진행`

### Task 5: 그림 형식 검사, 미리보기, 8x8 명화 8장

**Files:**
- Create: `js/pictures.js`, `tests/pictures.test.js`, `tools/preview.html`

**Interfaces:**
- Produces: 전역 `PICTURES` 배열(공통 정의의 그림 형식).

8x8 목록(팔레트 4색 이하):

| id | 제목 | 작가 | 연도 |
|---|---|---|---|
| black-square | 검은 사각형 | 카지미르 말레비치 | 1915 |
| composition | 빨강 파랑 노랑의 구성 | 피트 몬드리안 | 1930 |
| red-fuji | 붉은 후지산 | 가쓰시카 호쿠사이 | 1831 |
| sunrise | 인상, 해돋이 | 클로드 모네 | 1872 |
| sunflowers | 해바라기 | 빈센트 반 고흐 | 1888 |
| apples | 사과와 오렌지 | 폴 세잔 | 1899 |
| kiss | 키스 | 구스타프 클림트 | 1908 |
| cafe-terrace | 밤의 카페 테라스 | 빈센트 반 고흐 | 1888 |

- [ ] **Step 1: 실패하는 검사 작성** (`tests/pictures.test.js`). 모든 그림에 대해:

```js
test('모든 그림이 형식을 지킨다', () => {
  const ids = new Set();
  for (const p of PICTURES) {
    assert.ok(p.id && !ids.has(p.id), `id 중복 또는 없음: ${p.id}`); ids.add(p.id);
    assert.ok(p.title && p.artist && Number.isInteger(p.year), p.id);
    assert.equal(p.rows.length, p.tier, p.id);
    assert.ok(p.palette.length >= 2 && p.palette.length <= 16, p.id);
    for (const c of p.palette) assert.match(c, /^#[0-9a-f]{6}$/, p.id);
    for (const row of p.rows) {
      assert.equal(row.length, p.tier, p.id);
      for (const ch of row) assert.ok(parseInt(ch, 16) < p.palette.length, `${p.id}: ${ch}`);
    }
    for (const [k, v] of Object.entries(p.traits || {})) {
      assert.ok(Number(k) < p.palette.length, p.id);
      assert.ok(['blue', 'yellow', 'red'].includes(v), p.id);
    }
  }
});
test('단계마다 색 규칙 세 계열이 모두 한 번 이상 나온다', () => { /* tier별로 traits 값을 모아 세 가지가 다 있는지 */ });
test('8x8 그림은 8장', () => assert.equal(PICTURES.filter(p => p.tier === 8).length, 8));
```

- [ ] **Step 2:** 실패 확인.
- [ ] **Step 3:** `tools/preview.html` 작성: `../js/pictures.js`를 싣고 그림마다 캔버스에 칸당 `Math.floor(256 / tier)`px로 그려 제목, 작가, 연도와 함께 늘어놓는다. 옆에 회색 버전(게임의 미완성 모습)도 같이 그린다.
- [ ] **Step 4:** 8장을 그린다. 원작의 대표 색과 구도를 따른다. 색 규칙 계열은 실제 색에 맞게 붙인다(파란 팔레트 색에 blue 등).
- [ ] **Step 5:** `node --test tests/` 통과 확인.
- [ ] **Step 6:** `tools/preview.html`을 브라우저로 열어 스크린샷으로 한 장씩 확인한다. 제목을 보고 "그 그림이구나" 싶지 않은 것은 고치고, 고쳐도 안 되면 같은 조건(저작권 만료, 단순한 구도)의 다른 작품으로 바꾸고 최종 보고에 적는다.
- [ ] **Step 7:** 커밋 `feat: 그림 형식과 8x8 명화`

### Task 6: 16x16 명화 8장

**Files:**
- Modify: `js/pictures.js`, `tests/pictures.test.js`(`16x16 그림은 8장` 검사 추가)

목록(팔레트 8색 이하):

| id | 제목 | 작가 | 연도 |
|---|---|---|---|
| pearl-earring | 진주 귀걸이를 한 소녀 | 요하네스 페르메이르 | 1665 |
| mona-lisa | 모나리자 | 레오나르도 다 빈치 | 1503 |
| scream | 절규 | 에드바르 뭉크 | 1893 |
| van-gogh-self | 자화상 | 빈센트 반 고흐 | 1889 |
| whistlers-mother | 화가의 어머니 | 제임스 맥닐 휘슬러 | 1871 |
| milkmaid | 우유 따르는 여인 | 요하네스 페르메이르 | 1658 |
| fifer | 피리 부는 소년 | 에두아르 마네 | 1866 |
| miindo | 미인도 | 신윤복 | 1800 |

연도는 통상 알려진 제작 연도다. 모나리자와 미인도처럼 추정인 것은 대표 연도 하나를 쓴다.

- [ ] **Step 1:** 장수 검사 추가, 실패 확인.
- [ ] **Step 2:** 8장을 그린다.
- [ ] **Step 3:** `node --test tests/` 통과, 미리보기에서 Task 5의 Step 6과 같은 기준으로 확인.
- [ ] **Step 4:** 커밋 `feat: 16x16 명화`

### Task 7: 32x32 명화 6장

**Files:**
- Modify: `js/pictures.js`, `tests/pictures.test.js`(`32x32 그림은 6장` 검사 추가)

목록(팔레트 16색 이하):

| id | 제목 | 작가 | 연도 |
|---|---|---|---|
| starry-night | 별이 빛나는 밤 | 빈센트 반 고흐 | 1889 |
| great-wave | 가나가와 해변의 큰 파도 | 가쓰시카 호쿠사이 | 1831 |
| grande-jatte | 그랑자트섬의 일요일 오후 | 조르주 쇠라 | 1886 |
| water-lilies | 수련 | 클로드 모네 | 1906 |
| birth-of-venus | 비너스의 탄생 | 산드로 보티첼리 | 1485 |
| wanderer | 안개 바다 위의 방랑자 | 카스파르 다비트 프리드리히 | 1818 |

- [ ] **Step 1:** 장수 검사 추가, 실패 확인.
- [ ] **Step 2:** 6장을 그린다.
- [ ] **Step 3:** 통과와 미리보기 확인.
- [ ] **Step 4:** 커밋 `feat: 32x32 명화`

### Task 8: 화면

**Files:**
- Create: `index.html`, `style.css`, `js/ui.js`

**Interfaces:**
- Consumes: `CONFIG`, `PICTURES`, `Game`의 모든 메서드, `Save`의 모든 함수.

화면 요소와 동작(설계 문서 3장):

- 위쪽 띠: 방울(`formatNumber`), 초당 작업량, 현재 그림의 제목과 작가와 연도, 진행률.
- 가운데 캔버스: 칸 크기 = 가용 영역에 맞는 최대 정수 배율. `image-rendering: pixelated`. 미완성 칸은 원래 색의 밝기를 유지한 회색, 진행 중인 칸은 아래에서부터 진행 비율만큼 원래 색. 요정은 종류별 색의 작은 점으로 `g.targets(type)` 칸 위를 맴돈다(점 개수는 종류별 최대 20개로 제한, 이 20은 `CONFIG.ui.maxFairyDots`로).
- 캔버스 입력: 누르거나 누른 채 끌면 지나가는 칸마다 `g.click`. 한 번 끄는 동안 같은 칸은 한 번만.
- 오른쪽 패널 탭: 요정(종류, 보유 수, 값, 사기), 강화(이름, 레벨, 값, 사기), 눈(보유 눈, 눈 강화, 프레스티지 단추). 살 수 없으면 단추가 비활성. 탭과 단추는 키보드로 조작 가능한 `<button>`.
- `g.canPrestige()`이면 캔버스 자리에 "더 고운 눈을 뜬다" 안내와 단추를 보여 준다.
- 아래쪽 띠: 갤러리 축소판. 올리거나 포커스하면 제목, 작가, 연도.
- `finished`가 되면 결말 화면: 갤러리의 모든 그림을 한 캔버스에 타일로 모은 모자이크와 "계속하기" 단추.
- 설정: 내보내기(문자열을 글상자에), 가져오기(`Save.deserialize`가 null이면 "저장 문자열이 올바르지 않습니다"를 띄우고 현재 진행 유지), 초기화(확인 후).
- 시작: `Save.load` → 없거나 null이면 새 게임 → `Save.applyOffline` → `seconds > 0`이면 "자리를 비운 동안 N칸을 칠했습니다" 요약.
- 루프: `requestAnimationFrame`에서 실제 경과 시간으로 `g.tick(dt)` 후 그리기. `save.intervalSeconds`마다, 그리고 `visibilitychange`로 숨겨질 때 `Save.store`.
- 한글 이름표: 붓 요정, 롤러 요정, 분무 요정, 클릭 힘, 칸당 방울, 번짐(파랑), 금빛(노랑), 열기(빨강), 시작 요정, 오프라인 효율, 전체 속도, 자동 구매.

- [ ] **Step 1:** `index.html`, `style.css`, `js/ui.js` 구현. 배색과 글꼴은 구현자가 정하되 어두운 배경에 픽셀 게임풍으로.
- [ ] **Step 2:** `node --test tests/` 통과(규칙을 건드리지 않았는지).
- [ ] **Step 3:** 브라우저에서 `index.html`을 열어 다음을 직접 확인하고 스크린샷을 남긴다.
  - 칸을 클릭하고 끌면 색이 차오르고 방울이 는다.
  - 붓 요정을 사면 클릭 없이 칸이 칠해지고 점이 보인다.
  - 그림을 완성하면 갤러리에 걸리고 다음 그림이 나온다.
  - 새로 고침해도 진행이 남는다.
  - 가져오기에 `abc`를 넣으면 안내 문구가 뜨고 진행이 유지된다.
  - 콘솔에서 `localStorage.setItem('lostCanvasSave', 'x')` 후 새로 고침하면 새 게임으로 시작한다.
  - 콘솔에 오류가 없다.
  - 프레스티지와 결말은 콘솔에서 요정 수를 크게 올려 빠르게 도달해 확인한다.
- [ ] **Step 4:** 커밋 `feat: 게임 화면`

### Task 9: 속도 시뮬레이션과 숫자 조정

**Files:**
- Create: `tools/simulate.js`
- Modify: `js/config.js`

**Interfaces:**
- Consumes: `CONFIG`, `PICTURES`, `Game`.

`node tools/simulate.js [초당클릭수=3]`의 동작: 1초 단위로 (1) 안 끝난 첫 칸을 초당 클릭 수만큼 클릭, (2) `g.tick(1)`, (3) 살 수 있는 요정과 강화 중 가장 싼 것을 살 수 있는 만큼 구매, (4) `canPrestige()`면 눈 강화를 싼 것부터 사고 `prestige()`. `finished`까지 돈다. 출력: 단계별 소요 분, 합계 분, 가장 길었던 "구매도 그림 완성도 없던 구간"의 초. 아래 범위를 벗어나면 그 항목을 표시하고 종료 코드 1. 게임 시간 24시간을 넘기면 실패로 끝낸다.

| 항목 | 통과 범위 |
|---|---|
| 첫 단계 | 15분에서 30분 |
| 둘째 단계 | 30분에서 55분 |
| 셋째 단계 | 50분에서 90분 |
| 합계 | 120분 이상 |
| 가장 긴 빈 구간 | 180초 이하 |

- [ ] **Step 1:** `tools/simulate.js` 작성.
- [ ] **Step 2:** 실행해서 현재 숫자의 결과를 본다(실패가 예상됨).
- [ ] **Step 3:** `js/config.js`의 값을 조정하고 다시 실행하기를 반복해 종료 코드 0을 만든다. 초당 클릭 수 1과 6으로도 돌려 합계가 90분 미만으로 떨어지거나 24시간을 넘기지 않는지 본다.
- [ ] **Step 4:** `node --test tests/` 통과 확인(검사는 `testConfig()`를 쓰므로 영향이 없어야 한다).
- [ ] **Step 5:** 브라우저에서 처음 5분을 직접 해 보고 첫 요정 구매가 1분 안에 오는지 확인한다.
- [ ] **Step 6:** README의 상태 줄을 갱신하고 실행 방법(`index.html` 열기, `node --test tests/`, `node tools/simulate.js`)을 적는다.
- [ ] **Step 7:** 커밋 `feat: 속도 시뮬레이션과 균형 조정`
