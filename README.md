# 별이 빛나는 밤

색을 잃은 명화 한 장을 픽셀 하나씩, 직접 고른 자리에 찍어 되살리는 인크리멘탈 게임. 처음에는 손으로 하나씩 찍고, 점점 요정이 칠한 곳에서 번져 나가며 그림을 완성한다. 다 채운 부분은 별이 반짝이듯 움직이기 시작한다.

상태: 첫 버전 완성. 설계는 [docs/superpowers/specs/2026-11-20-starry-night-design.md](docs/superpowers/specs/2026-11-20-starry-night-design.md), 계획은 [docs/superpowers/plans/2026-11-20-starry-night.md](docs/superpowers/plans/2026-11-20-starry-night.md).

## 실행

- 게임: `index.html`을 브라우저로 연다. 설치할 것이 없다.
- 검사: `node --test`
- 속도 확인: `node tools/simulate.js`. 기준 플레이어로 끝까지 돌려 첫 구매, 요정이 열리는 시점, 완성까지 걸리는 시간 등을 기준과 비교한다. 균형 숫자는 `js/config.js`에만 있다. 지금 값으로 완성까지 약 15시간(게임을 열어 둔 시간 기준).
- 영역 확인: `tools/regions.html`을 브라우저로 연다(그림 위에 영역을 겹쳐 보여 준다).

## 기본 조작

- 왼쪽 마우스 버튼으로 누르거나 끌어서 칠한다.
- `WASD`로 볼 영역을 이동한다. `Shift`를 함께 누르면 2배 빠르다.
- `Q`는 축소, `E`는 확대다. 누르는 동안 커서 위치를 중심으로 조절한다. 커서가 화면 밖이면 중앙을 기준으로 한다.
- `F`로 그림 전체 보기에 돌아간다.
- 휠 확대/축소, 오른쪽 또는 가운데 버튼 끌기, `Space+끌기`, 미니맵 클릭도 사용할 수 있다.
- 그림을 클릭하거나 Tab으로 선택하면 키보드로 조작할 수 있다. 시작 직후에도 사용할 수 있다. 설정 창이나 다른 버튼에 포커스가 있으면 화면 단축키는 쉬고, 마우스 드래그 중에는 화면 키를 무시한다. 드래그를 마친 뒤 키를 다시 누른다.
- 이동과 확대 속도는 `js/config.js`의 `ui.keyboard*` 값으로 조정한다.

## 그림 다시 만들기

1. 원본을 `source/`에 받는다(저장소에는 넣지 않는다).
2. `powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-painting.ps1 -Source source/starry-night-1920.jpg -Width 1280 -Height 1014`
3. 폭과 높이는 `js/config.js`의 `painting`과 같게 준다. 해상도를 바꾸면 이전 저장은 쓸 수 없어 새 게임으로 시작한다.

## 그림 출처

- 작품: 빈센트 반 고흐, 「별이 빛나는 밤」(The Starry Night), 1889, 뉴욕 현대미술관 소장
- 파일: 위키미디어 공용 `Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg`의 가로 1920픽셀 판
  https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg
- 저작권: 퍼블릭 도메인(작가 사후 70년이 지남)

## 이전 기록

처음 검토한 컨셉 제안서는 [proposals/](proposals/)에, 명화 22장 버전의 설계와 계획은 `docs/superpowers/`의 `lost-canvas` 문서에 남아 있다.
