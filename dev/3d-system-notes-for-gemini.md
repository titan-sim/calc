# 이 문서는 무엇인가

Korean 공룡 스탯 계산기 웹사이트(정적 사이트, 빌드 없음, 순수 JS/HTML/CSS)에서 "타이탄/다이노 배틀/
허수아비/건물/아레나" 5개 페이지가 공유하는 **3D 공간(육각형 바닥 + 카메라 + 아바타 배치) 로직**을
제미나이가 검토할 수 있도록 정리한 것. 아래 순서로 읽으면 됨:

1. 왜 이 구조가 됐는지(배경)
2. 핵심 공유 모듈(js/core/hex-scene3d.js) - 전체 소스
3. 페이지별로 이 모듈을 어떻게 쓰는지(좌표/카메라/아바타 배치/깊이 정렬/크기) - 관련 소스만 발췌
4. 관련 CSS(포지셔닝 레이어 구조, z-index, 아바타 크기 변수)
5. 지금까지 겪은 버그와 고친 방식(패턴을 이해하는 데 도움됨)
6. 아직 확신이 없는/재검토가 필요한 부분

**요청**: 이 구조 전체를 한번 검토하고, (a) 지금 방식에 구조적으로 잘못된 가정이나 개선 여지가
있는지, (b) 특히 6번 항목(타이탄 카메라 프레이밍, 건물 다층 z-index)에 대해 더 나은 접근이 있는지
의견을 달라.

---

## 1. 배경

원래 4개 페이지(타이탄/다이노배틀/허수아비/건물)는 전부 CSS `perspective` + `rotateX(55deg)`로
가짜 3D를 흉내내고 있었음. 이 방식에서 반복적으로 겪은 버그:

- `perspective`를 건 조상과 `rotateX`를 건 자손 사이에 스타일이 안 걸린(`transform` 없는) 중간
  래퍼가 하나라도 끼면 그 지점에서 perspective 체인이 끊겨서 3D가 평면으로 뭉개짐.
- 중첩된 `preserve-3d` 스택 안에서 `translateZ`가 음수인 자식 요소가 `getBoundingClientRect()`로는
  정상적인 박스가 잡히는데도 실제 화면엔 전혀 그려지지 않는 현상(직접 A/B 테스트로 재현 확인 -
  같은 요소를 `preserve-3d` 스택 밖으로 빼면 정상적으로 그려짐).
- 피격 흔들림 애니메이션에 `filter`를 걸면 `preserve-3d`가 스펙상 강제로 평면화됨 - 이걸 피하려고
  히트 이펙트/데미지 팝업 등을 전부 `position:fixed` + `getBoundingClientRect()` 우회로 처리해야
  했음(임시방편이 계속 누적됨).

그래서 **바닥(육각형 타일)만 진짜 WebGL 3D(Three.js)로 그리고, 아바타/UI(체력바/이름표/피격
이펙트/팝업)는 순수 2D DOM으로 남긴 채 `Vector3.project(camera)` 기반으로 화면 좌표만 매 프레임
계산해서 심는` 하이브리드 구조로 전면 교체함. 이후 이 구조 자체의 렌더링 버그는 없었고(콘솔 에러
없음, 여러 라운드 실측 검증 완료), 지금 남아있는 이슈는 전부 **좌표/카메라/깊이정렬 값 튜닝** 문제.

---

## 2. 핵심 공유 모듈 전체 소스 - `js/core/hex-scene3d.js`

5개 페이지 중 허수아비/타이탄/다이노배틀/건물 4개가 이 모듈을 통해서만 Three.js와 상호작용함(아레나는
격자형 UI라 이 3D 시스템을 안 씀 - 별개 구조).

```js
// ===== 공유 Three.js 육각형 바닥 렌더러 =====
// 지금까지 다이노 배틀/타이탄/허수아비/건물 4개 페이지가 각자 CSS rotateX(55deg)+perspective로
// 3D를 흉내내고 있었는데(preserve-3d 중첩 렌더링 버그, perspective 체인이 중간 래퍼에서 끊기는
// 버그 등 이번 세션 내내 반복적으로 발목을 잡음 - 실측으로 재현/확인), 진짜 WebGL 3D 엔진(Three.js)
// 으로 교체하기로 함.
//
// 이 모듈은 "바닥(육각형 타일들)"만 Three.js로 그림 - 아바타/체력바/이름표/팝업 등은 각 페이지가
// 지금 쓰는 DOM+CSS 그대로 두고, 이 모듈이 주는 projectToScreen()으로 위치만 계산함.

if (typeof THREE === "undefined") {
  console.error("hex-scene3d.js: THREE가 로드되지 않음 - index.html에서 Three.js CDN 스크립트가 이 파일보다 먼저 로드돼야 함");
}

// 4개 페이지의 육각형 SVG polygon 좌표를 각자 중심 기준으로 정규화해보면 전부 동일한 비율
// (가로 반폭 50, 세로 반높이 43.3 - 100x86.6 크기, "좌우로 뾰족, 상하 평평" 모양)이라, 지오메트리
// 하나를 모든 타일이 공유하고 위치만 mesh.position으로 옮기면 됨
const HEX_LOCAL_POINTS = [
  [-25, -43.3], [25, -43.3], [50, 0], [25, 43.3], [-25, 43.3], [-50, 0],
];
const HEX_HALF_W = 50, HEX_HALF_H = 43.3;

// 각 페이지의 타일 배치는 이 6방향 이웃 오프셋 벡터를 원점(0,0)에서부터 더해가며 명시적으로
// 선언함 - SVG viewBox에서 베껴온 절대좌표를 재사용하지 않기 위함(이전에 그렇게 해서 타일 중심과
// 아바타/건물 좌표가 어긋나는 버그가 났었음). 값 자체는 위 HEX_HALF_W/HEX_HALF_H에서 직접 유도.
const HEX_NEIGHBOR = {
  upperRight: [1.5 * HEX_HALF_W, -HEX_HALF_H],
  lowerRight: [1.5 * HEX_HALF_W, HEX_HALF_H],
  down: [0, 2 * HEX_HALF_H],
  lowerLeft: [-1.5 * HEX_HALF_W, HEX_HALF_H],
  upperLeft: [-1.5 * HEX_HALF_W, -HEX_HALF_H],
  up: [0, -2 * HEX_HALF_H],
};

function hexAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function hexSceneBuildGeometry() {
  const shape = new THREE.Shape();
  HEX_LOCAL_POINTS.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  });
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2); // XY 평면 도형을 눕혀서 바닥(XZ 평면)으로 씀

  // ShapeGeometry 기본 UV는 정규화 안 된 좌표를 그대로 씀 - 텍스처가 육각형 전체에 정확히 한 번만
  // 매핑되도록 로컬 바운딩 박스 기준 0~1로 다시 계산
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); // rotateX 이후 로컬 y가 z 축으로 감
    uv.setXY(i, (x + HEX_HALF_W) / (HEX_HALF_W * 2), (z + HEX_HALF_H) / (HEX_HALF_H * 2));
  }
  uv.needsUpdate = true;
  return geometry;
}

const hexSceneSharedGeometry = typeof THREE !== "undefined" ? hexSceneBuildGeometry() : null;

// CSS 색상 문자열(hex든 rgb()든)을 캔버스의 자체 파서로 정규화해서 알파를 섞어 씀
function hexSceneColorWithAlpha(cssColor, alpha) {
  const probe = document.createElement("canvas").getContext("2d");
  probe.fillStyle = cssColor;
  const normalized = probe.fillStyle;
  if (normalized[0] !== "#") return normalized;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 기존 SVG radialGradient(중심 tint 35% 불투명 -> 가장자리 카드배경색) + 테두리를 캔버스에 구워서
// 텍스처로 씀
function hexSceneBakeTexture({ tintColor, cardBgColor, borderColor }) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const cx = size / 2, cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.55);
  grad.addColorStop(0, hexSceneColorWithAlpha(tintColor, 0.35));
  grad.addColorStop(1, hexSceneColorWithAlpha(cardBgColor, 1));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.beginPath();
  HEX_LOCAL_POINTS.forEach(([x, y], i) => {
    const px = ((x + HEX_HALF_W) / (HEX_HALF_W * 2)) * size;
    const py = ((y + HEX_HALF_H) / (HEX_HALF_H * 2)) * size;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * @param {Object} config
 * @param {number} config.worldW 세계좌표 가로 폭(초기 카메라 aspect 계산용 - mount 즉시 resize()가
 *   실제 컨테이너 비율로 다시 잡으므로 대략적인 값이어도 됨)
 * @param {number} config.worldH 세계좌표 세로 폭
 * @param {Array<{center:[number,number], tintVar:string, borderVar?:string}>} config.hexTiles
 *   타일별 중심 세계좌표 + 색을 읽어올 CSS 커스텀 프로퍼티 이름(예: "--accent") 또는 리터럴 색상
 * @param {{position:[number,number,number], lookAt:[number,number,number], fov?:number}} config.camera
 * @param {Function} [config.onResize] 리사이즈 때마다 호출되는 훅(아바타 크기 재계산용)
 * @returns {{mount:Function, resize:Function, projectToScreen:Function, projectDiameterPx:Function,
 *            rebakeColors:Function, setTileTint:Function, dispose:Function}}
 */
function createHexFloorScene(config) {
  const { worldW, worldH, hexTiles, camera: camConf, onResize } = config;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(camConf.fov || 45, worldW / worldH, 0.1, 2000);
  camera.position.set(camConf.position[0], camConf.position[1], camConf.position[2]);
  camera.lookAt(camConf.lookAt[0], camConf.lookAt[1], camConf.lookAt[2]);

  let renderer = null;
  let canvasEl = null;
  let mountedContainer = null;
  let resizeObserver = null;
  const tileMeshes = [];

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.45);
  dirLight.position.set(worldW * 0.3, 200, worldH * 0.3);
  scene.add(dirLight);

  hexTiles.forEach((tile) => {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.08 });
    const mesh = new THREE.Mesh(hexSceneSharedGeometry, material);
    mesh.position.set(tile.center[0], 0, tile.center[1]); // world (x,y) -> mesh (x, 0, z)
    scene.add(mesh);
    tileMeshes.push(mesh);
  });

  function renderOnce() {
    if (!renderer) return;
    renderer.render(scene, camera);
  }

  function hexSceneResolveColor(value, cs, fallback) {
    if (!value) return fallback;
    if (value.startsWith("--")) return cs.getPropertyValue(value).trim() || fallback;
    return value; // "--"로 시작 안 하면 고정 리터럴 색(테마 무관, 예: "#e0473f")
  }

  function rebakeColors() {
    const cs = getComputedStyle(document.body);
    hexTiles.forEach((tile, i) => {
      const tint = hexSceneResolveColor(tile.tintVar, cs, "#c9a24b");
      const cardBg = hexSceneResolveColor("--card-bg", cs, "#141b2b");
      const border = tile.borderVar ? hexSceneResolveColor(tile.borderVar, cs, tint) : tint;
      const texture = hexSceneBakeTexture({ tintColor: tint, cardBgColor: cardBg, borderColor: border });
      tileMeshes[i].material.map = texture;
      tileMeshes[i].material.needsUpdate = true;
    });
    renderOnce();
  }

  function setTileTint(index, tintVar, borderVar) {
    if (!hexTiles[index]) return;
    hexTiles[index].tintVar = tintVar;
    if (borderVar !== undefined) hexTiles[index].borderVar = borderVar;
    rebakeColors();
  }

  function resize() {
    if (!renderer || !mountedContainer) return;
    const rect = mountedContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // 탭 뒤에 숨어 display:none인 동안 스킵
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(rect.width, rect.height);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderOnce();
    if (typeof onResize === "function") onResize();
  }

  function dispose() {
    if (resizeObserver) resizeObserver.disconnect();
    if (renderer) {
      renderer.dispose();
      if (canvasEl && canvasEl.parentNode) canvasEl.parentNode.removeChild(canvasEl);
    }
    renderer = null;
    canvasEl = null;
    mountedContainer = null;
    resizeObserver = null;
  }

  function mount(containerEl) {
    dispose(); // 라우터에 unmount 훅이 없어서 재방문 시 WebGL 컨텍스트가 쌓이는 걸 방지
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    canvasEl = renderer.domElement;
    canvasEl.style.display = "block";
    canvasEl.style.width = "100%";
    canvasEl.style.height = "100%";
    containerEl.appendChild(canvasEl);
    mountedContainer = containerEl;

    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(containerEl);

    resize();
    rebakeColors();
  }

  // 세계좌표(x, y) -> 화면 % 좌표. worldZ는 바닥 위 높이(대부분 0 - 아바타는 "공의 중심"이 아니라
  // "타일 지면 중심"에 투영된 지점에 CSS translate(-50%,-50%)로 얹히는 평면 원임, 실제 구체 메시가
  // 아님).
  const projectVec = new THREE.Vector3();
  function projectToScreen(worldX, worldY, worldZ = 0) {
    projectVec.set(worldX, worldZ, worldY); // world(x,y) -> three.js(x,z), world worldZ -> three.js y(높이)
    const distance = camera.position.distanceTo(projectVec);
    projectVec.project(camera);
    if (projectVec.z > 1) return { left: "-9999px", top: "-9999px", visible: false, distance };
    return {
      left: `${(projectVec.x * 0.5 + 0.5) * 100}%`,
      top: `${(1 - (projectVec.y * 0.5 + 0.5)) * 100}%`,
      visible: true,
      distance, // 카메라로부터의 실제 3D 거리 - 원근 크기축소/깊이정렬에 씀
    };
  }

  // worldDiameter(세계 단위 지름)가 (worldX, worldY) 지점에서 실제로 화면에 몇 px로 보이는지
  function projectDiameterPx(worldX, worldY, worldDiameter) {
    if (!mountedContainer) return 0;
    const half = worldDiameter / 2;
    const a = projectToScreen(worldX - half, worldY);
    const b = projectToScreen(worldX + half, worldY);
    if (!a.visible || !b.visible) return 0;
    const rectW = mountedContainer.getBoundingClientRect().width;
    return (Math.abs(parseFloat(b.left) - parseFloat(a.left)) / 100) * rectW;
  }

  return { mount, resize, projectToScreen, projectDiameterPx, rebakeColors, setTileTint, dispose };
}

// ===== 아바타 크기를 육각형 크기 기준으로 통일 =====
// "보통 크기 공룡 1마리의 지름 = 세계 단위 32"(육각형 반높이 43.3의 약 74% - 3마리 삼각 대형
// (반지름 22)으로 서도 서로 안 겹침: 22*sqrt(3)≈38.1 > 32) 하나만 기준으로 두고, 실제 화면 픽셀
// 크기는 projectDiameterPx()로 그 지점의 카메라 투영(원근 포함)을 통해 매번 계산함 - 페이지가
// 달라도 같은 세계 단위 지름을 쓰면 같은 "육각형 대비 비율"로 보임
const DINO_AVATAR_DIAMETER_WORLD = 32;
const TITAN_BOSS_DIAMETER_WORLD = DINO_AVATAR_DIAMETER_WORLD * 1.6;

// 매머드의 힘/압축된 힘 룬(동시 장착 불가) - 유닛 크기를 키우거나 줄이는 룬 효과의 시각적 배율
function hexSceneDinoRuneSizeScale(selectedRunes) {
  const names = (selectedRunes || []).filter(Boolean).map((r) => r.name);
  if (names.includes("매머드의 힘")) return 1.12;
  if (names.includes("압축된 힘")) return 0.88;
  return 1;
}
```

**좌표계 요약**: `world (x, y)`는 순수 2D 평면 좌표(옛 SVG viewBox와 같은 개념). `mesh.position.set(x, 0, y)`로
Three.js의 (X, Y=높이, Z=깊이) 공간에 매핑됨 - 즉 world의 "y"가 실제 3D의 "z"(카메라 앞뒤 깊이)가
됨. 각 페이지는 이 world 좌표 하나로 바닥 타일 위치와 아바타 위치를 **동시에** 계산하므로(같은 함수
`projectToScreen`을 공유), 타일 중심과 아바타가 어긋나는 버그는 구조적으로 발생할 수 없음(둘 다
정확히 같은 카메라 변환을 거침).

---

## 3. 페이지별 사용법

### 공통 패턴
1. 타일 중심 좌표를 `HEX_NEIGHBOR` 방향 벡터를 원점(0,0)에서부터 더해가며 선언(SVG에서 베낀 절대
   좌표 금지 - 예전에 그렇게 했다가 타일-아바타 어긋남 버그가 났었음).
2. `createHexFloorScene()`으로 씬을 만들고 `mount()`.
3. 아바타/건물 등은 `scene.projectToScreen(x, y)`가 주는 `{left, top}`(%)를 그대로 DOM 요소의
   `style.left/top`에 심고, `transform: translate(-50%, -50%)`로 그 지점에 중심을 맞춤.
4. 크기는 `scene.projectDiameterPx(x, y, DINO_AVATAR_DIAMETER_WORLD)`로 계산해서 `--avatar-diam-px`
   류의 CSS 변수로 심음.
5. 탭 뒤에 숨어 `display:none`으로 시작하는 페이지(타이탄/건물)는 "시뮬레이션" 탭을 처음 열 때
   `mount()`를 호출함 - 그 전에 이미 한 번 아바타 위치를 잡아뒀다면(폴백 좌표 `"50%"`) mount 직후
   실제 좌표로 다시 잡아줌.

### 타이탄 - `js/pages/titan-page.js`

```js
// 타일 중심은 원점(0,0)에서 HEX_NEIGHBOR 방향 벡터를 더해가며 명시적으로 선언함
const TITAN_HEX_CENTERS = { mine: [0, 0], boss: hexAdd([0, 0], HEX_NEIGHBOR.upperRight) };
// 카메라는 두 타일의 중점을 내려다보게 잡음
const TITAN_CAM_TARGET = [
  (TITAN_HEX_CENTERS.mine[0] + TITAN_HEX_CENTERS.boss[0]) / 2,
  (TITAN_HEX_CENTERS.mine[1] + TITAN_HEX_CENTERS.boss[1]) / 2,
];
const TITAN_R3 = 22;

let titanScene3d = null;

function titanInitScene3d() {
  if (titanScene3d) { titanScene3d.resize(); return; }
  if (typeof createHexFloorScene !== "function") return;
  const mountEl = document.getElementById("titanDuelFloorMount");
  if (!mountEl) return;
  titanScene3d = createHexFloorScene({
    worldW: 3 * HEX_HALF_W,
    worldH: 3 * HEX_HALF_H,
    hexTiles: [
      { center: TITAN_HEX_CENTERS.mine, tintVar: "--accent" },
      { center: TITAN_HEX_CENTERS.boss, tintVar: "#e0473f" }, // 보스는 테마 무관 고정 레드
    ],
    camera: {
      // 최근에 130/110으로 줄임(원래 190/160.05) - fov 45도 기준으로 카메라가 너무 멀어서
      // 스테이지 박스 위쪽에 빈 공간이 크게 남았음(사용자 지적: "타이탄은 왜 또 내려와있어")
      position: [TITAN_CAM_TARGET[0], 130, TITAN_CAM_TARGET[1] + 110],
      lookAt: [TITAN_CAM_TARGET[0], 0, TITAN_CAM_TARGET[1]],
      fov: 45,
    },
    onResize: () => {
      const visibleCount = document.querySelectorAll("#titanMyTarget .titan-hex-avatar:not([style*='display: none'])").length || 1;
      titanPositionMyAvatars(visibleCount);
      titanPositionBoss();
    },
  });
  titanScene3d.mount(mountEl);
  document.addEventListener("theme-changed", () => {
    if (titanScene3d && mountEl.isConnected) titanScene3d.rebakeColors();
  });
  titanLiveReset(); // 탭이 열리기 전(씬 없음)에 폴백 좌표로 잡혔던 아바타 위치를 실제 좌표로 재계산
}

function titanWorldToPercent([x, y]) {
  if (titanScene3d) return titanScene3d.projectToScreen(x, y);
  return { left: "50%", top: "50%" };
}

// count(1~3)에 따른 삼각 대형 - index0=앞(카메라와 가까움), index1=뒤-왼쪽, index2=뒤-오른쪽
function titanFormationPoints(center, count) {
  if (count <= 0) return [];
  if (count === 1) return [center];
  if (count === 2) return [[center[0] - TITAN_R3, center[1]], [center[0] + TITAN_R3, center[1]]];
  const R = TITAN_R3;
  return [
    [center[0], center[1] + R],
    [center[0] - 0.866 * R, center[1] - 0.5 * R],
    [center[0] + 0.866 * R, center[1] - 0.5 * R]
  ];
}

function titanPositionMyAvatars(count) {
  const points = titanFormationPoints(TITAN_HEX_CENTERS.mine, count);
  const sizeScale = hexSceneDinoRuneSizeScale(titanDinoInputs().selectedRunes);
  const diamPx = titanScene3d
    ? titanScene3d.projectDiameterPx(TITAN_HEX_CENTERS.mine[0], TITAN_HEX_CENTERS.mine[1], DINO_AVATAR_DIAMETER_WORLD * sizeScale)
    : 0;
  [0, 1, 2].forEach((i) => {
    const slot = document.getElementById(`titanMySlot${i}`);
    const point = points[i];
    if (!point) return;
    const pct = titanWorldToPercent(point);
    slot.style.left = pct.left;
    slot.style.top = pct.top;
    if (diamPx > 0) slot.querySelector(".titan-hex-avatar").style.setProperty("--avatar-diam-px", `${diamPx}px`);
  });
}

function titanPositionBoss() {
  const slot = document.getElementById("titanBossSlot0");
  const pct = titanWorldToPercent(TITAN_HEX_CENTERS.boss);
  slot.style.left = pct.left;
  slot.style.top = pct.top;
  const diamPx = titanScene3d
    ? titanScene3d.projectDiameterPx(TITAN_HEX_CENTERS.boss[0], TITAN_HEX_CENTERS.boss[1], TITAN_BOSS_DIAMETER_WORLD)
    : 0;
  if (diamPx > 0) slot.querySelector(".titan-hex-avatar").style.setProperty("--avatar-diam-px", `${diamPx}px`);
}
```

**깊이 정렬(z-index)**: 대형이 항상 고정된 3개 상대 위치라 정적값으로 처리(동적 계산 불필요) -
`css/titan.css`: `#titanMySlot0{z-index:2}`(앞, 카메라와 가까움) `#titanMySlot1{z-index:1}`
`#titanMySlot2{z-index:1}`(둘 다 뒤). **주의**: 한 번은 이 값이 반대(앞이 낮은 z-index)로 되어
있어서 먼 쪽이 가까운 쪽을 가리는 버그가 있었음 - `titanFormationPoints`가 반환하는 순서(0=앞)와
z-index 우선순위가 반드시 같은 방향이어야 함.

### 건물 - `js/pages/building-page.js`

```js
// 중앙을 원점(0,0)에 두고 HEX_NEIGHBOR 방향 벡터로 나머지 3칸을 명시적으로 배치("꽃잎" 배치)
const BUILDING_HEX_CENTERS = [
  [0, 0],                                          // 중앙 - 카메라와 가장 가까움(world y=0)
  hexAdd([0, 0], HEX_NEIGHBOR.up),                  // 정면 - 가장 멂(world y=-86.6)
  hexAdd([0, 0], HEX_NEIGHBOR.upperLeft),           // 좌측(world y=-43.3)
  hexAdd([0, 0], HEX_NEIGHBOR.upperRight),          // 우측(world y=-43.3, 좌측과 동률)
];
const BUILDING_ADJACENCY = { 0: [1, 2, 3], 1: [0, 2, 3], 2: [0, 1], 3: [0, 1] };

let buildingScene3d = null;
const BUILDING_CAM_TARGET = [
  (BUILDING_HEX_CENTERS[0][0] + BUILDING_HEX_CENTERS[1][0]) / 2,
  (BUILDING_HEX_CENTERS[0][1] + BUILDING_HEX_CENTERS[1][1]) / 2,
];

function buildingInitScene3d() {
  if (buildingScene3d) { buildingScene3d.resize(); return; }
  if (typeof createHexFloorScene !== "function") return;
  const mountEl = document.getElementById("buildingFloorMount");
  if (!mountEl) return;
  buildingScene3d = createHexFloorScene({
    worldW: 5 * HEX_HALF_W,
    worldH: 4 * HEX_HALF_H,
    // 건물 페이지는 "적 건물"을 부수는 컨텐츠라 4칸 전부 적 타일(고정 레드)
    hexTiles: BUILDING_HEX_CENTERS.map((center) => ({ center, tintVar: "#e0473f" })),
    camera: {
      position: [BUILDING_CAM_TARGET[0], 220, BUILDING_CAM_TARGET[1] + 173.4],
      lookAt: [BUILDING_CAM_TARGET[0], 0, BUILDING_CAM_TARGET[1]],
      fov: 45,
    },
    onResize: () => buildingUpdateDinoPosition(),
  });
  buildingScene3d.mount(mountEl);
  document.addEventListener("theme-changed", () => {
    if (buildingScene3d && mountEl.isConnected) buildingScene3d.rebakeColors();
  });
  buildingPositionSlots();
  buildingUpdateDinoPosition();
}

function buildingWorldToPercent([x, y]) {
  if (buildingScene3d) return buildingScene3d.projectToScreen(x, y);
  return { left: "50%", top: "50%" };
}

// 건물 슬롯 위치는 고정이라 한 번만 계산
function buildingPositionSlots() {
  [0, 1, 2, 3].forEach((i) => {
    const pct = buildingWorldToPercent(BUILDING_HEX_CENTERS[i]);
    document.getElementById(`buildingWallSlot${i}`).style.left = pct.left;
    document.getElementById(`buildingWallSlot${i}`).style.top = pct.top;
    document.getElementById(`buildingHexHitbox${i}`).style.left = pct.left; // 육각형 클릭(건설 모달) 히트박스
    document.getElementById(`buildingHexHitbox${i}`).style.top = pct.top;
  });
}

// 공룡 위치 - buildingTargetSlot(이동 버튼으로 지정)이 가리키는 타일 위, 건물 앞쪽(카메라 쪽)으로
// 34만큼 당김(육각형 반높이 43.3의 약 78% - 건물과 안 붙으면서 타일 밖으로도 안 넘침)
const BUILDING_DINO_TILE_OFFSET_Y = 34;
function buildingUpdateDinoPosition() {
  const slotIdx = buildingTargetSlot === null ? 0 : buildingTargetSlot;
  const base = BUILDING_HEX_CENTERS[slotIdx];
  const center = [base[0], base[1] + BUILDING_DINO_TILE_OFFSET_Y];
  const pct = buildingWorldToPercent(center);
  const dinoSlot = document.getElementById("buildingDinoSlot");
  dinoSlot.style.left = pct.left;
  dinoSlot.style.top = pct.top;
  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const sizeScale = hexSceneDinoRuneSizeScale(buildingDinoInputs(profile).selectedRunes);
  const diamPx = buildingScene3d
    ? buildingScene3d.projectDiameterPx(center[0], center[1], DINO_AVATAR_DIAMETER_WORLD * sizeScale)
    : 0;
  if (diamPx > 0) dinoSlot.style.setProperty("--avatar-diam-px", `${diamPx}px`);
}
```

**깊이 정렬(z-index)**: 건물 4개는 위치가 고정이라 정적값으로 카메라 거리 순서를 미리 매김(방금
새로 추가함 - 이전엔 이 정렬 자체가 아예 없어서 DOM 순서(중앙→정면→좌→우)대로 나중 요소가 이겨서,
카메라에서 더 먼 정면 건물이 더 가까운 중앙 건물을 가리는 버그가 있었음. 사용자 지적: "제일 앞쪽에
있는 건물이 뒤에 있는 건물에 가려지는데"):

```css
#buildingWallSlot0 { z-index: 4; } /* 중앙 - 가장 가까움(world y=0) */
#buildingWallSlot2 { z-index: 3; } /* 좌측 */
#buildingWallSlot3 { z-index: 3; } /* 우측 */
#buildingWallSlot1 { z-index: 2; } /* 정면 - 가장 멂(world y=-86.6) */
```

공룡(`.building-dino-slot`)은 건물보다 항상 위(`z-index:10`) - "이건 모든 공룡의 기본"이라는 원칙.

### 다이노 배틀 - `js/pages/dino-battle-page.js`

```js
// 내 대기 -> 중앙 -> 상대 대기가 일직선 계단이 되도록 같은 방향(upperRight)을 두 번 적용
const HEX_CENTERS = {
  myReserve: [0, 0],
  center: hexAdd([0, 0], HEX_NEIGHBOR.upperRight),
  oppReserve: hexAdd(hexAdd([0, 0], HEX_NEIGHBOR.upperRight), HEX_NEIGHBOR.upperRight),
};
const CENTER_SPLIT_OFFSET = 20; // 중앙 육각형 내/상대 절반 기준점 간격
const OUTWARD_1V1 = 12;         // 1v1일 때 서로 반대쪽으로 더 벌리는 거리
const R2_RESERVE = 22, R3_RESERVE = 22;

let dinoBattleScene3d = null;
let dinoBattleReferenceDiamPx = null; // center 타일 위 "보통 크기"의 기준 px - 원근 배율 계산 기준

function dinoBattleRefreshReferenceSize() {
  dinoBattleReferenceDiamPx = dinoBattleScene3d.projectDiameterPx(HEX_CENTERS.center[0], HEX_CENTERS.center[1], DINO_AVATAR_DIAMETER_WORLD);
  const arena = document.getElementById("battleArena");
  if (arena && dinoBattleReferenceDiamPx > 0) arena.style.setProperty("--avatar-base-px", `${dinoBattleReferenceDiamPx}px`);
}

function dinoBattleInitScene3d() {
  if (dinoBattleScene3d) { dinoBattleScene3d.resize(); return; }
  if (typeof createHexFloorScene !== "function") return;
  const mountEl = document.getElementById("battleHexTilt") || document.querySelector(".battle-hex-tilt");
  if (!mountEl) return;
  dinoBattleScene3d = createHexFloorScene({
    worldW: 6 * HEX_HALF_W,
    worldH: 4 * HEX_HALF_H,
    hexTiles: [
      { center: HEX_CENTERS.myReserve, tintVar: "--accent" },
      { center: HEX_CENTERS.center, tintVar: "--accent" }, // 부족 점령 색은 setTileTint로 갱신
      { center: HEX_CENTERS.oppReserve, tintVar: "#e0473f" },
    ],
    camera: {
      position: [HEX_CENTERS.center[0], 220, HEX_CENTERS.center[1] + 173.4],
      lookAt: [HEX_CENTERS.center[0], 0, HEX_CENTERS.center[1]],
      fov: 56, // 타일 3개가 대각선으로 넓게 퍼져있어서 45보다 넓힘
    },
    onResize: () => {
      dinoBattleRefreshReferenceSize();
      updateStackDisplay("my", lastAliveCount.my);
      updateStackDisplay("opp", lastAliveCount.opp);
    },
  });
  dinoBattleScene3d.mount(mountEl);
  dinoBattleRefreshReferenceSize();
  document.addEventListener("theme-changed", () => {
    if (dinoBattleScene3d && mountEl.isConnected) dinoBattleScene3d.rebakeColors();
  });
}

function worldToPercent([x, y]) {
  if (dinoBattleScene3d) return dinoBattleScene3d.projectToScreen(x, y);
  return { left: "50%", top: "50%" };
}

// 원근 배율(가까운 내 편 확대, 먼 상대 축소) - 실측 지점의 투영 지름을 기준 지름과 비교
function dinoBattlePerspectiveScale(point) {
  if (!dinoBattleScene3d || !dinoBattleReferenceDiamPx) return 1;
  const diamPx = dinoBattleScene3d.projectDiameterPx(point[0], point[1], DINO_AVATAR_DIAMETER_WORLD);
  return diamPx > 0 ? diamPx / dinoBattleReferenceDiamPx : 1;
}

// index0=앞(가까움), index1=뒤-왼쪽, index2=뒤-오른쪽
function trianglePoints([cx, cy], R) {
  return [
    [cx, cy + R],
    [cx - 0.866 * R, cy - 0.5 * R],
    [cx + 0.866 * R, cy - 0.5 * R]
  ];
}

function formationPoints(center, count, R2, R3, awayDir) {
  if (count <= 0) return [];
  if (count === 1) {
    if (!awayDir) return [center];
    return [[center[0] + awayDir[0] * OUTWARD_1V1, center[1] + awayDir[1] * OUTWARD_1V1]];
  }
  if (count === 2) {
    if (awayDir) {
      return [
        [center[0] - awayDir[0] * R2, center[1] - awayDir[1] * R2],
        [center[0] + awayDir[0] * R2, center[1] + awayDir[1] * R2]
      ];
    }
    return [[center[0] - R2, center[1]], [center[0] + R2, center[1]]];
  }
  return trianglePoints(center, R3);
}

function updateStackDisplay(sideKey, aliveCount) {
  const separate = isArrangementSeparate(sideKey);
  const awayDir = sideKey === "my" ? [-1, 0] : [1, 0];
  const center = HEX_CENTERS.center;
  const frontCenter = [center[0] + awayDir[0] * CENTER_SPLIT_OFFSET, center[1] + awayDir[1] * CENTER_SPLIT_OFFSET];
  const reserveCenter = HEX_CENTERS[`${sideKey}Reserve`];
  const behindSlots = [1, 2, 3].map((n) => document.getElementById(`${sideKey}Behind${n}Slot`));
  const avatarSlot = document.getElementById(`${sideKey}AvatarSlot`);

  const avatarPoint = formationPoints(frontCenter, aliveCount > 0 ? 1 : 0, 0, 0, awayDir)[0] || frontCenter;
  const reserveCount = separate ? Math.max(0, Math.min(3, aliveCount - 1)) : 0;
  const reservePoints = separate ? formationPoints(reserveCenter, reserveCount, R2_RESERVE, R3_RESERVE, null) : [];

  const avatarPct = worldToPercent(avatarPoint);
  avatarSlot.style.left = avatarPct.left;
  avatarSlot.style.top = avatarPct.top;
  avatarSlot.style.setProperty("--avatar-formation-scale", 1);
  avatarSlot.style.setProperty("--perspective-scale", dinoBattlePerspectiveScale(avatarPoint));
  // 카메라 실제 거리 기반 z-index(가까울수록 위) - 정적 tier의 동률 문제(아래 참고)를 피함
  if (avatarPct.distance) avatarSlot.style.zIndex = Math.round(10000 - avatarPct.distance);

  behindSlots.forEach((slotEl, idx) => {
    const point = reservePoints[idx];
    if (!point) { slotEl.style.display = "none"; return; }
    slotEl.style.display = "flex";
    const pct = worldToPercent(point);
    slotEl.style.left = pct.left;
    slotEl.style.top = pct.top;
    slotEl.style.setProperty("--avatar-formation-scale", 1);
    slotEl.style.setProperty("--perspective-scale", dinoBattlePerspectiveScale(point));
    if (pct.distance) slotEl.style.zIndex = Math.round(10000 - pct.distance);
  });
}
```

**깊이 정렬(z-index)**: 여기만 유일하게 **동적** 계산(`10000 - distance`). 이유: 대기 육각형 3마리
삼각 대형(`trianglePoints`)은 실제로 서로 다른 깊이를 갖는데, 예전엔 전부 같은 정적 z-index(1)를
써서 셋 중 실제로 가장 가까운(index0=앞) 자리가 DOM 순서 때문에 오히려 뒤 두 마리에게 가려지는
버그가 있었음(사용자 지적: "더 멀리 있는게 가려지지 않고 가까이 있는게 되려 가려져"). 진영 간
우선순위(`#myFormationGroup{z-index:2} #oppFormationGroup{z-index:1}` - 내 편이 카메라에 항상
가까움)는 별도 정적 규칙으로 밖에 있어서, "내 편 전체 vs 상대 편 전체"는 항상 내 편이 이기고, 그
안에서 개별 슬롯끼리는 실거리로 정렬됨(이중 구조).

### 허수아비 - `js/pages/dummy-page.js`

가장 단순함(타일 1개, 세계좌표도 그 타일 자체 크기):

```js
let dummyScene3d = null;

function dummyInitScene3d() {
  if (typeof createHexFloorScene !== "function") return;
  const mountEl = document.getElementById("dummyHexagonMount");
  if (!mountEl) return;
  dummyScene3d = createHexFloorScene({
    worldW: 100,
    worldH: 86.6,
    hexTiles: [{ center: [50, 43.3], tintVar: "--accent" }],
    camera: { position: [50, 127, 150], lookAt: [50, 0, 43.3], fov: 45 },
  });
  dummyScene3d.mount(mountEl);
  dummyPositionScarecrow();
  document.addEventListener("theme-changed", () => {
    if (dummyScene3d && mountEl.isConnected) dummyScene3d.rebakeColors();
  });
}

function dummyPositionScarecrow() {
  if (!dummyScene3d) return;
  const img = document.getElementById("dummyScarecrowImg");
  if (!img) return;
  const pos = dummyScene3d.projectToScreen(50, 43.3);
  img.style.left = pos.left;
  img.style.top = pos.top;
}
```

허수아비 페이지엔 플레이어 공룡 아바타 자체가 없음(스탯 계산 UI 위주, 허수아비 이미지만 배치) -
이 페이지는 [1]~[3]번의 이슈(z-index, 크기 통일 등)와 무관함.

---

## 4. 관련 CSS

### 레이어 구조(4페이지 공통 패턴)

```
.<page>-stage (position:relative, width:고정값 또는 min(Npx, Mcqw), aspect-ratio:250/173.2류)
  .<page>-tilt / -floorMount  (position:absolute; inset:0)  <- Three.js canvas가 여기 붙음
  .<page>-formation-group     (position:absolute; inset:0)  <- 아바타/건물 DOM 오버레이
    .<page>-team-slot / -wall-slot / -avatar-slot (position:absolute, transform:translate(-50%,-50%))
      .<page>-avatar (실제 원형 아바타, width/height는 --avatar-diam-px류 CSS 변수)
```

`tilt`(캔버스)와 `formation-group`(DOM 오버레이)가 **정확히 같은 박스**(둘 다 `inset:0`으로 같은
부모를 꽉 채움)를 공유하는 게 핵심 - 두 레이어가 서로 다른 padding/여백을 가지면 좌표가 어긋남.

### 타이탄 - `css/titan.css` 관련 발췌

```css
.titan-duel-wrap {
  container-type: inline-size;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 0 10px;
  --duel-w: min(520px, 92cqw); /* 카드 자체 폭(실측 약 620px)에 맞춰 상한을 올림 */
}
.titan-duel-stage {
  position: relative;
  width: var(--duel-w);
  aspect-ratio: 175 / 129.9;
  margin: 0 auto;
}
.titan-duel-tilt {
  position: absolute;
  inset: 0;
  filter: drop-shadow(0 30px 34px rgba(0, 0, 0, 0.45));
}
.titan-formation-group {
  position: absolute;
  inset: 0;
}
.titan-hex-billboard-slot {
  position: absolute;
  transform: translate(-50%, -50%);
  transition: left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
#titanMySlot0 { z-index: 2; } /* 앞(카메라와 가까움) */
#titanMySlot1 { z-index: 1; }
#titanMySlot2 { z-index: 1; }

.titan-hex-avatar-ball {
  width: var(--avatar-diam-px, clamp(30px, 11cqw, 52px)); /* clamp()는 씬 마운트 전 폴백일 뿐 */
  aspect-ratio: 1;
  border-radius: 50%;
}
.titan-hex-avatar-boss .titan-hex-avatar-ball {
  width: var(--avatar-diam-px, clamp(67px, 24cqw, 115px));
}
.titan-hex-avatar-hpbar {
  width: calc(var(--avatar-diam-px, clamp(30px, 11cqw, 52px)) * 0.9);
}
.titan-hex-avatar-hpbar-boss {
  width: calc(var(--avatar-diam-px, clamp(67px, 24cqw, 115px)) * 2.2);
}
.titan-hex-avatar-name {
  color: #4ade80; /* "내 공룡" 이름은 초록 - 페이지 공통 관례 */
}
```

### 건물 - `css/building.css` 관련 발췌

```css
.building-stage {
  position: relative;
  width: min(560px, 94cqw);
  aspect-ratio: 250 / 173.2;
  margin: 0 auto;
}
.building-dino-slot {
  position: absolute;
  width: 0;
  height: 0;
  z-index: 10; /* 공룡은 항상 건물보다 위 */
}
.building-wall-slot {
  position: absolute;
  width: 0;
  height: 0;
  z-index: 1; /* 기본값 - 아래 id 규칙이 실제 카메라 거리 순서로 덮어씀 */
}
#buildingWallSlot0 { z-index: 4; } /* 중앙 */
#buildingWallSlot2 { z-index: 3; } /* 좌측 */
#buildingWallSlot3 { z-index: 3; } /* 우측 */
#buildingWallSlot1 { z-index: 2; } /* 정면 */

.building-dino-avatar {
  width: var(--avatar-diam-px, clamp(24px, 9cqw, 40px));
  height: var(--avatar-diam-px, clamp(24px, 9cqw, 40px));
  border-radius: 50%;
}
.building-dino-cluster .building-dino-avatar-slot:nth-child(2) {
  transform: translateY(22%); /* 가운데 공룡이 카메라 쪽으로 튀어나온 곡선 대형 */
  z-index: 1; /* 앞으로 나온 공룡이 양옆보다 위 */
}
.building-dino-avatar-name {
  color: #4ade80;
}
```

### 다이노 배틀 - `css/dino-battle.css` 관련 발췌

```css
.battle-hex-stage {
  position: relative;
  width: 100%;
  max-width: 900px;
  aspect-ratio: 250 / 173.2;
  margin: 0 auto;
}
.battle-hex-field {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}
#myFormationGroup { z-index: 2; } /* 내 편이 항상 카메라에 가까움 */
#oppFormationGroup { z-index: 1; }

.battle-team-slot {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--perspective-scale, 1));
}
.battle-team-slot-avatar {
  display: flex;
  /* z-index는 이제 JS(updateStackDisplay)가 실거리 기반으로 매 프레임 계산해서 심음 */
}
.battle-avatar {
  width: calc(var(--avatar-base-px, 60px) * var(--avatar-formation-scale, 1) * var(--dino-scale, 1));
  height: calc(var(--avatar-base-px, 60px) * var(--avatar-formation-scale, 1) * var(--dino-scale, 1));
  border-radius: 50%;
}
#myFormationGroup .battle-team-slot-name { color: #4ade80; }
#oppFormationGroup .battle-team-slot-name { color: #e0473f; }
```

---

## 5. 지금까지 겪은 버그 패턴(참고용)

| 버그 | 원인 | 고친 방법 |
|---|---|---|
| 타일 중심과 아바타 좌표가 어긋남 | 페이지별 좌표 상수를 옛 CSS-3D 시절 SVG viewBox 절대값으로 재사용 | `HEX_NEIGHBOR` 방향 벡터를 원점부터 명시적으로 합산해서 재유도(SVG 숫자 재사용 금지) |
| 타이탄 보스 공이 육각형 밖으로 넘침 | 아바타 크기가 페이지마다 독립적인 `clamp(px, cqw, px)`(육각형의 실제 화면 크기와 무관) | `projectDiameterPx()`로 "세계 단위 지름이 이 지점에서 몇 px인지"를 매번 계산해서 통일 |
| 대기 3마리 중 가장 가까운 자리가 오히려 가려짐(다이노 배틀) | 정적 z-index tier가 전부 동률이라 DOM 순서로 승부(실제 깊이와 무관) | 카메라 실거리(`distance`) 기반 동적 z-index로 교체 |
| 건물 중 더 먼(정면) 게 더 가까운(중앙) 걸 가림 | 건물 4개 사이에 z-index 규칙 자체가 아예 없었음(전부 동률 1) | 타일이 고정 배치라 실거리 순서를 정적 id 규칙으로 미리 매김 |
| 마지막 죽은 공룡이 회색 처리되며 풀피로 "부활"해 보임 | ①죽음 애니메이션 클래스를 제거하는 타이머가 승격 여부와 무관하게 항상 실행됨 ②공속이 빨라 350ms 안에 연속으로 죽으면 이전 죽음의 낡은 타이머가 나중에 발동해서 방금 건 "전멸" 상태를 덮어씀(레이스 컨디션) ③체력바가 "데이터 없음"과 "죽어서 배열에서 빠짐"을 같은 폴백(풀피)으로 처리 | 진영별 타이머 핸들을 저장해뒀다가 새 죽음이 생기면 이전 타이머를 `clearTimeout`, 전멸이면 애초에 타이머를 안 걺, 체력바 폴백을 0%로 변경 |
| 타이탄 스테이지 위쪽에 빈 공간이 큼("내려와있다") | 카메라가 지면(y=0, 타일 중점)만 바라보는데 fov 45도 기준 카메라가 너무 멀리 있어서 필요 이상으로 넓은 영역을 잡음 | lookAt/fov는 그대로 두고 카메라 위치(높이/거리)만 씬에 가깝게 당김(순수 줌인) - **완전히 확신은 없음, 6번 참고** |

---

## 6. 아직 확신이 없는 부분 / 재검토 요청

1. **타이탄 카메라 프레이밍**: `position: [target, 130, target+110], lookAt: [target, 0, target]`로
   카메라를 당겨서 빈 공간을 줄이긴 했는데, 이건 "값을 바꿔보고 스크린샷으로 확인" 방식의 튜닝이지
   원리적으로 "왜 이 값이 최적인지"는 모름. 근본적으로는 `lookAt`이 항상 **지면(y=0)** 을 보고
   있어서 그런 것 같음 - 아바타는 실제로는 반지름만큼 공중에 떠 있는 게 아니라(구체 메시가 아니라
   `projectToScreen(x, y)`로 지면 좌표에 투영된 평면 원을 `translate(-50%,-50%)`로 그 점에 중심을
   맞춘 것), 화면상 "콘텐츠의 시각적 중심"이 카메라가 실제로 보는 지점(지면)과 정확히 일치하는 게
   맞는지, 아니면 아바타 반지름의 절반 정도 높이를 보게 하는 게 더 나은지 궁금함. 다른
   페이지(건물/다이노배틀)도 전부 같은 패턴(`lookAt` y=0)이라, 여기에 원리적으로 더 나은 공식이
   있다면 4페이지 전부에 적용하고 싶음.
2. **건물 z-index 4단계**: 지금은 "타일 위치가 고정이니 정적값으로 미리 계산"하는 방식인데, 다이노
   배틀처럼 동적(`distance` 기반)으로 통일하는 게 더 안전한지(예: 나중에 건물 배치 방식이 바뀌면
   정적값이 깨질 수 있음) 의견을 듣고 싶음.
3. **`projectToScreen`이 반환하는 `distance`는 카메라~점 사이의 직선거리**이지 카메라의 실제 시선
   축(forward vector) 기준 깊이(z-depth)가 아님. 지금 카메라들은 전부 대각선 위에서 아래를 보는
   구도라 직선거리와 시선축 깊이가 거의 비례하긴 하는데, 엄밀하게는 다를 수 있음 - z-index/원근
   축소 계산에 직선거리 대신 시선축 깊이를 써야 하는지 궁금함.
4. **`HEX_LOCAL_POINTS`/`hexSceneBuildGeometry`가 만드는 육각형은 "좌우로 뾰족, 상하 평평"
   모양**(pointy-left-right)인데, `HEX_NEIGHBOR`의 6방향 벡터가 이 모양과 기하학적으로 정확히
   맞물리는 이웃 배치인지(변끼리 딱 맞닿는지) 다시 한번 수학적으로 검증받고 싶음 - 지금까지는 실제
   렌더링 스크린샷으로 "붙어 보인다"만 확인했지, 좌표를 수식으로 증명하진 않았음.

---

## 부록: 각 페이지의 실제 world 좌표값 (계산된 최종값)

- **타이탄**: mine=[0,0], boss=[75,-43.3]
- **건물**: center=[0,0], front=[0,-86.6], left=[-75,-43.3], right=[75,-43.3]
- **다이노 배틀**: myReserve=[0,0], center=[75,-43.3], oppReserve=[150,-86.6]
- **허수아비**: 타일=[50,43.3] (유일하게 원점이 아님 - 세계좌표 자체가 이 타일 하나뿐이라
  좌표계 크기(100x86.6)의 중심을 그대로 씀, 문제 없음)
