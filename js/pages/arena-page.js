// 아레나: 5:5 진영전(전열 2 / 후열 3 고정 편성). 공룡 대전과 달리 양 진영 항상 5마리 고정이고,
// 각 슬롯(1~5번)이 룬 조합만 서로 다름(기본 스탯/VIP/별자리/둥지·알스킨은 진영 전체가 공유).
// "소환 배치" = 각 슬롯에 "내 공룡"/"상대 공룡" 페이지에서 만들어둔 9개 룬 프리셋 중 하나(또는
// 없음)를 배정하는 것. 실제 계산은 js/core/simulation-arena.js가 전체 이벤트 로그를 계산해서
// 돌려주고, 이 파일은 dino-battle-page.js와 같은 방식으로 그 로그를 재생만 함.
//
// 아레나는 "타일" 개념 자체가 없어서(항상 고정 1:1 매치) 공룡 대전의 타일 설정(자연의 포옹/부족의
// 축복/버프 타워)이 전혀 적용되지 않음 - 관련 룬은 ARENA_UNSUITABLE_RUNE_LIST로 아예 부적합 처리.
// 대신 친구 기능(초대로 실시간 세션 / 설정 불러오기로 스냅샷)은 공룡 대전과 동일하게 지원함 -
// friend-session.js의 세션은 페이지 전역 싱글턴이라 dino-battle-page.js와 그대로 공유됨.
//
// 주의: 이 파일과 dino-battle-page.js는 같은 전역 스코프를 공유하는 별도 <script>라서(ES 모듈이
// 아님), 이름이 겹치는 함수/변수를 선언하면 나중에 로드된 쪽이 앞쪽을 조용히 덮어써버림(라우터가
// #app의 내용만 바꿀 뿐 스크립트를 다시 로드하진 않으므로, 덮어써지면 공룡 대전 페이지가 고장남).
// 그래서 여기 있는 페이지 전용 식별자는 전부 arena/Arena 접두사를 붙임. BUFF_TOWER_OPTIONS,
// BATTLE_SPEED_OPTIONS, onFriendSessionChange/getActiveSession/sendInviteToFriend 등
// dino-battle-page.js·friend-session.js가 먼저 정의해둔 것들은 그대로 재사용함.

const ARENA_OPPONENT_KEY = "dino_arena_opponent_profile";
const ARENA_SPEED_KEY = "dino_arena_speed_ms";

// 아레나 배치는 2단계 저장 구조를 씀:
// - "슬롯에 배정할 룬 조합"은 별도 풀을 새로 만들지 않고, 그 진영의 "내 공룡"/"상대 공룡" 설정
//   페이지에 이미 있는 룬 프리셋 9개(runePresets, my-dino-page.js)를 그대로 가져다 씀 - 슬롯 편집
//   팝업에서 프리셋을 고르거나 룬을 수정하면 "룬 조합" 탭에서 보이는 것과 완전히 같은 데이터가
//   즉시 바뀜(같은 프리셋이므로 둘 다 정확히 동기화됨).
// - "아레나 프리셋"(5개) = 5슬롯 전부에 (그 진영 프리셋 9개 중) 어떤 걸 배정했는지를 통째로
//   저장/전환하는 상위 레이어. 저장하는 건 프리셋 "인덱스"뿐이라 프리셋 자체를 나중에 수정하면
//   그 프리셋을 쓰는 모든 슬롯/아레나 프리셋에 자동 반영됨.
// "내 진영" 배치는 로컬 전용이 아니라 내 공룡 프로필의 arenaFormations 필드로 계정에 동기화됨(친구
// 스탯 확인에서 내 아레나 프리셋도 보이게 하기 위함) - "상대 진영"(로컬 테스트용 가상 상대)만 계속
// 이 기기에만 남는 별도 로컬 저장소를 씀
const ARENA_OPP_FORMATIONS_KEY = "dino_arena_opp_formations";
const ARENA_FORMATION_COUNT = 5;

// 아레나엔 타일 설정이 없어서(자연의 포옹/부족의 축복 룬도 부적합 처리됨) 항상 중립값 고정
const ARENA_TILE_CFG = {
  natureAdjacent: false, tribeControl: "none",
  myAtkTowerLevel: null, myHpTowerLevel: null, oppAtkTowerLevel: null, oppHpTowerLevel: null
};

// 빠른 계산 시행 횟수: 매 시행마다 5:5 전투를 처음부터 다시 여는 구조라 공룡 대전(1:1, 100,000회)과
// 같은 자리수는 무리(체감상 수십 초씩 걸림) - 실측(node 벤치마크) 기준 3,000회가 ~2.5초 안팎으로
// 버튼 반응성과 통계적 신뢰도(승률 표본오차 대략 ±2~3%p) 사이에서 적당한 지점
const ARENA_QUICK_CALC_TRIALS = 3000;

// 재생 컨트롤 상태 - dino-battle-page.js의 battleToken/battlePhase 등과 동일한 패턴이지만
// 이름 충돌 방지를 위해 arena 접두사를 붙인 별도 상태
let arenaBattleToken = 0;
let arenaBattlePhase = "idle"; // "idle" | "playing" | "paused" | "finished"
let arenaCurrentBattleResult = null;
let arenaCurrentBattleIndex = 0;
let arenaShakeTimeout = null;

// dino-battle-page.js와 동일한 이유(SPA 라우터엔 teardown 훅이 없어서 페이지를 벗어나도 예약된
// setTimeout이 그대로 실행돼 이미 사라진 DOM을 건드림) - "동일한 패턴"이라는 위 주석과 달리 정작
// 이 무효화 리스너 자체가 빠져있었음(사이트 전체 점검에서 발견, 사용자 확정)
window.addEventListener("hashchange", () => { arenaBattleToken++; });

// 친구 기능(초대/설정 불러오기) 상태 - dino-battle-page.js의 동명 상태와 동일한 역할이지만 이름
// 충돌 방지를 위해 arena 접두사를 붙임. "상대 진영"에만 적용됨(내 진영은 항상 로컬 편집).
let arenaMyUserId = null;
let arenaMyNickname = null;
let arenaFriendSnapshotProfile = null;
let arenaFriendSnapshotNickname = null;
let arenaUnsubscribeFriendSession = null;

// 친구 세션/스냅샷을 보는 동안의 "상대 진영" 5슬롯 배정은 내가 로컬로 직접 만들어둔 상대 진영
// 배치(ARENA_OPP_FORMATIONS_KEY)와는 완전히 별개로, 메모리에만 잠깐 두는 임시 데이터임(저장 안 함).
// 예전엔 친구 걸 불러올 때 로컬 저장소를 직접 덮어써버려서, 나중에 "직접 설정"으로 돌아오면 내가
// 만들어뒀던 배치가 사라지는 버그가 있었음 - 이제 그 로컬 저장소는 친구 모드일 땐 아예 건드리지 않음
let arenaFriendFormations = null;

// "아레나 배치" 탭이 현재 마운트되어 있으면 그 탭의 미리보기를 다시 그리는 함수가 여기 등록됨(탭이
// 편집 모드일 때). 다른 경로(친구 세션 등)에서 데이터가 바뀌었을 때 화면을 갱신하려고 참조함.
const arenaFormationTabRefreshers = {};

// 슬롯 편집 팝업(사각형 하나를 눌렀을 때 뜨는 룬 슬롯+프리셋 화면)은 페이지에 하나만 마운트해두고
// 재사용함 - 지금 어느 진영/슬롯/프리셋을 가리키고 있는지 여기에 기록
let arenaSlotEditRuneUI = null;
let arenaSlotEditSide = null;
let arenaSlotEditSlotIndex = null;
let arenaSlotEditPresetIndex = 0;

// ===== 슬롯에 배정할 룬 프리셋 = 그 진영의 "내 공룡"/"상대 공룡" 설정 페이지에 이미 있는
// runePresets(9개, my-dino-page.js)를 그대로 재사용. 별도 저장소를 새로 두지 않음 =====

function arenaEmptySlotRunes() {
  return [null, null, null, null, null];
}

function arenaProfileStorageKey(sideKey) {
  return sideKey === "my" ? MY_DINO_PROFILE_KEY : ARENA_OPPONENT_KEY;
}

// ===== 아레나 프리셋(5슬롯 전부의 배정을 통째로 담은 저장 슬롯 5개) =====

function arenaDefaultFormationsData() {
  return {
    formations: Array.from({ length: ARENA_FORMATION_COUNT }, () => ({
      name: null,
      slotPresetIndices: [null, null, null, null, null]
    })),
    activeFormationIndex: 0
  };
}

// name이 null(한 번도 직접 이름을 바꾼 적 없음)이면 그 자리에서 지금 활성 언어로 "배치 N"을
// 계산해서 보여줌 - [[my-dino-page.js]]의 runePresetDisplayName()과 같은 패턴(언어를 바꿔도
// 항상 최신 언어를 따라가게 하기 위해 name 자체는 저장 안 함)
function arenaFormationDisplayName(formation, idx) {
  return (formation && formation.name) || t("arena.formationDefaultName", { index: idx + 1 });
}

function arenaSanitizeFormation(f, i) {
  const raw = Array.isArray(f && f.slotPresetIndices) && f.slotPresetIndices.length === 5 ? f.slotPresetIndices : [null, null, null, null, null];
  // 예전엔 이름을 한 번도 안 바꾼 배치도 name에 그때 언어로 번역된 문자열이 그대로 저장돼 있었음 -
  // 5개 언어 중 하나로 구워진 "자동 기본 이름"과 정확히 일치하면 다시 null로 되돌려서
  // arenaFormationDisplayName()이 항상 지금 언어로 계산해 보여주게 함(사용자 지적으로 발견한 버그)
  const name = i18nIsDefaultName("arena.formationDefaultName", i + 1, f && f.name) ? null : f.name;
  return {
    name,
    slotPresetIndices: raw.map((idx) => (Number.isInteger(idx) && idx >= 0 && idx < RUNE_PRESET_COUNT ? idx : null))
  };
}

function arenaSanitizeFormationsData(saved) {
  if (!saved || !Array.isArray(saved.formations) || saved.formations.length !== ARENA_FORMATION_COUNT) return arenaDefaultFormationsData();
  const activeFormationIndex = Number.isInteger(saved.activeFormationIndex) && saved.activeFormationIndex >= 0 && saved.activeFormationIndex < ARENA_FORMATION_COUNT
    ? saved.activeFormationIndex : 0;
  return { formations: saved.formations.map(arenaSanitizeFormation), activeFormationIndex };
}

function arenaLoadFormationsData(sideKey) {
  // 상대 진영이 친구의 것(실시간 세션/스냅샷)이면 로컬 저장소 대신 메모리상의 임시 배치를 씀 -
  // 내가 직접 만들어둔 상대 진영 배치(로컬 저장소)는 절대 안 건드림. arenaFriendFormations가 아직
  // null이면(친구의 진짜 배치가 아직 도착 전) 여기서 캐싱하지 않고 매번 새 빈 기본값만 임시로
  // 돌려줌 - 여기서 캐싱해버리면 실시간 세션에서 진짜 배치(friend-profile 이벤트)가 도착하기 전에
  // 렌더링이 먼저 일어날 때 빈 기본값이 그대로 굳어버려서, 나중에 도착한 진짜 배치로 채우는 동기화
  // 로직(arenaSyncOppFormationsFromFriend)이 "이미 채워진 것"으로 오판해 건너뛰게 됨
  if (sideKey === "opp" && arenaIsOppRunePresetsForeign()) {
    return arenaFriendFormations || arenaDefaultFormationsData();
  }
  if (sideKey === "my") {
    // 내 아레나 배치는 로컬 전용 저장소가 아니라 "내 공룡" 프로필 자체의 필드(runePresets와 같은
    // 방식)로 저장함 - 계정에 동기화되므로 친구가 "친구 스탯 확인"에서 내 아레나 프리셋도 볼 수 있음
    return arenaSanitizeFormationsData(loadMyDinoProfile(MY_DINO_PROFILE_KEY).arenaFormations);
  }
  try {
    return arenaSanitizeFormationsData(JSON.parse(localStorage.getItem(ARENA_OPP_FORMATIONS_KEY)));
  } catch (e) {
    return arenaDefaultFormationsData();
  }
}

function arenaSaveFormationsData(sideKey, data) {
  if (sideKey === "opp" && arenaIsOppRunePresetsForeign()) {
    arenaFriendFormations = data;
    return;
  }
  if (sideKey === "my") {
    const profile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
    profile.arenaFormations = data;
    saveMyDinoProfile(profile, MY_DINO_PROFILE_KEY);
    if (arenaIsFriendSessionActive()) sendMyProfileUpdate(profile);
    return;
  }
  localStorage.setItem(ARENA_OPP_FORMATIONS_KEY, JSON.stringify(data));
}

// 실전/빠른 계산 양쪽 다 여기서 "지금 쓸 5슬롯 룬"을 가져옴 - 활성 아레나 프리셋의 슬롯별 배정
// 인덱스를 그 진영 프로필의 runePresets(9개)에서 실제 룬으로 해석함
function arenaGetActiveSlotRunes(sideKey) {
  const formationsData = arenaLoadFormationsData(sideKey);
  const formation = formationsData.formations[formationsData.activeFormationIndex];
  const runePresets = arenaResolveRunePresetsProfile(sideKey).runePresets;
  return formation.slotPresetIndices.map((idx) => (idx !== null && runePresets[idx] ? runePresets[idx].runes : arenaEmptySlotRunes()));
}

// ===== 친구 기능: 실시간 세션 / 설정 불러오기 스냅샷 =====

function arenaIsFriendSessionActive() {
  const session = getActiveSession();
  return !!(session && session.status === "active");
}

// 실제 전투/배치 계산에 쓸 "상대 진영" 프로필: 실시간 세션 중이면 상대가 보낸 프로필, 스냅샷을
// 불러온 상태면 그 스냅샷, 둘 다 아니면 로컬에 저장된 "상대 진영" 프로필(공룡 대전의
// getOppBattleInputs와 동일한 우선순위)
function arenaGetOppProfile() {
  const session = getActiveSession();
  if (session && session.status === "active" && session.friendProfile) return session.friendProfile;
  if (arenaFriendSnapshotProfile) return arenaFriendSnapshotProfile;
  return loadMyDinoProfile(ARENA_OPPONENT_KEY);
}

// 슬롯에 배정할 룬 프리셋(9개)을 읽어올 프로필 - "내 진영"은 항상 내 프로필, "상대 진영"은
// arenaGetOppProfile과 같은 우선순위(친구 실시간 세션 > 스냅샷 > 로컬 테스트용 상대 프로필)를 그대로
// 따름. 예전엔 상대 진영 슬롯 프리셋을 항상 로컬 ARENA_OPPONENT_KEY에서만 읽어와서, 친구 설정을
// 불러와도 실제로는 내가 미리 만들어둔 로컬 테스트용 프리셋이 계속 쓰이는 버그가 있었음
function arenaResolveRunePresetsProfile(sideKey) {
  return sideKey === "my" ? loadMyDinoProfile(MY_DINO_PROFILE_KEY) : arenaGetOppProfile();
}

// 지금 "상대 진영" 프리셋이 남(친구)의 것이라 룬 내용을 수정하면 안 되는 상태인지 - 이 값이 true일
// 땐 슬롯에 어떤 프리셋을 배정할지 "선택"만 가능하고(로컬 전용 데이터라 안전), 프리셋 자체의 룬
// 구성/이름을 바꾸는 건 막아야 함(내가 남의 실제 프리셋을 고쳐버리는 것처럼 보이면 안 되니까)
function arenaIsOppRunePresetsForeign() {
  return arenaIsFriendSessionActive() || !!arenaFriendSnapshotProfile;
}

// 친구 설정을 새로 불러올 때(스냅샷 로드 / 실시간 세션 시작) "상대 진영"의 아레나 배치(5슬롯 배정)를
// 그 친구가 실제로 저장해둔 배치로 채움 - arenaFormations는 runePresets와 마찬가지로 계정에 동기화되는
// 필드라(arenaSaveFormationsData의 "my" 분기, supabase_schema.sql의 get_friend_dino_profile
// purpose:'battle' 응답 참고) 친구 프로필 안에 이미 실제 배치가 들어있음. 저장한 적이 없으면
// arenaSanitizeFormationsData가 알아서 빈 기본값으로 처리함. 예전엔 여기서 무조건 빈 기본값으로
// 리셋해버려서(당시 주석은 "슬롯 배정은 서버 동기화 대상이 아니라 알 방법이 없음"이라 했지만 실제로는
// arenaFormations가 이미 동기화되는 필드였음), 친구가 배치를 저장해뒀어도 "상대 진영"엔 아무것도
// 없는 것처럼 보이는 버그가 있었음
function arenaSyncOppFormationsFromFriend(friendProfile) {
  arenaFriendFormations = arenaSanitizeFormationsData(friendProfile && friendProfile.arenaFormations);
}

// "내 진영"/"상대 진영" 패널 헤더 타이틀을 세션/스냅샷 상태에 맞게 실제 닉네임으로 바꿈
// (공룡 대전의 updateFriendLabels와 동일한 규칙 - 세션 중엔 내 쪽도 내 닉네임으로 바뀜)
function arenaUpdateFriendLabels() {
  const session = getActiveSession();
  const active = session && session.status === "active";
  const myLabel = active ? session.myNickname : t("arena.myLabel");
  const oppLabel = active ? session.friendNickname : (arenaFriendSnapshotProfile ? arenaFriendSnapshotNickname : t("arena.oppLabel"));
  const myEl = document.getElementById("arenaMyPanelTitleText");
  const oppEl = document.getElementById("arenaOppPanelTitleText");
  if (myEl) myEl.textContent = myLabel;
  if (oppEl) oppEl.textContent = oppLabel;
  arenaUpdateBattlefieldPowerLabels();
}

// "레벨"(요약 카드에 표시되는 그 값)과 같은 공식 - 룬과 무관한 순수 기본 스탯
function arenaComputeLevel(profile) {
  return profile.baseAtk + Math.floor(profile.baseHp / 10) + profile.moveSpeed;
}

// 친구 초대/설정 불러오기로 실제 상대가 있을 때만, 전투 화면의 5마리 위에 닉네임 + 전투력(레벨을
// 5마리 몫으로 합친 값 - 5마리가 기본 스탯을 공유하므로 레벨×5과 같음)을 표시함. 혼자 테스트할
// 땐("내 진영"/"상대 진영" 그대로) 굳이 안 보여줘서 화면을 깔끔하게 유지함
function arenaUpdateBattlefieldPowerLabels() {
  const myEl = document.getElementById("arenaMyPowerLabel");
  const oppEl = document.getElementById("arenaOppPowerLabel");
  if (!myEl || !oppEl) return;

  const session = getActiveSession();
  const sessionActive = !!(session && session.status === "active");
  const hasFriendContext = sessionActive || !!arenaFriendSnapshotProfile;

  if (!hasFriendContext) {
    myEl.style.display = "none";
    oppEl.style.display = "none";
    return;
  }

  const myNickname = sessionActive ? session.myNickname : t("arena.myLabel");
  const oppNickname = sessionActive ? session.friendNickname : arenaFriendSnapshotNickname;
  const myPower = arenaComputeLevel(loadMyDinoProfile(MY_DINO_PROFILE_KEY)) * 5;
  const oppPower = arenaComputeLevel(arenaGetOppProfile()) * 5;

  myEl.textContent = `${myNickname} ${myPower.toLocaleString()}`;
  oppEl.textContent = `${oppNickname} ${oppPower.toLocaleString()}`;
  myEl.style.display = "block";
  oppEl.style.display = "block";
}

// "상대 진영" 자리를 지금 모드(일반 편집 / 스냅샷 / 실시간 세션)에 맞게 다시 그림
// (공룡 대전의 renderOppPanel과 동일한 패턴)
function renderArenaOppPanel() {
  const container = document.getElementById("arenaOppDinoSection");
  if (!container) return;
  const session = getActiveSession();
  // 모든 분기가 공유하는 헤더 - renderMyDinoPage에 그대로 넘기거나, 탭 컴포넌트를 안 쓰는 임시
  // 카드(초대 중/불러오는 중)에는 dinoPanelHeaderHtml로 직접 붙임
  const header = { title: t("arena.panelHeader.oppFormation"), titleId: "arenaOppPanelTitleText", toolbarId: "arenaOppToolbar", closeId: "arenaOppPanelClose", onClose: arenaCloseSidePanels };
  // "아레나 배치" 탭 - readOnly여도 arenaMountFormationTab이 arenaIsOppRunePresetsForeign()로
  // 스스로 편집 가능 여부를 판단하므로(마운트되는 컨테이너와 무관), 편집 가능/읽기전용 두 분기 모두
  // 완전히 같은 extraTab을 넣으면 됨 - 예전엔 읽기전용 쪽에 탭 시스템 자체가 없어서 별도 카드
  // (arenaAppendStandaloneFormationWidget)를 붙이는 우회책을 썼는데, 이제 필요 없어짐
  const formationExtraTab = { id: "arenaFormation", label: t("arena.formationTabLabel"), render: (panelEl) => arenaMountFormationTab("opp", panelEl) };

  if (session && session.status === "inviting") {
    container.innerHTML = `
      <div class="card friend-session-waiting">
        ${dinoPanelHeaderHtml(header)}
        <div>${t("arena.inviteSentLine", { nickname: session.friendNickname })}</div>
        <button class="friend-toolbar-btn" id="arenaCancelInviteBtn">${t("arena.cancelInviteBtn")}</button>
      </div>
    `;
    wireDinoPanelHeader(container, header);
    document.getElementById("arenaCancelInviteBtn").onclick = () => leaveFriendSession();
  } else if (session && session.status === "active") {
    if (session.friendProfile) {
      renderMyDinoPage(container, {
        idPrefix: "arenaOpp_",
        unsuitableList: ARENA_UNSUITABLE_RUNE_LIST,
        unsuitableLabel: t("arena.unsuitableRuneLabel"),
        splitCritStat: true,
        constellationLevelCapWarning: false, // 아레나는 서버 레벨캡 개념 자체를 안 씀(사용자 확정)
        header,
        extraTab: formationExtraTab,
        readOnly: { profile: session.friendProfile, tagText: t("arena.readonlyLiveTag", { nickname: session.friendNickname }) }
      });
    } else {
      container.innerHTML = `
        <div class="card friend-session-waiting">
          ${dinoPanelHeaderHtml(header)}
          <div>${t("arena.loadingFriendProfile", { nickname: session.friendNickname })}</div>
        </div>
      `;
      wireDinoPanelHeader(container, header);
    }
  } else if (arenaFriendSnapshotProfile) {
    renderMyDinoPage(container, {
      idPrefix: "arenaOpp_",
      unsuitableList: ARENA_UNSUITABLE_RUNE_LIST,
      unsuitableLabel: t("arena.unsuitableRuneLabel"),
      splitCritStat: true,
      constellationLevelCapWarning: false, // 아레나는 서버 레벨캡 개념 자체를 안 씀(사용자 확정)
      header,
      extraTab: formationExtraTab,
      readOnly: {
        profile: arenaFriendSnapshotProfile,
        tagText: t("arena.readonlySnapshotTag", { nickname: arenaFriendSnapshotNickname }),
        allowPresetSwitch: true,
        onPresetSwitch: () => arenaResetDisplay()
      }
    });
  } else {
    renderMyDinoPage(container, {
      idPrefix: "arenaOpp_",
      storageKey: ARENA_OPPONENT_KEY,
      unsuitableList: ARENA_UNSUITABLE_RUNE_LIST,
      unsuitableLabel: t("arena.unsuitableRuneLabel"),
      splitCritStat: true,
      constellationLevelCapWarning: false, // 아레나는 서버 레벨캡 개념 자체를 안 씀(사용자 확정)
      header,
      extraTab: formationExtraTab,
      onChange: () => arenaResetDisplay()
    });
  }

  renderArenaOppToolbar();
}

function renderArenaOppToolbar() {
  const toolbar = document.getElementById("arenaOppToolbar");
  if (!toolbar) return;
  const session = getActiveSession();

  if (session && (session.status === "active" || session.status === "inviting")) {
    // 친구 기능 4단계: 상대의 준비 상태를 항상 보여줌(공룡 대전과 동일한 패턴)
    const readyIndicator = session.status === "active"
      ? `<span class="battle-ready-indicator${session.friendReady ? " is-ready" : ""}" id="arenaFriendReadyIndicator">${session.friendReady ? t("arena.friendReadyLabel") : t("arena.friendWaitingLabel")}</span>`
      : "";
    toolbar.innerHTML = `${readyIndicator}<button class="friend-toolbar-btn friend-leave-btn" id="arenaLeaveSessionBtn">${t("arena.leaveSessionBtn")}</button>`;
    document.getElementById("arenaLeaveSessionBtn").onclick = () => leaveFriendSession();
  } else if (arenaFriendSnapshotProfile) {
    toolbar.innerHTML = `<button class="friend-toolbar-btn" id="arenaClearSnapshotBtn">${t("arena.switchToLocalBtn")}</button>`;
    document.getElementById("arenaClearSnapshotBtn").onclick = () => {
      arenaFriendSnapshotProfile = null;
      arenaFriendSnapshotNickname = null;
      arenaFriendFormations = null; // 다음에 다른 친구를 불러올 때 새로 빈 상태로 시작하도록 정리
      renderArenaOppPanel();
      arenaUpdateFriendLabels();
      arenaResetDisplay();
    };
  } else if (arenaMyUserId) {
    toolbar.innerHTML = `
      <button class="friend-toolbar-btn" id="arenaInviteFriendBtn">${t("arena.inviteFriendBtn")}</button>
      <button class="friend-toolbar-btn" id="arenaLoadFriendBtn">${t("arena.loadSettingsBtn")}</button>
    `;
    document.getElementById("arenaInviteFriendBtn").onclick = () => arenaOpenFriendPicker("invite");
    document.getElementById("arenaLoadFriendBtn").onclick = () => arenaOpenFriendPicker("snapshot");
  } else {
    toolbar.innerHTML = "";
  }
}

async function arenaOpenFriendPicker(mode) {
  const overlay = document.getElementById("arenaFriendPickerOverlay");
  const title = document.getElementById("arenaFriendPickerTitle");
  const list = document.getElementById("arenaFriendPickerList");
  title.textContent = mode === "invite" ? t("arena.friendPicker.inviteTitle") : t("arena.friendPicker.snapshotTitle");
  list.innerHTML = `<div class="friend-picker-empty">${t("arena.friendPicker.loading")}</div>`;
  overlay.style.display = "flex";
  lockBodyScroll();

  const friends = await getAcceptedFriends(arenaMyUserId);
  if (overlay.style.display === "none") return; // 그새 닫혔으면 무시

  if (friends.length === 0) {
    list.innerHTML = `<div class="friend-picker-empty">${t("arena.friendPicker.empty")}</div>`;
    return;
  }
  list.innerHTML = friends
    .map((f) => `<div class="friend-picker-item" data-id="${f.id}" data-nickname="${f.nickname}">${f.nickname}</div>`)
    .join("");
  list.querySelectorAll(".friend-picker-item").forEach((item) => {
    item.onclick = () => {
      overlay.style.display = "none";
      unlockBodyScroll();
      const friendId = item.dataset.id;
      const friendNickname = item.dataset.nickname;
      if (mode === "invite") {
        sendInviteToFriend(arenaMyUserId, arenaMyNickname, friendId, friendNickname);
        renderArenaOppPanel();
        arenaUpdateFriendLabels();
      } else {
        arenaLoadFriendSnapshot(friendId, friendNickname);
      }
    };
  });
}

async function arenaLoadFriendSnapshot(friendId, friendNickname) {
  // purpose:'battle' - 일부 카테고리만 공개된 상태면 전투 계산이 깨지므로, 공개 자체(enabled)가
  // 꺼져 있을 때만 null이 오고 켜져 있으면 항상 전체 프로필이 옴(카테고리별 설정과 무관)
  const { data, error } = await supabaseClient.rpc("get_friend_dino_profile", { p_friend_id: friendId, p_purpose: "battle" });
  if (error || !data) {
    alert(t("arena.loadFailedAlert"));
    return;
  }
  arenaFriendSnapshotProfile = data;
  arenaFriendSnapshotNickname = friendNickname;
  arenaSyncOppFormationsFromFriend(data);
  renderArenaOppPanel();
  arenaUpdateFriendLabels();
  arenaResetDisplay();
}

// friend-session.js의 onFriendSessionChange 구독 콜백. 페이지를 벗어난 뒤(다른 탭 이동)에도
// friend-session.js 쪽 구독 자체는 계속 살아있을 수 있어서, 이 페이지의 DOM이 이미 사라졌으면
// 조용히 무시함. 친구 기능 4단계부터는 공룡 대전과 동일한 준비 완료 핸드셰이크 + 결과 통째 전송
// 방식으로 아레나 전투도 동기화됨(event.battleType으로 "dino_battle"과 구분해서 서로 안 섞임).
function arenaHandleFriendSessionEvent(event) {
  if (!document.getElementById("arenaMainCard")) return;

  if (event.type === "joined" || event.type === "friend-joined") {
    // 세션이 막 시작된 시점엔 이전 친구(스냅샷 등)의 배치가 남아있지 않도록 일단 비워둠 - 이 친구의
    // 진짜 배치는 아직 도착 전이라(profile 메시지는 join 메시지 바로 다음에, 같은 채널로 순서 보장되어
    // 오므로 항상 이 이벤트 다음에 friend-profile 이벤트로 옴) 여기서 곧바로 채울 수는 없음
    arenaFriendFormations = null;
    renderArenaOppPanel();
    arenaUpdateFriendLabels();
    // 지금 내가 보고 있는 탭을 전파 - 늦게 들어온 쪽이 곧바로 내 배지를 보게 함
    sendTabChange("arena", currentArenaMode);
    arenaResetDisplay();
  } else if (event.type === "friend-tab-change") {
    arenaUpdatePresenceBadges();
  } else if (event.type === "friend-profile") {
    // 이 세션에서 친구의 실제 배치를 아직 못 받아왔으면(막 시작된 시점) 지금 도착한 프로필로 채움 -
    // 이후 세션 도중 친구가 자기 설정을 바꿔서 오는 추가 갱신마다 매번 덮어쓰면 내가 방금 로컬로
    // 조정해둔 슬롯 배정이 계속 날아가 버리므로, 딱 한 번만 채움
    if (!arenaFriendFormations) {
      const session = getActiveSession();
      arenaSyncOppFormationsFromFriend(session && session.friendProfile);
    }
    renderArenaOppPanel();
    arenaUpdateFriendLabels();
    arenaResetDisplay();
  } else if (event.type === "friend-left" || event.type === "left" || event.type === "declined") {
    arenaFriendFormations = null; // 세션 종료 - 다음 세션은 새로 빈 상태로 시작
    renderArenaOppPanel();
    arenaUpdateFriendLabels();
    arenaResetDisplay();
  } else if (event.type === "friend-ready") {
    renderArenaOppToolbar();
    arenaMaybeStartServerlessBattle();
  } else if (event.type === "friend-ready-cancelled") {
    renderArenaOppToolbar();
    arenaUpdateReadyButtonUI();
  } else if (event.type === "battle-result") {
    if (event.battleType === "arena") arenaHandleReceivedBattleResult(event.result);
  }
}

// ===== 배치 표시 순서 =====
// "아레나 배치" 탭의 소환 배치 미리보기도 이 순서를 그대로 재사용함(전투 화면과 설정 화면이 서로
// 다른 배치를 보여주면 첫눈에 못 알아본다는 피드백 반영 - 단일 소스로 통일)

// 전투 화면(battlefield)의 세로 배치 순서 - 전열 열은 항상 VS 배지와 가까운 쪽에 오도록 진영별로
// 좌우가 뒤집힘(사용자 지정: "내 진영 5 2 / 4 1 / 3", "상대 진영 1 3 / 2 4 / _ 5")
const ARENA_MY_FRONT_ORDER = [1, 0];    // 슬롯2, 슬롯1 (위->아래)
const ARENA_MY_BACK_ORDER = [4, 3, 2];  // 슬롯5, 슬롯4, 슬롯3 (위->아래)
const ARENA_OPP_FRONT_ORDER = [0, 1];   // 슬롯1, 슬롯2 (위->아래)
const ARENA_OPP_BACK_ORDER = [2, 3, 4]; // 슬롯3, 슬롯4, 슬롯5 (위->아래)

function arenaAvatarHtml(sideKey, slotIndex, rowClass) {
  return `
    <div class="arena-slot ${rowClass}" id="arenaSlot_${sideKey}_${slotIndex}">
      <div class="arena-slot-hpbar"><div class="arena-slot-hpfill ${sideKey}-hp-fill" id="arenaHpFill_${sideKey}_${slotIndex}"></div></div>
      <div class="arena-slot-avatar ${sideKey}-slot-avatar" id="arenaAvatar_${sideKey}_${slotIndex}"></div>
    </div>
  `;
}

function arenaColumnHtml(sideKey, slotIndices, colClass) {
  const rowClass = colClass === "arena-col-front" ? "arena-slot-front" : "arena-slot-back";
  return `<div class="arena-col ${colClass}">${slotIndices.map((i) => arenaAvatarHtml(sideKey, i, rowClass)).join("")}</div>`;
}

function arenaBattlefieldMarkup() {
  const myBackCol = arenaColumnHtml("my", ARENA_MY_BACK_ORDER, "arena-col-back");
  const myFrontCol = arenaColumnHtml("my", ARENA_MY_FRONT_ORDER, "arena-col-front");
  const oppFrontCol = arenaColumnHtml("opp", ARENA_OPP_FRONT_ORDER, "arena-col-front");
  const oppBackCol = arenaColumnHtml("opp", ARENA_OPP_BACK_ORDER, "arena-col-back");
  return `
    <div class="arena-team-wrap">
      <div class="arena-power-label" id="arenaMyPowerLabel" style="display:none;"></div>
      <div class="arena-team my-team">${myBackCol}${myFrontCol}</div>
    </div>
    <div class="battle-vs"><span>VS</span></div>
    <div class="arena-team-wrap">
      <div class="arena-power-label" id="arenaOppPowerLabel" style="display:none;"></div>
      <div class="arena-team opp-team">${oppFrontCol}${oppBackCol}</div>
    </div>
  `;
}

function renderArenaPage(container) {
  container.innerHTML = `
    <h2 class="sr-only">${t("arena.heading")}</h2>
    <div class="battle-layout" id="arenaLayout">
      <div class="battle-side-panel my-side" id="arenaMySidePanel">
        <div id="arenaMyDinoSection"></div>
      </div>

      <div class="battle-arena-wrap">
        <button class="battle-peek-btn my-peek" id="arenaMyPeekBtn" title="${t("arena.myPeekTooltip")}">▶</button>

        <div class="card battle-main-card" id="arenaMainCard">
          <div class="battle-mode-tabs mode-live" id="arenaModeTabs">
            <span class="battle-mode-indicator"></span>
            <div class="battle-tab-presence my-presence" id="arenaMyPresenceBadge"></div>
            <div class="battle-tab-presence friend-presence" id="arenaFriendPresenceBadge"></div>
            <button class="battle-mode-tab" data-mode="quick" id="arenaModeTabQuick"><span>${t("arena.tab.quick")}</span></button>
            <button class="battle-mode-tab active" data-mode="live" id="arenaModeTabLive"><span>${t("arena.tab.live")}</span></button>
          </div>

          <div class="battle-mode-panel" id="arenaQuickModeCard" style="display:none;">
            <p class="quickcalc-desc">${t("arena.quick.desc", { trials: ARENA_QUICK_CALC_TRIALS.toLocaleString() })}</p>
            <button class="btn-simulate" id="arenaQuickCalcBtn">${t("arena.quick.calcBtn", { trials: ARENA_QUICK_CALC_TRIALS.toLocaleString() })}</button>
            <div class="report-grid" id="arenaQcResult" style="display:none;">
              <div class="report-tile"><div class="metric-label">${t("arena.quick.winCountLabel", { trials: ARENA_QUICK_CALC_TRIALS.toLocaleString() })}</div><div class="metric-value accent" id="arenaQcWinCount">-</div><div class="metric-sub" id="arenaQcWinNorm"></div></div>
              <div class="report-tile"><div class="metric-label">${t("arena.quick.frontFirstLabel")}</div><div class="metric-value" id="arenaQcFrontSide">-</div><div class="metric-sub" id="arenaQcFrontPct"></div></div>
            </div>
          </div>

          <div class="battle-mode-panel" id="arenaLiveModeCard">
            <div class="arena-battlefield" id="arenaBattlefield">
              ${arenaBattlefieldMarkup()}
            </div>

            <div class="battle-result" id="arenaBattleResult" style="display:none;"></div>
            <div class="battle-controls">
              <div class="custom-dropdown battle-speed-dropdown" id="arenaSpeedDropdown">
                <div class="selected-value" id="arenaSpeedSelectedValue">${t("arena.speedNormal")}</div>
                <ul class="dropdown-list" id="arenaSpeedList"></ul>
              </div>
              <button class="btn-simulate" id="arenaStartBtn">${t("arena.startBtn")}</button>
              <button class="battle-restart-btn" id="arenaRestartBtn" disabled title="${t("arena.restartTooltip")}">↻</button>
            </div>
          </div>
        </div>

        <button class="battle-peek-btn opp-peek" id="arenaOppPeekBtn" title="${t("arena.oppPeekTooltip")}">◀</button>
      </div>

      <div class="battle-side-panel opp-side" id="arenaOppSidePanel">
        <div id="arenaOppDinoSection"></div>
      </div>
    </div>
    <div class="battle-panel-overlay" id="arenaPanelOverlay"></div>

    <div class="friend-picker-overlay" id="arenaFriendPickerOverlay" style="display:none;">
      <div class="friend-picker-modal">
        <div class="friend-picker-header">
          <span id="arenaFriendPickerTitle">${t("arena.friendPicker.defaultTitle")}</span>
          <button class="close-btn" id="arenaFriendPickerClose">✕</button>
        </div>
        <div id="arenaFriendPickerList"></div>
      </div>
    </div>

    <div class="friend-picker-overlay" id="arenaSlotEditOverlay" style="display:none;">
      <div class="friend-picker-modal arena-slot-edit-modal">
        <div class="friend-picker-header">
          <span>
            <span id="arenaSlotEditTitle">${t("arena.slotEdit.defaultTitle")}</span>
            <span class="arena-slot-edit-hint" id="arenaSlotEditHint">${t("arena.slotEdit.confirmHint")}</span>
          </span>
          <button class="close-btn" id="arenaSlotEditClose">✕</button>
        </div>
        <div class="slot-wrapper" id="arenaSlotEdit_slotContainer"></div>
        <div class="arena-preset-row" id="arenaSlotEditPresetRow"></div>
        <div id="arenaSlotEdit_runePicker">
          <div class="rune-scroll-container">
            <div class="rune-grid" id="arenaSlotEdit_mainGrid"></div>
            <div class="divider" id="arenaSlotEdit_unsuitableDivider" style="text-align:center; color:#e74c3c; font-size:11px; padding:15px 0;"></div>
            <div class="rune-grid" id="arenaSlotEdit_unsuitableGrid"></div>
          </div>
          <div id="arenaSlotEdit_runeDetail" style="border-top:1px solid var(--border-color); margin-top:15px; padding-top:15px;">
            <div id="arenaSlotEdit_detailGrade" style="font-size:11px; font-weight:bold;"></div>
            <h3 id="arenaSlotEdit_detailName" style="margin:5px 0; font-size:1.1rem;"></h3>
            <div id="arenaSlotEdit_runeWarning" style="color:#ff4444; font-size:12px; font-weight:bold; margin-bottom:8px; display:none; background:rgba(255,68,68,0.1); padding:5px; border-radius:4px;"></div>
            <div id="arenaSlotEdit_levelArea">
              <div class="custom-dropdown" id="arenaSlotEdit_levelDropdown">
                <div class="selected-value" id="arenaSlotEdit_levelSelectedValue">Lv.1</div>
                <ul class="dropdown-list" id="arenaSlotEdit_levelList"></ul>
              </div>
              <div class="desc-box" id="arenaSlotEdit_detailDesc"></div>
            </div>
            <div class="btn-apply-row">
              <button class="btn-apply" id="arenaSlotEdit_applyBtn">${t("arena.rune.applyBtn")}</button>
              <button class="btn-apply" id="arenaSlotEdit_removeBtn" style="border-color:var(--border-color); color:var(--text-sub);">${t("arena.rune.removeBtn")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initArenaPage();
}

// 모바일 PIP 슬라이드 패널 열기/닫기. dino-battle-page.js에도 같은 이름의 개념이 있지만, 모든
// 페이지 스크립트가 하나의 전역 스코프를 공유해서 이름이 겹치면 나중에 로드된 쪽 정의가 앞의 것을
// 덮어써버림 - arena 전용 접두사로 구분함. renderArenaOppPanel()(모듈 최상위 함수)이 헤더의 닫기
// 버튼에 onClose로 넘겨야 해서 initArenaPage 안 중첩 함수가 아니라 최상위로 둠.
function arenaCloseSidePanels() {
  document.getElementById("arenaMySidePanel").classList.remove("open");
  document.getElementById("arenaOppSidePanel").classList.remove("open");
  document.getElementById("arenaPanelOverlay").classList.remove("open");
}
function arenaOpenSidePanel(panel) {
  arenaCloseSidePanels();
  panel.classList.add("open");
  document.getElementById("arenaPanelOverlay").classList.add("open");
}

function initArenaPage() {
  renderMyDinoPage(document.getElementById("arenaMyDinoSection"), {
    idPrefix: "arenaMy_",
    storageKey: MY_DINO_PROFILE_KEY,
    unsuitableList: ARENA_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: t("arena.unsuitableRuneLabel"),
    splitCritStat: true,
    constellationLevelCapWarning: false, // 아레나는 서버 레벨캡 개념 자체를 안 씀(사용자 확정)
    header: { title: t("arena.panelHeader.myFormation"), titleId: "arenaMyPanelTitleText", closeId: "arenaMyPanelClose", onClose: arenaCloseSidePanels },
    extraTab: { id: "arenaFormation", label: t("arena.formationTabLabel"), render: (panelEl) => arenaMountFormationTab("my", panelEl) },
    onChange: (profile) => {
      arenaResetDisplay();
      arenaUpdateBattlefieldPowerLabels(); // 기본 스탯을 바꾸면 내 전투력 숫자도 즉시 갱신
      if (arenaIsFriendSessionActive()) sendMyProfileUpdate(profile);
    }
  });
  renderArenaOppPanel();
  arenaUpdateFriendLabels(); // 다른 페이지에서 이미 친구 세션이 활성화된 채로 넘어온 경우 대비

  arenaInitSpeedDropdown();
  arenaMountSlotEditModal();

  document.getElementById("arenaFriendPickerClose").onclick = () => {
    document.getElementById("arenaFriendPickerOverlay").style.display = "none";
    unlockBodyScroll();
  };
  document.getElementById("arenaSlotEditClose").onclick = () => {
    document.getElementById("arenaSlotEditOverlay").style.display = "none";
    unlockBodyScroll();
  };

  // 로그인 상태면 친구 초대/불러오기 버튼을 쓸 수 있게 내 uid/닉네임을 채움
  getCurrentUser().then((user) => {
    if (user && user.username) {
      arenaMyUserId = user.id;
      arenaMyNickname = user.username;
      renderArenaOppToolbar();
    }
  });

  // 페이지를 다시 그릴 때마다(다른 탭 갔다 옴) 예전 구독을 정리하고 새로 구독. 세션 자체는
  // friend-session.js 쪽 모듈 스코프에 남아있어서 페이지를 오가도 끊기지 않음
  if (arenaUnsubscribeFriendSession) arenaUnsubscribeFriendSession();
  arenaUnsubscribeFriendSession = onFriendSessionChange(arenaHandleFriendSessionEvent);

  const mySidePanel = document.getElementById("arenaMySidePanel");
  const oppSidePanel = document.getElementById("arenaOppSidePanel");
  const overlay = document.getElementById("arenaPanelOverlay");

  document.getElementById("arenaMyPeekBtn").onclick = () => arenaOpenSidePanel(mySidePanel);
  document.getElementById("arenaOppPeekBtn").onclick = () => arenaOpenSidePanel(oppSidePanel);
  // 닫기 버튼은 이제 renderMyDinoPage/renderArenaOppPanel이 매번 새로 그리는 헤더 안에 있어서, 그
  // 렌더 함수들이 각자 wireDinoPanelHeader()로 매 렌더마다 다시 바인딩함(여기서 한 번만 붙이면
  // 재렌더 후 끊어짐) - 오버레이 클릭만 여기서 한 번 붙이면 됨(오버레이 자체는 재생성 안 되므로)
  overlay.onclick = arenaCloseSidePanels;

  document.getElementById("arenaStartBtn").onclick = arenaOnBattleButtonClick;
  document.getElementById("arenaRestartBtn").onclick = () => {
    if (arenaBattlePhase !== "idle") arenaResetDisplay();
  };
  document.getElementById("arenaQuickCalcBtn").onclick = arenaStartQuickCalc;
  arenaInitModeTabs();

  arenaUpdateFriendLabels();
  arenaResetDisplay();
}

// 친구 기능 4단계: 화면 강제 전환 대신, 지금 보고 있는 탭 버튼에 닉네임 첫 글자 배지 표시
// (dino-battle-page.js의 updatePresenceBadges와 동일한 원리, 아레나는 quick/live 2탭뿐)
let currentArenaMode = "live"; // arenaModeTabs 템플릿의 기본 active 탭과 일치

function arenaUpdatePresenceBadges() {
  const myBadge = document.getElementById("arenaMyPresenceBadge");
  const friendBadge = document.getElementById("arenaFriendPresenceBadge");
  if (!myBadge || !friendBadge) return;
  const session = getActiveSession();
  if (!session || session.status !== "active") {
    myBadge.style.display = "none";
    friendBadge.style.display = "none";
    return;
  }

  const myBtn = document.getElementById(currentArenaMode === "live" ? "arenaModeTabLive" : "arenaModeTabQuick");
  if (myBtn && myBadge.parentElement !== myBtn) myBtn.insertBefore(myBadge, myBtn.firstChild);
  myBadge.textContent = Array.from(session.myNickname || "?")[0];
  myBadge.style.display = "inline-flex";

  if (session.friendPage === "arena" && session.friendMode) {
    const friendBtn = document.getElementById(session.friendMode === "live" ? "arenaModeTabLive" : "arenaModeTabQuick");
    if (friendBtn && friendBadge.parentElement !== friendBtn) friendBtn.appendChild(friendBadge);
    friendBadge.textContent = Array.from(session.friendNickname || "?")[0];
    friendBadge.style.display = "inline-flex";
    return;
  }
  friendBadge.style.display = "none";
}

function arenaInitModeTabs() {
  const tabsEl = document.getElementById("arenaModeTabs");
  const quickTab = document.getElementById("arenaModeTabQuick");
  const liveTab = document.getElementById("arenaModeTabLive");
  const quickCard = document.getElementById("arenaQuickModeCard");
  const liveCard = document.getElementById("arenaLiveModeCard");

  quickTab.onclick = () => {
    quickTab.classList.add("active");
    liveTab.classList.remove("active");
    quickCard.style.display = "block";
    liveCard.style.display = "none";
    tabsEl.classList.remove("mode-live");
    tabsEl.classList.add("mode-quick");
    currentArenaMode = "quick";
    arenaUpdatePresenceBadges();
    if (arenaIsFriendSessionActive()) sendTabChange("arena", "quick");
  };
  liveTab.onclick = () => {
    liveTab.classList.add("active");
    quickTab.classList.remove("active");
    liveCard.style.display = "block";
    quickCard.style.display = "none";
    tabsEl.classList.remove("mode-quick");
    tabsEl.classList.add("mode-live");
    currentArenaMode = "live";
    arenaUpdatePresenceBadges();
    if (arenaIsFriendSessionActive()) sendTabChange("arena", "live");
  };
}

// 공룡 대전 quick-calc의 "적게 죽은(강한) 쪽을 1로 고정" 관례를 승률에도 그대로 적용 - 여기선
// "적게 이긴(약한) 쪽"이 1이 되고, 어느 쪽이 1인지는 별도 라벨로 명시해서 헷갈리지 않게 함
function arenaFormatWinRatio(myWins, oppWins) {
  const weaker = myWins <= oppWins ? { label: t("arena.myLabel"), count: myWins } : { label: t("arena.oppLabel"), count: oppWins };
  const stronger = myWins <= oppWins ? { label: t("arena.oppLabel"), count: oppWins } : { label: t("arena.myLabel"), count: myWins };
  if (weaker.count === 0) return t("arena.quick.dominantWin", { label: stronger.label });
  const ratio = Math.round((stronger.count / weaker.count) * 100) / 100;
  return t("arena.quick.winRatio", { weakerLabel: weaker.label, strongerLabel: stronger.label, ratio });
}

function arenaStartQuickCalc() {
  const btn = document.getElementById("arenaQuickCalcBtn");
  btn.disabled = true;
  btn.innerText = t("arena.quick.calcBtnBusy");

  // 동기 계산이 몇 초 걸릴 수 있어서(전투 하나하나를 처음부터 새로 여는 구조) setTimeout으로 한 틱
  // 양보해서 "계산 중..." 텍스트가 먼저 그려지게 함(공룡 대전 빠른 계산과 동일한 패턴)
  setTimeout(() => {
    const myProfile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
    const oppProfile = arenaGetOppProfile();
    const result = runArenaQuickCalc({
      myProfile, oppProfile,
      mySlotRunes: arenaGetActiveSlotRunes("my"),
      oppSlotRunes: arenaGetActiveSlotRunes("opp"),
      tileSettings: ARENA_TILE_CFG,
      trials: ARENA_QUICK_CALC_TRIALS
    });

    document.getElementById("arenaQcWinCount").innerText = t("arena.quick.winCountValue", { myWins: result.myWins, oppWins: result.oppWins });
    document.getElementById("arenaQcWinNorm").innerText = arenaFormatWinRatio(result.myWins, result.oppWins);

    const frontTotal = result.myFrontFirst + result.oppFrontFirst;
    if (frontTotal === 0) {
      document.getElementById("arenaQcFrontSide").innerText = t("arena.quick.frontUndetermined");
      document.getElementById("arenaQcFrontPct").innerText = "";
    } else {
      const oppMoreOften = result.oppFrontFirst >= result.myFrontFirst;
      const winnerLabel = oppMoreOften ? t("arena.oppLabel") : t("arena.myLabel");
      const winnerCount = oppMoreOften ? result.oppFrontFirst : result.myFrontFirst;
      document.getElementById("arenaQcFrontSide").innerText = winnerLabel;
      document.getElementById("arenaQcFrontPct").innerText = t("arena.quick.frontResultValue", {
        count: winnerCount.toLocaleString(), total: frontTotal.toLocaleString(), percent: ((winnerCount / frontTotal) * 100).toFixed(1)
      });
    }

    document.getElementById("arenaQcResult").style.display = "grid";
    btn.disabled = false;
    btn.innerText = t("arena.quick.calcBtn", { trials: ARENA_QUICK_CALC_TRIALS.toLocaleString() });
  }, 10);
}

function arenaGetBattleSpeedMs() {
  const saved = parseInt(localStorage.getItem(ARENA_SPEED_KEY), 10);
  return BATTLE_SPEED_OPTIONS.some((o) => o.ms === saved) ? saved : 350;
}

function arenaInitSpeedDropdown() {
  const currentMs = arenaGetBattleSpeedMs();
  const list = document.getElementById("arenaSpeedList");
  const selectedValue = document.getElementById("arenaSpeedSelectedValue");
  selectedValue.textContent = sharedOptionLabel(BATTLE_SPEED_OPTIONS.find((o) => o.ms === currentMs).label);

  BATTLE_SPEED_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      localStorage.setItem(ARENA_SPEED_KEY, String(opt.ms));
      selectedValue.textContent = sharedOptionLabel(opt.label);
      list.style.display = "none";
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
}

// ===== "아레나 배치" 탭: 사각형 5개(전투 화면과 동일한 좌우 배치 - 전열2/후열3) + 그 아래 아레나
// 프리셋(5슬롯 전체 배정을 통째로 저장) 목록. 사각형 하나를 누르면 그 슬롯에 배정할 슬롯 프리셋을
// 고르는 팝업(arenaOpenSlotEditor)이 뜸 =====

// 전투 화면과 똑같은 좌우 배치를 쓰기 위해 그쪽에서 이미 정의한 ARENA_MY_FRONT_ORDER 등을 그대로
// 재사용함(내 진영: 후열 왼쪽 3개·전열 오른쪽 2개, 상대 진영: 반대) - DOM에 [왼쪽 칼럼 슬롯들,
// 오른쪽 칼럼 슬롯들] 순서로 넣기만 하면 CSS grid-auto-flow:column이 자동으로 왼쪽 3칸/오른쪽
// 2칸(같은 행 높이)으로 배치해줌
function arenaFormationColumns(sideKey) {
  return sideKey === "my" ? [ARENA_MY_BACK_ORDER, ARENA_MY_FRONT_ORDER] : [ARENA_OPP_FRONT_ORDER, ARENA_OPP_BACK_ORDER];
}

// colIdx(0=왼쪽,1=오른쪽)/posInCol(그 칼럼 안에서 몇 번째)/colCount(그 칼럼에 몇 개가 들어가는지 -
// 3 또는 2)를 CSS 클래스로 넘겨서, "같은 전체 높이 안에서 3칸 칼럼은 원 3개로 잘게, 2칸 칼럼은
// 원 2개로 크게" 나누는 grid-row 배치를 CSS 쪽에서 결정하게 함(내 진영은 왼쪽이 3개/오른쪽이
// 2개, 상대 진영은 반대라 칼럼별 개수가 고정이 아니라 이렇게 클래스로 넘겨야 양쪽 다 대응됨).
// presetName이 있으면(배정된 슬롯) 번호 대신 그 프리셋 이름을 원 안에 보여줌 - 몇 번 슬롯인지보다
// "무슨 조합을 넣어뒀는지"가 한눈에 더 중요함
function arenaFmtSquareHtml(sideKey, slotIndex, formation, colIdx, posInCol, colCount, presetName) {
  const assigned = formation.slotPresetIndices[slotIndex] !== null;
  const sideClass = sideKey === "my" ? "my-fmt-square" : "opp-fmt-square";
  const layoutClass = `col-${colIdx} pos-${posInCol} of-${colCount}`;
  const label = assigned && presetName ? presetName : String(slotIndex + 1);
  return `<button type="button" class="arena-fmt-square ${sideClass} ${layoutClass}${assigned ? " assigned" : ""}" data-slot="${slotIndex}">
    <span class="arena-fmt-square-num">${label}</span>
  </button>`;
}

function arenaMountFormationTab(sideKey, containerEl) {
  const idPrefix = `arenaFmt${sideKey === "my" ? "My" : "Opp"}_`;
  const id = (name) => idPrefix + name;
  const columns = arenaFormationColumns(sideKey);

  containerEl.innerHTML = `
    <div class="arena-fmt-grid" id="${id("grid")}"></div>
    <div class="arena-preset-row" id="${id("formationRow")}"></div>
  `;

  function renderGrid() {
    const data = arenaLoadFormationsData(sideKey);
    const formation = data.formations[data.activeFormationIndex];
    const runePresets = arenaResolveRunePresetsProfile(sideKey).runePresets;
    const grid = document.getElementById(id("grid"));
    if (!grid) return;
    const squaresHtml = columns
      .map((colSlots, colIdx) => colSlots.map((slotIndex, posInCol) => {
        const presetIdx = formation.slotPresetIndices[slotIndex];
        const presetName = presetIdx !== null && runePresets[presetIdx] ? runePresetDisplayName(runePresets[presetIdx], presetIdx) : null;
        return arenaFmtSquareHtml(sideKey, slotIndex, formation, colIdx, posInCol, colSlots.length, presetName);
      }).join(""))
      .join("");
    grid.innerHTML = squaresHtml;
    grid.querySelectorAll(".arena-fmt-square").forEach((btn) => {
      btn.onclick = () => arenaOpenSlotEditor(sideKey, Number(btn.dataset.slot));
    });
  }

  function renderFormationRow() {
    const data = arenaLoadFormationsData(sideKey);
    const row = document.getElementById(id("formationRow"));
    if (!row) return;
    // 친구의 진영(실시간 세션/스냅샷)을 보는 중이면 이 배치 프리셋도 남의 데이터라 이름을 못 바꾸게
    // 함(사용자 확정) - 슬롯 프리셋 편집 팝업(arenaRenderSlotEditPresetRow)에는 이미 있던 동일한
    // foreign 체크가 여기(배치 프리셋 이름) 쪽엔 빠져있던 걸 발견해서 맞춤
    const foreign = sideKey === "opp" && arenaIsOppRunePresetsForeign();
    row.innerHTML = "";
    data.formations.forEach((formation, idx) => {
      const isActive = idx === data.activeFormationIndex;
      const btn = document.createElement("div");
      btn.className = "arena-preset-btn" + (isActive ? " active" : "");
      btn.innerHTML = `
        <span class="arena-preset-btn-name" data-idx="${idx}">${arenaFormationDisplayName(formation, idx)}</span>
        ${isActive && !foreign ? `<button type="button" class="arena-preset-edit-btn" title="${t("arena.presetEditTooltip")}">✏️</button>` : ""}
      `;
      btn.onclick = (e) => {
        if (e.target.closest(".arena-preset-edit-btn")) return;
        if (idx === data.activeFormationIndex) return;
        data.activeFormationIndex = idx;
        arenaSaveFormationsData(sideKey, data);
        renderFormationRow();
        renderGrid();
        arenaResetDisplay();
      };
      const editBtn = btn.querySelector(".arena-preset-edit-btn");
      if (editBtn) editBtn.onclick = (e) => {
        e.stopPropagation();
        arenaStartRenamePreset(btn, arenaFormationDisplayName(formation, idx), (newName) => {
          data.formations[idx].name = newName;
          arenaSaveFormationsData(sideKey, data);
          renderFormationRow();
        });
      };
      row.appendChild(btn);
    });
  }

  renderGrid();
  renderFormationRow();
  enableDragScroll(document.getElementById(id("formationRow")));

  arenaFormationTabRefreshers[sideKey] = () => { renderGrid(); renderFormationRow(); };
}

// 프리셋 버튼의 이름을 인라인으로 수정(아레나 프리셋/슬롯 프리셋 공용) - 클릭한 버튼 안의 이름
// 텍스트를 input으로 바꿔서 즉시 수정, blur/Enter로 확정
function arenaStartRenamePreset(btnEl, currentName, onCommit) {
  const nameEl = btnEl.querySelector(".arena-preset-btn-name");
  if (!nameEl) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "arena-preset-name-input";
  input.value = currentName;
  input.maxLength = 8;
  nameEl.replaceWith(input);
  input.focus();
  input.select();
  // 비워서 확정하면 null로 되돌려서(currentName 문자열을 그대로 재저장하는 게 아니라) 다시
  // "자동, 언어 따라감" 상태로 리셋됨 - 지금 언어로 보인 기본 문구를 그대로 구워 넣지 않기 위함
  const commit = () => onCommit(input.value.trim() || null);
  input.onblur = commit;
  input.onkeydown = (e) => { if (e.key === "Enter") input.blur(); };
}

// ===== 슬롯 편집 팝업(사각형 하나를 눌렀을 때) - 룬 슬롯 5개 + 그 아래 그 진영의 룬 프리셋 9개
// (내 공룡/상대 공룡 설정 페이지의 "룬 조합" 탭과 완전히 같은 데이터). 페이지에 하나만 마운트해두고,
// 어느 사각형을 열든 그 슬롯이 가리키는 진영/슬롯 인덱스만 다시 포인팅함 =====

function arenaMountSlotEditModal() {
  arenaSlotEditRuneUI = createRuneUI({
    idPrefix: "arenaSlotEdit_",
    unsuitableList: ARENA_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: t("arena.unsuitableRuneLabel"),
    onChange: (runes) => {
      // 상대 진영이 친구 실시간 세션/스냅샷 중이면 남의 프리셋이라 룬 구성을 고치면 안 됨(선택만
      // 가능) - 조용히 무시. arenaOpenSlotEditor에서 애초에 안 열리게 막아도 되지만, 혹시 열려
      //있던 중에 세션이 새로 시작되는 경우까지 대비해 저장 시점에도 한 번 더 막음
      if (arenaSlotEditSide === "opp" && arenaIsOppRunePresetsForeign()) return;
      const storageKey = arenaProfileStorageKey(arenaSlotEditSide);
      const profile = loadMyDinoProfile(storageKey);
      profile.runePresets[arenaSlotEditPresetIndex].runes = runes.map((r) => (r ? { ...r } : null));
      saveMyDinoProfile(profile, storageKey);
      arenaRenderSlotEditPresetRow();
      if (arenaFormationTabRefreshers[arenaSlotEditSide]) arenaFormationTabRefreshers[arenaSlotEditSide]();
      if (arenaSlotEditSide === "my" && arenaIsFriendSessionActive()) sendMyProfileUpdate(profile);
      arenaResetDisplay();
    }
  });
  arenaSlotEditRuneUI.mount();
  enableDragScroll(document.getElementById("arenaSlotEditPresetRow"));
}

function arenaOpenSlotEditor(sideKey, slotIndex) {
  arenaSlotEditSide = sideKey;
  arenaSlotEditSlotIndex = slotIndex;

  const formationsData = arenaLoadFormationsData(sideKey);
  const formation = formationsData.formations[formationsData.activeFormationIndex];
  const assignedIdx = formation.slotPresetIndices[slotIndex];
  arenaSlotEditPresetIndex = assignedIdx !== null ? assignedIdx : 0;

  document.getElementById("arenaSlotEditTitle").textContent = t("arena.slotEdit.numberedTitle", { index: slotIndex + 1 });
  // 친구의 진영(실시간 세션/스냅샷)을 보는 중이면 "더블클릭하여 확정"이라는 편집 문구 자체가
  // 오해를 줌(사용자 지적 - 남의 프리셋을 내가 바꿀 수 있는 것처럼 보임) - 남의 데이터를 보는
  // 중임을 명확히 하고 실제로도 배정 자체가 안 되게 막음(아래 arenaRenderSlotEditPresetRow)
  const foreign = sideKey === "opp" && arenaIsOppRunePresetsForeign();
  document.getElementById("arenaSlotEditHint").textContent = foreign ? t("arena.slotEdit.readonlyHint") : t("arena.slotEdit.confirmHint");
  arenaLoadSlotEditPresetIntoRuneUI();
  arenaRenderSlotEditPresetRow();
  document.getElementById("arenaSlotEditOverlay").style.display = "flex";
  lockBodyScroll();
}

function arenaLoadSlotEditPresetIntoRuneUI() {
  const runePresets = arenaResolveRunePresetsProfile(arenaSlotEditSide).runePresets;
  arenaSlotEditRuneUI.setSelectedRunes(runePresets[arenaSlotEditPresetIndex].runes);
  arenaSlotEditRuneUI.renderSlots();
}

function arenaRenderSlotEditPresetRow() {
  const row = document.getElementById("arenaSlotEditPresetRow");
  const profile = arenaResolveRunePresetsProfile(arenaSlotEditSide);
  const storageKey = arenaProfileStorageKey(arenaSlotEditSide);
  const foreign = arenaSlotEditSide === "opp" && arenaIsOppRunePresetsForeign();
  row.innerHTML = "";
  profile.runePresets.forEach((preset, idx) => {
    const isActive = idx === arenaSlotEditPresetIndex;
    const btn = document.createElement("div");
    btn.className = "arena-preset-btn" + (isActive ? " active" : "");
    btn.innerHTML = `
      <span class="arena-preset-btn-name" data-idx="${idx}">${runePresetDisplayName(preset, idx)}</span>
      ${isActive && !foreign ? `<button type="button" class="arena-preset-edit-btn" title="${t("arena.presetEditTooltip")}">✏️</button>` : ""}
    `;
    // 한 번 클릭 = 미리보기만(룬 슬롯 갱신 + 선택 표시), 두 번 클릭(더블클릭) = 이 슬롯에 실제로
    // 배정 + 창 닫기. 예전엔 클릭 한 번에 바로 장착돼버려서 어떤 룬 구성인지 확인할 새도 없이
    // 적용되는 문제가 있었음 - 미리보기 단계를 하나 끼워넣어서 실수로 잘못 장착하는 일을 줄임
    btn.onclick = (e) => {
      if (e.target.closest(".arena-preset-edit-btn")) return;
      arenaPreviewSlotEditPreset(idx); // 미리보기(어떤 룬 구성인지 보기)는 남의 것이어도 그냥 조회라 허용
    };
    // 친구의 진영을 보는 중이면 더블클릭해도 실제 배정이 안 됨 - 내가 남의 프리셋 구성을 바꿀
    // 수 없어야 한다는 요구사항(사용자 확정) - 위 힌트 문구도 이 상태에 맞춰 "읽기 전용"으로 바뀜
    btn.ondblclick = foreign ? null : (e) => {
      if (e.target.closest(".arena-preset-edit-btn")) return;
      arenaConfirmSlotEditPreset(idx);
    };
    const editBtn = btn.querySelector(".arena-preset-edit-btn");
    if (editBtn) editBtn.onclick = (e) => {
      e.stopPropagation();
      arenaStartRenamePreset(btn, runePresetDisplayName(preset, idx), (newName) => {
        const p = loadMyDinoProfile(storageKey);
        p.runePresets[idx].name = newName;
        saveMyDinoProfile(p, storageKey);
        arenaRenderSlotEditPresetRow();
        if (arenaFormationTabRefreshers[arenaSlotEditSide]) arenaFormationTabRefreshers[arenaSlotEditSide]();
      });
    };
    row.appendChild(btn);
  });
}

// 한 번 클릭: 이 프리셋의 룬 구성을 룬 슬롯에 띄워서 미리 볼 수만 있게 함(아직 이 슬롯에 배정된 건
// 아님 - 배정은 arenaConfirmSlotEditPreset에서만 일어남)
function arenaPreviewSlotEditPreset(idx) {
  if (idx === arenaSlotEditPresetIndex) return;
  arenaSlotEditPresetIndex = idx;
  arenaLoadSlotEditPresetIntoRuneUI();
  arenaRenderSlotEditPresetRow();
}

// 더블클릭: 이 프리셋을 실제로 이 슬롯에 배정 + 저장 + 팝업 닫기
function arenaConfirmSlotEditPreset(idx) {
  arenaSlotEditPresetIndex = idx;
  arenaLoadSlotEditPresetIntoRuneUI();

  const data = arenaLoadFormationsData(arenaSlotEditSide);
  data.formations[data.activeFormationIndex].slotPresetIndices[arenaSlotEditSlotIndex] = idx;
  arenaSaveFormationsData(arenaSlotEditSide, data);
  if (arenaFormationTabRefreshers[arenaSlotEditSide]) arenaFormationTabRefreshers[arenaSlotEditSide]();
  arenaResetDisplay();

  document.getElementById("arenaSlotEditOverlay").style.display = "none";
  unlockBodyScroll();
}

// ===== 전투 표시/재생 =====

function arenaUpdateSlotHp(sideKey, slotIndex, hp, maxHp) {
  const fill = document.getElementById(`arenaHpFill_${sideKey}_${slotIndex}`);
  if (fill) fill.style.width = `${maxHp > 0 ? Math.max(0, (hp / maxHp) * 100) : 0}%`;
  const avatar = document.getElementById(`arenaAvatar_${sideKey}_${slotIndex}`);
  if (avatar) avatar.classList.toggle("arena-dead", hp <= 0);
}

function arenaResetDisplay() {
  arenaClearResultWaitTimeout();
  // 친구 기능 4단계: 준비 완료 핸드셰이크 대기 중(둘 다 준비되기 전)에 설정이 바뀌면 이미 한 내
  // 준비를 자동으로 취소함(dino-battle-page.js의 resetBattleDisplay와 동일한 원칙) - 계산이 이미
  // 끝나 재생 중(playing/paused)이면 그 결과는 계산 시점에 확정된 스냅샷이라 손댈 필요 없음
  const readySession = getActiveSession();
  if (readySession && readySession.myReady && arenaBattlePhase !== "playing" && arenaBattlePhase !== "paused") {
    sendReadyCancel();
  }
  arenaBattleToken++;
  arenaBattlePhase = "idle";
  arenaCurrentBattleResult = null;
  arenaCurrentBattleIndex = 0;
  arenaUpdateRestartButtonState();

  const myProfile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const oppProfile = arenaGetOppProfile();
  // buildArenaSide/initSlotHp는 js/core/simulation-arena.js의 전역 함수를 그대로 재사용
  const mySide = buildArenaSide(myProfile, arenaGetActiveSlotRunes("my"), "my", ARENA_TILE_CFG);
  const oppSide = buildArenaSide(oppProfile, arenaGetActiveSlotRunes("opp"), "opp", ARENA_TILE_CFG);
  initSlotHp(mySide, ARENA_TILE_CFG);
  initSlotHp(oppSide, ARENA_TILE_CFG);

  mySide.slots.forEach((s) => arenaUpdateSlotHp("my", s.slotIndex, s.hp, s.maxHp));
  oppSide.slots.forEach((s) => arenaUpdateSlotHp("opp", s.slotIndex, s.hp, s.maxHp));
  document.querySelectorAll(".arena-slot-avatar").forEach((el) => el.classList.remove("arena-attacking", "arena-hit", "arena-death-flash"));

  const result = document.getElementById("arenaBattleResult");
  result.style.display = "none";
  result.innerText = "";

  const startBtn = document.getElementById("arenaStartBtn");
  startBtn.disabled = false;
  startBtn.innerText = t("arena.startBtn");
  startBtn.classList.remove("is-pressed");
  // 친구 세션 중이면 위에서 넣은 기본 라벨을 "준비 완료"류 라벨로 덮어씀(세션 아니면 무해)
  arenaUpdateReadyButtonUI();
  renderArenaOppToolbar();
  arenaUpdatePresenceBadges();
}

// 10마리가 한 화면에 있으면 어떤 슬롯이 공격하고 어떤 슬롯이 맞는지 순간적으로 알아보기 어렵다는
// 피드백 반영 - 기존 돌진/피격 애니메이션에 더해 (1) 이번 턴과 무관한 나머지 8마리를 잠깐 흐리게
// 죽이고 (2) 공격자-피격자를 직선으로 잇는 선을 그려서 "누가 누구를 때리는지"가 명확히 보이게 함
function arenaPlayAttackAnim(attackerSide, attackerSlot, defenderSide, defenderSlot) {
  const attackerEl = document.getElementById(`arenaAvatar_${attackerSide}_${attackerSlot}`);
  const defenderEl = document.getElementById(`arenaAvatar_${defenderSide}_${defenderSlot}`);
  if (!attackerEl || !defenderEl) return;

  clearTimeout(arenaShakeTimeout);
  document.querySelectorAll(".arena-slot-avatar").forEach((el) => el.classList.remove("arena-attacking", "arena-hit"));
  document.querySelectorAll(".arena-strike-line").forEach((el) => el.remove());

  void attackerEl.offsetWidth;

  attackerEl.classList.add("arena-attacking");
  defenderEl.classList.add("arena-hit");
  arenaDrawStrikeLine(attackerEl, defenderEl, attackerSide);

  arenaShakeTimeout = setTimeout(() => {
    attackerEl.classList.remove("arena-attacking");
    defenderEl.classList.remove("arena-hit");
    document.querySelectorAll(".arena-strike-line").forEach((el) => el.remove());
  }, 350);
}

function arenaDrawStrikeLine(attackerEl, defenderEl, attackerSide) {
  const battlefield = document.getElementById("arenaBattlefield");
  if (!battlefield) return;
  const bfRect = battlefield.getBoundingClientRect();
  const aRect = attackerEl.getBoundingClientRect();
  const dRect = defenderEl.getBoundingClientRect();
  const ax = aRect.left + aRect.width / 2 - bfRect.left;
  const ay = aRect.top + aRect.height / 2 - bfRect.top;
  const dx = dRect.left + dRect.width / 2 - bfRect.left;
  const dy = dRect.top + dRect.height / 2 - bfRect.top;
  const length = Math.hypot(dx - ax, dy - ay);
  const angle = Math.atan2(dy - ay, dx - ax) * (180 / Math.PI);

  const line = document.createElement("div");
  line.className = `arena-strike-line ${attackerSide === "my" ? "my" : "opp"}`;
  // 회전각은 커스텀 프로퍼티로 넘김 - "쏘는" 애니메이션(arena-strike-shoot)이 transform 자체를
  // 매 프레임 덮어써서 여기서 인라인으로 transform:rotate(...)를 직접 넣으면 애니메이션 시작과
  // 동시에 사라짐(회전 없이 수평으로만 나가는 것처럼 보임) - 키프레임 쪽에서 rotate(var(...))로
  // 같이 적용해야 방향이 유지됨
  line.style.cssText = `left:${ax}px; top:${ay}px; width:${length}px; --strike-angle:${angle}deg;`;
  battlefield.appendChild(line);
}

function arenaSpawnPopup(sideKey, slotIndex, text, extraClass, delayMs, popupIndex) {
  setTimeout(() => {
    const slotEl = document.getElementById(`arenaSlot_${sideKey}_${slotIndex}`);
    if (!slotEl) return;
    const popup = document.createElement("div");
    popup.className = "battle-dmg-popup arena-dmg-popup" + (extraClass ? ` ${extraClass}` : "");
    popup.style.cssText = `left: calc(50% + ${popupIndex * 4}px); top: 0;`;
    popup.innerText = text;
    slotEl.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }, delayMs);
}

// 피격 이펙트 - 다른 3개 페이지(타이탄/건물/다이노배틀)와 허수아비가 이미 공유 중인
// dummy-hit-effect(-fixed) 클래스를 그대로 재사용(사용자 지적 - 아레나에만 이게 빠져있었음. "이건
// 다른 페이지에서 하는거 그대로 배끼면 됨"). js/pages/dino-battle-page.js의 spawnDinoHitEffect와
// 완전히 같은 패턴(대상의 getBoundingClientRect()를 읽어 position:fixed로 띄우고
// animationend에 제거) - 대상만 슬롯 인덱스 기반으로 다름
function arenaSpawnHitEffect(sideKey, slotIndex) {
  const target = document.getElementById(`arenaAvatar_${sideKey}_${slotIndex}`);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  if (rect.width === 0) return;
  const fx = document.createElement("img");
  fx.src = "./assets/sprites/Hit_Effect.png";
  fx.className = "dummy-hit-effect dummy-hit-effect-fixed";
  fx.style.setProperty("--hit-angle", `${Math.floor(Math.random() * 360)}deg`);
  fx.style.left = `${rect.left + rect.width / 2}px`;
  fx.style.top = `${rect.top + rect.height / 2}px`;
  fx.style.width = `${rect.width * 0.9}px`;
  document.body.appendChild(fx);
  fx.addEventListener("animationend", () => fx.remove());
}

function arenaRenderBattleEvent(ev) {
  arenaPlayAttackAnim(ev.attackerSide, ev.attackerSlot, ev.defenderSide, ev.defenderSlot);

  const popupIndex = {};
  const nextDelay = {};
  const STAGGER_MS = 150;
  const slotKey = (side, slot) => `${side}_${slot}`;
  function bump(side, slot) {
    const k = slotKey(side, slot);
    if (!(k in popupIndex)) { popupIndex[k] = 0; nextDelay[k] = 0; }
  }

  ev.hits.forEach((hit) => {
    bump(hit.targetSide, hit.targetSlot);
    const k = slotKey(hit.targetSide, hit.targetSlot);
    const isSkill = !!hit.label && hit.label !== "평타";
    const cls = `${isSkill ? "skill " : ""}${hit.isCrit ? "crit" : ""}`.trim();
    const text = (isSkill ? `${dinoBattleDisplayLabel(hit.label)} ` : "") + Math.round(hit.dmg).toLocaleString() + (hit.isCrit ? "!" : "");
    arenaSpawnPopup(hit.targetSide, hit.targetSlot, text, cls, nextDelay[k], popupIndex[k]);
    arenaSpawnHitEffect(hit.targetSide, hit.targetSlot);
    popupIndex[k]++;
    nextDelay[k] += STAGGER_MS;
  });

  ev.heals.forEach((heal) => {
    bump(heal.side, heal.slot);
    const k = slotKey(heal.side, heal.slot);
    const healCauseLabel = dinoBattleDisplayHealCause(heal.cause);
    const text = heal.amount > 0 ? `+${Math.round(heal.amount).toLocaleString()} (${healCauseLabel})` : healCauseLabel;
    arenaSpawnPopup(heal.side, heal.slot, text, "heal", nextDelay[k], popupIndex[k]);
    popupIndex[k]++;
    nextDelay[k] += STAGGER_MS;
  });

  if (ev.aoeList.length > 0) {
    const battlefield = document.getElementById("arenaBattlefield");
    // arenaDrawStrikeLine과 동일한 null 가드 - 페이지를 벗어난 뒤 밀린 이벤트가 재생되면
    // battlefield가 이미 사라진 상태일 수 있음(사이트 전체 점검에서 발견, 사용자 확정)
    if (battlefield) {
      battlefield.classList.add("area-flash");
      setTimeout(() => battlefield.classList.remove("area-flash"), 400);
    }
    // aoeList는 배열 - 메테오/가시를 동시에 장착해 같은 턴에 둘 다 발동해도 서로 안 덮어쓰고
    // 전부 표시됨(다이노 배틀 렌더러와 동일한 이유)
    ev.aoeList.forEach((aoe) => {
      aoe.targets.forEach((t) => {
        bump(ev.defenderSide, t.slot);
        const k = slotKey(ev.defenderSide, t.slot);
        const dmg = Math.max(0, t.before - t.after);
        // 다이노 배틀은 맞은 인원을 하나로 묶어 "메테오(광역) N마리 적중" 팝업 하나로 보여주지만,
        // 아레나는 슬롯마다 이미 개별 팝업이 뜨는 구조라 각 팝업 자체에 룬 이름을 붙임(사용자 지적 -
        // "아레나에서도 공룡 대전처럼 모든 룬의 효과를 다 적어줘" - 예전엔 이 팝업만 숫자만 뜨고
        // "메테오" 같은 룬 이름이 안 붙어서 평타랑 구분이 안 갔음)
        const text = `${dinoBattleDisplayLabel(aoe.label)} ${Math.round(dmg).toLocaleString()}`;
        arenaSpawnPopup(ev.defenderSide, t.slot, text, t.isCrit ? "skill crit" : "skill", nextDelay[k], popupIndex[k]);
        arenaSpawnHitEffect(ev.defenderSide, t.slot);
        popupIndex[k]++;
        nextDelay[k] += STAGGER_MS;
      });
    });
  }

  ev.mySlots.forEach((s, i) => arenaUpdateSlotHp("my", i, s.hp, s.maxHp));
  ev.oppSlots.forEach((s, i) => arenaUpdateSlotHp("opp", i, s.hp, s.maxHp));

  ev.deaths.forEach((d) => {
    const el = document.getElementById(`arenaAvatar_${d.side}_${d.slot}`);
    if (!el) return;
    el.classList.add("arena-death-flash");
    setTimeout(() => el.classList.remove("arena-death-flash"), 400);
  });
}

function arenaFinishBattleDisplay(result) {
  const resultEl = document.getElementById("arenaBattleResult");
  resultEl.style.display = "block";
  if (result.winner === "draw") resultEl.innerText = t("arena.result.draw");
  else if (result.winner === "my") resultEl.innerText = t("arena.result.win");
  else resultEl.innerText = t("arena.result.lose");

  arenaBattlePhase = "finished";
  const startBtn = document.getElementById("arenaStartBtn");
  startBtn.innerText = t("arena.startBtnRestart");
  startBtn.classList.remove("is-pressed");
}

function arenaOnBattleButtonClick() {
  const startBtn = document.getElementById("arenaStartBtn");
  if (arenaBattlePhase === "playing") {
    arenaBattlePhase = "paused";
    startBtn.innerText = t("arena.startBtnResume");
    startBtn.classList.remove("is-pressed");
    return;
  }
  if (arenaBattlePhase === "paused") {
    arenaBattlePhase = "playing";
    startBtn.innerText = t("arena.startBtnPause");
    startBtn.classList.add("is-pressed");
    arenaRunBattleStep(arenaBattleToken);
    return;
  }
  // idle 또는 finished. 친구 세션 중이면 "준비 완료" 핸드셰이크부터 거침(dino-battle-page.js와
  // 동일한 친구 기능 4단계 - 둘 다 준비되기 전엔 아무도 계산하지 않음)
  if (arenaIsFriendSessionActive()) {
    arenaHandleReadyButtonClick();
    return;
  }
  arenaStartBattle();
}

// ===== 친구 기능 4단계: 준비 완료 핸드셰이크 + "한쪽 계산, 결과 통째 전송" (dino-battle-page.js와 대칭) =====

let arenaResultWaitTimeoutId = null;

function arenaClearResultWaitTimeout() {
  if (arenaResultWaitTimeoutId) {
    clearTimeout(arenaResultWaitTimeoutId);
    arenaResultWaitTimeoutId = null;
  }
}

function arenaAmICalculator(session) {
  return [session.myId, session.friendId].sort()[0] === session.myId;
}

function arenaUpdateReadyButtonUI() {
  if (!arenaIsFriendSessionActive() || arenaBattlePhase === "playing" || arenaBattlePhase === "paused") return;
  const session = getActiveSession();
  const startBtn = document.getElementById("arenaStartBtn");
  if (!session || !startBtn) return;
  startBtn.disabled = false;
  startBtn.classList.remove("is-pressed");
  startBtn.innerText = session.myReady ? t("arena.readyWaitingBtn") : t("arena.readyBtn");
}

function arenaHandleReadyButtonClick() {
  const session = getActiveSession();
  if (!session) return;
  if (session.myReady) {
    sendReadyCancel();
    arenaUpdateReadyButtonUI();
    renderArenaOppToolbar();
    return;
  }
  sendReadyRequest("arena");
  arenaUpdateReadyButtonUI();
  renderArenaOppToolbar();
  arenaMaybeStartServerlessBattle();
}

function arenaMaybeStartServerlessBattle() {
  const session = getActiveSession();
  if (!session || !session.myReady || !session.friendReady) return;
  if (arenaAmICalculator(session)) {
    arenaComputeAndBroadcastBattleResult();
    return;
  }
  arenaClearResultWaitTimeout();
  const startBtn = document.getElementById("arenaStartBtn");
  startBtn.innerText = t("arena.resolvingLabel");
  startBtn.disabled = true;
  arenaResultWaitTimeoutId = setTimeout(() => {
    arenaResultWaitTimeoutId = null;
    sendReadyCancel();
    arenaUpdateReadyButtonUI();
    alert(t("arena.resolveTimeoutAlert"));
  }, 10000);
}

function arenaComputeAndBroadcastBattleResult() {
  resetBattleReady();
  arenaResetDisplay();
  const myProfile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const oppProfile = arenaGetOppProfile();
  const result = runArenaSimulation({
    myProfile, oppProfile,
    mySlotRunes: arenaGetActiveSlotRunes("my"),
    oppSlotRunes: arenaGetActiveSlotRunes("opp"),
    tileSettings: ARENA_TILE_CFG
  });
  sendBattleResult("arena", result);
  arenaBeginBattlePlayback(result);
}

function arenaHandleReceivedBattleResult(result) {
  arenaClearResultWaitTimeout();
  resetBattleReady();
  arenaResetDisplay();
  arenaBeginBattlePlayback(arenaRemapBattleResultPerspective(result));
}

// 계산 담당이 "my"/"opp"로 태깅한 이벤트 로그를 계산 담당이 아닌 쪽 입장으로 뒤집음
// (dino-battle-page.js의 remapBattleResultPerspective와 동일한 원리, 아레나 필드 구조에 맞춤)
function arenaRemapBattleResultPerspective(result) {
  const swap = (s) => (s === "my" ? "opp" : s === "opp" ? "my" : s);
  const swapEvent = (ev) => ({
    ...ev,
    attackerSide: swap(ev.attackerSide),
    defenderSide: swap(ev.defenderSide),
    hits: ev.hits.map((h) => ({ ...h, targetSide: swap(h.targetSide) })),
    heals: ev.heals.map((h) => ({ ...h, side: swap(h.side) })),
    deaths: ev.deaths.map((d) => ({ ...d, side: swap(d.side) })),
    mySlots: ev.oppSlots, oppSlots: ev.mySlots,
    myAliveCount: ev.oppAliveCount, oppAliveCount: ev.myAliveCount
  });
  return {
    ...result,
    winner: swap(result.winner),
    myFinalCount: result.oppFinalCount,
    oppFinalCount: result.myFinalCount,
    events: result.events.map(swapEvent)
  };
}

function arenaBeginBattlePlayback(result) {
  arenaBattleToken++;
  const token = arenaBattleToken;
  arenaCurrentBattleResult = result;
  arenaCurrentBattleIndex = 0;
  arenaBattlePhase = "playing";
  const startBtn = document.getElementById("arenaStartBtn");
  startBtn.disabled = false;
  startBtn.innerText = t("arena.startBtnPause");
  startBtn.classList.add("is-pressed");
  document.getElementById("arenaBattleResult").style.display = "none";
  arenaUpdateRestartButtonState();
  arenaRunBattleStep(token);
}

function arenaRunBattleStep(token) {
  if (token !== arenaBattleToken) return;
  if (arenaBattlePhase !== "playing") return;

  if (arenaCurrentBattleIndex >= arenaCurrentBattleResult.events.length) {
    arenaFinishBattleDisplay(arenaCurrentBattleResult);
    return;
  }
  arenaRenderBattleEvent(arenaCurrentBattleResult.events[arenaCurrentBattleIndex]);
  arenaCurrentBattleIndex++;
  setTimeout(() => arenaRunBattleStep(token), arenaGetBattleSpeedMs());
}

// 솔로 플레이(친구 세션 없음) 전용 - 세션 중엔 계산 담당/결과 수신 흐름으로만 진행됨
function arenaStartBattle() {
  if (arenaIsFriendSessionActive()) return;
  const myProfile = loadMyDinoProfile(MY_DINO_PROFILE_KEY);
  const oppProfile = arenaGetOppProfile();
  const result = runArenaSimulation({
    myProfile, oppProfile,
    mySlotRunes: arenaGetActiveSlotRunes("my"),
    oppSlotRunes: arenaGetActiveSlotRunes("opp"),
    tileSettings: ARENA_TILE_CFG
  });
  arenaBeginBattlePlayback(result);
}

function arenaUpdateRestartButtonState() {
  document.getElementById("arenaRestartBtn").disabled = arenaBattlePhase === "idle";
}
