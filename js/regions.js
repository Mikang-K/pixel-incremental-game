'use strict';
// 그림의 이름 붙은 영역. 좌표는 0에서 1(가로는 그림 폭, 세로는 그림 높이 기준).
// 원과 타원의 반지름은 가로 기준이고 세로는 화면에서 둥글게 보이도록 자동으로 맞춘다.
// 목록 앞쪽 도형이 겹친 픽셀을 가져가고, rest 영역(맨 끝 하나)이 나머지를 모두 받는다.
// 경계는 tools/regions.html로 원작에 겹쳐 보며 잡았다. 픽셀 단위로 정확할 필요는 없다.
const REGIONS = [
  {id: 'star-1', name: '별', effect: 'twinkle', shapes: [{circle: [0.109,0.047,0.038]}]},
  {id: 'star-2', name: '별', effect: 'twinkle', shapes: [{circle: [0.231,0.036,0.022]}]},
  {id: 'star-3', name: '별', effect: 'twinkle', shapes: [{circle: [0.344,0.039,0.033]}]},
  {id: 'star-4', name: '별', effect: 'twinkle', shapes: [{circle: [0.413,0.066,0.026]}]},
  {id: 'star-5', name: '별', effect: 'twinkle', shapes: [{circle: [0.606,0.084,0.046]}]},
  {id: 'star-6', name: '별', effect: 'twinkle', shapes: [{circle: [0.235,0.176,0.036]}]},
  {id: 'star-7', name: '별', effect: 'twinkle', shapes: [{circle: [0.705,0.225,0.041]}]},
  {id: 'star-8', name: '별', effect: 'twinkle', shapes: [{circle: [0.324,0.328,0.031]}]},
  {id: 'star-9', name: '별', effect: 'twinkle', shapes: [{circle: [0.045,0.453,0.019]}]},
  {id: 'star-10', name: '별', effect: 'twinkle', shapes: [{circle: [0.128,0.477,0.031]}]},
  {id: 'star-11', name: '별', effect: 'twinkle', shapes: [{circle: [0.353,0.526,0.059]}]},
  {id: 'moon', name: '달', effect: 'glow', shapes: [{circle: [0.913,0.16,0.097]}]},
  {id: 'windows', name: '마을 창문 불빛', effect: 'flicker', shapes: [{circle: [0.686,0.853,0.006]}, {circle: [0.788,0.877,0.006]}, {circle: [0.603,0.926,0.006]}, {circle: [0.821,0.909,0.006]}, {circle: [0.885,0.893,0.006]}, {circle: [0.731,0.917,0.006]}, {circle: [0.526,0.901,0.006]}, {circle: [0.936,0.869,0.006]}]},
  {id: 'cypress', name: '사이프러스', effect: 'sway', shapes: [{poly: [[0.192,0.095], [0.179,0.222], [0.154,0.319], [0.147,0.432], [0.138,0.561], [0.131,0.691], [0.115,0.82], [0.103,0.934], [0.115,1], [0.429,1], [0.41,0.901], [0.372,0.788], [0.34,0.691], [0.308,0.626], [0.295,0.586], [0.276,0.626], [0.25,0.594], [0.237,0.481], [0.224,0.351], [0.212,0.222]]}]},
  {id: 'village', name: '교회와 마을', effect: 'none', shapes: [{poly: [[0.397,0.788], [0.5,0.764], [0.558,0.78], [0.564,0.642], [0.571,0.634], [0.577,0.78], [0.654,0.756], [0.756,0.78], [0.885,0.788], [1,0.78], [1,1], [0.397,1]]}]},
  {id: 'swirl', name: '큰 소용돌이', effect: 'flow', shapes: [{ellipse: [0.551,0.311,0.147,0.09]}, {ellipse: [0.679,0.481,0.058,0.045]}]},
  {id: 'hills', name: '언덕', effect: 'none', shapes: [{poly: [[0,0.723], [0.103,0.72], [0.244,0.707], [0.372,0.707], [0.474,0.667], [0.577,0.634], [0.667,0.61], [0.756,0.586], [0.859,0.561], [0.923,0.513], [1,0.505], [1,1], [0,1]]}]},
  {id: 'sky', name: '하늘', effect: 'ripple', rest: true},
];

if (typeof module !== 'undefined') module.exports = REGIONS;
