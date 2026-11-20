'use strict';
// 그림의 이름 붙은 영역. 좌표는 0에서 1(가로는 그림 폭, 세로는 그림 높이 기준).
// 원과 타원의 반지름은 가로 기준이고 세로는 화면에서 둥글게 보이도록 자동으로 맞춘다.
// 목록 앞쪽 도형이 겹친 픽셀을 가져가고, rest 영역(맨 끝 하나)이 나머지를 모두 받는다.
// 임시 경계. tools/regions.html로 원작에 맞춰 다시 그린다.
const REGIONS = [
  { id: 'star-1', name: '별', effect: 'twinkle', shapes: [{ circle: [0.2, 0.1, 0.03] }] },
  { id: 'moon', name: '달', effect: 'glow', shapes: [{ circle: [0.86, 0.14, 0.06] }] },
  { id: 'sky', name: '하늘', effect: 'ripple', rest: true },
];

if (typeof module !== 'undefined') module.exports = REGIONS;
