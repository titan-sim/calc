// 공룡 대전: 내 공룡 팀 vs 상대 공룡 팀. 각 팀은 타일 위에 자신의 공룡 수만큼 전부 올라와 있고,
// 맨 앞(제일 위) 공룡끼리 1:1로 싸우다가 죽으면 다음 공룡이 앞으로 나옴. 전투 시작 시점의 종합
// 공격력이 더 높은 쪽이 선공이고, 이후 공격권이 팀 단위로 번갈아감(내 공격 1회 -> 상대 공격 1회 -> ...).
// 실제 계산은 js/core/simulation-dino-battle.js가 전체 이벤트 로그를 한 번에 계산해서 돌려주고,
// 이 파일은 그 로그를 순서대로 재생하며 애니메이션만 담당함(타이탄전과 달리 500회 평균이 아니라
// 버튼 한 번 = 실제 대전 1회를 그대로 보여주는 방식).
const DINO_BATTLE_OPPONENT_KEY = "dino_battle_opponent_profile";
const DINO_BATTLE_TILE_KEY = "dino_battle_tile_settings";
const DINO_BATTLE_SPEED_KEY = "dino_battle_speed_ms";
const QUICK_CALC_TRIALS = 100000;
const BATTLE_SPEED_OPTIONS = [
  { ms: 650, label: "느림" },
  { ms: 350, label: "보통" },
  { ms: 150, label: "빠름" }
];

// 재생 컨트롤 상태(전투 도중 룬/스탯을 바꾸거나 다시 시작을 눌러도 예전 재생 체인이 화면을 계속
// 덮어쓰지 않도록 토큰으로 무력화하고, 일시정지/재개와 진행 인덱스를 여기서 관리).
// battlePhase: "idle"(시작 전) | "playing"(재생 중) | "paused"(일시정지) | "finished"(종료)
// "전투 시작" 버튼 하나가 이 상태에 따라 시작/일시정지/재개/다시시작을 전부 겸함
let battleToken = 0;
let battlePhase = "idle";
let currentBattleResult = null;
let currentBattleIndex = 0;

// 친구 기능 3단계(친구와 함께 실시간 공동 연구) 관련 페이지 상태.
// myUserId/myNickname: 로그인 상태일 때만 채워짐(비로그인이면 초대/불러오기 버튼 자체를 안 보여줌).
// friendSnapshotProfile: "친구 설정 불러오기"로 가져온 정적 스냅샷(실시간 세션과 무관, 한 번만 로딩).
// unsubscribeFriendSession: 페이지를 다시 그릴 때(라우터 재진입) 이전 구독을 정리하기 위한 핸들.
let myUserId = null;
let myNickname = null;
let friendSnapshotProfile = null;
let friendSnapshotNickname = null;
let unsubscribeFriendSession = null;

const TRIBE_LABELS = { none: "없음", mine: "내 부족", opponent: "상대 부족" };
const ARRANGEMENT_LABELS = { same: "한 타일", separate: "다른 타일" };

function defaultTileSettings() {
  return {
    natureAdjacent: false,
    tribeControl: "none",
    myTileArrangement: "same",
    oppTileArrangement: "same",
    myAtkTowerLevel: null,
    myHpTowerLevel: null,
    oppAtkTowerLevel: null,
    oppHpTowerLevel: null
  };
}

// 버프 타워 드롭다운 공용 옵션: "없음"(미설치) + Lv0~Lv14(설치 레벨, 각 레벨의 %가 몇인지 바로 보이게 표기)
const BUFF_TOWER_OPTIONS = [
  { value: null, label: "없음" },
  ...BUFF_TOWER_PERCENTS.map((pct, lv) => ({ value: lv, label: `Lv.${lv} (+${pct}%)` }))
];

function loadTileSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(DINO_BATTLE_TILE_KEY));
    return { ...defaultTileSettings(), ...(saved || {}) };
  } catch (e) {
    return defaultTileSettings();
  }
}

function saveTileSettings(settings) {
  localStorage.setItem(DINO_BATTLE_TILE_KEY, JSON.stringify(settings));
}

function renderDinoBattlePage(container) {
  container.innerHTML = `
    <div class="card battle-tile-card">
      <h2 class="battle-tile-heading">타일 설정</h2>

      <div class="tile-group">
        <div class="tile-group-label">환경</div>
        <div class="setting-list">
          <div class="setting-row">
            <div class="setting-label">자연 구조물과 인접 (자연의 포옹)</div>
            <label class="switch"><input type="checkbox" id="tileNatureToggle"><span class="slider round"></span></label>
          </div>
          <div class="setting-row">
            <div class="setting-label">부족 점령 상태 (부족의 축복)</div>
            <div class="custom-dropdown setting-control" id="tileTribeDropdown">
              <div class="selected-value" id="tileTribeSelectedValue">없음</div>
              <ul class="dropdown-list" id="tileTribeList"></ul>
            </div>
          </div>
        </div>
      </div>

      <div class="tile-group">
        <div class="tile-group-label">진영별 설정</div>
        <div class="tile-side-grid">
          <div class="tile-side-col">
            <div class="tile-side-col-label my-side-label">내 공룡</div>
            <div class="tile-side-field">
              <label>배치</label>
              <div class="custom-dropdown" id="myTileArrangementDropdown">
                <div class="selected-value" id="myTileArrangementSelectedValue">한 타일</div>
                <ul class="dropdown-list" id="myTileArrangementList"></ul>
              </div>
            </div>
            <div class="tile-side-field">
              <label>공격력 버프 타워</label>
              <div class="custom-dropdown" id="myAtkTowerDropdown">
                <div class="selected-value" id="myAtkTowerSelectedValue">없음</div>
                <ul class="dropdown-list" id="myAtkTowerList"></ul>
              </div>
            </div>
            <div class="tile-side-field">
              <label>체력 버프 타워</label>
              <div class="custom-dropdown" id="myHpTowerDropdown">
                <div class="selected-value" id="myHpTowerSelectedValue">없음</div>
                <ul class="dropdown-list" id="myHpTowerList"></ul>
              </div>
            </div>
          </div>

          <div class="tile-side-col">
            <div class="tile-side-col-label opp-side-label">상대 공룡</div>
            <div class="tile-side-field">
              <label>배치</label>
              <div class="custom-dropdown" id="oppTileArrangementDropdown">
                <div class="selected-value" id="oppTileArrangementSelectedValue">한 타일</div>
                <ul class="dropdown-list" id="oppTileArrangementList"></ul>
              </div>
            </div>
            <div class="tile-side-field">
              <label>공격력 버프 타워</label>
              <div class="custom-dropdown" id="oppAtkTowerDropdown">
                <div class="selected-value" id="oppAtkTowerSelectedValue">없음</div>
                <ul class="dropdown-list" id="oppAtkTowerList"></ul>
              </div>
            </div>
            <div class="tile-side-field">
              <label>체력 버프 타워</label>
              <div class="custom-dropdown" id="oppHpTowerDropdown">
                <div class="selected-value" id="oppHpTowerSelectedValue">없음</div>
                <ul class="dropdown-list" id="oppHpTowerList"></ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="battle-layout" id="battleLayout">
      <div class="battle-side-panel my-side" id="mySidePanel">
        <div class="battle-panel-header">
          <span id="myPanelTitleText">내 공룡</span>
          <button class="close-btn battle-panel-close" id="myPanelClose">✕</button>
        </div>
        <div id="myDinoBattleSection"></div>
      </div>

      <div class="battle-arena-wrap">
        <button class="battle-peek-btn my-peek" id="myPeekBtn" title="내 공룡 설정">▶</button>

        <div class="card battle-main-card" id="battleMainCard">
          <div class="battle-mode-tabs mode-live" id="battleModeTabs">
            <span class="battle-mode-indicator"></span>
            <button class="battle-mode-tab" data-mode="quick" id="modeTabQuick"><span>빠른 계산</span></button>
            <button class="battle-mode-tab active" data-mode="live" id="modeTabLive"><span>실전 대전</span></button>
          </div>

          <div class="battle-mode-panel" id="quickModeCard" style="display:none;">
            <p class="quickcalc-desc">대기 공룡 없이 공룡 1마리씩 맞붙어서, 죽으면 그 자리에서 즉시 부활시키며 ${QUICK_CALC_TRIALS.toLocaleString()}번 죽을 때까지 반복합니다. 사망 횟수 비율과 평균 대미지(평타·크리티컬·스킬·죽을 준비 반격까지 전부 포함)를 계산합니다.</p>
            <button class="btn-simulate" id="quickCalcBtn">${QUICK_CALC_TRIALS.toLocaleString()}회 계산하기</button>
            <div class="report-grid" id="quickCalcResult" style="display:none;">
              <div class="report-tile"><div class="metric-label">전투 결과 (${QUICK_CALC_TRIALS.toLocaleString()}번 중)</div><div class="metric-value accent" id="qcRatio">-</div><div class="metric-sub" id="qcRatioNorm"></div></div>
              <div class="report-tile"><div class="metric-label">내 공룡 평균 대미지</div><div class="metric-value" id="qcMyDmg">-</div></div>
              <div class="report-tile"><div class="metric-label">상대 공룡의 평균 대미지</div><div class="metric-value" id="qcOppDmg">-</div></div>
              <div class="report-tile"><div class="metric-label">상대 전멸에 필요한 공룡 수</div><div class="metric-value" id="qcNeededCount">-</div><div class="metric-sub" id="qcNeededCountBase"></div></div>
            </div>
          </div>

          <div class="battle-mode-panel" id="liveModeCard">
            <div class="battle-arena" id="battleArena">
              <div class="battle-fighter" id="myFighter">
                <div class="battle-name">내 공룡</div>
                <div class="battle-hp-bar"><div class="battle-hp-fill my-hp-fill" id="myHpFill"></div></div>
                <div class="battle-hp-label" id="myHpLabel">0 / 0</div>
                <div class="battle-stack-row my-stack-row">
                  <div class="tile-box">
                    <div class="battle-stack">
                      <div class="stack-dino behind-2 my-avatar" id="myBehind2"></div>
                      <div class="stack-dino behind-1 my-avatar" id="myBehind1"></div>
                      <div class="stack-dino front battle-avatar my-avatar" id="myAvatar"></div>
                    </div>
                  </div>
                  <div class="reserve-bars" id="myReserveBars"></div>
                </div>
              </div>

              <div class="battle-vs"><span>VS</span></div>

              <div class="battle-fighter" id="oppFighter">
                <div class="battle-name">상대 공룡</div>
                <div class="battle-hp-bar"><div class="battle-hp-fill opp-hp-fill" id="oppHpFill"></div></div>
                <div class="battle-hp-label" id="oppHpLabel">0 / 0</div>
                <div class="battle-stack-row opp-stack-row">
                  <div class="tile-box">
                    <div class="battle-stack">
                      <div class="stack-dino behind-2 opp-avatar" id="oppBehind2"></div>
                      <div class="stack-dino behind-1 opp-avatar" id="oppBehind1"></div>
                      <div class="stack-dino front battle-avatar opp-avatar" id="oppAvatar"></div>
                    </div>
                  </div>
                  <div class="reserve-bars" id="oppReserveBars"></div>
                </div>
              </div>
            </div>

            <div class="battle-result" id="battleResult" style="display:none;"></div>
            <div class="battle-controls">
              <div class="custom-dropdown battle-speed-dropdown" id="battleSpeedDropdown">
                <div class="selected-value" id="battleSpeedSelectedValue">보통</div>
                <ul class="dropdown-list" id="battleSpeedList"></ul>
              </div>
              <button class="btn-simulate" id="battleStartBtn">전투 시작</button>
              <button class="battle-restart-btn" id="battleRestartBtn" disabled title="처음부터 다시 시작">↻</button>
            </div>
          </div>
        </div>

        <button class="battle-peek-btn opp-peek" id="oppPeekBtn" title="상대 공룡 설정">◀</button>
      </div>

      <div class="battle-side-panel opp-side" id="oppSidePanel">
        <div class="battle-panel-header">
          <span id="oppPanelTitleText">상대 공룡</span>
          <div class="opp-panel-toolbar" id="oppPanelToolbar"></div>
          <button class="close-btn battle-panel-close" id="oppPanelClose">✕</button>
        </div>
        <div id="oppDinoBattleSection"></div>
      </div>
    </div>
    <div class="battle-panel-overlay" id="battlePanelOverlay"></div>

    <div class="friend-picker-overlay" id="friendPickerOverlay" style="display:none;">
      <div class="friend-picker-modal">
        <div class="friend-picker-header">
          <span id="friendPickerTitle">친구 선택</span>
          <button class="close-btn" id="friendPickerClose">✕</button>
        </div>
        <div id="friendPickerList"></div>
      </div>
    </div>
  `;

  initDinoBattlePage();
}

function initDinoBattlePage() {
  renderMyDinoPage(document.getElementById("myDinoBattleSection"), {
    idPrefix: "myB_",
    storageKey: MY_DINO_PROFILE_KEY,
    unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: "공룡 대전에 적합하지 않은 룬입니다",
    onChange: (profile) => {
      resetBattleDisplay();
      if (isFriendSessionActive()) sendMyProfileUpdate(profile);
    }
  });
  // "상대 공룡" 자리는 지금 모드(일반 편집 / 스냅샷 / 실시간 세션 진행 중 재진입)에 맞게 그림
  renderOppPanel();

  initTileSettings();
  initSpeedDropdown();
  updateFriendLabels();

  document.getElementById("friendPickerClose").onclick = () => {
    document.getElementById("friendPickerOverlay").style.display = "none";
  };

  // 로그인 상태면 친구 초대/불러오기 버튼을 쓸 수 있게 내 uid/닉네임을 채움
  getCurrentUser().then((user) => {
    if (user && user.username) {
      myUserId = user.id;
      myNickname = user.username;
      renderOppPanelToolbar();
    }
  });

  // 페이지를 다시 그릴 때마다(다른 탭 갔다 옴) 예전 구독을 정리하고 새로 구독. 세션 자체는
  // friend-session.js 쪽 모듈 스코프에 남아있어서 페이지를 오가도 끊기지 않음
  if (unsubscribeFriendSession) unsubscribeFriendSession();
  unsubscribeFriendSession = onFriendSessionChange(handleFriendSessionEvent);
  if (getActiveSession()) applyOppTileLock(true);

  // 모바일 PIP 슬라이드 패널 열기/닫기
  const mySidePanel = document.getElementById("mySidePanel");
  const oppSidePanel = document.getElementById("oppSidePanel");
  const overlay = document.getElementById("battlePanelOverlay");

  function closeSidePanels() {
    mySidePanel.classList.remove("open");
    oppSidePanel.classList.remove("open");
    overlay.classList.remove("open");
  }
  function openSidePanel(panel) {
    closeSidePanels();
    panel.classList.add("open");
    overlay.classList.add("open");
  }

  document.getElementById("myPeekBtn").onclick = () => openSidePanel(mySidePanel);
  document.getElementById("oppPeekBtn").onclick = () => openSidePanel(oppSidePanel);
  document.getElementById("myPanelClose").onclick = closeSidePanels;
  document.getElementById("oppPanelClose").onclick = closeSidePanels;
  overlay.onclick = closeSidePanels;

  document.getElementById("battleStartBtn").onclick = onBattleButtonClick;
  document.getElementById("battleRestartBtn").onclick = () => {
    // 처음 상태로 되돌리기만 하고 자동 재생하지는 않음 - "전투 시작"을 다시 눌러야 플레이됨
    if (battlePhase !== "idle") resetBattleDisplay();
  };
  document.getElementById("quickCalcBtn").onclick = startQuickCalc;
  initModeTabs();
  resetBattleDisplay();
}

function initModeTabs() {
  const tabsEl = document.getElementById("battleModeTabs");
  const quickTab = document.getElementById("modeTabQuick");
  const liveTab = document.getElementById("modeTabLive");
  const quickCard = document.getElementById("quickModeCard");
  const liveCard = document.getElementById("liveModeCard");

  quickTab.onclick = () => {
    quickTab.classList.add("active");
    liveTab.classList.remove("active");
    quickCard.style.display = "block";
    liveCard.style.display = "none";
    tabsEl.classList.remove("mode-live");
    tabsEl.classList.add("mode-quick");
  };
  liveTab.onclick = () => {
    liveTab.classList.add("active");
    quickTab.classList.remove("active");
    liveCard.style.display = "block";
    quickCard.style.display = "none";
    tabsEl.classList.remove("mode-quick");
    tabsEl.classList.add("mode-live");
  };
}

// 죽음(약한 쪽)이 아니라 생존(강한 쪽)이 1이 되도록, "적게 죽은 쪽"을 1로 고정하고 "많이 죽은
// 쪽"이 그 몇 배인지 보여주는 교환비 (내 219사망 : 상대 281사망 -> "1 : 1.28". 즉 내가 더 강함)
function formatNormalizedRatio(myDeaths, oppDeaths) {
  const minD = Math.min(myDeaths, oppDeaths);
  if (minD === 0) return "";
  const fmt = (n) => (Math.round(n * 100) / 100).toString();
  return `${fmt(myDeaths / minD)} : ${fmt(oppDeaths / minD)}`;
}

function startQuickCalc() {
  // 10,000회 통계 평균이라 시드로 고정할 이유가 없음(시드는 실전 대전 전용) - 타일 설정만
  // 세션 중이면 공유값으로 맞춰서 계산
  const tileSettings = getEffectiveTileSettings();
  const btn = document.getElementById("quickCalcBtn");
  btn.disabled = true;
  btn.innerText = "계산 중...";

  // 애니메이션 없이 동기 계산이라 순식간에 끝남 - setTimeout으로 한 틱 양보해서
  // "계산 중..." 텍스트가 먼저 그려지게만 함
  setTimeout(() => {
    const oppInputs = getOppBattleInputs();
    const result = runDinoQuickCalc({
      my: getSideInputs(MY_DINO_PROFILE_KEY),
      opp: oppInputs,
      tileSettings,
      totalDeaths: QUICK_CALC_TRIALS
    });

    // result.myKills = 내가 상대를 죽인 횟수(= 상대 사망 수), result.oppKills = 상대가 나를
    // 죽인 횟수(= 내 사망 수). "내 : 상대" 순서로 보여주려면 서로 바꿔서 읽어야 함.
    const myDeaths = result.oppKills;
    const oppDeaths = result.myKills;

    document.getElementById("qcRatio").innerText = `사망횟수 ${myDeaths} : ${oppDeaths}`;
    const normRatio = formatNormalizedRatio(myDeaths, oppDeaths);
    document.getElementById("qcRatioNorm").innerText = normRatio ? `교환비 ${normRatio}` : "";
    document.getElementById("qcMyDmg").innerText = Math.round(result.avgMyDmgPerHit).toLocaleString();
    document.getElementById("qcOppDmg").innerText = Math.round(result.avgOppDmgPerHit).toLocaleString();

    // "실전 대전"에서 VIP 최대치를 넘는 나쁜 교환비가 나오면 몇 마리를 못 채워서 결과를 못 보고
    // 끝나기 쉬움 - 실제 전투 로직은 안 건드리고, 이미 나온 사망비를 근거로 산수로만 계산
    // (상대 N마리를 전멸시키는 데 내가 최소 몇 마리 필요한지)
    let neededText;
    if (oppDeaths === 0) neededText = "상관없음(전멸 불가)";
    else if (myDeaths === 0) neededText = "1마리";
    else neededText = `${Math.ceil((myDeaths * oppInputs.count) / oppDeaths).toLocaleString()}마리`;
    document.getElementById("qcNeededCount").innerText = neededText;
    document.getElementById("qcNeededCountBase").innerText = `상대 ${oppInputs.count}마리 기준`;

    document.getElementById("quickCalcResult").style.display = "grid";

    btn.disabled = false;
    btn.innerText = `${QUICK_CALC_TRIALS.toLocaleString()}회 계산하기`;
  }, 10);
}

function getBattleSpeedMs() {
  const saved = parseInt(localStorage.getItem(DINO_BATTLE_SPEED_KEY), 10);
  return BATTLE_SPEED_OPTIONS.some((o) => o.ms === saved) ? saved : 350;
}

function initSpeedDropdown() {
  const currentMs = getBattleSpeedMs();
  const list = document.getElementById("battleSpeedList");
  const selectedValue = document.getElementById("battleSpeedSelectedValue");
  selectedValue.textContent = BATTLE_SPEED_OPTIONS.find((o) => o.ms === currentMs).label;

  BATTLE_SPEED_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      localStorage.setItem(DINO_BATTLE_SPEED_KEY, String(opt.ms));
      selectedValue.textContent = opt.label;
      list.style.display = "none";
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => {
    const isOpen = list.style.display === "block";
    document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
    list.style.display = isOpen ? "none" : "block";
  };
}

function initTileSettings() {
  const settings = loadTileSettings();

  const natureToggle = document.getElementById("tileNatureToggle");
  natureToggle.checked = settings.natureAdjacent;
  natureToggle.onchange = () => {
    settings.natureAdjacent = natureToggle.checked;
    saveTileSettings(settings);
    // 자연 구조물과 인접/부족 점령 상태는 "환경" 설정이라 세션 중이면 상대에게도 그대로 적용됨
    // (같은 방에 있다는 개념 - 나만 켜지는 게 아니라 상대 화면에도 즉시 반영되어야 함)
    if (isFriendSessionActive()) sendMyTileUpdate({ natureAdjacent: settings.natureAdjacent });
    resetBattleDisplay();
  };

  const tribeList = document.getElementById("tileTribeList");
  const tribeSelectedValue = document.getElementById("tileTribeSelectedValue");
  tribeSelectedValue.textContent = TRIBE_LABELS[settings.tribeControl];

  Object.keys(TRIBE_LABELS).forEach((key) => {
    const li = document.createElement("li");
    li.textContent = TRIBE_LABELS[key];
    li.onclick = () => {
      settings.tribeControl = key;
      tribeSelectedValue.textContent = TRIBE_LABELS[key];
      tribeList.style.display = "none";
      saveTileSettings(settings);
      if (isFriendSessionActive()) {
        const session = getActiveSession();
        sendMyTileUpdate({ tribeControlUserId: computeTribeControlUserId(key, session.myId, session.friendId) });
      }
      resetBattleDisplay();
    };
    tribeList.appendChild(li);
  });
  tribeSelectedValue.onclick = () => {
    const isOpen = tribeList.style.display === "block";
    document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
    tribeList.style.display = isOpen ? "none" : "block";
  };

  initArrangementDropdown("my", settings);
  initArrangementDropdown("opp", settings);

  initBuffTowerDropdown("my", "Atk", settings);
  initBuffTowerDropdown("my", "Hp", settings);
  initBuffTowerDropdown("opp", "Atk", settings);
  initBuffTowerDropdown("opp", "Hp", settings);

  // 세션이 이미 진행 중인 상태로 이 페이지에 다시 들어온 경우(다른 탭 갔다 옴), 상대 쪽
  // 배치/버프타워 드롭다운을 곧바로 잠그고 상대가 보낸 값으로 채움
  if (isFriendSessionActive()) {
    applyOppTileLock(true);
    refreshOppTileDisplayFromSession();
    refreshSharedTileDisplayFromSession();
  }
}

// sideKey: "my" | "opp", statKey: "Atk" | "Hp" - 진영별 공격력/체력 버프 타워 레벨 설정.
// settingsField는 tileSettings의 myAtkTowerLevel/myHpTowerLevel/oppAtkTowerLevel/oppHpTowerLevel
function initBuffTowerDropdown(sideKey, statKey, settings) {
  const settingsField = `${sideKey}${statKey}TowerLevel`;
  const idPrefix = `${sideKey}${statKey}Tower`;
  const list = document.getElementById(`${idPrefix}List`);
  const selectedValue = document.getElementById(`${idPrefix}SelectedValue`);
  const labelFor = (v) => BUFF_TOWER_OPTIONS.find((o) => o.value === v).label;
  selectedValue.textContent = labelFor(settings[settingsField]);

  BUFF_TOWER_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      settings[settingsField] = opt.value;
      selectedValue.textContent = opt.label;
      list.style.display = "none";
      saveTileSettings(settings);
      // 상대 쪽 버프 타워는 세션 중엔 잠겨서(applyOppTileLock) 애초에 이 li를 못 누르니, 여기선
      // "내" 쪽 변경만 신경 쓰면 됨
      if (sideKey === "my" && isFriendSessionActive()) {
        sendMyTileUpdate({ [statKey === "Atk" ? "atkTowerLevel" : "hpTowerLevel"]: opt.value });
      }
      resetBattleDisplay();
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => {
    const isOpen = list.style.display === "block";
    document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
    list.style.display = isOpen ? "none" : "block";
  };
}

// sideKey: "my" | "opp" - 내 공룡/상대 공룡 각자 독립적으로 "대기 공룡을 같은 타일에 모을지,
// 다른 타일에 따로 둘지" 설정. settingsField는 tileSettings의 myTileArrangement/oppTileArrangement
function initArrangementDropdown(sideKey, settings) {
  const settingsField = `${sideKey}TileArrangement`;
  const list = document.getElementById(`${sideKey}TileArrangementList`);
  const selectedValue = document.getElementById(`${sideKey}TileArrangementSelectedValue`);
  selectedValue.textContent = ARRANGEMENT_LABELS[settings[settingsField]];
  applyTileArrangementClass(sideKey, settings[settingsField]);

  Object.keys(ARRANGEMENT_LABELS).forEach((key) => {
    const li = document.createElement("li");
    li.textContent = ARRANGEMENT_LABELS[key];
    li.onclick = () => {
      settings[settingsField] = key;
      selectedValue.textContent = ARRANGEMENT_LABELS[key];
      list.style.display = "none";
      saveTileSettings(settings);
      applyTileArrangementClass(sideKey, key);
      if (sideKey === "my" && isFriendSessionActive()) sendMyTileUpdate({ arrangement: key });
      resetBattleDisplay();
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => {
    const isOpen = list.style.display === "block";
    document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
    list.style.display = isOpen ? "none" : "block";
  };
}

function applyTileArrangementClass(sideKey, arrangement) {
  const isSame = arrangement !== "separate";
  const row = document.querySelector(`.${sideKey}-stack-row`);
  if (!row) return;
  row.classList.toggle("tile-same", isSame);
  row.classList.toggle("tile-separate", !isSame);
}

function getSideInputs(storageKey) {
  return getMyDinoBattleInputs(storageKey);
}

// ===== 친구 기능 3단계: 친구와 함께 실시간 공동 연구 =====

function isFriendSessionActive() {
  const session = getActiveSession();
  return !!(session && session.status === "active");
}

// "부족 점령 상태"는 값 자체가 보는 사람 기준 상대적 이름(mine/opponent)이라 그대로 전파하면 뜻이
// 뒤집힘 - uid로 절대 지정해서 주고받고, 각자 로컬에서 mine/opponent로 번역함
function computeTribeControlUserId(tribeControl, myId, friendId) {
  if (tribeControl === "mine") return myId;
  if (tribeControl === "opponent") return friendId;
  return null;
}

function computeTribeControlFromUserId(tribeControlUserId, myId, friendId) {
  if (tribeControlUserId === myId) return "mine";
  if (tribeControlUserId === friendId) return "opponent";
  return "none";
}

// 실제 전투 계산에 쓸 상대 쪽 입력값: 실시간 세션 중이면 상대가 보낸 프로필, 스냅샷을 불러온
// 상태면 그 스냅샷, 둘 다 아니면 지금까지처럼 로컬에 저장된 "상대 공룡" 프로필
function getOppBattleInputs() {
  const session = getActiveSession();
  if (session && session.status === "active" && session.friendProfile) {
    return dinoProfileToBattleInputs(session.friendProfile);
  }
  if (friendSnapshotProfile) {
    return dinoProfileToBattleInputs(friendSnapshotProfile);
  }
  return getSideInputs(DINO_BATTLE_OPPONENT_KEY);
}

// 실제 전투 계산에 쓸 타일 설정: 로컬에 저장된 내 쪽 값 위에, 세션 중이면 공유값(자연의 포옹/부족
// 점령)과 상대 쪽 값(배치/버프타워)을 덮어씌움 - "같은 방에 들어와있다"는 요구사항 그대로 반영
function getEffectiveTileSettings() {
  const local = loadTileSettings();
  const session = getActiveSession();
  if (!session || session.status !== "active") return local;
  return {
    ...local,
    natureAdjacent: session.sharedTile.natureAdjacent,
    tribeControl: computeTribeControlFromUserId(session.sharedTile.tribeControlUserId, session.myId, session.friendId),
    oppTileArrangement: session.friendSide.arrangement,
    oppAtkTowerLevel: session.friendSide.atkTowerLevel,
    oppHpTowerLevel: session.friendSide.hpTowerLevel
  };
}

// 세션 중엔 "상대 공룡" 쪽 배치/버프타워는 상대가 직접 정하는 값이라 여기선 편집 불가로 잠금
function applyOppTileLock(locked) {
  ["oppTileArrangementDropdown", "oppAtkTowerDropdown", "oppHpTowerDropdown"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("dropdown-locked", locked);
  });
}

function refreshOppTileDisplayFromSession() {
  const session = getActiveSession();
  if (!session || session.status !== "active") return;
  const arrangementLabel = ARRANGEMENT_LABELS[session.friendSide.arrangement] || ARRANGEMENT_LABELS.same;
  const atkLabel = (BUFF_TOWER_OPTIONS.find((o) => o.value === session.friendSide.atkTowerLevel) || BUFF_TOWER_OPTIONS[0]).label;
  const hpLabel = (BUFF_TOWER_OPTIONS.find((o) => o.value === session.friendSide.hpTowerLevel) || BUFF_TOWER_OPTIONS[0]).label;
  document.getElementById("oppTileArrangementSelectedValue").textContent = arrangementLabel;
  document.getElementById("oppAtkTowerSelectedValue").textContent = atkLabel;
  document.getElementById("oppHpTowerSelectedValue").textContent = hpLabel;
  applyTileArrangementClass("opp", session.friendSide.arrangement);
}

// 자연의 포옹/부족 점령 상태는 공유값이라, 상대가 바꾸면 내 화면의 토글/드롭다운 표시도 그대로 맞춤
// (localStorage에는 안 남김 - 세션이 끝나면 내가 마지막으로 직접 설정했던 값으로 돌아가야 하므로)
function refreshSharedTileDisplayFromSession() {
  const session = getActiveSession();
  if (!session || session.status !== "active") return;
  const natureToggle = document.getElementById("tileNatureToggle");
  if (natureToggle) natureToggle.checked = session.sharedTile.natureAdjacent;
  const tribeControl = computeTribeControlFromUserId(session.sharedTile.tribeControlUserId, session.myId, session.friendId);
  const tribeSelectedValue = document.getElementById("tileTribeSelectedValue");
  if (tribeSelectedValue) tribeSelectedValue.textContent = TRIBE_LABELS[tribeControl];
}

// "내 공룡"/"상대 공룡" 라벨(타일 설정 카드의 좌우 라벨, 전투 카드의 좌우 파이터 이름, 좌우 설정
// 패널의 헤더 타이틀)을 실시간 세션 중이거나 "친구 설정 불러오기" 스냅샷을 쓰는 중이면 실제
// 닉네임으로 바꿈(스냅샷은 실시간이 아니라 "내" 쪽은 그대로 두고 상대 쪽만 닉네임으로 바꿈)
function updateFriendLabels() {
  const session = getActiveSession();
  const active = session && session.status === "active";
  const myLabel = active ? session.myNickname : "내 공룡";
  const oppLabel = active ? session.friendNickname : (friendSnapshotProfile ? friendSnapshotNickname : "상대 공룡");
  const targets = [
    [".tile-side-col-label.my-side-label", myLabel],
    [".tile-side-col-label.opp-side-label", oppLabel],
    ["#myFighter .battle-name", myLabel],
    ["#oppFighter .battle-name", oppLabel],
    ["#myPanelTitleText", myLabel],
    ["#oppPanelTitleText", oppLabel]
  ];
  targets.forEach(([selector, label]) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = label;
  });
}

// "상대 공룡" 자리를 지금 모드(일반 편집 / 스냅샷 / 실시간 세션)에 맞게 다시 그림
function renderOppPanel() {
  const container = document.getElementById("oppDinoBattleSection");
  if (!container) return;
  const session = getActiveSession();

  if (session && session.status === "inviting") {
    container.innerHTML = `
      <div class="card friend-session-waiting">
        <div>${session.friendNickname}님에게 초대를 보냈습니다.<br>응답을 기다리는 중...</div>
        <button class="friend-toolbar-btn" id="cancelInviteBtn">초대 취소</button>
      </div>
    `;
    document.getElementById("cancelInviteBtn").onclick = () => leaveFriendSession();
  } else if (session && session.status === "active") {
    if (session.friendProfile) {
      renderReadOnlyDinoSummary(container, session.friendProfile, { tagText: `🔒 ${session.friendNickname} - 실시간으로 갱신됩니다` });
    } else {
      container.innerHTML = `<div class="card friend-session-waiting"><div>${session.friendNickname}님의 공룡 설정을 불러오는 중...</div></div>`;
    }
  } else if (friendSnapshotProfile) {
    // 스냅샷은 실시간 동기화가 없는 정적 사본이라, 관찰자가 로컬에서만 다른 프리셋을 미리 볼 수
    // 있게 허용함(친구의 실제 데이터는 전혀 안 바뀜 - allowPresetSwitch 참고)
    renderReadOnlyDinoSummary(container, friendSnapshotProfile, {
      tagText: `🔒 ${friendSnapshotNickname} - 스냅샷 (편집 불가)`,
      allowPresetSwitch: true,
      onPresetSwitch: () => resetBattleDisplay()
    });
  } else {
    renderMyDinoPage(container, {
      idPrefix: "oppB_",
      storageKey: DINO_BATTLE_OPPONENT_KEY,
      unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
      unsuitableLabel: "공룡 대전에 적합하지 않은 룬입니다",
      onChange: () => resetBattleDisplay()
    });
  }

  renderOppPanelToolbar();
}

function renderOppPanelToolbar() {
  const toolbar = document.getElementById("oppPanelToolbar");
  if (!toolbar) return;
  const session = getActiveSession();

  if (session && (session.status === "active" || session.status === "inviting")) {
    toolbar.innerHTML = `<button class="friend-toolbar-btn friend-leave-btn" id="leaveFriendSessionBtn">세션 나가기</button>`;
    document.getElementById("leaveFriendSessionBtn").onclick = () => leaveFriendSession();
  } else if (friendSnapshotProfile) {
    toolbar.innerHTML = `<button class="friend-toolbar-btn" id="clearSnapshotBtn">직접 설정으로 전환</button>`;
    document.getElementById("clearSnapshotBtn").onclick = () => {
      friendSnapshotProfile = null;
      friendSnapshotNickname = null;
      renderOppPanel();
      updateFriendLabels();
      resetBattleDisplay();
    };
  } else if (myUserId) {
    toolbar.innerHTML = `
      <button class="friend-toolbar-btn" id="inviteFriendBtn">친구 초대</button>
      <button class="friend-toolbar-btn" id="loadFriendBtn">설정 불러오기</button>
    `;
    document.getElementById("inviteFriendBtn").onclick = () => openFriendPicker("invite");
    document.getElementById("loadFriendBtn").onclick = () => openFriendPicker("snapshot");
  } else {
    toolbar.innerHTML = "";
  }
}

async function openFriendPicker(mode) {
  const overlay = document.getElementById("friendPickerOverlay");
  const title = document.getElementById("friendPickerTitle");
  const list = document.getElementById("friendPickerList");
  title.textContent = mode === "invite" ? "누구를 초대할까요?" : "누구의 설정을 불러올까요?";
  list.innerHTML = `<div class="friend-picker-empty">불러오는 중...</div>`;
  overlay.style.display = "flex";

  const friends = await getAcceptedFriends(myUserId);
  if (overlay.style.display === "none") return; // 그새 닫혔으면 무시

  if (friends.length === 0) {
    list.innerHTML = `<div class="friend-picker-empty">친구가 없습니다. 먼저 친구를 추가해주세요.</div>`;
    return;
  }
  list.innerHTML = friends
    .map((f) => `<div class="friend-picker-item" data-id="${f.id}" data-nickname="${f.nickname}">${f.nickname}</div>`)
    .join("");
  list.querySelectorAll(".friend-picker-item").forEach((item) => {
    item.onclick = () => {
      overlay.style.display = "none";
      const friendId = item.dataset.id;
      const friendNickname = item.dataset.nickname;
      if (mode === "invite") {
        sendInviteToFriend(myUserId, myNickname, friendId, friendNickname);
        renderOppPanel();
        updateFriendLabels();
      } else {
        loadFriendSnapshot(friendId, friendNickname);
      }
    };
  });
}

async function loadFriendSnapshot(friendId, friendNickname) {
  // purpose:'battle' - 일부 카테고리만 공개된 상태면 전투 계산이 깨지므로, 공개 자체(enabled)가
  // 꺼져 있을 때만 null이 오고 켜져 있으면 항상 전체 프로필이 옴(카테고리별 설정과 무관)
  const { data, error } = await supabaseClient.rpc("get_friend_dino_profile", { p_friend_id: friendId, p_purpose: "battle" });
  if (error || !data) {
    alert("설정을 불러오지 못했습니다. 친구가 스탯 공개를 꺼두었거나 친구 관계가 아닐 수 있습니다.");
    return;
  }
  friendSnapshotProfile = data;
  friendSnapshotNickname = friendNickname;
  renderOppPanel();
  updateFriendLabels();
  resetBattleDisplay();
}

// friend-session.js의 onFriendSessionChange 구독 콜백. 페이지를 벗어난 뒤(다른 탭 이동)에도
// friend-session.js 쪽 구독 자체는 계속 살아있을 수 있어서, 이 페이지의 DOM이 이미 사라졌으면
// 조용히 무시함(그래야 존재하지 않는 엘리먼트를 건드리다 에러가 나는 걸 막을 수 있음)
function handleFriendSessionEvent(event) {
  if (!document.getElementById("battleMainCard")) return;

  if (event.type === "joined" || event.type === "friend-joined") {
    renderOppPanel();
    updateFriendLabels();
    applyOppTileLock(true);
    refreshSharedTileDisplayFromSession();
    refreshOppTileDisplayFromSession();
    // 상대가 (나보다 늦게, 혹은 먼저) 들어왔을 이 시점에 내 타일 설정도 전파 - 어느 쪽이 먼저
    // 들어오든 서로 초기 상태를 받게 하기 위한 이중 전송(friend-session.js의 profile 동기화와 동일한 패턴)
    const session = getActiveSession();
    if (session) {
      const settings = loadTileSettings();
      sendMyTileUpdate({
        natureAdjacent: settings.natureAdjacent,
        tribeControlUserId: computeTribeControlUserId(settings.tribeControl, session.myId, session.friendId),
        arrangement: settings.myTileArrangement,
        atkTowerLevel: settings.myAtkTowerLevel,
        hpTowerLevel: settings.myHpTowerLevel
      });
    }
    resetBattleDisplay();
  } else if (event.type === "friend-profile") {
    renderOppPanel();
    resetBattleDisplay();
  } else if (event.type === "friend-tile") {
    refreshSharedTileDisplayFromSession();
    refreshOppTileDisplayFromSession();
    resetBattleDisplay();
  } else if (event.type === "battle-start") {
    if (battlePhase === "idle" || battlePhase === "finished") startBattle(event.seed);
  } else if (event.type === "friend-left" || event.type === "left" || event.type === "declined") {
    renderOppPanel();
    updateFriendLabels();
    applyOppTileLock(false);
    resetBattleDisplay();
  }
}

function updateStackDisplay(sideKey, aliveCount) {
  const behind1 = document.getElementById(`${sideKey}Behind1`);
  const behind2 = document.getElementById(`${sideKey}Behind2`);

  behind1.style.display = aliveCount >= 2 ? "block" : "none";
  behind2.style.display = aliveCount >= 3 ? "block" : "none";
}

function renderReserveBars(sideKey, dinos) {
  const container = document.getElementById(`${sideKey}ReserveBars`);
  const fillClass = sideKey === "my" ? "my-hp-fill" : "opp-hp-fill";
  container.innerHTML = dinos
    .slice(1)
    .map((d) => {
      const pct = d.maxHp > 0 ? Math.max(0, (d.hp / d.maxHp) * 100) : 0;
      return `<div class="reserve-bar"><div class="reserve-bar-fill ${fillClass}" style="width:${pct}%;"></div></div>`;
    })
    .join("");
}

function resetBattleDisplay() {
  // 진행 중이던 재생 체인이 있다면 무력화(룬/스탯 변경으로 리셋됐는데 예전 타이머가 계속 그림을
  // 덮어쓰는 재진입 버그 방지)
  battleToken++;
  battlePhase = "idle";
  currentBattleResult = null;
  currentBattleIndex = 0;
  updateRestartButtonState();

  const myInputs = getSideInputs(MY_DINO_PROFILE_KEY);
  const oppInputs = getOppBattleInputs();
  const myStats = getBattleStats(myInputs);
  const oppStats = getBattleStats(oppInputs);

  document.getElementById("myHpFill").style.width = "100%";
  document.getElementById("oppHpFill").style.width = "100%";
  document.getElementById("myHpLabel").innerText = `${Math.floor(myStats.fHp).toLocaleString()} / ${Math.floor(myStats.fHp).toLocaleString()}`;
  document.getElementById("oppHpLabel").innerText = `${Math.floor(oppStats.fHp).toLocaleString()} / ${Math.floor(oppStats.fHp).toLocaleString()}`;

  updateStackDisplay("my", myInputs.count);
  updateStackDisplay("opp", oppInputs.count);
  renderReserveBars("my", Array.from({ length: myInputs.count }, () => ({ hp: myStats.fHp, maxHp: myStats.fHp })));
  renderReserveBars("opp", Array.from({ length: oppInputs.count }, () => ({ hp: oppStats.fHp, maxHp: oppStats.fHp })));

  ["myFighter", "oppFighter"].forEach((elId) => document.getElementById(elId).classList.remove("defeated"));
  const result = document.getElementById("battleResult");
  result.style.display = "none";
  result.innerText = "";

  const startBtn = document.getElementById("battleStartBtn");
  startBtn.disabled = false;
  startBtn.innerText = "전투 시작";
  startBtn.classList.remove("is-pressed");
}

// 같은 타겟에게 한 턴에 여러 팝업이 뜰 때 겹치지 않도록 인덱스 기준으로 좌우/상하로 살짝 흩어줌
function popupOffsetStyle(popupIndex) {
  const mid = 1; // 팝업이 3개 이하일 때 가운데(1번)가 중앙에 오도록
  const dx = (popupIndex - mid) * 24;
  const dy = popupIndex * 6;
  return `left: calc(50% + ${dx}px); top: ${dy}px;`;
}

function spawnDamagePopup(fighterElId, dmg, isCrit, label, delayMs, popupIndex = 0) {
  setTimeout(() => {
    const fighter = document.getElementById(fighterElId);
    const isSkill = !!label && label !== "평타";
    const popup = document.createElement("div");
    popup.className = "battle-dmg-popup" + (isSkill ? " skill" : "") + (isCrit ? " crit" : "");
    popup.style.cssText = popupOffsetStyle(popupIndex);
    popup.innerText = (label && label !== "평타" ? `${label} ` : "") + Math.round(dmg).toLocaleString() + (isCrit ? "!" : "");
    fighter.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }, delayMs);
}

function spawnHealPopup(fighterElId, amount, cause, delayMs, popupIndex = 0) {
  setTimeout(() => {
    const fighter = document.getElementById(fighterElId);
    const popup = document.createElement("div");
    popup.className = "battle-dmg-popup heal";
    popup.style.cssText = popupOffsetStyle(popupIndex);
    popup.innerText = amount > 0 ? `+${Math.round(amount).toLocaleString()} (${cause})` : cause;
    fighter.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }, delayMs);
}

let lungeShakeTimeout = null;

function playLungeAndShake(attackerSide, defenderSide) {
  const attackerAvatar = document.getElementById(`${attackerSide}Avatar`);
  const defenderAvatar = document.getElementById(`${defenderSide}Avatar`);
  const lungeClass = attackerSide === "my" ? "lunge-right" : "lunge-left";

  // "빠름" 속도(턴 간격 150ms)는 애니메이션 정리 시간(350ms)보다 짧아서, 이전 턴의 정리 타이머가
  // 새로 시작된 애니메이션을 중간에 끊어버리는 게 겹쳐서 경련처럼 보였음. 매번 이전 타이머를
  // 취소하고, 양쪽 공룡의 관련 클래스를 전부 지운 뒤 강제로 리플로우시켜서 애니메이션이 항상
  // 처음부터 깔끔하게 다시 시작되도록 함(겹치는 타이머가 하나도 안 남게).
  clearTimeout(lungeShakeTimeout);
  [attackerAvatar, defenderAvatar].forEach((el) => {
    el.classList.remove("lunge-right", "lunge-left", "hit-shake");
  });
  void attackerAvatar.offsetWidth;

  attackerAvatar.classList.add(lungeClass);
  defenderAvatar.classList.add("hit-shake");
  lungeShakeTimeout = setTimeout(() => {
    attackerAvatar.classList.remove(lungeClass);
    defenderAvatar.classList.remove("hit-shake");
  }, 350);
}

function playDeathFlash(sideKey) {
  const avatar = document.getElementById(`${sideKey}Avatar`);
  avatar.classList.add("front-defeated");
  setTimeout(() => avatar.classList.remove("front-defeated"), 400);
}

function renderBattleEvent(ev) {
  playLungeAndShake(ev.attackerSide, ev.defenderSide);

  // 같은 타겟(내 공룡/상대 공룡)에게 뜨는 팝업들끼리 순서대로 인덱스를 매겨서 겹치지 않게 흩어줌
  const popupIndex = { my: 0, opp: 0 };
  const nextDelay = { my: 0, opp: 0 };
  const STAGGER_MS = 150;

  ev.hits.forEach((hit) => {
    const side = hit.targetSide;
    spawnDamagePopup(`${side}Fighter`, hit.dmg, hit.isCrit, hit.label, nextDelay[side], popupIndex[side]);
    popupIndex[side]++;
    nextDelay[side] += STAGGER_MS;
  });
  ev.heals.forEach((heal) => {
    const side = heal.side;
    spawnHealPopup(`${side}Fighter`, heal.amount, heal.cause, nextDelay[side], popupIndex[side]);
    popupIndex[side]++;
    nextDelay[side] += STAGGER_MS;
  });

  if (ev.aoe) {
    const arena = document.getElementById("battleArena");
    arena.classList.add("area-flash");
    setTimeout(() => arena.classList.remove("area-flash"), 400);
    const side = ev.defenderSide;
    spawnDamagePopup(`${side}Fighter`, ev.aoe.targets.length, ev.aoe.isCrit, `${ev.aoe.label} ${ev.aoe.targets.length}마리 적중`, nextDelay[side], popupIndex[side]);
    popupIndex[side]++;
    nextDelay[side] += STAGGER_MS;
  }

  if (ev.deaths.length > 0) {
    ev.deaths.forEach((d) => playDeathFlash(d.side));
  }

  // 평타 100회 교환 동시사망(무한 교착 방지 규칙) - 양쪽 다 표시
  if (ev.mutualKill) {
    spawnHealPopup("myFighter", 0, "100회 교환 - 동시 사망", nextDelay.my, popupIndex.my);
    spawnHealPopup("oppFighter", 0, "100회 교환 - 동시 사망", nextDelay.opp, popupIndex.opp);
  }

  document.getElementById("myHpFill").style.width = `${Math.max(0, (ev.myFrontHp / ev.myFrontMaxHp) * 100)}%`;
  document.getElementById("oppHpFill").style.width = `${Math.max(0, (ev.oppFrontHp / ev.oppFrontMaxHp) * 100)}%`;
  document.getElementById("myHpLabel").innerText = `${Math.max(0, Math.round(ev.myFrontHp)).toLocaleString()} / ${Math.floor(ev.myFrontMaxHp).toLocaleString()}`;
  document.getElementById("oppHpLabel").innerText = `${Math.max(0, Math.round(ev.oppFrontHp)).toLocaleString()} / ${Math.floor(ev.oppFrontMaxHp).toLocaleString()}`;

  updateStackDisplay("my", ev.myAliveCount);
  updateStackDisplay("opp", ev.oppAliveCount);
  renderReserveBars("my", ev.myDinos);
  renderReserveBars("opp", ev.oppDinos);
}

function finishBattleDisplay(result) {
  document.getElementById("myFighter").classList.toggle("defeated", result.myFinalCount === 0);
  document.getElementById("oppFighter").classList.toggle("defeated", result.oppFinalCount === 0);

  const resultEl = document.getElementById("battleResult");
  resultEl.style.display = "block";
  if (result.winner === "draw") resultEl.innerText = "무승부!";
  else if (result.winner === "my") resultEl.innerText = "승리!";
  else resultEl.innerText = "패배...";

  battlePhase = "finished";
  const startBtn = document.getElementById("battleStartBtn");
  startBtn.innerText = "다시 시작";
  startBtn.classList.remove("is-pressed"); // 재생이 멈춘 상태라 눌린 채로 두지 않음
}

// "전투 시작" 버튼 하나가 battlePhase에 따라 시작/일시정지/재개/다시시작을 전부 겸함.
// 눌린 것처럼(is-pressed) 보이는 건 실제로 재생 중(playing)일 때뿐 - 일시정지/다시시작처럼
// 재생이 멈춰 있으면 다시 눌러도 되는 버튼이라는 뜻으로 원래대로 떠 있어야 함
function onBattleButtonClick() {
  const startBtn = document.getElementById("battleStartBtn");
  if (battlePhase === "playing") {
    battlePhase = "paused";
    startBtn.innerText = "재개";
    startBtn.classList.remove("is-pressed");
    return;
  }
  if (battlePhase === "paused") {
    battlePhase = "playing";
    startBtn.innerText = "일시정지";
    startBtn.classList.add("is-pressed");
    runBattleStep(battleToken);
    return;
  }
  // idle 또는 finished -> 새 전투 시작
  startBattle();
}

function runBattleStep(token) {
  if (token !== battleToken) return; // 리셋되거나 새 전투가 시작돼서 무효화된 낡은 체인
  if (battlePhase !== "playing") return; // 일시정지 중이면 "재개" 클릭이 다시 호출해줌

  if (currentBattleIndex >= currentBattleResult.events.length) {
    finishBattleDisplay(currentBattleResult);
    return;
  }
  renderBattleEvent(currentBattleResult.events[currentBattleIndex]);
  currentBattleIndex++;
  setTimeout(() => runBattleStep(token), getBattleSpeedMs());
}

// externalSeed가 주어지면(친구 세션에서 상대가 "전투 시작"을 눌러 전파된 시드) 그 시드로 로컬
// 재생만 함 - 새 시드를 만들어 다시 보내지 않음(그러면 무한루프). 내가 직접 누른 거면 새 시드를
// 만들어서 세션 중일 때만 상대에게도 전파함(로컬 "실전 대전"은 지금까지처럼 매번 다른 결과)
function startBattle(externalSeed) {
  battleToken++;
  const token = battleToken;

  let seed = externalSeed;
  if (seed === undefined && isFriendSessionActive()) {
    seed = Math.floor(Math.random() * 2 ** 31);
    sendBattleStart(seed);
  }

  const tileSettings = getEffectiveTileSettings();
  currentBattleResult = runDinoBattleSimulation({
    my: getSideInputs(MY_DINO_PROFILE_KEY),
    opp: getOppBattleInputs(),
    tileSettings,
    seed
  });
  currentBattleIndex = 0;
  battlePhase = "playing";

  const startBtn = document.getElementById("battleStartBtn");
  startBtn.innerText = "일시정지";
  startBtn.classList.add("is-pressed");
  document.getElementById("battleResult").style.display = "none";
  updateRestartButtonState();

  runBattleStep(token);
}

function updateRestartButtonState() {
  document.getElementById("battleRestartBtn").disabled = battlePhase === "idle";
}
