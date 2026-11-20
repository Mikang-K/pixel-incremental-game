# 별이 빛나는 밤

색을 잃은 명화 한 장을 픽셀 하나씩, 직접 고른 자리에 찍어 되살리는 인크리멘탈 게임. 처음에는 손으로 하나씩 찍고, 점점 요정이 칠한 곳에서 번져 나가며 그림을 완성한다. 다 채운 부분은 별이 반짝이듯 움직이기 시작한다.

상태: 구현 중. 설계는 [docs/superpowers/specs/2026-11-20-starry-night-design.md](docs/superpowers/specs/2026-11-20-starry-night-design.md), 계획은 [docs/superpowers/plans/2026-11-20-starry-night.md](docs/superpowers/plans/2026-11-20-starry-night.md).

## 실행

- 게임: `index.html`을 브라우저로 연다. 설치할 것이 없다.
- 검사: `node --test`
- 영역 확인: `tools/regions.html`을 브라우저로 연다(그림 위에 영역을 겹쳐 보여 준다).

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
