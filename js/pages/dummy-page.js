// 허수아비: 건축물 판정의 고정 표적 하나를 두고 내 공룡 세팅의 DPS를 확인하는 페이지. 다른
// 페이지들과 달리 "상대"가 없어서(비교 대상이 아니라 그냥 맞아주기만 하는 표적) 진영 2개를 나란히
// 두는 battle-layout 구조 대신, 타이탄 페이지처럼 "내 공룡 설정 + 설정 카드"를 단순히 세로로 쌓는
// 레이아웃을 씀. 표적이 죽지도 반격하지도 않으므로 시간에 따라 변하는 전투 상태가 없어서(타이탄/
// 공룡 대전처럼 여러 회차를 통계 내는 시뮬레이션이 아니라) 매 틱마다 크리티컬만 새로 굴리는 실시간
// 재생만 있으면 충분함 - 실제 대미지 계산은 js/core/simulation-dummy.js가 담당.
//
// 재생 속도(공속) 조절은 dino-battle-page.js가 정의해둔 BATTLE_SPEED_OPTIONS를 그대로 재사용함
// (느림/보통/빠름 - ms 값은 화면에 그려지는 "실제 틱 간격"만 바꿀 뿐, 대미지/DPS 계산은 매 틱을
// 여전히 "게임 시간 1초"로 취급해서 정확함 - dummyElapsedSec는 실제 경과 시간이 아니라 순수 틱 횟수)

const DUMMY_TILE_KEY = "dino_dummy_tile_settings";
const DUMMY_SPEED_KEY = "dino_dummy_speed_ms";
const DUMMY_OWNED_LEVELS_KEY = "dino_dummy_owned_rune_levels";

// 적합 룬 14종 - "최적 조합 찾기"가 이 안에서만 조합을 뒤짐(부적합 룬은 애초에 대미지에 기여하는
// 코드가 없어서 포함시켜봐야 의미 없음)
// 등급 내림차순(유니크->에픽->희귀->일반), 같은 등급이면 룬 id(imgId의 "RuneSprite_N" 숫자)
// 내림차순 - 목록/최적 조합 결과 어디서든 이 순서 그대로 씀
const DUMMY_GRADE_ORDER = ["일반", "희귀", "에픽", "유니크"];

function dummyRuneSortKey(name) {
  const r = RUNES_DATA[name];
  const gradeRank = DUMMY_GRADE_ORDER.indexOf(r.grade);
  const idNum = Number((r.imgId.match(/\d+/) || [0])[0]);
  return gradeRank * 10000 + idNum;
}

function dummySuitableRuneNames() {
  return Object.keys(RUNES_DATA)
    .filter((n) => !DUMMY_UNSUITABLE_RUNE_LIST.includes(n))
    .sort((a, b) => dummyRuneSortKey(b) - dummyRuneSortKey(a));
}

function loadDummyOwnedLevels() {
  const levels = {};
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(DUMMY_OWNED_LEVELS_KEY)) || {};
  } catch (e) {
    saved = {};
  }
  dummySuitableRuneNames().forEach((name) => {
    const v = saved[name];
    levels[name] = Number.isInteger(v) && v >= 0 && v <= 31 ? v : 0;
  });
  return levels;
}

function saveDummyOwnedLevels(levels) {
  localStorage.setItem(DUMMY_OWNED_LEVELS_KEY, JSON.stringify(levels));
}

function defaultDummyTileSettings() {
  return { natureAdjacent: false, tribeControl: true, atkTowerLevel: null };
}

// 허수아비(훈련 인형)는 부족이 점령한 타일에만 설치할 수 있는 게 인게임 규칙이라, 부족 점령
// 상태는 선택지가 아니라 항상 켜져 있어야 함(사용자 확정) - 예전에 저장된 tribeControl:false
// 값이 남아있어도 여기서 강제로 true로 덮어써서, 껐다 켠 적 없는 사용자도 항상 정상 값을 씀
function loadDummyTileSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(DUMMY_TILE_KEY));
    return { ...defaultDummyTileSettings(), ...(saved || {}), tribeControl: true };
  } catch (e) {
    return defaultDummyTileSettings();
  }
}

function saveDummyTileSettings(settings) {
  localStorage.setItem(DUMMY_TILE_KEY, JSON.stringify(settings));
}

function dummyGetSpeedMs() {
  const saved = Number(localStorage.getItem(DUMMY_SPEED_KEY));
  return BATTLE_SPEED_OPTIONS.some((o) => o.ms === saved) ? saved : 350;
}

// 재생 상태 - dino-battle-page.js의 battleToken 등과 동일한 패턴이지만 이름 충돌 방지를 위해
// dummy 접두사를 붙인 별도 상태
let dummyAttackTimer = null;
let dummyRunning = false;
let dummyElapsedSec = 0;
let dummyTotalDmg = 0;

// 재생 중(setInterval)에 다른 페이지로 이동해도 안 멈추고 계속 dummyRunAttackTick을 불러서, 이미
// 사라진 DOM에 접근하다 "Cannot set properties of null" 콘솔 에러가 나던 버그(타이탄 페이지의
// titanReplayTick과 같은 종류 - 실측으로 발견) - 페이지를 벗어나는 순간 타이머를 확실히 멈춤
window.addEventListener("hashchange", () => {
  clearInterval(dummyAttackTimer);
  dummyRunning = false;
});

function renderDummyPage(container) {
  container.innerHTML = `
    <div class="warning">※ 본 시뮬레이터는 참고용이며, 실제 연산 방식과 차이가 있을 수 있습니다.</div>

    <div id="dummyMyDinoSection"></div>

    <div class="card">
      <h2>타일 설정</h2>
      <div class="setting-list">
        <div class="setting-row">
          <div class="setting-label">자연 구조물과 인접 (자연의 포옹)</div>
          <label class="switch"><input type="checkbox" id="dummyNatureToggle"><span class="slider round"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-label" title="허수아비(훈련 인형)는 부족이 점령한 타일에만 설치할 수 있어서 항상 켜져 있습니다">부족 점령 상태 (부족의 축복)</div>
          <label class="switch" title="허수아비(훈련 인형)는 부족이 점령한 타일에만 설치할 수 있어서 항상 켜져 있습니다"><input type="checkbox" id="dummyTribeToggle"><span class="slider round"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-label">공격력 버프 타워</div>
          <div class="custom-dropdown setting-control" id="dummyAtkTowerDropdown">
            <div class="selected-value" id="dummyAtkTowerSelectedValue">없음</div>
            <ul class="dropdown-list" id="dummyAtkTowerList"></ul>
          </div>
        </div>
      </div>
    </div>

    <div class="card battle-main-card dummy-field-card" id="dummyMainCard">
      <div class="battle-mode-tabs mode-live dummy-mode-tabs-3" id="dummyModeTabs">
        <span class="battle-mode-indicator"></span>
        <button class="battle-mode-tab" data-mode="quick" id="dummyModeTabQuick"><span>빠른 계산</span></button>
        <button class="battle-mode-tab active" data-mode="live" id="dummyModeTabLive"><span>시뮬레이션</span></button>
        <button class="battle-mode-tab" data-mode="optimize" id="dummyModeTabOptimize"><span>조합 찾기</span></button>
      </div>

      <div class="battle-mode-panel" id="dummyQuickModeCard" style="display:none;">
        <p class="quickcalc-desc">현재 설정의 크리티컬 확률·피해까지 반영한 1초당 평균 대미지(기댓값)와, 그 페이스로 10분간 공격했을 때의 예상 총 대미지를 바로 계산합니다.</p>
        <button class="btn-simulate" id="dummyQcBtn">계산하기</button>
        <div class="report-grid" id="dummyQcResult" style="display:none;">
          <div class="report-tile"><div class="metric-label">10분간 예상 총 대미지</div><div class="metric-value accent" id="dummyQcTenMin">-</div></div>
          <div class="report-tile"><div class="metric-label">예상 평균 초당 대미지</div><div class="metric-value" id="dummyQcDps">-</div></div>
          <div class="report-tile"><div class="metric-label">치명타 확률</div><div class="metric-value" id="dummyQcCRate">-</div></div>
          <div class="report-tile"><div class="metric-label">치명타 피해</div><div class="metric-value" id="dummyQcCDmg">-</div></div>
        </div>
      </div>

      <div class="battle-mode-panel" id="dummyOptimizeModeCard" style="display:none;">
        <div class="dummy-optimizer">
          <h3 class="dummy-optimizer-title">내 룬 레벨로 최적 조합 찾기</h3>
          <p class="quickcalc-desc">적합 룬 14종 중 보유한 룬의 레벨을 입력하세요(0 = 미보유). 지금 스탯·별자리·타일 설정 기준으로 가장 대미지가 높은 5개 조합을 찾아줍니다.</p>
          <div class="dummy-owned-rune-grid" id="dummyOwnedRuneGrid"></div>
          <button class="btn-simulate" id="dummyOptimizeBtn">최적 조합 찾기</button>
          <div id="dummyOptimizeResult"></div>
        </div>
      </div>

      <div class="battle-mode-panel" id="dummyLiveModeCard">
        <div class="dummy-field-wrap">
          <!-- 다이노 배틀/타이탄 페이지와 같은 세계좌표+카메라 방식(사용자 확정) - 허수아비는
               타일이 하나뿐이라 포메이션 계산은 필요 없지만, 구조 자체는 통일함: 육각형(바닥)이
               preserve-3d로 진짜 3D 공간을 열고, 그 안의 .dummy-target-layer가 반대로 회전해서
               카메라를 향해 서는 빌보드가 됨. 바닥과 정확히 같은 크기/중심으로 배치해서 안쪽의
               허수아비/타격 이펙트 상대 위치(%)는 예전 그대로 재사용 가능 -->
          <div class="dummy-hexagon">
            <svg class="dummy-hexagon-svg" viewBox="0 0 100 86.6" preserveAspectRatio="none">
              <defs>
                <radialGradient id="dummyHexGradient" cx="50%" cy="38%" r="75%">
                  <stop offset="0%" style="stop-color:var(--accent); stop-opacity:0.32"></stop>
                  <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                </radialGradient>
              </defs>
              <polygon points="25,0 75,0 100,43.3 75,86.6 25,86.6 0,43.3" fill="url(#dummyHexGradient)"></polygon>
              <!-- 대각선 변과 위/아래 수평 변을 따로 그림 - rotateX(55°)가 화면상 세로(Y) 방향만
                   압축하는 변환이라, 수평 변은 굵기 방향이 통째로 Y축이라 유독 얇아 보이고 대각선
                   변은 덜 압축됨(다이노 배틀/타이탄과 같은 이유) - 수평 변만 stroke-width 보정 -->
              <path d="M75,0 L100,43.3 L75,86.6 M25,86.6 L0,43.3 L25,0" fill="none" stroke="var(--accent)" stroke-width="2.4" vector-effect="non-scaling-stroke"></path>
              <path d="M25,0 L75,0 M75,86.6 L25,86.6" fill="none" stroke="var(--accent)" stroke-width="4.2" vector-effect="non-scaling-stroke"></path>
            </svg>
            <div class="dummy-target-layer" id="dummyTarget">
              <img src="./assets/sprites/Scarecrow_1.png" class="dummy-scarecrow" alt="허수아비">
            </div>
          </div>
          <div class="dummy-popup-layer" id="dummyPopupLayer"></div>
        </div>

        <div class="report-grid">
          <div class="report-tile"><div class="metric-label">총 대미지</div><div class="metric-value accent" id="dummyTotalDmgEl">0</div></div>
          <div class="report-tile"><div class="metric-label">경과 시간</div><div class="metric-value" id="dummyElapsedEl">0초</div></div>
          <div class="report-tile"><div class="metric-label">평균 초당 대미지</div><div class="metric-value" id="dummyDpsEl">0</div></div>
        </div>

        <div class="battle-controls">
          <div class="custom-dropdown battle-speed-dropdown" id="dummySpeedDropdown">
            <div class="selected-value" id="dummySpeedSelectedValue">보통</div>
            <ul class="dropdown-list" id="dummySpeedList"></ul>
          </div>
          <button class="btn-simulate" id="dummyStartBtn">공격 시작</button>
          <button class="battle-restart-btn" id="dummyRestartBtn" disabled title="처음부터 다시 시작">↻</button>
        </div>
      </div>
    </div>
  `;

  renderMyDinoPage(document.getElementById("dummyMyDinoSection"), {
    idPrefix: "dummyMy_",
    unsuitableList: DUMMY_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: "허수아비에 적합하지 않은 룬입니다",
    onChange: () => {
      dummyResetDisplay();
      dummyResetQuickCalc();
    }
  });

  dummyInitTileSettings();
  dummyInitModeTabs();
  dummyInitSpeedDropdown();
  dummyInitControls();
  dummyInitOwnedRuneGrid();
  dummyUpdateStatsDisplay();
}

function dummyInitTileSettings() {
  const settings = loadDummyTileSettings();

  const natureToggle = document.getElementById("dummyNatureToggle");
  natureToggle.checked = settings.natureAdjacent;
  natureToggle.onchange = () => {
    settings.natureAdjacent = natureToggle.checked;
    saveDummyTileSettings(settings);
    dummyResetDisplay();
    dummyResetQuickCalc();
  };

  // 허수아비는 부족 점령 타일에만 설치 가능해서 이 설정은 실제로 고를 수 있는 선택지가 아님
  // (사용자 확정) - 항상 켜진 상태로 고정하고 조작 자체를 막음(loadDummyTileSettings가 이미
  // tribeControl:true를 강제하므로 여기서는 그 값을 그대로 반영만 함)
  const tribeToggle = document.getElementById("dummyTribeToggle");
  tribeToggle.checked = true;
  tribeToggle.disabled = true;

  const list = document.getElementById("dummyAtkTowerList");
  const selectedValue = document.getElementById("dummyAtkTowerSelectedValue");
  const labelFor = (v) => BUFF_TOWER_OPTIONS.find((o) => o.value === v).label;
  selectedValue.textContent = labelFor(settings.atkTowerLevel);

  BUFF_TOWER_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      settings.atkTowerLevel = opt.value;
      selectedValue.textContent = opt.label;
      list.style.display = "none";
      saveDummyTileSettings(settings);
      dummyResetDisplay();
      dummyResetQuickCalc();
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
}

// 빠른 계산 / 실전 대전 / 조합 찾기 3개 탭 전환. 다른 페이지(아레나 등)의 mode-live/mode-quick
// 2탭용 슬라이딩 인디케이터를 그대로 쓰되, 3탭 폭 계산은 .dummy-mode-tabs-3 스코프 CSS로 따로 둠
const DUMMY_MODES = [
  { mode: "quick", tabId: "dummyModeTabQuick", cardId: "dummyQuickModeCard" },
  { mode: "live", tabId: "dummyModeTabLive", cardId: "dummyLiveModeCard" },
  { mode: "optimize", tabId: "dummyModeTabOptimize", cardId: "dummyOptimizeModeCard" }
];

function dummyInitModeTabs() {
  const tabsEl = document.getElementById("dummyModeTabs");

  DUMMY_MODES.forEach((m) => {
    document.getElementById(m.tabId).onclick = () => {
      DUMMY_MODES.forEach((other) => {
        document.getElementById(other.tabId).classList.toggle("active", other.mode === m.mode);
        document.getElementById(other.cardId).style.display = other.mode === m.mode ? "block" : "none";
        tabsEl.classList.toggle(`mode-${other.mode}`, other.mode === m.mode);
      });
    };
  });

  document.getElementById("dummyQcBtn").onclick = dummyRunQuickCalc;
  document.getElementById("dummyOptimizeBtn").onclick = dummyRunOptimizer;
}

const DUMMY_QUICK_CALC_SECONDS = 600; // 10분

function dummyRunQuickCalc() {
  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const inputs = dinoProfileToBattleInputs(profile);
  const tileCfg = loadDummyTileSettings();
  const values = computeDummyCombatValues(inputs, tileCfg);
  const dps = computeDummyExpectedDps(values);

  document.getElementById("dummyQcTenMin").innerText = Math.round(dps * DUMMY_QUICK_CALC_SECONDS).toLocaleString();
  document.getElementById("dummyQcDps").innerText = Math.round(dps).toLocaleString();
  document.getElementById("dummyQcCRate").innerText = `${values.cRate.toFixed(2)}%`;
  document.getElementById("dummyQcCDmg").innerText = `${values.cDmg.toFixed(2)}%`;
  document.getElementById("dummyQcResult").style.display = "grid";
}

function dummyResetQuickCalc() {
  document.getElementById("dummyQcResult").style.display = "none";
  const optimizeResult = document.getElementById("dummyOptimizeResult");
  if (optimizeResult) optimizeResult.innerHTML = "";
}

// ===== 최적 조합 찾기 - 적합 룬 14종 중 보유 레벨을 입력하면, 5개를 고르는 모든 조합을 직접
// 계산해서 가장 대미지가 높은 걸 찾아줌(14개 중 5개 = 2,002가지라 브라우저에서도 순식간에 끝남) =====

function dummyInitOwnedRuneGrid() {
  const levels = loadDummyOwnedLevels();
  const grid = document.getElementById("dummyOwnedRuneGrid");
  // 룬 이름에 공백이 들어있어서(예: "압축된 힘") id 속성에 그대로 쓰면 CSS 선택자가 깨짐 - data-rune
  // 속성으로만 식별하고, DOM 조회도 data-rune 기준 attribute selector로 함
  grid.innerHTML = dummySuitableRuneNames().map((name) => `
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
      const current = loadDummyOwnedLevels();
      current[name] = v;
      saveDummyOwnedLevels(current);
      document.getElementById("dummyOptimizeResult").innerHTML = "";
    };
    // 엔터 키로도 커밋되게(예전엔 마우스로 다른 빈 공간을 눌러 포커스를 잃어야만 반영됐음 -
    // 사용자 지적) - blur()를 호출하면 위 onblur 핸들러가 그대로 실행됨
    input.onkeydown = (e) => { if (e.key === "Enter") input.blur(); };
  });
}

// k개를 고르는 모든 조합(순서 무관) - 후보가 14개뿐이라 재귀로 짜도 충분히 빠름
function dummyCombinations(arr, k) {
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

function dummyRunOptimizer() {
  const levels = loadDummyOwnedLevels();
  const owned = dummySuitableRuneNames().filter((name) => levels[name] > 0);
  const resultEl = document.getElementById("dummyOptimizeResult");

  if (owned.length === 0) {
    resultEl.innerHTML = `<p class="quickcalc-desc">보유한 룬 레벨을 먼저 입력해주세요.</p>`;
    return;
  }

  const slotCount = Math.min(5, owned.length);
  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const inputs = dinoProfileToBattleInputs(profile);
  const tileCfg = loadDummyTileSettings();

  const scored = dummyCombinations(owned, slotCount).map((names) => {
    const selectedRunes = names.map((name) => ({ name, lv: levels[name] }));
    const values = computeDummyCombatValues({ ...inputs, selectedRunes }, tileCfg);
    return { names, dps: computeDummyExpectedDps(values) };
  });
  scored.sort((a, b) => b.dps - a.dps);

  const top = scored.slice(0, 3);
  const bestLine = top[0].names.map((n) => `${n} Lv.${levels[n]}`).join(" · ");

  resultEl.innerHTML = `
    ${slotCount < 5 ? `<p class="quickcalc-desc">보유한 적합 룬이 ${owned.length}개뿐이라 ${slotCount}개짜리 조합까지만 계산했습니다.</p>` : ""}
    <div class="report-grid">
      <div class="report-tile dummy-optimize-best-tile">
        <div class="metric-label">최적 조합</div>
        <div class="dummy-optimize-best-combo">${bestLine}</div>
      </div>
      <div class="report-tile"><div class="metric-label">예상 평균 초당 대미지</div><div class="metric-value accent">${Math.round(top[0].dps).toLocaleString()}</div></div>
    </div>
    ${top.length > 1 ? `
      <div class="dummy-optimize-runner-ups">
        ${top.slice(1).map((r, i) => `<div class="dummy-optimize-runner-up">${i + 2}위 · ${r.names.join(", ")} (${Math.round(r.dps).toLocaleString()})</div>`).join("")}
      </div>
    ` : ""}
  `;
}

function dummyInitSpeedDropdown() {
  const currentMs = dummyGetSpeedMs();
  const list = document.getElementById("dummySpeedList");
  const selectedValue = document.getElementById("dummySpeedSelectedValue");
  selectedValue.textContent = BATTLE_SPEED_OPTIONS.find((o) => o.ms === currentMs).label;

  BATTLE_SPEED_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      localStorage.setItem(DUMMY_SPEED_KEY, String(opt.ms));
      selectedValue.textContent = opt.label;
      list.style.display = "none";
      // 재생 중이었으면 새 간격으로 다시 걸어줌(멈췄다 다시 시작할 필요 없이 바로 반영)
      if (dummyRunning) {
        clearInterval(dummyAttackTimer);
        dummyAttackTimer = setInterval(dummyRunAttackTick, dummyGetSpeedMs());
      }
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
}

function dummyInitControls() {
  document.getElementById("dummyStartBtn").onclick = dummyOnStartButtonClick;
  document.getElementById("dummyRestartBtn").onclick = () => {
    dummyResetDisplay();
  };
}

function dummyOnStartButtonClick() {
  if (dummyRunning) {
    dummyPauseAttack();
  } else {
    dummyStartAttack();
  }
}

function dummyStartAttack() {
  dummyRunning = true;
  document.getElementById("dummyStartBtn").textContent = "일시정지";
  document.getElementById("dummyRestartBtn").disabled = false;

  dummyAttackTimer = setInterval(dummyRunAttackTick, dummyGetSpeedMs());
}

function dummyPauseAttack() {
  dummyRunning = false;
  clearInterval(dummyAttackTimer);
  document.getElementById("dummyStartBtn").textContent = "재개";
}

function dummyResetDisplay() {
  dummyRunning = false;
  clearInterval(dummyAttackTimer);
  dummyElapsedSec = 0;
  dummyTotalDmg = 0;
  document.getElementById("dummyStartBtn").textContent = "공격 시작";
  document.getElementById("dummyRestartBtn").disabled = true;
  const target = document.getElementById("dummyTarget");
  if (target) target.querySelectorAll(".dummy-hit-effect").forEach((el) => el.remove());
  const scarecrow = document.querySelector(".dummy-scarecrow");
  if (scarecrow) scarecrow.classList.remove("dummy-shaking");
  const popupLayer = document.getElementById("dummyPopupLayer");
  if (popupLayer) popupLayer.innerHTML = "";
  dummyUpdateStatsDisplay();
}

function dummyRunAttackTick() {
  dummyElapsedSec++;

  const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const inputs = dinoProfileToBattleInputs(profile);
  const tileCfg = loadDummyTileSettings();
  const values = computeDummyCombatValues(inputs, tileCfg);
  const { dmg, isCrit } = rollDummyAttack(values);

  dummyTotalDmg += dmg;
  dummyShakeScarecrow();
  dummySpawnHitEffect();
  dummySpawnDamagePopup(dmg, isCrit);
  dummyUpdateStatsDisplay();
}

// 맞을 때마다 살짝 흔들리는 효과 - 클래스를 뗐다 강제로 리플로우시킨 뒤 다시 붙여야 같은 애니메이션이
// 연속으로 와도(공속이 빨라서 애니메이션이 끝나기 전에 다음 타격이 들어와도) 매번 처음부터 다시 재생됨
function dummyShakeScarecrow() {
  const img = document.querySelector(".dummy-scarecrow");
  if (!img) return;
  img.classList.remove("dummy-shaking");
  void img.offsetWidth;
  img.classList.add("dummy-shaking");
}

// #dummyTarget(.dummy-target-layer)이 preserve-3d 빌보드라 허수아비 이미지와 fx가 같은 3D
// 컨텍스트 안에 있으면 깊이 다툼에 걸릴 수 있음(다이노 배틀/타이탄과 같은 문제) - 3D를 아예
// 우회해서 화면 좌표(position:fixed)로 직접 띄움. 항상 최상단에 그려지므로 허수아비 뒤에
// 가려지는 문제가 원천적으로 발생할 수 없음(사용자 지적 버그 수정)
function dummySpawnHitEffect() {
  const target = document.getElementById("dummyTarget");
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const fx = document.createElement("img");
  fx.src = "./assets/sprites/Hit_Effect.png";
  fx.className = "dummy-hit-effect dummy-hit-effect-fixed";
  fx.style.setProperty("--hit-angle", `${Math.floor(Math.random() * 360)}deg`);
  fx.style.left = `${rect.left + rect.width / 2}px`;
  fx.style.top = `${rect.top + rect.height * 0.4}px`;
  fx.style.width = `${rect.width * 0.26}px`;
  document.body.appendChild(fx);
  fx.addEventListener("animationend", () => fx.remove());
}

function dummySpawnDamagePopup(dmg, isCrit) {
  const layer = document.getElementById("dummyPopupLayer");
  if (!layer) return;
  const popup = document.createElement("div");
  popup.className = "battle-dmg-popup dummy-dmg-popup" + (isCrit ? " crit" : "");
  popup.innerText = Math.round(dmg).toLocaleString();
  layer.appendChild(popup);
  popup.addEventListener("animationend", () => popup.remove());
}

function dummyUpdateStatsDisplay() {
  document.getElementById("dummyTotalDmgEl").innerText = Math.round(dummyTotalDmg).toLocaleString();
  document.getElementById("dummyElapsedEl").innerText = `${dummyElapsedSec}초`;
  const dps = dummyElapsedSec > 0 ? dummyTotalDmg / dummyElapsedSec : 0;
  document.getElementById("dummyDpsEl").innerText = Math.round(dps).toLocaleString();
}
