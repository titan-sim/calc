// 타이탄 시뮬레이터. 예전엔 "전투 설정 카드 + 시뮬레이션 시작 버튼 1개"뿐이었는데, 다른 페이지들처럼
// 목적별로 나눠달라는 요청에 따라 "전투 설정"(별도 카드, 3개 모드와는 시각적으로 분리) + 3탭
// (빠른 계산/실전 시뮬레이션/조합 찾기) 구조로 재구성함. 3탭 전환은 허수아비 페이지(dummy-page.js)의
// battle-mode-tabs/dummy-mode-tabs-3 패턴을 그대로 재사용.
//
// "자연의 포옹"/"부족의 축복 1·2"도 타이탄에 적합한 룬으로 취급함(UNSUITABLE_RUNE_LIST에서 제외).
// 전투 설정의 자연/부족 타일 토글이 켜져있을 때만 그 룬들의 효과가 붙음 - simulation-titan.js/
// stat-calc.js(getTitanCombatMetrics) 양쪽 다 동일한 조건으로 게이팅함.

const TITAN_CONFIG_KEY = "dino_sim_config_titan"; // {titanLevel, timeLimitMinutes, distanceTiles, continuousBattle} - 기존 키 그대로 유지
const TITAN_TILE_KEY = "dino_titan_tile_settings"; // {natureAdjacent, tribeControl, atkTowerLevel, hpTowerLevel}
const TITAN_OWNED_LEVELS_KEY = "dino_titan_owned_rune_levels";
const TITAN_SPEED_KEY = "dino_titan_speed_ms";

// 서버 레벨캡(전역 공유 설정, my-dino-page.js) 적용판 - getMyDinoBattleInputs()를 직접 쓰던
// 모든 곳을 이걸로 교체
function titanDinoInputs() {
  return applyConstellationCap(applyServerLevelCap(getMyDinoBattleInputs()));
}
// 조합 찾기는 조합 수가 많으면(보유 룬이 많을수록 기하급수적으로 늘어남) 매번 정밀 시뮬레이션을
// 돌리기엔 너무 느려서 3단계로 나눔: 1단계는 모든 조합의 DPS/기대 사망 횟수/균형 점수를
// 시뮬레이션 없이 estimateTitanExpectedDeaths()(js/core/stat-calc.js, 연속 전투 기준 재생 이론
// 모델)로 즉시 계산해 후보만 추리고, 2단계는 그 후보만 실제 시뮬레이션으로 재계산, 3단계는 2단계
// 결과 상위권(최종 후보) 몇 개만 회차를 훨씬 더 높여 다시 검증함 - 2단계의 표본이 우연히 좋게(또는
// 나쁘게) 나온 조합이 승자로 잘못 뽑히는 걸 막기 위함(표본 수가 적을수록 우연히 뽑힌 평균이 진짜
// 기댓값과 크게 벗어날 가능성이 커짐 - 시드를 고정해 결과를 재현 가능하게 만드는 방법도
// 검토했었지만, 그건 "우연히 나쁜 표본"을 매번 똑같이 재현할 뿐 진짜 값에 더 가까워지는 게
// 아니라서 기각함).
//
// 실측 결과 가장 느린 경우는 "다들 안 죽고 버티는" 시나리오(매 회차가 최대 5400틱까지 통째로
// 도는 데다 회차 수도 많아서 몇십~백초까지 걸림) - 이 경우를 겨냥해 3단계에서
// "2단계 표본이 이미 전부(예외 없이) 무사망으로 확인된 조합"은 300회 전체 검증 대신
// 훨씬 저렴한 확인 회차(TITAN_OPTIMIZER_CAP_CHECK_ITERATIONS)만 먼저 돌려봄. 2단계 15회가 전부
// 캡에 도달했다고 무조건 믿고 완전히 생략하지는 않음 - 예를 들어 진짜 사망 확률이 5%인 조합이어도
// 15회 독립 시행이 전부 우연히 살아남을 확률은 약 46%(0.95^15)로 결코 무시할 수 없는 수치라,
// 그대로 "생존 확정"으로 믿으면 완전히 틀린 결론이 나올 수 있음. 저렴한 확인 회차(50회)에서도
// 전부 살아남으면(총 65회 전부 생존, 사망 확률 5% 기준 우연히 그럴 확률이 약 3.6%로 급감) 그때
// 비로소 캡에 도달한 것으로 확정하고 300회 전체 검증은 생략함(6배 저렴). 반대로 이 저렴한 확인
// 중 단 한 번이라도 죽으면 - "2단계가 우연히 좋게 나온" 경우로 판명된 것이므로 지레짐작하지
// 않고 원래대로 300회 전체 검증을 마저 돌려 정확한 값을 구함(이 경우엔 50+300회를 다 쓰게 되지만,
// 애초에 진짜 안전한 조합이라면 이 분기를 안 타므로 흔치 않은 경우임).
const TITAN_OPTIMIZER_FINAL_ITERATIONS = 15;
// avgDeadCount(연속 전투 하 평균 사망 횟수)는 대부분의 "안전한" 후보끼리 비교할 때 값 자체가
// 0에 가까운 희귀 사건 통계라, 옛날 방식(avgTimeSec, 제한 시간에 캡되는 값)보다 표본 노이즈에
// 훨씬 민감함. 1500회까지 올려봤지만 1회당 최대 120분(제한 시간) 통짜 시뮬레이션이라 조합당
// 비용이 커서, 최종 후보(TOP_N)를 넓게 잡은 상태에서는 3단계 전체 소요 시간의 대부분을 차지함
// (극단 시나리오 실측: 3단계가 전체 소요 시간의 90%). 500회로 낮춰 균형을 맞춤
const TITAN_OPTIMIZER_VERIFY_ITERATIONS = 500;
// 실측(사용자 리포트 + Node 재현) 확인: 1단계 후보군(최대 120개)엔 진짜 좋은 조합이 이미 들어와
// 있어도, 2단계(15회 실측)의 표본 노이즈 때문에 정밀 검증(3단계) 대상으로 못 넘어가는 경우가
// 있었음(예: 해석적으로 DPS가 훨씬 높고 위험도는 사실상 동률인 조합이, 15회 우연히 나쁘게 나온
// 다른 조합에 밀려 3단계 문턱을 못 넘음). 5 -> 10으로 넓혀서 이 병목을 완화했었음(묶음19).
// 이후(묶음21) 1단계 자체의 버킷 해상도를 후보군에 한해 정밀화(TITAN_SURVIVAL_REFINE_BUCKETS)한
// 덕에, 이 문제를 노리는 세 번째 갈래(byAnalyticBalance, 노이즈 없는 해석적 균형 점수 기준)가
// 훨씬 정확해져서 10까지 넓힐 필요가 줄어듦. 3단계가 전체 소요 시간의 대부분을 차지하는 게
// 확인돼서(묶음21) 6으로 다시 좁힘 - byAnalyticBalance가 여전히 별도 갈래로 남아있어 노이즈로
// 억울하게 떨어지는 후보를 잡아주는 역할은 그대로 유지됨
const TITAN_OPTIMIZER_VERIFY_TOP_N = 6;
const TITAN_OPTIMIZER_CAP_CHECK_ITERATIONS = 50;
const TITAN_OPTIMIZER_CANDIDATE_COUNT = 30;
// 3단계 예비 검증(prescan) 회차 - 최종 후보(finalists) 전부를 무조건 500회씩 검증하면 그게 전체
// 소요 시간의 대부분(실측 90%)을 차지하는데, 최종 후보끼리도 이미 확실히 갈리는 경우(한쪽이
// 생존도 딜도 둘 다 확실히 밀림)엔 500회까지 안 가도 결론이 안 바뀜. 그래서 먼저 이 저렴한
// 회차로 다들 가볍게 재보고, 진짜 경합 중인 후보(titanEscalateFromPrescan 판정)만 500회까지
// 마저 검증함 - 근사가 아니라 "이길 가능성이 통계적으로 없는 후보에 500회를 안 쓸 뿐"이라
// 최종 정확도는 그대로 유지됨.
const TITAN_OPTIMIZER_PRESCAN_ITERATIONS = 60;
// 예비 검증에서 대미지가 최댓값의 이 비율 이상이면(생존 판정과 별개로) 항상 500회까지 승격 -
// "균형/대미지" 축에서 이길 가능성을 안전하게 남겨두기 위한 관대한 여유값(대미지 최댓값을
// 가진 조합은 이 조건에 100% 걸려 항상 승격되므로 "최대 대미지 조합"의 실측치는 항상 정밀함)
const TITAN_OPTIMIZER_CONTENDER_DPS_RATIO = 0.85;
// "균형" 점수 = dpsNorm^w * survivalQuality^(1-w) (가중 기하평균). w=0.5(동일 가중치)였을 때 실측
// 확인 결과, 힐처럼 대미지 기여가 0인 순수 생존형 룬이 사망 횟수를 크게 낮춰준다는 이유만으로
// 낙뢰/압축된 힘처럼 대미지가 뚜렷이 높은 룬보다 항상 우선시됨(예: 평균 사망 0.04 vs 0.8 정도
// 차이면 대미지가 28% 더 높아도 후자가 밀림) - 사용자 피드백: "균형 조합에서는 대미지도 상당히
// 중요하다"는 기준에 비해 생존 쪽에 너무 치우쳐 있었음. w를 0.7로 올려 대미지 비중을 늘림
const TITAN_BALANCE_DPS_WEIGHT = 0.7;
function titanBalanceScore(dpsNorm, survivalQuality) {
  return Math.pow(dpsNorm, TITAN_BALANCE_DPS_WEIGHT) * Math.pow(survivalQuality, 1 - TITAN_BALANCE_DPS_WEIGHT);
}

// 두 후보의 관측된 사망 횟수(count, 표본수 n)가 통계적으로 구분 안 되는 동률인지 판정 - "두 후보의
// 진짜 위험률이 같다"는 가정 하에 합산 사망 횟수 중 A가 차지할 비율은 노출 비율(nA/(nA+nB))을
// 따르는 이항분포이므로, 실제 관측치가 그 기댓값의 ±2표준편차 안이면 동률로 취급함(관찰 횟수가
// 서로 다른 두 표본도 공정하게 비교 가능). 3단계 최종 승자 선정(bestSurvival)과 예비 검증 단계의
// "이 후보가 아직 1등을 이길 가능성이 있는지" 판정 둘 다 이 함수를 씀(묶음23에서 검증된 로직을
// 그대로 재사용).
function titanDeathCountsStatisticallyTied(countA, nA, countB, nB) {
  const total = countA + countB;
  if (total === 0) return true;
  const p = nA / (nA + nB);
  const sd = Math.sqrt(total * p * (1 - p));
  return Math.abs(countA - total * p) < 2 * sd;
}

const TITAN_GRADE_ORDER = ["일반", "희귀", "에픽", "유니크"];

function titanRuneSortKey(name) {
  const r = RUNES_DATA[name];
  const gradeRank = TITAN_GRADE_ORDER.indexOf(r.grade);
  const idNum = Number((r.imgId.match(/\d+/) || [0])[0]);
  return gradeRank * 10000 + idNum;
}

function titanSuitableRuneNames() {
  return Object.keys(RUNES_DATA)
    .filter((n) => !UNSUITABLE_RUNE_LIST.includes(n))
    .sort((a, b) => titanRuneSortKey(b) - titanRuneSortKey(a));
}

function defaultTitanTileSettings() {
  return { natureAdjacent: false, tribeControl: false, atkTowerLevel: null, hpTowerLevel: null };
}

function loadTitanTileSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(TITAN_TILE_KEY));
    return { ...defaultTitanTileSettings(), ...(saved || {}) };
  } catch (e) {
    return defaultTitanTileSettings();
  }
}

function saveTitanTileSettings(settings) {
  localStorage.setItem(TITAN_TILE_KEY, JSON.stringify(settings));
  if (typeof queueRemoteTitanSync === "function") queueRemoteTitanSync();
}

function loadTitanOwnedLevels() {
  const levels = {};
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(TITAN_OWNED_LEVELS_KEY)) || {};
  } catch (e) {
    saved = {};
  }
  titanSuitableRuneNames().forEach((name) => {
    const v = saved[name];
    levels[name] = Number.isInteger(v) && v >= 0 && v <= 31 ? v : 0;
  });
  return levels;
}

function saveTitanOwnedLevels(levels) {
  localStorage.setItem(TITAN_OWNED_LEVELS_KEY, JSON.stringify(levels));
  if (typeof queueRemoteTitanSync === "function") queueRemoteTitanSync();
}

function titanGetSpeedMs() {
  const saved = Number(localStorage.getItem(TITAN_SPEED_KEY));
  return BATTLE_SPEED_OPTIONS.some((o) => o.ms === saved) ? saved : 350;
}

// k개를 고르는 모든 조합(순서 무관)
function titanCombinations(arr, k) {
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

function renderTitanPage(container) {
  container.innerHTML = `
    <h2 class="sr-only">${t("titan.heading")}</h2>
    <div class="warning">${t("titan.warning")}</div>

    <div id="myDinoSection"></div>

    ${renderMetricsCard("metricsGrid", "metricDetail", [
      { id: "metricBasicDmg", key: "basicDmg", label: t("titan.metrics.basicDmg") },
      { id: "metricSkillDmg", key: "skillDmg", label: t("titan.metrics.skillDmg") },
      { id: "metricAtkAmp", key: "atkAmp", label: t("titan.metrics.atkAmp") },
      { id: "metricFinalAvgDmg", key: "finalAvgDmg", label: t("titan.metrics.finalAvgDmg") },
      { id: "metricReduction", key: "reduction", label: t("titan.metrics.reduction") },
      { id: "metricRecovery", key: "recovery", label: t("titan.metrics.recovery") },
    ])}

    <div class="card battle-main-card" id="titanMainCard">
      <div class="battle-mode-tabs titan-mode-tabs-4" id="titanModeTabs" data-active-idx="0">
        <span class="battle-mode-indicator" id="titanModeIndicator"></span>
        <button class="battle-mode-tab active" data-mode="settings" id="titanModeTabSettings"><span>${t("titan.tab.settings")}</span></button>
        <button class="battle-mode-tab" data-mode="quick" id="titanModeTabQuick"><span>${t("titan.tab.quick")}</span></button>
        <button class="battle-mode-tab" data-mode="live" id="titanModeTabLive"><span>${t("titan.tab.live")}</span></button>
        <button class="battle-mode-tab" data-mode="optimize" id="titanModeTabOptimize"><span>${t("titan.tab.optimize")}</span></button>
      </div>

      <div class="battle-mode-panel" id="titanSettingsModeCard">
        <div class="titan-settings-grid">
          <div class="titan-settings-row">
            <div class="setting-label">${t("titan.settings.natureLabel")}</div>
            <label class="switch"><input type="checkbox" id="titanNatureToggle"><span class="slider round"></span></label>
          </div>
          <div class="titan-settings-row">
            <div class="setting-label">${t("titan.settings.tribeLabel")}</div>
            <label class="switch"><input type="checkbox" id="titanTribeToggle"><span class="slider round"></span></label>
          </div>
          <!-- 모바일에서는 라벨 옆에 드롭다운/입력칸을 붙이면 폭이 부족해 화살표·단위 텍스트가
               목록/입력값과 겹쳤음. 전부 "라벨 위 / 조작요소 아래" 스택으로 재배치:
               (공격력·체력 버프 타워) / (타이탄 레벨 단독) / (전투 제한시간·타이탄 거리) -->
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">${t("titan.settings.atkTowerLabel")}</label>
              <div class="custom-dropdown" id="titanAtkTowerDropdown">
                <div class="selected-value" id="titanAtkTowerSelectedValue">${t("common.optionNone")}</div>
                <ul class="dropdown-list" id="titanAtkTowerList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">${t("titan.settings.hpTowerLabel")}</label>
              <div class="custom-dropdown" id="titanHpTowerDropdown">
                <div class="selected-value" id="titanHpTowerSelectedValue">${t("common.optionNone")}</div>
                <ul class="dropdown-list" id="titanHpTowerList"></ul>
              </div>
            </div>
          </div>
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">${t("titan.settings.serverLevelCapLabel")}</label>
              <div class="custom-dropdown" id="titanServerLevelCapDropdown">
                <div class="selected-value" id="titanServerLevelCapSelectedValue">${t("common.optionNone")}</div>
                <ul class="dropdown-list" id="titanServerLevelCapList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">${t("titan.settings.constellationCapLabel")}</label>
              <div class="custom-dropdown" id="titanConstellationCapDropdown">
                <div class="selected-value" id="titanConstellationCapSelectedValue">${t("common.optionNone")}</div>
                <ul class="dropdown-list" id="titanConstellationCapList"></ul>
              </div>
            </div>
          </div>
          <div class="titan-settings-stack titan-settings-fullstack">
            <label class="setting-label">${t("titan.settings.titanLevelLabel")}</label>
            <div class="custom-dropdown" id="titanDropdown">
              <div class="selected-value" id="titanSelectedValue">Lv.1</div>
              <ul class="dropdown-list" id="titanList"></ul>
            </div>
          </div>
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">${t("titan.settings.timeLimitLabel")}</label>
              <div class="custom-dropdown" id="timeDropdown">
                <div class="selected-value" id="timeSelectedValue">${t("titan.settings.defaultTimeLimit")}</div>
                <ul class="dropdown-list" id="timeList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">${t("titan.settings.distanceLabel")}</label>
              <div class="affix-input has-suffix"><input type="tel" id="fDistance" value="1"><span class="affix-suffix">${t("titan.settings.distanceUnit")}</span></div>
            </div>
          </div>
          <!-- 연속 전투는 짝이 없어져서 혼자 전체 폭을 차지하되, 토글이라 왼쪽이 허전해 보이지
               않도록 라벨+버튼 전체를 오른쪽으로 붙임 -->
          <div class="titan-settings-row titan-settings-row-full titan-settings-row-end">
            <div class="setting-label">${t("titan.settings.continuousBattleLabel")}</div>
            <label class="switch"><input type="checkbox" id="continuousToggle"><span class="slider round"></span></label>
          </div>
        </div>
      </div>

      <div class="battle-mode-panel" id="titanQuickModeCard" style="display:none;">
        <div class="titan-quick-summary" id="titanQuickSummary"></div>
        <button class="btn-simulate" id="titanQcBtn">${t("titan.quick.calcBtn")}</button>
        <div id="battleReport" class="report-box" style="display:none;">
          <div class="report-grid">
            <div class="report-tile"><div class="metric-label">${t("titan.quick.report.totalDmg")}</div><div class="metric-value accent" id="repTotalDmg">0</div></div>
            <div class="report-tile"><div class="metric-label">${t("titan.quick.report.remainingTitanHp")}</div><div class="metric-value accent" id="repTitanHp">0</div></div>
            <div class="report-tile"><div class="metric-label">${t("titan.quick.report.avgSurvivalTime")}</div><div class="metric-value" id="repTime">0</div></div>
            <div class="report-tile"><div class="metric-label">${t("titan.quick.report.avgDeadCount")}</div><div class="metric-value" id="repDead">0</div></div>
          </div>
          <div class="report-chart-section">
            <div class="report-chart-label">${t("titan.quick.report.chartLabel")}</div>
            <div class="report-chart-box">
              <canvas id="hpChart"></canvas>
            </div>
            <div id="avgMinHpPer" class="report-survival">${t("titan.quick.report.avgSurvivalHpLabel", { percent: 0 })}</div>
          </div>
        </div>
      </div>

      <div class="battle-mode-panel" id="titanOptimizeModeCard" style="display:none;">
        <div class="dummy-optimizer">
          <h3 class="dummy-optimizer-title">${t("titan.optimize.title")}</h3>
          <p class="quickcalc-desc">${t("titan.optimize.desc")}</p>
          <div class="titan-quick-summary" id="titanOptimizeQuickSummary"></div>
          <div class="titan-owned-rune-header">
            <span class="titan-owned-rune-header-label">${t("titan.optimize.ownedRuneHeaderLabel")}</span>
            <button type="button" class="titan-owned-rune-collapse-btn" id="titanOwnedRuneCollapseBtn" aria-expanded="true" title="${t("titan.optimize.collapseTooltip")}">
              <span class="titan-owned-rune-collapse-icon">▲</span>
            </button>
          </div>
          <div class="dummy-owned-rune-grid" id="titanOwnedRuneGrid"></div>
          <button class="btn-simulate" id="titanOptimizeBtn">${t("titan.optimize.startBtn")}</button>
          <div id="titanOptimizeResult"></div>
        </div>
      </div>

      <div class="battle-mode-panel" id="titanLiveModeCard" style="display:none;">
        <!-- 바닥(육각형 2개)은 Three.js(js/core/hex-scene3d.js)가 그리는 진짜 WebGL 3D - CSS
             rotateX+perspective 가짜 3D를 쓰다가 이번 세션에서 여러 렌더링 버그(perspective 체인이
             중간 래퍼에서 끊기는 버그 등)를 겪은 뒤 사용자 확정으로 전면 교체함. 공룡/타이탄
             아바타는 여전히 평범한 2D DOM(체력바/이름표/피격 흔들림 로직 전부 그대로) - 위치만
             titanPositionMyAvatars()/titanPositionBoss()가 hexScene.projectToScreen()으로
             계산해서 left/top에 심음 -->
        <div class="titan-duel-wrap">
          <div class="titan-hex-hpbar-list" id="titanMyHpBars"></div>

          <div class="dummy-field-wrap titan-duel-field">
            <!-- stage 하나가 곧 결합 좌표계(175x129.9) - 바닥(Three.js canvas)과 아바타 오버레이
                 (평면, 좌표 계산만 적용)가 정확히 같은 박스를 공유해서 패딩 등으로 인한 어긋남이
                 없음 -->
            <div class="titan-duel-stage" id="titanDuelStage">
              <div class="titan-duel-tilt" id="titanDuelFloorMount"></div>

              <div class="titan-formation-group" id="titanMyTarget">
                <div class="titan-hex-billboard-slot" id="titanMySlot0"><div class="titan-hex-avatar titan-hex-avatar-mine titan-hex-avatar-slot0" data-slot="0"><div class="titan-hex-avatar-hpbar"><div class="titan-hex-avatar-hpfill titan-hex-hpfill-mine"></div></div><div class="titan-hex-avatar-ball"></div><div class="titan-hex-avatar-name"></div></div></div>
                <div class="titan-hex-billboard-slot" id="titanMySlot1"><div class="titan-hex-avatar titan-hex-avatar-mine titan-hex-avatar-slot1" data-slot="1"><div class="titan-hex-avatar-hpbar"><div class="titan-hex-avatar-hpfill titan-hex-hpfill-mine"></div></div><div class="titan-hex-avatar-ball"></div><div class="titan-hex-avatar-name"></div></div></div>
                <div class="titan-hex-billboard-slot" id="titanMySlot2"><div class="titan-hex-avatar titan-hex-avatar-mine titan-hex-avatar-slot2" data-slot="2"><div class="titan-hex-avatar-hpbar"><div class="titan-hex-avatar-hpfill titan-hex-hpfill-mine"></div></div><div class="titan-hex-avatar-ball"></div><div class="titan-hex-avatar-name"></div></div></div>
                <div class="titan-hex-anchor-popup-layer" id="titanMyPopupLayer"></div>
              </div>
              <div class="titan-formation-group" id="titanBossTarget">
                <div class="titan-hex-billboard-slot" id="titanBossSlot0">
                  <div class="titan-hex-avatar titan-hex-avatar-boss">
                    <div class="titan-hex-avatar-ball"></div>
                    <div class="titan-hex-avatar-hp-text" id="titanBossHpText"></div>
                    <div class="titan-hex-avatar-hpbar titan-hex-avatar-hpbar-boss">
                      <div class="titan-hex-avatar-hpfill titan-hex-hpfill-boss" id="titanBossHpFill"></div>
                    </div>
                    <!-- 내 공룡 쪽엔 이미 닉네임 이름표(.titan-hex-avatar-name)가 있는데 타이탄만
                         없어서 사용자 지적("공룡 밑에 닉네임 있는 것처럼 타이탄도") - 닉네임처럼
                         매번 바뀌는 값이 아니라 고정 문구라 my-dino와 달리 JS로 채울 필요 없이
                         템플릿에 바로 텍스트를 심음. DOM 순서(hpbar -> ball -> hp-text -> name)는
                         그대로 두고 이름표만 맨 끝에 추가 - 다른 자식들처럼 order를 따로 안 줬으니
                         기본값(0)이라 자연스럽게 가장 아래(발밑)에 옴(내 공룡과 동일한 규칙) -->
                    <div class="titan-hex-avatar-name titan-hex-avatar-name-boss">${t("titan.heading")}</div>
                  </div>
                </div>
                <div class="titan-hex-anchor-popup-layer" id="titanBossPopupLayer"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="battle-controls">
          <div class="custom-dropdown battle-speed-dropdown" id="titanSpeedDropdown">
            <div class="selected-value" id="titanSpeedSelectedValue">${t("titan.live.speedNormal")}</div>
            <ul class="dropdown-list" id="titanSpeedList"></ul>
          </div>
          <button class="btn-simulate" id="titanLiveStartBtn">${t("titan.live.startBtnIdle")}</button>
          <button class="battle-restart-btn" id="titanLiveRestartBtn" disabled title="${t("titan.live.restartTooltip")}">↻</button>
        </div>

        <div class="report-grid titan-live-stats" id="titanLiveStats" style="display:none;">
          <div class="report-tile"><div class="metric-label">${t("titan.live.stats.cumulativeDmg")}</div><div class="metric-value accent" id="titanLiveDmg">0</div></div>
          <div class="report-tile"><div class="metric-label">${t("titan.live.stats.currentDps")}</div><div class="metric-value" id="titanLiveDps">0</div></div>
          <div class="report-tile"><div class="metric-label">${t("titan.live.stats.deadDinoCount")}</div><div class="metric-value" id="titanLiveDead">${t("titan.live.deadCountValue", { count: 0 })}</div></div>
          <div class="report-tile"><div class="metric-label">${t("titan.live.stats.elapsedSurvivalTime")}</div><div class="metric-value" id="titanLiveSurvival">${t("titan.live.elapsedSecValue", { sec: 0 })}</div></div>
        </div>
      </div>
    </div>

    <div class="friend-picker-overlay" id="titanApplyPresetOverlay" style="display:none;">
      <div class="friend-picker-modal">
        <div class="friend-picker-header">
          <span>${t("titan.applyPreset.modalTitle")}</span>
          <button class="close-btn" id="titanApplyPresetClose">✕</button>
        </div>
        <div class="arena-preset-row" id="titanApplyPresetList"></div>
        <button class="btn-apply" id="titanApplyPresetConfirmBtn" disabled>${t("titan.applyPreset.confirmBtn")}</button>
      </div>
    </div>
  `;

  initTitanPage();
}

// 파일 최상단(initTitanPage 밖) - 라우터가 #titan을 방문할 때마다 renderTitanPage가
// initTitanPage()를 처음부터 다시 실행하므로(js/router.js, "이미 이 페이지에 있으면 스킵" 같은
// 로직 없음 - 확인함) initTitanPage() 안에 있는 지역 변수는 방문마다 전부 새로 만들어짐. 이
// 핸들러 참조는 그 클로저 밖(진짜 모듈 스코프)에 둬야, 다음 방문에서 이전 방문이 등록한 리스너를
// 정확히 지목해서 지울 수 있음(사용자 지적 - "theme-changed 리스너가 페이지를 오갈 때마다 계속
// 쌓임" - 클로저 안에 두면 매번 새 함수 객체라 removeEventListener가 무효함, 실측/코드 검증 완료)
let titanThemeChangeHandler = null;
// 재생 중(setInterval)에 다른 페이지로 이동해도 안 멈추고 계속 titanReplayTick을 불러서 이미
// 사라진 DOM을 건드리다 콘솔 에러가 나던 걸 막는 hashchange 리스너도 위 titanThemeChangeHandler와
// 똑같은 이유로 진짜 모듈 스코프에 둬야 함 - 예전엔 initTitanPage() 안에서 매 방문마다 재등록돼서
// 방문할 때마다 리스너가 하나씩 계속 쌓이고 있었음(사이트 전체 점검에서 발견, theme-changed
// 리스너는 이미 고쳤었는데 이 리스너는 그때 안 건드려서 빠져있었음)
let titanHashChangeHandler = null;

function initTitanPage() {
  let lastMetrics = null;
  let activeMetricKey = null;
  let applyPresetPendingRunes = null; // 조합 찾기 결과에서 클릭한 조합의 {name, lv} 배열 - 모달 확인 시 이걸 프리셋에 씀
  let applyPresetSelectedIdx = null;

  function titanOpenApplyPresetModal(runes) {
    applyPresetPendingRunes = runes;
    applyPresetSelectedIdx = null;
    titanRenderApplyPresetList();
    document.getElementById("titanApplyPresetConfirmBtn").disabled = true;
    document.getElementById("titanApplyPresetOverlay").style.display = "flex";
  }

  function titanRenderApplyPresetList() {
    const row = document.getElementById("titanApplyPresetList");
    const profile = loadMyDinoProfile();
    row.innerHTML = "";
    profile.runePresets.forEach((preset, idx) => {
      const btn = document.createElement("div");
      btn.className = "arena-preset-btn" + (idx === applyPresetSelectedIdx ? " active" : "");
      btn.textContent = runePresetDisplayName(preset, idx);
      btn.onclick = () => {
        applyPresetSelectedIdx = idx;
        titanRenderApplyPresetList();
        document.getElementById("titanApplyPresetConfirmBtn").disabled = false;
      };
      row.appendChild(btn);
    });
  }

  function titanCloseApplyPresetModal() {
    document.getElementById("titanApplyPresetOverlay").style.display = "none";
    applyPresetPendingRunes = null;
    applyPresetSelectedIdx = null;
  }

  function titanConfirmApplyPreset() {
    if (applyPresetSelectedIdx === null || !applyPresetPendingRunes) return;
    const idx = applyPresetSelectedIdx;
    const runes = applyPresetPendingRunes.map((r) => ({ ...r }));
    const profile = loadMyDinoProfile();
    profile.runePresets[idx].runes = runes;
    profile.activePresetIndex = idx;
    profile.runes = runes.map((r) => ({ ...r }));
    saveMyDinoProfile(profile);
    const presetName = runePresetDisplayName(profile.runePresets[idx], idx);
    titanCloseApplyPresetModal();
    titanRenderMyDinoSection();
    refreshMetricsCard();
    titanResetAllCalc();
    showToast(t("titan.applyPreset.toastAppliedTo", { presetName }));
  }

  function titanRenderMyDinoSection() {
    renderMyDinoPage(document.getElementById("myDinoSection"), {
      unsuitableList: UNSUITABLE_RUNE_LIST,
      unsuitableLabel: t("titan.unsuitableRuneLabel"),
      onChange: () => { refreshMetricsCard(); titanResetAllCalc(); }
    });
  }
  titanRenderMyDinoSection();

  function initMetricsCard() {
    document.querySelectorAll(".metric-tile").forEach((tile) => {
      tile.onclick = () => {
        const key = tile.dataset.metric;
        activeMetricKey = activeMetricKey === key ? null : key;
        document.querySelectorAll(".metric-tile").forEach((tileEl) => tileEl.classList.toggle("active", tileEl.dataset.metric === activeMetricKey));
        renderMetricDetail();
      };
    });
  }

  // 기본값에서 바뀐 값 강조(.value-changed)는 타이탄만 쓰던 기존 동작이라 그대로 유지하고, 실제
  // 표시/롤링 모션은 공용 함수(js/ui/stat-roll-ui.js, 건물 페이지가 먼저 쓰던 것과 동일)에 위임
  // (사용자 지적 - "모든 페이지의 관련 수치에 모션을 넣어줘")
  function setMetricTile(id, value) {
    document.getElementById(id).classList.toggle("value-changed", Math.round(value) !== 0);
    setMetricTileValue(id, value);
  }

  function refreshMetricsCard() {
    const dino = titanDinoInputs();
    const tileCfg = loadTitanTileSettings();
    lastMetrics = getTitanCombatMetrics(dino, tileCfg);
    const finalAvgDmg = lastMetrics.avgHitDamage + lastMetrics.skillDmgTotal;
    setMetricTile("metricBasicDmg", lastMetrics.avgHitDamage);
    setMetricTile("metricSkillDmg", lastMetrics.skillDmgTotal);
    setMetricTile("metricAtkAmp", lastMetrics.atkAmpGain);
    setMetricTile("metricFinalAvgDmg", finalAvgDmg);
    setMetricTile("metricReduction", lastMetrics.reductionTotal);
    setMetricTile("metricRecovery", lastMetrics.recoveryTotal);
    renderMetricDetail();
  }

  function renderMetricDetail() {
    const box = document.getElementById("metricDetail");
    if (!activeMetricKey || !lastMetrics) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }
    const m = lastMetrics;
    let title = "";
    let rows = [];

    // 크리티컬 대미지(치확/치피를 평균으로 섞지 않고, 크리티컬이 "떴을 때" 그대로 들어가는 값) -
    // 평타는 여기서 바로 계산(getTitanCombatMetrics가 안 돌려주는 값이라), 스킬은 발동 확률까지
    // 얽혀있어서 같은 개념을 getTitanCombatMetrics 쪽(skillDetails.critDmg)에서 미리 계산해둠
    const critDmgOf = (baseAmount) => baseAmount * (m.cDmg / 100);

    if (activeMetricKey === "basicDmg") {
      title = t("titan.detail.basicDmgTitle");
      // 치명타 확률/피해 수치는 빼고, 증폭 후 공격력에 실제 크리티컬이 떴을 때의 대미지를 보여줌
      // (사용자 확정 - "치명타 확률, 피해 수치를 빼고 증폭 후 크리티컬 대미지 추가하기")
      rows = [
        { label: t("titan.detail.originalAtkLabel"), value: Math.round(m.finalAtk).toLocaleString() },
        { label: t("titan.detail.ampAtkLabel"), value: Math.round(m.ampFinalAtk).toLocaleString() },
        { label: t("titan.detail.ampCritDmgLabel"), value: Math.round(critDmgOf(m.ampFinalAtk)).toLocaleString() }
      ];
    } else if (activeMetricKey === "atkAmp") {
      title = t("titan.detail.atkAmpTitle");
      if (m.bossSlayerPercent > 0) {
        rows = [{ label: t("titan.detail.bossSlayerLabel", { percent: m.bossSlayerPercent.toFixed(2) }), value: `+${Math.round(m.atkAmpGain).toLocaleString()}` }];
      }
    } else if (activeMetricKey === "skillDmg") {
      title = t("titan.detail.skillDmgTitle");
      // 사용자 확정 - "원래 대미지 적고... 평균 대미지로 변경(즉 서로 위치 교환) 그리고 그 밑에
      // 크리티컬 대미지 추가" - 메인 값은 원래 대미지(발동 확률은 안 곱했지만 치확/치피 평균은
      // 반영된 값), 그 아래 평균 대미지(발동 확률까지 반영)와 크리티컬 대미지(치확/치피 평균 대신
      // 크리티컬 확정으로 가정한 값) 두 줄
      rows = m.skillDetails.map((d) => ({
        label: d.prob !== undefined ? t("titan.detail.skillProbLabel", { name: ruleDisplayName(d.name), prob: d.prob }) : t("titan.detail.skillFixedLabel", { name: ruleDisplayName(d.name) }),
        value: Math.round(d.rawDmg).toLocaleString(),
        subs: [
          t("titan.detail.avgDmgSub", { value: Math.round(d.avgDmg).toLocaleString() }),
          t("titan.detail.critDmgSub", { value: Math.round(d.critDmg).toLocaleString() })
        ]
      }));
    } else if (activeMetricKey === "finalAvgDmg") {
      title = t("titan.detail.finalAvgDmgTitle");
      rows = [
        { label: t("titan.detail.basicDmgLabel"), value: Math.round(m.avgHitDamage).toLocaleString() },
        { label: t("titan.detail.skillDmgTotalLabel"), value: Math.round(m.skillDmgTotal).toLocaleString() }
      ];
    } else if (activeMetricKey === "reduction") {
      title = t("titan.detail.reductionTitle");
      // 사용자 확정 - "원래 감소량을 적고 그 밑에... 평균 감소량"(메인/서브 위치 교환)
      rows = m.reductions.map((r) => {
        if (r.type === "shield") {
          return { label: t("titan.detail.shieldReductionLabel", { name: ruleDisplayName(r.name), turn: r.turn, percent: r.red_p }), value: "-" };
        }
        if (r.type === "prob") {
          return {
            label: t("titan.detail.probReductionLabel", { name: ruleDisplayName(r.name), prob: r.prob }),
            value: Math.round(r.value).toLocaleString(),
            subs: [t("titan.detail.avgReductionSub", { value: Math.round(r.avg).toLocaleString() })]
          };
        }
        return { label: ruleDisplayName(r.name), value: Math.round(r.avg).toLocaleString() };
      });
    } else if (activeMetricKey === "recovery") {
      title = t("titan.detail.recoveryTitle");
      // 사용자 확정 - "원래 회복량을 적고 그 밑에... 평균 회복량"(메인/서브 위치 교환)
      rows = m.recoveries.map((r) => ({
        label: t("titan.detail.recoveryProbLabel", { name: ruleDisplayName(r.name), prob: r.prob }),
        value: Math.round(r.rawAmount).toLocaleString(),
        subs: [t("titan.detail.avgRecoverySub", { value: Math.round(r.avg).toLocaleString() })]
      }));
    }

    if (rows.length === 0) {
      box.innerHTML = `<div class="metric-detail-title">${title}</div><div class="metric-detail-empty">${t("titan.detail.emptyMsg")}</div>`;
    } else {
      box.innerHTML = `<div class="metric-detail-title">${title}</div>${rows
        .map((r) => `<div class="metric-detail-row"><div class="metric-detail-row-main"><span>${r.label}</span><span>${r.value}</span></div>${(r.subs || []).map((s) => `<div class="metric-detail-row-sub">${s}</div>`).join("")}</div>`)
        .join("")}`;
    }
    box.style.display = "block";
  }

  initMetricsCard();
  refreshMetricsCard();

  // ===== 전투 설정: 타일(자연/부족/버프타워) =====
  function titanInitTileSettings() {
    const settings = loadTitanTileSettings();
    const onTileChange = () => { refreshMetricsCard(); titanResetAllCalc(); };

    const natureToggle = document.getElementById("titanNatureToggle");
    natureToggle.checked = settings.natureAdjacent;
    natureToggle.onchange = () => {
      settings.natureAdjacent = natureToggle.checked;
      saveTitanTileSettings(settings);
      onTileChange();
    };

    const tribeToggle = document.getElementById("titanTribeToggle");
    tribeToggle.checked = settings.tribeControl;
    tribeToggle.onchange = () => {
      settings.tribeControl = tribeToggle.checked;
      saveTitanTileSettings(settings);
      onTileChange();
    };

    const initTowerDropdown = (listId, valueId, key) => {
      const list = document.getElementById(listId);
      const selectedValue = document.getElementById(valueId);
      const labelFor = (v) => sharedOptionLabel(BUFF_TOWER_OPTIONS.find((o) => o.value === v).label);
      selectedValue.textContent = labelFor(settings[key]);
      BUFF_TOWER_OPTIONS.forEach((opt) => {
        const li = document.createElement("li");
        li.textContent = sharedOptionLabel(opt.label);
        li.onclick = () => {
          settings[key] = opt.value;
          selectedValue.textContent = sharedOptionLabel(opt.label);
          list.style.display = "none";
          saveTitanTileSettings(settings);
          onTileChange();
        };
        list.appendChild(li);
      });
      selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
    };
    initTowerDropdown("titanAtkTowerList", "titanAtkTowerSelectedValue", "atkTowerLevel");
    initTowerDropdown("titanHpTowerList", "titanHpTowerSelectedValue", "hpTowerLevel");

    // 서버 레벨캡 - 4개 페이지가 공유하는 전역 설정이라 titanTileSettings가 아니라 별도
    // localStorage 키(loadServerLevelCap/saveServerLevelCap, my-dino-page.js)를 직접 읽고 씀
    const capLabelFor = (v) => sharedOptionLabel(SERVER_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label);
    const capList = document.getElementById("titanServerLevelCapList");
    const capSelectedValue = document.getElementById("titanServerLevelCapSelectedValue");
    capSelectedValue.textContent = capLabelFor(loadServerLevelCap());
    SERVER_LEVEL_CAP_OPTIONS.forEach((opt) => {
      const li = document.createElement("li");
      li.textContent = sharedOptionLabel(opt.label);
      li.onclick = () => {
        saveServerLevelCap(opt.value);
        capSelectedValue.textContent = sharedOptionLabel(opt.label);
        capList.style.display = "none";
        onTileChange();
      };
      capList.appendChild(li);
    });
    capSelectedValue.onclick = () => toggleDropdownList(capSelectedValue, capList);

    // 별자리 레벨캡 - 서버 레벨캡과 마찬가지로 전역 공유 설정
    const constLabelFor = (v) => sharedOptionLabel(CONSTELLATION_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label);
    const constList = document.getElementById("titanConstellationCapList");
    const constSelectedValue = document.getElementById("titanConstellationCapSelectedValue");
    constSelectedValue.textContent = constLabelFor(loadConstellationLevelCap());
    CONSTELLATION_LEVEL_CAP_OPTIONS.forEach((opt) => {
      const li = document.createElement("li");
      li.textContent = sharedOptionLabel(opt.label);
      li.onclick = () => {
        saveConstellationLevelCap(opt.value);
        constSelectedValue.textContent = sharedOptionLabel(opt.label);
        constList.style.display = "none";
        onTileChange();
      };
      constList.appendChild(li);
    });
    constSelectedValue.onclick = () => toggleDropdownList(constSelectedValue, constList);
  }
  titanInitTileSettings();

  // 타이탄 레벨 커스텀 드롭다운
  const titanList = document.getElementById("titanList");
  const titanSelectedValue = document.getElementById("titanSelectedValue");
  let titanLevel = 1;
  for (let lv = 1; lv <= 150; lv++) {
    const { atk, hp } = TITAN_STATS[lv];
    const li = document.createElement("li");
    const label = t("titan.levelOptionLabel", { level: lv, atk, hp: hp.toLocaleString() });
    li.textContent = label;
    li.onclick = () => {
      titanSelectedValue.textContent = label;
      titanLevel = lv;
      titanList.style.display = "none";
      saveConfig();
      titanResetAllCalc();
    };
    titanList.appendChild(li);
  }
  titanSelectedValue.onclick = () => toggleDropdownList(titanSelectedValue, titanList);

  // 전투 제한 시간 커스텀 드롭다운
  const timeList = document.getElementById("timeList");
  const timeSelectedValue = document.getElementById("timeSelectedValue");
  let timeLimitMinutes = 90;
  for (let m = 10; m <= 120; m += 10) {
    const li = document.createElement("li");
    li.textContent = t("titan.timeOptionLabel", { minutes: m });
    li.onclick = () => {
      timeSelectedValue.textContent = t("titan.timeOptionLabel", { minutes: m });
      timeLimitMinutes = m;
      timeList.style.display = "none";
      saveConfig();
      titanResetAllCalc();
    };
    timeList.appendChild(li);
  }
  timeSelectedValue.onclick = () => toggleDropdownList(timeSelectedValue, timeList);

  // 드롭다운 바깥 클릭 시 닫기는 my-dino-page.js가 이미 전역으로 한 번만 등록해둠(window.
  // __dinoDropdownCloseHandlerBound 가드, 같은 .custom-dropdown/.dropdown-list 클래스를 그대로
  // 씀 - renderMyDinoPage가 항상 이 페이지보다 먼저 호출돼서 이미 등록돼있음) - 여기서 또
  // document.addEventListener("click", ...)를 매 방문마다 새로 등록하던 중복 리스너를 제거함
  // (사이트 전체 점검에서 발견, 사용자 확정)

  // 타이탄과의 거리 / 연속 전투
  const fDistance = document.getElementById("fDistance");
  const continuousToggle = document.getElementById("continuousToggle");
  let distanceTiles = 1;
  let continuousBattle = false;

  fDistance.onfocus = () => { if (fDistance.value === "1") fDistance.value = ""; };
  fDistance.oninput = () => { fDistance.value = fDistance.value.replace(/[^0-9]/g, ""); };
  fDistance.onblur = () => {
    distanceTiles = Math.max(1, Number(fDistance.value) || 1);
    fDistance.value = distanceTiles;
    saveConfig();
    titanResetAllCalc();
  };
  // 엔터 키로도 커밋되게(예전엔 마우스로 다른 빈 공간을 눌러 포커스를 잃어야만 반영됐음 -
  // 사용자 지적) - blur()를 호출하면 위 onblur 핸들러가 그대로 실행됨
  fDistance.onkeydown = (e) => { if (e.key === "Enter") fDistance.blur(); };
  continuousToggle.onchange = () => {
    continuousBattle = continuousToggle.checked;
    saveConfig();
    titanResetAllCalc();
  };

  function saveConfig() {
    localStorage.setItem(TITAN_CONFIG_KEY, JSON.stringify({ titanLevel, timeLimitMinutes, distanceTiles, continuousBattle }));
    if (typeof queueRemoteTitanSync === "function") queueRemoteTitanSync();
  }

  function loadConfig() {
    const saved = localStorage.getItem(TITAN_CONFIG_KEY);
    if (!saved) return;
    const cfg = JSON.parse(saved);
    titanLevel = cfg.titanLevel || 1;
    const stats = TITAN_STATS[titanLevel];
    titanSelectedValue.textContent = t("titan.levelOptionLabel", { level: titanLevel, atk: stats.atk, hp: stats.hp.toLocaleString() });
    timeLimitMinutes = cfg.timeLimitMinutes || 90;
    timeSelectedValue.textContent = t("titan.timeOptionLabel", { minutes: timeLimitMinutes });
    distanceTiles = Math.max(1, cfg.distanceTiles || 1);
    fDistance.value = distanceTiles;
    continuousBattle = cfg.continuousBattle || false;
    continuousToggle.checked = continuousBattle;
  }
  loadConfig();

  // 지금 설정을 runTitanSimulation cfg 형태로 모아주는 헬퍼(빠른 계산/실전 시뮬레이션/조합 찾기가 공통으로 씀)
  function buildSimBaseCfg(selectedRunesOverride) {
    const dino = titanDinoInputs();
    const tileCfg = loadTitanTileSettings();
    return {
      baseAtk: dino.baseAtk,
      baseHp: dino.baseHp,
      maxDino: dino.count,
      targetTitan: TITAN_STATS[titanLevel],
      selectedRunes: selectedRunesOverride || dino.selectedRunes,
      constellation: dino.constellation,
      bonusPercent: dino.bonusPercent,
      moveSpeed: dino.moveSpeed,
      distanceTiles,
      continuousBattle,
      timeLimitMinutes,
      atkTowerLevel: tileCfg.atkTowerLevel,
      hpTowerLevel: tileCfg.hpTowerLevel,
      natureAdjacent: tileCfg.natureAdjacent,
      tribeControl: tileCfg.tribeControl
    };
  }

  // ===== 모드 탭(전투 설정 / 빠른 계산 / 실전 시뮬레이션 / 조합 찾기) - 4개 폭을 정확히 4등분으로
  // 맞춰서, 슬라이딩 인디케이터도 JS로 픽셀을 재는 대신 CSS 퍼센트 + data-active-idx 속성으로 처리함
  // (탭 폭이 반응형으로 줄어도 %는 항상 같이 줄어드니 좁아질 때 옆 탭을 침범하는 문제가 없음) =====
  const TITAN_MODES = [
    { mode: "settings", tabId: "titanModeTabSettings", cardId: "titanSettingsModeCard" },
    { mode: "quick", tabId: "titanModeTabQuick", cardId: "titanQuickModeCard" },
    { mode: "live", tabId: "titanModeTabLive", cardId: "titanLiveModeCard" },
    { mode: "optimize", tabId: "titanModeTabOptimize", cardId: "titanOptimizeModeCard" }
  ];

  function titanInitModeTabs() {
    const tabsEl = document.getElementById("titanModeTabs");
    TITAN_MODES.forEach((m, idx) => {
      document.getElementById(m.tabId).onclick = () => {
        tabsEl.dataset.activeIdx = String(idx);
        TITAN_MODES.forEach((other) => {
          const tabBtn = document.getElementById(other.tabId);
          tabBtn.classList.toggle("active", other.mode === m.mode);
          document.getElementById(other.cardId).style.display = other.mode === m.mode ? "block" : "none";
        });
        if (m.mode === "quick") titanRenderQuickSummary();
        // 실전 시뮬레이션 탭이 재생 중일 때 다른 탭(전투 설정 등)으로 넘어가면 화면엔 안 보이는
        // 채로 계속 재생되고 있었음(다음 틱 팝업이 안 보이는 곳에서 계속 쌓이는 등) - 탭을 벗어나면
        // 자동으로 멈추고 처음 상태로 되돌림
        if (m.mode !== "live" && titanReplayRunning) titanLiveReset();
        // "live" 탭은 기본 display:none으로 시작해서(기본 활성 탭은 "설정") 페이지 로드 시점엔
        // 캔버스가 0x0임(실측 확인) - 이 탭을 처음 열 때 Three.js 씬을 마운트/리사이즈함
        if (m.mode === "live") titanInitScene3d();
      };
    });
    document.getElementById("titanQcBtn").onclick = titanRunQuickCalc;
    document.getElementById("titanOptimizeBtn").onclick = titanRunOptimizer;
    // 보유 룬 레벨 입력 목록 접기/펼치기 - 룬 종류가 많아(적합 룬 전부) 목록이 길어서, 레벨을 이미
    // 입력해둔 뒤엔 접어서 결과 쪽으로 화면을 아낄 수 있게 함
    document.getElementById("titanOwnedRuneCollapseBtn").onclick = () => {
      const grid = document.getElementById("titanOwnedRuneGrid");
      const btn = document.getElementById("titanOwnedRuneCollapseBtn");
      const collapsed = grid.classList.toggle("titan-owned-rune-grid-collapsed");
      btn.setAttribute("aria-expanded", String(!collapsed));
      btn.querySelector(".titan-owned-rune-collapse-icon").textContent = collapsed ? "▼" : "▲";
    };
  }

  // ===== 빠른 계산 =====
  function titanRenderQuickSummary() {
    const tileCfg = loadTitanTileSettings();
    const atkLabel = tileCfg.atkTowerLevel !== null ? `+${BUFF_TOWER_PERCENTS[tileCfg.atkTowerLevel]}%` : t("common.optionNone");
    const hpLabel = tileCfg.hpTowerLevel !== null ? `+${BUFF_TOWER_PERCENTS[tileCfg.hpTowerLevel]}%` : t("common.optionNone");
    const stats = TITAN_STATS[titanLevel];
    // 진짜 2열 grid + 실선 구분(칸마다 border) - 가짜 중앙선(::before)은 4열 grid의 실제 폭이
    // 항상 정확히 반반은 아니라서 어긋나 보일 수 있어 대신 이 방식으로 확실하게 좌우를 나눔
    const buildHtml = (continuousLabel) => `
      <div class="titan-quick-summary-grid">
        <div class="titan-quick-summary-col">
          <div class="titan-quick-summary-item"><span>${t("titan.settings.atkTowerLabel")}</span><b>${atkLabel}</b></div>
          <div class="titan-quick-summary-item"><span>${t("titan.heading")}</span><b>Lv.${titanLevel} (HP ${stats.hp.toLocaleString()})</b></div>
          <div class="titan-quick-summary-item"><span>${t("titan.settings.distanceLabel")}</span><b>${t("titan.settings.distanceValue", { count: distanceTiles })}</b></div>
        </div>
        <div class="titan-quick-summary-col">
          <div class="titan-quick-summary-item"><span>${t("titan.settings.hpTowerLabel")}</span><b>${hpLabel}</b></div>
          <div class="titan-quick-summary-item"><span>${t("titan.settings.timeLimitLabel")}</span><b>${t("titan.timeOptionLabel", { minutes: timeLimitMinutes })}</b></div>
          <div class="titan-quick-summary-item"><span>${t("titan.settings.continuousBattleLabel")}</span><b>${continuousLabel}</b></div>
        </div>
      </div>
    `;
    const quickEl = document.getElementById("titanQuickSummary");
    if (quickEl) quickEl.innerHTML = buildHtml(continuousBattle ? "ON" : "OFF");
    // 조합 찾기는 전역 설정과 무관하게 항상 연속 전투 기준으로 계산하므로(아래
    // titanRunOptimizer 참고), 여기 요약표는 실제 토글 값 대신 그 사실을 그대로 보여줌 -
    // 안 그러면 토글이 꺼져 있을 때 "OFF"라고 표시되면서 실제 계산 기준과 달라 보임
    const optimizeEl = document.getElementById("titanOptimizeQuickSummary");
    if (optimizeEl) optimizeEl.innerHTML = buildHtml(`ON (${t("titan.optimize.fixedContinuousNote")})`);
  }

  // 빠른 계산 = 원래 이 페이지에 있던 통계 시뮬레이션(500회 평균 + 체력 추이 그래프 + 로그 다운로드)
  // 그대로. "빠른"인 이유는 실시간으로 지켜볼 필요 없이 결과(숫자·그래프)만 바로 받아본다는 의미
  async function titanRunQuickCalc() {
    const btn = document.getElementById("titanQcBtn");
    btn.disabled = true;
    btn.classList.add("btn-progress");
    btn.style.setProperty("--progress", "0");
    const cfg = {
      ...buildSimBaseCfg(), iterations: 500, collectLog: AppSettings.isLogEnabled,
      onProgress: (c, total) => { btn.textContent = t("titan.quick.calcBtnBusy", { current: c, total }); btn.style.setProperty("--progress", String((c / total) * 100)); }
    };
    const result = await runTitanSimulation(cfg);
    renderReport(result);
    btn.disabled = false;
    btn.textContent = t("titan.quick.calcBtn");
    btn.classList.remove("btn-progress");
    btn.style.removeProperty("--progress");
  }

  function titanResetQuickCalc() {
    titanRenderQuickSummary();
    // 조합 찾기 결과(#titanOptimizeResult)는 여기서 지우지 않음 - 룬/설정을 바꿀 때마다(심지어
    // 조합 찾기 결과의 조합을 프리셋에 장착만 해도) 매번 사라지면 방금 찾은 결과를 다시 볼 수 없어
    // 불편하다는 사용자 피드백. 조합 찾기는 "다시 찾기" 버튼을 눌러야만 갱신되는 스냅샷으로 취급함
    const rep = document.getElementById("battleReport");
    if (rep) rep.style.display = "none";
  }

  // 전투에 영향을 주는 값(내 공룡 스탯/룬, 전투 설정 탭의 모든 항목)이 바뀌면 빠른 계산 결과뿐
  // 아니라 실전 시뮬레이션도 그 값을 그대로 들고 있는 예전 결과라 새로고침해야 함 -
  // titanLiveReset은 재생 중이면 멈추고 처음 상태로 되돌리는 것까지 한 번에 해줌
  function titanResetAllCalc() {
    titanResetQuickCalc();
    titanLiveReset();
  }

  // ===== 실전 시뮬레이션: 육각형 2개(왼쪽 공룡/오른쪽 타이탄) + runTitanSimulation의 1회차 로그를
  // 재생. iterations는 500으로 그대로 돌려서(통계용 평균 결과는 정확하게), collectLog로 받은 1회차
  // 로그만 시각적 재생에 씀 - 시뮬레이션은 한 번만 돌리고 재생 속도만 조절 가능함(다시 계산하려면 재시작) =====
  let titanReplayLogs = [];
  let titanReplayIdx = 0;
  let titanReplayTimer = null;
  let titanReplayRunning = false;
  let titanFirstDeathTick = null;
  // titanLiveReset()에서 한 번만 계산해서 재생 내내 재사용하는 아바타 크기 배율 캐시(성능 최적화) -
  // 매 리플레이 틱마다 titanDinoInputs()를 다시 불러 룬 목록을 읽던 걸 정리(사용자 지적 - 사이트
  // 전체 점검, 매 틱 localStorage 재읽기 낭비)
  let titanCachedSizeScale = 1;

  // 재생 중(setInterval)에 다른 페이지로 이동해도 이 타이머가 안 멈추고 계속 titanReplayTick을
  // 불러서, 이미 사라진 DOM(#titanBossHpFill 등)에 접근하다 "Cannot read properties of null"
  // 콘솔 에러가 나던 버그(다이노 배틀 페이지에서 같은 종류의 버그를 이미 hashchange로 고쳤던 것과
  // 동일 - 실측으로 발견) - 페이지를 벗어나는 순간 타이머를 확실히 멈춤. 리스너 자체는 매 방문마다
  // 쌓이지 않도록 파일 상단의 진짜 모듈 스코프 titanHashChangeHandler로 remove-then-add
  window.removeEventListener("hashchange", titanHashChangeHandler);
  titanHashChangeHandler = () => {
    clearInterval(titanReplayTimer);
    titanReplayRunning = false;
  };
  window.addEventListener("hashchange", titanHashChangeHandler);

  function titanInitSpeedDropdown() {
    const currentMs = titanGetSpeedMs();
    const list = document.getElementById("titanSpeedList");
    const selectedValue = document.getElementById("titanSpeedSelectedValue");
    selectedValue.textContent = sharedOptionLabel(BATTLE_SPEED_OPTIONS.find((o) => o.ms === currentMs).label);
    BATTLE_SPEED_OPTIONS.forEach((opt) => {
      const li = document.createElement("li");
      li.textContent = sharedOptionLabel(opt.label);
      li.onclick = () => {
        localStorage.setItem(TITAN_SPEED_KEY, String(opt.ms));
        selectedValue.textContent = sharedOptionLabel(opt.label);
        list.style.display = "none";
        if (titanReplayRunning) {
          clearInterval(titanReplayTimer);
          titanReplayTimer = setInterval(titanReplayTick, titanGetSpeedMs());
        }
      };
      list.appendChild(li);
    });
    selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
  }

  // 타일 하나엔 최대 3마리까지만 "표시"되고 나머지는 안 보이지만 똑같이 전투에 참여함(인게임 규칙) -
  // 앞쪽 3칸(삼각 대형)은 각자 자기 체력바를 가지고, 그때그때 "지금 살아있는 공룡 중 앞에서부터
  // 3마리"로 채워짐(표시되던 공룡이 죽으면 다음 산 공룡이 그 자리를 대신 보여줌). 나머지(숨겨진)
  // 공룡들의 체력바만 왼쪽에 세로 1열로 - 매 틱마다 "지금 숨겨진 공룡이 누구인지"가 바뀔 수 있어서
  // 고정된 DOM을 재활용하지 않고 그때그때 다시 그림(개수가 몇 안 돼서 매 틱 다시 그려도 부담 없음)
  const TITAN_VISIBLE_DINO_SLOTS = 3;

  // ===== 육각형 바닥과 완전히 같은 결합 좌표계(세계좌표) 위에 아바타를 "카메라로 촬영"하듯 배치 =====
  // 타일 중심은 원점(0,0)에서 HEX_NEIGHBOR 방향 벡터를 더해가며 명시적으로 선언함(CSS 3D 시절
  // SVG viewBox 좌표를 그대로 재사용하지 않기 위함 - 그렇게 했더니 타일 중심과 아바타 좌표가
  // 어긋나는 버그가 났었음). mine을 원점에 두고 boss를 그 오른쪽 위 이웃 타일에 배치.
  const TITAN_HEX_CENTERS = { mine: [0, 0], boss: hexAdd([0, 0], HEX_NEIGHBOR.upperRight) };
  // 카메라는 두 타일의 중점을 내려다보게 잡음(worldW/H 같은 별도 상수 없이 타일 좌표에서 직접 유도)
  const TITAN_CAM_TARGET = [
    (TITAN_HEX_CENTERS.mine[0] + TITAN_HEX_CENTERS.boss[0]) / 2,
    (TITAN_HEX_CENTERS.mine[1] + TITAN_HEX_CENTERS.boss[1]) / 2,
  ];
  const TITAN_R3 = 22;

  // "live" 탭을 처음 열 때 titanInitScene3d()가 마운트함(titanInitModeTabs 참고) - 그 전엔
  // #titanLiveModeCard가 display:none이라 캔버스가 0x0이라서 로드 시점엔 안 만듦(실측 확인)
  let titanScene3d = null;

  function titanInitScene3d() {
    const mountEl = document.getElementById("titanDuelFloorMount");
    if (!mountEl) return;
    // "지금 이 mountEl"에 이미 캔버스가 붙어있으면(같은 페이지 세션 안에서 탭만 왔다갔다 한 경우)
    // 리사이즈만 하고 끝 - titanScene3d(안 null)만 보고 판단하면 안 됨(건물/다이노 배틀 페이지에서
    // 실측으로 발견한 버그: 페이지를 나갔다 재방문하면 mountEl은 라우터가 완전히 새로 만든
    // 엘리먼트인데 씬 변수는 예전 인스턴스를 그대로 들고 있어서, "이미 마운트됨"으로 착각해 새
    // mountEl엔 캔버스를 영영 안 붙이는 바람에 바닥이 안 보였음 - 타이탄은 initTitanPage()가
    // 방문마다 통째로 다시 실행돼서 titanScene3d가 매번 fresh null이라 우연히 이 버그를 안
    // 겪었지만, 그 "우연"에 기대지 않고 다른 페이지와 같은 방식으로 명시적으로 확인함)
    if (titanScene3d && mountEl.querySelector("canvas")) { titanScene3d.resize(); return; }
    if (typeof createHexFloorScene !== "function") return;
    titanScene3d = createHexFloorScene({
      // 마운트 즉시 resize()가 실제 컨테이너 비율로 다시 잡아주므로 여기 값은 초기 종횡비 정도만
      // 맞으면 됨(육각형 크기 상수에서 유도 - SVG 시절 절대좌표 아님)
      worldW: 3 * HEX_HALF_W,
      worldH: 3 * HEX_HALF_H,
      hexTiles: [
        { center: TITAN_HEX_CENTERS.mine, tintVar: "--accent" },
        // 보스 쪽은 예전 SVG에서도 테마와 무관한 고정 레드였음(CSS 변수 아님) - 리터럴 색상 그대로
        { center: TITAN_HEX_CENTERS.boss, tintVar: "#e0473f" },
      ],
      camera: {
        // 카메라 높이/거리(예전 190/160.05)가 fov 45도 기준으로 필요 이상으로 멀어서, 스테이지
        // 박스 위쪽에 육각형/공이 전혀 없는 빈 공간이 크게 남았음(사용자 지적 - "타이탄은 왜 또
        // 내려와있어" - 콘텐츠가 박스 아래쪽에 몰려 보임). lookAt/fov는 그대로 두고 카메라만 같은
        // 비율로 씬에 가깝게 당김(순수 줌인 - 화면 중앙을 보는 지점은 안 바뀌므로 좌우 프레이밍은
        // 그대로 유지됨) - 실측(getBoundingClientRect)으로 여러 뷰포트에서 잘리지 않는 선까지 확인
        position: [TITAN_CAM_TARGET[0], 130, TITAN_CAM_TARGET[1] + 110],
        lookAt: [TITAN_CAM_TARGET[0], 0, TITAN_CAM_TARGET[1]],
        fov: 45,
      },
      // 창 크기가 바뀌면 육각형이 화면에서 차지하는 실제 픽셀 크기도 바뀌므로, 육각형 기준으로
      // 잡은 아바타 크기(--avatar-diam-px)도 다시 계산해야 함(위치는 %라 CSS가 알아서 따라가지만
      // 크기는 JS가 px로 직접 심으므로 재계산 트리거가 필요함)
      onResize: () => {
        const visibleCount = document.querySelectorAll("#titanMyTarget .titan-hex-avatar:not([style*='display: none'])").length || 1;
        titanPositionMyAvatars(visibleCount);
        titanPositionBoss();
      },
    });
    titanScene3d.mount(mountEl);
    // 페이지를 여러 번 오가도 리스너가 계속 쌓이지 않도록, 새로 등록하기 전에 이전 방문 몫을 먼저
    // 제거(titanThemeChangeHandler는 initTitanPage() 밖의 진짜 모듈 스코프 - 파일 상단 선언부 참고)
    document.removeEventListener("theme-changed", titanThemeChangeHandler);
    titanThemeChangeHandler = () => {
      if (titanScene3d && mountEl.isConnected) titanScene3d.rebakeColors();
    };
    document.addEventListener("theme-changed", titanThemeChangeHandler);
    // "live" 탭이 display:none인 동안(페이지 로드 시점) titanLiveReset()이 이미 한 번 아바타
    // 위치를 잡았는데, 그때는 씬이 없어서 titanWorldToPercent가 폴백(화면 중앙)을 썼음 - 씬이
    // 막 마운트된 지금 실제 projectToScreen 좌표로 다시 잡아줘야 함(안 그러면 시뮬레이션을 시작하기
    // 전까지 계속 화면 중앙에 겹쳐 있는 버그가 남음 - 실측으로 확인된 버그)
    titanLiveReset();
  }

  function titanWorldToPercent([x, y]) {
    if (titanScene3d) return titanScene3d.projectToScreen(x, y);
    return { left: "50%", top: "50%" }; // 씬 마운트 전 폴백(탭이 열리기 전엔 안 보이므로 위치는 무의미)
  }

  // count(1~3)에 따른 삼각 대형 좌표 - 다이노 배틀의 trianglePoints와 같은 공식(앞 1 + 뒤 2),
  // 마주볼 상대가 없는 자리라 방향 편향 없이 정삼각형만 씀
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

  // .titan-hex-avatar는 체력바/체력수치/이름표가 공(.titan-hex-avatar-ball)과 같은 flex 컬럼 안에
  // order로 위/아래에 쌓이는 구조라(중첩 preserve-3d 안에서는 건물/다이노 배틀처럼 체력바를 공의
  // 절대위치 오버레이로 빼면 안 그려지는 렌더링 버그가 있어서 - 위 .titan-hex-avatar 주석 참고 -
  // 이 방식을 씀), 부모 .titan-hex-billboard-slot의 translate(-50%,-50%)는 "박스 전체"를 육각형
  // 중심에 맞출 뿐 공 자체를 맞추는 게 아님. 보스는 공 위(체력수치+체력바)에만 내용물이 있고
  // 아래엔 없어서 실측상 공 중심이 박스 중심보다 카메라 쪽(아래)으로 17px 넘게 쏠려 있었음(공룡
  // 쪽은 위/아래 내용물 크기가 비슷해서 훨씬 덜 눈에 띔) - 3D 좌표/카메라와는 무관한 순수 CSS
  // 레이아웃 문제였음(제미나이는 "구체를 바닥에 심어서 생기는 원근 문제"로 진단했었는데, 체력바
  // 두께를 실측해보면 worldZ를 전혀 안 건드려도 이 오프셋이 그대로 나와서 그 진단은 틀렸다고
  // 결론남). 하드코딩 보정값 대신 실제 렌더링된 공/박스 위치를 재서 그 차이만큼 되돌림 - 체력바
  // 두께나 글자 크기가 반응형(cqw)이라 뷰포트마다 필요한 보정량이 달라지는데, 실측 방식은 항상
  // 자동으로 맞음
  function titanCenterBallAtAnchor(slot) {
    const ball = slot.querySelector(".titan-hex-avatar-ball");
    if (!ball) return;
    const ballRect = ball.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    if (slotRect.height === 0) return;
    const offsetY = (ballRect.top + ballRect.bottom) / 2 - (slotRect.top + slotRect.bottom) / 2;
    slot.style.transform = `translate(-50%, calc(-50% - ${offsetY}px))`;
  }

  // 공룡(내 편) 1~3마리를 mine 육각형 안에 삼각 대형으로 배치 - titanLiveReset(첫 배치)과
  // titanUpdateMyDisplay(매 틱, 죽어서 마릿수가 줄 때)에서 호출
  function titanPositionMyAvatars(count) {
    const points = titanFormationPoints(TITAN_HEX_CENTERS.mine, count);
    // 육각형 크기 기준 통일 크기(js/core/hex-scene3d.js) - 매머드의 힘/압축된 힘 룬 배율까지 반영.
    // titanLiveReset()이 채워둔 캐시를 읽기만 함(매 리플레이 틱마다 다시 계산하지 않음)
    const sizeScale = titanCachedSizeScale;
    const diamPx = titanScene3d
      ? titanScene3d.projectDiameterPx(TITAN_HEX_CENTERS.mine[0], TITAN_HEX_CENTERS.mine[1], DINO_AVATAR_DIAMETER_WORLD * sizeScale)
      : 0;
    const slots = [];
    [0, 1, 2].forEach((i) => {
      const slot = document.getElementById(`titanMySlot${i}`);
      const point = points[i];
      if (!point) return;
      const pct = titanWorldToPercent(point);
      slot.style.left = pct.left;
      slot.style.top = pct.top;
      // 대형 3마리끼리 깊이정렬 - 다이노 배틀과 같은 방식(카메라 실제 깊이 기반)으로 통일. 대형이
      // 항상 고정된 상대 위치라 정적값으로도 맞릴 수 있지만(이전엔 그렇게 했었음), 나중에 대형
      // 공식이 바뀌면 사람이 값을 다시 맞춰야 하는 유지보수 리스크가 있어서 동적 계산으로 바꿈
      if (pct.visible) slot.style.zIndex = Math.round(10000 - pct.distance);
      if (diamPx > 0) slot.querySelector(".titan-hex-avatar").style.setProperty("--avatar-diam-px", `${diamPx}px`);
      slots.push(slot);
    });
    // 위치/크기를 다 쓴 다음에만 측정(읽기)해서, 슬롯마다 읽기-쓰기가 번갈아 일어나며 강제
    // 리플로우가 3번 나는 걸 피함(실시간 재생 중 매 틱 호출되므로 중요)
    slots.forEach(titanCenterBallAtAnchor);
  }

  // 보스는 항상 1마리 고정 - 포메이션 계산 없이 boss 육각형 중심에 고정
  function titanPositionBoss() {
    const slot = document.getElementById("titanBossSlot0");
    const pct = titanWorldToPercent(TITAN_HEX_CENTERS.boss);
    slot.style.left = pct.left;
    slot.style.top = pct.top;
    const diamPx = titanScene3d
      ? titanScene3d.projectDiameterPx(TITAN_HEX_CENTERS.boss[0], TITAN_HEX_CENTERS.boss[1], TITAN_BOSS_DIAMETER_WORLD)
      : 0;
    if (diamPx > 0) slot.querySelector(".titan-hex-avatar").style.setProperty("--avatar-diam-px", `${diamPx}px`);
    titanCenterBallAtAnchor(slot);
  }

  function titanResetLiveStats() {
    document.getElementById("titanLiveStats").style.display = "none";
    document.getElementById("titanLiveDmg").innerText = "0";
    document.getElementById("titanLiveDps").innerText = "0";
    document.getElementById("titanLiveDead").innerText = t("titan.live.deadCountValue", { count: 0 });
    document.getElementById("titanLiveSurvival").innerText = t("titan.live.elapsedSecValue", { sec: 0 });
  }

  function titanLiveReset() {
    titanReplayRunning = false;
    clearInterval(titanReplayTimer);
    titanReplayLogs = [];
    titanReplayIdx = 0;
    titanFirstDeathTick = null;
    document.getElementById("titanLiveStartBtn").disabled = false;
    document.getElementById("titanLiveStartBtn").textContent = t("titan.live.startBtnIdle");
    document.getElementById("titanLiveStartBtn").classList.remove("btn-progress");
    document.getElementById("titanLiveStartBtn").style.removeProperty("--progress");
    document.getElementById("titanLiveRestartBtn").disabled = true;
    titanResetLiveStats();
    setHpFillWidth(document.getElementById("titanBossHpFill"), 1, 1);
    document.getElementById("titanBossHpText").textContent = t("titan.live.hpValueFormat", {
      current: TITAN_STATS[titanLevel].hp.toLocaleString(),
      max: TITAN_STATS[titanLevel].hp.toLocaleString()
    });
    const dino = titanDinoInputs();
    const myCount = dino.count || 1;
    titanCachedSizeScale = hexSceneDinoRuneSizeScale(dino.selectedRunes);
    titanBuildHpBars(myCount);
    // 처음 3마리(정확히는 min(3, 공룡 수))는 타일 위 아바타로 이미 표시되므로, 사이드바 쪽 같은
    // 인덱스는 숨겨야 함(안 그러면 시뮬레이션 시작 전에는 타일 3마리 + 사이드바 전체 N마리가 같이
    // 보이는 버그가 생김). 예전엔 공룡 수와 무관하게 항상 3마리를 다 보여줘서(사용자 확인) 공룡
    // 수를 2로 설정해도 시뮬레이션 시작 전엔 3마리가 보이는 버그가 있었음 - 실제 보여줄 수 있는
    // 마릿수는 항상 min(TITAN_VISIBLE_DINO_SLOTS, 공룡 수)로 제한함
    const visibleCount = Math.min(TITAN_VISIBLE_DINO_SLOTS, myCount);
    // 세계좌표 삼각 대형으로 배치(1마리=중앙/2마리=좌우대칭/3마리=정삼각형이 전부 실제 좌표
    // 계산으로 나옴 - 예전의 data-count별 손튜닝 % 없이도 자동으로 무게중심이 맞음)
    titanPositionMyAvatars(visibleCount);
    titanPositionBoss();
    document.querySelectorAll("#titanMyHpBars .titan-hex-hpbar").forEach((bar, i) => {
      bar.style.display = i < visibleCount ? "none" : "";
      setHpFillWidth(bar.querySelector(".titan-hex-hpfill"), 1, 1);
    });
    document.querySelectorAll("#titanMyTarget .titan-hex-avatar").forEach((el, i) => {
      el.style.display = i < visibleCount ? "" : "none";
      setHpFillWidth(el.querySelector(".titan-hex-avatar-hpfill"), 1, 1);
    });
    ["titanMyTarget", "titanBossTarget"].forEach((id) => {
      const el = document.getElementById(id);
      el.querySelectorAll(".dummy-hit-effect").forEach((fx) => fx.remove());
      el.querySelectorAll(".titan-hex-avatar").forEach((a) => a.classList.remove("dummy-shaking"));
    });
    ["titanMyPopupLayer", "titanBossPopupLayer"].forEach((id) => { document.getElementById(id).innerHTML = ""; });
  }

  async function titanStartLiveSim() {
    const btn = document.getElementById("titanLiveStartBtn");
    titanLiveReset();
    btn.disabled = true;
    btn.textContent = t("titan.live.startBtnCalculating");
    // 실전 시뮬레이션은 통계용 평균이 아니라 "한 판"을 그대로 보여주는 거라 1회차만 돌리면 됨
    // (빠른 계산 쪽의 500회 평균과는 목적 자체가 다름 - 여긴 결과 리포트가 없고 과정만 실시간으로 쌓임)
    const cfg = { ...buildSimBaseCfg(), iterations: 1, collectLog: true };
    const result = await runTitanSimulation(cfg);
    titanReplayLogs = result.logs;
    titanReplayIdx = 0;
    titanFirstDeathTick = null;
    btn.disabled = false;
    document.getElementById("titanLiveRestartBtn").disabled = false;
    document.getElementById("titanLiveStats").style.display = "grid";
    titanReplayStart();
  }

  // 재생/일시정지 버튼 라벨 - titanLiveStartBtn 하나가 상태에 따라 세 가지 역할을 함(사용자 확정 -
  // "시작 버튼을 눌렀다면 다시 시뮬레이션이 아니라 일시 정지여야 해. 초기화 버튼은 오른쪽에 있잖아" -
  // ↻ titanLiveRestartBtn이 이미 "처음부터 다시" 역할을 맡고 있으니 이 버튼은 재생 상태 토글에만
  // 집중함): 재생 중엔 "일시정지", 로그가 남아있는데 멈춰있으면(사용자가 일시정지함) "재생", 로그를
  // 끝까지 다 재생했으면(더 재생할 게 없음) "다시 시뮬레이션"(새로 계산해서 처음부터). 초기 상태
  // ("시뮬레이션 시작")는 titanLiveReset()이 직접 심어주므로 여기서 안 건드림
  function titanUpdateStartBtnLabel() {
    const btn = document.getElementById("titanLiveStartBtn");
    if (titanReplayRunning) btn.textContent = t("titan.live.startBtnPause");
    else if (titanReplayIdx < titanReplayLogs.length) btn.textContent = t("titan.live.startBtnResume");
    else if (titanReplayLogs.length > 0) btn.textContent = t("titan.live.startBtnRestartSim");
  }

  function titanReplayStart() {
    if (titanReplayLogs.length === 0) return;
    titanReplayRunning = true;
    clearInterval(titanReplayTimer);
    titanReplayTimer = setInterval(titanReplayTick, titanGetSpeedMs());
    titanUpdateStartBtnLabel();
  }

  function titanUpdateMyDisplay(entry) {
    const dinoMaxHp = entry.공룡최대HP_raw || 1;
    const aliveIdx = entry.공룡상태
      .map((d, i) => ({ i, hp: Number(d.남은HP) }))
      .filter((d) => d.hp > 0)
      .map((d) => d.i);
    const frontIdx = aliveIdx.slice(0, TITAN_VISIBLE_DINO_SLOTS);
    const hiddenIdx = entry.공룡상태.map((d, i) => i).filter((i) => !frontIdx.includes(i));

    // 앞쪽 삼각 대형 3자리 - 각자 자기 체력바를 가짐. 실시간 재생 중에도 표시되는 마릿수가
    // (죽어서) 줄어들 수 있으므로 매 틱 세계좌표 대형을 다시 계산해서 1/2마리로 줄었을 때도 재배치됨
    const target = document.getElementById("titanMyTarget");
    titanPositionMyAvatars(frontIdx.length);
    target.querySelectorAll(".titan-hex-avatar").forEach((avatarEl, slot) => {
      if (slot < frontIdx.length) {
        avatarEl.style.display = "";
        const hp = Number(entry.공룡상태[frontIdx[slot]].남은HP);
        setHpFillWidth(avatarEl.querySelector(".titan-hex-avatar-hpfill"), hp, dinoMaxHp);
      } else {
        avatarEl.style.display = "none";
      }
    });

    // 숨겨진 나머지 공룡들 - 왼쪽 세로 1열(영속 DOM: 보이기/숨기기+폭만 갱신해서 팝업이 다음
    // 틱까지 안 지워지고 살아있게 함)
    document.querySelectorAll("#titanMyHpBars .titan-hex-hpbar").forEach((bar) => {
      const i = Number(bar.dataset.dinoIdx);
      const isHidden = hiddenIdx.includes(i);
      bar.style.display = isHidden ? "" : "none";
      if (isHidden) {
        const hp = Number(entry.공룡상태[i].남은HP);
        setHpFillWidth(bar.querySelector(".titan-hex-hpfill"), hp, dinoMaxHp);
      }
    });

    return frontIdx;
  }

  // 표시 중인(삼각 대형) 공룡 개별 옆에 작은 숫자를 띄움 - 아바타 자기 자신을 부모로 붙여서
  // left:50%가 그 아바타 기준으로 뜨게 함(육각형 전체 중앙이 아니라 "그 공룡 근처"에 보이도록)
  function titanShowAvatarPopup(avatarEl, text, kind) {
    if (!avatarEl || avatarEl.style.display === "none") return;
    const popup = document.createElement("div");
    popup.className = `battle-dmg-popup titan-mini-popup titan-mini-popup-${kind}`;
    popup.innerText = text;
    avatarEl.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }

  // 숨겨진(왼쪽 체력바만 있는) 공룡용 - 그 공룡의 막대 위에 작게 띄움. 매 틱 innerHTML을 통째로
  // 다시 그리면 이 팝업이 애니메이션 끝나기 전에 지워지므로, 막대 자체는 titanBuildHpBars가 한 번만
  // 만들어두고 여기선 그 기존 DOM에 그대로 붙임
  function titanShowSidebarPopup(dinoIdx, text, kind) {
    const bar = document.querySelector(`#titanMyHpBars .titan-hex-hpbar[data-dino-idx="${dinoIdx}"]`);
    if (!bar || bar.style.display === "none") return;
    const popup = document.createElement("div");
    popup.className = `battle-dmg-popup titan-mini-popup titan-mini-popup-${kind}`;
    popup.innerText = text;
    bar.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }

  // 표시 중이면 아바타 위에, 숨겨져 있으면 그 공룡의 체력바 위에 - 어느 쪽이든 상관없이 항상
  // "그 공룡" 근처에 뜨도록 통일한 헬퍼
  function titanShowDinoPopup(dinoIdx, frontIdx, avatarEls, text, kind) {
    const slot = frontIdx.indexOf(dinoIdx);
    if (slot !== -1) titanShowAvatarPopup(avatarEls[slot], text, kind);
    else titanShowSidebarPopup(dinoIdx, text, kind);
  }

  function titanBuildHpBars(count) {
    const wrap = document.getElementById("titanMyHpBars");
    wrap.innerHTML = Array.from({ length: count }, (_, i) => `
      <div class="titan-hex-hpbar" data-dino-idx="${i}"><div class="titan-hex-hpfill titan-hex-hpfill-mine"></div></div>
    `).join("");
  }

  // 로그의 "이벤트" 문자열(예: "1번 공룡 평타 치명타 (타이탄 1,234 피해)")에서 어떤 공룡이 타이탄에게
  // 얼마나 피해를 입혔는지만 뽑아냄(피격/회복은 공룡상태의 남은HP 숫자를 tick 간 비교해서 직접
  // 계산하는 게 더 정확해서 그쪽은 텍스트 파싱을 안 씀 - 공격 기여분만 텍스트에서만 얻을 수 있음)
  function titanParseAttackEvents(events) {
    const results = [];
    (events || []).forEach((ev) => {
      const m = ev.match(/^(\d+)번 공룡 .*타이탄\s*([\d,]+)\s*피해/);
      if (m) results.push({ dinoIdx: Number(m[1]) - 1, dmg: Number(m[2].replace(/,/g, "")) });
    });
    return results;
  }

  function titanReplayTick() {
    if (titanReplayIdx >= titanReplayLogs.length) {
      clearInterval(titanReplayTimer);
      titanReplayRunning = false;
      titanUpdateStartBtnLabel();
      return;
    }
    const entry = titanReplayLogs[titanReplayIdx];
    const prevEntry = titanReplayIdx > 0 ? titanReplayLogs[titanReplayIdx - 1] : null;

    const titanMaxHp = entry.타이탄최대HP_raw;
    const titanHp = entry.타이탄HP_raw;
    setHpFillWidth(document.getElementById("titanBossHpFill"), titanHp, titanMaxHp);
    document.getElementById("titanBossHpText").textContent = t("titan.live.hpValueFormat", {
      current: Math.max(0, Math.round(titanHp)).toLocaleString(),
      max: Math.round(titanMaxHp).toLocaleString()
    });

    const frontIdx = titanUpdateMyDisplay(entry);
    const avatarEls = document.querySelectorAll("#titanMyTarget .titan-hex-avatar");

    const dinoHpSum = entry.공룡상태.reduce((s, d) => s + Number(d.남은HP), 0);
    const deadCount = entry.공룡상태.filter((d) => Number(d.남은HP) <= 0).length;
    const elapsedSec = titanReplayIdx + 1;

    if (prevEntry) {
      // 타이탄이 받은 피해(전체) - 보스 아바타 위에 뜸
      const dmgToTitan = Math.max(0, prevEntry.타이탄HP_raw - titanHp);
      if (dmgToTitan > 0) {
        titanPlayHit("titanBossTarget", "titanBossPopupLayer", dmgToTitan);
      }

      // 공룡 전원(표시 중인 3마리 + 숨겨진 나머지 전부)의 피격/회복을 정확한 수치(남은HP 증감)로
      // 계산해서 각자 위(표시 중이면 아바타, 숨겨졌으면 왼쪽 체력바)에 개별 표시
      let anyMineHit = false;
      entry.공룡상태.forEach((d, dinoIdx) => {
        const before = Number(prevEntry.공룡상태[dinoIdx].남은HP);
        const after = Number(d.남은HP);
        const delta = after - before;
        if (delta < -0.5) {
          titanShowDinoPopup(dinoIdx, frontIdx, avatarEls, `-${Math.round(-delta).toLocaleString()}`, "dmg");
          if (frontIdx.includes(dinoIdx)) anyMineHit = true;
        } else if (delta > 0.5) {
          titanShowDinoPopup(dinoIdx, frontIdx, avatarEls, `+${Math.round(delta).toLocaleString()}`, "heal");
        }
      });
      if (anyMineHit) titanPlayHit("titanMyTarget", null, 0);

      // 이번 틱에 타이탄에게 피해를 입힌 공룡 전원(7마리가 동시에 공격 중이면 7마리 전부)의 개별
      // 공격 기여분(치명타/스킬 포함)도 각자 위에 표시
      titanParseAttackEvents(entry.이벤트).forEach(({ dinoIdx, dmg }) => {
        titanShowDinoPopup(dinoIdx, frontIdx, avatarEls, dmg.toLocaleString(), "attack");
      });
    }

    // 실시간 통계: 누적 대미지/평균 DPS/사망 수/생존 시간(최초 사망 발생 시점, 아직 아무도 안
    // 죽었으면 지금까지의 경과 시간을 잠정치로 보여줌)
    const totalDmg = Math.max(0, titanMaxHp - titanHp);
    document.getElementById("titanLiveDmg").innerText = Math.round(totalDmg).toLocaleString();
    document.getElementById("titanLiveDps").innerText = Math.round(totalDmg / elapsedSec).toLocaleString();
    document.getElementById("titanLiveDead").innerText = t("titan.live.deadCountValue", { count: deadCount });
    if (deadCount > 0 && titanFirstDeathTick === null) titanFirstDeathTick = elapsedSec;
    document.getElementById("titanLiveSurvival").innerText = t("titan.live.elapsedSecValue", { sec: titanFirstDeathTick !== null ? titanFirstDeathTick : elapsedSec });

    titanReplayIdx++;
  }

  function titanPlayHit(targetId, popupLayerId, dmg) {
    const target = document.getElementById(targetId);
    target.querySelectorAll(".titan-hex-avatar").forEach((avatar) => {
      if (avatar.style.display === "none") return;
      avatar.classList.remove("dummy-shaking");
      void avatar.offsetWidth;
      avatar.classList.add("dummy-shaking");
    });

    // Three.js로 바닥을 옮기면서 preserve-3d 자체가 사라져서, 예전에 3D 깊이 다툼(피격 흔들림이
    // filter를 쓰는 순간 강제 평면화되던 문제)을 피하려고 썼던 position:fixed 우회가 더 이상 필요
    // 없음 - 일반 인-스테이지 요소로 되돌리고, 히트 이펙트/데미지 팝업 둘 다
    // hexScene.projectToScreen() 좌표 하나로 통일(예전엔 fx만 getBoundingClientRect() 기반 별도
    // 계산을 썼음)
    const hexCenter = TITAN_HEX_CENTERS[targetId === "titanMyTarget" ? "mine" : "boss"];
    const pct = titanWorldToPercent(hexCenter);
    const layer = document.getElementById(targetId === "titanMyTarget" ? "titanMyPopupLayer" : "titanBossPopupLayer");

    const fx = document.createElement("img");
    fx.src = "./assets/sprites/Hit_Effect.png";
    fx.className = "dummy-hit-effect";
    fx.style.setProperty("--hit-angle", `${Math.floor(Math.random() * 360)}deg`);
    fx.style.left = pct.left;
    fx.style.top = pct.top;
    layer.appendChild(fx);
    fx.addEventListener("animationend", () => fx.remove());

    // popupLayerId가 없으면(예: 표시 중인 3마리 각자에게 이미 개별 팝업을 따로 띄운 경우) 흔들림/
    // 타격 이펙트만 재생하고 별도의 통합 데미지 숫자는 생략함
    if (!popupLayerId) return;
    const popup = document.createElement("div");
    popup.className = "battle-dmg-popup dummy-dmg-popup";
    popup.innerText = Math.round(dmg).toLocaleString();
    popup.style.left = pct.left;
    popup.style.top = pct.top;
    layer.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }

  function titanInitLiveControls() {
    // 재생 중이면 일시정지만, 일시정지 상태(로그가 남음)면 그 지점부터 재생 재개만, 그 외(아직
    // 시작 전이거나 끝까지 다 재생함)엔 새로 계산해서 시작 - 초기화(처음부터 다시)는 옆의
    // titanLiveRestartBtn(↻) 몫이라 여기선 재계산 없이 이어서 재생하는 것만 처리
    document.getElementById("titanLiveStartBtn").onclick = () => {
      if (titanReplayRunning) {
        clearInterval(titanReplayTimer);
        titanReplayRunning = false;
        titanUpdateStartBtnLabel();
        return;
      }
      if (titanReplayIdx < titanReplayLogs.length) {
        titanReplayStart();
        return;
      }
      titanStartLiveSim();
    };
    document.getElementById("titanLiveRestartBtn").onclick = () => {
      titanLiveReset();
    };
  }

  function renderReport(result) {
    const rep = document.getElementById("battleReport");
    rep.style.display = "block";
    document.getElementById("repTotalDmg").innerText = Math.floor(result.avgTotalDmg).toLocaleString();
    document.getElementById("repTitanHp").innerText = Math.floor(result.avgRemainingTitanHp).toLocaleString();
    document.getElementById("repTime").innerText = t("titan.optimize.timeFormat", { m: Math.floor(result.avgTimeSec / 60), s: Math.floor(result.avgTimeSec % 60) });
    document.getElementById("repDead").innerText = t("titan.live.deadCountValue", { count: result.avgDeadCount.toFixed(1) });
    document.getElementById("avgMinHpPer").innerText = t("titan.quick.report.avgSurvivalHpLabel", { percent: result.avgSurvivalPercent.toFixed(1) });
    if (result.chartData.length > 0) {
      drawHpChart(document.getElementById("hpChart"), result.chartData, result.limitSec);
    }

    const oldBtn = document.getElementById("logDownloadBtn");
    if (oldBtn) oldBtn.remove();
    if (AppSettings.isLogEnabled && result.logs.length > 0) {
      const logBtn = document.createElement("button");
      logBtn.id = "logDownloadBtn";
      logBtn.innerHTML = t("titan.quick.report.logDownloadBtn");
      logBtn.className = "btn-simulate";
      logBtn.style.cssText = "margin-top:15px; background:#455a64; font-size:14px;";
      logBtn.onclick = () => {
        let content = "=== 상세 전투 로그 (1회차) ===\n\n";
        result.logs.forEach((entry) => {
          content += `[${entry.시간}] 타이탄HP: ${entry.타이탄HP} | 생존: ${entry.생존공룡}\n`;
          entry.공룡상태.forEach((d) => { content += `  - ${d.번호}번 공룡 HP: ${d.남은HP}\n`; });
          if (entry.이벤트 && entry.이벤트.length > 0) {
            entry.이벤트.forEach((ev) => { content += `  * ${ev}\n`; });
          }
          content += "--------------------------------\n";
        });
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `battle_log_${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      };
      rep.appendChild(logBtn);
    }
  }

  // ===== 조합 찾기: 생존 시간(공룡 1마리당) 최대 조합 + 시간당 대미지 최대 조합을 한 번의 브루트포스
  // 루프에서 같이 찾음. 시간당 대미지는 getTitanCombatMetrics로 즉시 계산(공짜에 가까움)되지만,
  // 생존 시간은 실제로 얼마나 버티는지를 알아야 해서 runTitanSimulation을 회차를 낮춰서 돌림(그래도
  // 조합 수가 많으면 오래 걸릴 수 있음 - 사이트에서 제일 무거운 연산) =====
  function titanInitOwnedRuneGrid() {
    const levels = loadTitanOwnedLevels();
    const grid = document.getElementById("titanOwnedRuneGrid");
    grid.innerHTML = titanSuitableRuneNames().map((name) => `
      <div class="dummy-owned-rune-row">
        <span class="dummy-owned-rune-name">${ruleDisplayName(name)}</span>
        <input type="tel" inputmode="numeric" class="dummy-owned-rune-level" data-rune="${name}" value="${levels[name] || ""}" placeholder="0">
      </div>
    `).join("");

    grid.querySelectorAll(".dummy-owned-rune-level").forEach((input) => {
      input.oninput = () => { input.value = input.value.replace(/[^0-9]/g, ""); };
      input.onblur = () => {
        const name = input.dataset.rune;
        let v = Math.max(0, Math.min(31, Number(input.value) || 0));
        input.value = v || "";
        const current = loadTitanOwnedLevels();
        current[name] = v;
        saveTitanOwnedLevels(current);
        document.getElementById("titanOptimizeResult").innerHTML = "";
      };
      // 엔터 키로도 커밋되게(예전엔 마우스로 다른 빈 공간을 눌러 포커스를 잃어야만 반영됐음 -
      // 사용자 지적) - blur()를 호출하면 위 onblur 핸들러가 그대로 실행됨
      input.onkeydown = (e) => { if (e.key === "Enter") input.blur(); };
    });
  }

  async function titanRunOptimizer() {
    const levels = loadTitanOwnedLevels();
    const owned = titanSuitableRuneNames().filter((name) => levels[name] > 0);
    const resultEl = document.getElementById("titanOptimizeResult");
    const btn = document.getElementById("titanOptimizeBtn");

    if (owned.length === 0) {
      resultEl.innerHTML = `<p class="quickcalc-desc">${t("titan.optimize.needLevelsMsg")}</p>`;
      return;
    }

    const slotCount = Math.min(5, owned.length);
    const combos = titanCombinations(owned, slotCount);
    const dino = titanDinoInputs();
    const tileCfg = loadTitanTileSettings();
    btn.disabled = true;
    btn.classList.add("btn-progress");
    btn.style.setProperty("--progress", "0");
    resultEl.innerHTML = "";

    // 1단계: DPS와 "기대 사망 횟수" 둘 다 시뮬레이션(RNG 반복) 없이 계산(estimateTitanExpectedDeaths -
    // 연속 전투 하에서 재생 이론으로 유도한 노이즈 없는 해석적 모델, js/core/stat-calc.js 참고).
    // 예전엔 평균 net 소모율만 보는 수식이라 오버힐(체력 캡 근처에서 회복이 낭비되는 것)과 공룡
    // count마리 중 최솟값 위험을 둘 다 놓쳤는데, 이 모델은 마르코프 체인으로 그 둘을 정확히 반영함.
    //
    // await 없는 완전 동기 루프라 조합 수가 아주 많으면(적합 룬을 거의 다 보유한 경우) 브라우저가
    // 그동안 완전히 멈춤 - 청크 단위로 나눠서 매 청크 사이에 한 번씩 이벤트 루프에 양보(setTimeout 0)
    // 하고 진행률도 갱신해서, 계산 자체는 똑같이 걸리더라도 화면이 안 멈추고 "계산 중"이라는 게
    // 계속 보이게 함(2·3단계에서 이미 쓰는 것과 같은 패턴). MTTF 계산이 예전 순수 수식보다 훨씬
    // 무거워서(조합당 약 0.2ms) 청크 크기를 3000 -> 1000으로 줄여 청크당 250ms를 넘지 않게 함
    // (Node 벤치마크로 확인 - dino_mutant_simulator_plan.md 참고).
    const targetTitan = TITAN_STATS[titanLevel];
    const timeLimitSec = timeLimitMinutes * 60;
    const respawnDelaySec = getRespawnDelaySec(dino.moveSpeed, distanceTiles);
    const STAGE1_CHUNK_SIZE = 500;
    const screened = [];
    for (let i = 0; i < combos.length; i += STAGE1_CHUNK_SIZE) {
      const end = Math.min(i + STAGE1_CHUNK_SIZE, combos.length);
      for (let j = i; j < end; j++) {
        const names = combos[j];
        const selectedRunes = names.map((name) => ({ name, lv: levels[name] }));
        const metrics = getTitanCombatMetrics({ ...dino, selectedRunes }, tileCfg);
        const dps = (metrics.avgHitDamage + metrics.skillDmgTotal) * dino.count;
        // 타이탄이 공룡보다 먼저 죽으면 그 뒤로는 아무 피해도 안 들어오므로, 실제 위험 구간은
        // "제한 시간"과 "타이탄을 잡는 데 걸리는 시간" 중 짧은 쪽까지만(묶음16과 동일한 논리)
        const effectiveHorizonSec = dps > 0 ? Math.min(timeLimitSec, targetTitan.hp / dps) : timeLimitSec;
        const expectedDeathCount = estimateTitanExpectedDeaths(metrics, targetTitan, effectiveHorizonSec, respawnDelaySec) * dino.count;
        // "확률에 하나도 안 기대도 최소 이만큼은 버틴다"는 확정 하한선 - 흡혈/힐/피해 저항 같은
        // 확률형 효과가 전부 한 번도 안 터진다고 가정하고, 확정 감소(단단한 피부/타이탄 가드)와
        // 확정 체력(방어벽/체력 증가 등 hp% 증가는 이미 finalHp에 반영돼 있음)만으로 계산한 뒤
        // 같은 재생 공식으로 "기대 사망 횟수" 단위로 통일함(위 expectedDeathCount와 눈금이 같아야
        // byDps/bySurvival/byBalance와 나란히 비교 가능) - 계산 비용 거의 0(이미 있던 값을 감싸기만 함)
        const deterministicReduction = metrics.reductions
          .filter((r) => r.type === "flat")
          .reduce((sum, r) => sum + r.avg, 0);
        const deterministicNetDrainPerSec = Math.max(1, targetTitan.atk - deterministicReduction) / 3;
        const deterministicSurvivalEstimate = metrics.finalHp / deterministicNetDrainPerSec;
        const deterministicExpectedDeathCount = effectiveHorizonSec / (deterministicSurvivalEstimate + respawnDelaySec);
        screened.push({ names, dps, expectedDeathCount, deterministicExpectedDeathCount });
      }
      if (end < combos.length) {
        btn.textContent = t("titan.optimize.stage1Progress", { current: end.toLocaleString(), total: combos.length.toLocaleString() });
        btn.style.setProperty("--progress", String((end / combos.length) * 9));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const bestDpsAll = screened.reduce((a, b) => (b.dps > a.dps ? b : a));

    // 균형 점수도 후보군 전체 기준(global)으로 미리 계산 - 이래야 "균형" 자체가 좋은 조합이
    // DPS나 생존 어느 한쪽에서도 상위 30위 안에 못 들어서 후보군에서 아예 빠지는 일이 없음.
    // (이 global 정규화는 후보군을 "누구를 뽑을지" 고르는 용도이고, 2단계 정밀 계산 뒤 실제
    // 균형 조합을 "고르는" 정규화는 refined 안에서 따로 계산함 - 서로 다른 단계라 섞으면 안 됨)
    const maxDpsAll = bestDpsAll.dps;
    screened.forEach((s) => {
      s.balanceScore = titanBalanceScore(s.dps / maxDpsAll, 1 / (1 + s.expectedDeathCount));
    });

    btn.textContent = t("titan.optimize.stage1Done");
    btn.style.setProperty("--progress", "10");

    // 2단계: DPS 상위 + 해석적 기대 사망 최저 + 해석적 균형 점수 상위 + 확정형 안전망 최저(4갈래,
    // 중복 제거)를 합쳐 실제 시뮬레이션으로 회차를 높여 정밀 재계산. 마지막 갈래(byDeterministicSafety)는
    // 위 주석 참고 - 확률형 효과의 "기댓값"만 보는 모델도 완벽하진 않을 수 있어서, 확정형 방어
    // 위주 조합을 부당하게 낮게 평가할 가능성에 대한 추가 안전망으로 남겨둠
    const byDps = [...screened].sort((a, b) => b.dps - a.dps).slice(0, TITAN_OPTIMIZER_CANDIDATE_COUNT);
    const bySurvival = [...screened].sort((a, b) => a.expectedDeathCount - b.expectedDeathCount).slice(0, TITAN_OPTIMIZER_CANDIDATE_COUNT);
    const byBalance = [...screened].sort((a, b) => b.balanceScore - a.balanceScore).slice(0, TITAN_OPTIMIZER_CANDIDATE_COUNT);
    const byDeterministicSafety = [...screened].sort((a, b) => a.deterministicExpectedDeathCount - b.deterministicExpectedDeathCount).slice(0, TITAN_OPTIMIZER_CANDIDATE_COUNT);
    const candidateMap = new Map();
    [...byDps, ...bySurvival, ...byBalance, ...byDeterministicSafety].forEach((c) => candidateMap.set(c.names.join("|"), c));
    const candidates = [...candidateMap.values()];

    // 후보(최대 120개)만 훨씬 높은 해상도(TITAN_SURVIVAL_REFINE_BUCKETS)로 기대 사망 횟수를 다시
    // 계산함 - 전체 조합(수천~수십만 개) 스크리닝에는 빠른 기본 해상도(TITAN_SURVIVAL_BUCKETS)를
    // 쓰지만, 그 정밀도로는 방어가 거의 없는 조합의 위험도가 실측 대비 수십 배까지 저평가될 수
    // 있음이 확인됨(해상도가 낮으면 한 사이클에 여러 구간을 건너뛰는 조합에서 오차가 큼). 반대로
    // 전체 조합에 처음부터 높은 해상도를 쓰면 계산량이 감당 안 될 만큼 늘어나므로, 후보로 추려진
    // 소수에만 정밀 재계산을 적용하는 것 - 이미 2·3단계가 쓰는 "저렴하게 거르고 정밀하게
    // 재검증"과 같은 패턴을 1단계 안에서 한 번 더 적용한 셈
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const selectedRunes = c.names.map((name) => ({ name, lv: levels[name] }));
      const metrics = getTitanCombatMetrics({ ...dino, selectedRunes }, tileCfg);
      const effectiveHorizonSec = c.dps > 0 ? Math.min(timeLimitSec, targetTitan.hp / c.dps) : timeLimitSec;
      c.expectedDeathCount = estimateTitanExpectedDeaths(metrics, targetTitan, effectiveHorizonSec, respawnDelaySec, TITAN_SURVIVAL_REFINE_BUCKETS) * dino.count;
      if (i % 10 === 9) {
        btn.textContent = t("titan.optimize.refineProgress", { current: i + 1, total: candidates.length });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const refined = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const selectedRunes = c.names.map((name) => ({ name, lv: levels[name] }));
      const fineResult = await runTitanSimulation({
        ...buildSimBaseCfg(selectedRunes),
        // 조합 찾기는 전역 연속 전투 토글과 무관하게 항상 켠 상태로 계산함 - 죽어도 무한
        // 재소환되는 게 실제 플레이 상황이라, "한 마리라도 죽으면 끝"이라는 전제 자체가 성립하지
        // 않는 continuousBattle:false 기준으로 조합을 추천하면 안 됨(titanOptimizeQuickSummary에도
        // 이 사실을 고정 표시함)
        continuousBattle: true,
        iterations: TITAN_OPTIMIZER_FINAL_ITERATIONS,
        collectLog: false,
        batchSize: 10
      });
      refined.push({
        names: c.names, dps: c.dps, avgDeadCount: fineResult.avgDeadCount,
        survivalQuality: 1 / (1 + fineResult.avgDeadCount),
        // 1단계 해석적 점수도 같이 들고 다님(아래 byAnalyticBalance 안전망용) - 2단계는 15회짜리
        // 표본이라 노이즈가 있으므로, "노이즈 없는 해석적 점수로는 최상위였는데 15회 우연히 나쁘게
        // 나온" 조합을 구분하기 위해 필요
        analyticBalanceScore: c.balanceScore
      });
      btn.textContent = t("titan.optimize.stage2Progress", { current: i + 1, total: candidates.length });
      btn.style.setProperty("--progress", String(10 + ((i + 1) / candidates.length) * 60));
    }

    // 3단계: 2단계(30회 평균)는 표본이 적어서 진짜 기댓값과 다소 어긋날 수 있음 - 그 30회가
    // 우연히 좋게/나쁘게 나온 조합이 최종 승자로 잘못 뽑히는 걸 막기 위해, 2단계 상위권(생존/균형
    // 각각 상위 N개 + 대미지 최고 조합)만 추려서 훨씬 높은 회차로 다시 검증한 뒤 그 결과로
    // 최종 승자를 정함(회차를 늘릴수록 평균이 진짜 기댓값에 가까워지므로, 시드로 결과를
    // "재현 가능하게" 고정하는 방법 대신 표본 자체를 늘려 "더 정확하게" 만드는 쪽을 선택함).
    const preMaxDps = Math.max(...refined.map((r) => r.dps));
    // 균형 점수의 "생존" 축은 survivalQuality(1/(1+평균 사망 횟수), 0~1로 이미 정규화돼 있음 -
    // 연속 전투 하에서는 "몇 %가 한 번도 안 죽었는지"보다 "평균적으로 몇 번 죽는지"가 실제로
    // 의미 있는 지표(죽어도 무한 재소환되므로 무사망 여부 자체는 이제 절대적 기준이 아님)
    const balanceScoreOf = (r) => titanBalanceScore(r.dps / preMaxDps, r.survivalQuality);
    // 생존 후보 선정도 avgDeadCount(평균 사망 횟수) 오름차순을 1순위로 함(같으면 DPS로 2차 정렬) -
    // 안 그러면 "15회 평균 사망 0.1회"와 "15회 평균 사망 0.9회"가 섞여서 진짜 안정적인 조합이
    // 3단계 최종 후보(top N)에도 못 들 수 있음
    const byRefinedSurvival = [...refined]
      .sort((a, b) => (a.avgDeadCount !== b.avgDeadCount ? a.avgDeadCount - b.avgDeadCount : b.dps - a.dps))
      .slice(0, TITAN_OPTIMIZER_VERIFY_TOP_N);
    const byRefinedBalance = [...refined].sort((a, b) => balanceScoreOf(b) - balanceScoreOf(a)).slice(0, TITAN_OPTIMIZER_VERIFY_TOP_N);
    // 안전망: 2단계 실측(15회) 기준 순위가 아니라, 노이즈 없는 1단계 해석적 균형 점수 기준으로도
    // 상위 N개를 따로 뽑아서 finalists에 합침 - byRefinedBalance만 쓰면 "해석적으로는 최상위인데
    // 15회 표본이 우연히 나쁘게 나온" 조합이 정밀 검증(3단계) 기회 자체를 못 받고 영구히 탈락할
    // 수 있음(실측 재현: 위험도가 사실상 동률(둘 다 사실상 0)인데 DPS가 훨씬 높은 조합이 이 문턱에서
    // 걸러진 사례 확인)
    const byAnalyticBalance = [...refined].sort((a, b) => b.analyticBalanceScore - a.analyticBalanceScore).slice(0, TITAN_OPTIMIZER_VERIFY_TOP_N);
    const finalistMap = new Map();
    [...byRefinedSurvival, ...byRefinedBalance, ...byAnalyticBalance].forEach((c) => finalistMap.set(c.names.join("|"), c));
    // 대미지 최고 조합도 화면에 보여줄 "예상 생존 시간" 숫자의 정확도를 위해 같이 검증함 - byDps에
    // 전체 조합 중 진짜 DPS 최댓값(bestDpsAll)이 항상 포함되므로 refined 안에 그 실측값이 반드시
    // 있음(아래 cap-skip 판단에 쓸 survival 값도 같이 딸려오도록 refined의 실제 항목을 그대로 씀)
    finalistMap.set(bestDpsAll.names.join("|"), refined.find((r) => r.names.join("|") === bestDpsAll.names.join("|")));
    const finalists = [...finalistMap.values()];

    // 3-1단계: 최종 후보 전부를 곧바로 500회씩 검증하면 그게 전체 소요 시간의 대부분(실측 90%)을
    // 차지함 - 그런데 최종 후보끼리도 이미 확실히 갈리는 경우(한쪽이 생존도 딜도 둘 다 확실히
    // 밀림)엔 굳이 500회까지 안 가도 결론이 안 바뀜. 그래서 먼저 저렴한 예비 회차(prescan)로 다들
    // 가볍게 재보고(단, 2단계가 이미 예외 없이 무사망 -> 저렴한 캡체크로 확정된 후보는 기존과
    // 똑같이 그대로 씀 - capConfirmed, 이 지름길 자체는 건드리지 않음), 그 예비 결과를 놓고 다음
    // 단계(3-2)에서 "진짜 경합 중인 후보만" 500회로 승격시킴.
    const preResolved = [];
    for (let i = 0; i < finalists.length; i++) {
      const f = finalists[i];
      const selectedRunes = f.names.map((name) => ({ name, lv: levels[name] }));
      btn.style.setProperty("--progress", String(70 + (i / finalists.length) * 15));

      // 2단계 표본이 예외 없이 전부 무사망(avgDeadCount===0)이었다면 곧바로 예비 검증을 돌리는
      // 대신, 훨씬 저렴한 회차로 한 번 더 확인해봄(위 상수 선언부 주석 참고 - 15회 전부 무사망만
      // 으로는 신뢰도가 부족할 수 있어서 완전히 생략하지는 않음)
      if (f.avgDeadCount === 0) {
        btn.textContent = t("titan.optimize.stage3PrescanRecheckProgress", { current: i + 1, total: finalists.length });
        const capCheckResult = await runTitanSimulation({
          ...buildSimBaseCfg(selectedRunes),
          continuousBattle: true, // 조합 찾기는 항상 연속 전투 기준 - 위 2단계 주석 참고
          iterations: TITAN_OPTIMIZER_CAP_CHECK_ITERATIONS,
          collectLog: false,
          batchSize: 25
        });
        if (capCheckResult.avgDeadCount === 0) {
          // 저렴한 확인 회차도 전부 무사망 - 확정, 500회 전체 검증은 생략(기존 최적화 그대로 -
          // capConfirmed는 아래 3-2단계에서 다시는 승격시키지 않을 신호로 씀). 단 이 "확정 0"은
          // TITAN_OPTIMIZER_VERIFY_ITERATIONS(500)회가 아니라 2단계(15) + 이 확인(50) = 65회만
          // 관찰한 결과라, n을 실제 관찰 횟수(65)로 정직하게 남겨둠(통계적 동률 판정에서 500회
          // 검증한 다른 후보와 공정하게 비교하기 위함)
          preResolved.push({
            names: f.names, dps: f.dps, avgDeadCount: 0, survivalQuality: 1,
            n: TITAN_OPTIMIZER_FINAL_ITERATIONS + TITAN_OPTIMIZER_CAP_CHECK_ITERATIONS,
            avgTimeSec: capCheckResult.avgTimeSec, avgTotalDmg: capCheckResult.avgTotalDmg,
            capConfirmed: true
          });
          continue;
        }
        // 확인 중 죽는 시행이 나왔음 - "가끔 죽는 조합"으로 판명됐으니 아래 예비 검증으로 넘어감
      }

      btn.textContent = t("titan.optimize.stage3PrescanProgress", { current: i + 1, total: finalists.length });
      const prescanResult = await runTitanSimulation({
        ...buildSimBaseCfg(selectedRunes),
        continuousBattle: true, // 조합 찾기는 항상 연속 전투 기준 - 위 2단계 주석 참고
        iterations: TITAN_OPTIMIZER_PRESCAN_ITERATIONS,
        collectLog: false,
        batchSize: 20
      });
      preResolved.push({
        names: f.names, dps: f.dps, avgDeadCount: prescanResult.avgDeadCount,
        survivalQuality: 1 / (1 + prescanResult.avgDeadCount), n: TITAN_OPTIMIZER_PRESCAN_ITERATIONS,
        avgTimeSec: prescanResult.avgTimeSec, avgTotalDmg: prescanResult.avgTotalDmg,
        capConfirmed: false
      });
    }

    // 3-2단계: 예비 결과 전체를 놓고, 이미 확실히 밀리는(생존 1등을 이길 통계적 가능성도 없고
    // 대미지도 최댓값 근처가 아닌) 후보만 예비 표본에서 멈추고, 나머지(진짜 경합 중인 후보 -
    // 대미지 최고 조합은 늘 자기 자신이 최댓값이라 항상 여기 해당됨)만 500회로 승격시킴. capConfirmed
    // 후보(2단계 지름길로 이미 확정)는 기존 최적화 그대로 재검증 없이 씀.
    const maxDpsAmongFinalists = Math.max(...preResolved.map((r) => r.dps));
    const survivalLeader = preResolved.reduce((a, b) => (a.avgDeadCount <= b.avgDeadCount ? a : b));
    const verified = [];
    for (let i = 0; i < preResolved.length; i++) {
      const r = preResolved[i];
      btn.textContent = t("titan.optimize.stage3FinalProgress", { current: i + 1, total: preResolved.length });
      btn.style.setProperty("--progress", String(85 + (i / preResolved.length) * 15));

      if (r.capConfirmed) { verified.push(r); continue; }

      const survivalContender = titanDeathCountsStatisticallyTied(
        r.avgDeadCount * r.n, r.n, survivalLeader.avgDeadCount * survivalLeader.n, survivalLeader.n
      );
      const damageContender = r.dps >= maxDpsAmongFinalists * TITAN_OPTIMIZER_CONTENDER_DPS_RATIO;

      if (survivalContender || damageContender) {
        const verifyResult = await runTitanSimulation({
          ...buildSimBaseCfg(r.names.map((name) => ({ name, lv: levels[name] }))),
          continuousBattle: true, // 조합 찾기는 항상 연속 전투 기준 - 위 2단계 주석 참고
          iterations: TITAN_OPTIMIZER_VERIFY_ITERATIONS,
          collectLog: false,
          batchSize: 20
        });
        verified.push({
          names: r.names, dps: r.dps, avgDeadCount: verifyResult.avgDeadCount,
          survivalQuality: 1 / (1 + verifyResult.avgDeadCount), n: TITAN_OPTIMIZER_VERIFY_ITERATIONS,
          avgTimeSec: verifyResult.avgTimeSec, avgTotalDmg: verifyResult.avgTotalDmg
        });
      } else {
        // 예비 표본만으로 이미 통계적으로 못 이긴다는 게 확인됨 - 500회를 더 쓰지 않고 예비
        // 표본을 그대로 최종 결과에 사용(정확도 손해 없음 - 애초에 이길 수 없는 후보라 순위에
        // 영향이 없음)
        verified.push(r);
      }
    }

    // "가장 안 죽는 조합"은 avgDeadCount(300회 평균 사망 횟수)가 가장 낮은 조합을 1순위로 함 -
    // 연속 전투 하에서는 죽어도 무한 재소환되므로 "한 번도 안 죽을 확률"이 아니라 "평균적으로
    // 몇 번 죽는지"가 실제로 의미 있는 지표. 동률이면 대미지로 2차 정렬 - 사망 횟수가 똑같이
    // 최소라면 나머지는 딜이 제일 잘 나오는 걸 넣는 게 맞음(생존은 전혀 손해 안 보면서 대미지만
    // 덤으로 챙기는 셈). "동률" 판단은 단순 반올림이 아니라 통계 검정으로 함 - 실측 확인(500회
    // 검증에서 여러 후보의 실제 사망 횟수를 로그로 직접 비교) 결과, 위험도가 통계적으로 구분 안
    // 되는 후보들(예: 500회 중 4번 죽음 vs 10번 죽음 - 표본이 작아 흔히 나는 차이)끼리도 소수점
    // 반올림값이 갈리면(0.008->0.01회 vs 0.02->0.02회) 그 미세한 차이 하나로 승자가 결정돼서,
    // 화면엔 "똑같이 안전해 보이는" 후보들 중 대미지가 훨씬 낮은 쪽이 순전히 표본 운으로 뽑히는
    // 경우가 있었음(단순 반올림 동률 판정으로는 못 잡음). 두 후보의 관찰 횟수(n)가 다를 수 있어서
    // (위 "확정 0" 지름길은 65회, 일반 검증은 500회) 단순 rate 차이 비교 대신 이항분포 기반
    // 조건부 검정을 씀: "두 후보의 진짜 위험률이 같다"는 가정 하에 둘을 합친 총 사망 횟수 중
    // A가 차지할 비율은 노출 비율(n_A/(n_A+n_B))을 따르는 이항분포이므로, 실제 관측된 A의
    // 사망 횟수가 그 기댓값의 ±2표준편차 안이면 통계적으로 구분 안 되는 동률로 취급함(관찰
    // 횟수가 다른 두 표본도 공정하게 비교 가능 - 65회 만에 확정된 "0회"가 500회 검증한
    // 수십 회짜리 후보보다 무조건 안전하다고 과신하지 않게 됨). 이 동률 안에서는 딜이 제일
    // 높은 걸 우선함
    const bestSurvival = verified.reduce((a, b) => {
      const tied = titanDeathCountsStatisticallyTied(a.avgDeadCount * a.n, a.n, b.avgDeadCount * b.n, b.n);
      if (!tied) return b.avgDeadCount < a.avgDeadCount ? b : a;
      return b.dps > a.dps ? b : a;
    });
    // 균형 조합은 "생존" 축을 survivalQuality(1/(1+평균 사망 횟수), 이미 0~1이라 별도 정규화
    // 불필요)로 씀 - DPS만 검증된 최종 후보군 내 최댓값 기준으로 정규화한 뒤 titanBalanceScore로
    // 합침(위 TITAN_BALANCE_DPS_WEIGHT 주석 참고 - DPS 쪽에 더 큰 가중치를 준 기하평균이라, 한쪽에
    // 극단적으로 치우친 조합은 여전히 낮게 나오되 대미지 비중이 더 큼). 임계값/퍼센트 기준 없이
    // "다들 많이 죽는 상황이면 생존 쪽으로, 다들 안 죽는 상황이면 딜 쪽으로" 자연스럽게 쏠리는 게
    // 이 공식의 핵심(사용자와 논의해서 확정한 방향). maxDps는 finalists에 항상 bestDpsAll(전체
    // 조합 중 진짜 DPS 최댓값)이 포함돼 있어 정확한 값.
    const maxDps = Math.max(...verified.map((r) => r.dps));
    const bestBalance = verified.reduce((a, b) => {
      const scoreA = titanBalanceScore(a.dps / maxDps, a.survivalQuality);
      const scoreB = titanBalanceScore(b.dps / maxDps, b.survivalQuality);
      return scoreB > scoreA ? b : a;
    });
    const bestDpsEntry = verified.find((r) => r.names.join("|") === bestDpsAll.names.join("|"));

    btn.disabled = false;
    btn.textContent = t("titan.optimize.startBtn");
    btn.classList.remove("btn-progress");
    btn.style.removeProperty("--progress");

    const fmtDeaths = (n) => t("titan.optimize.avgDeathCountValue", { count: n.toFixed(2) });
    const fmtTime = (sec) => t("titan.optimize.timeFormat", { m: Math.floor(sec / 60), s: Math.floor(sec % 60) });
    const comboLine = (names) => names.map((n) => `${ruleDisplayName(n)} Lv.${levels[n]}`).join(" · ");
    // "예상 초당 대미지"는 1단계 이론값이 아니라 이 조합을 실제로 검증한 시뮬레이션 결과(평균
    // 대미지 합계 ÷ 평균 사망 시간)에서 그대로 유도함 - 화면에 같이 뜨는 "평균 대미지 합계"와
    // 항상 같은 시뮬레이션에서 나온 값이라 서로 앞뒤가 안 맞을 일이 없음(예전엔 1단계 해석값을
    // 그대로 썼는데, 실측(빠른 계산 등)과 비교하면 소스가 달라서 미세한 차이가 눈에 띌 수 있었음)
    const dpsOf = (r) => (r.avgTimeSec > 0 ? r.avgTotalDmg / r.avgTimeSec : 0);
    const comboBoxHtml = (title, r) => `
      <div class="dummy-optimize-result-box">
        <div class="report-grid">
          <div class="report-tile dummy-optimize-best-tile">
            <div class="metric-label">${title}</div>
            <div class="dummy-optimize-best-combo" title="${t("titan.optimize.comboClickTooltip")}">${comboLine(r.names)}</div>
          </div>
          <div class="report-tile"><div class="metric-label">${t("titan.optimize.avgDeathTimeLabel")}</div><div class="metric-value">${fmtTime(r.avgTimeSec)}</div></div>
          <div class="report-tile"><div class="metric-label">${t("titan.optimize.avgDeathCountLabel")}</div><div class="metric-value">${fmtDeaths(r.avgDeadCount)}</div></div>
          <div class="report-tile"><div class="metric-label">${t("titan.optimize.estimatedDpsLabel")}</div><div class="metric-value accent">${Math.round(dpsOf(r)).toLocaleString()}</div></div>
          <div class="report-tile"><div class="metric-label">${t("titan.optimize.totalDmgLabel")}</div><div class="metric-value accent">${Math.round(r.avgTotalDmg).toLocaleString()}</div></div>
        </div>
      </div>
    `;

    resultEl.innerHTML = `
      ${slotCount < 5 ? `<p class="quickcalc-desc">${t("titan.optimize.limitedSlotMsg", { count: owned.length, slotCount })}</p>` : ""}
      ${comboBoxHtml(t("titan.optimize.bestSurvivalTitle"), bestSurvival)}
      ${comboBoxHtml(t("titan.optimize.bestDpsTitle"), bestDpsEntry)}
      ${comboBoxHtml(t("titan.optimize.bestBalanceTitle"), bestBalance)}
    `;

    const comboEntries = [bestSurvival, bestDpsEntry, bestBalance];
    resultEl.querySelectorAll(".dummy-optimize-best-combo").forEach((el, i) => {
      el.onclick = () => {
        const runes = comboEntries[i].names.map((name) => ({ name, lv: levels[name] }));
        titanOpenApplyPresetModal(runes);
      };
    });
  }

  document.getElementById("titanApplyPresetClose").onclick = titanCloseApplyPresetModal;
  document.getElementById("titanApplyPresetConfirmBtn").onclick = titanConfirmApplyPreset;
  enableDragScroll(document.getElementById("titanApplyPresetList"));

  titanInitModeTabs();
  titanInitSpeedDropdown();
  titanInitLiveControls();
  // 시뮬레이션 시작 버튼을 눌러야만 숨겨진 공룡 체력바가 생기던 문제 - 탭 진입/페이지 로드
  // 시점에 미리 한 번 그려둬서 처음부터 공룡 수만큼 다 보이게 함(시뮬레이션 시작 전 리셋 상태)
  titanLiveReset();
  titanInitOwnedRuneGrid();
  titanResetQuickCalc();

  // 로그인 상태면 "내 공룡" 대신 실제 닉네임을 보여줌(js/ui/dino-display-ui.js, 다이노 배틀 페이지가
  // 먼저 확정한 방식과 통일 - 사용자 확정 "로그인 하면 닉네임 보이는거... 통일시켜"). 비동기 조회가
  // 끝나기 전까지는 getMyDisplayNameSync()의 폴백("내 공룡")이 즉시 보이도록 동기 호출도 한 번 먼저 함.
  // .titan-hex-avatar-mine으로 범위를 좁혀야 함 - 타이탄(보스) 이름표도 같은 .titan-hex-avatar-name
  // 클래스를 쓰는데, 범위를 안 좁히면 이 함수가 보스 이름표까지 "내 공룡"으로 덮어써버림(실측으로
  // 발견 - 타이탄 이름표를 새로 추가하자마자 "타이탄" 대신 "내 공룡"이 뜸)
  applyMyDisplayName(".titan-hex-avatar-mine .titan-hex-avatar-name");
  loadMyDisplayName().then(() => applyMyDisplayName(".titan-hex-avatar-mine .titan-hex-avatar-name"));
}
