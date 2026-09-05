// 건물: 건축물 최대 4개(중앙·정면·좌측·우측)를 세워두고 내 공룡 세팅의 공략력을 확인하는 페이지.
// 허수아비와 거의 동일한 구조(같은 "내 공룡 설정 + 타일 설정 + 3탭" 레이아웃, 같은 세계좌표+
// 빌보드 3D 표현)지만 결정적으로 다른 점 두 가지(둘 다 사용자 확정) - (1) 허수아비는 안 죽는
// 고정 표적인 반면 여기 건물들은 실제 체력을 갖고 파괴될 수 있음. (2) 타이탄과 달리 공룡은 인접
// 칸에서 공격할 수 없고 반드시 공격하려는 건물과 같은 타일에 직접 가있어야 함 - 그래서 "가장
// 앞쪽 살아있는 건물을 자동 스캔"하는 대신, 사용자가 이동 버튼으로 지정한 타일(buildingTargetSlot)
// 만 공격 대상이 되고, 그 건물이 파괴되면 자동으로 다른 곳으로 넘어가지 않고 그냥 멈춤(사용자가
// 다시 이동 버튼을 눌러야 함). 4칸 전부(중앙 포함) 동등하게 건설 가능 - 처음엔 중앙을 공룡 전용
// "대기 자리"로 뒀었는데, 그러면 거기엔 건물을 못 짓고 한 번 다른 곳으로 이동하면 중앙으로
// 돌아올 방법도 없어서 의미가 없다는 사용자 지적으로 나머지 3칸과 동등하게 바꿈.
//
// 육각형 4칸을 다이노 배틀/타이탄과 같은 세계좌표(결합 viewBox) + 카메라 촬영(perspective+
// rotateX 3D 빌보드) 방식으로 배치함 - 허수아비는 타일이 하나뿐이라 "grid 한 칸에 통째로 포개는"
// 단순한 트릭을 썼지만, 여기는 4개를 각자 다른 자리에 둬야 해서 다이노 배틀/타이탄처럼 진짜
// world-coordinate 배치가 필요함.

const BUILDING_TILE_KEY = "dino_building_tile_settings";
const BUILDING_SPEED_KEY = "dino_building_speed_ms";
const BUILDING_OWNED_LEVELS_KEY = "dino_building_owned_rune_levels";
const BUILDING_SLOTS_KEY = "dino_building_slots"; // [중앙, 정면, 좌측, 우측] 각각 null | BUILDING_TYPES의 id

// ===== 전투 설정(사용자 확정 - "타이탄처럼 전투 설정이 있어야겠다... 그걸 기준으로 빠른 계산,
// 조합 찾기를 하지") - 실제 공격 대상(직접 때리는 건물 + 그 뒤 건물, 지진 룬 스플래시 계산용)과
// 적 투석기(캐터펄트) 반격 조건을 한 곳에 모아둠. 지금은 이 설정 카드만 먼저 만드는 단계(사용자
// 확정 - "일단 전투 설정부터 만들어 볼까?") - 투석기가 실제로 매 틱 내 공룡을 때리는 로직/빠른
// 계산·조합 찾기가 이 값을 실제로 읽어서 계산하는 부분은 다음 단계에서 이어감. 타일 설정과
// 달리 이 페이지만의 설정이라 전역 공유 안 함(서버 레벨캡류와 다름) */
const BUILDING_COMBAT_CONFIG_KEY = "dino_building_combat_config";

function defaultBuildingCombatConfig() {
  return {
    targetBuildingId: null, // 직접 때리는 건물
    behindBuildingId: null, // 그 뒤에 있는 건물(지진 룬 스플래시 대상)
    catapultLevel: null, // 적 투석기 공격 레벨(1~4) - 레벨별 탄 대미지는 BUILDING_CATAPULT_DAMAGE
    catapultSpeedLevel: 0, // 적 투석기 발사속도 레벨(0~10) - 초는 BUILDING_CATAPULT_SPEED_SECONDS
    distanceTiles: 1, // 건물까지의 거리
    continuousBattle: false // 켜져 있으면 공룡이 죽어도 재소환 후 다시 합류(타이탄과 같은 개념)
  };
}

function loadBuildingCombatConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(BUILDING_COMBAT_CONFIG_KEY));
    return { ...defaultBuildingCombatConfig(), ...(saved || {}) };
  } catch (e) {
    return defaultBuildingCombatConfig();
  }
}

function saveBuildingCombatConfig(config) {
  localStorage.setItem(BUILDING_COMBAT_CONFIG_KEY, JSON.stringify(config));
}

// 적 투석기 발사속도 레벨별 재장전 시간(초) - 레벨 0(기본)=6.0초, 레벨마다 0.3초씩 빨라져서
// 10레벨=3.0초(사용자 확정: "0레벨(기본)이 6s... 10레벨 3s")
const BUILDING_CATAPULT_SPEED_SECONDS = [6.0, 5.7, 5.4, 5.1, 4.8, 4.5, 4.2, 3.9, 3.6, 3.3, 3.0];
// label은 항상 한국어 원문 그대로 두고(공유 옵션 배열들과 같은 이유 - 모듈 로드 시점엔 i18n이 아직
// 준비 안 됨), 화면에 보여줄 때만 buildingCatapultSpeedLabel()이 building.settings.catapultSpeedOption
// 템플릿으로 다시 조립함
const BUILDING_CATAPULT_SPEED_OPTIONS = BUILDING_CATAPULT_SPEED_SECONDS.map((sec, lv) => ({
  value: lv,
  label: `Lv.${lv} (${sec.toFixed(1)}초)`
}));
function buildingCatapultSpeedLabel(lv) {
  return t("building.settings.catapultSpeedOption", { level: lv, sec: BUILDING_CATAPULT_SPEED_SECONDS[lv].toFixed(1) });
}

// 투석기 공격 레벨별 탄종/대미지(사용자 확정 - "100 150 200 300 대미지의 각 탄"). 레벨이 높을수록
// 더 센 탄을 쓴다는 것만 확정됐고 탄 이름(claw/stone/metal/realmetal)과의 매핑은 그 순서가
// 유일하게 말이 되는 배정이라 채택(assets/tribe/ 실제 파일명 참고)
const BUILDING_CATAPULT_DAMAGE = { 1: 100, 2: 150, 3: 200, 4: 300 };
const BUILDING_CATAPULT_LEVELS = [
  { value: null, label: "없음", img: null },
  { value: 1, label: "1레벨 (100)", img: "ClawAmmo_Img.png" },
  { value: 2, label: "2레벨 (150)", img: "StoneAmmo_Img.png" },
  { value: 3, label: "3레벨 (200)", img: "MetalAmmo_Img.png" },
  { value: 4, label: "4레벨 (300)", img: "RealMetalAmmo_Img.png" }
];
// catapultOptFor(v)로 찾은 원본 옵션의 label(한국어 고정)은 안 쓰고, 화면 표시는 항상 이 함수로
function buildingCatapultLevelLabel(value) {
  if (value === null) return t("common.optionNone");
  return t("building.settings.catapultLevelOption", { level: value, dmg: BUILDING_CATAPULT_DAMAGE[value] });
}

// BUILDING_TYPES의 label(한국어 고정)은 저장/비교에 안 쓰이지만(id가 그 역할을 함) 다른 공유
// 옵션 배열들과 같은 원칙으로 그대로 두고, 표시할 때만 이 함수로 labelKey를 번역함
function buildingTypeDisplayLabel(id) {
  if (id === null || id === undefined) return t("common.optionNone");
  const def = BUILDING_TYPES.find((b) => b.id === id);
  return def ? t(def.labelKey) : t("common.optionNone");
}

const BUILDING_GRADE_ORDER = ["일반", "희귀", "에픽", "유니크"];

function buildingRuneSortKey(name) {
  const r = RUNES_DATA[name];
  const gradeRank = BUILDING_GRADE_ORDER.indexOf(r.grade);
  const idNum = Number((r.imgId.match(/\d+/) || [0])[0]);
  return gradeRank * 10000 + idNum;
}

function buildingSuitableRuneNames() {
  return Object.keys(RUNES_DATA)
    .filter((n) => !BUILDING_UNSUITABLE_RUNE_LIST.includes(n))
    .sort((a, b) => buildingRuneSortKey(b) - buildingRuneSortKey(a));
}

function loadBuildingOwnedLevels() {
  const levels = {};
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(BUILDING_OWNED_LEVELS_KEY)) || {};
  } catch (e) {
    saved = {};
  }
  buildingSuitableRuneNames().forEach((name) => {
    const v = saved[name];
    levels[name] = Number.isInteger(v) && v >= 0 && v <= 31 ? v : 0;
  });
  return levels;
}

function saveBuildingOwnedLevels(levels) {
  localStorage.setItem(BUILDING_OWNED_LEVELS_KEY, JSON.stringify(levels));
}

function defaultBuildingTileSettings() {
  return { natureAdjacent: false, atkTowerLevel: null, hpTowerLevel: null };
}

// 허수아비(내 부족 땅에 내가 직접 설치)와 달리 여기 성벽들은 상대 부족이 점령한 땅의 건축물을
// 공격하는 것이라 "내 부족 점령 상태" 설정 자체가 의미 없음(사용자 지적) - 그래서 계산에는 전혀
// 안 쓰이고 tileSettings에도 저장하지 않음. 다만 "자연 구조물과 인접" 토글과 짝을 맞춰 2열을
// 채우기 위해 화면에는 계속 보여주되(사용자 확정 - "자연 구조물과 인접도 오른쪽에 부족 점령 그거
// 넣어서 2등분 맞추기. 대신 부족 점령은 무조건 꺼두기") disabled 처리해서 항상 꺼진 채 조작 불가.
// 대신 반격(투석기)을 버텨야 해서 체력 버프 타워가 있음.
function loadBuildingTileSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(BUILDING_TILE_KEY));
    return { ...defaultBuildingTileSettings(), ...(saved || {}) };
  } catch (e) {
    return defaultBuildingTileSettings();
  }
}

function saveBuildingTileSettings(settings) {
  localStorage.setItem(BUILDING_TILE_KEY, JSON.stringify(settings));
}

// 건물 공략은 항상 소환 가능한 최대 마리 수(7마리)로 계산함(사용자 확정 - 프로필의 "공룡 수"
// 설정과 무관하게 항상 7마리가 동시에 공격한다고 가정. 이전엔 count가 "협동 공격" 룬 발동 조건
// 판정에만 쓰이고 정작 대미지엔 안 곱해져서 실제론 1마리 몫만 계산되고 있었음 - 이제
// computeBuildingCombatValues에서 atk에 count를 곱함)
const BUILDING_MAX_DINO_COUNT = 7;

function buildingDinoInputs(profile) {
  const inputs = applyLowLevelConstellationBlock(applyConstellationCap(applyServerLevelCap(dinoProfileToBattleInputs(profile))));
  inputs.count = BUILDING_MAX_DINO_COUNT;
  return inputs;
}

function buildingGetSpeedMs() {
  const saved = Number(localStorage.getItem(BUILDING_SPEED_KEY));
  return BATTLE_SPEED_OPTIONS.some((o) => o.ms === saved) ? saved : 350;
}

function defaultBuildingSlots() {
  return [null, null, null, null];
}

function loadBuildingSlots() {
  try {
    const saved = JSON.parse(localStorage.getItem(BUILDING_SLOTS_KEY));
    if (Array.isArray(saved) && saved.length === 4) return saved;
    return defaultBuildingSlots();
  } catch (e) {
    return defaultBuildingSlots();
  }
}

function saveBuildingSlots(slots) {
  localStorage.setItem(BUILDING_SLOTS_KEY, JSON.stringify(slots));
}

// ===== 세계좌표(다이노 배틀/타이탄과 같은 원리) - 중앙 육각형 하나를 중심으로 그 앞쪽에
// 정면·좌측·우측 3개 육각형이 꽃잎처럼 붙는 배치(사용자 확정). 4칸 전부 건설 가능한 건물
// 타일이고(중앙도 예외 아님 - 처음엔 공룡 전용 "대기 자리"로 뒀었는데, 그러면 건물을 못 짓고
// 거기로 돌아올 수도 없어서 의미가 없다는 사용자 지적으로 나머지 3칸과 동등하게 취급), 공룡은
// buildingTargetSlot으로 지정된 그 타일 위에 서서 공격함. 중앙을 원점(0,0)에 두고 HEX_NEIGHBOR
// 방향 벡터로 나머지 3칸을 명시적으로 배치(CSS 3D 시절 SVG viewBox 절대좌표 재사용 금지 - 그렇게
// 했다가 타일 중심과 건물/공룡 좌표가 어긋나는 버그가 났었음). 정면은 위쪽 이웃, 좌/우는 각각
// 왼쪽위/오른쪽위 이웃이라 정면 육각형은 좌측·우측 육각형과도 서로 변을 맞대고 있고, 중앙 육각형도
// 정면·좌측·우측 전부와 변을 맞댐(좌측 vs 우측만 서로 안 붙어있음 - 정면이나 중앙을 거쳐야 인접) =====
const BUILDING_HEX_CENTERS = [
  [0, 0],                                          // 중앙
  hexAdd([0, 0], HEX_NEIGHBOR.up),                  // 정면
  hexAdd([0, 0], HEX_NEIGHBOR.upperLeft),           // 좌측
  hexAdd([0, 0], HEX_NEIGHBOR.upperRight),          // 우측
];

// 지진 룬의 "주변 1칸" 인접 관계 - 위 육각형 배치 그대로: 중앙(0)은 정면·좌측·우측 전부와
// 인접하고, 정면(1)도 중앙·좌측·우측 전부와 인접함. 좌측(2)/우측(3)은 서로는 안 붙어있고
// 중앙·정면하고만 인접함
const BUILDING_ADJACENCY = { 0: [1, 2, 3], 1: [0, 2, 3], 2: [0, 1], 3: [0, 1] };

// Three.js 육각형 바닥(js/core/hex-scene3d.js) - "live" 탭을 처음 열 때 buildingInitScene3d()가
// 마운트함(buildingInitModeTabs 참고, 그 전엔 카드가 display:none이라 캔버스가 0x0)
let buildingScene3d = null;
// theme-changed 리스너 핸들 - 페이지를 여러 번 오가도 리스너가 계속 쌓이지 않도록, 새로 등록하기
// 전에 이 참조로 이전 방문 몫을 먼저 지움(buildingScene3d와 같은 진짜 모듈 스코프라 다음 방문에서도
// "그때 그 함수"를 정확히 지목할 수 있음)
let buildingThemeChangeHandler = null;

// 카메라는 중앙·정면 타일의 중점을 내려다보게 잡음(타일 좌표에서 직접 유도 - SVG 시절 절대좌표
// 아님). 다이노 배틀/타이탄과 같은 계열의 시점(정면에서 살짝 위, 카메라에 가까운 중앙 타일이 크게
// 보이도록)
const BUILDING_CAM_TARGET = [
  (BUILDING_HEX_CENTERS[0][0] + BUILDING_HEX_CENTERS[1][0]) / 2,
  (BUILDING_HEX_CENTERS[0][1] + BUILDING_HEX_CENTERS[1][1]) / 2,
];

function buildingInitScene3d() {
  const mountEl = document.getElementById("buildingFloorMount");
  if (!mountEl) return;
  // "지금 이 mountEl"에 이미 캔버스가 붙어있으면(같은 페이지 세션 안에서 탭만 왔다갔다 한 경우)
  // 리사이즈만 하고 끝 - buildingScene3d(안 null)만 보고 판단하면 안 됨(실측으로 재현한 버그: 페이지를
  // 나갔다 재방문하면 mountEl은 라우터가 완전히 새로 만든 엘리먼트인데 buildingScene3d는 예전
  // 인스턴스를 그대로 들고 있어서 "이미 마운트됨"으로 착각 - resize()는 예전(DOM에서 이미 떨어져
  // 나간) mountedContainer를 보고 0x0으로 조용히 아무것도 안 해서, 새 mountEl엔 캔버스가 영영
  // 안 붙어 바닥이 통째로 안 보였음)
  if (buildingScene3d && mountEl.querySelector("canvas")) { buildingScene3d.resize(); return; }
  if (typeof createHexFloorScene !== "function") return;
  // 위 가드를 통과했다는 건 새 mountEl에 새 씬을 만들어야 한다는 뜻 - buildingScene3d가 이미
  // 채워져 있다면(재방문) 그건 직전 방문에서 만든, 이제 화면엔 없지만 WebGL 리소스는 아직 살아있는
  // 예전 씬임 - dispose 없이 그냥 덮어쓰면 그 리소스가 영영 안 풀림(사이트 전체 점검에서 발견)
  if (buildingScene3d) buildingScene3d.dispose();
  buildingScene3d = createHexFloorScene({
    // 마운트 즉시 resize()가 실제 컨테이너 비율로 다시 잡아주므로 여기 값은 초기 종횡비 정도만
    // 맞으면 됨
    worldW: 5 * HEX_HALF_W,
    worldH: 4 * HEX_HALF_H,
    // 건물은 점령된 타일 위에만 세울 수 있고 이 페이지는 "적 건물"을 부수는 컨텐츠라, 4칸 전부
    // 적이 점령한 타일임(사용자 확정 - 내 타일을 뜻하는 골드는 안 맞음) - 타이탄 보스/다이노 배틀
    // 상대 타일과 같은 고정 리터럴 레드(테마 무관)
    hexTiles: BUILDING_HEX_CENTERS.map((center) => ({ center, tintVar: "#e0473f" })),
    camera: {
      position: [BUILDING_CAM_TARGET[0], 220, BUILDING_CAM_TARGET[1] + 173.4],
      lookAt: [BUILDING_CAM_TARGET[0], 0, BUILDING_CAM_TARGET[1]],
      fov: 45,
    },
    // 창 크기가 바뀌면 육각형이 화면에서 차지하는 실제 픽셀 크기도 바뀌므로, 육각형 기준으로
    // 잡은 공룡 크기(--avatar-diam-px)도 다시 계산해야 함
    onResize: () => buildingUpdateDinoPosition(),
  });
  buildingScene3d.mount(mountEl);
  document.removeEventListener("theme-changed", buildingThemeChangeHandler);
  buildingThemeChangeHandler = () => {
    if (buildingScene3d && mountEl.isConnected) buildingScene3d.rebakeColors();
  };
  document.addEventListener("theme-changed", buildingThemeChangeHandler);
  // "live" 탭이 display:none인 동안(페이지 로드 시점) buildingPositionSlots()/
  // buildingUpdateDinoPosition()이 이미 한 번 위치를 잡았는데, 그때는 씬이 없어서
  // buildingWorldToPercent가 폴백(화면 중앙)을 썼음 - 씬이 막 마운트된 지금 실제 projectToScreen
  // 좌표로 다시 잡아줘야 함(안 그러면 4칸 히트박스/건물/공룡이 전부 화면 중앙에 겹쳐 있는 버그가
  // 남음 - 실측으로 확인된 버그)
  buildingPositionSlots();
  buildingUpdateDinoPosition();
}

function buildingWorldToPercent([x, y]) {
  if (buildingScene3d) return buildingScene3d.projectToScreen(x, y);
  return { left: "50%", top: "50%" }; // 씬 마운트 전 폴백(탭이 열리기 전엔 안 보이므로 위치는 무의미)
}

// ===== 재생 상태 =====
let buildingAttackTimer = null;
let buildingRunning = false;
let buildingElapsedSec = 0;
let buildingTotalDmg = 0;
// buildingStartAttack()에서 한 번만 계산해서 매 틱 재사용하는 캐시(성능 최적화) - "전투 설정" 탭을
// 건드리면 재생이 자동으로 멈추므로 재생 중엔 이 값들이 안 바뀜
let buildingCachedCombatConfig = null;
let buildingCachedInputs = null;
let buildingCachedTileCfg = null;
let buildingAttackCount = 0; // 지진 주기 판정용 - 리셋 시 0으로
let buildingMaxHp = [null, null, null, null]; // null = 그 자리에 건물 없음
let buildingHp = [null, null, null, null];
// 공룡은 타이탄과 달리 주변 칸에서 공격할 수 없고, 반드시 공격하려는 건물과 같은 타일에 직접
// 가있어야 함(사용자 확정) - 그래서 "가장 앞쪽 살아있는 건물"을 자동으로 스캔하던 예전 로직 대신,
// 사용자가 이동 버튼으로 직접 지정한 타일(0=중앙/1=정면/2=좌측/3=우측)만 공격 대상이 됨.
// 기본값을 0(중앙)으로 둠 - buildingUpdateDinoPosition()이 처음부터 공룡을 중앙에 그려주는데,
// 여기 기본값이 null이면 "화면엔 이미 중앙에 서 있는데 공격 시작이 안 눌린다"는 버그가 있었음
// (사용자 지적 - 실제로 이동 버튼을 한 번 눌러야만 buildingFrontTargetIndex가 0을 반환했음)
let buildingTargetSlot = 0;
const BUILDING_SLOT_LABEL_KEYS = ["building.slotLabels.center", "building.slotLabels.front", "building.slotLabels.left", "building.slotLabels.right"];

// ===== 실전 시뮬레이션의 캐터펄트 반격 - 공룡 개별 체력(사용자 확정 - "왜 공룡들 체력이 표시가
// 안 되어있는지 모르겠지만 공룡 체력 표시하고... 캐터펄트 공격 켜져있으면... 데미지"). 통계
// 시뮬레이션(runBuildingSimulation)과 같은 규칙(광역, 항상 장전 완료 상태라 도착 즉시 첫 발,
// 강인함1/2로 감소)이지만 여기는 "한 판"을 실시간으로 보여주는 거라 희생/마지막 선물 같은 확률
// 트리거는 반영하지 않음(통계 시뮬레이션에서만 정확히 반영됨 - 라이브 뷰까지 반영하면 매 틱 확률
// 분기가 생겨 재현성/복잡도가 크게 늘어남) =====
let buildingDinoHp = Array(BUILDING_MAX_DINO_COUNT).fill(0);
let buildingDinoMaxHp = 0;
let buildingDinoReviveAt = Array(BUILDING_MAX_DINO_COUNT).fill(null); // null 아니면 그 시각(경과초)에 부활

// 투사체 비행 시간(css/building.css의 building-projectile-fly 애니메이션 시간과 반드시 맞춰야 함) -
// 인게임처럼 "쏘는 순간"과 "맞는 순간" 사이에 시간차를 둠(사용자 확정 - "투사체가 타일에 명중한
// 뒤에 대미지가 터지도록"). 대미지 적용을 이만큼 늦춘 setTimeout들을 여기 모아뒀다가, 일시정지/
// 초기화/페이지 이탈 시 한꺼번에 취소함(안 그러면 이미 멈춘 뒤에도 뒤늦게 대미지가 터지거나,
// 사라진 DOM에 접근해 콘솔 에러가 남 - 다른 타이머들과 같은 이유)
const BUILDING_PROJECTILE_FLIGHT_MS = 450;
let buildingPendingCatapultTimers = [];
function buildingClearPendingCatapultTimers() {
  buildingPendingCatapultTimers.forEach((t) => clearTimeout(t));
  buildingPendingCatapultTimers = [];
}
let buildingNextCatapultFireSec = 1; // 캐터펄트는 항상 장전 완료 상태라 내 공격 1타와 동시에 첫 발(사용자 확정)

// ===== 관련 수치 카드(타이탄과 같은 패턴, css/titan.css의 .metrics-grid/.metric-tile을 그대로
// 재사용) - 평타 대미지/지진 대미지/공격력 증폭량/최종 평균 대미지 4개. 클릭하면 세부 내역이
// 펼쳐짐(타이탄과 동일) =====
let buildingLastMetrics = null;
let buildingActiveMetricKey = null;

// 재생 중(setInterval)에 다른 페이지로 이동해도 안 멈추고 계속 buildingRunAttackTick을 불러서
// 이미 사라진 DOM에 접근하다 콘솔 에러가 나던 버그(허수아비/타이탄에서 이미 겪고 고친 것과 같은
// 종류) - 페이지를 벗어나는 순간 타이머를 확실히 멈춤
window.addEventListener("hashchange", () => {
  clearInterval(buildingAttackTimer);
  buildingRunning = false;
  buildingClearPendingCatapultTimers();
});

// 서버 레벨캡 드롭다운 변경 시에도 "내 공룡" 요약 카드(40% 이하 별자리 차단 경고)를 다시 그릴 수
// 있도록 별도 함수로 뽑음(titan-page.js의 titanRenderMyDinoSection과 같은 패턴)
function buildingRenderMyDinoSection() {
  renderMyDinoPage(document.getElementById("buildingMyDinoSection"), {
    idPrefix: "buildingMy_",
    unsuitableList: BUILDING_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: t("building.unsuitableRuneLabel"),
    onChange: () => {
      buildingRefreshMetricsCard();
      buildingResetDisplay();
      buildingResetQuickCalc();
    }
  });
}

function renderBuildingPage(container) {
  const [c0, c1, c2, c3] = BUILDING_HEX_CENTERS;
  container.innerHTML = `
    <h2 class="sr-only">${t("building.heading")}</h2>
    <div class="warning">${t("building.warning")}</div>

    <div id="buildingMyDinoSection"></div>

    ${renderMetricsCard("buildingMetricsGrid", "buildingMetricDetail", [
      { id: "buildingMetricBasicDmg", key: "basicDmg", label: t("building.metrics.basicDmg") },
      { id: "buildingMetricQuakeDmg", key: "quakeDmg", label: t("building.metrics.quakeDmg") },
      { id: "buildingMetricAtkAmp", key: "atkAmp", label: t("building.metrics.atkAmp") },
      { id: "buildingMetricFinalAvgDmg", key: "finalAvgDmg", label: t("building.metrics.finalAvgDmg") },
    ])}

    <div class="card battle-main-card building-field-card" id="buildingMainCard">
      <div class="battle-mode-tabs building-mode-tabs-4" id="buildingModeTabs" data-active-idx="0">
        <span class="battle-mode-indicator"></span>
        <button class="battle-mode-tab active" data-mode="settings" id="buildingModeTabSettings"><span>${t("building.tab.settings")}</span></button>
        <button class="battle-mode-tab" data-mode="quick" id="buildingModeTabQuick"><span>${t("building.tab.quick")}</span></button>
        <button class="battle-mode-tab" data-mode="live" id="buildingModeTabLive"><span>${t("building.tab.live")}</span></button>
        <button class="battle-mode-tab" data-mode="optimize" id="buildingModeTabOptimize"><span>${t("building.tab.optimize")}</span></button>
      </div>

      <div class="battle-mode-panel" id="buildingSettingsModeCard">
        <div class="titan-settings-grid">
          <div class="titan-settings-row">
            <div class="setting-label">${t("building.settings.natureLabel")}</div>
            <label class="switch"><input type="checkbox" id="buildingNatureToggle"><span class="slider round"></span></label>
          </div>
          <div class="titan-settings-row">
            <div class="setting-label">${t("building.settings.tribeLabel")}</div>
            <label class="switch" title="${t("building.settings.tribeTooltip")}"><input type="checkbox" id="buildingTribeToggle" disabled><span class="slider round"></span></label>
          </div>
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">${t("building.settings.atkTowerLabel")}</label>
              <div class="custom-dropdown" id="buildingAtkTowerDropdown">
                <div class="selected-value" id="buildingAtkTowerSelectedValue">${t("common.optionNone")}</div>
                <ul class="dropdown-list" id="buildingAtkTowerList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">${t("building.settings.hpTowerLabel")}</label>
              <div class="custom-dropdown" id="buildingHpTowerDropdown">
                <div class="selected-value" id="buildingHpTowerSelectedValue">${t("common.optionNone")}</div>
                <ul class="dropdown-list" id="buildingHpTowerList"></ul>
              </div>
            </div>
          </div>
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">${t("building.settings.serverLevelCapLabel")}</label>
              <div class="custom-dropdown" id="buildingServerLevelCapDropdown">
                <div class="selected-value" id="buildingServerLevelCapSelectedValue">${t("common.optionNone")}</div>
                <ul class="dropdown-list" id="buildingServerLevelCapList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">${t("building.settings.constellationCapLabel")}</label>
              <div class="custom-dropdown" id="buildingConstellationCapDropdown">
                <div class="selected-value" id="buildingConstellationCapSelectedValue">${t("common.optionNone")}</div>
                <ul class="dropdown-list" id="buildingConstellationCapList"></ul>
              </div>
            </div>
          </div>
          <div class="titan-settings-levelblock building-settings-divider-before">
            <div class="titan-settings-stack">
              <label class="setting-label">${t("building.settings.targetBuildingLabel")}</label>
              <div class="custom-dropdown" id="buildingCombatTargetDropdown">
                <div class="selected-value" id="buildingCombatTargetSelectedValue">${t("common.optionNone")}</div>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">${t("building.settings.behindBuildingLabel")}</label>
              <div class="custom-dropdown" id="buildingCombatBehindDropdown">
                <div class="selected-value" id="buildingCombatBehindSelectedValue">${t("common.optionNone")}</div>
              </div>
            </div>
          </div>
          <div class="building-distance-continuous-row">
            <div class="titan-settings-stack">
              <label class="setting-label" for="buildingDistanceInput">${t("building.settings.distanceLabel")}</label>
              <div class="affix-input has-suffix"><input type="tel" inputmode="numeric" id="buildingDistanceInput" value="1"><span class="affix-suffix">${t("building.settings.distanceUnit")}</span></div>
            </div>
            <!-- "건물까지의 거리"는 라벨(위)+입력칸(아래) 2줄인데 "연속 전투"는 라벨+토글이 한
                 줄이라 키가 안 맞았음 - 진짜로 위쪽에 보이지 않는 라벨을 하나 더 두면(.titan-settings-stack
                 .setting-label 스타일 그대로 재사용, visibility:hidden만 추가) 높이가 정확히 같아짐
                 (사용자 확정 - "옆에 있는 타일수의 입력칸과 높이를 똑같이 맞춰... 위쪽에 투명
                 글자가 있다라고 생각해도 좋다는거지") -->
            <div class="titan-settings-stack">
              <label class="setting-label" style="visibility:hidden">${t("building.settings.distanceLabel")}</label>
              <div class="titan-settings-row">
                <label class="setting-label">${t("building.settings.continuousBattleLabel")}</label>
                <label class="switch"><input type="checkbox" id="buildingContinuousToggle"><span class="slider round"></span></label>
              </div>
            </div>
          </div>
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">${t("building.settings.catapultLevelLabel")}</label>
              <div class="custom-dropdown" id="buildingCatapultLevelDropdown">
                <div class="selected-value" id="buildingCatapultLevelSelectedValue">${t("common.optionNone")}</div>
                <ul class="dropdown-list" id="buildingCatapultLevelList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">${t("building.settings.catapultSpeedLabel")}</label>
              <div class="custom-dropdown" id="buildingCatapultSpeedDropdown">
                <div class="selected-value" id="buildingCatapultSpeedSelectedValue">${t("building.settings.catapultSpeedDefault")}</div>
                <ul class="dropdown-list" id="buildingCatapultSpeedList"></ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="battle-mode-panel" id="buildingQuickModeCard" style="display:none;">
        <p class="quickcalc-desc">${t("building.quick.desc")}</p>
        <button class="btn-simulate" id="buildingQcBtn">${t("building.quick.calcBtn")}</button>
        <p class="quickcalc-desc" id="buildingQcGuide" style="display:none;">${t("building.quick.needTargetGuide")}</p>
        <div class="report-grid" id="buildingQcResult" style="display:none;">
          <div class="report-tile"><div class="metric-label">${t("building.quick.totalDmgLabel")}</div><div class="metric-value accent" id="buildingQcTotalDmg">-</div></div>
          <div class="report-tile"><div class="metric-label">${t("building.quick.quakeDmgLabel")}</div><div class="metric-value" id="buildingQcQuakeDmg">-</div></div>
          <div class="report-tile"><div class="metric-label">${t("building.quick.frontBreakTimeLabel")}</div><div class="metric-value" id="buildingQcFrontTime">-</div></div>
          <div class="report-tile" id="buildingQcBehindTile" style="display:none;"><div class="metric-label" id="buildingQcBehindLabel">${t("building.quick.behindRemainingHpLabel")}</div><div class="metric-value" id="buildingQcBehindValue">-</div></div>
          <div class="report-tile"><div class="metric-label">${t("building.quick.deadCountLabel")}</div><div class="metric-value" id="buildingQcDeadCount">-</div></div>
          <div class="report-tile"><div class="metric-label">${t("building.quick.avgDeathTimeLabel")}</div><div class="metric-value" id="buildingQcDeathTime">-</div></div>
        </div>
        <div class="report-chart-section" id="buildingQcChartSection" style="display:none;">
          <div class="report-chart-label">${t("building.quick.chartLabel")}</div>
          <div class="report-chart-box">
            <canvas id="buildingHpChart"></canvas>
          </div>
          <div id="buildingAvgHpPer" class="report-survival">${t("building.quick.avgSurvivalHpLabel", { percent: 0 })}</div>
        </div>
      </div>

      <div class="battle-mode-panel" id="buildingOptimizeModeCard" style="display:none;">
        <div class="dummy-optimizer">
          <h3 class="dummy-optimizer-title">${t("building.optimize.title")}</h3>
          <p class="quickcalc-desc">${t("building.optimize.desc")}</p>
          <div class="titan-quick-summary" id="buildingOptimizeQuickSummary"></div>
          <div class="dummy-owned-rune-grid" id="buildingOwnedRuneGrid"></div>
          <button class="btn-simulate" id="buildingOptimizeBtn">${t("building.optimize.startBtn")}</button>
          <div id="buildingOptimizeResult"></div>
        </div>
      </div>

      <div class="battle-mode-panel" id="buildingLiveModeCard" style="display:none;">
        <div class="building-field-wrap">
          <div class="building-stage" id="buildingStage">
            <div class="building-tilt" id="buildingFloorMount"></div>

              <!-- 육각형 타일(4칸) 클릭 -> 건설 모달 열기. 예전엔 바닥 SVG의 polygon 자체가 클릭
                   대상이었는데, 바닥이 Three.js(캔버스)로 바뀌면서 그 자리를 대신하는 투명 히트박스 -
                   buildingPositionSlots()가 hexScene.projectToScreen()으로 위치를 심음 -->
              <div class="building-hex-hitbox-layer" id="buildingHexHitboxLayer">
                ${[0, 1, 2, 3].map((i) => `<div class="building-hex-tile building-hex-hitbox" data-slot="${i}" id="buildingHexHitbox${i}"></div>`).join("")}
              </div>

              <div class="building-formation-group" id="buildingFormationGroup">
                <div class="building-dino-slot" id="buildingDinoSlot">
                  <!-- 실제로는 최대 7마리가 동시에 공격하지만(BUILDING_MAX_DINO_COUNT), 한 타일에
                       7마리를 다 그리면 너무 빽빽해서 3마리만 보여주고 나머지는 숨김(사용자 확정 -
                       숨겨진 나머지도 대미지 계산엔 그대로 포함됨, computeBuildingCombatValues 참고).
                       각 공룡 체력바/이름은 다이노 배틀(.battle-hp-bar-mini/.battle-team-slot-name)과
                       같은 구성(사용자 확정 - "공룡 밑에 이름도 넣고... 다른 곳이랑 똑같이") -
                       .building-dino-avatar-slot 자체는 공(.building-dino-avatar) 하나만 in-flow로
                       갖고 체력바/이름은 절대 위치 오버레이라서, 기존에 실측으로 맞춰둔 3D 접지
                       계산(클러스터의 align-items:flex-end + translate(-50%,-100%))을 전혀 건드리지
                       않음 -->
                  <div class="building-dino-cluster">
                    ${[0, 1, 2].map((i) => `
                      <div class="building-dino-avatar-slot">
                        <div class="building-dino-hpbar"><div class="building-dino-hpfill" id="buildingDinoHpFill${i}"></div></div>
                        <div class="building-dino-avatar" id="buildingDinoAvatar${i}"></div>
                        <div class="building-dino-avatar-name">${t("building.dinoAvatarNameFallback")}</div>
                      </div>
                    `).join("")}
                  </div>
                </div>
                ${[0, 1, 2, 3].map((i) => `
                  <div class="building-wall-slot" id="buildingWallSlot${i}">
                    <div class="building-sprite-frame" id="buildingSpriteFrame${i}">
                      <img class="building-sprite" id="buildingSprite${i}" alt="">
                      <div class="building-hp-overlay">
                        <div class="building-hp-text" id="buildingHpText${i}"></div>
                        <div class="building-hpbar"><div class="building-hpfill" id="buildingHpFill${i}"></div></div>
                      </div>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
          <!-- 화면에 안 보이는 나머지 공룡들(최대 7마리 중 3마리만 타일 위에 표시)의 체력바 -
               타이탄의 #titanMyHpBars(대기 공룡 사이드 목록)와 같은 개념(사용자 확정 - "대기
               공룡도 밑에 체력바로 표시") - 타이탄은 옆에 세로로 두지만 건물은 모바일 우선 좁은
               카드 폭이라 육각형 무대 아래 가로 줄로 배치 -->
          <div class="building-dino-reserve-hpbar-list" id="buildingDinoReserveHpBars"></div>
        <!-- 공룡은 타이탄과 달리 인접 칸에서 공격할 수 없고 반드시 같은 타일에 가있어야 공격할 수
             있어서(사용자 확정), 육각형을 직접 누르는 게 아니라 이 버튼으로 명시적으로 이동함(육각형
             클릭은 그 자리에 뭘 지을지 고르는 용도로 이미 쓰고 있어서 겹치지 않게 분리) -->
        <div class="building-move-controls" id="buildingMoveControls">
          <button class="building-move-btn" id="buildingMoveBtn0" data-slot="0"></button>
          <button class="building-move-btn" id="buildingMoveBtn1" data-slot="1"></button>
          <button class="building-move-btn" id="buildingMoveBtn2" data-slot="2"></button>
          <button class="building-move-btn" id="buildingMoveBtn3" data-slot="3"></button>
        </div>

        <div class="report-grid">
          <div class="report-tile"><div class="metric-label">${t("building.stats.totalDmgLabel")}</div><div class="metric-value accent" id="buildingTotalDmgEl">0</div></div>
          <div class="report-tile"><div class="metric-label">${t("building.stats.elapsedLabel")}</div><div class="metric-value" id="buildingElapsedEl">${t("building.stats.elapsedValue", { sec: 0 })}</div></div>
          <div class="report-tile"><div class="metric-label">${t("building.stats.dpsLabel")}</div><div class="metric-value" id="buildingDpsEl">0</div></div>
        </div>

        <div class="battle-controls">
          <div class="custom-dropdown battle-speed-dropdown" id="buildingSpeedDropdown">
            <div class="selected-value" id="buildingSpeedSelectedValue">${t("building.speedNormal")}</div>
            <ul class="dropdown-list" id="buildingSpeedList"></ul>
          </div>
          <button class="btn-simulate" id="buildingStartBtn">${t("building.startBtnIdle")}</button>
          <button class="battle-restart-btn" id="buildingRestartBtn" disabled title="${t("building.restartTooltip")}">↻</button>
        </div>
      </div>
    </div>

    <div class="friend-picker-overlay" id="buildingSelectOverlay" style="display:none;">
      <div class="friend-picker-modal">
        <div class="friend-picker-header">
          <span>${t("building.selectModal.title")}</span>
          <button class="close-btn" id="buildingSelectClose">✕</button>
        </div>
        <div id="buildingSelectList"></div>
      </div>
    </div>
  `;

  buildingRenderMyDinoSection();

  buildingInitMetricsCard();
  buildingRefreshMetricsCard();
  buildingInitTileSettings();
  buildingInitCombatConfig();
  buildingInitModeTabs();
  buildingInitSpeedDropdown();
  buildingInitControls();
  buildingInitOwnedRuneGrid();
  buildingInitSelectModal();
  buildingInitMoveControls();
  buildingPositionSlots();
  buildingRenderWalls();
  buildingBuildDinoReserveBars();
  buildingResetDinoState();
  buildingUpdateDinoPosition();
  buildingUpdateMoveControls();
  buildingUpdateStartButtonState();
  buildingUpdateStatsDisplay();
  // 로그인 상태면 "내 공룡" 대신 실제 닉네임을 보여줌(js/ui/dino-display-ui.js, 다이노 배틀
  // 페이지가 먼저 확정한 방식과 통일 - 사용자 확정 "로그인 하면 닉네임 보이는거... 통일시켜")
  loadMyDisplayName().then(() => applyMyDisplayName(".building-dino-avatar-name"));
}

// 건물 슬롯 위치는 고정이라(대형이 바뀌는 다이노 배틀과 달리) 한 번만 계산해서 심으면 됨. 공룡
// 위치는 고정이 아니라 buildingTargetSlot을 따라 바뀌므로 buildingUpdateDinoPosition()이 따로 담당
function buildingPositionSlots() {
  [0, 1, 2, 3].forEach((i) => {
    const pct = buildingWorldToPercent(BUILDING_HEX_CENTERS[i]);
    const slot = document.getElementById(`buildingWallSlot${i}`);
    slot.style.left = pct.left;
    slot.style.top = pct.top;
    // 건물 4개끼리 깊이정렬 - 타일 위치가 고정이라 매 프레임 다시 잴 필요는 없지만, 정적으로
    // 손으로 미리 계산해두면(예전 방식) 배치가 바뀔 때 사람이 값을 다시 맞춰야 하는 유지보수
    // 리스크가 있어서 다이노 배틀과 같은 방식(카메라 실제 깊이 기반)으로 통일함 - 카메라에 가까운
    // 타일일수록 큰 값(위에 그려짐). 공룡(buildingUpdateDinoPosition)도 같은 공식을 쓰므로 실제로
    // 더 가까운 쪽이 그때그때 위에 그려짐(둘 중 하나가 항상 이긴다고 못 박아두지 않음)
    if (pct.visible) slot.style.zIndex = Math.round(10000 - pct.distance);

    const hitbox = document.getElementById(`buildingHexHitbox${i}`);
    hitbox.style.left = pct.left;
    hitbox.style.top = pct.top;
    // 히트박스를 이 타일의 실제 투영된 육각형 모양 그대로 clip-path로 잘라냄 - 예전엔 4칸 전부
    // 고정 38%×48%(스테이지 기준) 사각형을 그대로 썼는데, 타일마다 카메라 원근상 실제 화면
    // 크기가 다르고, 사각형(육각형의 축정렬 바운딩 박스)은 육각형 자체보다 넓어서 인접 타일과
    // 실제로 겹치지 않는데도 그 바운딩 박스끼리는 겹쳐 보이는 문제가 있었음(사용자 지적, 실측
    // 확인 - 단순히 바운딩 박스 크기만 타일별로 다르게 줘도 겹침이 크게 안 줄었음) - 6개
    // 꼭짓점을 각각 투영해서 그 타일 중심 기준으로 살짝(1.15배) 바깥으로 벌린 뒤(육각형 꼭짓점
    // 근처를 못 누르는 문제를 완화하려는 기존 설계 의도 "옆 타일과 살짝 겹치는 게 낫다"는 유지),
    // 그 점들로 만든 다각형만 클릭 가능하게 함 - 진짜 육각형 이웃끼리는 원근 투영 후에도 변을
    // 맞대고 있을 뿐 면적이 겹치지 않으므로(직선을 직선으로 보내는 투영이라 공유 변도 그대로
    // 공유됨) 이러면 침범이 사실상 사라짐
    if (buildingScene3d) {
      const margin = 1.15;
      const centerL = parseFloat(pct.left), centerT = parseFloat(pct.top);
      const corners = HEX_LOCAL_POINTS.map(([lx, ly]) => {
        const p = buildingScene3d.projectToScreen(BUILDING_HEX_CENTERS[i][0] + lx, BUILDING_HEX_CENTERS[i][1] + ly);
        return {
          l: centerL + (parseFloat(p.left) - centerL) * margin,
          t: centerT + (parseFloat(p.top) - centerT) * margin
        };
      });
      const minLeft = Math.min(...corners.map((c) => c.l)), maxLeft = Math.max(...corners.map((c) => c.l));
      const minTop = Math.min(...corners.map((c) => c.t)), maxTop = Math.max(...corners.map((c) => c.t));
      hitbox.style.width = `${maxLeft - minLeft}%`;
      hitbox.style.height = `${maxTop - minTop}%`;
      // clip-path의 %는 이 엘리먼트 자기 자신의 박스 기준이라, 꼭짓점을 방금 정한 박스 안
      // 상대좌표(0~100%)로 다시 환산해야 함
      const points = corners
        .map((c) => `${((c.l - minLeft) / (maxLeft - minLeft)) * 100}% ${((c.t - minTop) / (maxTop - minTop)) * 100}%`)
        .join(", ");
      hitbox.style.clipPath = `polygon(${points})`;
    }
  });
}

// 공룡 위치 - 타겟이 없으면(아직 이동 안 함) 중앙 타일을 기본 대기 자리로 씀(사용자 확정 - 중앙도
// 다른 3칸과 동등한 건설 가능 타일이라 buildingTargetSlot=0으로 이동하면 실제로 그 타일 공격도
// 가능함, 그냥 "아직 아무 데도 안 정했을 때"의 화면 표시 기본값이 중앙일 뿐). 건물 앞쪽(카메라
// 쪽, Y+)에 세움(사용자 확정 - "가로로 하지 말고 건물 앞쪽으로") - 3마리를 곡선 1줄로 나란히
// 세우면(building.css의 .building-dino-cluster) 클러스터 가로 폭이 건물 스프라이트 폭보다 넓어져서
// 양옆 2마리는 건물 뒤에 안 가려짐. 육각형 중심에서 정면(카메라와 가장 가까운) 변까지의 거리가
// 43.3(육각형 반높이)이라, 건물과 너무 붙지 않으면서 타일 밖으로 넘치지도 않게 그 근처(34)까지
// 당겨서 육각형 바깥 테두리를 따라가는 형태로 만듦(사용자 확정 - "육각형의 바깥 테두리를
// 따르면 되긴 해") - 가운데 1마리가 더 튀어나오는 곡선은 .building-dino-cluster 쪽에서 처리
const BUILDING_DINO_TILE_OFFSET_Y = 34;

function buildingUpdateDinoPosition() {
  const slotIdx = buildingTargetSlot === null ? 0 : buildingTargetSlot;
  const base = BUILDING_HEX_CENTERS[slotIdx];
  const center = [base[0], base[1] + BUILDING_DINO_TILE_OFFSET_Y];
  const pct = buildingWorldToPercent(center);
  const dinoSlot = document.getElementById("buildingDinoSlot");
  dinoSlot.style.left = pct.left;
  dinoSlot.style.top = pct.top;
  // 공룡도 건물과 같은 카메라 실제 깊이 기반 공식으로 z-index를 계산 - 예전엔 공룡을 항상 맨 위로
  // 고정했었는데(사용자 확정이었으나, 중앙 타일에 있을 땐 어차피 제일 가까워서 티가 안 났을 뿐),
  // 다른 타일로 이동해서 공룡이 카메라에서 더 먼데도 앞쪽 건물보다 계속 위에 그려지는 게
  // 부자연스럽다는 지적(사용자 - "카메라 시점을 기준으로 거리를 계산해서 누가누가 앞에 있고
  // 뒤에 있는지 해봐야겠는데")으로 정정 - 건물(.building-wall-slot)과 동일한 수식을 써서 실제로
  // 더 가까운 쪽이 그때그때 위에 그려짐
  if (pct.visible) dinoSlot.style.zIndex = Math.round(10000 - pct.distance);
  // 육각형 크기 기준 통일 크기(js/core/hex-scene3d.js) - 매머드의 힘/압축된 힘 룬 배율까지 반영
  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const sizeScale = hexSceneDinoRuneSizeScale(buildingDinoInputs(profile).selectedRunes);
  const diamPx = buildingScene3d
    ? buildingScene3d.projectDiameterPx(center[0], center[1], DINO_AVATAR_DIAMETER_WORLD * sizeScale)
    : 0;
  if (diamPx > 0) dinoSlot.style.setProperty("--avatar-diam-px", `${diamPx}px`);
}

function buildingInitMoveControls() {
  [0, 1, 2, 3].forEach((i) => {
    document.getElementById(`buildingMoveBtn${i}`).onclick = () => buildingMoveToSlot(i);
  });
}

function buildingMoveToSlot(slotIdx) {
  if (buildingMaxHp[slotIdx] === null || buildingHp[slotIdx] <= 0) return;
  buildingTargetSlot = slotIdx;
  buildingUpdateDinoPosition();
  buildingUpdateMoveControls();
  buildingUpdateStartButtonState();
}

// 이동 버튼 4개의 라벨/활성화 상태를 지금 건물 배치·체력·현재 타겟 기준으로 다시 그림
function buildingUpdateMoveControls() {
  [0, 1, 2, 3].forEach((i) => {
    const btn = document.getElementById(`buildingMoveBtn${i}`);
    if (!btn) return;
    const label = t(BUILDING_SLOT_LABEL_KEYS[i]);
    btn.classList.remove("active");
    if (buildingMaxHp[i] === null) {
      btn.textContent = t("building.moveBtn.empty", { label });
      btn.disabled = true;
    } else if (buildingHp[i] <= 0) {
      btn.textContent = t("building.moveBtn.destroyed", { label });
      btn.disabled = true;
    } else if (buildingTargetSlot === i) {
      btn.textContent = t("building.moveBtn.attacking", { label });
      btn.disabled = false;
      btn.classList.add("active");
    } else {
      btn.textContent = t("building.moveBtn.moveTo", { label });
      btn.disabled = false;
    }
  });
}

function buildingInitMetricsCard() {
  document.querySelectorAll("#buildingMetricsGrid .metric-tile").forEach((tile) => {
    tile.onclick = () => {
      const key = tile.dataset.metric;
      buildingActiveMetricKey = buildingActiveMetricKey === key ? null : key;
      document.querySelectorAll("#buildingMetricsGrid .metric-tile").forEach((tileEl) => {
        tileEl.classList.toggle("active", tileEl.dataset.metric === buildingActiveMetricKey);
      });
      buildingRenderMetricDetail();
    };
  });
}

// 값이 바뀌면 오도미터 롤링 애니메이션으로 갱신 - 타이탄과 공용(js/ui/stat-roll-ui.js의
// setMetricTileValue, "내 공룡" 요약바와 같은 연출). NaN/undefined/null이면(예: 프리셋 전환 중
// 스탯이 잠깐 비정상 조합이 되는 경우 등) 화면에 "NaN"/"null" 글자가 뜨는 대신 0으로 표시하는 것도
// 공용 함수 쪽에서 처리함(사용자 확정 - "null이 아니라 0으로 표시하든지 어떻게 해봐")

// NaN/undefined/null을 항상 0으로 - 표시용 숫자를 다루는 곳이라면 어디서든 이 함수를 거쳐서
// "NaN"/"null" 글자가 화면에 그대로 노출되는 일이 없게 함
function buildingSafeNum(v) {
  return Number.isFinite(v) ? v : 0;
}

function buildingRefreshMetricsCard() {
  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const inputs = buildingDinoInputs(profile);
  const tileCfg = loadBuildingTileSettings();
  // 프리셋 전환 등으로 순간적으로 입력값 조합이 비정상이어도(원인이 무엇이든) 관련 수치 카드가
  // 예외를 던져서 그 뒤에 이어지는 buildingResetDisplay/buildingResetQuickCalc 호출까지 막아버리는
  // 일이 없게 방어 - 실패하면 전부 0으로 표시
  try {
    buildingLastMetrics = computeBuildingCombatMetrics(inputs, tileCfg);
  } catch (e) {
    console.error("buildingRefreshMetricsCard 계산 실패:", e);
    buildingLastMetrics = null;
  }
  const m = buildingLastMetrics;
  const finalAvgDmg = m ? m.avgHitDamage + m.avgEarthquakeDamage : 0;
  setMetricTileValue("buildingMetricBasicDmg", m ? m.avgHitDamage : 0);
  setMetricTileValue("buildingMetricQuakeDmg", m ? m.avgEarthquakeDamage : 0);
  setMetricTileValue("buildingMetricAtkAmp", m ? m.atkAmpGain : 0);
  setMetricTileValue("buildingMetricFinalAvgDmg", finalAvgDmg);
  buildingRenderMetricDetail();
}

function buildingRenderMetricDetail() {
  const box = document.getElementById("buildingMetricDetail");
  if (!buildingActiveMetricKey || !buildingLastMetrics) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  const m = buildingLastMetrics;
  let title = "";
  let rows = [];

  // 크리티컬 대미지(치확/치피를 평균으로 안 섞고, 크리티컬이 "떴을 때" 그대로 들어가는 값) - 평타/
  // 지진 공용(사용자 확정 - 타이탄과 같은 패턴)
  const critDmgOf = (baseAmount) => baseAmount * (buildingSafeNum(m.cDmg) / 100);

  if (buildingActiveMetricKey === "basicDmg") {
    title = t("building.detail.basicDmgTitle");
    // 치명타 확률/피해 수치는 빼고, 증폭 후 공격력에 실제 크리티컬이 떴을 때의 대미지를 보여줌
    // (사용자 확정 - "치명타 확률, 피해 수치를 빼고 증폭 후 크리티컬 대미지 추가하기")
    rows = [
      { label: t("building.detail.originalAtkLabel"), value: Math.round(buildingSafeNum(m.preAmpAtk)).toLocaleString() },
      { label: t("building.detail.ampAtkLabel"), value: Math.round(buildingSafeNum(m.atk)).toLocaleString() },
      { label: t("building.detail.ampCritDmgLabel"), value: Math.round(critDmgOf(buildingSafeNum(m.atk))).toLocaleString() }
    ];
  } else if (buildingActiveMetricKey === "quakeDmg") {
    title = t("building.detail.quakeDmgTitle");
    // 사용자 확정 - "지진의 원래 대미지를 넣은 다음 그 밑에줄에 크리티컬 대미지를 추가" - 원래
    // 대미지는 치확/치피를 안 섞은 기본 스플래시 값(주기/발동 확률과 무관하게 "한 번 터졌을 때"
    // 들어가는 값), 그 아래 크리티컬 대미지는 그 발동이 확정 크리티컬이었을 때의 값
    if (m.earthquake) {
      const rawQuakeDmg = buildingSafeNum(m.atk) * (m.earthquake.burst_p / 100);
      rows = [{
        label: t("building.detail.quakeLabel", { count: m.earthquake.count, percent: m.earthquake.burst_p }),
        value: Math.round(rawQuakeDmg).toLocaleString(),
        subs: [t("building.detail.critDmgSub", { value: Math.round(critDmgOf(rawQuakeDmg)).toLocaleString() })]
      }];
    }
  } else if (buildingActiveMetricKey === "atkAmp") {
    title = t("building.detail.atkAmpTitle");
    rows = m.destroyerBreakdown.map((d) => ({
      label: t("building.detail.destroyerLabel", { name: ruleDisplayName(d.name), percent: buildingSafeNum(d.percent).toFixed(2) }),
      value: `+${Math.round(buildingSafeNum(m.preAmpAtk) * (buildingSafeNum(d.percent) / 100)).toLocaleString()}`
    }));
  } else if (buildingActiveMetricKey === "finalAvgDmg") {
    title = t("building.detail.finalAvgDmgTitle");
    rows = [
      { label: t("building.detail.basicDmgLabel"), value: Math.round(buildingSafeNum(m.avgHitDamage)).toLocaleString() },
      { label: t("building.detail.quakeDmgLabel"), value: Math.round(buildingSafeNum(m.avgEarthquakeDamage)).toLocaleString() }
    ];
  }

  if (rows.length === 0) {
    box.innerHTML = `<div class="metric-detail-title">${title}</div><div class="metric-detail-empty">${t("building.detail.emptyMsg")}</div>`;
  } else {
    box.innerHTML = `<div class="metric-detail-title">${title}</div>${rows
      .map((r) => `<div class="metric-detail-row"><div class="metric-detail-row-main"><span>${r.label}</span><span>${r.value}</span></div>${(r.subs || []).map((s) => `<div class="metric-detail-row-sub">${s}</div>`).join("")}</div>`)
      .join("")}`;
  }
  box.style.display = "block";
}

function buildingInitTileSettings() {
  const settings = loadBuildingTileSettings();

  const natureToggle = document.getElementById("buildingNatureToggle");
  natureToggle.checked = settings.natureAdjacent;
  natureToggle.onchange = () => {
    settings.natureAdjacent = natureToggle.checked;
    saveBuildingTileSettings(settings);
    buildingRefreshMetricsCard();
    buildingResetDisplay();
    buildingResetQuickCalc();
  };

  const labelFor = (v) => sharedOptionLabel(BUFF_TOWER_OPTIONS.find((o) => o.value === v).label);

  const atkList = document.getElementById("buildingAtkTowerList");
  const atkSelectedValue = document.getElementById("buildingAtkTowerSelectedValue");
  atkSelectedValue.textContent = labelFor(settings.atkTowerLevel);
  BUFF_TOWER_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      settings.atkTowerLevel = opt.value;
      atkSelectedValue.textContent = sharedOptionLabel(opt.label);
      atkList.style.display = "none";
      saveBuildingTileSettings(settings);
      buildingRefreshMetricsCard();
      buildingResetDisplay();
      buildingResetQuickCalc();
    };
    atkList.appendChild(li);
  });
  atkSelectedValue.onclick = () => toggleDropdownList(atkSelectedValue, atkList);

  const hpList = document.getElementById("buildingHpTowerList");
  const hpSelectedValue = document.getElementById("buildingHpTowerSelectedValue");
  hpSelectedValue.textContent = labelFor(settings.hpTowerLevel);
  BUFF_TOWER_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      settings.hpTowerLevel = opt.value;
      hpSelectedValue.textContent = sharedOptionLabel(opt.label);
      hpList.style.display = "none";
      saveBuildingTileSettings(settings);
      buildingRefreshMetricsCard();
      buildingResetDisplay();
      buildingResetQuickCalc();
    };
    hpList.appendChild(li);
  });
  hpSelectedValue.onclick = () => toggleDropdownList(hpSelectedValue, hpList);

  // 서버 레벨캡 - 4개 페이지(타이탄/공룡대전/허수아비/건물)가 공유하는 전역 설정이라 이 페이지만의
  // buildingTileSettings가 아니라 별도 localStorage 키(loadServerLevelCap/saveServerLevelCap,
  // my-dino-page.js)를 직접 읽고 씀
  const capLabelFor = (v) => sharedOptionLabel(SERVER_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label);
  const capList = document.getElementById("buildingServerLevelCapList");
  const capSelectedValue = document.getElementById("buildingServerLevelCapSelectedValue");
  capSelectedValue.textContent = capLabelFor(loadServerLevelCap());
  SERVER_LEVEL_CAP_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      saveServerLevelCap(opt.value);
      capSelectedValue.textContent = sharedOptionLabel(opt.label);
      capList.style.display = "none";
      // 레벨캡 40% 이하 별자리 차단 경고는 "내 공룡" 요약 카드에 표시되는데, 그 카드는 프로필
      // 자체를 편집할 때만 갱신됨(updateSummary) - 레벨캡 값만 바뀐 지금 시점엔 다시 그려주지
      // 않으면 경고가 즉시 안 나타남(실제 계산은 매번 buildingDinoInputs를 새로 불러 정확함)
      buildingRenderMyDinoSection();
      buildingRefreshMetricsCard();
      buildingResetDisplay();
      buildingResetQuickCalc();
    };
    capList.appendChild(li);
  });
  capSelectedValue.onclick = () => toggleDropdownList(capSelectedValue, capList);

  // 별자리 레벨캡 - 서버 레벨캡과 마찬가지로 전역 공유 설정(loadConstellationLevelCap/
  // saveConstellationLevelCap, my-dino-page.js)
  const constLabelFor = (v) => sharedOptionLabel(CONSTELLATION_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label);
  const constList = document.getElementById("buildingConstellationCapList");
  const constSelectedValue = document.getElementById("buildingConstellationCapSelectedValue");
  constSelectedValue.textContent = constLabelFor(loadConstellationLevelCap());
  CONSTELLATION_LEVEL_CAP_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      saveConstellationLevelCap(opt.value);
      constSelectedValue.textContent = sharedOptionLabel(opt.label);
      constList.style.display = "none";
      buildingRefreshMetricsCard();
      buildingResetDisplay();
      buildingResetQuickCalc();
    };
    constList.appendChild(li);
  });
  constSelectedValue.onclick = () => toggleDropdownList(constSelectedValue, constList);
}

// ===== 전투 설정 - 실제 공격 대상(직접 때리는 건물 + 그 뒤 건물)과 적 투석기 조건. 페이지 전용
// 설정이라(서버 레벨캡류와 달리) buildingCombatConfig 하나만 로드해서 클로저로 공유함 =====
function buildingInitCombatConfig() {
  const config = loadBuildingCombatConfig();

  // 버튼을 눌러야 건물 선택 모달(아이콘+체력 그리드, 육각형 타일 건설과 같은 모달)이 뜨는 방식
  // (사용자 확정 - "직접 공격할 건물 버튼을 눌러야 그리드가 나와야지" - 처음엔 그리드를 상시
  // 펼쳐놨는데 너무 길어서 모달로 되돌림)
  const targetSelectedValue = document.getElementById("buildingCombatTargetSelectedValue");
  targetSelectedValue.textContent = buildingTypeDisplayLabel(config.targetBuildingId);
  targetSelectedValue.onclick = () => {
    buildingOpenSelectModalGeneric(config.targetBuildingId, (id) => {
      config.targetBuildingId = id;
      saveBuildingCombatConfig(config);
      targetSelectedValue.textContent = buildingTypeDisplayLabel(id);
      // 직접 때리는 건물이 바뀌면 체력/방어 등이 통째로 바뀌어 빠른 계산 결과가 낡아지므로,
      // 뒤 건물(behindSelectedValue)과 같은 이유로 재계산 전까지 이전 결과를 지움
      buildingResetQuickCalc();
      buildingRenderOptimizeSummary();
    });
  };

  const behindSelectedValue = document.getElementById("buildingCombatBehindSelectedValue");
  behindSelectedValue.textContent = buildingTypeDisplayLabel(config.behindBuildingId);
  behindSelectedValue.onclick = () => {
    buildingOpenSelectModalGeneric(config.behindBuildingId, (id) => {
      config.behindBuildingId = id;
      saveBuildingCombatConfig(config);
      behindSelectedValue.textContent = buildingTypeDisplayLabel(id);
      // 뒤 건물 여부가 빠른 계산의 지진 스플래시 결과에 직접 영향을 주므로, 바뀌면 이전 결과를
      // 지워서 재계산 전까지 낡은 값이 남아있지 않게 함(다른 설정 드롭다운들과 같은 패턴)
      buildingResetQuickCalc();
      buildingRenderOptimizeSummary();
    });
  };

  const catapultList = document.getElementById("buildingCatapultLevelList");
  const catapultSelectedValue = document.getElementById("buildingCatapultLevelSelectedValue");
  const catapultOptFor = (v) => BUILDING_CATAPULT_LEVELS.find((o) => o.value === v);
  // 탄종 이미지가 어떤 대미지 레벨인지 한눈에 보이게 선택값/목록 둘 다에 아이콘을 넣음(사용자 확정
  // - "적 투석기 공격 레벨 설정하는거에 해당 투사체 이미지 넣어") - VIP 드롭다운(my-dino-page.js)과
  // 같은 "아이콘 + 텍스트" 커스텀 드롭다운 패턴
  const catapultOptionHtml = (opt) => `
    ${opt.img ? `<img class="building-catapult-ammo-icon" src="./assets/tribe/${opt.img}" alt="">` : ""}
    <span>${buildingCatapultLevelLabel(opt.value)}</span>
  `;
  catapultSelectedValue.innerHTML = catapultOptionHtml(catapultOptFor(config.catapultLevel));
  BUILDING_CATAPULT_LEVELS.forEach((opt) => {
    const li = document.createElement("li");
    li.className = "building-catapult-option";
    li.innerHTML = catapultOptionHtml(opt);
    li.onclick = () => {
      config.catapultLevel = opt.value;
      catapultSelectedValue.innerHTML = catapultOptionHtml(opt);
      catapultList.style.display = "none";
      saveBuildingCombatConfig(config);
      buildingResetQuickCalc();
      buildingRenderOptimizeSummary();
    };
    catapultList.appendChild(li);
  });
  catapultSelectedValue.onclick = () => toggleDropdownList(catapultSelectedValue, catapultList);

  const speedList = document.getElementById("buildingCatapultSpeedList");
  const speedSelectedValue = document.getElementById("buildingCatapultSpeedSelectedValue");
  speedSelectedValue.textContent = buildingCatapultSpeedLabel(config.catapultSpeedLevel);
  BUILDING_CATAPULT_SPEED_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = buildingCatapultSpeedLabel(opt.value);
    li.onclick = () => {
      config.catapultSpeedLevel = opt.value;
      speedSelectedValue.textContent = buildingCatapultSpeedLabel(opt.value);
      speedList.style.display = "none";
      saveBuildingCombatConfig(config);
      buildingResetQuickCalc();
      buildingRenderOptimizeSummary();
    };
    speedList.appendChild(li);
  });
  speedSelectedValue.onclick = () => toggleDropdownList(speedSelectedValue, speedList);

  const distanceInput = document.getElementById("buildingDistanceInput");
  distanceInput.value = config.distanceTiles;
  const commitDistance = () => {
    const v = Math.max(1, Number(distanceInput.value) || 1);
    distanceInput.value = v;
    config.distanceTiles = v;
    saveBuildingCombatConfig(config);
    buildingResetQuickCalc();
    buildingRenderOptimizeSummary();
  };
  distanceInput.onblur = commitDistance;
  distanceInput.onkeydown = (e) => { if (e.key === "Enter") distanceInput.blur(); };

  const continuousToggle = document.getElementById("buildingContinuousToggle");
  continuousToggle.checked = config.continuousBattle;
  continuousToggle.onchange = () => {
    config.continuousBattle = continuousToggle.checked;
    saveBuildingCombatConfig(config);
    buildingResetQuickCalc();
    buildingRenderOptimizeSummary();
  };

  buildingRenderOptimizeSummary();
}

// 조합 찾기 탭 상단에 지금 전투 설정 요약을 보여줌(타이탄의 titanOptimizeQuickSummary와 같은 패턴 -
// 사용자 확정 "타이탄과 마찬가지로... 설정을 보유 룬 레벨 입력 위쪽에 띄워놔"). 건물은 타이탄과
// 달리 조합 찾기가 연속 전투를 강제로 켜서 계산하지 않고 지금 설정(combatConfig.continuousBattle)
// 그대로 쓰므로(Stage D 확정 - "우리의 목적은 적의 건물을 최대한 빨리 깨는 것"), 별도의 "고정" 표기
// 없이 실제 설정값을 그대로 보여주면 됨
function buildingRenderOptimizeSummary() {
  const el = document.getElementById("buildingOptimizeQuickSummary");
  if (!el) return;
  const config = loadBuildingCombatConfig();
  const catapultLabel = buildingCatapultLevelLabel(config.catapultLevel);
  const speedLabel = buildingCatapultSpeedLabel(config.catapultSpeedLevel);

  el.innerHTML = `
    <div class="titan-quick-summary-grid">
      <div class="titan-quick-summary-col">
        <div class="titan-quick-summary-item"><span>${t("building.summary.targetBuildingLabel")}</span><b>${buildingTypeDisplayLabel(config.targetBuildingId)}</b></div>
        <div class="titan-quick-summary-item"><span>${t("building.summary.distanceLabel")}</span><b>${t("building.summary.distanceValue", { count: config.distanceTiles })}</b></div>
        <div class="titan-quick-summary-item"><span>${t("building.summary.catapultLevelLabel")}</span><b>${catapultLabel}</b></div>
      </div>
      <div class="titan-quick-summary-col">
        <div class="titan-quick-summary-item"><span>${t("building.summary.behindBuildingLabel")}</span><b>${buildingTypeDisplayLabel(config.behindBuildingId)}</b></div>
        <div class="titan-quick-summary-item"><span>${t("building.summary.continuousBattleLabel")}</span><b>${config.continuousBattle ? "ON" : "OFF"}</b></div>
        <div class="titan-quick-summary-item"><span>${t("building.summary.catapultSpeedLabel")}</span><b>${speedLabel}</b></div>
      </div>
    </div>
  `;
}

// ===== 건물 선택 모달 - 육각형 타일(4칸 전부) 클릭 -> "없음/건물 종류" 중 고름 =====
function buildingInitSelectModal() {
  document.querySelectorAll(".building-hex-tile").forEach((tile) => {
    tile.addEventListener("click", () => buildingOpenSelectModal(Number(tile.dataset.slot)));
    // 호버 시 실제 육각형 테두리를 강조색으로 - 사각형 히트박스를 칠하던 예전 방식을 대체함(사용자
    // 지적, css/building.css의 .building-hex-hitbox 주석 참고). buildingScene3d는 "시뮬레이션"
    // 탭을 한 번도 안 열었으면 아직 null일 수 있어 방어
    const slot = Number(tile.dataset.slot);
    tile.addEventListener("mouseenter", () => buildingScene3d && buildingScene3d.setTileTint(slot, "#e0473f", "--accent"));
    tile.addEventListener("mouseleave", () => buildingScene3d && buildingScene3d.setTileTint(slot, "#e0473f", "#e0473f"));
  });
  document.getElementById("buildingSelectClose").onclick = () => {
    document.getElementById("buildingSelectOverlay").style.display = "none";
  };
}

// 건물 선택 그리드(아이콘+이름+체력) 공용 렌더러 - 육각형 타일 클릭 모달(건설)과 전투 설정 탭의
// "직접 공격할 건물/뒤에 있는 건물" 인라인 선택(사용자 확정 - "공격할 건물의 드롭다운에는 해당
// 건물의 체력 표시하기... 그리드로 바꿔서 각 건물의 체력을 표시") 둘 다 이걸 씀. emptyLabel은
// 모달에서만 "없음(비우기)"로 다르게 쓰고 싶어서 인자로 뺌
function buildingRenderSelectGrid(container, currentId, onSelect, emptyLabel) {
  const emptyCell = `
    <div class="building-select-item${currentId === null ? " active" : ""}" data-id="">
      <div class="building-select-empty-icon">✕</div>
      <span>${emptyLabel || t("building.selectModal.emptyLabel")}</span>
    </div>
  `;
  const buildingCells = BUILDING_TYPES.map((b) => `
    <div class="building-select-item${b.locked ? " locked" : ""}${b.id === currentId ? " active" : ""}" data-id="${b.locked ? "" : b.id}">
      <img src="./assets/tribe/${b.img}" alt="${t(b.labelKey)}">
      <span>${t(b.labelKey)}</span>
      ${b.locked ? `<span class="building-select-lock">${t("building.selectModal.lockedTag")}</span>` : `<span class="building-select-hp">${b.hp.toLocaleString()}</span>`}
    </div>
  `).join("");

  container.innerHTML = `<div class="building-select-grid">${emptyCell}${buildingCells}</div>`;
  container.querySelectorAll(".building-select-item").forEach((item) => {
    if (item.classList.contains("locked")) return;
    item.onclick = () => {
      const id = item.dataset.id || null;
      container.querySelectorAll(".building-select-item").forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      onSelect(id);
    };
  });
}

// 건물 선택 모달을 여는 공용 함수 - 육각형 타일 건설(buildingOpenSelectModal)과 전투 설정 탭의
// "직접 공격할 건물/뒤에 있는 건물" 버튼(사용자 확정 - "직접 공격할 건물 버튼을 눌러야 그리드가
// 나와야지" - 처음엔 그리드를 상시 펼쳐놨었는데 너무 길어서 모달로 되돌림) 둘 다 이걸 씀
function buildingOpenSelectModalGeneric(currentId, onChoose, emptyLabel) {
  const list = document.getElementById("buildingSelectList");
  buildingRenderSelectGrid(list, currentId, (id) => {
    onChoose(id);
    document.getElementById("buildingSelectOverlay").style.display = "none";
  }, emptyLabel);
  document.getElementById("buildingSelectOverlay").style.display = "flex";
}

function buildingOpenSelectModal(slotIdx) {
  const slots = loadBuildingSlots();
  const current = slots[slotIdx];
  buildingOpenSelectModalGeneric(current, (id) => {
    const updated = loadBuildingSlots();
    updated[slotIdx] = id;
    saveBuildingSlots(updated);
    buildingRenderWalls();
    buildingResetDisplay();
  }, t("building.selectModal.emptyLabelClear"));
}

// 건물 타입별 크기 배율(사용자 확정 - 원본 이미지 크기 기준 1.3배가 기본값, 투석기(catapult_*)는
// 1.5배로 더 크게, 벽(lv1~4)과 부족 게시판(notice_board)은 원본 크기 그대로)
function buildingSizeScaleFor(id) {
  if (id === "notice_board" || ["lv1", "lv2", "lv3", "lv4"].includes(id)) return 1;
  if (id.startsWith("catapult_")) return 1.5;
  return 1.3;
}

// 저장된 buildingSlots에 맞춰 이미지/체력바를 다시 그림(체력은 항상 만피로) - 건물 선택 직후,
// 그리고 buildingResetDisplay(다시 시작/설정 변경)에서도 호출됨
function buildingRenderWalls() {
  const slots = loadBuildingSlots();
  slots.forEach((type, i) => {
    const sprite = document.getElementById(`buildingSprite${i}`);
    const frame = document.getElementById(`buildingSpriteFrame${i}`);
    const hpBarEl = frame.querySelector(".building-hpbar");
    const hpTextEl = document.getElementById(`buildingHpText${i}`);
    const def = BUILDING_TYPES.find((b) => b.id === type);

    if (!def) {
      sprite.style.display = "none";
      hpBarEl.style.display = "none";
      hpTextEl.style.display = "none";
      buildingMaxHp[i] = null;
      buildingHp[i] = null;
      return;
    }

    sprite.src = `./assets/tribe/${def.img}`;
    sprite.alt = t(def.labelKey);
    sprite.style.display = "";
    // 이 이미지에서 육각형 중심에 와야 하는 정확한 지점(사용자가 직접 측정해서 준 좌표) - 예전엔
    // 발밑 정렬 기준으로 알파채널 여백/그림자/원근감을 어림짐작으로 보정했는데 이제 그럴 필요 없음
    frame.style.setProperty("--anchor-x", `${def.anchorX}%`);
    frame.style.setProperty("--anchor-y", `${def.anchorY}%`);
    sprite.style.setProperty("--size-scale", String(buildingSizeScaleFor(def.id)));
    sprite.classList.remove("building-destroyed", "building-shaking");
    hpBarEl.style.display = "";
    hpTextEl.style.display = "";
    buildingMaxHp[i] = def.hp;
    buildingHp[i] = def.hp;
    setHpFillWidth(document.getElementById(`buildingHpFill${i}`), buildingHp[i], buildingMaxHp[i]);
    hpTextEl.textContent = `${def.hp.toLocaleString()} / ${def.hp.toLocaleString()}`;
  });
}

function buildingUpdateStartButtonState() {
  const btn = document.getElementById("buildingStartBtn");
  const hasTarget = buildingFrontTargetIndex() !== -1;
  btn.disabled = !hasTarget && !buildingRunning;
  btn.title = hasTarget ? "" : t("building.moveBtnDisabledTooltip");
}

// 타이탄과 같은 4탭 구조(사용자 확정 - "타이탄처럼 해달라고"): 전투 설정/빠른 계산/시뮬레이션/
// 조합 찾기. 탭 밑줄 위치는 titan-page.js의 TITAN_MODES/titanInitModeTabs와 동일하게
// data-active-idx로 표시(building.css의 .building-mode-tabs-4가 이 속성을 읽어서 %로 이동)
const BUILDING_MODES = [
  { mode: "settings", tabId: "buildingModeTabSettings", cardId: "buildingSettingsModeCard" },
  { mode: "quick", tabId: "buildingModeTabQuick", cardId: "buildingQuickModeCard" },
  { mode: "live", tabId: "buildingModeTabLive", cardId: "buildingLiveModeCard" },
  { mode: "optimize", tabId: "buildingModeTabOptimize", cardId: "buildingOptimizeModeCard" }
];

function buildingInitModeTabs() {
  const tabsEl = document.getElementById("buildingModeTabs");

  BUILDING_MODES.forEach((m, idx) => {
    document.getElementById(m.tabId).onclick = () => {
      tabsEl.dataset.activeIdx = String(idx);
      BUILDING_MODES.forEach((other) => {
        document.getElementById(other.tabId).classList.toggle("active", other.mode === m.mode);
        document.getElementById(other.cardId).style.display = other.mode === m.mode ? "block" : "none";
      });
      // 시뮬레이션 탭이 재생 중일 때 다른 탭으로 넘어가면 화면엔 안 보이는 채로 계속 재생되고
      // 있었음(다음 틱 팝업이 안 보이는 곳에서 계속 쌓이는 등, 타이탄과 같은 문제) - 탭을 벗어나면
      // 자동으로 멈춤
      if (m.mode !== "live" && buildingRunning) buildingResetDisplay();
      if (m.mode === "optimize") buildingRenderOptimizeSummary();
      // "live" 탭은 기본 display:none으로 시작해서(기본 활성 탭은 "설정") 페이지 로드 시점엔
      // 캔버스가 0x0임(타이탄과 같은 이유, 실측 확인) - 이 탭을 처음 열 때 Three.js 씬을
      // 마운트/리사이즈함
      if (m.mode === "live") buildingInitScene3d();
    };
  });

  document.getElementById("buildingQcBtn").onclick = buildingRunQuickCalc;
  document.getElementById("buildingOptimizeBtn").onclick = buildingRunOptimizer;
}

// 초 단위 시간을 "N분 M초"(또는 60초 미만이면 "N초")로 표시 - 건물 HP가 커서 몇 분~몇십 분씩
// 걸리는 경우가 흔해 그냥 초로만 보여주면 읽기 어려움
function buildingFormatTime(sec) {
  const s = Math.round(sec);
  if (s < 60) return t("building.time.secondsOnly", { s });
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? t("building.time.minutesSeconds", { m, s: r }) : t("building.time.minutesOnly", { m });
}

// 확률 요소(희생/마지막 선물)가 있으면 death-trigger 분기까지 안정적으로 평균 내야 해서 회차를
// 늘리고, 없으면(가장 흔한 경우 - 크리티컬 변동만 있음) 적은 회차로도 충분함
function buildingPickIterations(selectedRunes) {
  const hasStochasticRune = (selectedRunes || []).some((r) => r && (r.name === "희생" || r.name === "마지막 선물"));
  return hasStochasticRune ? 200 : 30;
}

async function buildingRunQuickCalc() {
  const combatConfig = loadBuildingCombatConfig();
  const guideEl = document.getElementById("buildingQcGuide");
  const resultEl = document.getElementById("buildingQcResult");

  if (!combatConfig.targetBuildingId) {
    guideEl.style.display = "block";
    resultEl.style.display = "none";
    return;
  }
  guideEl.style.display = "none";

  const btn = document.getElementById("buildingQcBtn");
  btn.disabled = true;
  btn.classList.add("btn-progress");
  btn.style.setProperty("--progress", "0");

  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const inputs = buildingDinoInputs(profile);
  const tileCfg = loadBuildingTileSettings();
  const targetDef = BUILDING_TYPES.find((b) => b.id === combatConfig.targetBuildingId);
  const behindDef = combatConfig.behindBuildingId ? BUILDING_TYPES.find((b) => b.id === combatConfig.behindBuildingId) : null;

  const result = await runBuildingSimulation({
    baseAtk: inputs.baseAtk, baseHp: inputs.baseHp, selectedRunes: inputs.selectedRunes,
    constellation: inputs.constellation, bonusPercent: inputs.bonusPercent, currentHpPercent: inputs.currentHpPercent, moveSpeed: inputs.moveSpeed,
    distanceTiles: combatConfig.distanceTiles, continuousBattle: combatConfig.continuousBattle,
    tileCfg, maxDino: BUILDING_MAX_DINO_COUNT,
    targetHp: targetDef.hp, behindHp: behindDef ? behindDef.hp : null,
    catapultDmg: combatConfig.catapultLevel ? BUILDING_CATAPULT_DAMAGE[combatConfig.catapultLevel] : null,
    catapultPeriodSec: BUILDING_CATAPULT_SPEED_SECONDS[combatConfig.catapultSpeedLevel],
    iterations: buildingPickIterations(inputs.selectedRunes),
    onProgress: (c, total) => {
      btn.textContent = t("building.quick.calcBtnBusy", { current: c, total });
      btn.style.setProperty("--progress", String((c / total) * 100));
    }
  });

  buildingRenderQuickCalcReport(result, behindDef);

  btn.disabled = false;
  btn.textContent = t("building.quick.calcBtn");
  btn.classList.remove("btn-progress");
  btn.style.removeProperty("--progress");
}

function buildingRenderQuickCalcReport(result, behindDef) {
  document.getElementById("buildingQcTotalDmg").innerText = Math.round(result.avgTotalDmg).toLocaleString();
  document.getElementById("buildingQcQuakeDmg").innerText = Math.round(result.avgEarthquakeDmg).toLocaleString();
  document.getElementById("buildingQcFrontTime").innerText =
    result.frontBreakRate > 0 ? buildingFormatTime(result.avgFrontBreakTimeSec) : "-";

  const behindTile = document.getElementById("buildingQcBehindTile");
  if (behindDef) {
    const label = document.getElementById("buildingQcBehindLabel");
    const value = document.getElementById("buildingQcBehindValue");
    // 뒤 건물도 결국 부서진 iteration이 절반 이상이면 "걸린 시간"이 더 유용한 정보이고, 대부분
    // 안 부서졌으면 "남은 체력"이 더 유용함(사용자 확정 - "부숴졌다면 체력 0일테니... 걸린 시간도 표시")
    if (result.behindBreakRate >= 0.5) {
      label.innerText = t("building.quick.behindBreakTimeLabel");
      value.innerText = buildingFormatTime(result.avgBehindBreakTimeSec);
    } else {
      label.innerText = t("building.quick.behindRemainingHpLabel2");
      value.innerText = `${Math.round(result.avgBehindRemainingHp).toLocaleString()} / ${behindDef.hp.toLocaleString()}`;
    }
    behindTile.style.display = "";
  } else {
    behindTile.style.display = "none";
  }

  document.getElementById("buildingQcDeadCount").innerText = t("building.quick.deadCountValue", { count: result.avgDeadCount.toFixed(1) });
  document.getElementById("buildingQcDeathTime").innerText =
    result.avgDeathTimeSec !== null ? buildingFormatTime(result.avgDeathTimeSec) : "-";

  document.getElementById("buildingQcResult").style.display = "grid";

  const chartSection = document.getElementById("buildingQcChartSection");
  if (result.chartData.length >= 2) {
    document.getElementById("buildingAvgHpPer").innerText = t("building.quick.avgSurvivalHpLabel", { percent: result.avgSurvivalPercent.toFixed(1) });
    chartSection.style.display = "";
    drawHpChart(document.getElementById("buildingHpChart"), result.chartData, result.limitSec);
  } else {
    chartSection.style.display = "none";
  }
}

function buildingResetQuickCalc() {
  document.getElementById("buildingQcResult").style.display = "none";
  const guideEl = document.getElementById("buildingQcGuide");
  if (guideEl) guideEl.style.display = "none";
  const chartSection = document.getElementById("buildingQcChartSection");
  if (chartSection) chartSection.style.display = "none";
  const optimizeResult = document.getElementById("buildingOptimizeResult");
  if (optimizeResult) optimizeResult.innerHTML = "";
}

// ===== 최적 조합 찾기 - 허수아비와 완전히 같은 방식(적합 룬 중 보유분으로 5개 조합 전수 탐색) =====

function buildingInitOwnedRuneGrid() {
  const levels = loadBuildingOwnedLevels();
  const grid = document.getElementById("buildingOwnedRuneGrid");
  grid.innerHTML = buildingSuitableRuneNames().map((name) => `
    <div class="dummy-owned-rune-row">
      <span class="dummy-owned-rune-name">${ruleDisplayName(name)}</span>
      <input type="tel" inputmode="numeric" class="dummy-owned-rune-level" data-rune="${name}" value="${levels[name] || ""}" placeholder="0">
    </div>
  `).join("");

  grid.querySelectorAll(".dummy-owned-rune-level").forEach((input) => {
    input.oninput = () => {
      input.value = input.value.replace(/[^0-9]/g, "");
    };
    input.onblur = () => {
      const name = input.dataset.rune;
      let v = Math.max(0, Math.min(31, Number(input.value) || 0));
      input.value = v || "";
      const current = loadBuildingOwnedLevels();
      current[name] = v;
      saveBuildingOwnedLevels(current);
      document.getElementById("buildingOptimizeResult").innerHTML = "";
    };
    input.onkeydown = (e) => { if (e.key === "Enter") input.blur(); };
  });
}

function buildingCombinations(arr, k) {
  const results = [];
  function pick(start, combo) {
    if (combo.length === k) { results.push(combo.slice()); return; }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      pick(i + 1, combo);
      combo.pop();
    }
  }
  pick(0, []);
  return results;
}

// 조합 하나의 최종 결과를 한 줄로 요약 - 부순 조합은 걸린 시간, 못 부순 조합은 총 대미지(사용자
// 확정 - "우리의 목적은 적의 건물을 최대한 빨리 깨는 것" 하나뿐이라 두 표시 모두 결국 "그 조합이
// 목표에 얼마나 가까웠는지"를 같은 잣대로 보여줌)
function buildingOptimizeResultLabel(r) {
  return r.frontBreakRate > 0
    ? t("building.optimize.brokeInTime", { time: buildingFormatTime(r.avgFrontBreakTimeSec) })
    : t("building.optimize.notBroken", { dmg: Math.round(r.avgTotalDmg).toLocaleString() });
}

// 조합 두 개를 "적 건물을 더 빨리 부순 쪽이 우선"이라는 단일 목표로 비교(사용자 확정 - Stage D
// 계획 참고). 둘 다 부쉈으면 걸린 시간이 짧은 쪽, 하나만 부쉈으면 그쪽이 항상 우선, 둘 다 못
// 부쉈으면 총 대미지가 높은 쪽 - 방어/생존을 별도 축으로 인위적으로 끼워 넣지 않음
function buildingCompareOptimizeResults(a, b) {
  const aBroke = a.frontBreakRate > 0;
  const bBroke = b.frontBreakRate > 0;
  if (aBroke && bBroke) return a.avgFrontBreakTimeSec - b.avgFrontBreakTimeSec;
  if (aBroke !== bBroke) return aBroke ? -1 : 1;
  return b.avgTotalDmg - a.avgTotalDmg;
}

const BUILDING_OPTIMIZER_CANDIDATE_COUNT = 25; // 1단계 스크리닝에서 2단계로 넘길 후보 상한(각 리스트당)

async function buildingRunOptimizer() {
  const levels = loadBuildingOwnedLevels();
  const owned = buildingSuitableRuneNames().filter((name) => levels[name] > 0);
  const resultEl = document.getElementById("buildingOptimizeResult");
  const btn = document.getElementById("buildingOptimizeBtn");

  if (owned.length === 0) {
    resultEl.innerHTML = `<p class="quickcalc-desc">${t("building.optimize.needLevelsMsg")}</p>`;
    return;
  }

  const combatConfig = loadBuildingCombatConfig();
  if (!combatConfig.targetBuildingId) {
    resultEl.innerHTML = `<p class="quickcalc-desc">${t("building.optimize.needTargetMsg")}</p>`;
    return;
  }

  const slotCount = Math.min(5, owned.length);
  const combos = buildingCombinations(owned, slotCount);
  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const inputs = buildingDinoInputs(profile);
  const tileCfg = loadBuildingTileSettings();
  const targetDef = BUILDING_TYPES.find((b) => b.id === combatConfig.targetBuildingId);
  const behindDef = combatConfig.behindBuildingId ? BUILDING_TYPES.find((b) => b.id === combatConfig.behindBuildingId) : null;
  const catapultDmg = combatConfig.catapultLevel ? BUILDING_CATAPULT_DAMAGE[combatConfig.catapultLevel] : null;
  const catapultPeriodSec = BUILDING_CATAPULT_SPEED_SECONDS[combatConfig.catapultSpeedLevel];

  btn.disabled = true;
  btn.classList.add("btn-progress");
  btn.style.setProperty("--progress", "0");
  resultEl.innerHTML = "";

  // 1단계: 전수(RNG 없음) - dps 상위 + (캐터펄트가 있을 때만) 결정론적 "첫 사망까지 걸리는 시간"이
  // 짧은 축도 후보에 포함시켜서, 저체력/고위험 조합이 후보 풀에서 아예 누락되지 않게 함(사용자
  // 확정 Stage D 계획 참고 - 이 리스트 자체로 순위를 매기지는 않고 후보 포함용으로만 씀)
  const BUILDING_STAGE1_CHUNK = 2000;
  const screened = [];
  for (let i = 0; i < combos.length; i += BUILDING_STAGE1_CHUNK) {
    const end = Math.min(i + BUILDING_STAGE1_CHUNK, combos.length);
    for (let j = i; j < end; j++) {
      const names = combos[j];
      const selectedRunes = names.map((name) => ({ name, lv: levels[name] }));
      const values = computeBuildingCombatValues({ ...inputs, selectedRunes }, tileCfg);
      const dps = computeBuildingExpectedDps(values) + computeEarthquakeExpectedSplashDps(values);

      let timeToFirstDeath = Infinity;
      if (catapultDmg !== null) {
        const reduction = computeBuildingIncomingReduction(selectedRunes);
        const perShotDmg = Math.max(1, catapultDmg * (1 - reduction.percent / 100) - reduction.flat);
        const maxHp = computeBuildingDinoMaxHp({ ...inputs, selectedRunes, count: BUILDING_MAX_DINO_COUNT }, tileCfg);
        timeToFirstDeath = Math.ceil(maxHp / perShotDmg) * catapultPeriodSec;
      }
      screened.push({ names, selectedRunes, dps, timeToFirstDeath });
    }
    if (end < combos.length) {
      btn.textContent = t("building.optimize.stage1Progress", { current: end.toLocaleString(), total: combos.length.toLocaleString() });
      btn.style.setProperty("--progress", String((end / combos.length) * 15));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const byDps = [...screened].sort((a, b) => b.dps - a.dps).slice(0, BUILDING_OPTIMIZER_CANDIDATE_COUNT);
  const candidateMap = new Map();
  byDps.forEach((c) => candidateMap.set(c.names.join("|"), c));
  if (catapultDmg !== null) {
    const bySafety = [...screened].sort((a, b) => b.timeToFirstDeath - a.timeToFirstDeath).slice(0, BUILDING_OPTIMIZER_CANDIDATE_COUNT);
    bySafety.forEach((c) => candidateMap.set(c.names.join("|"), c));
  }
  const candidates = [...candidateMap.values()];

  // 2단계: 후보만 실제 시뮬레이션(runBuildingSimulation) - 진짜 순위는 여기서 결정됨(사용자 확정 -
  // "우리의 목적은 적의 건물을 최대한 빨리 깨는 것")
  const refined = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const result = await runBuildingSimulation({
      baseAtk: inputs.baseAtk, baseHp: inputs.baseHp, selectedRunes: c.selectedRunes,
      constellation: inputs.constellation, bonusPercent: inputs.bonusPercent, currentHpPercent: inputs.currentHpPercent, moveSpeed: inputs.moveSpeed,
      distanceTiles: combatConfig.distanceTiles, continuousBattle: combatConfig.continuousBattle,
      tileCfg, maxDino: BUILDING_MAX_DINO_COUNT,
      targetHp: targetDef.hp, behindHp: behindDef ? behindDef.hp : null,
      catapultDmg, catapultPeriodSec,
      iterations: buildingPickIterations(c.selectedRunes), batchSize: 10
    });
    refined.push({
      names: c.names, avgFrontBreakTimeSec: result.avgFrontBreakTimeSec, frontBreakRate: result.frontBreakRate,
      avgTotalDmg: result.avgTotalDmg, avgDeadCount: result.avgDeadCount
    });
    btn.textContent = t("building.optimize.stage2Progress", { current: i + 1, total: candidates.length });
    btn.style.setProperty("--progress", String(15 + ((i + 1) / candidates.length) * 85));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  refined.sort(buildingCompareOptimizeResults);
  const top = refined.slice(0, 3);
  const bestLine = top[0].names.map((n) => `${ruleDisplayName(n)} Lv.${levels[n]}`).join(" · ");

  resultEl.innerHTML = `
    ${slotCount < 5 ? `<p class="quickcalc-desc">${t("building.optimize.limitedSlotMsg", { count: owned.length, slotCount })}</p>` : ""}
    <div class="report-grid">
      <div class="report-tile dummy-optimize-best-tile">
        <div class="metric-label">${t("building.optimize.bestComboLabel")}</div>
        <div class="dummy-optimize-best-combo">${bestLine}</div>
      </div>
      <div class="report-tile"><div class="metric-label">${t("building.optimize.resultLabel")}</div><div class="metric-value accent">${buildingOptimizeResultLabel(top[0])}</div></div>
    </div>
    ${top.length > 1 ? `
      <div class="dummy-optimize-runner-ups">
        ${top.slice(1).map((r, i) => `<div class="dummy-optimize-runner-up">${i + 2}위 · ${r.names.map(ruleDisplayName).join(", ")} (${buildingOptimizeResultLabel(r)})</div>`).join("")}
      </div>
    ` : ""}
  `;

  btn.disabled = false;
  btn.textContent = t("building.optimize.startBtn");
  btn.classList.remove("btn-progress");
  btn.style.removeProperty("--progress");
}

function buildingInitSpeedDropdown() {
  const currentMs = buildingGetSpeedMs();
  const list = document.getElementById("buildingSpeedList");
  const selectedValue = document.getElementById("buildingSpeedSelectedValue");
  selectedValue.textContent = sharedOptionLabel(BATTLE_SPEED_OPTIONS.find((o) => o.ms === currentMs).label);

  BATTLE_SPEED_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      localStorage.setItem(BUILDING_SPEED_KEY, String(opt.ms));
      selectedValue.textContent = sharedOptionLabel(opt.label);
      list.style.display = "none";
      if (buildingRunning) {
        clearInterval(buildingAttackTimer);
        buildingAttackTimer = setInterval(buildingRunAttackTick, buildingGetSpeedMs());
      }
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
}

function buildingInitControls() {
  document.getElementById("buildingStartBtn").onclick = buildingOnStartButtonClick;
  document.getElementById("buildingRestartBtn").onclick = () => { buildingResetDisplay(); };
}

function buildingOnStartButtonClick() {
  if (buildingRunning) {
    buildingPauseAttack();
  } else {
    buildingStartAttack();
  }
}

function buildingStartAttack() {
  if (buildingFrontTargetIndex() === -1) return;
  buildingRunning = true;
  document.getElementById("buildingStartBtn").textContent = t("building.startBtnRunning");
  document.getElementById("buildingRestartBtn").disabled = false;

  // "전투 설정" 탭을 건드리면(카테펄트 레벨 등) 지금 켜져있는 "시뮬레이션" 탭을 자동으로
  // 멈추게 돼있어서(buildingInitModeTabs 참고) 재생 도중엔 이 값들이 바뀔 수 없음 - 그러니 매
  // 틱 다시 읽을 필요 없이 여기서 한 번만 캐싱(사용자 지적 - 사이트 전체 점검, 매 틱 localStorage
  // 재읽기 낭비)
  buildingCachedCombatConfig = loadBuildingCombatConfig();
  buildingCachedInputs = buildingDinoInputs(loadMyDinoProfile(MY_DINO_PROFILE_KEY));
  buildingCachedTileCfg = loadBuildingTileSettings();

  buildingAttackTimer = setInterval(buildingRunAttackTick, buildingGetSpeedMs());
}

function buildingPauseAttack() {
  buildingRunning = false;
  clearInterval(buildingAttackTimer);
  buildingClearPendingCatapultTimers();
  document.getElementById("buildingStartBtn").textContent = t("building.startBtnPaused");
}

function buildingResetDisplay() {
  buildingRunning = false;
  clearInterval(buildingAttackTimer);
  buildingClearPendingCatapultTimers();
  buildingElapsedSec = 0;
  buildingTotalDmg = 0;
  buildingAttackCount = 0;
  document.getElementById("buildingStartBtn").textContent = t("building.startBtnIdle");
  document.getElementById("buildingRestartBtn").disabled = true;
  document.querySelectorAll(".building-hit-effect-fixed, .building-dmg-popup-fixed, .building-projectile-fixed").forEach((el) => el.remove());
  document.querySelectorAll(".building-sprite").forEach((el) => el.classList.remove("building-shaking"));
  buildingResetDinoState();
  buildingRenderWalls();
  buildingUpdateDinoPosition();
  buildingUpdateMoveControls();
  buildingUpdateStartButtonState();
  buildingUpdateStatsDisplay();
}

// 공룡 개별 체력 초기화 - 리셋/다시 시작 때마다 전원 만피로. 최대 체력은 항상 7마리 풀 스쿼드
// 기준으로 계산해서 고정으로 씀(통계 시뮬레이션의 seedMaxHp와 같은 단순화 - 전투 중 실시간으로
// 몇 마리가 죽었는지에 따라 협동 공격 등 인원수 조건부 룬 보너스가 오르내리는 것까지 라이브
// 화면에서 매 틱 재계산하면 복잡도가 크게 늘어나서 통계 시뮬레이션에만 그 정밀도를 남겨둠)
function buildingResetDinoState() {
  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const inputs = buildingDinoInputs(profile);
  const tileCfg = loadBuildingTileSettings();
  buildingDinoMaxHp = computeBuildingDinoMaxHp({ ...inputs, count: BUILDING_MAX_DINO_COUNT }, tileCfg);
  buildingDinoHp = Array(BUILDING_MAX_DINO_COUNT).fill(buildingDinoMaxHp);
  buildingDinoReviveAt = Array(BUILDING_MAX_DINO_COUNT).fill(null);
  buildingNextCatapultFireSec = 1;
  document.querySelectorAll(".building-dino-avatar").forEach((el) => el.classList.remove("building-dino-dead"));
  buildingRenderDinoHpBars();
}

// 표시 중인 3마리(0~2) + 대기 중인 나머지(3~6) 체력바를 전부 지금 buildingDinoHp 기준으로 갱신
function buildingRenderDinoHpBars() {
  // 체력 퍼센트 계산/적용은 js/ui/dino-display-ui.js의 setHpFillWidth로 통일(사용자 확정 -
  // "체력바 로직이랑... 전부 통일시켜... 하나 함수로 만들든가")
  [0, 1, 2].forEach((i) => {
    setHpFillWidth(document.getElementById(`buildingDinoHpFill${i}`), buildingDinoHp[i], buildingDinoMaxHp);
    const avatar = document.getElementById(`buildingDinoAvatar${i}`);
    if (avatar) avatar.classList.toggle("building-dino-dead", buildingDinoHp[i] <= 0);
  });
  document.querySelectorAll("#buildingDinoReserveHpBars .building-dino-reserve-hpbar").forEach((bar) => {
    const i = Number(bar.dataset.dinoIdx);
    setHpFillWidth(bar.querySelector(".building-dino-reserve-hpfill"), buildingDinoHp[i], buildingDinoMaxHp);
  });
}

// 대기 공룡 체력바 DOM은 한 번만 만들어두고 매 틱 폭만 갱신함(타이탄의 titanBuildHpBars와 같은
// 이유 - 매 틱 innerHTML을 통째로 다시 그리면 나중에 그 위에 얹을 피격 이펙트가 애니메이션 끝나기
// 전에 지워짐)
function buildingBuildDinoReserveBars() {
  const wrap = document.getElementById("buildingDinoReserveHpBars");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (let i = 3; i < BUILDING_MAX_DINO_COUNT; i++) {
    const bar = document.createElement("div");
    bar.className = "building-dino-reserve-hpbar";
    bar.dataset.dinoIdx = String(i);
    bar.innerHTML = `<div class="building-dino-reserve-hpfill"></div>`;
    wrap.appendChild(bar);
  }
}

// 부활 대기시간(getRespawnDelaySec, 타이탄과 같은 공식)이 지난 공룡을 만피로 되돌림 - 매 틱 시작
// 시점에 판정(이번 틱에서 새로 죽는 공룡의 부활 타이머는 이번 틱 끝에 걸리므로 여기서 같이 안 깨어남)
function buildingApplyDinoRevives() {
  for (let i = 0; i < BUILDING_MAX_DINO_COUNT; i++) {
    if (buildingDinoReviveAt[i] !== null && buildingElapsedSec >= buildingDinoReviveAt[i]) {
      buildingDinoHp[i] = buildingDinoMaxHp;
      buildingDinoReviveAt[i] = null;
    }
  }
}

// 적 캐터펄트 반격 - 통계 시뮬레이션(runBuildingSimulation)과 같은 규칙: 살아있는 공룡 전원
// 동시에 광역 피해(사용자 확정), 강인함1/2로 감소(퍼센트 먼저, 그다음 정수), 연속 전투면 부활
// 타이머를 검(getRespawnDelaySec). 발사(투사체 스폰)와 명중(대미지 적용)을 분리함(사용자 확정 -
// "투사체가 타일에 명중한 뒤에 대미지가 터지도록" - 빠른 계산/조합 찾기는 애초에 투사체 애니메이션
// 자체가 없는 통계 계산이라 해당 없음, 라이브 화면 전용) - 대미지 계산 자체(perShotDmg 등)는
// 발사 시점 설정 그대로 얼려서 클로저로 넘기고, 실제 반영만 비행 시간만큼 늦춤
function buildingApplyCatapultTick(combatConfig, inputs) {
  if (combatConfig.catapultLevel === null) return;
  if (buildingElapsedSec < buildingNextCatapultFireSec) return;
  const periodSec = BUILDING_CATAPULT_SPEED_SECONDS[combatConfig.catapultSpeedLevel];
  buildingNextCatapultFireSec += periodSec;

  buildingSpawnCatapultProjectile(combatConfig.catapultLevel);

  const reduction = computeBuildingIncomingReduction(inputs.selectedRunes);
  const rawDmg = BUILDING_CATAPULT_DAMAGE[combatConfig.catapultLevel];
  const perShotDmg = Math.max(1, rawDmg * (1 - reduction.percent / 100) - reduction.flat);

  const timer = setTimeout(() => {
    buildingPendingCatapultTimers = buildingPendingCatapultTimers.filter((t) => t !== timer);
    buildingApplyCatapultHit(combatConfig, inputs, perShotDmg);
  }, BUILDING_PROJECTILE_FLIGHT_MS);
  buildingPendingCatapultTimers.push(timer);
}

function buildingApplyCatapultHit(combatConfig, inputs, perShotDmg) {
  for (let i = 0; i < BUILDING_MAX_DINO_COUNT; i++) {
    if (buildingDinoHp[i] <= 0) continue;
    buildingDinoHp[i] = Math.max(0, buildingDinoHp[i] - perShotDmg);
    // 화면엔 최대 3마리(buildingDinoAvatar0~2)만 아바타로 보임(나머지는 체력바로만 표시) - 대미지
    // 팝업도 실제로 보이는 자리에만(사용자 지적 - "공룡이 적 투석기 공격에 피격당할 때 공룡 위로
    // 피격 대미지 표시를 해줘야 함", 다른 공격 경로(buildingRunAttackTick)와 같은 공용 함수 사용 -
    // buildingSpawnDamagePopupOn 참고). 발톱 모양(Hit_Effect.png) 피격 이펙트는 안 씀 - 투사체
    // (투석기)에 맞은 건데 발톱 이펙트가 뜨면 부자연스러움(사용자 지적) - 투사체 자체가 날아와서
    // 맞는 연출(buildingSpawnCatapultProjectile)이 이미 있으므로 별도 이펙트 없이 대미지 숫자만 표시
    if (i < 3) {
      buildingSpawnDinoDamagePopup(i, perShotDmg);
    }
    if (buildingDinoHp[i] === 0 && combatConfig.continuousBattle) {
      const respawnDelaySec = getRespawnDelaySec(inputs.moveSpeed, combatConfig.distanceTiles);
      buildingDinoReviveAt[i] = buildingElapsedSec + respawnDelaySec;
    }
  }
  buildingRenderDinoHpBars();
}

// 지금 공룡이 이동해서 서 있는 타일(buildingTargetSlot)만 공격 대상이 됨 - 예전엔 "가장 앞쪽
// 살아있는 건물"을 자동으로 스캔했지만, 공룡이 같은 타일에 직접 가야만 공격할 수 있다는 규칙상
// 자동 스캔은 더 이상 맞지 않음(사용자 확정). 타겟이 없거나, 있어도 건물이 없어졌거나 파괴됐으면 -1
function buildingFrontTargetIndex() {
  if (buildingTargetSlot === null) return -1;
  if (buildingHp[buildingTargetSlot] === null || buildingHp[buildingTargetSlot] <= 0) return -1;
  return buildingTargetSlot;
}

function buildingRunAttackTick() {
  const targetIdx = buildingFrontTargetIndex();
  if (targetIdx === -1) {
    buildingPauseAttack();
    buildingUpdateMoveControls();
    buildingUpdateStartButtonState();
    return;
  }

  const combatConfig = buildingCachedCombatConfig;
  const inputs = buildingCachedInputs;

  buildingApplyDinoRevives();
  const aliveDinoCount = buildingDinoHp.filter((hp) => hp > 0).length;
  const hasPendingRevive = buildingDinoReviveAt.some((t) => t !== null);
  // 연속 전투가 꺼져있고 공룡이 전멸했으면(빠른 계산과 같은 종료 조건) 여기서 멈춤 - 대기 부활이
  // 있으면(연속 전투 켜짐) 시간만 계속 흘려보내며 기다림
  if (aliveDinoCount === 0 && !hasPendingRevive) {
    buildingPauseAttack();
    buildingRenderDinoHpBars();
    buildingUpdateMoveControls();
    buildingUpdateStartButtonState();
    return;
  }

  buildingElapsedSec++;

  const tileCfg = buildingCachedTileCfg;

  // 살아있는 공룡이 하나도 없으면(연속 전투로 부활을 기다리는 중) 이번 틱은 공격 없이 시간만
  // 흘려보냄 - 공격력도 지금 실제로 살아있는 마릿수만큼만 반영(통계 시뮬레이션과 같은 방식으로
  // count를 매번 다시 계산 - 예전엔 항상 고정 7마리로 계산해서 죽어도 대미지가 안 줄었음)
  if (aliveDinoCount > 0) {
    // 최대체력도 공격력과 같은 이유로 마릿수 조건부 룬(협동 공격/고독한 분노) 임계값을 넘나들면
    // 바뀔 수 있음 - 예전엔 buildingResetDinoState()/부활 시점에만 계산해두고 전투 중엔 안
    // 바꿨는데(건물 페이지 특유의 의도된 단순화였음), 다른 3개 엔진(타이탄/다이노배틀/아레나)과
    // 통일하기 위해 여기서도 매 틱 재계산 - 바뀌었을 때만 비율 재조정(stat-calc.js의
    // rescaleHpArrayForMaxHpChange, 안 바뀌었으면 내부적으로 그냥 아무 일도 안 함)
    const newMaxHp = computeBuildingDinoMaxHp({ ...inputs, count: aliveDinoCount }, tileCfg);
    rescaleHpArrayForMaxHpChange(buildingDinoHp, newMaxHp, buildingDinoMaxHp);
    buildingDinoMaxHp = newMaxHp;

    buildingAttackCount++;
    const values = computeBuildingCombatValues({ ...inputs, count: aliveDinoCount }, tileCfg);
    const { dmg, isCrit } = rollBuildingAttack(values);

    buildingTotalDmg += dmg;
    buildingApplyDamage(targetIdx, dmg);
    buildingShake(targetIdx);
    buildingSpawnHitEffect(targetIdx);
    buildingSpawnDamagePopup(targetIdx, dmg, isCrit, false);

    // 지진: 공격 횟수가 룬 레벨의 주기(4타 또는 3타)에 도달하면, 지금 공격 중인 건물 자신 + 그
    // 건물과 실제로 육각형 변을 맞대고 있는 "주변 1칸" 건물들까지 전부 추가 피해(사용자 확정 -
    // "내가 공격하는 건물 및 그 주위 1칸씩 건물에 대미지"). 타겟 자신은 이미 위에서 평타를 맞았고,
    // 이건 그 위에 별도로 얹히는 지진 전용 추가 타격 - BUILDING_ADJACENCY 참고(정면은 좌/우 둘 다와
    // 인접이라 셋 다 맞고, 좌/우는 정면하고만 인접이라 자신+정면만 맞음). 지진은 낙뢰/메테오 같은
    // 스킬형 룬이라 주공격의 크리 여부를 물려받지 않고 맞는 건물마다 각각 독립적으로 크리를 새로
    // 판정함(사용자 확정 - "지진도 결국에는 스킬이잖아. 크리티컬 독립시행이지... 한번 크리 터졌다고
    // 모든 건물에 동시 크리티컬 적용되는 게 아니거든")
    if (values.earthquake && buildingAttackCount % values.earthquake.count === 0) {
      const quakeTargets = [targetIdx, ...(BUILDING_ADJACENCY[targetIdx] || [])];
      quakeTargets.forEach((idx) => {
        if (buildingHp[idx] !== null && buildingHp[idx] > 0) {
          const { dmg: splashDmg, isCrit: splashIsCrit } = rollEarthquakeHit(values);
          buildingTotalDmg += splashDmg;
          buildingApplyDamage(idx, splashDmg);
          buildingShake(idx);
          buildingSpawnHitEffect(idx);
          buildingSpawnDamagePopup(idx, splashDmg, splashIsCrit, true);
        }
      });
    }
  }

  buildingApplyCatapultTick(combatConfig, inputs);

  buildingUpdateStatsDisplay();
  buildingUpdateMoveControls();
}

function buildingApplyDamage(idx, dmg) {
  buildingHp[idx] = Math.max(0, buildingHp[idx] - dmg);
  setHpFillWidth(document.getElementById(`buildingHpFill${idx}`), buildingHp[idx], buildingMaxHp[idx]);
  document.getElementById(`buildingHpText${idx}`).textContent =
    `${Math.round(buildingHp[idx]).toLocaleString()} / ${buildingMaxHp[idx].toLocaleString()}`;
  if (buildingHp[idx] <= 0) {
    document.getElementById(`buildingSprite${idx}`).classList.add("building-destroyed");
  }
}

// 맞을 때마다 살짝 흔들리는 효과 - 클래스를 뗐다 강제로 리플로우시킨 뒤 다시 붙여야 같은 애니메이션이
// 연속으로 와도(공속이 빨라서 애니메이션이 끝나기 전에 다음 타격이 들어와도) 매번 처음부터 다시 재생됨
function buildingShake(idx) {
  const sprite = document.getElementById(`buildingSprite${idx}`);
  if (!sprite) return;
  sprite.classList.remove("building-shaking");
  void sprite.offsetWidth;
  sprite.classList.add("building-shaking");
}

// 대상 스프라이트의 실제 화면 좌표(getBoundingClientRect)를 그대로 읽어서 화면 좌표(position:fixed)
// 로 띄움 - 바닥이 Three.js로 바뀐 뒤에도 이 방식 자체는 그대로 유효함(대상이 어떤 방식으로
// 배치됐든 실제 렌더링된 위치를 그대로 읽는 방식이라 무관)
// 피격 이펙트 - 내 공룡의 평타가 건물에 맞았을 때만 씀(투사체(캐터펄트)에 맞은 공룡 쪽엔 안 씀 -
// 발톱 모양(Hit_Effect.png) 이펙트가 투사체 피격과는 안 어울려서 제외함, 사용자 지적). widthRatio/
// topRatio는 향후 다른 대상에도 재사용할 수 있도록 남겨둔 매개변수
function buildingSpawnHitEffectOn(targetEl, { topRatio = 0.4, widthRatio = 0.55 } = {}) {
  if (!targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  if (rect.width === 0) return;
  const fx = document.createElement("img");
  fx.src = "./assets/sprites/Hit_Effect.png";
  fx.className = "dummy-hit-effect building-hit-effect-fixed";
  fx.style.setProperty("--hit-angle", `${Math.floor(Math.random() * 360)}deg`);
  fx.style.left = `${rect.left + rect.width / 2}px`;
  fx.style.top = `${rect.top + rect.height * topRatio}px`;
  fx.style.width = `${rect.width * widthRatio}px`;
  document.body.appendChild(fx);
  fx.addEventListener("animationend", () => fx.remove());
}

function buildingSpawnHitEffect(idx) {
  buildingSpawnHitEffectOn(document.getElementById(`buildingSprite${idx}`), { topRatio: 0.4, widthRatio: 0.55 });
}

// 적 캐터펄트 투사체 애니메이션 - 지금 공격 중인 건물(발사 지점으로 취급)에서 내 공룡 클러스터
// 쪽으로 날아옴(사용자 확정 - "해당 투사체 날아오는 애니메이션도 해주고"). 탄종 이미지는 투석기
// 공격 레벨 드롭다운과 같은 매핑(BUILDING_CATAPULT_LEVELS) 재사용
function buildingSpawnCatapultProjectile(catapultLevel) {
  const ammoOpt = BUILDING_CATAPULT_LEVELS.find((o) => o.value === catapultLevel);
  if (!ammoOpt || !ammoOpt.img) return;
  const fromEl = document.getElementById(`buildingSprite${buildingTargetSlot}`);
  const toEl = document.getElementById("buildingDinoAvatar1");
  if (!fromEl || !toEl) return;
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  if (fromRect.width === 0 || toRect.width === 0) return; // 화면에 안 보이는 상태(display:none 등)면 스킵
  // 위에서 일직선으로 뚝 떨어지지 않고 화면 왼쪽 바깥쪽에서 날아드는 느낌을 주기 위해 시작점을
  // 건물 위치보다 왼쪽/위로 당김(사용자 확정 - "왼쪽에서 곡선을 그리며 떨어져야 함") - 실제 곡선
  // 자체는 css/building.css의 building-projectile-fly 키프레임 50% 지점에서 만듦
  const fromX = fromRect.left + fromRect.width / 2 - 130;
  const fromY = fromRect.top + fromRect.height * 0.3 - 40;
  const toX = toRect.left + toRect.width / 2;
  const toY = toRect.top + toRect.height / 2;

  const proj = document.createElement("img");
  proj.src = `./assets/tribe/${ammoOpt.img}`;
  proj.className = "building-projectile-fixed";
  proj.style.left = `${fromX}px`;
  proj.style.top = `${fromY}px`;
  proj.style.setProperty("--proj-dx", `${toX - fromX}px`);
  proj.style.setProperty("--proj-dy", `${toY - fromY}px`);
  document.body.appendChild(proj);
  proj.addEventListener("animationend", () => proj.remove());
}

// 대미지 팝업 - 건물이든 공룡이든 "이 엘리먼트가 이 대미지를 입었다"는 공용 로직(hit effect와 같은
// 이유로 공용화). buildingSpawnDamagePopup(건물)/buildingSpawnDinoDamagePopup(공룡) 둘 다 이걸 씀
function buildingSpawnDamagePopupOn(targetEl, text, { isCrit = false, isSplash = false } = {}) {
  if (!targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  if (rect.width === 0) return;
  const popup = document.createElement("div");
  popup.className = "battle-dmg-popup building-dmg-popup-fixed" + (isCrit ? " crit" : "") + (isSplash ? " skill" : "");
  popup.innerText = text;
  popup.style.left = `${rect.left + rect.width / 2}px`;
  popup.style.top = `${rect.top}px`;
  document.body.appendChild(popup);
  popup.addEventListener("animationend", () => popup.remove());
}

function buildingSpawnDamagePopup(idx, dmg, isCrit, isSplash) {
  buildingSpawnDamagePopupOn(
    document.getElementById(`buildingSprite${idx}`),
    (isSplash ? t("building.quakeDamagePopupPrefix") : "") + Math.round(dmg).toLocaleString(),
    { isCrit, isSplash }
  );
}

// 캐터펄트에 맞은 공룡용
function buildingSpawnDinoDamagePopup(dinoIdx, dmg, isCrit) {
  buildingSpawnDamagePopupOn(
    document.getElementById(`buildingDinoAvatar${dinoIdx}`),
    Math.round(dmg).toLocaleString(),
    { isCrit }
  );
}

function buildingUpdateStatsDisplay() {
  document.getElementById("buildingTotalDmgEl").innerText = Math.round(buildingTotalDmg).toLocaleString();
  document.getElementById("buildingElapsedEl").innerText = t("building.stats.elapsedValue", { sec: buildingElapsedSec });
  const dps = buildingElapsedSec > 0 ? buildingTotalDmg / buildingElapsedSec : 0;
  document.getElementById("buildingDpsEl").innerText = Math.round(dps).toLocaleString();
}
