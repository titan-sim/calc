// ===== 공유 Three.js 육각형 바닥 렌더러 =====
// 지금까지 다이노 배틀/타이탄/허수아비/건물 4개 페이지가 각자 CSS rotateX(55deg)+perspective로
// 3D를 흉내내고 있었는데(preserve-3d 중첩 렌더링 버그, perspective 체인이 중간 래퍼에서 끊기는
// 버그 등 이번 세션 내내 반복적으로 발목을 잡음 - 실측으로 재현/확인), 진짜 WebGL 3D 엔진(Three.js)
// 으로 교체하기로 함. dev/space3d-demo.html에서 핵심 기법(육각형 바닥, 카메라 투영,
// Vector3.project(camera) 기반 DOM 오버레이 추적)을 독립적으로 먼저 검증 완료.
//
// 이 모듈은 "바닥(육각형 타일들)"만 Three.js로 그림 - 아바타/체력바/이름표/팝업 등은 각 페이지가
// 지금 쓰는 DOM+CSS 그대로 두고, 이 모듈이 주는 projectToScreen()으로 위치만 계산함(기존
// xWorldToPercent/titanWorldToPercent/buildingWorldToPercent 자리에 그대로 대신 씀 - 반환 형태를
// 동일하게 맞춰서 호출부 변경을 최소화함).

if (typeof THREE === "undefined") {
  console.error("hex-scene3d.js: THREE가 로드되지 않음 - index.html에서 Three.js CDN 스크립트가 이 파일보다 먼저 로드돼야 함");
}

// 4개 페이지의 육각형 SVG polygon 좌표를 각자 중심 기준으로 정규화해보면 전부 동일한 비율
// (가로 반폭 50, 세로 반높이 43.3 - 100x86.6 크기, "좌우로 뾰족, 상하 평평" 모양)이라(실측 확인 -
// 허수아비/타이탄/다이노배틀/건물 SVG 좌표 대조), 지오메트리 하나를 모든 타일이 공유하고 위치만
// mesh.position으로 옮기면 됨
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
  if (normalized[0] !== "#") return normalized; // 혹시 파싱 실패하면 원본 그대로(과도한 방어 안 함)
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 기존 SVG radialGradient(중심 tint 35% 불투명 -> 가장자리 카드배경색) + 테두리를 캔버스에 구워서
// 텍스처로 씀. 기존 CSS 3D 버전은 rotateX 압축을 보정하려고 대각선(2)/수평(3.6) stroke-width를
// 다르게 줬는데, 진짜 3D에서는 이 보정이 불필요하고 오히려 틀려서 6변 전부 균일한 두께로 그림
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
 * @param {number} config.worldW 세계좌표 가로 폭(기존 xWorldToPercent의 WORLD_W와 동일 값)
 * @param {number} config.worldH 세계좌표 세로 폭(WORLD_H와 동일)
 * @param {Array<{center:[number,number], tintVar:string, borderVar?:string}>} config.hexTiles
 *   타일별 중심 세계좌표 + 색을 읽어올 CSS 커스텀 프로퍼티 이름(예: "--accent")
 * @param {{position:[number,number,number], lookAt:[number,number,number], fov?:number}} config.camera
 * @returns {{mount:Function, resize:Function, projectToScreen:Function, rebakeColors:Function, dispose:Function}}
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
    mesh.position.set(tile.center[0], 0, tile.center[1]);
    scene.add(mesh);
    tileMeshes.push(mesh);
  });

  function renderOnce() {
    if (!renderer) return;
    renderer.render(scene, camera);
  }

  // tintVar/borderVar는 "--"로 시작하면 CSS 커스텀 프로퍼티 이름(테마 반응형 - 예: "--accent"),
  // 아니면 고정 리터럴 색상 문자열로 취급(예: 타이탄 보스/다이노 배틀 상대 진영의 고정 레드
  // "#e0473f" - 원래 SVG에서도 테마와 무관한 고정색이었음, CSS 변수가 아님)
  function hexSceneResolveColor(value, cs, fallback) {
    if (!value) return fallback;
    if (value.startsWith("--")) return cs.getPropertyValue(value).trim() || fallback;
    return value;
  }

  // 테마(라이트/다크) 토글이 새로고침 없이 즉시 body 클래스를 바꾸는 걸 확인함(js/ui/settings-ui.js,
  // 실측 확인) - --accent/--card-bg 같은 CSS 변수가 그 즉시 바뀌므로, 캔버스 텍스처도 다시 구워야
  // 색이 안 밀림
  function rebakeColors() {
    const cs = getComputedStyle(document.body);
    hexTiles.forEach((tile, i) => {
      const tint = hexSceneResolveColor(tile.tintVar, cs, "#c9a24b");
      const cardBg = hexSceneResolveColor("--card-bg", cs, "#141b2b");
      const border = tile.borderVar ? hexSceneResolveColor(tile.borderVar, cs, tint) : tint;
      const texture = hexSceneBakeTexture({ tintColor: tint, cardBgColor: cardBg, borderColor: border });
      // 이 자리에서 새 텍스처로 바꿔 끼우기 전에 방금까지 쓰던 이전 텍스처를 반드시 dispose해야
      // GPU 메모리가 해제됨(WebGLTexture는 JS 쪽 참조를 놓아도 자동 회수되지 않음) - 안 그러면
      // 테마 전환마다, 그리고 setTileTint()로 타일 하나만 바꿀 때도 매번 "타일 개수"만큼의 텍스처가
      // 계속 쌓임(사이트 전체 점검에서 발견 - 특히 건물 페이지는 타일 호버(mouseenter/leave)마다
      // setTileTint->rebakeColors 전체 재굽기가 일어나서 가장 빠르게 누적됐음)
      if (tileMeshes[i].material.map) tileMeshes[i].material.map.dispose();
      tileMeshes[i].material.map = texture;
      tileMeshes[i].material.needsUpdate = true;
    });
    renderOnce();
  }

  // 테마와 무관하게 특정 타일 하나의 색을 즉석에서 바꿀 때 씀(예: 다이노 배틀의 "부족 점령 상태"
  // 설정에 따라 중앙 타일 색이 흰색/골드/레드로 바뀜) - hexTiles 설정 자체를 갱신해두면 이후 테마
  // 토글로 인한 rebakeColors() 호출에서도 이 색이 계속 유지됨
  function setTileTint(index, tintVar, borderVar) {
    if (!hexTiles[index]) return;
    hexTiles[index].tintVar = tintVar;
    if (borderVar !== undefined) hexTiles[index].borderVar = borderVar;
    rebakeColors();
  }

  function resize() {
    if (!renderer || !mountedContainer) return;
    const rect = mountedContainer.getBoundingClientRect();
    // 탭 뒤에 숨어 display:none인 동안은 0x0이라 그대로 스킵(실측 확인 - 타이탄/건물은 "시뮬레이션"
    // 탭을 눌러야 처음 실제 크기가 나옴) - 나중에 탭이 열릴 때 다시 resize()가 호출되면 그때 그림
    if (rect.width === 0 || rect.height === 0) return;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(rect.width, rect.height);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderOnce();
    // 창 크기가 바뀌면 projectDiameterPx()가 주는 픽셀 크기도 같이 바뀌므로(육각형 자체가
    // 커지거나 작아짐), 아바타 크기를 그 값으로 다시 심어야 하는 페이지는 이 훅으로 재계산
    if (typeof onResize === "function") onResize();
  }

  function dispose() {
    if (resizeObserver) resizeObserver.disconnect();
    if (renderer) {
      renderer.dispose();
      if (canvasEl && canvasEl.parentNode) canvasEl.parentNode.removeChild(canvasEl);
    }
    // renderer.dispose()는 렌더러 자체(WebGL 컨텍스트)만 해제하고, 타일마다 만든 머티리얼/텍스처는
    // 안 건드림 - 지오메트리는 hexSceneSharedGeometry로 전 타일이 공유하는 값이라(전역 상수, 씬을
    // 몇 번을 새로 만들어도 재사용됨) dispose 대상이 아니지만, 머티리얼과 그 위에 구운 텍스처는
    // 씬(타일 세트)마다 새로 만든 것이라 여기서 반드시 해제해야 함 - 안 그러면 페이지를 오갈 때마다
    // (라우터가 #app.innerHTML을 통째로 갈아치우기만 하고 별도 unmount 훅이 없어서) 이전 씬의
    // 머티리얼/텍스처가 전부 GPU 메모리에 그대로 쌓여있게 됨(사이트 전체 점검에서 발견)
    tileMeshes.forEach((mesh) => {
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
    });
    renderer = null;
    canvasEl = null;
    mountedContainer = null;
    resizeObserver = null;
  }

  // 라우터가 페이지 이동 시 #app.innerHTML을 통째로 갈아치우기만 하고 별도 unmount 훅이 없어서
  // (실측 확인), 페이지를 여러 번 오가면 WebGL 컨텍스트가 계속 쌓일 수 있음 - 마운트 시점에 이전
  // 인스턴스를 먼저 정리
  function mount(containerEl) {
    dispose();
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

  // 세계좌표(x, y=기존 SVG의 세로축) -> 화면 % 좌표. 기존 *WorldToPercent 함수들과 동일한
  // {left, top} 문자열 형태로 반환해서 호출부를 최소로 바꿈. worldZ는 바닥 위 높이(대부분 0).
  // distance(카메라 기준 깊이)도 같이 반환 - 다이노 배틀처럼 "가까운 쪽은 크게, 먼 쪽은 작게" 원근
  // 크기 축소나 z-index 깊이정렬을 CSS/JS 쪽에서 직접 재현해야 하는 페이지가 씀. 카메라
  // position에서 잰 유클리드 거리 대신 카메라 로컬 공간(뷰 공간)의 -Z를 씀 - 화면 중앙에서 먼
  // 가장자리 오브젝트는 실제 깊이가 같아도 유클리드 거리가 더 크게 나와서(대각선 빗변) 화면
  // 가장자리 쪽 깊이정렬이 뒤집힐 수 있는 왜곡이 있었음(제미나이 코드 리뷰로 지적받고 검증함 -
  // Three.js 카메라는 자신의 로컬 -Z축을 바라보므로 matrixWorldInverse로 월드->카메라 로컬 좌표
  // 변환 후 -z를 취하면 뷰 축 기준 선형 깊이가 나옴)
  const projectVec = new THREE.Vector3();
  const cameraSpaceVec = new THREE.Vector3();
  function projectToScreen(worldX, worldY, worldZ = 0) {
    projectVec.set(worldX, worldZ, worldY);
    cameraSpaceVec.copy(projectVec).applyMatrix4(camera.matrixWorldInverse);
    const distance = -cameraSpaceVec.z;
    projectVec.project(camera);
    if (projectVec.z > 1) return { left: "-9999px", top: "-9999px", visible: false, distance };
    return {
      left: `${(projectVec.x * 0.5 + 0.5) * 100}%`,
      top: `${(1 - (projectVec.y * 0.5 + 0.5)) * 100}%`,
      visible: true,
      distance,
    };
  }

  // worldDiameter(세계 단위 지름)가 (worldX, worldY) 지점에서 실제로 화면에 몇 px로 보이는지 -
  // 카메라 원근을 그대로 반영(같은 지름이라도 카메라에서 먼 타일 위에서는 더 작게 나옴). 아바타
  // 크기를 육각형 크기 기준으로 통일하는 용도(hexSceneDinoRuneSizeScale 참고) - mount되기 전이거나
  // 대상이 화면 밖이면 0
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
// 예전엔 페이지마다 clamp(Npx, Mcqw, Kpx) 형태로 독립적으로 손튜닝한 크기를 썼는데, 육각형이
// 화면에서 실제로 얼마나 크게 보이는지와 무관한 값이라 화면 크기·카메라 거리·페이지가 바뀔
// 때마다 상대적 크기가 들쭉날쭉해짐(사용자 지적 - "어느 페이지를 가도 공룡의 크기가 동일할 수
// 있도록"). "보통 크기 공룡 1마리의 지름 = 세계 단위 32"(육각형 반높이 43.3의 약 74% - 3마리
// 삼각 대형(반지름 22, 다이노 배틀/타이탄 공용 R3)으로 서도 서로 안 겹침: 22*sqrt(3)≈38.1 > 32)
// 하나만 기준으로 두고, 실제 화면 픽셀 크기는 projectDiameterPx()로 그 지점의 카메라 투영(원근
// 포함)을 통해 매번 계산함 - 페이지가 달라도 같은 세계 단위 지름을 쓰면 같은 "육각형 대비 비율"로
// 보임
const DINO_AVATAR_DIAMETER_WORLD = 32;
// 타이탄(보스)은 기존 CSS 배율(1.6배 - 사용자 확정, 2배였다가 너무 커서 줄임)을 그대로 유지
const TITAN_BOSS_DIAMETER_WORLD = DINO_AVATAR_DIAMETER_WORLD * 1.6;

// 매머드의 힘/압축된 힘 룬(동시 장착 불가, js/data/rune-data.js) - 룬 자체 수치(공격력/체력 ±25%)를
// 시각적 크기에 그대로 곱하면 차이가 너무 커 보여서(사용자 피드백, 다이노 배틀 페이지에서 처음
// 확정된 값) 시각적 배율은 완만하게만 적용 - 이제 4개 페이지(타이탄/다이노배틀/건물/허수아비) 전부
// 이 값을 공용으로 씀(페이지마다 따로 정하면 같은 룬을 껴도 페이지별로 커 보이는 정도가 달라짐)
function hexSceneDinoRuneSizeScale(selectedRunes) {
  const names = (selectedRunes || []).filter(Boolean).map((r) => r.name);
  if (names.includes("매머드의 힘")) return 1.12;
  if (names.includes("압축된 힘")) return 0.88;
  return 1;
}
