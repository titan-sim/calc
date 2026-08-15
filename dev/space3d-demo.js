// ===== 3D 공간 검증 데모 (2차 개정) =====
// 목적: 실제 게임 페이지(다이노 배틀/타이탄/허수아비/건물)를 건드리기 전에, Three.js(WebGL) 기반의
// "진짜 3D 공간"이 이 프로젝트가 필요로 하는 것들 - 육각형 바닥, 오브젝트가 항상 바닥에 발이 닿게
// 배치되는 로직, 전략게임류 카메라(고정 각도 드래그 팬 + 휠 줌), 카메라를 항상 보는 빌보드
// 스프라이트, DOM 오버레이(체력바/이름표 같은 기존 HTML+CSS UI를 그대로 재사용하기 위한 좌표 변환)
// - 를 전부 문제없이 해내는지 독립적으로 검증하는 스크립트.
//
// 1차 데모는 OrbitControls(자유 회전)로 "공간 자체"만 검증했었는데, 사용자가 제미나이로 다듬은
// 2차 초안을 가져와서 그 방향으로 갱신함 - 실제 게임(클래시 오브 클랜류)의 카메라는 자유 회전이
// 아니라 고정 각도로 팬/줌만 하는 방식이라 이쪽이 최종 결과물에 더 가까움. 좌표계도 axial에서
// 표준 flat-top 오프셋(odd-q) 방식으로 바꿈, 타일 개수도 100x100(1만 개)로 늘려서 InstancedMesh
// 성능까지 같이 검증함.

// ===== 1. Scene, Camera, Renderer =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0c10);
scene.fog = new THREE.Fog(0x0b0c10, 40, 140);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
const initialY = 35;
camera.position.set(0, initialY, initialY * 0.8);
camera.lookAt(0, 0, 0);
// lookAt은 여기서 딱 한 번만 호출됨 - 이후 드래그/줌은 camera.position만 이동시키고 회전은 절대
// 안 건드림. 그래서 카메라가 어디로 팬/줌 하든 "바라보는 각도"는 처음 그대로 고정됨(전략게임 카메라
// 특유의 느낌). 줌 로직(아래 6번)이 y와 z를 28:35=0.8 비율로 같이 움직이는 것도 이 초기 각도의
// tan 비율과 정확히 일치시켜서, 줌인/아웃 중에도 시야각이 안 틀어지게 만든 것(검산: initialY*0.8
// = 초기 z값이므로 이 비율 자체가 "카메라->원점" 벡터 방향의 비율과 같음)

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ===== 2. 조명 =====
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(4096, 4096);
scene.add(dirLight);

// ===== 3. 육각형 바닥(100x100=1만 타일, InstancedMesh) =====
// odd-q 오프셋 좌표계(flat-top 육각형, 표준 공식) - 열(q)마다 1.5*R씩 가로로 벌리고, 홀수 열은
// 세로로 R*sqrt(3)/2만큼 어긋나게 둬서 육각형끼리 맞물리게 함
const hexPlaceRadius = 2.0; // 타일 배치 간격 기준(중심-꼭짓점 거리)
const hexDrawRadius = 1.95; // 실제로 그리는 반지름 - place보다 살짝 작게 둬서 타일 사이 격자
                             // 간격이 눈에 보이게 함(의도된 디자인, 버그 아님)
const gridSizeX = 100;
const gridSizeZ = 100;
const totalTiles = gridSizeX * gridSizeZ;

const hexGeo = new THREE.CircleGeometry(hexDrawRadius, 6);
hexGeo.rotateX(-Math.PI / 2); // 수직으로 서있는 원(circle)을 눕혀서 바닥면으로 씀
const hexMat = new THREE.MeshStandardMaterial({ color: 0x1f2833, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });

const instancedHex = new THREE.InstancedMesh(hexGeo, hexMat, totalTiles);
instancedHex.receiveShadow = true;

const hexMap = new Map();
const dummy = new THREE.Object3D();

function hexOffsetToWorld(q, r) {
  const x = hexPlaceRadius * (1.5 * q);
  const z = hexPlaceRadius * (Math.sqrt(3) * r + (q % 2 === 1 ? Math.sqrt(3) / 2 : 0));
  return { x, z };
}

let index = 0;
const startX = -((gridSizeX * hexPlaceRadius * 1.5) / 2);
const startZ = -((gridSizeZ * hexPlaceRadius * Math.sqrt(3)) / 2);
for (let q = 0; q < gridSizeX; q++) {
  for (let r = 0; r < gridSizeZ; r++) {
    const local = hexOffsetToWorld(q, r);
    const posX = startX + local.x;
    const posZ = startZ + local.z;
    dummy.position.set(posX, 0, posZ);
    dummy.updateMatrix();
    instancedHex.setMatrixAt(index, dummy.matrix);
    hexMap.set(`${q},${r}`, { x: posX, z: posZ, objects: [] });
    index++;
  }
}
instancedHex.instanceMatrix.needsUpdate = true;
scene.add(instancedHex);

// ===== 4. 1/2/3마리 구체 대형 배치 =====
// 지금 타이탄/다이노 배틀 페이지의 "삼각 대형"(1마리=중앙, 2마리=좌우, 3마리=정삼각형)과 직접
// 대응되는 로직 - 이후 실제 페이지 통합 시 이 함수의 오프셋 계산을 거의 그대로 재사용할 수 있음
const sphereRadius = 0.35;
const sphereGeo = new THREE.SphereGeometry(sphereRadius, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({ color: 0x66fcf1, metalness: 0.4, roughness: 0.2 });

function setSpheresOnHex(q, r, count) {
  const key = `${q},${r}`;
  if (!hexMap.has(key)) return [];
  const tileData = hexMap.get(key);
  tileData.objects.forEach((obj) => scene.remove(obj));
  tileData.objects = [];
  if (count <= 0) return [];

  if (count >= 4) {
    // count>=4는 아직 미구현(개별 표시 대신 마릿수 배지 등이 필요) - 검증 데모 범위 밖이라 스텁만
    // 남겨둠. 실제 통합 단계에서 다시 다뤄야 함
    return [];
  }

  const offsetDistance = 0.65;
  const yPos = sphereRadius;
  for (let i = 0; i < count; i++) {
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    let offsetX = 0, offsetZ = 0;
    if (count === 2) {
      const sign = i === 0 ? -1 : 1;
      offsetX = sign * offsetDistance;
    } else if (count === 3) {
      const angle = (i * 120 - 90) * (Math.PI / 180);
      offsetX = Math.cos(angle) * offsetDistance;
      offsetZ = Math.sin(angle) * offsetDistance;
    }
    sphere.position.set(tileData.x + offsetX, yPos, tileData.z + offsetZ);
    scene.add(sphere);
    tileData.objects.push(sphere);
  }
  return tileData.objects;
}

const centerQ = Math.floor(gridSizeX / 2);
const centerR = Math.floor(gridSizeZ / 2);
setSpheresOnHex(centerQ, centerR, 1);
const twoFormation = setSpheresOnHex(centerQ + 1, centerR, 2);
setSpheresOnHex(centerQ - 1, centerR + 1, 3);

// ===== 5. DOM 오버레이 프로토타입 - 기존 체력바/이름표 DOM+CSS 코드를 나중에 거의 그대로 재사용할
// 수 있는지 확인하기 위한 최소 검증. Vector3.project(camera)로 3D 월드좌표 -> 화면 2D px 좌표를
// 구해서 순수 HTML div를 그 위에 얹음(카메라가 팬/줌만 하고 회전은 안 해도 이 투영 계산 자체는
// 카메라 조작 방식과 무관하게 항상 똑같이 동작함) =====
const domLabel = document.createElement("div");
domLabel.className = "dom-label";
domLabel.textContent = "내 공룡";
document.body.appendChild(domLabel);

function updateDomLabel() {
  if (!twoFormation.length) return;
  const worldPos = twoFormation[0].position.clone();
  worldPos.y += sphereRadius + 0.35;
  const projected = worldPos.project(camera);
  if (projected.z > 1) {
    domLabel.style.display = "none";
    return;
  }
  domLabel.style.display = "block";
  domLabel.style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`;
  domLabel.style.top = `${(1 - (projected.y * 0.5 + 0.5)) * window.innerHeight}px`;
}

// ===== 6. 고정 각도 드래그 팬 + 휠 줌 (레이캐스터로 바닥 평면(Y=0) 교차점을 추적해서 흔들림 없이
// 정확히 따라오게 함 - 전략게임류 카메라 조작감) =====
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const mouseNdc = new THREE.Vector2();
const planeIntersect = new THREE.Vector3();
const dragStartPoint = new THREE.Vector3();
let isDragging = false;

function getPlaneIntersection(e, target) {
  mouseNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  return raycaster.ray.intersectPlane(groundPlane, target);
}

renderer.domElement.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (getPlaneIntersection(e, dragStartPoint)) isDragging = true;
});
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  if (getPlaneIntersection(e, planeIntersect)) {
    const delta = new THREE.Vector3().subVectors(dragStartPoint, planeIntersect);
    camera.position.add(delta);
  }
});
window.addEventListener("mouseup", () => { isDragging = false; });
window.addEventListener("mouseleave", () => { isDragging = false; });

const MIN_Y = 8, MAX_Y = 120, ZOOM_SPEED = 0.08;
renderer.domElement.addEventListener("wheel", (e) => {
  e.preventDefault();
  // 원래(제미나이 초안)는 목표 y가 범위를 넘으면 스크롤 입력 자체를 통째로 무시했음 - 한계 근처에서
  // 세게/빠르게 스크롤하면 줌이 안 먹히는 것처럼 느껴지는 문제가 있어서(실측 확인), 경계값으로
  // 자연스럽게 clamp되도록 수정. z는 "원래 요청한 델타"가 아니라 "실제로 y에 적용된 델타"에
  // 비례시켜야 경계에 막힌 순간에도 초기 각도(28/35=0.8) 비율이 안 틀어짐
  const rawNextY = camera.position.y + e.deltaY * ZOOM_SPEED;
  const clampedY = Math.max(MIN_Y, Math.min(MAX_Y, rawNextY));
  const appliedDeltaY = clampedY - camera.position.y;
  camera.position.y = clampedY;
  camera.position.z += appliedDeltaY * 0.8;
}, { passive: false });

// ===== 7. 자동 수치 검증 =====
function selfCheckHexAdjacency() {
  // (0,0)과 (1,0) 중심 간 거리 - odd-q 오프셋이어도 이웃 육각형 중심 간 거리는 항상
  // hexPlaceRadius*sqrt(3)이어야 함(정육각형 그리드의 불변 성질)
  const a = hexOffsetToWorld(0, 0);
  const b = hexOffsetToWorld(1, 0);
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  const expected = hexPlaceRadius * Math.sqrt(3);
  const diff = Math.abs(dist - expected);
  return { name: "육각형 인접 타일 간격(오프셋 좌표계)", pass: diff < 1e-9, detail: `실제 ${dist.toFixed(6)} / 기대 ${expected.toFixed(6)} (오차 ${diff.toExponential(2)})` };
}

function selfCheckSphereFloor(count, sphere, label) {
  const box = new THREE.Box3().setFromObject(sphere);
  const diff = Math.abs(box.min.y - 0);
  return { name: `${label} 바닥 정렬`, pass: diff < 1e-6, detail: `발밑 Y=${box.min.y.toFixed(6)} (기대 0)` };
}

function renderChecks() {
  const oneFormation = hexMap.get(`${centerQ},${centerR}`).objects;
  const threeFormation = hexMap.get(`${centerQ - 1},${centerR + 1}`).objects;
  const results = [
    selfCheckHexAdjacency(),
    selfCheckSphereFloor(1, oneFormation[0], "1마리 대형"),
    selfCheckSphereFloor(2, twoFormation[0], "2마리 대형(좌)"),
    selfCheckSphereFloor(3, threeFormation[1], "3마리 대형(2번째)"),
  ];
  const html = results.map((r) => `<div class="${r.pass ? "pass" : "fail"}">${r.pass ? "✓ PASS" : "✗ FAIL"} - ${r.name}<br><span style="opacity:.7;font-size:11px">${r.detail}</span></div>`).join("<hr style='border-color:#2a3444;margin:6px 0'>");
  document.getElementById("checks").innerHTML = `<b>자동 검증</b><hr style="border-color:#2a3444;margin:6px 0">${html}<hr style='border-color:#2a3444;margin:6px 0'><span style="opacity:.6;font-size:11px">타일 ${totalTiles.toLocaleString()}개(InstancedMesh)</span>`;
}
renderChecks();

// ===== 8. HUD / 루프 / 리사이즈 =====
function updateHud() {
  const p = camera.position;
  document.getElementById("hud").textContent =
    `카메라 위치  x:${p.x.toFixed(2)} y:${p.y.toFixed(2)} z:${p.z.toFixed(2)}\n` +
    `줌 높이(Y) ${p.y.toFixed(1)} (범위 ${MIN_Y}~${MAX_Y})\n` +
    `드래그=팬, 휠=줌 (고정 각도, 회전 없음)`;
}

function animate() {
  requestAnimationFrame(animate);
  updateDomLabel();
  updateHud();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
