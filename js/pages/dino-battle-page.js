// 공룡 대전: 내 공룡 팀 vs 상대 공룡 팀. 각 팀은 타일 위에 자신의 공룡 수만큼 전부 올라와 있고,
// 맨 앞(제일 위) 공룡끼리 1:1로 싸우다가 죽으면 다음 공룡이 앞으로 나옴. 전투 시작 시점의 종합
// 공격력이 더 높은 쪽이 선공이고, 이후 공격권이 팀 단위로 번갈아감(내 공격 1회 -> 상대 공격 1회 -> ...).
// 실제 계산은 js/core/simulation-dino-battle.js가 전체 이벤트 로그를 한 번에 계산해서 돌려주고,
// 이 파일은 그 로그를 순서대로 재생하며 애니메이션만 담당함(타이탄전과 달리 500회 평균이 아니라
// 버튼 한 번 = 실제 대전 1회를 그대로 보여주는 방식).
const DINO_BATTLE_OPPONENT_KEY = "dino_battle_opponent_profile";
const DINO_BATTLE_TILE_KEY = "dino_battle_tile_settings";
const DINO_BATTLE_SPEED_KEY = "dino_battle_speed_ms";
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

function defaultTileSettings() {
  return { natureAdjacent: false, tribeControl: "none", myTileArrangement: "same", oppTileArrangement: "same" };
}

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
        <div class="setting-row">
          <div class="setting-label">내 공룡 배치</div>
          <div class="custom-dropdown setting-control" id="myTileArrangementDropdown">
            <div class="selected-value" id="myTileArrangementSelectedValue">한 타일</div>
            <ul class="dropdown-list" id="myTileArrangementList"></ul>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-label">상대 공룡 배치</div>
          <div class="custom-dropdown setting-control" id="oppTileArrangementDropdown">
            <div class="selected-value" id="oppTileArrangementSelectedValue">한 타일</div>
            <ul class="dropdown-list" id="oppTileArrangementList"></ul>
          </div>
        </div>
      </div>
    </div>

    <div class="battle-layout" id="battleLayout">
      <div class="battle-side-panel my-side" id="mySidePanel">
        <div class="battle-panel-header">
          <span>내 공룡</span>
          <button class="close-btn battle-panel-close" id="myPanelClose">✕</button>
        </div>
        <div id="myDinoBattleSection"></div>
      </div>

      <div class="battle-arena-wrap">
        <button class="battle-peek-btn my-peek" id="myPeekBtn" title="내 공룡 설정">▶</button>

        <div class="battle-mode-tabs">
          <button class="battle-mode-tab" data-mode="quick" id="modeTabQuick">빠른 계산</button>
          <button class="battle-mode-tab active" data-mode="live" id="modeTabLive">실전 대전</button>
        </div>

        <div class="card battle-quickcalc-card" id="quickModeCard" style="display:none;">
          <p class="quickcalc-desc">대기 공룡 없이 공룡 1마리씩 맞붙어서, 죽으면 그 자리에서 즉시 부활시키며 500번 죽을 때까지 반복합니다. 평균 교환비와 킬당 평균 데미지를 계산합니다.</p>
          <button class="btn-simulate" id="quickCalcBtn">500회 계산하기</button>
          <div class="report-grid" id="quickCalcResult" style="display:none;">
            <div class="report-tile"><div class="metric-label">교환 결과 (500번 중)</div><div class="metric-value accent" id="qcRatio">-</div></div>
            <div class="report-tile"><div class="metric-label">내 공룡 킬당 평균 피해</div><div class="metric-value" id="qcMyDmg">-</div></div>
            <div class="report-tile"><div class="metric-label">상대 공룡 킬당 평균 피해</div><div class="metric-value" id="qcOppDmg">-</div></div>
          </div>
        </div>

        <div class="card battle-arena-card" id="liveModeCard">
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

            <div class="battle-vs">VS</div>

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

        <button class="battle-peek-btn opp-peek" id="oppPeekBtn" title="상대 공룡 설정">◀</button>
      </div>

      <div class="battle-side-panel opp-side" id="oppSidePanel">
        <div class="battle-panel-header">
          <span>상대 공룡</span>
          <button class="close-btn battle-panel-close" id="oppPanelClose">✕</button>
        </div>
        <div id="oppDinoBattleSection"></div>
      </div>
    </div>
    <div class="battle-panel-overlay" id="battlePanelOverlay"></div>
  `;

  initDinoBattlePage();
}

function initDinoBattlePage() {
  renderMyDinoPage(document.getElementById("myDinoBattleSection"), {
    idPrefix: "myB_",
    storageKey: MY_DINO_PROFILE_KEY,
    unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: "공룡 대전에 적합하지 않은 룬입니다",
    onChange: () => resetBattleDisplay()
  });
  renderMyDinoPage(document.getElementById("oppDinoBattleSection"), {
    idPrefix: "oppB_",
    storageKey: DINO_BATTLE_OPPONENT_KEY,
    unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: "공룡 대전에 적합하지 않은 룬입니다",
    onChange: () => resetBattleDisplay()
  });

  initTileSettings();
  initSpeedDropdown();

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
    if (battlePhase !== "idle") startBattle();
  };
  document.getElementById("quickCalcBtn").onclick = startQuickCalc;
  initModeTabs();
  resetBattleDisplay();
}

function initModeTabs() {
  const quickTab = document.getElementById("modeTabQuick");
  const liveTab = document.getElementById("modeTabLive");
  const quickCard = document.getElementById("quickModeCard");
  const liveCard = document.getElementById("liveModeCard");

  quickTab.onclick = () => {
    quickTab.classList.add("active");
    liveTab.classList.remove("active");
    quickCard.style.display = "block";
    liveCard.style.display = "none";
  };
  liveTab.onclick = () => {
    liveTab.classList.add("active");
    quickTab.classList.remove("active");
    liveCard.style.display = "block";
    quickCard.style.display = "none";
  };
}

function startQuickCalc() {
  const tileSettings = loadTileSettings();
  const btn = document.getElementById("quickCalcBtn");
  btn.disabled = true;
  btn.innerText = "계산 중...";

  // 500번 반복이지만 애니메이션 없이 동기 계산이라 순식간에 끝남 - setTimeout으로 한 틱 양보해서
  // "계산 중..." 텍스트가 먼저 그려지게만 함
  setTimeout(() => {
    const result = runDinoQuickCalc({
      my: getSideInputs(MY_DINO_PROFILE_KEY),
      opp: getSideInputs(DINO_BATTLE_OPPONENT_KEY),
      tileSettings
    });

    document.getElementById("qcRatio").innerText = `${result.myKills} : ${result.oppKills}`;
    document.getElementById("qcMyDmg").innerText = Math.round(result.avgMyDmgPerKill).toLocaleString();
    document.getElementById("qcOppDmg").innerText = Math.round(result.avgOppDmgPerKill).toLocaleString();
    document.getElementById("quickCalcResult").style.display = "grid";

    btn.disabled = false;
    btn.innerText = "500회 계산하기";
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
    resetBattleDisplay();
  };

  const TRIBE_LABELS = { none: "없음", mine: "내 부족", opponent: "상대 부족" };
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
}

const ARRANGEMENT_LABELS = { same: "한 타일", separate: "다른 타일" };

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
  const oppInputs = getSideInputs(DINO_BATTLE_OPPONENT_KEY);
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

function playLungeAndShake(attackerSide, defenderSide) {
  const attackerAvatar = document.getElementById(`${attackerSide}Avatar`);
  const defenderAvatar = document.getElementById(`${defenderSide}Avatar`);
  const lungeClass = attackerSide === "my" ? "lunge-right" : "lunge-left";
  attackerAvatar.classList.add(lungeClass);
  defenderAvatar.classList.add("hit-shake");
  setTimeout(() => {
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
  document.getElementById("battleStartBtn").innerText = "다시 시작";
}

// "전투 시작" 버튼 하나가 battlePhase에 따라 시작/일시정지/재개/다시시작을 전부 겸함
function onBattleButtonClick() {
  if (battlePhase === "playing") {
    battlePhase = "paused";
    document.getElementById("battleStartBtn").innerText = "재개";
    return;
  }
  if (battlePhase === "paused") {
    battlePhase = "playing";
    document.getElementById("battleStartBtn").innerText = "일시정지";
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

function startBattle() {
  battleToken++;
  const token = battleToken;

  const tileSettings = loadTileSettings();
  currentBattleResult = runDinoBattleSimulation({
    my: getSideInputs(MY_DINO_PROFILE_KEY),
    opp: getSideInputs(DINO_BATTLE_OPPONENT_KEY),
    tileSettings
  });
  currentBattleIndex = 0;
  battlePhase = "playing";

  document.getElementById("battleStartBtn").innerText = "일시정지";
  document.getElementById("battleResult").style.display = "none";
  updateRestartButtonState();

  runBattleStep(token);
}

function updateRestartButtonState() {
  document.getElementById("battleRestartBtn").disabled = battlePhase === "idle";
}
