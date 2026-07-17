// 공룡 대전: 내 공룡 팀 vs 상대 공룡 팀. 각 팀은 타일 위에 자신의 공룡 수만큼 전부 올라와 있고,
// 맨 앞(제일 위) 공룡끼리 1:1로 싸우다가 죽으면 다음 공룡이 앞으로 나옴. 전투 시작 시점의 종합
// 공격력이 더 높은 쪽이 선공이고, 이후 공격권이 팀 단위로 번갈아감(내 공격 1회 -> 상대 공격 1회 -> ...).
// 실제 계산은 js/core/simulation-dino-battle.js가 전체 이벤트 로그를 한 번에 계산해서 돌려주고,
// 이 파일은 그 로그를 순서대로 재생하며 애니메이션만 담당함(타이탄전과 달리 500회 평균이 아니라
// 버튼 한 번 = 실제 대전 1회를 그대로 보여주는 방식).
const DINO_BATTLE_OPPONENT_KEY = "dino_battle_opponent_profile";
const DINO_BATTLE_TILE_KEY = "dino_battle_tile_settings";
const BATTLE_TURN_INTERVAL_MS = 650;

function defaultTileSettings() {
  return { natureAdjacent: false, tribeControl: "none" };
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
      <h2>타일 설정</h2>
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

        <div class="card battle-arena-card">
          <div class="battle-arena" id="battleArena">
            <div class="battle-fighter" id="myFighter">
              <div class="battle-name">내 공룡</div>
              <div class="battle-hp-bar"><div class="battle-hp-fill my-hp-fill" id="myHpFill"></div></div>
              <div class="battle-hp-label" id="myHpLabel">0 / 0</div>
              <div class="battle-stack">
                <div class="stack-dino behind-2 my-avatar" id="myBehind2"></div>
                <div class="stack-dino behind-1 my-avatar" id="myBehind1"></div>
                <div class="stack-dino front battle-avatar my-avatar" id="myAvatar"></div>
                <div class="stack-count" id="myStackCount" style="display:none;"></div>
              </div>
            </div>

            <div class="battle-vs">VS</div>

            <div class="battle-fighter" id="oppFighter">
              <div class="battle-name">상대 공룡</div>
              <div class="battle-hp-bar"><div class="battle-hp-fill opp-hp-fill" id="oppHpFill"></div></div>
              <div class="battle-hp-label" id="oppHpLabel">0 / 0</div>
              <div class="battle-stack">
                <div class="stack-dino behind-2 opp-avatar" id="oppBehind2"></div>
                <div class="stack-dino behind-1 opp-avatar" id="oppBehind1"></div>
                <div class="stack-dino front battle-avatar opp-avatar" id="oppAvatar"></div>
                <div class="stack-count" id="oppStackCount" style="display:none;"></div>
              </div>
            </div>
          </div>

          <div class="battle-result" id="battleResult" style="display:none;"></div>
          <button class="btn-simulate" id="battleStartBtn">전투 시작</button>
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

  document.getElementById("battleStartBtn").onclick = startBattle;
  resetBattleDisplay();
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
}

function getSideInputs(storageKey) {
  return getMyDinoBattleInputs(storageKey);
}

function updateStackDisplay(sideKey, aliveCount) {
  const behind1 = document.getElementById(`${sideKey}Behind1`);
  const behind2 = document.getElementById(`${sideKey}Behind2`);
  const countBadge = document.getElementById(`${sideKey}StackCount`);

  behind1.style.display = aliveCount >= 2 ? "block" : "none";
  behind2.style.display = aliveCount >= 3 ? "block" : "none";

  const extra = aliveCount - 3;
  if (extra > 0) {
    countBadge.style.display = "flex";
    countBadge.innerText = `+${extra}`;
  } else {
    countBadge.style.display = "none";
  }
}

function resetBattleDisplay() {
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

  ["myFighter", "oppFighter"].forEach((elId) => document.getElementById(elId).classList.remove("defeated"));
  const result = document.getElementById("battleResult");
  result.style.display = "none";
  result.innerText = "";

  const startBtn = document.getElementById("battleStartBtn");
  startBtn.disabled = false;
  startBtn.innerText = "전투 시작";
}

function spawnDamagePopup(fighterElId, dmg, isCrit, label, delayMs) {
  setTimeout(() => {
    const fighter = document.getElementById(fighterElId);
    const popup = document.createElement("div");
    popup.className = "battle-dmg-popup" + (isCrit ? " crit" : "");
    popup.innerText = (label && label !== "평타" ? `${label} ` : "") + Math.round(dmg).toLocaleString() + (isCrit ? "!" : "");
    fighter.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }, delayMs);
}

function spawnHealPopup(fighterElId, amount, cause) {
  const fighter = document.getElementById(fighterElId);
  const popup = document.createElement("div");
  popup.className = "battle-dmg-popup heal";
  popup.innerText = amount > 0 ? `+${Math.round(amount).toLocaleString()} (${cause})` : cause;
  fighter.appendChild(popup);
  popup.addEventListener("animationend", () => popup.remove());
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

  ev.hits.forEach((hit, i) => {
    spawnDamagePopup(`${hit.targetSide}Fighter`, hit.dmg, hit.isCrit, hit.label, i * 130);
  });
  ev.heals.forEach((heal) => spawnHealPopup(`${heal.side}Fighter`, heal.amount, heal.cause));

  if (ev.aoe) {
    const arena = document.getElementById("battleArena");
    arena.classList.add("area-flash");
    setTimeout(() => arena.classList.remove("area-flash"), 400);
    spawnDamagePopup(`${ev.defenderSide}Fighter`, ev.aoe.targets.length, false, `${ev.aoe.label} ${ev.aoe.targets.length}마리 적중`, 250);
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
}

function finishBattleDisplay(result) {
  document.getElementById("myFighter").classList.toggle("defeated", result.myFinalCount === 0);
  document.getElementById("oppFighter").classList.toggle("defeated", result.oppFinalCount === 0);

  const resultEl = document.getElementById("battleResult");
  resultEl.style.display = "block";
  if (result.winner === "draw") resultEl.innerText = "무승부!";
  else if (result.winner === "my") resultEl.innerText = "승리!";
  else resultEl.innerText = "패배...";

  const startBtn = document.getElementById("battleStartBtn");
  startBtn.disabled = false;
  startBtn.innerText = "다시 시작";
}

function startBattle() {
  const tileSettings = loadTileSettings();
  const result = runDinoBattleSimulation({
    my: getSideInputs(MY_DINO_PROFILE_KEY),
    opp: getSideInputs(DINO_BATTLE_OPPONENT_KEY),
    tileSettings
  });

  const startBtn = document.getElementById("battleStartBtn");
  startBtn.disabled = true;
  startBtn.innerText = "전투 중...";
  document.getElementById("battleResult").style.display = "none";

  let i = 0;
  function step() {
    if (i >= result.events.length) {
      finishBattleDisplay(result);
      return;
    }
    renderBattleEvent(result.events[i]);
    i++;
    setTimeout(step, BATTLE_TURN_INTERVAL_MS);
  }
  step();
}
