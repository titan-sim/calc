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
// 조합 찾기는 조합 수가 많으면(보유 룬이 많을수록 기하급수적으로 늘어남) 매번 정밀 시뮬레이션을
// 돌리기엔 너무 느려서 3단계로 나눔: 1단계는 모든 조합의 DPS/생존 시간/균형 점수를 시뮬레이션 없이
// estimateTitanSurvivalSec()(js/core/stat-calc.js)로 즉시 계산해 후보만 추리고, 2단계는 그 후보만
// 실제 시뮬레이션으로 재계산, 3단계는 2단계 결과 상위권(최종 후보) 몇 개만 회차를 훨씬 더 높여
// 다시 검증함 - 2단계의 표본이 우연히 좋게(또는 나쁘게) 나온 조합이 승자로 잘못 뽑히는 걸 막기
// 위함(표본 수가 적을수록 우연히 뽑힌 평균이 진짜 기댓값과 크게 벗어날 가능성이 커짐 - 시드를
// 고정해 결과를 재현 가능하게 만드는 방법도 검토했었지만, 그건 "우연히 나쁜 표본"을 매번 똑같이
// 재현할 뿐 진짜 값에 더 가까워지는 게 아니라서 기각함).
//
// 실측 결과 가장 느린 경우는 "다들 제한 시간까지 안 죽고 버티는" 시나리오(매 회차가 최대
// 5400틱까지 통째로 도는 데다 회차 수도 많아서 몇십~백초까지 걸림) - 이 경우를 겨냥해 3단계에서
// "2단계 표본이 이미 전부(예외 없이) 제한 시간까지 버틴 게 확인된 조합"은 300회 전체 검증 대신
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
const TITAN_OPTIMIZER_VERIFY_ITERATIONS = 300;
const TITAN_OPTIMIZER_VERIFY_TOP_N = 5;
const TITAN_OPTIMIZER_CAP_CHECK_ITERATIONS = 50;
const TITAN_OPTIMIZER_CANDIDATE_COUNT = 30;

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
    <div class="warning">※ 본 시뮬레이터는 참고용이며, 실제 연산 방식과 차이가 있을 수 있습니다.</div>

    <div id="myDinoSection"></div>

    <div class="card">
      <h2>관련 수치</h2>
      <div class="metrics-grid" id="metricsGrid">
        <button type="button" class="metric-tile" data-metric="basicDmg">
          <div class="metric-label">평타 대미지</div>
          <div class="metric-value" id="metricBasicDmg">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="skillDmg">
          <div class="metric-label">스킬 대미지</div>
          <div class="metric-value" id="metricSkillDmg">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="atkAmp">
          <div class="metric-label">공격력 증폭량</div>
          <div class="metric-value" id="metricAtkAmp">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="finalAvgDmg">
          <div class="metric-label">최종 평균 대미지</div>
          <div class="metric-value" id="metricFinalAvgDmg">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="reduction">
          <div class="metric-label">대미지 감소량</div>
          <div class="metric-value" id="metricReduction">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="recovery">
          <div class="metric-label">회복량</div>
          <div class="metric-value" id="metricRecovery">0</div>
        </button>
      </div>
      <div class="metric-detail" id="metricDetail" style="display:none;"></div>
    </div>

    <div class="card battle-main-card" id="titanMainCard">
      <div class="battle-mode-tabs titan-mode-tabs-4" id="titanModeTabs" data-active-idx="0">
        <span class="battle-mode-indicator" id="titanModeIndicator"></span>
        <button class="battle-mode-tab active" data-mode="settings" id="titanModeTabSettings"><span>전투 설정</span></button>
        <button class="battle-mode-tab" data-mode="quick" id="titanModeTabQuick"><span>빠른 계산</span></button>
        <button class="battle-mode-tab" data-mode="live" id="titanModeTabLive"><span>시뮬레이션</span></button>
        <button class="battle-mode-tab" data-mode="optimize" id="titanModeTabOptimize"><span>조합 찾기</span></button>
      </div>

      <div class="battle-mode-panel" id="titanSettingsModeCard">
        <div class="titan-settings-grid">
          <div class="titan-settings-row">
            <div class="setting-label">자연 구조물과 인접</div>
            <label class="switch"><input type="checkbox" id="titanNatureToggle"><span class="slider round"></span></label>
          </div>
          <div class="titan-settings-row">
            <div class="setting-label">부족 점령 상태</div>
            <label class="switch"><input type="checkbox" id="titanTribeToggle"><span class="slider round"></span></label>
          </div>
          <!-- 모바일에서는 라벨 옆에 드롭다운/입력칸을 붙이면 폭이 부족해 화살표·단위 텍스트가
               목록/입력값과 겹쳤음. 전부 "라벨 위 / 조작요소 아래" 스택으로 재배치:
               (공격력·체력 버프 타워) / (타이탄 레벨 단독) / (전투 제한시간·타이탄 거리) -->
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">공격력 버프 타워</label>
              <div class="custom-dropdown" id="titanAtkTowerDropdown">
                <div class="selected-value" id="titanAtkTowerSelectedValue">없음</div>
                <ul class="dropdown-list" id="titanAtkTowerList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">체력 버프 타워</label>
              <div class="custom-dropdown" id="titanHpTowerDropdown">
                <div class="selected-value" id="titanHpTowerSelectedValue">없음</div>
                <ul class="dropdown-list" id="titanHpTowerList"></ul>
              </div>
            </div>
          </div>
          <div class="titan-settings-stack titan-settings-fullstack">
            <label class="setting-label">타이탄 레벨</label>
            <div class="custom-dropdown" id="titanDropdown">
              <div class="selected-value" id="titanSelectedValue">Lv.1</div>
              <ul class="dropdown-list" id="titanList"></ul>
            </div>
          </div>
          <div class="titan-settings-levelblock">
            <div class="titan-settings-stack">
              <label class="setting-label">전투 제한시간</label>
              <div class="custom-dropdown" id="timeDropdown">
                <div class="selected-value" id="timeSelectedValue">90분</div>
                <ul class="dropdown-list" id="timeList"></ul>
              </div>
            </div>
            <div class="titan-settings-stack">
              <label class="setting-label">타이탄 거리</label>
              <div class="affix-input has-suffix"><input type="tel" id="fDistance" value="1"><span class="affix-suffix">타일</span></div>
            </div>
          </div>
          <!-- 연속 전투는 짝이 없어져서 혼자 전체 폭을 차지하되, 토글이라 왼쪽이 허전해 보이지
               않도록 라벨+버튼 전체를 오른쪽으로 붙임 -->
          <div class="titan-settings-row titan-settings-row-full titan-settings-row-end">
            <div class="setting-label">연속 전투</div>
            <label class="switch"><input type="checkbox" id="continuousToggle"><span class="slider round"></span></label>
          </div>
        </div>
      </div>

      <div class="battle-mode-panel" id="titanQuickModeCard" style="display:none;">
        <div class="titan-quick-summary" id="titanQuickSummary"></div>
        <button class="btn-simulate" id="titanQcBtn">빠른 계산하기</button>
        <div id="battleReport" class="report-box" style="display:none;">
          <div class="report-grid">
            <div class="report-tile"><div class="metric-label">총 입힌 피해량</div><div class="metric-value accent" id="repTotalDmg">0</div></div>
            <div class="report-tile"><div class="metric-label">남은 타이탄 체력</div><div class="metric-value accent" id="repTitanHp">0</div></div>
            <div class="report-tile"><div class="metric-label">평균 생존 시간</div><div class="metric-value" id="repTime">0</div></div>
            <div class="report-tile"><div class="metric-label">평균 공룡 사망 수</div><div class="metric-value" id="repDead">0</div></div>
          </div>
          <div class="report-chart-section">
            <div class="report-chart-label">시간대별 공룡 체력 변화 추이</div>
            <div class="report-chart-box">
              <canvas id="hpChart"></canvas>
            </div>
            <div id="avgMinHpPer" class="report-survival">평균 생존 체력: 0%</div>
          </div>
        </div>
      </div>

      <div class="battle-mode-panel" id="titanOptimizeModeCard" style="display:none;">
        <div class="dummy-optimizer">
          <h3 class="dummy-optimizer-title">내 룬 레벨로 최적 조합 찾기</h3>
          <p class="quickcalc-desc">적합 룬 중 보유한 룬의 레벨을 입력하세요(0 = 미보유). 지금 전투 설정 기준으로 "공룡 1마리당 생존 시간이 가장 긴 조합", "시간당 대미지가 가장 높은 조합", "둘의 균형이 가장 좋은 조합"을 찾아줍니다. 조합 수가 많으면 시간이 걸릴 수 있습니다.</p>
          <div class="dummy-owned-rune-grid" id="titanOwnedRuneGrid"></div>
          <button class="btn-simulate" id="titanOptimizeBtn">조합 찾기 시작</button>
          <div id="titanOptimizeResult"></div>
        </div>
      </div>

      <div class="battle-mode-panel" id="titanLiveModeCard" style="display:none;">
        <!-- 바닥(육각형 2개, 인접 타일)만 진짜 3D 공간에서 rotateX로 기울이고, 그 위에 올라가는
             공룡/타이탄 아바타는 3D 변환을 아예 안 씀 - 대신 rotateX(55deg)가 순수 회전이라고
             가정했을 때의 좌표 압축 공식(세로 = 중심 기준 cos(55°)≈0.5736배)을 좌표 계산으로 직접
             적용해서 평면 원형 아바타를 정확한 위치에 배치함. 3D 중첩 변환에서 생기던 렌더링
             아티팩트가 구조적으로 발생할 수 없고, 계산도 고정 배율이라 화면 크기와 무관하게 항상 맞음 -->
        <div class="titan-duel-wrap">
          <div class="titan-hex-hpbar-list" id="titanMyHpBars"></div>

          <div class="dummy-field-wrap titan-duel-field">
            <!-- stage 하나가 곧 결합 좌표계(175x129.9) - 바닥(3D 기울임)과 아바타 오버레이(평면,
                 좌표 계산만 적용)가 정확히 같은 박스를 공유해서 패딩 등으로 인한 어긋남이 없음 -->
            <div class="titan-duel-stage">
              <div class="titan-duel-tilt">
                <svg class="titan-duel-floor-svg" viewBox="0 0 175 129.9" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <!-- gradientUnits를 기본값(objectBoundingBox)으로 두면 cx/cy%가 "각 폴리곤 자기
                         bbox 기준" 퍼센트라서 육각형의 실제 시각적 중심과 어긋난 곳에 하이라이트가
                         생김(색칠이 한쪽으로 쏠려 보이던 원인) - userSpaceOnUse로 바꿔서 뷰박스
                         좌표(육각형의 진짜 중심)를 직접 지정 -->
                    <radialGradient id="titanHexGradientMine" gradientUnits="userSpaceOnUse" cx="50" cy="86.6" r="45">
                      <stop offset="0%" style="stop-color:var(--accent); stop-opacity:0.35"></stop>
                      <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                    </radialGradient>
                    <radialGradient id="titanHexGradientBoss" gradientUnits="userSpaceOnUse" cx="125" cy="43.3" r="45">
                      <stop offset="0%" style="stop-color:#e0473f; stop-opacity:0.35"></stop>
                      <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                    </radialGradient>
                  </defs>
                  <polygon points="25,43.3 75,43.3 100,86.6 75,129.9 25,129.9 0,86.6" fill="url(#titanHexGradientMine)"></polygon>
                  <polygon points="100,0 150,0 175,43.3 150,86.6 100,86.6 75,43.3" fill="url(#titanHexGradientBoss)"></polygon>
                  <!-- 테두리는 채우기와 분리한 열린 path로 그림: 두 육각형이 공유하는 변(75,43.3 ~
                       100,86.6)은 금색/적색 어느 쪽 테두리에도 포함하지 않아서 겹쳐 그려지며
                       anti-alias로 서로의 색이 "새는" 것처럼 번지던 문제를 없애고, 그 변만 따로
                       중립(두 진영 색 혼합) 색 한 줄로 한 번만 그려서 경계선 자체는 살아있게 함 -->
                  <path d="M100,86.6 L75,129.9 L25,129.9 L0,86.6 L25,43.3 L75,43.3" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"></path>
                  <path d="M75,43.3 L100,0 L150,0 L175,43.3 L150,86.6 L100,86.6" fill="none" stroke="#e0473f" stroke-width="2" vector-effect="non-scaling-stroke"></path>
                  <path d="M75,43.3 L100,86.6" fill="none" stroke="color-mix(in srgb, var(--accent) 50%, #e0473f)" stroke-width="2" vector-effect="non-scaling-stroke"></path>
                </svg>
              </div>

              <div class="titan-hex-anchor titan-anchor-mine" id="titanMyTarget">
                <div class="titan-hex-avatar titan-hex-avatar-mine titan-hex-avatar-slot0" data-slot="0"><div class="titan-hex-avatar-ball"></div><div class="titan-hex-avatar-hpbar"><div class="titan-hex-avatar-hpfill titan-hex-hpfill-mine"></div></div></div>
                <div class="titan-hex-avatar titan-hex-avatar-mine titan-hex-avatar-slot1" data-slot="1"><div class="titan-hex-avatar-ball"></div><div class="titan-hex-avatar-hpbar"><div class="titan-hex-avatar-hpfill titan-hex-hpfill-mine"></div></div></div>
                <div class="titan-hex-avatar titan-hex-avatar-mine titan-hex-avatar-slot2" data-slot="2"><div class="titan-hex-avatar-ball"></div><div class="titan-hex-avatar-hpbar"><div class="titan-hex-avatar-hpfill titan-hex-hpfill-mine"></div></div></div>
                <div class="titan-hex-anchor-popup-layer" id="titanMyPopupLayer"></div>
              </div>
              <div class="titan-hex-anchor titan-anchor-boss" id="titanBossTarget">
                <div class="titan-hex-avatar titan-hex-avatar-boss">
                  <div class="titan-hex-avatar-ball"></div>
                  <div class="titan-hex-avatar-hpbar titan-hex-avatar-hpbar-boss">
                    <div class="titan-hex-avatar-hpfill titan-hex-hpfill-boss" id="titanBossHpFill"></div>
                    <div class="titan-hex-avatar-hp-text" id="titanBossHpText"></div>
                  </div>
                </div>
                <div class="titan-hex-anchor-popup-layer" id="titanBossPopupLayer"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="battle-controls">
          <div class="custom-dropdown battle-speed-dropdown" id="titanSpeedDropdown">
            <div class="selected-value" id="titanSpeedSelectedValue">보통</div>
            <ul class="dropdown-list" id="titanSpeedList"></ul>
          </div>
          <button class="btn-simulate" id="titanLiveStartBtn">시뮬레이션 시작</button>
          <button class="battle-restart-btn" id="titanLiveRestartBtn" disabled title="처음부터 다시 시작">↻</button>
        </div>

        <div class="report-grid titan-live-stats" id="titanLiveStats" style="display:none;">
          <div class="report-tile"><div class="metric-label">누적 대미지</div><div class="metric-value accent" id="titanLiveDmg">0</div></div>
          <div class="report-tile"><div class="metric-label">현재 초당 대미지</div><div class="metric-value" id="titanLiveDps">0</div></div>
          <div class="report-tile"><div class="metric-label">사망한 공룡 수</div><div class="metric-value" id="titanLiveDead">0마리</div></div>
          <div class="report-tile"><div class="metric-label">경과(생존) 시간</div><div class="metric-value" id="titanLiveSurvival">0초</div></div>
        </div>
      </div>
    </div>
  `;

  initTitanPage();
}

function initTitanPage() {
  let lastMetrics = null;
  let activeMetricKey = null;

  renderMyDinoPage(document.getElementById("myDinoSection"), {
    unsuitableList: UNSUITABLE_RUNE_LIST,
    unsuitableLabel: "타이탄에 적합하지 않은 룬입니다",
    onChange: () => { refreshMetricsCard(); titanResetAllCalc(); }
  });

  function initMetricsCard() {
    document.querySelectorAll(".metric-tile").forEach((tile) => {
      tile.onclick = () => {
        const key = tile.dataset.metric;
        activeMetricKey = activeMetricKey === key ? null : key;
        document.querySelectorAll(".metric-tile").forEach((t) => t.classList.toggle("active", t.dataset.metric === activeMetricKey));
        renderMetricDetail();
      };
    });
  }

  function setMetricTile(id, value) {
    const el = document.getElementById(id);
    const rounded = Math.round(value);
    el.innerText = rounded.toLocaleString();
    el.classList.toggle("value-changed", rounded !== 0);
  }

  function refreshMetricsCard() {
    const dino = getMyDinoBattleInputs();
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

    if (activeMetricKey === "basicDmg") {
      title = "평타 대미지 계산 내역";
      rows = [
        { label: "증폭 전 공격력", value: Math.round(m.finalAtk).toLocaleString() },
        { label: "증폭 후 공격력", value: Math.round(m.ampFinalAtk).toLocaleString() },
        { label: "치명타 확률", value: `${m.cRate.toFixed(2)}%` },
        { label: "치명타 피해", value: `${m.cDmg.toFixed(2)}%` }
      ];
    } else if (activeMetricKey === "atkAmp") {
      title = "공격력 증폭 내역";
      if (m.bossSlayerPercent > 0) {
        rows = [{ label: `보스 슬레이어 (증폭 +${m.bossSlayerPercent.toFixed(2)}%)`, value: `+${Math.round(m.atkAmpGain).toLocaleString()}` }];
      }
    } else if (activeMetricKey === "skillDmg") {
      title = "스킬 대미지 내역";
      rows = m.skillDetails.map((d) => ({ label: d.name, value: Math.round(d.avgDmg).toLocaleString() }));
    } else if (activeMetricKey === "finalAvgDmg") {
      title = "최종 평균 대미지 계산 내역";
      rows = [
        { label: "평타 대미지", value: Math.round(m.avgHitDamage).toLocaleString() },
        { label: "스킬 대미지 합계", value: Math.round(m.skillDmgTotal).toLocaleString() }
      ];
    } else if (activeMetricKey === "reduction") {
      title = "대미지 감소 내역";
      rows = m.reductions.map((r) => {
        if (r.type === "shield") {
          return { label: `${r.name} (${r.turn}회 ${r.red_p}% 감소)`, value: "-" };
        }
        return {
          label: r.type === "flat" ? r.name : `${r.name} (${r.prob}% 확률)`,
          value: Math.round(r.avg).toLocaleString()
        };
      });
    } else if (activeMetricKey === "recovery") {
      title = "회복량 내역";
      rows = m.recoveries.map((r) => ({
        label: `${r.name} (${r.prob}% 확률)`,
        value: Math.round(r.avg).toLocaleString()
      }));
    }

    if (rows.length === 0) {
      box.innerHTML = `<div class="metric-detail-title">${title}</div><div class="metric-detail-empty">장착된 관련 룬이 없습니다</div>`;
    } else {
      box.innerHTML = `<div class="metric-detail-title">${title}</div>${rows
        .map((r) => `<div class="metric-detail-row"><span>${r.label}</span><span>${r.value}</span></div>`)
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
      const labelFor = (v) => BUFF_TOWER_OPTIONS.find((o) => o.value === v).label;
      selectedValue.textContent = labelFor(settings[key]);
      BUFF_TOWER_OPTIONS.forEach((opt) => {
        const li = document.createElement("li");
        li.textContent = opt.label;
        li.onclick = () => {
          settings[key] = opt.value;
          selectedValue.textContent = opt.label;
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
  }
  titanInitTileSettings();

  // 타이탄 레벨 커스텀 드롭다운
  const titanList = document.getElementById("titanList");
  const titanSelectedValue = document.getElementById("titanSelectedValue");
  let titanLevel = 1;
  for (let lv = 1; lv <= 120; lv++) {
    const { atk, hp } = TITAN_STATS[lv];
    const li = document.createElement("li");
    const label = `Lv. ${lv} (ATK ${atk} / HP ${hp.toLocaleString()})`;
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
    li.textContent = `${m}분`;
    li.onclick = () => {
      timeSelectedValue.textContent = `${m}분`;
      timeLimitMinutes = m;
      timeList.style.display = "none";
      saveConfig();
      titanResetAllCalc();
    };
    timeList.appendChild(li);
  }
  timeSelectedValue.onclick = () => toggleDropdownList(timeSelectedValue, timeList);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-dropdown")) {
      document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
    }
  });

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
    const t = TITAN_STATS[titanLevel];
    titanSelectedValue.textContent = `Lv. ${titanLevel} (ATK ${t.atk} / HP ${t.hp.toLocaleString()})`;
    timeLimitMinutes = cfg.timeLimitMinutes || 90;
    timeSelectedValue.textContent = `${timeLimitMinutes}분`;
    distanceTiles = Math.max(1, cfg.distanceTiles || 1);
    fDistance.value = distanceTiles;
    continuousBattle = cfg.continuousBattle || false;
    continuousToggle.checked = continuousBattle;
  }
  loadConfig();

  // 지금 설정을 runTitanSimulation cfg 형태로 모아주는 헬퍼(빠른 계산/실전 시뮬레이션/조합 찾기가 공통으로 씀)
  function buildSimBaseCfg(selectedRunesOverride) {
    const dino = getMyDinoBattleInputs();
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
      };
    });
    document.getElementById("titanQcBtn").onclick = titanRunQuickCalc;
    document.getElementById("titanOptimizeBtn").onclick = titanRunOptimizer;
  }

  // ===== 빠른 계산 =====
  function titanRenderQuickSummary() {
    const tileCfg = loadTitanTileSettings();
    const atkLabel = tileCfg.atkTowerLevel !== null ? `+${BUFF_TOWER_PERCENTS[tileCfg.atkTowerLevel]}%` : "없음";
    const hpLabel = tileCfg.hpTowerLevel !== null ? `+${BUFF_TOWER_PERCENTS[tileCfg.hpTowerLevel]}%` : "없음";
    const t = TITAN_STATS[titanLevel];
    // 진짜 2열 grid + 실선 구분(칸마다 border) - 가짜 중앙선(::before)은 4열 grid의 실제 폭이
    // 항상 정확히 반반은 아니라서 어긋나 보일 수 있어 대신 이 방식으로 확실하게 좌우를 나눔
    document.getElementById("titanQuickSummary").innerHTML = `
      <div class="titan-quick-summary-grid">
        <div class="titan-quick-summary-col">
          <div class="titan-quick-summary-item"><span>공격력 버프타워</span><b>${atkLabel}</b></div>
          <div class="titan-quick-summary-item"><span>타이탄</span><b>Lv.${titanLevel} (HP ${t.hp.toLocaleString()})</b></div>
          <div class="titan-quick-summary-item"><span>타이탄과의 거리</span><b>${distanceTiles}타일</b></div>
        </div>
        <div class="titan-quick-summary-col">
          <div class="titan-quick-summary-item"><span>체력 버프타워</span><b>${hpLabel}</b></div>
          <div class="titan-quick-summary-item"><span>전투 제한시간</span><b>${timeLimitMinutes}분</b></div>
          <div class="titan-quick-summary-item"><span>연속 전투</span><b>${continuousBattle ? "ON" : "OFF"}</b></div>
        </div>
      </div>
    `;
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
      onProgress: (c, total) => { btn.textContent = `계산 중 (${c}/${total})...`; btn.style.setProperty("--progress", String((c / total) * 100)); }
    };
    const result = await runTitanSimulation(cfg);
    renderReport(result);
    btn.disabled = false;
    btn.textContent = "빠른 계산하기";
    btn.classList.remove("btn-progress");
    btn.style.removeProperty("--progress");
  }

  function titanResetQuickCalc() {
    titanRenderQuickSummary();
    const optimizeResult = document.getElementById("titanOptimizeResult");
    if (optimizeResult) optimizeResult.innerHTML = "";
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

  function titanInitSpeedDropdown() {
    const currentMs = titanGetSpeedMs();
    const list = document.getElementById("titanSpeedList");
    const selectedValue = document.getElementById("titanSpeedSelectedValue");
    selectedValue.textContent = BATTLE_SPEED_OPTIONS.find((o) => o.ms === currentMs).label;
    BATTLE_SPEED_OPTIONS.forEach((opt) => {
      const li = document.createElement("li");
      li.textContent = opt.label;
      li.onclick = () => {
        localStorage.setItem(TITAN_SPEED_KEY, String(opt.ms));
        selectedValue.textContent = opt.label;
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

  function titanResetLiveStats() {
    document.getElementById("titanLiveStats").style.display = "none";
    document.getElementById("titanLiveDmg").innerText = "0";
    document.getElementById("titanLiveDps").innerText = "0";
    document.getElementById("titanLiveDead").innerText = "0마리";
    document.getElementById("titanLiveSurvival").innerText = "0초";
  }

  function titanLiveReset() {
    titanReplayRunning = false;
    clearInterval(titanReplayTimer);
    titanReplayLogs = [];
    titanReplayIdx = 0;
    titanFirstDeathTick = null;
    document.getElementById("titanLiveStartBtn").disabled = false;
    document.getElementById("titanLiveStartBtn").textContent = "시뮬레이션 시작";
    document.getElementById("titanLiveStartBtn").classList.remove("btn-progress");
    document.getElementById("titanLiveStartBtn").style.removeProperty("--progress");
    document.getElementById("titanLiveRestartBtn").disabled = true;
    titanResetLiveStats();
    document.getElementById("titanBossHpFill").style.width = "100%";
    document.getElementById("titanBossHpText").textContent =
      `${TITAN_STATS[titanLevel].hp.toLocaleString()} / ${TITAN_STATS[titanLevel].hp.toLocaleString()}`;
    titanBuildHpBars(getMyDinoBattleInputs().count || 1);
    // 처음 3마리는 타일 위 아바타로 이미 표시되므로, 사이드바 쪽 같은 인덱스는 숨겨야 함
    // (안 그러면 시뮬레이션 시작 전에는 타일 3마리 + 사이드바 전체 N마리가 같이 보이는 버그가 생김)
    document.querySelectorAll("#titanMyHpBars .titan-hex-hpbar").forEach((bar, i) => {
      bar.style.display = i < TITAN_VISIBLE_DINO_SLOTS ? "none" : "";
      const fill = bar.querySelector(".titan-hex-hpfill");
      if (fill) fill.style.width = "100%";
    });
    document.querySelectorAll("#titanMyTarget .titan-hex-avatar").forEach((el, i) => {
      el.style.display = i < TITAN_VISIBLE_DINO_SLOTS ? "" : "none";
      const fill = el.querySelector(".titan-hex-avatar-hpfill");
      if (fill) fill.style.width = "100%";
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
    btn.textContent = "계산 중...";
    // 실전 시뮬레이션은 통계용 평균이 아니라 "한 판"을 그대로 보여주는 거라 1회차만 돌리면 됨
    // (빠른 계산 쪽의 500회 평균과는 목적 자체가 다름 - 여긴 결과 리포트가 없고 과정만 실시간으로 쌓임)
    const cfg = { ...buildSimBaseCfg(), iterations: 1, collectLog: true };
    const result = await runTitanSimulation(cfg);
    titanReplayLogs = result.logs;
    titanReplayIdx = 0;
    titanFirstDeathTick = null;
    btn.disabled = false;
    btn.textContent = "다시 시뮬레이션";
    document.getElementById("titanLiveRestartBtn").disabled = false;
    document.getElementById("titanLiveStats").style.display = "grid";
    titanReplayStart();
  }

  function titanReplayStart() {
    if (titanReplayLogs.length === 0) return;
    titanReplayRunning = true;
    clearInterval(titanReplayTimer);
    titanReplayTimer = setInterval(titanReplayTick, titanGetSpeedMs());
  }

  function titanUpdateMyDisplay(entry) {
    const dinoMaxHp = entry.공룡최대HP_raw || 1;
    const aliveIdx = entry.공룡상태
      .map((d, i) => ({ i, hp: Number(d.남은HP) }))
      .filter((d) => d.hp > 0)
      .map((d) => d.i);
    const frontIdx = aliveIdx.slice(0, TITAN_VISIBLE_DINO_SLOTS);
    const hiddenIdx = entry.공룡상태.map((d, i) => i).filter((i) => !frontIdx.includes(i));

    // 앞쪽 삼각 대형 3자리 - 각자 자기 체력바를 가짐
    const target = document.getElementById("titanMyTarget");
    target.querySelectorAll(".titan-hex-avatar").forEach((avatarEl, slot) => {
      if (slot < frontIdx.length) {
        avatarEl.style.display = "";
        const hp = Number(entry.공룡상태[frontIdx[slot]].남은HP);
        const fill = avatarEl.querySelector(".titan-hex-avatar-hpfill");
        if (fill) fill.style.width = `${Math.max(0, (hp / dinoMaxHp) * 100)}%`;
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
        const fill = bar.querySelector(".titan-hex-hpfill");
        fill.style.width = `${Math.max(0, (hp / dinoMaxHp) * 100)}%`;
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
      return;
    }
    const entry = titanReplayLogs[titanReplayIdx];
    const prevEntry = titanReplayIdx > 0 ? titanReplayLogs[titanReplayIdx - 1] : null;

    const titanMaxHp = entry.타이탄최대HP_raw;
    const titanHp = entry.타이탄HP_raw;
    document.getElementById("titanBossHpFill").style.width = `${Math.max(0, (titanHp / titanMaxHp) * 100)}%`;
    document.getElementById("titanBossHpText").textContent =
      `${Math.max(0, Math.round(titanHp)).toLocaleString()} / ${Math.round(titanMaxHp).toLocaleString()}`;

    const frontIdx = titanUpdateMyDisplay(entry);
    const avatarEls = document.querySelectorAll("#titanMyTarget .titan-hex-avatar");

    const dinoHpSum = entry.공룡상태.reduce((s, d) => s + Number(d.남은HP), 0);
    const deadCount = entry.공룡상태.filter((d) => Number(d.남은HP) <= 0).length;
    const elapsedSec = titanReplayIdx + 1;

    if (prevEntry) {
      // 타이탄이 받은 피해(전체) - 보스 아바타 위에 뜸
      const dmgToTitan = Math.max(0, prevEntry.타이탄HP_raw - titanHp);
      if (dmgToTitan > 0) titanPlayHit("titanBossTarget", "titanBossPopupLayer", dmgToTitan);

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
    document.getElementById("titanLiveDead").innerText = `${deadCount}마리`;
    if (deadCount > 0 && titanFirstDeathTick === null) titanFirstDeathTick = elapsedSec;
    document.getElementById("titanLiveSurvival").innerText = `${titanFirstDeathTick !== null ? titanFirstDeathTick : elapsedSec}초`;

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
    const fx = document.createElement("img");
    fx.src = "./assets/sprites/Hit_Effect.png";
    fx.className = "dummy-hit-effect";
    fx.style.setProperty("--hit-angle", `${Math.floor(Math.random() * 360)}deg`);
    target.appendChild(fx);
    fx.addEventListener("animationend", () => fx.remove());

    // popupLayerId가 없으면(예: 표시 중인 3마리 각자에게 이미 개별 팝업을 따로 띄운 경우) 흔들림/
    // 타격 이펙트만 재생하고 별도의 통합 팝업은 생략함
    if (!popupLayerId) return;
    const layer = document.getElementById(popupLayerId);
    const popup = document.createElement("div");
    popup.className = "battle-dmg-popup dummy-dmg-popup";
    popup.innerText = Math.round(dmg).toLocaleString();
    layer.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }

  function titanInitLiveControls() {
    document.getElementById("titanLiveStartBtn").onclick = titanStartLiveSim;
    document.getElementById("titanLiveRestartBtn").onclick = () => {
      titanLiveReset();
    };
  }

  function renderReport(result) {
    const rep = document.getElementById("battleReport");
    rep.style.display = "block";
    document.getElementById("repTotalDmg").innerText = Math.floor(result.avgTotalDmg).toLocaleString();
    document.getElementById("repTitanHp").innerText = Math.floor(result.avgRemainingTitanHp).toLocaleString();
    document.getElementById("repTime").innerText = `${Math.floor(result.avgTimeSec / 60)}분 ${Math.floor(result.avgTimeSec % 60)}초`;
    document.getElementById("repDead").innerText = `${result.avgDeadCount.toFixed(1)}마리`;
    document.getElementById("avgMinHpPer").innerText = "평균 생존 체력: " + result.avgSurvivalPercent.toFixed(1) + "%";
    if (result.chartData.length > 0) {
      drawHpChart(document.getElementById("hpChart"), result.chartData, result.limitSec);
    }

    const oldBtn = document.getElementById("logDownloadBtn");
    if (oldBtn) oldBtn.remove();
    if (AppSettings.isLogEnabled && result.logs.length > 0) {
      const logBtn = document.createElement("button");
      logBtn.id = "logDownloadBtn";
      logBtn.innerHTML = "상세 로그(.txt) 다운로드";
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
        <span class="dummy-owned-rune-name">${name}</span>
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
    });
  }

  async function titanRunOptimizer() {
    const levels = loadTitanOwnedLevels();
    const owned = titanSuitableRuneNames().filter((name) => levels[name] > 0);
    const resultEl = document.getElementById("titanOptimizeResult");
    const btn = document.getElementById("titanOptimizeBtn");

    if (owned.length === 0) {
      resultEl.innerHTML = `<p class="quickcalc-desc">보유한 룬 레벨을 먼저 입력해주세요.</p>`;
      return;
    }

    const slotCount = Math.min(5, owned.length);
    const combos = titanCombinations(owned, slotCount);
    const dino = getMyDinoBattleInputs();
    const tileCfg = loadTitanTileSettings();
    btn.disabled = true;
    btn.classList.add("btn-progress");
    btn.style.setProperty("--progress", "0");
    resultEl.innerHTML = "";

    // 1단계: DPS와 생존 시간 둘 다 시뮬레이션 없이 closed form으로 즉시 계산(getTitanCombatMetrics가
    // 이미 DPS 계산용으로 구해둔 finalHp/reductionTotal/healAvg/vampAvg만으로 estimateTitanSurvivalSec가
    // 노이즈 없는 생존 시간 추정치를 만들어냄) - 예전엔 생존 시간만 2회짜리 몬테카를로로 훑었는데,
    // 표본이 적으면 확률형 완화/회복 룬(피해 저항·흡혈 등)이 확정형 룬(단단한 피부 등)보다 분산이
    // 커서 억울하게 후보에서 탈락하는 문제가 있었음. 이제 시뮬레이션을 전혀 안 돌리니 그 문제 자체가 없음.
    //
    // await 없는 완전 동기 루프라 조합 수가 아주 많으면(적합 룬을 거의 다 보유한 경우) 브라우저가
    // 그동안 완전히 멈춤(실측: 적합 룬 32개 전부 보유 시 약 711ms) - 청크 단위로 나눠서 매 청크
    // 사이에 한 번씩 이벤트 루프에 양보(setTimeout 0)하고 진행률도 갱신해서, 계산 자체는 똑같이
    // 걸리더라도 화면이 안 멈추고 "계산 중"이라는 게 계속 보이게 함(2·3단계에서 이미 쓰는 것과
    // 같은 패턴).
    const targetTitan = TITAN_STATS[titanLevel];
    const timeLimitSec = timeLimitMinutes * 60;
    const STAGE1_CHUNK_SIZE = 3000;
    const screened = [];
    for (let i = 0; i < combos.length; i += STAGE1_CHUNK_SIZE) {
      const end = Math.min(i + STAGE1_CHUNK_SIZE, combos.length);
      for (let j = i; j < end; j++) {
        const names = combos[j];
        const selectedRunes = names.map((name) => ({ name, lv: levels[name] }));
        const metrics = getTitanCombatMetrics({ ...dino, selectedRunes }, tileCfg);
        const dps = (metrics.avgHitDamage + metrics.skillDmgTotal) * dino.count;
        const survivalEstimate = estimateTitanSurvivalSec(metrics, targetTitan, timeLimitSec, dps);
        // "확정형" 감소(단단한 피부/타이탄 가드처럼 확률 없이 항상 적용되는 것)만 따로 합산 -
        // survivalEstimate의 마진 기반 점수는 분산이 다른 조합끼리 비교할 때 큰 마진을 가진
        // 확률형 조합이 작은 마진의 확정형 조합보다 부당하게 높게 나올 수 있어서(둘 다 룬 자체
        // 계산은 정확해도, "마진이 크다"가 항상 "더 안전하다"인 건 아님 - 분산까지 반영한 완전한
        // 확률 모델은 너무 복잡해서 만들지 않음), 이 값이 높은 조합을 후보군에 별도로 승격시켜
        // 마진 점수가 어떻게 나오든 최소한 후보에서 완전히 탈락하지는 않게 안전망을 둠
        const deterministicReduction = metrics.reductions
          .filter((r) => r.type === "flat")
          .reduce((sum, r) => sum + r.avg, 0);
        screened.push({ names, dps, survivalEstimate, deterministicReduction });
      }
      if (end < combos.length) {
        btn.textContent = `1단계 계산 중 (${end.toLocaleString()}/${combos.length.toLocaleString()})...`;
        btn.style.setProperty("--progress", String((end / combos.length) * 9));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const bestDpsAll = screened.reduce((a, b) => (b.dps > a.dps ? b : a));

    // 균형 점수도 후보군 전체 기준(global)으로 미리 계산 - 이래야 "균형" 자체가 좋은 조합이
    // DPS나 생존 시간 어느 한쪽에서도 상위 30위 안에 못 들어서 후보군에서 아예 빠지는 일이 없음.
    // (이 global 정규화는 후보군을 "누구를 뽑을지" 고르는 용도이고, 2단계 정밀 계산 뒤 실제
    // 균형 조합을 "고르는" 정규화는 refined 안에서 따로 계산함 - 서로 다른 단계라 섞으면 안 됨)
    const maxDpsAll = bestDpsAll.dps;
    // 보유 룬이 많으면(적합 룬을 거의 다 보유) combos가 수만~수십만 개까지 늘어날 수 있어서
    // Math.max(...array) 스프레드는 V8 인자 스택 한도(약 6만5천개)를 넘겨 RangeError로 터짐 -
    // reduce로 순회하며 최댓값을 구해야 배열 크기와 무관하게 안전함
    const maxSurvivalAll = screened.reduce((m, s) => Math.max(m, s.survivalEstimate), 0);
    screened.forEach((s) => {
      s.balanceScore = Math.sqrt((s.dps / maxDpsAll) * (s.survivalEstimate / maxSurvivalAll));
    });

    btn.textContent = "1단계 계산 완료, 2단계 정밀 계산 시작...";
    btn.style.setProperty("--progress", "10");

    // 2단계: DPS 상위 + 해석적 생존 시간 상위 + 해석적 균형 점수 상위 + 확정형 감소 상위(4갈래,
    // 중복 제거)를 합쳐 실제 시뮬레이션으로 회차를 높여 정밀 재계산. 마지막 갈래(byDeterministicSafety)는
    // 위 deterministicReduction 주석 참고 - 마진 기반 생존 점수가 분산을 반영 못 해서 확정형 방어
    // 위주 조합을 부당하게 낮게 평가할 가능성에 대한 안전망
    const byDps = [...screened].sort((a, b) => b.dps - a.dps).slice(0, TITAN_OPTIMIZER_CANDIDATE_COUNT);
    const bySurvival = [...screened].sort((a, b) => b.survivalEstimate - a.survivalEstimate).slice(0, TITAN_OPTIMIZER_CANDIDATE_COUNT);
    const byBalance = [...screened].sort((a, b) => b.balanceScore - a.balanceScore).slice(0, TITAN_OPTIMIZER_CANDIDATE_COUNT);
    const byDeterministicSafety = [...screened].sort((a, b) => b.deterministicReduction - a.deterministicReduction).slice(0, TITAN_OPTIMIZER_CANDIDATE_COUNT);
    const candidateMap = new Map();
    [...byDps, ...bySurvival, ...byBalance, ...byDeterministicSafety].forEach((c) => candidateMap.set(c.names.join("|"), c));
    const candidates = [...candidateMap.values()];

    const refined = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const selectedRunes = c.names.map((name) => ({ name, lv: levels[name] }));
      const fineResult = await runTitanSimulation({
        ...buildSimBaseCfg(selectedRunes),
        iterations: TITAN_OPTIMIZER_FINAL_ITERATIONS,
        collectLog: false,
        batchSize: 10
      });
      refined.push({ names: c.names, dps: c.dps, survival: fineResult.avgTimeSec });
      btn.textContent = `2단계 정밀 계산 중 (${i + 1}/${candidates.length})...`;
      btn.style.setProperty("--progress", String(10 + ((i + 1) / candidates.length) * 60));
    }

    // 3단계: 2단계(30회 평균)는 표본이 적어서 진짜 기댓값과 다소 어긋날 수 있음 - 그 30회가
    // 우연히 좋게/나쁘게 나온 조합이 최종 승자로 잘못 뽑히는 걸 막기 위해, 2단계 상위권(생존/균형
    // 각각 상위 N개 + 대미지 최고 조합)만 추려서 훨씬 높은 회차로 다시 검증한 뒤 그 결과로
    // 최종 승자를 정함(회차를 늘릴수록 평균이 진짜 기댓값에 가까워지므로, 시드로 결과를
    // "재현 가능하게" 고정하는 방법 대신 표본 자체를 늘려 "더 정확하게" 만드는 쪽을 선택함).
    const preMaxDps = Math.max(...refined.map((r) => r.dps));
    const preMaxSurvival = Math.max(...refined.map((r) => r.survival));
    const balanceScoreOf = (r) => Math.sqrt((r.dps / preMaxDps) * (r.survival / preMaxSurvival));
    const byRefinedSurvival = [...refined].sort((a, b) => b.survival - a.survival).slice(0, TITAN_OPTIMIZER_VERIFY_TOP_N);
    const byRefinedBalance = [...refined].sort((a, b) => balanceScoreOf(b) - balanceScoreOf(a)).slice(0, TITAN_OPTIMIZER_VERIFY_TOP_N);
    const finalistMap = new Map();
    [...byRefinedSurvival, ...byRefinedBalance].forEach((c) => finalistMap.set(c.names.join("|"), c));
    // 대미지 최고 조합도 화면에 보여줄 "예상 생존 시간" 숫자의 정확도를 위해 같이 검증함 - byDps에
    // 전체 조합 중 진짜 DPS 최댓값(bestDpsAll)이 항상 포함되므로 refined 안에 그 실측값이 반드시
    // 있음(아래 cap-skip 판단에 쓸 survival 값도 같이 딸려오도록 refined의 실제 항목을 그대로 씀)
    finalistMap.set(bestDpsAll.names.join("|"), refined.find((r) => r.names.join("|") === bestDpsAll.names.join("|")));
    const finalists = [...finalistMap.values()];

    const verified = [];
    for (let i = 0; i < finalists.length; i++) {
      const f = finalists[i];
      const selectedRunes = f.names.map((name) => ({ name, lv: levels[name] }));

      // 2단계 표본이 예외 없이 전부 제한 시간까지 살아남았다면(=avgTimeSec가 정확히 timeLimitSec)
      // 곧바로 300회 전체 검증을 돌리는 대신, 훨씬 저렴한 회차로 한 번 더 확인해봄(위 상수 선언부
      // 주석 참고 - 15회 전부 생존만으로는 신뢰도가 부족할 수 있어서 완전히 생략하지는 않음)
      if (f.survival >= timeLimitSec - 0.001) {
        btn.textContent = `3단계 최종 후보 검증 중 (${i + 1}/${finalists.length}, 제한 시간 도달 재확인 중)...`;
        btn.style.setProperty("--progress", String(70 + (i / finalists.length) * 30));
        const capCheckResult = await runTitanSimulation({
          ...buildSimBaseCfg(selectedRunes),
          iterations: TITAN_OPTIMIZER_CAP_CHECK_ITERATIONS,
          collectLog: false,
          batchSize: 25
        });
        if (capCheckResult.avgTimeSec >= timeLimitSec - 0.001) {
          // 저렴한 확인 회차도 전부 생존 - 캡 도달로 확정, 300회 전체 검증은 생략
          verified.push(f);
          btn.style.setProperty("--progress", String(70 + ((i + 1) / finalists.length) * 30));
          continue;
        }
        // 확인 중 죽는 시행이 나왔음 - "가끔 죽는 조합"으로 판명됐으니 아래에서 300회 전체 검증을 마저 돌림
      }

      const verifyResult = await runTitanSimulation({
        ...buildSimBaseCfg(selectedRunes),
        iterations: TITAN_OPTIMIZER_VERIFY_ITERATIONS,
        collectLog: false,
        batchSize: 20
      });
      verified.push({ names: f.names, dps: f.dps, survival: verifyResult.avgTimeSec });
      btn.textContent = `3단계 최종 후보 검증 중 (${i + 1}/${finalists.length})...`;
      btn.style.setProperty("--progress", String(70 + ((i + 1) / finalists.length) * 30));
    }

    // 생존 시간이 동점(주로 제한 시간까지 다 버텨서 5번째 슬롯이 뭐든 상관없어지는 경우)이면
    // 그 중 대미지가 더 높은 조합을 우선함 - 확정적으로 다 버티는 상황이라면 나머지 룬은 딜이
    // 제일 잘 나오는 걸 넣는 게 맞음(생존은 전혀 손해 안 보면서 대미지만 덤으로 챙기는 셈).
    // 이 규칙이 없으면 동점 후보 중 배열에 먼저 들어온 걸 우연히 골라서, 보스 슬레이어처럼
    // 생존에는 전혀 기여 안 하는 룬이 이유 없이 "생존 시간 최고"에 낄 수 있었음.
    const bestSurvival = verified.reduce((a, b) => {
      if (b.survival !== a.survival) return b.survival > a.survival ? b : a;
      return b.dps > a.dps ? b : a;
    });
    // 균형 조합: DPS/생존시간을 검증된 최종 후보군 내 최댓값 기준 0~1로 정규화한 뒤 기하평균이
    // 가장 높은 조합(한쪽에 극단적으로 치우친 조합은 다른 쪽 점수가 낮아져 기하평균이 낮게 나옴).
    // maxDps는 finalists에 항상 bestDpsAll(전체 조합 중 진짜 DPS 최댓값)이 포함돼 있어 정확한 값.
    const maxDps = Math.max(...verified.map((r) => r.dps));
    const maxSurvival = Math.max(...verified.map((r) => r.survival));
    const bestBalance = verified.reduce((a, b) => {
      const scoreA = Math.sqrt((a.dps / maxDps) * (a.survival / maxSurvival));
      const scoreB = Math.sqrt((b.dps / maxDps) * (b.survival / maxSurvival));
      return scoreB > scoreA ? b : a;
    });
    const bestDpsEntry = verified.find((r) => r.names.join("|") === bestDpsAll.names.join("|"));

    btn.disabled = false;
    btn.textContent = "조합 찾기 시작";
    btn.classList.remove("btn-progress");
    btn.style.removeProperty("--progress");

    const fmtTime = (sec) => `${Math.floor(sec / 60)}분 ${Math.floor(sec % 60)}초`;
    const comboLine = (names) => names.map((n) => `${n} Lv.${levels[n]}`).join(" · ");

    resultEl.innerHTML = `
      ${slotCount < 5 ? `<p class="quickcalc-desc">보유한 적합 룬이 ${owned.length}개뿐이라 ${slotCount}개짜리 조합까지만 계산했습니다.</p>` : ""}
      <div class="dummy-optimize-result-box">
        <div class="report-grid">
          <div class="report-tile dummy-optimize-best-tile">
            <div class="metric-label">생존 시간(공룡 1마리당) 최고 조합</div>
            <div class="dummy-optimize-best-combo">${comboLine(bestSurvival.names)}</div>
          </div>
          <div class="report-tile"><div class="metric-label">예상 생존 시간</div><div class="metric-value accent">${fmtTime(bestSurvival.survival)}</div></div>
          <div class="report-tile"><div class="metric-label">이 조합의 예상 초당 대미지</div><div class="metric-value">${Math.round(bestSurvival.dps).toLocaleString()}</div></div>
        </div>
      </div>
      <div class="dummy-optimize-result-box">
        <div class="report-grid">
          <div class="report-tile dummy-optimize-best-tile">
            <div class="metric-label">시간당 대미지 최고 조합</div>
            <div class="dummy-optimize-best-combo">${comboLine(bestDpsEntry.names)}</div>
          </div>
          <div class="report-tile"><div class="metric-label">예상 평균 초당 대미지</div><div class="metric-value accent">${Math.round(bestDpsEntry.dps).toLocaleString()}</div></div>
          <div class="report-tile"><div class="metric-label">이 조합의 예상 생존 시간</div><div class="metric-value">${fmtTime(bestDpsEntry.survival)}</div></div>
        </div>
      </div>
      <div class="dummy-optimize-result-box">
        <div class="report-grid">
          <div class="report-tile dummy-optimize-best-tile">
            <div class="metric-label">균형 조합 (생존·대미지 둘 다 준수)</div>
            <div class="dummy-optimize-best-combo">${comboLine(bestBalance.names)}</div>
          </div>
          <div class="report-tile"><div class="metric-label">예상 생존 시간</div><div class="metric-value accent">${fmtTime(bestBalance.survival)}</div></div>
          <div class="report-tile"><div class="metric-label">예상 평균 초당 대미지</div><div class="metric-value accent">${Math.round(bestBalance.dps).toLocaleString()}</div></div>
        </div>
      </div>
    `;
  }

  titanInitModeTabs();
  titanInitSpeedDropdown();
  titanInitLiveControls();
  // 시뮬레이션 시작 버튼을 눌러야만 숨겨진 공룡 체력바가 생기던 문제 - 탭 진입/페이지 로드
  // 시점에 미리 한 번 그려둬서 처음부터 공룡 수만큼 다 보이게 함(시뮬레이션 시작 전 리셋 상태)
  titanLiveReset();
  titanInitOwnedRuneGrid();
  titanResetQuickCalc();
}
