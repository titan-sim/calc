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
const BUILDING_CATAPULT_SPEED_OPTIONS = BUILDING_CATAPULT_SPEED_SECONDS.map((sec, lv) => ({
  value: lv,
  label: `Lv.${lv} (${sec.toFixed(1)}초)`
}));

// 투석기 공격 레벨별 탄종/대미지(사용자 확정 - "100 150 200 300 대미지의 각 탄"). 레벨이 높을수록
// 더 센 탄을 쓴다는 것만 확정됐고 탄 이름(claw/stone/metal/realmetal)과의 매핑은 그 순서가
// 유일하게 말이 되는 배정이라 채택(assets/tribe/ 실제 파일명 참고)
const BUILDING_CATAPULT_DAMAGE = { 1: 100, 2: 150, 3: 200, 4: 300 };
const BUILDING_CATAPULT_LEVELS = [
  { value: null, label: "없음" },
  { value: 1, label: "1레벨 (100)" },
  { value: 2, label: "2레벨 (150)" },
  { value: 3, label: "3레벨 (200)" },
  { value: 4, label: "4레벨 (300)" }
];

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
  const inputs = applyConstellationCap(applyServerLevelCap(dinoProfileToBattleInputs(profile)));
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
// buildingTargetSlot으로 지정된 그 타일 위에 서서 공격함. 육각형 1개는 100x86.6 - 중앙 기준
// 정면은 (0,-86.6), 좌측은 (-75,-43.3), 우측은 (+75,-43.3) 만큼 떨어진 자리(육각형 6방향 이웃
// 중 3개)라 정면 육각형은 좌측·우측 육각형과도 서로 변을 맞대고 있고, 중앙 육각형도 정면·좌측·
// 우측 전부와 변을 맞댐(좌측 vs 우측만 서로 안 붙어있음 - 정면이나 중앙을 거쳐야 인접). 결합
// viewBox는 0~250 x 0~173.2 =====
const BUILDING_WORLD_W = 250, BUILDING_WORLD_H = 173.2;
const BUILDING_HEX_CENTERS = [
  [125, 129.9],  // 중앙
  [125, 43.3],   // 정면
  [50, 86.6],    // 좌측
  [200, 86.6]    // 우측
];

// 지진 룬의 "주변 1칸" 인접 관계 - 위 육각형 배치 그대로: 중앙(0)은 정면·좌측·우측 전부와
// 인접하고, 정면(1)도 중앙·좌측·우측 전부와 인접함. 좌측(2)/우측(3)은 서로는 안 붙어있고
// 중앙·정면하고만 인접함
const BUILDING_ADJACENCY = { 0: [1, 2, 3], 1: [0, 2, 3], 2: [0, 1], 3: [0, 1] };

function buildingWorldToPercent([x, y]) {
  return { left: `${(x / BUILDING_WORLD_W) * 100}%`, top: `${(y / BUILDING_WORLD_H) * 100}%` };
}

// ===== 재생 상태 =====
let buildingAttackTimer = null;
let buildingRunning = false;
let buildingElapsedSec = 0;
let buildingTotalDmg = 0;
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
const BUILDING_SLOT_LABELS = ["중앙", "정면", "좌측", "우측"];

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
});

function renderBuildingPage(container) {
  const [c0, c1, c2, c3] = BUILDING_HEX_CENTERS;
  container.innerHTML = `
    <div class="warning">※ 본 시뮬레이터는 참고용이며, 실제 연산 방식과 차이가 있을 수 있습니다.</div>

    <div id="buildingMyDinoSection"></div>

    <div class="card">
      <h2>관련 수치</h2>
      <div class="metrics-grid" id="buildingMetricsGrid">
        <button type="button" class="metric-tile" data-metric="basicDmg">
          <div class="metric-label">평타 대미지</div>
          <div class="metric-value" id="buildingMetricBasicDmg">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="quakeDmg">
          <div class="metric-label">지진 대미지</div>
          <div class="metric-value" id="buildingMetricQuakeDmg">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="atkAmp">
          <div class="metric-label">공격력 증폭량</div>
          <div class="metric-value" id="buildingMetricAtkAmp">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="finalAvgDmg">
          <div class="metric-label">최종 평균 대미지</div>
          <div class="metric-value" id="buildingMetricFinalAvgDmg">0</div>
        </button>
      </div>
      <div class="metric-detail" id="buildingMetricDetail" style="display:none;"></div>
    </div>

    <div class="card battle-main-card building-field-card" id="buildingMainCard">
      <div class="battle-mode-tabs building-mode-tabs-4" id="buildingModeTabs" data-active-idx="0">
        <span class="battle-mode-indicator"></span>
        <button class="battle-mode-tab active" data-mode="settings" id="buildingModeTabSettings"><span>전투 설정</span></button>
        <button class="battle-mode-tab" data-mode="quick" id="buildingModeTabQuick"><span>빠른 계산</span></button>
        <button class="battle-mode-tab" data-mode="live" id="buildingModeTabLive"><span>시뮬레이션</span></button>
        <button class="battle-mode-tab" data-mode="optimize" id="buildingModeTabOptimize"><span>조합 찾기</span></button>
      </div>

      <div class="battle-mode-panel" id="buildingSettingsModeCard">
        <div class="titan-settings-grid">
          <div class="titan-settings-row">
            <div class="setting-label">자연 구조물과 인접</div>
            <label class="switch"><input type="checkbox" id="buildingNatureToggle"><span class="slider round"></span></label>
          </div>
          <div class="titan-settings-row">
            <div class="setting-label">부족 점령 상태</div>
            <label class="switch" title="건물 공략에서는 의미가 없어 항상 꺼져 있습니다"><input type="checkbox" id="buildingTribeToggle" disabled><span class="slider round"></span></label>
          </div>
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">공격력 버프 타워</label>
              <div class="custom-dropdown" id="buildingAtkTowerDropdown">
                <div class="selected-value" id="buildingAtkTowerSelectedValue">없음</div>
                <ul class="dropdown-list" id="buildingAtkTowerList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">체력 버프 타워</label>
              <div class="custom-dropdown" id="buildingHpTowerDropdown">
                <div class="selected-value" id="buildingHpTowerSelectedValue">없음</div>
                <ul class="dropdown-list" id="buildingHpTowerList"></ul>
              </div>
            </div>
          </div>
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">서버 레벨캡</label>
              <div class="custom-dropdown" id="buildingServerLevelCapDropdown">
                <div class="selected-value" id="buildingServerLevelCapSelectedValue">없음</div>
                <ul class="dropdown-list" id="buildingServerLevelCapList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">서버 별자리캡</label>
              <div class="custom-dropdown" id="buildingConstellationCapDropdown">
                <div class="selected-value" id="buildingConstellationCapSelectedValue">없음</div>
                <ul class="dropdown-list" id="buildingConstellationCapList"></ul>
              </div>
            </div>
          </div>
          <div class="titan-settings-levelblock building-settings-divider-before">
            <div class="titan-settings-stack">
              <label class="setting-label">직접 공격할 건물</label>
              <div class="custom-dropdown" id="buildingCombatTargetDropdown">
                <div class="selected-value" id="buildingCombatTargetSelectedValue">없음</div>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">뒤에 있는 건물</label>
              <div class="custom-dropdown" id="buildingCombatBehindDropdown">
                <div class="selected-value" id="buildingCombatBehindSelectedValue">없음</div>
              </div>
            </div>
          </div>
          <div class="building-distance-continuous-row">
            <div class="titan-settings-row">
              <label class="setting-label" for="buildingDistanceInput">건물까지의 거리</label>
              <div class="affix-input has-suffix"><input type="tel" inputmode="numeric" id="buildingDistanceInput" value="1"><span class="affix-suffix">타일</span></div>
            </div>
            <div class="titan-settings-row">
              <label class="setting-label">연속 전투</label>
              <label class="switch"><input type="checkbox" id="buildingContinuousToggle"><span class="slider round"></span></label>
            </div>
          </div>
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">적 투석기 공격 레벨</label>
              <div class="custom-dropdown" id="buildingCatapultLevelDropdown">
                <div class="selected-value" id="buildingCatapultLevelSelectedValue">없음</div>
                <ul class="dropdown-list" id="buildingCatapultLevelList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">적 투석기 발사속도 레벨</label>
              <div class="custom-dropdown" id="buildingCatapultSpeedDropdown">
                <div class="selected-value" id="buildingCatapultSpeedSelectedValue">Lv.0 (6.0초)</div>
                <ul class="dropdown-list" id="buildingCatapultSpeedList"></ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="battle-mode-panel" id="buildingQuickModeCard" style="display:none;">
        <p class="quickcalc-desc">전투 설정에 지정한 건물·캐터펄트 조건 그대로, 공룡이 전멸하거나 앞쪽(직접 공격할) 건물이 부서질 때까지 실전과 같은 방식으로 시뮬레이션합니다.</p>
        <button class="btn-simulate" id="buildingQcBtn">계산하기</button>
        <p class="quickcalc-desc" id="buildingQcGuide" style="display:none;">먼저 전투 설정에서 직접 공격할 건물을 지정해주세요.</p>
        <div class="report-grid" id="buildingQcResult" style="display:none;">
          <div class="report-tile"><div class="metric-label">총 대미지</div><div class="metric-value accent" id="buildingQcTotalDmg">-</div></div>
          <div class="report-tile"><div class="metric-label">지진 대미지</div><div class="metric-value" id="buildingQcQuakeDmg">-</div></div>
          <div class="report-tile"><div class="metric-label">전방 건물 파괴 시간</div><div class="metric-value" id="buildingQcFrontTime">-</div></div>
          <div class="report-tile" id="buildingQcBehindTile" style="display:none;"><div class="metric-label" id="buildingQcBehindLabel">뒤쪽 남은 체력</div><div class="metric-value" id="buildingQcBehindValue">-</div></div>
          <div class="report-tile"><div class="metric-label">죽은 공룡 수</div><div class="metric-value" id="buildingQcDeadCount">-</div></div>
          <div class="report-tile"><div class="metric-label">평균 사망 시간</div><div class="metric-value" id="buildingQcDeathTime">-</div></div>
        </div>
        <div class="report-chart-section" id="buildingQcChartSection" style="display:none;">
          <div class="report-chart-label">시간대별 공룡 체력 변화 추이</div>
          <div class="report-chart-box">
            <canvas id="buildingHpChart"></canvas>
          </div>
          <div id="buildingAvgHpPer" class="report-survival">평균 생존 체력: 0%</div>
        </div>
      </div>

      <div class="battle-mode-panel" id="buildingOptimizeModeCard" style="display:none;">
        <div class="dummy-optimizer">
          <h3 class="dummy-optimizer-title">내 룬 레벨로 최적 조합 찾기</h3>
          <p class="quickcalc-desc">적합 룬 중 보유한 룬의 레벨을 입력하세요(0 = 미보유). 지금 스탯·별자리·전투 설정 기준으로 적 건물을 가장 빨리 부수는 조합을 "빠른 계산"과 같은 방식으로 실전 시뮬레이션해 찾아줍니다.</p>
          <div class="titan-quick-summary" id="buildingOptimizeQuickSummary"></div>
          <div class="dummy-owned-rune-grid" id="buildingOwnedRuneGrid"></div>
          <button class="btn-simulate" id="buildingOptimizeBtn">최적 조합 찾기</button>
          <div id="buildingOptimizeResult"></div>
        </div>
      </div>

      <div class="battle-mode-panel" id="buildingLiveModeCard" style="display:none;">
        <div class="building-field-wrap">
          <div class="building-stage">
            <div class="building-tilt">
              <svg class="building-svg" viewBox="0 0 ${BUILDING_WORLD_W} ${BUILDING_WORLD_H}" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <radialGradient id="buildingHexGrad0" gradientUnits="userSpaceOnUse" cx="${c0[0]}" cy="${c0[1]}" r="45">
                    <stop offset="0%" style="stop-color:var(--accent); stop-opacity:0.32"></stop>
                    <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                  </radialGradient>
                  <radialGradient id="buildingHexGrad1" gradientUnits="userSpaceOnUse" cx="${c1[0]}" cy="${c1[1]}" r="45">
                    <stop offset="0%" style="stop-color:var(--accent); stop-opacity:0.28"></stop>
                    <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                  </radialGradient>
                  <radialGradient id="buildingHexGrad2" gradientUnits="userSpaceOnUse" cx="${c2[0]}" cy="${c2[1]}" r="45">
                    <stop offset="0%" style="stop-color:var(--accent); stop-opacity:0.28"></stop>
                    <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                  </radialGradient>
                  <radialGradient id="buildingHexGrad3" gradientUnits="userSpaceOnUse" cx="${c3[0]}" cy="${c3[1]}" r="45">
                    <stop offset="0%" style="stop-color:var(--accent); stop-opacity:0.28"></stop>
                    <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                  </radialGradient>
                </defs>
                <polygon class="building-hex-tile" data-slot="0" points="100,86.6 150,86.6 175,129.9 150,173.2 100,173.2 75,129.9" fill="url(#buildingHexGrad0)"></polygon>
                <polygon class="building-hex-tile" data-slot="1" points="100,0 150,0 175,43.3 150,86.6 100,86.6 75,43.3" fill="url(#buildingHexGrad1)"></polygon>
                <polygon class="building-hex-tile" data-slot="2" points="25,43.3 75,43.3 100,86.6 75,129.9 25,129.9 0,86.6" fill="url(#buildingHexGrad2)"></polygon>
                <polygon class="building-hex-tile" data-slot="3" points="175,43.3 225,43.3 250,86.6 225,129.9 175,129.9 150,86.6" fill="url(#buildingHexGrad3)"></polygon>
                <!-- 대각선 변과 위/아래 수평 변을 따로 그림 - rotateX(55°)가 화면상 세로(Y) 방향만
                     압축하는 변환이라, 수평 변은 굵기 방향이 통째로 Y축이라 유독 얇아 보이고 대각선
                     변은 덜 압축됨(다이노 배틀/타이탄/허수아비와 같은 이유) - 수평 변만 stroke-width 보정 -->
                <path d="M150,86.6 L175,129.9 L150,173.2 M100,86.6 L75,129.9 L100,173.2 M150,0 L175,43.3 L150,86.6 M100,0 L75,43.3 L100,86.6 M75,43.3 L100,86.6 L75,129.9 M25,43.3 L0,86.6 L25,129.9 M225,43.3 L250,86.6 L225,129.9 M175,43.3 L150,86.6 L175,129.9" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"></path>
                <path d="M100,86.6 L150,86.6 M100,173.2 L150,173.2 M100,0 L150,0 M25,43.3 L75,43.3 M25,129.9 L75,129.9 M175,43.3 L225,43.3 M175,129.9 L225,129.9" fill="none" stroke="var(--accent)" stroke-width="3.6" vector-effect="non-scaling-stroke"></path>
              </svg>

              <div class="building-formation-group" id="buildingFormationGroup">
                <div class="building-dino-slot" id="buildingDinoSlot">
                  <!-- 실제로는 최대 7마리가 동시에 공격하지만(BUILDING_MAX_DINO_COUNT), 한 타일에
                       7마리를 다 그리면 너무 빽빽해서 3마리만 보여주고 나머지는 숨김(사용자 확정 -
                       숨겨진 나머지도 대미지 계산엔 그대로 포함됨, computeBuildingCombatValues 참고) -->
                  <div class="building-dino-cluster">
                    <div class="building-dino-avatar"></div>
                    <div class="building-dino-avatar"></div>
                    <div class="building-dino-avatar"></div>
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
        </div>

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
          <div class="report-tile"><div class="metric-label">총 대미지</div><div class="metric-value accent" id="buildingTotalDmgEl">0</div></div>
          <div class="report-tile"><div class="metric-label">경과 시간</div><div class="metric-value" id="buildingElapsedEl">0초</div></div>
          <div class="report-tile"><div class="metric-label">평균 초당 대미지</div><div class="metric-value" id="buildingDpsEl">0</div></div>
        </div>

        <div class="battle-controls">
          <div class="custom-dropdown battle-speed-dropdown" id="buildingSpeedDropdown">
            <div class="selected-value" id="buildingSpeedSelectedValue">보통</div>
            <ul class="dropdown-list" id="buildingSpeedList"></ul>
          </div>
          <button class="btn-simulate" id="buildingStartBtn">공격 시작</button>
          <button class="battle-restart-btn" id="buildingRestartBtn" disabled title="처음부터 다시 시작">↻</button>
        </div>
      </div>
    </div>

    <div class="friend-picker-overlay" id="buildingSelectOverlay" style="display:none;">
      <div class="friend-picker-modal">
        <div class="friend-picker-header">
          <span>건축물 선택</span>
          <button class="close-btn" id="buildingSelectClose">✕</button>
        </div>
        <div id="buildingSelectList"></div>
      </div>
    </div>
  `;

  renderMyDinoPage(document.getElementById("buildingMyDinoSection"), {
    idPrefix: "buildingMy_",
    unsuitableList: BUILDING_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: "건물 공략에 적합하지 않은 룬입니다",
    onChange: () => {
      buildingRefreshMetricsCard();
      buildingResetDisplay();
      buildingResetQuickCalc();
    }
  });

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
  buildingUpdateDinoPosition();
  buildingUpdateMoveControls();
  buildingUpdateStartButtonState();
  buildingUpdateStatsDisplay();
}

// 건물 슬롯 위치는 고정이라(대형이 바뀌는 다이노 배틀과 달리) 한 번만 계산해서 심으면 됨. 공룡
// 위치는 고정이 아니라 buildingTargetSlot을 따라 바뀌므로 buildingUpdateDinoPosition()이 따로 담당
function buildingPositionSlots() {
  [0, 1, 2, 3].forEach((i) => {
    const pct = buildingWorldToPercent(BUILDING_HEX_CENTERS[i]);
    const slot = document.getElementById(`buildingWallSlot${i}`);
    slot.style.left = pct.left;
    slot.style.top = pct.top;
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
    const label = BUILDING_SLOT_LABELS[i];
    btn.classList.remove("active");
    if (buildingMaxHp[i] === null) {
      btn.textContent = `${label}: 비어있음`;
      btn.disabled = true;
    } else if (buildingHp[i] <= 0) {
      btn.textContent = `${label}: 파괴됨`;
      btn.disabled = true;
    } else if (buildingTargetSlot === i) {
      btn.textContent = `${label}: 공격 중`;
      btn.disabled = false;
      btn.classList.add("active");
    } else {
      btn.textContent = `${label}으로 이동`;
      btn.disabled = false;
    }
  });
}

function buildingInitMetricsCard() {
  document.querySelectorAll("#buildingMetricsGrid .metric-tile").forEach((tile) => {
    tile.onclick = () => {
      const key = tile.dataset.metric;
      buildingActiveMetricKey = buildingActiveMetricKey === key ? null : key;
      document.querySelectorAll("#buildingMetricsGrid .metric-tile").forEach((t) => {
        t.classList.toggle("active", t.dataset.metric === buildingActiveMetricKey);
      });
      buildingRenderMetricDetail();
    };
  });
}

// 값이 바뀌면 오도미터 롤링 애니메이션(js/ui/stat-roll-ui.js, "내 공룡" 요약바와 같은 연출)으로
// 갱신 - 값이 그대로면 애니메이션 없이 조용히 넘어감(animateStatValue 자체가 그렇게 동작함)
// value가 NaN/undefined/null이면(예: 프리셋 전환 중 스탯이 잠깐 비정상 조합이 되는 경우 등)
// 화면에 "NaN"/"null" 같은 글자가 그대로 뜨는 대신 0으로 표시함(사용자 확정 - "null이 아니라
// 0으로 표시하든지 어떻게 해봐")
function buildingSetMetricTile(id, value) {
  const el = document.getElementById(id);
  const safeValue = Number.isFinite(value) ? value : 0;
  animateStatValue(el, Math.round(safeValue).toLocaleString());
}

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
  buildingSetMetricTile("buildingMetricBasicDmg", m ? m.avgHitDamage : 0);
  buildingSetMetricTile("buildingMetricQuakeDmg", m ? m.avgEarthquakeDamage : 0);
  buildingSetMetricTile("buildingMetricAtkAmp", m ? m.atkAmpGain : 0);
  buildingSetMetricTile("buildingMetricFinalAvgDmg", finalAvgDmg);
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

  if (buildingActiveMetricKey === "basicDmg") {
    title = "평타 대미지 계산 내역";
    rows = [
      { label: "증폭 전 공격력", value: Math.round(buildingSafeNum(m.preAmpAtk)).toLocaleString() },
      { label: "증폭 후 공격력", value: Math.round(buildingSafeNum(m.atk)).toLocaleString() },
      { label: "치명타 확률", value: `${buildingSafeNum(m.cRate).toFixed(2)}%` },
      { label: "치명타 피해", value: `${buildingSafeNum(m.cDmg).toFixed(2)}%` }
    ];
  } else if (buildingActiveMetricKey === "quakeDmg") {
    title = "지진 대미지 계산 내역";
    if (m.earthquake) {
      rows = [{
        label: `지진 (${m.earthquake.count}타마다 ${m.earthquake.burst_p}% 스플래시)`,
        value: Math.round(buildingSafeNum(m.avgEarthquakeDamage)).toLocaleString()
      }];
    }
  } else if (buildingActiveMetricKey === "atkAmp") {
    title = "공격력 증폭 내역";
    rows = m.destroyerBreakdown.map((d) => ({
      label: `${d.name} (증폭 +${buildingSafeNum(d.percent).toFixed(2)}%)`,
      value: `+${Math.round(buildingSafeNum(m.preAmpAtk) * (buildingSafeNum(d.percent) / 100)).toLocaleString()}`
    }));
  } else if (buildingActiveMetricKey === "finalAvgDmg") {
    title = "최종 평균 대미지 계산 내역";
    rows = [
      { label: "평타 대미지", value: Math.round(buildingSafeNum(m.avgHitDamage)).toLocaleString() },
      { label: "지진 대미지", value: Math.round(buildingSafeNum(m.avgEarthquakeDamage)).toLocaleString() }
    ];
  }

  if (rows.length === 0) {
    box.innerHTML = `<div class="metric-detail-title">${title}</div><div class="metric-detail-empty">장착된 관련 룬이 없습니다</div>`;
  } else {
    box.innerHTML = `<div class="metric-detail-title">${title}</div>${rows
      .map((r) => `<div class="metric-detail-row"><div class="metric-detail-row-main"><span>${r.label}</span><span>${r.value}</span></div></div>`)
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

  const labelFor = (v) => BUFF_TOWER_OPTIONS.find((o) => o.value === v).label;

  const atkList = document.getElementById("buildingAtkTowerList");
  const atkSelectedValue = document.getElementById("buildingAtkTowerSelectedValue");
  atkSelectedValue.textContent = labelFor(settings.atkTowerLevel);
  BUFF_TOWER_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      settings.atkTowerLevel = opt.value;
      atkSelectedValue.textContent = opt.label;
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
    li.textContent = opt.label;
    li.onclick = () => {
      settings.hpTowerLevel = opt.value;
      hpSelectedValue.textContent = opt.label;
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
  const capLabelFor = (v) => SERVER_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label;
  const capList = document.getElementById("buildingServerLevelCapList");
  const capSelectedValue = document.getElementById("buildingServerLevelCapSelectedValue");
  capSelectedValue.textContent = capLabelFor(loadServerLevelCap());
  SERVER_LEVEL_CAP_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      saveServerLevelCap(opt.value);
      capSelectedValue.textContent = opt.label;
      capList.style.display = "none";
      buildingRefreshMetricsCard();
      buildingResetDisplay();
      buildingResetQuickCalc();
    };
    capList.appendChild(li);
  });
  capSelectedValue.onclick = () => toggleDropdownList(capSelectedValue, capList);

  // 별자리 레벨캡 - 서버 레벨캡과 마찬가지로 전역 공유 설정(loadConstellationLevelCap/
  // saveConstellationLevelCap, my-dino-page.js)
  const constLabelFor = (v) => CONSTELLATION_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label;
  const constList = document.getElementById("buildingConstellationCapList");
  const constSelectedValue = document.getElementById("buildingConstellationCapSelectedValue");
  constSelectedValue.textContent = constLabelFor(loadConstellationLevelCap());
  CONSTELLATION_LEVEL_CAP_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      saveConstellationLevelCap(opt.value);
      constSelectedValue.textContent = opt.label;
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
  const buildingLabelFor = (id) => {
    if (id === null) return "없음";
    const def = BUILDING_TYPES.find((b) => b.id === id);
    return def ? def.label : "없음";
  };

  const targetSelectedValue = document.getElementById("buildingCombatTargetSelectedValue");
  targetSelectedValue.textContent = buildingLabelFor(config.targetBuildingId);
  targetSelectedValue.onclick = () => {
    buildingOpenSelectModalGeneric(config.targetBuildingId, (id) => {
      config.targetBuildingId = id;
      saveBuildingCombatConfig(config);
      targetSelectedValue.textContent = buildingLabelFor(id);
      buildingRenderOptimizeSummary();
    });
  };

  const behindSelectedValue = document.getElementById("buildingCombatBehindSelectedValue");
  behindSelectedValue.textContent = buildingLabelFor(config.behindBuildingId);
  behindSelectedValue.onclick = () => {
    buildingOpenSelectModalGeneric(config.behindBuildingId, (id) => {
      config.behindBuildingId = id;
      saveBuildingCombatConfig(config);
      behindSelectedValue.textContent = buildingLabelFor(id);
      // 뒤 건물 여부가 빠른 계산의 지진 스플래시 결과에 직접 영향을 주므로, 바뀌면 이전 결과를
      // 지워서 재계산 전까지 낡은 값이 남아있지 않게 함(다른 설정 드롭다운들과 같은 패턴)
      buildingResetQuickCalc();
      buildingRenderOptimizeSummary();
    });
  };

  const catapultList = document.getElementById("buildingCatapultLevelList");
  const catapultSelectedValue = document.getElementById("buildingCatapultLevelSelectedValue");
  const catapultLabelFor = (v) => BUILDING_CATAPULT_LEVELS.find((o) => o.value === v).label;
  catapultSelectedValue.textContent = catapultLabelFor(config.catapultLevel);
  BUILDING_CATAPULT_LEVELS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      config.catapultLevel = opt.value;
      catapultSelectedValue.textContent = opt.label;
      catapultList.style.display = "none";
      saveBuildingCombatConfig(config);
      buildingRenderOptimizeSummary();
    };
    catapultList.appendChild(li);
  });
  catapultSelectedValue.onclick = () => toggleDropdownList(catapultSelectedValue, catapultList);

  const speedList = document.getElementById("buildingCatapultSpeedList");
  const speedSelectedValue = document.getElementById("buildingCatapultSpeedSelectedValue");
  const speedLabelFor = (v) => BUILDING_CATAPULT_SPEED_OPTIONS.find((o) => o.value === v).label;
  speedSelectedValue.textContent = speedLabelFor(config.catapultSpeedLevel);
  BUILDING_CATAPULT_SPEED_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      config.catapultSpeedLevel = opt.value;
      speedSelectedValue.textContent = opt.label;
      speedList.style.display = "none";
      saveBuildingCombatConfig(config);
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
  const buildingLabelFor = (id) => {
    if (id === null) return "없음";
    const def = BUILDING_TYPES.find((b) => b.id === id);
    return def ? def.label : "없음";
  };
  const catapultLabel = BUILDING_CATAPULT_LEVELS.find((o) => o.value === config.catapultLevel).label;
  const speedLabel = BUILDING_CATAPULT_SPEED_OPTIONS.find((o) => o.value === config.catapultSpeedLevel).label;

  el.innerHTML = `
    <div class="titan-quick-summary-grid">
      <div class="titan-quick-summary-col">
        <div class="titan-quick-summary-item"><span>직접 공격할 건물</span><b>${buildingLabelFor(config.targetBuildingId)}</b></div>
        <div class="titan-quick-summary-item"><span>건물까지의 거리</span><b>${config.distanceTiles}타일</b></div>
        <div class="titan-quick-summary-item"><span>적 투석기 공격 레벨</span><b>${catapultLabel}</b></div>
      </div>
      <div class="titan-quick-summary-col">
        <div class="titan-quick-summary-item"><span>뒤에 있는 건물</span><b>${buildingLabelFor(config.behindBuildingId)}</b></div>
        <div class="titan-quick-summary-item"><span>연속 전투</span><b>${config.continuousBattle ? "ON" : "OFF"}</b></div>
        <div class="titan-quick-summary-item"><span>적 투석기 발사속도 레벨</span><b>${speedLabel}</b></div>
      </div>
    </div>
  `;
}

// ===== 건물 선택 모달 - 육각형 타일(4칸 전부) 클릭 -> "없음/건물 종류" 중 고름 =====
function buildingInitSelectModal() {
  document.querySelectorAll(".building-hex-tile").forEach((tile) => {
    tile.addEventListener("click", () => buildingOpenSelectModal(Number(tile.dataset.slot)));
  });
  document.getElementById("buildingSelectClose").onclick = () => {
    document.getElementById("buildingSelectOverlay").style.display = "none";
  };
}

// 건물 선택 그리드(아이콘+이름+체력) 공용 렌더러 - 육각형 타일 클릭 모달(건설)과 전투 설정 탭의
// "직접 공격할 건물/뒤에 있는 건물" 인라인 선택(사용자 확정 - "공격할 건물의 드롭다운에는 해당
// 건물의 체력 표시하기... 그리드로 바꿔서 각 건물의 체력을 표시") 둘 다 이걸 씀. emptyLabel은
// 모달에서만 "없음(비우기)"로 다르게 쓰고 싶어서 인자로 뺌
function buildingRenderSelectGrid(container, currentId, onSelect, emptyLabel = "없음") {
  const emptyCell = `
    <div class="building-select-item${currentId === null ? " active" : ""}" data-id="">
      <div class="building-select-empty-icon">✕</div>
      <span>${emptyLabel}</span>
    </div>
  `;
  const buildingCells = BUILDING_TYPES.map((b) => `
    <div class="building-select-item${b.locked ? " locked" : ""}${b.id === currentId ? " active" : ""}" data-id="${b.locked ? "" : b.id}">
      <img src="./assets/tribe/${b.img}" alt="${b.label}">
      <span>${b.label}</span>
      ${b.locked ? `<span class="building-select-lock">미출시</span>` : `<span class="building-select-hp">${b.hp.toLocaleString()}</span>`}
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
function buildingOpenSelectModalGeneric(currentId, onChoose, emptyLabel = "없음") {
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
  }, "없음(비우기)");
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
    sprite.alt = def.label;
    sprite.style.display = "";
    // 이 이미지에서 육각형 중심에 와야 하는 정확한 지점(사용자가 직접 측정해서 준 좌표) - 예전엔
    // 발밑 정렬 기준으로 알파채널 여백/그림자/원근감을 어림짐작으로 보정했는데 이제 그럴 필요 없음
    frame.style.setProperty("--anchor-x", `${def.anchorX}%`);
    frame.style.setProperty("--anchor-y", `${def.anchorY}%`);
    sprite.classList.remove("building-destroyed", "building-shaking");
    hpBarEl.style.display = "";
    hpTextEl.style.display = "";
    buildingMaxHp[i] = def.hp;
    buildingHp[i] = def.hp;
    document.getElementById(`buildingHpFill${i}`).style.width = "100%";
    hpTextEl.textContent = `${def.hp.toLocaleString()} / ${def.hp.toLocaleString()}`;
  });
}

function buildingUpdateStartButtonState() {
  const btn = document.getElementById("buildingStartBtn");
  const hasTarget = buildingFrontTargetIndex() !== -1;
  btn.disabled = !hasTarget && !buildingRunning;
  btn.title = hasTarget ? "" : "먼저 건물을 세우고, 아래 이동 버튼으로 공격할 타일로 이동해주세요";
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
    };
  });

  document.getElementById("buildingQcBtn").onclick = buildingRunQuickCalc;
  document.getElementById("buildingOptimizeBtn").onclick = buildingRunOptimizer;
}

// 초 단위 시간을 "N분 M초"(또는 60초 미만이면 "N초")로 표시 - 건물 HP가 커서 몇 분~몇십 분씩
// 걸리는 경우가 흔해 그냥 초로만 보여주면 읽기 어려움
function buildingFormatTime(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}분 ${r}초` : `${m}분`;
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
    constellation: inputs.constellation, bonusPercent: inputs.bonusPercent, moveSpeed: inputs.moveSpeed,
    distanceTiles: combatConfig.distanceTiles, continuousBattle: combatConfig.continuousBattle,
    tileCfg, maxDino: BUILDING_MAX_DINO_COUNT,
    targetHp: targetDef.hp, behindHp: behindDef ? behindDef.hp : null,
    catapultDmg: combatConfig.catapultLevel ? BUILDING_CATAPULT_DAMAGE[combatConfig.catapultLevel] : null,
    catapultPeriodSec: BUILDING_CATAPULT_SPEED_SECONDS[combatConfig.catapultSpeedLevel],
    iterations: buildingPickIterations(inputs.selectedRunes),
    onProgress: (c, t) => {
      btn.textContent = `계산 중 (${c}/${t})...`;
      btn.style.setProperty("--progress", String((c / t) * 100));
    }
  });

  buildingRenderQuickCalcReport(result, behindDef);

  btn.disabled = false;
  btn.textContent = "계산하기";
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
      label.innerText = "후방 건물 파괴 시간";
      value.innerText = buildingFormatTime(result.avgBehindBreakTimeSec);
    } else {
      label.innerText = "후방 건물 남은 체력";
      value.innerText = `${Math.round(result.avgBehindRemainingHp).toLocaleString()} / ${behindDef.hp.toLocaleString()}`;
    }
    behindTile.style.display = "";
  } else {
    behindTile.style.display = "none";
  }

  document.getElementById("buildingQcDeadCount").innerText = `${result.avgDeadCount.toFixed(1)}마리`;
  document.getElementById("buildingQcDeathTime").innerText =
    result.avgDeathTimeSec !== null ? buildingFormatTime(result.avgDeathTimeSec) : "-";

  document.getElementById("buildingQcResult").style.display = "grid";

  const chartSection = document.getElementById("buildingQcChartSection");
  if (result.chartData.length >= 2) {
    document.getElementById("buildingAvgHpPer").innerText = `평균 생존 체력: ${result.avgSurvivalPercent.toFixed(1)}%`;
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
      <span class="dummy-owned-rune-name">${name}</span>
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
    ? `${buildingFormatTime(r.avgFrontBreakTimeSec)} 만에 파괴`
    : `${Math.round(r.avgTotalDmg).toLocaleString()} 대미지 (파괴 못 함)`;
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
    resultEl.innerHTML = `<p class="quickcalc-desc">보유한 룬 레벨을 먼저 입력해주세요.</p>`;
    return;
  }

  const combatConfig = loadBuildingCombatConfig();
  if (!combatConfig.targetBuildingId) {
    resultEl.innerHTML = `<p class="quickcalc-desc">먼저 전투 설정에서 직접 공격할 건물을 지정해주세요.</p>`;
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
      btn.textContent = `1단계 계산 중 (${end.toLocaleString()}/${combos.length.toLocaleString()})...`;
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
      constellation: inputs.constellation, bonusPercent: inputs.bonusPercent, moveSpeed: inputs.moveSpeed,
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
    btn.textContent = `2단계 정밀 계산 중 (${i + 1}/${candidates.length})...`;
    btn.style.setProperty("--progress", String(15 + ((i + 1) / candidates.length) * 85));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  refined.sort(buildingCompareOptimizeResults);
  const top = refined.slice(0, 3);
  const bestLine = top[0].names.map((n) => `${n} Lv.${levels[n]}`).join(" · ");

  resultEl.innerHTML = `
    ${slotCount < 5 ? `<p class="quickcalc-desc">보유한 적합 룬이 ${owned.length}개뿐이라 ${slotCount}개짜리 조합까지만 계산했습니다.</p>` : ""}
    <div class="report-grid">
      <div class="report-tile dummy-optimize-best-tile">
        <div class="metric-label">최적 조합</div>
        <div class="dummy-optimize-best-combo">${bestLine}</div>
      </div>
      <div class="report-tile"><div class="metric-label">결과</div><div class="metric-value accent">${buildingOptimizeResultLabel(top[0])}</div></div>
    </div>
    ${top.length > 1 ? `
      <div class="dummy-optimize-runner-ups">
        ${top.slice(1).map((r, i) => `<div class="dummy-optimize-runner-up">${i + 2}위 · ${r.names.join(", ")} (${buildingOptimizeResultLabel(r)})</div>`).join("")}
      </div>
    ` : ""}
  `;

  btn.disabled = false;
  btn.textContent = "최적 조합 찾기";
  btn.classList.remove("btn-progress");
  btn.style.removeProperty("--progress");
}

function buildingInitSpeedDropdown() {
  const currentMs = buildingGetSpeedMs();
  const list = document.getElementById("buildingSpeedList");
  const selectedValue = document.getElementById("buildingSpeedSelectedValue");
  selectedValue.textContent = BATTLE_SPEED_OPTIONS.find((o) => o.ms === currentMs).label;

  BATTLE_SPEED_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      localStorage.setItem(BUILDING_SPEED_KEY, String(opt.ms));
      selectedValue.textContent = opt.label;
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
  document.getElementById("buildingStartBtn").textContent = "일시정지";
  document.getElementById("buildingRestartBtn").disabled = false;
  buildingAttackTimer = setInterval(buildingRunAttackTick, buildingGetSpeedMs());
}

function buildingPauseAttack() {
  buildingRunning = false;
  clearInterval(buildingAttackTimer);
  document.getElementById("buildingStartBtn").textContent = "재개";
}

function buildingResetDisplay() {
  buildingRunning = false;
  clearInterval(buildingAttackTimer);
  buildingElapsedSec = 0;
  buildingTotalDmg = 0;
  buildingAttackCount = 0;
  document.getElementById("buildingStartBtn").textContent = "공격 시작";
  document.getElementById("buildingRestartBtn").disabled = true;
  document.querySelectorAll(".building-hit-effect-fixed, .building-dmg-popup-fixed").forEach((el) => el.remove());
  document.querySelectorAll(".building-sprite").forEach((el) => el.classList.remove("building-shaking"));
  buildingRenderWalls();
  buildingUpdateDinoPosition();
  buildingUpdateMoveControls();
  buildingUpdateStartButtonState();
  buildingUpdateStatsDisplay();
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
  buildingElapsedSec++;
  buildingAttackCount++;

  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const inputs = buildingDinoInputs(profile);
  const tileCfg = loadBuildingTileSettings();
  const values = computeBuildingCombatValues(inputs, tileCfg);
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
  // 인접이라 셋 다 맞고, 좌/우는 정면하고만 인접이라 자신+정면만 맞음). 각 타격은 방금 들어간
  // 주공격의 최종 피해량 기준 %
  if (values.earthquake && buildingAttackCount % values.earthquake.count === 0) {
    const quakeTargets = [targetIdx, ...(BUILDING_ADJACENCY[targetIdx] || [])];
    quakeTargets.forEach((idx) => {
      if (buildingHp[idx] !== null && buildingHp[idx] > 0) {
        const splashDmg = computeEarthquakeSplashDamage(dmg, values.earthquake);
        buildingTotalDmg += splashDmg;
        buildingApplyDamage(idx, splashDmg);
        buildingShake(idx);
        buildingSpawnHitEffect(idx);
        buildingSpawnDamagePopup(idx, splashDmg, isCrit, true);
      }
    });
  }

  buildingUpdateStatsDisplay();
  buildingUpdateMoveControls();
}

function buildingApplyDamage(idx, dmg) {
  buildingHp[idx] = Math.max(0, buildingHp[idx] - dmg);
  const pct = buildingMaxHp[idx] > 0 ? (buildingHp[idx] / buildingMaxHp[idx]) * 100 : 0;
  document.getElementById(`buildingHpFill${idx}`).style.width = `${pct}%`;
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

// 대상이 preserve-3d 안에 있어서 fx를 3D 공간 안에 두면 깊이 다툼에 걸림(다이노 배틀/타이탄/
// 허수아비와 같은 문제) - 3D를 아예 우회해서 화면 좌표(position:fixed)로 직접 띄움
function buildingSpawnHitEffect(idx) {
  const sprite = document.getElementById(`buildingSprite${idx}`);
  if (!sprite) return;
  const rect = sprite.getBoundingClientRect();
  const fx = document.createElement("img");
  fx.src = "./assets/sprites/Hit_Effect.png";
  fx.className = "dummy-hit-effect building-hit-effect-fixed";
  fx.style.setProperty("--hit-angle", `${Math.floor(Math.random() * 360)}deg`);
  fx.style.left = `${rect.left + rect.width / 2}px`;
  fx.style.top = `${rect.top + rect.height * 0.4}px`;
  fx.style.width = `${rect.width * 0.55}px`;
  document.body.appendChild(fx);
  fx.addEventListener("animationend", () => fx.remove());
}

function buildingSpawnDamagePopup(idx, dmg, isCrit, isSplash) {
  const sprite = document.getElementById(`buildingSprite${idx}`);
  if (!sprite) return;
  const rect = sprite.getBoundingClientRect();
  const popup = document.createElement("div");
  popup.className = "battle-dmg-popup building-dmg-popup-fixed" + (isCrit ? " crit" : "") + (isSplash ? " skill" : "");
  popup.innerText = (isSplash ? "지진 " : "") + Math.round(dmg).toLocaleString();
  popup.style.left = `${rect.left + rect.width / 2}px`;
  popup.style.top = `${rect.top}px`;
  document.body.appendChild(popup);
  popup.addEventListener("animationend", () => popup.remove());
}

function buildingUpdateStatsDisplay() {
  document.getElementById("buildingTotalDmgEl").innerText = Math.round(buildingTotalDmg).toLocaleString();
  document.getElementById("buildingElapsedEl").innerText = `${buildingElapsedSec}초`;
  const dps = buildingElapsedSec > 0 ? buildingTotalDmg / buildingElapsedSec : 0;
  document.getElementById("buildingDpsEl").innerText = Math.round(dps).toLocaleString();
}
