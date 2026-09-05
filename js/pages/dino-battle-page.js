// 공룡 대전: 내 공룡 팀 vs 상대 공룡 팀. 각 팀은 타일 위에 자신의 공룡 수만큼 전부 올라와 있고,
// 맨 앞(제일 위) 공룡끼리 1:1로 싸우다가 죽으면 다음 공룡이 앞으로 나옴. 선공권은 이동속도 ->
// 레벨 -> 랜덤 순으로 정해지고, 앞장이 바뀔 때마다 다시 판정함(단, 상대를 단독으로 처치했다면
// 다음 매치업 1회는 처치한 쪽이 그대로 선공 유지 - js/core/simulation-dino-battle.js 참고).
// 앞장이 그대로인 동안은 공격권이 팀 단위로 계속 번갈아감(내 공격 1회 -> 상대 공격 1회 -> ...).
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

// ===== 룬 조합 찾기 =====
const DINO_BATTLE_OWNED_LEVELS_KEY = "dino_battle_owned_rune_levels";
const DINO_BATTLE_GRADE_ORDER = ["일반", "희귀", "에픽", "유니크", "전설"];
// 조합 찾기가 후보를 서로 붙일 때 쓰는 "판정 방식" 자체를 교체함(사용자 확정 + 실측 검증) - 예전엔
// runDinoBattleTrials(공룡 dinoCount마리 로스터가 다 죽으면 그 배틀 승자 판정)를 여러 번 반복해서
// "배틀 승률"을 냈는데, 이건 "실전 대전" 애니메이션용으로나 맞는 방식이지 실제 룬 성능 비교 기준이
// 아니었음 - 실제 게임에서 "동시 소환 상한(9~13)"은 로스터 총량이 아니라 계속 리필되는 상한일 뿐이라
// 로스터 소진 자체가 안 일어남. 그래서 이제 dinoCount를 인위적으로 아주 크게 잡은 "연속 교체전" 하나를
// 실행해서, 그 안에서 실제로 일어난 개별 매치업(교체 하나하나)의 승패를 집계한 "매치업 승률"을 씀
// (dinoBattleMatchupTrial 참고). 공룡 수를 키우면 "그 배틀 전체의 승자"는 아주 작은 우위도
// 100%/0%로 뭉개져서 순위 구분에 못 쓰지만, 매치업 승률은 안 뭉개짐 - 실측으로 확인함.
// 검증(브라우저 실측): 공룡 2,000마리 기준 오차범위 ±0.8%(매치업 표본 약 3,900개) - 1% 미만
// 요구사항을 충족. 그 이하(300마리 안팎, 오차 ±2~3%대)는 스크리닝 단계에만 씀.
const DINO_BATTLE_SCREEN_DINO_COUNT = 300;
const DINO_BATTLE_VERIFY_DINO_COUNT = 2000;
const DINO_BATTLE_OPTIMIZER_VERIFY_TOP_N = 8;
// 모드 A(전체 룬)/모드 B(에픽 이상만)는 둘 다 후보끼리 서로 붙는 라운드로빈이라 후보 수의 제곱에
// 비례해 비용이 커서, 시뮬레이션 없는 애널리틱 점수(getBattleStats + computeExpectedDpsFromCrit,
// js/core/stat-calc.js)로 먼저 숏리스트를 추림 - 단, 이 사전 필터링 자체가 진짜 정확도 손실
// 지점임(스킬 룬 시너지를 못 보는 간이 점수라, 점수는 낮게 나와도 실전에서 강한 조합이 라운드로빈
// 기회조차 못 받을 수 있음 - 사용자 확인). 100은 보유 룬 8종(C(8,5)=56)까지는 필터링 자체가 아예
// 안 걸리고, 그 이상도 이전보다 훨씬 넉넉하게 통과시키는 값 - 인터랙티브치고 느리지만(공룡 수
// 300으로도 후보 100개=4,950쌍이면 수 분 걸림) 이 모드 자체가 "가끔 정밀하게 돌려보는" 용도라 감수함
const DINO_BATTLE_MODE_AB_SHORTLIST_SIZE = 100;
// 모드 C(상대 지정)는 상대 하나 고정이라 후보 수에 선형으로만 비례해서 훨씬 싸므로 애널리틱 예비
// 풀을 더 넉넉히 잡음
const DINO_BATTLE_MODE_C_ANALYTIC_POOL = 150;
// 결과 화면 경고 임계값(모드 C 전용 - 상대와의 스탯 격차가 너무 크면 룬 조합 차이가 결과에 거의 안
// 드러남을 감지). 예전엔 "승률 극단값" 기준이 오작동해서 "평균 손실 비율" 기준으로 바꿨던 적이
// 있는데(사용자 확정 - 배틀 승패 기준 승률은 약간의 우위만으로도 100%까지 금방 포화돼서 격차
// 크기의 대리 지표로 부적합했음), 그건 "배틀 전체 승패" 지표 얘기였음. 지금 쓰는 "매치업 승률"은
// 포화되는 지표가 아니라(이번 세션 라운드로빈 연구에서 실측한 범위가 쭉 40~60%대) 극단값 자체가
// 이미 "격차가 크다"는 신뢰할 수 있는 신호라 승률 임계값으로 다시 판정해도 됨.
const DINO_BATTLE_LOPSIDED_WINRATE_THRESHOLD = 0.97;

// ===== 육각형 바닥과 완전히 같은 결합 좌표계(세계좌표) 위에 공룡을 "카메라로 촬영"하듯 배치 =====
// 타일 중심은 원점(0,0)에 내 대기 타일을 두고 HEX_NEIGHBOR 방향 벡터를 더해가며 명시적으로
// 선언함(CSS 3D 시절 SVG viewBox 절대좌표를 재사용하지 않기 위함 - 그렇게 했다가 타일 중심과
// 아바타 좌표가 어긋나는 버그가 났었음). 내 대기 -> 중앙 -> 상대 대기가 일직선 계단이 되도록
// 같은 방향(upperRight)을 두 번 적용.
const HEX_CENTERS = {
  myReserve: [0, 0],
  center: hexAdd([0, 0], HEX_NEIGHBOR.upperRight),
  oppReserve: hexAdd(hexAdd([0, 0], HEX_NEIGHBOR.upperRight), HEX_NEIGHBOR.upperRight),
};
const CENTER_SPLIT_OFFSET = 20;          // 중앙 육각형 내/상대 절반 기준점 간격
const OUTWARD_1V1 = 12;                  // 1v1일 때 서로 반대쪽으로 더 벌리는 거리(중앙 타일엔
                                          // 배치 설정과 무관하게 항상 이 1v1 공식만 씀 - 사용자 확정)
const R2_RESERVE = 22;                   // 대기 육각형 2마리 나란히 반지름
const R3_RESERVE = 22;                   // 대기 육각형 3마리 정삼각형 반지름

// Three.js 육각형 바닥(js/core/hex-scene3d.js) - 이 페이지는 탭 뒤에 안 숨어있고(다른 3개 페이지와
// 달리 "live"가 항상 기본으로 보이는 상태) 페이지 로드 즉시 마운트됨(initDinoBattlePage 참고)
let dinoBattleScene3d = null;
// theme-changed 리스너 핸들 - 페이지를 여러 번 오가도 리스너가 계속 쌓이지 않도록, 새로 등록하기
// 전에 이 참조로 이전 방문 몫을 먼저 지움
let dinoBattleThemeChangeHandler = null;
// center 타일 위에서 "보통 크기 공룡"(js/core/hex-scene3d.js의 DINO_AVATAR_DIAMETER_WORLD)이
// 실제로 몇 px로 보이는지를 1배 기준으로 삼아서, 그보다 가까운 내 쪽은 확대(>1)/먼 상대 쪽은
// 축소(<1)되게 함(dinoBattlePerspectiveScale이 매번 실제 지점의 투영 크기와 비교해서 재계산) -
// 육각형 크기 자체를 기준으로 삼으므로 페이지가 달라도 "보통 크기"가 같은 비율로 보임
let dinoBattleReferenceDiamPx = null;

// "보통 크기 공룡"의 기준 픽셀 지름을 다시 재서 --avatar-base-px로 심음(.battle-avatar가 이 값에
// --avatar-formation-scale/--dino-scale을 곱해서 자기 크기를 정함) - 마운트 시점과 창 크기 변경
// 시점 둘 다에서 호출됨
function dinoBattleRefreshReferenceSize() {
  dinoBattleReferenceDiamPx = dinoBattleScene3d.projectDiameterPx(HEX_CENTERS.center[0], HEX_CENTERS.center[1], DINO_AVATAR_DIAMETER_WORLD);
  const arena = document.getElementById("battleArena");
  if (arena && dinoBattleReferenceDiamPx > 0) arena.style.setProperty("--avatar-base-px", `${dinoBattleReferenceDiamPx}px`);
}

function dinoBattleInitScene3d() {
  const mountEl = document.getElementById("battleHexTilt") || document.querySelector(".battle-hex-tilt");
  if (!mountEl) return;
  // "지금 이 mountEl"에 이미 캔버스가 붙어있으면(같은 페이지 세션 안에서의 재호출) 리사이즈만 -
  // dinoBattleScene3d(안 null)만 보고 판단하면 안 됨(실측으로 재현한 버그: 페이지를 나갔다
  // 재방문하면 mountEl은 라우터가 완전히 새로 만든 엘리먼트인데 dinoBattleScene3d는 예전
  // 인스턴스를 그대로 들고 있어서 "이미 마운트됨"으로 착각 - 새 mountEl엔 캔버스가 영영 안 붙어
  // 바닥이 통째로 안 보였음)
  if (dinoBattleScene3d && mountEl.querySelector("canvas")) { dinoBattleScene3d.resize(); return; }
  if (typeof createHexFloorScene !== "function") return;
  // 위 가드를 통과했다는 건 새 mountEl에 새 씬을 만들어야 한다는 뜻 - dinoBattleScene3d가 이미
  // 채워져 있다면(재방문) 그건 직전 방문에서 만든, 이제 화면엔 없지만 WebGL 리소스는 아직 살아있는
  // 예전 씬임 - dispose 없이 그냥 덮어쓰면 그 리소스가 영영 안 풀림(사이트 전체 점검에서 발견)
  if (dinoBattleScene3d) dinoBattleScene3d.dispose();
  dinoBattleScene3d = createHexFloorScene({
    // 마운트 즉시 resize()가 실제 컨테이너 비율로 다시 잡아주므로 여기 값은 초기 종횡비 정도만
    // 맞으면 됨
    worldW: 6 * HEX_HALF_W,
    worldH: 4 * HEX_HALF_H,
    hexTiles: [
      { center: HEX_CENTERS.myReserve, tintVar: "--accent" },
      { center: HEX_CENTERS.center, tintVar: "--accent" }, // 부족 점령 색은 applyCenterTileColor()가 rebake로 반영(아래 참고)
      { center: HEX_CENTERS.oppReserve, tintVar: "#e0473f" },
    ],
    // 카메라는 중앙 타일을 내려다보게 잡음(타일 좌표에서 직접 유도). lookAt/fov는 그대로 두고
    // position만 같은 비율로 씬에 당김(순수 줌인, 타이탄/건물과 같은 방식) - 예전 값(220/173.4)은
    // 여백이 너무 많이 남아서(사용자 지적 - "공룡 대전이 여백이 너무 많아서 폰에 눈 가까이 대고
    // 겨우 봐야해") 실제 Three.js 카메라로 육각형 3개(내 대기/중앙/상대 대기) 전체 꼭짓점을
    // 직접 투영해서 스캔한 결과, 0.73배가 잘림 없이(가장 타이트한 왼쪽 변도 여백 4%+ 유지) 안전한
    // 최대 확대치였음 - 그보다 더 당기면(0.7 이하) 왼쪽 육각형 모서리가 프레임을 벗어남
    camera: {
      position: [HEX_CENTERS.center[0], 220 * 0.73, HEX_CENTERS.center[1] + 173.4 * 0.73],
      lookAt: [HEX_CENTERS.center[0], 0, HEX_CENTERS.center[1]],
      fov: 56,
    },
    // 창 크기가 바뀌면 육각형이 화면에서 차지하는 실제 픽셀 크기도 바뀌므로, 기준 크기부터
    // 다시 재고 양쪽 진영 배치를 다시 그림(--perspective-scale/--avatar-diam-px가 이 기준값에서
    // 파생됨)
    onResize: () => {
      dinoBattleRefreshReferenceSize();
      updateStackDisplay("my", lastAliveCount.my);
      updateStackDisplay("opp", lastAliveCount.opp);
    },
  });
  dinoBattleScene3d.mount(mountEl);
  dinoBattleRefreshReferenceSize();
  document.removeEventListener("theme-changed", dinoBattleThemeChangeHandler);
  dinoBattleThemeChangeHandler = () => {
    if (dinoBattleScene3d && mountEl.isConnected) dinoBattleScene3d.rebakeColors();
  };
  document.addEventListener("theme-changed", dinoBattleThemeChangeHandler);
}

function worldToPercent([x, y]) {
  if (dinoBattleScene3d) return dinoBattleScene3d.projectToScreen(x, y);
  return { left: "50%", top: "50%" }; // 씬 마운트 전 폴백(이 페이지는 로드 즉시 마운트되므로 사실상 안 씀)
}

// 특정 세계좌표 지점 -> --perspective-scale 배율. 기준(center 타일)보다 카메라에 가까우면 1보다
// 커지고(확대), 멀면 1보다 작아짐(축소) - 예전에 CSS 3D preserve-3d가 저절로 해주던 원근 확대/축소를
// 직접 계산해서 재현(dinoBattleReferenceDiamPx와 같은 세계 단위 지름을 이 지점에 투영해서 비율만 봄)
function dinoBattlePerspectiveScale(point) {
  if (!dinoBattleScene3d || !dinoBattleReferenceDiamPx) return 1;
  const diamPx = dinoBattleScene3d.projectDiameterPx(point[0], point[1], DINO_AVATAR_DIAMETER_WORLD);
  return diamPx > 0 ? diamPx / dinoBattleReferenceDiamPx : 1;
}

// 반지름 R짜리 정삼각형 꼭짓점 3개(+y가 카메라 쪽/가까움이라 apex가 앞으로 나오는 모양) -
// 대기 육각형이든 중앙 절반이든 center와 R만 바꿔서 그대로 재사용
function trianglePoints([cx, cy], R) {
  return [
    [cx, cy + R],                          // 앞(가까움)
    [cx - 0.866 * R, cy - 0.5 * R],        // 뒤-왼쪽(멀음)
    [cx + 0.866 * R, cy - 0.5 * R]         // 뒤-오른쪽(멀음)
  ];
}

// count(0~3)에 따라 실제로 배치할 좌표 배열을 돌려줌 - center 기준 공통 공식, 어디(대기 육각형/
// 중앙 절반)든 center와 R2/R3만 바꿔서 그대로 재사용.
// awayDir: "상대 반대쪽(자기 진영 쪽)"을 가리키는 단위벡터 - 마주볼 상대가 있는 자리(중앙 절반)
// 에서만 씀. 1마리면 그 방향으로 물러나 상대와의 간격을 벌리고(1v1 확정 요구사항), 2마리면
// 0번(앞, 상대 쪽)/1번(뒤, 자기 진영 쪽)으로 나뉨. 대기 육각형처럼 마주볼 상대가 없으면 awayDir
// 없이(null) 정삼각형/좌우대칭만 씀(사용자 확정 - "마주보기 편향은 정삼각형을 해친다")
function formationPoints(center, count, R2, R3, awayDir) {
  if (count <= 0) return [];
  if (count === 1) {
    if (!awayDir) return [center];
    return [[center[0] + awayDir[0] * OUTWARD_1V1, center[1] + awayDir[1] * OUTWARD_1V1]];
  }
  if (count === 2) {
    if (awayDir) {
      return [
        [center[0] - awayDir[0] * R2, center[1] - awayDir[1] * R2], // 앞(상대 쪽)
        [center[0] + awayDir[0] * R2, center[1] + awayDir[1] * R2]  // 뒤(자기 진영 쪽)
      ];
    }
    return [[center[0] - R2, center[1]], [center[0] + R2, center[1]]];
  }
  return trianglePoints(center, R3);
}

// 재생 컨트롤 상태(전투 도중 룬/스탯을 바꾸거나 다시 시작을 눌러도 예전 재생 체인이 화면을 계속
// 덮어쓰지 않도록 토큰으로 무력화하고, 일시정지/재개와 진행 인덱스를 여기서 관리).
// battlePhase: "idle"(시작 전) | "playing"(재생 중) | "paused"(일시정지) | "finished"(종료)
// "전투 시작" 버튼 하나가 이 상태에 따라 시작/일시정지/재개/다시시작을 전부 겸함
let battleToken = 0;
let battlePhase = "idle";
let currentBattleResult = null;
let currentBattleIndex = 0;

// 룬 조합 찾기 상태 - 지금 선택된 서브모드(모드 A/B)와, 결과에서 클릭한 조합을 프리셋에 저장하는
// "적용" 모달이 열려있는 동안의 대기 상태(타이탄 조합 찾기의 applyPresetPendingRunes와 같은 패턴)
let dinoOptimizeSubmode = "modeA";
let dinoOptimizeApplyPresetPendingRunes = null;
let dinoOptimizeApplyPresetSelectedIdx = null;

// SPA 라우터(js/router.js)엔 페이지 teardown 훅이 없어서(hashchange가 그냥 다음 페이지를 새로
// 그릴 뿐) 전투 재생 중에 다른 페이지로 이동해도 setTimeout으로 예약돼있던 runBattleStep이 나중에
// 그대로 실행되면서 이미 사라진 DOM을 찾다가(document.getElementById가 null) 콘솔 에러를 냈음 -
// 페이지를 벗어나는 순간 battleToken을 미리 무효화해서 그 낡은 재생 체인이 조용히 멈추게 함
// (runBattleStep 맨 앞의 "token !== battleToken이면 중단" 가드가 그대로 처리해줌)
window.addEventListener("hashchange", () => { battleToken++; });

// 친구 기능 3단계(친구와 함께 실시간 공동 연구) 관련 페이지 상태.
// myUserId/myNickname: 로그인 상태일 때만 채워짐(비로그인이면 초대/불러오기 버튼 자체를 안 보여줌).
// friendSnapshotProfile: "친구 설정 불러오기"로 가져온 정적 스냅샷(실시간 세션과 무관, 한 번만 로딩).
// unsubscribeFriendSession: 페이지를 다시 그릴 때(라우터 재진입) 이전 구독을 정리하기 위한 핸들.
let myUserId = null;
let myNickname = null;
let friendSnapshotProfile = null;
let friendSnapshotNickname = null;
let unsubscribeFriendSession = null;

// 직전 이벤트 기준 생존 마릿수(진급/팝인 연출 트리거용 - renderBattleEvent가 매번 갱신함)
let lastAliveCount = { my: 0, opp: 0 };

const TRIBE_LABEL_KEYS = { none: "dino_battle.tribe.none", mine: "dino_battle.tribe.mine", opponent: "dino_battle.tribe.opponent" };
const ARRANGEMENT_LABEL_KEYS = { same: "dino_battle.arrangement.same", separate: "dino_battle.arrangement.separate" };

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
    <h2 class="sr-only">${t("dino_battle.heading")}</h2>

    <div class="battle-layout" id="battleLayout">
      <div class="battle-side-panel my-side" id="mySidePanel">
        <div id="myDinoBattleSection"></div>
      </div>

      <div class="battle-arena-wrap">
        <button class="battle-peek-btn my-peek" id="myPeekBtn" title="${t("dino_battle.myPeekTooltip")}">▶</button>

        <div class="card battle-main-card" id="battleMainCard">
          <div class="battle-mode-tabs mode-live dino-mode-tabs-4" id="battleModeTabs">
            <span class="battle-mode-indicator"></span>
            <div class="battle-tab-presence my-presence" id="dinoBattleMyPresenceBadge"></div>
            <div class="battle-tab-presence friend-presence" id="dinoBattleFriendPresenceBadge"></div>
            <button class="battle-mode-tab" data-mode="settings" id="modeTabSettings"><span>${t("dino_battle.tab.settings")}</span></button>
            <button class="battle-mode-tab" data-mode="quick" id="modeTabQuick"><span>${t("dino_battle.tab.quick")}</span></button>
            <button class="battle-mode-tab active" data-mode="live" id="modeTabLive"><span>${t("dino_battle.tab.live")}</span></button>
            <button class="battle-mode-tab" data-mode="optimize" id="modeTabOptimize"><span>${t("dino_battle.tab.optimize")}</span></button>
          </div>

          <div class="battle-mode-panel battle-tile-card" id="settingsModeCard" style="display:none;">
            <div class="tile-group">
              <div class="tile-group-label">${t("dino_battle.tileGroup.environment")}</div>
              <div class="setting-list">
                <div class="setting-row">
                  <div class="setting-label">${t("dino_battle.tile.natureLabel")}</div>
                  <label class="switch"><input type="checkbox" id="tileNatureToggle"><span class="slider round"></span></label>
                </div>
                <div class="setting-row">
                  <div class="setting-label">${t("dino_battle.tile.tribeLabel")}</div>
                  <div class="custom-dropdown setting-control" id="tileTribeDropdown">
                    <div class="selected-value" id="tileTribeSelectedValue">${t("dino_battle.tribe.none")}</div>
                    <ul class="dropdown-list" id="tileTribeList"></ul>
                  </div>
                </div>
                <div class="setting-stack-pair">
                  <div class="setting-stack">
                    <label class="setting-label">${t("dino_battle.tile.serverLevelCapLabel")}</label>
                    <div class="custom-dropdown" id="tileServerLevelCapDropdown">
                      <div class="selected-value" id="tileServerLevelCapSelectedValue">${t("common.optionNone")}</div>
                      <ul class="dropdown-list" id="tileServerLevelCapList"></ul>
                    </div>
                  </div>
                  <div class="setting-stack">
                    <label class="setting-label">${t("dino_battle.tile.constellationCapLabel")}</label>
                    <div class="custom-dropdown" id="tileConstellationCapDropdown">
                      <div class="selected-value" id="tileConstellationCapSelectedValue">${t("common.optionNone")}</div>
                      <ul class="dropdown-list" id="tileConstellationCapList"></ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="tile-group">
              <div class="tile-group-label">${t("dino_battle.tileGroup.perSide")}</div>
              <div class="tile-side-grid">
                <div class="tile-side-col">
                  <div class="tile-side-col-label my-side-label">${t("dino_battle.side.myDino")}</div>
                  <div class="tile-side-field">
                    <label>${t("dino_battle.side.arrangementLabel")}</label>
                    <div class="custom-dropdown" id="myTileArrangementDropdown">
                      <div class="selected-value" id="myTileArrangementSelectedValue">${t("dino_battle.arrangement.same")}</div>
                      <ul class="dropdown-list" id="myTileArrangementList"></ul>
                    </div>
                  </div>
                  <div class="tile-side-field">
                    <label>${t("dino_battle.side.atkTowerLabel")}</label>
                    <div class="custom-dropdown" id="myAtkTowerDropdown">
                      <div class="selected-value" id="myAtkTowerSelectedValue">${t("common.optionNone")}</div>
                      <ul class="dropdown-list" id="myAtkTowerList"></ul>
                    </div>
                  </div>
                  <div class="tile-side-field">
                    <label>${t("dino_battle.side.hpTowerLabel")}</label>
                    <div class="custom-dropdown" id="myHpTowerDropdown">
                      <div class="selected-value" id="myHpTowerSelectedValue">${t("common.optionNone")}</div>
                      <ul class="dropdown-list" id="myHpTowerList"></ul>
                    </div>
                  </div>
                </div>

                <div class="tile-side-col">
                  <div class="tile-side-col-label opp-side-label">${t("dino_battle.side.oppDino")}</div>
                  <div class="tile-side-field">
                    <label>${t("dino_battle.side.arrangementLabel")}</label>
                    <div class="custom-dropdown" id="oppTileArrangementDropdown">
                      <div class="selected-value" id="oppTileArrangementSelectedValue">${t("dino_battle.arrangement.same")}</div>
                      <ul class="dropdown-list" id="oppTileArrangementList"></ul>
                    </div>
                  </div>
                  <div class="tile-side-field">
                    <label>${t("dino_battle.side.atkTowerLabel")}</label>
                    <div class="custom-dropdown" id="oppAtkTowerDropdown">
                      <div class="selected-value" id="oppAtkTowerSelectedValue">${t("common.optionNone")}</div>
                      <ul class="dropdown-list" id="oppAtkTowerList"></ul>
                    </div>
                  </div>
                  <div class="tile-side-field">
                    <label>${t("dino_battle.side.hpTowerLabel")}</label>
                    <div class="custom-dropdown" id="oppHpTowerDropdown">
                      <div class="selected-value" id="oppHpTowerSelectedValue">${t("common.optionNone")}</div>
                      <ul class="dropdown-list" id="oppHpTowerList"></ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="battle-mode-panel" id="quickModeCard" style="display:none;">
            <p class="quickcalc-desc">${t("dino_battle.quick.desc", { trials: QUICK_CALC_TRIALS.toLocaleString() })}</p>
            <button class="btn-simulate" id="quickCalcBtn">${t("dino_battle.quick.calcBtn", { trials: QUICK_CALC_TRIALS.toLocaleString() })}</button>
            <div class="report-grid" id="quickCalcResult" style="display:none;">
              <div class="report-tile"><div class="metric-label">${t("dino_battle.quick.resultLabel", { trials: QUICK_CALC_TRIALS.toLocaleString() })}</div><div class="metric-value accent" id="qcRatio">-</div><div class="metric-sub" id="qcRatioNorm"></div></div>
              <div class="report-tile"><div class="metric-label">${t("dino_battle.quick.myDmgLabel")}</div><div class="metric-value" id="qcMyDmg">-</div></div>
              <div class="report-tile"><div class="metric-label">${t("dino_battle.quick.oppDmgLabel")}</div><div class="metric-value" id="qcOppDmg">-</div></div>
              <div class="report-tile"><div class="metric-label">${t("dino_battle.quick.neededCountLabel")}</div><div class="metric-value" id="qcNeededCount">-</div><div class="metric-sub" id="qcNeededCountBase"></div></div>
            </div>
          </div>

          <div class="battle-mode-panel" id="liveModeCard">
            <div class="battle-arena" id="battleArena">
              <!-- 육각형 3개(내 대기/중앙/상대 대기) - 결합 좌표계 250x173.2, 내 쪽이 아래(큰
                   y)/상대 쪽이 위(작은 y). 바닥은 Three.js(js/core/hex-scene3d.js)가 이 좌표
                   그대로 진짜 3D로 그림. 아바타는 hexScene.projectToScreen()이 계산한 화면 좌표를
                   받는 평면 DOM(.battle-team-slot) - "가까운 내 편 크게/먼 상대 작게" 원근 축소는
                   projectToScreen()의 distance 값으로 --perspective-scale을 직접 계산해서 재현함
                   (updateStackDisplay(), dinoBattlePerspectiveScale() 참고 - 예전엔 아바타까지
                   CSS preserve-3d 스택 안에 넣어서 저절로 생기던 효과였음) -->
              <div class="battle-hex-field">
                <div class="battle-hex-stage" id="battleHexStage">
                  <div class="battle-hex-tilt" id="battleHexTilt"></div>

                    <div class="battle-formation-group" id="myFormationGroup">
                      <div class="battle-team-slot battle-team-slot-avatar" id="myAvatarSlot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini my-hp-fill" id="myHpFill"></div></div>
                        <div class="battle-avatar my-avatar" id="myAvatar"></div>
                        <div class="battle-team-slot-name">${t("dino_battle.myAvatarLabel")}</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind1" id="myBehind1Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini my-hp-fill" id="myBehind1HpFill"></div></div>
                        <div class="battle-avatar my-avatar" id="myBehind1"></div>
                        <div class="battle-team-slot-name">${t("dino_battle.myAvatarLabel")}</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind2" id="myBehind2Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini my-hp-fill" id="myBehind2HpFill"></div></div>
                        <div class="battle-avatar my-avatar" id="myBehind2"></div>
                        <div class="battle-team-slot-name">${t("dino_battle.myAvatarLabel")}</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind3" id="myBehind3Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini my-hp-fill" id="myBehind3HpFill"></div></div>
                        <div class="battle-avatar my-avatar" id="myBehind3"></div>
                        <div class="battle-team-slot-name">${t("dino_battle.myAvatarLabel")}</div>
                      </div>
                    </div>
                    <div class="battle-formation-group" id="oppFormationGroup">
                      <div class="battle-team-slot battle-team-slot-avatar" id="oppAvatarSlot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini opp-hp-fill" id="oppHpFill"></div></div>
                        <div class="battle-avatar opp-avatar" id="oppAvatar"></div>
                        <div class="battle-team-slot-name">${t("dino_battle.oppAvatarLabel")}</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind1" id="oppBehind1Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini opp-hp-fill" id="oppBehind1HpFill"></div></div>
                        <div class="battle-avatar opp-avatar" id="oppBehind1"></div>
                        <div class="battle-team-slot-name">${t("dino_battle.oppAvatarLabel")}</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind2" id="oppBehind2Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini opp-hp-fill" id="oppBehind2HpFill"></div></div>
                        <div class="battle-avatar opp-avatar" id="oppBehind2"></div>
                        <div class="battle-team-slot-name">${t("dino_battle.oppAvatarLabel")}</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind3" id="oppBehind3Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini opp-hp-fill" id="oppBehind3HpFill"></div></div>
                        <div class="battle-avatar opp-avatar" id="oppBehind3"></div>
                        <div class="battle-team-slot-name">${t("dino_battle.oppAvatarLabel")}</div>
                      </div>
                    </div>
                </div>
              </div>

              <!-- 아바타로 표시 못 하는 나머지 공룡들(3마리 초과분)도 체력은 계속 추적되니 타일들
                   밑에 얇은 체력바로 따로 보여줌(사용자 확정) -->
              <div class="battle-overflow-row">
                <div class="battle-overflow-group my-overflow-group" id="myOverflowBars"></div>
                <div class="battle-overflow-group opp-overflow-group" id="oppOverflowBars"></div>
              </div>
            </div>

            <div class="battle-result" id="battleResult" style="display:none;"></div>
            <div class="battle-controls">
              <div class="custom-dropdown battle-speed-dropdown" id="battleSpeedDropdown">
                <div class="selected-value" id="battleSpeedSelectedValue">${t("dino_battle.speedNormal")}</div>
                <ul class="dropdown-list" id="battleSpeedList"></ul>
              </div>
              <button class="btn-simulate" id="battleStartBtn">${t("dino_battle.startBtn")}</button>
              <button class="battle-restart-btn" id="battleRestartBtn" disabled title="${t("dino_battle.restartTooltip")}">↻</button>
            </div>
          </div>

          <div class="battle-mode-panel" id="optimizeModeCard" style="display:none;">
            <div class="dummy-optimizer">
              <h3 class="dummy-optimizer-title">${t("dino_battle.optimize.title")}</h3>
              <p class="quickcalc-desc">${t("dino_battle.optimize.desc")}</p>

              <div class="battle-mode-tabs dino-optimize-submode-tabs" id="optimizeSubmodeTabs">
                <span class="battle-mode-indicator"></span>
                <button class="battle-mode-tab active" data-submode="modeA" id="optimizeSubmodeTabA"><span>${t("dino_battle.optimize.modeA.label")}</span></button>
                <button class="battle-mode-tab" data-submode="modeB" id="optimizeSubmodeTabB"><span>${t("dino_battle.optimize.modeB.label")}</span></button>
                <button class="battle-mode-tab" data-submode="modeC" id="optimizeSubmodeTabC"><span>${t("dino_battle.optimize.modeC.label")}</span></button>
              </div>
              <p class="quickcalc-desc" id="optimizeSubmodeDesc"></p>

              <div class="titan-owned-rune-header">
                <span class="titan-owned-rune-header-label">${t("dino_battle.optimize.ownedRuneHeaderLabel")}</span>
                <button type="button" class="titan-owned-rune-collapse-btn" id="dinoOwnedRuneCollapseBtn" aria-expanded="true" title="${t("dino_battle.optimize.collapseTooltip")}">
                  <span class="titan-owned-rune-collapse-icon">▲</span>
                </button>
              </div>
              <div class="dummy-owned-rune-grid" id="dinoOwnedRuneGrid"></div>

              <button class="btn-simulate" id="dinoOptimizeBtn">${t("dino_battle.optimize.startBtn")}</button>
              <div id="dinoOptimizeResult"></div>
            </div>
          </div>
        </div>

        <button class="battle-peek-btn opp-peek" id="oppPeekBtn" title="${t("dino_battle.oppPeekTooltip")}">◀</button>
      </div>

      <div class="battle-side-panel opp-side" id="oppSidePanel">
        <div id="oppDinoBattleSection"></div>
      </div>
    </div>
    <div class="battle-panel-overlay" id="battlePanelOverlay"></div>

    <div class="friend-picker-overlay" id="friendPickerOverlay" style="display:none;">
      <div class="friend-picker-modal">
        <div class="friend-picker-header">
          <span id="friendPickerTitle">${t("dino_battle.friendPicker.defaultTitle")}</span>
          <button class="close-btn" id="friendPickerClose">✕</button>
        </div>
        <div id="friendPickerList"></div>
      </div>
    </div>

    <div class="friend-picker-overlay" id="dinoOptimizeApplyPresetOverlay" style="display:none;">
      <div class="friend-picker-modal">
        <div class="friend-picker-header">
          <span>${t("dino_battle.optimize.applyPreset.modalTitle")}</span>
          <button class="close-btn" id="dinoOptimizeApplyPresetClose">✕</button>
        </div>
        <div class="arena-preset-row" id="dinoOptimizeApplyPresetList"></div>
        <button class="btn-apply" id="dinoOptimizeApplyPresetConfirmBtn" disabled>${t("dino_battle.optimize.applyPreset.confirmBtn")}</button>
      </div>
    </div>
  `;

  initDinoBattlePage();
}

// 모바일 PIP 슬라이드 패널 열기/닫기. renderOppPanel()(모듈 최상위 함수)이 헤더의 닫기 버튼에
// onClose로 넘겨야 해서 initDinoBattlePage 안 중첩 함수가 아니라 최상위로 둠 - 패널/오버레이
// 엘리먼트는 정적이라(재생성 안 됨) 그냥 그때그때 id로 찾아도 무방함.
function closeSidePanels() {
  document.getElementById("mySidePanel").classList.remove("open");
  document.getElementById("oppSidePanel").classList.remove("open");
  document.getElementById("battlePanelOverlay").classList.remove("open");
}
function openSidePanel(panel) {
  closeSidePanels();
  panel.classList.add("open");
  document.getElementById("battlePanelOverlay").classList.add("open");
}

// "내 공룡" 패널 렌더 - 조합 찾기의 "프리셋에 적용" 확정 시(dinoOptimizeConfirmApplyPreset)에도
// 저장한 프리셋을 즉시 반영하기 위해 같은 설정으로 다시 불러야 해서 이름 붙여 뽑아둠(타이탄
// 페이지의 titanRenderMyDinoSection과 같은 이유)
function renderMyDinoBattleSection() {
  renderMyDinoPage(document.getElementById("myDinoBattleSection"), {
    idPrefix: "myB_",
    storageKey: MY_DINO_PROFILE_KEY,
    unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: t("dino_battle.unsuitableRuneLabel"),
    header: { title: t("dino_battle.panelHeader.myDino"), titleId: "myPanelTitleText", closeId: "myPanelClose", onClose: closeSidePanels },
    onChange: (profile) => {
      resetBattleDisplay();
      if (isFriendSessionActive()) sendMyProfileUpdate(profile);
    }
  });
}

function initDinoBattlePage() {
  renderMyDinoBattleSection();
  // "상대 공룡" 자리는 지금 모드(일반 편집 / 스냅샷 / 실시간 세션 진행 중 재진입)에 맞게 그림
  renderOppPanel();

  initTileSettings();
  initSpeedDropdown();
  updateFriendLabels();

  document.getElementById("friendPickerClose").onclick = () => {
    document.getElementById("friendPickerOverlay").style.display = "none";
    unlockBodyScroll();
  };

  // 로그인 상태면 친구 초대/불러오기 버튼을 쓸 수 있게 내 uid/닉네임을 채움. 이 페이지는 uid도
  // 같이 필요해서(친구 초대 기능) getCurrentUser()를 직접 부르되, 그 결과로 얻은 닉네임을
  // js/ui/dino-display-ui.js의 공용 캐시에도 채워 넣어서 타이탄/건물 페이지와 공유(Supabase를
  // 또 조회하지 않고도 같은 값을 씀 - 사용자 확정 "로그인 하면 닉네임 보이는거... 통일시켜...
  // 하나 함수로")
  getCurrentUser().then((user) => {
    if (user && user.username) {
      myUserId = user.id;
      myNickname = user.username;
      setMyDisplayNameCache(user.username);
      renderOppPanelToolbar();
      updateFriendLabels();
    }
  });

  // 페이지를 다시 그릴 때마다(다른 탭 갔다 옴) 예전 구독을 정리하고 새로 구독. 세션 자체는
  // friend-session.js 쪽 모듈 스코프에 남아있어서 페이지를 오가도 끊기지 않음
  if (unsubscribeFriendSession) unsubscribeFriendSession();
  unsubscribeFriendSession = onFriendSessionChange(handleFriendSessionEvent);
  if (getActiveSession()) applyOppTileLock(true);

  const mySidePanel = document.getElementById("mySidePanel");
  const oppSidePanel = document.getElementById("oppSidePanel");
  const overlay = document.getElementById("battlePanelOverlay");
  document.getElementById("myPeekBtn").onclick = () => openSidePanel(mySidePanel);
  document.getElementById("oppPeekBtn").onclick = () => openSidePanel(oppSidePanel);
  // 닫기 버튼은 이제 renderMyDinoPage/renderOppPanel이 매번 새로 그리는 헤더 안에 있어서, 그
  // 렌더 함수들이 각자 wireDinoPanelHeader()로 매 렌더마다 다시 바인딩함(여기서 한 번만 붙이면
  // 재렌더 후 끊어짐) - 오버레이 클릭만 여기서 한 번 붙이면 됨(오버레이 자체는 재생성 안 되므로)
  overlay.onclick = closeSidePanels;

  document.getElementById("battleStartBtn").onclick = onBattleButtonClick;
  document.getElementById("battleRestartBtn").onclick = () => {
    // 처음 상태로 되돌리기만 하고 자동 재생하지는 않음 - "전투 시작"을 다시 눌러야 플레이됨
    if (battlePhase !== "idle") resetBattleDisplay();
  };
  document.getElementById("quickCalcBtn").onclick = startQuickCalc;
  initModeTabs();
  // 이 페이지는 타이탄/건물과 달리 "시뮬레이션" 탭이 처음부터 보이는 상태라(탭 뒤에 안 숨어있음 -
  // 실측 확인), 다른 페이지들처럼 탭 클릭을 기다리지 않고 페이지 로드 시점에 바로 마운트함
  dinoBattleInitScene3d();
  resetBattleDisplay();

  dinoBattleInitOwnedRuneGrid();
  dinoBattleInitOptimizeSubmodeTabs();
  dinoBattleUpdateSidePanelsVisibility();
  document.getElementById("dinoOwnedRuneCollapseBtn").onclick = () => {
    const grid = document.getElementById("dinoOwnedRuneGrid");
    const collapseBtn = document.getElementById("dinoOwnedRuneCollapseBtn");
    const collapsed = grid.classList.toggle("titan-owned-rune-grid-collapsed");
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    collapseBtn.querySelector(".titan-owned-rune-collapse-icon").textContent = collapsed ? "▼" : "▲";
  };
  document.getElementById("dinoOptimizeBtn").onclick = () => {
    if (dinoOptimizeSubmode === "modeA") dinoBattleRunModeA();
    else if (dinoOptimizeSubmode === "modeB") dinoBattleRunModeB();
    else dinoBattleRunModeC();
  };
  document.getElementById("dinoOptimizeApplyPresetClose").onclick = dinoOptimizeCloseApplyPresetModal;
  document.getElementById("dinoOptimizeApplyPresetConfirmBtn").onclick = dinoOptimizeConfirmApplyPreset;
  enableDragScroll(document.getElementById("dinoOptimizeApplyPresetList"));
}

// 전투 설정/빠른 계산/시뮬레이션 3개 탭 전환 - 허수아비 페이지(dummyInitModeTabs)와 같은
// 배열 기반 공용 패턴(js/pages/dummy-page.js 참고)
const DINO_BATTLE_MODES = [
  { mode: "settings", tabId: "modeTabSettings", cardId: "settingsModeCard" },
  { mode: "quick", tabId: "modeTabQuick", cardId: "quickModeCard" },
  { mode: "live", tabId: "modeTabLive", cardId: "liveModeCard" },
  { mode: "optimize", tabId: "modeTabOptimize", cardId: "optimizeModeCard" }
];

// 친구 기능 4단계: 화면을 강제로 맞추지 않고(사용자 지적 - "내가 보고 싶은 페이지를 못 보게
// 되고 방해받을 수 있다"), 대신 각자 지금 보고 있는 탭 버튼 위에 닉네임 첫 글자 배지를 띄워서
// "누가 어느 탭에 있는지"만 알 수 있게 함. 내 배지는 탭 글자 왼쪽, 상대 배지는 오른쪽.
let currentDinoBattleMode = "live"; // battleModeTabs 템플릿의 기본 active 탭과 일치시켜둠

function updatePresenceBadges() {
  const myBadge = document.getElementById("dinoBattleMyPresenceBadge");
  const friendBadge = document.getElementById("dinoBattleFriendPresenceBadge");
  if (!myBadge || !friendBadge) return;
  const session = getActiveSession();
  if (!session || session.status !== "active") {
    myBadge.style.display = "none";
    friendBadge.style.display = "none";
    return;
  }

  const myTarget = DINO_BATTLE_MODES.find((m) => m.mode === currentDinoBattleMode);
  if (myTarget) {
    const btn = document.getElementById(myTarget.tabId);
    if (btn && myBadge.parentElement !== btn) btn.insertBefore(myBadge, btn.firstChild);
    myBadge.textContent = Array.from(session.myNickname || "?")[0];
    myBadge.style.display = "inline-flex";
  }

  if (session.friendPage === "dino_battle" && session.friendMode) {
    const friendTarget = DINO_BATTLE_MODES.find((m) => m.mode === session.friendMode);
    if (friendTarget) {
      const btn = document.getElementById(friendTarget.tabId);
      if (btn && friendBadge.parentElement !== btn) btn.appendChild(friendBadge);
      friendBadge.textContent = Array.from(session.friendNickname || "?")[0];
      friendBadge.style.display = "inline-flex";
      return;
    }
  }
  friendBadge.style.display = "none";
}

function initModeTabs() {
  const tabsEl = document.getElementById("battleModeTabs");

  DINO_BATTLE_MODES.forEach((m) => {
    document.getElementById(m.tabId).onclick = () => {
      DINO_BATTLE_MODES.forEach((other) => {
        document.getElementById(other.tabId).classList.toggle("active", other.mode === m.mode);
        document.getElementById(other.cardId).style.display = other.mode === m.mode ? "block" : "none";
        tabsEl.classList.toggle(`mode-${other.mode}`, other.mode === m.mode);
      });
      // "live" 탭이 숨겨져 있던 동안(다른 탭 보는 중) 레이아웃이 흔들렸을 수 있어서(예: 빠른
      // 계산 결과 패널이 늘렸다 줄었다 하며 생기는 리플로우), 다시 보일 때마다 타이탄 페이지와
      // 동일하게 Three.js 장면 크기를 동기적으로 강제 재계산함 - ResizeObserver 하나에만
      // 의존하면 타이밍이 어긋나 앞장 공룡이 아주 작게(또는 안 보이게) 렌더링되는 버그가 있었음
      // (사용자 제보). 이미 캔버스가 있으면 dinoBattleInitScene3d()가 내부적으로 .resize()로
      // 단락되므로 저렴함.
      if (m.mode === "live") dinoBattleInitScene3d();
      dinoBattleUpdateSidePanelsVisibility();

      currentDinoBattleMode = m.mode;
      updatePresenceBadges();
      if (isFriendSessionActive()) sendTabChange("dino_battle", m.mode);
    };
  });
}

// ===== 룬 조합 찾기 =====
// 모드 A(일반 튜닝) - 상대 미지정, 보유 룬으로 만들 수 있는 조합끼리 서로 라운드로빈(양쪽 다 내
// 기본 스탯 그대로, 룬 구성만 다름) - "내 후보들 사이의 상대적 우열"만 알려줌.
// 모드 B(상대 맞춤 카운터 찾기) - 이미 있는 "상대 공룡" 프로필(DINO_BATTLE_OPPONENT_KEY, 실시간
// 세션/스냅샷 포함)을 고정 타겟으로 삼아, 내 후보 각각을 그 상대 하나에게만 붙여봄. 상대가
// 고정이라 O(후보) - 모드 A(O(후보²))보다 훨씬 싸서 그만큼 더 정밀하게 볼 수 있음.
// 두 모드 다 타이탄 조합 찾기(titan-page.js)와 같은 "애널리틱 예비 추림 -> 저비용 스크리닝 ->
// 통계적으로 애매한 후보만 고비용 정밀검증" 구조를 재사용함 - 특히 통계적 동률 판정
// (dinoBattleRateStatisticallyTied)은 titanDeathCountsStatisticallyTied와 완전히 같은 공식.

function dinoBattleSuitableRuneNames() {
  return standardSuitableRuneNames(DINO_BATTLE_UNSUITABLE_RUNE_LIST, DINO_BATTLE_GRADE_ORDER);
}

function loadDinoBattleOwnedLevels() {
  return loadOwnedRuneLevels(DINO_BATTLE_OWNED_LEVELS_KEY, dinoBattleSuitableRuneNames());
}

function saveDinoBattleOwnedLevels(levels) {
  localStorage.setItem(DINO_BATTLE_OWNED_LEVELS_KEY, JSON.stringify(levels));
}

function dinoBattleInitOwnedRuneGrid() {
  initOwnedRuneGrid({
    gridId: "dinoOwnedRuneGrid",
    resultElId: "dinoOptimizeResult",
    suitableNames: dinoBattleSuitableRuneNames,
    loadLevels: loadDinoBattleOwnedLevels,
    saveLevels: saveDinoBattleOwnedLevels
  });
}

// k개를 고르는 모든 조합(순서 무관) - 조합을 만드는 도중에 MUTUALLY_EXCLUSIVE_RUNE_PAIRS(예:
// 매머드의 힘/압축된 힘)를 위반하는 가지는 애초에 만들지 않고 잘라냄. 완성된 5슬롯에서 사후에
// 하나를 null로 지우는 sanitizeRuneConflicts(js/data/rune-data.js)를 여기서 재사용하면 5룬
// 조합이 조용히 4룬으로 축소되고 서로 다른 두 조합이 같은 결과로 뭉개지므로 새로 작성함
function dinoBattleCombinations(arr, k) {
  const results = [];
  function conflicts(name, combo) {
    return MUTUALLY_EXCLUSIVE_RUNE_PAIRS.some(([a, b]) => {
      if (name === a) return combo.includes(b);
      if (name === b) return combo.includes(a);
      return false;
    });
  }
  function pick(start, combo) {
    if (combo.length === k) { results.push(combo.slice()); return; }
    for (let i = start; i < arr.length; i++) {
      if (conflicts(arr[i], combo)) continue;
      combo.push(arr[i]);
      pick(i + 1, combo);
      combo.pop();
    }
  }
  pick(0, []);
  return results;
}

// 두 후보의 관측된 승수(count, 표본수 n)가 통계적으로 구분 안 되는 동률인지 판정 - 타이탄 조합
// 찾기(titanDeathCountsStatisticallyTied, titan-page.js)와 완전히 같은 이항분포 공식을 승률에
// 적용: "두 후보의 진짜 승률이 같다"는 가정 하에 합산 승수 중 A가 차지할 비율은 노출 비율
// (nA/(nA+nB))을 따르는 이항분포이므로, 실제 관측치가 그 기댓값의 ±2표준편차 안이면 동률로 취급
function dinoBattleRateStatisticallyTied(countA, nA, countB, nB) {
  const total = countA + countB;
  if (total === 0) return true;
  const p = nA / (nA + nB);
  const sd = Math.sqrt(total * p * (1 - p));
  return Math.abs(countA - total * p) < 2 * sd;
}

// 상위 topN 안에 들거나, 지금까지의 1위(leader)와 통계적으로 동률인 후보만 다음 단계로 승급 -
// 단순 top-K 자르기와 달리 "표본 노이즈로 근소하게 밀린 진짜 좋은 조합"이 억울하게 탈락하지 않게 함
function dinoBattleSelectContenders(results, topN) {
  const sorted = [...results].sort((a, b) => b.winRate - a.winRate);
  const leader = sorted[0];
  const topSet = new Set(sorted.slice(0, topN));
  return results.filter((r) => topSet.has(r) || dinoBattleRateStatisticallyTied(r.wins, r.n, leader.wins, leader.n));
}

// 상대 프로필이 기본값(안 건드린 상태)인지 - my-dino-page.js가 "바뀐 값"을 강조 표시할 때 쓰는
// 기준(기본 공격력 1/체력 10, 룬 미장착)과 동일한 휴리스틱. getOppBattleInputs()로 판정해서
// 세션/스냅샷/로컬 프로필 세 갈래를 한 번에 커버함 - 모드 B는 상대를 실제로 설정했을 때만 의미가 있음
function dinoBattleOpponentIsConfigured() {
  const inputs = getOppBattleInputs();
  return inputs.baseAtk !== 1 || inputs.baseHp !== 10 || inputs.selectedRunes.some((r) => r);
}

// "내 공룡" 프로필이 기본값인지 - 위와 완전히 같은 기준. 모드 A/B 둘 다 후보 조합의 베이스로
// getSideInputs(MY_DINO_PROFILE_KEY)를 그대로 쓰므로, 이게 기본값(공격력1/체력10)인 채로
// 돌리면 실전에서 거의 안 나오는 극단적으로 낮은 스탯끼리 붙어서 200회 강제동사가 남발되고
// (모든 매치업이 무승부로 수렴, 실측 확인 - 5마리×200회=정확히 1000턴) 계산도 훨씬 느려짐 -
// 상대 미설정 때와 같은 이유로 두 모드 다 막아야 함
function dinoBattleMyProfileIsConfigured() {
  const inputs = getSideInputs(MY_DINO_PROFILE_KEY);
  return inputs.baseAtk !== 1 || inputs.baseHp !== 10 || inputs.selectedRunes.some((r) => r);
}

// 시뮬레이션 없이 즉시 계산하는 순수 화력×맷집 점수(getBattleStats + computeExpectedDpsFromCrit,
// js/core/stat-calc.js) - 낙뢰/메테오/흡혈/방어벽 같은 확률형·스킬 효과는 반영하지 않는 거친
// 근사치라, 최종 순위가 아니라 "라운드로빈/실제 시뮬레이션을 돌리기 전 후보 숏리스트를 추리는"
// 용도로만 씀(실제 전투처럼 급격히 갈리는 결과를 애널리틱 승률로 흉내내려 하지 않음)
function dinoBattleAnalyticPowerScore(pick, levels, baseProfile) {
  const stats = getBattleStats({ ...baseProfile, selectedRunes: pick.map((name) => ({ name, lv: levels[name] })) });
  return computeExpectedDpsFromCrit(stats.fAtk, stats.cRate, stats.cDmg) * stats.fHp;
}

function dinoBattleMakeCandidateProfile(baseProfile, pick, levels) {
  return { ...baseProfile, selectedRunes: pick.map((name) => ({ name, lv: levels[name] })) };
}

// dinoCount를 인위적으로 크게 잡은 "연속 교체전" 하나를 실행해서, 그 안에서 일어난 개별 매치업의
// 승패를 집계함 - runDinoBattleSimulation은 이미 이긴 쪽 생존 개체가 체력을 그대로 들고 다음
// 상대(교체된 새 공룡, 풀피)와 계속 싸우는 걸 그대로 구현하고 있어서(makeDinoSide/processFrontDeath
// 참고) 엔진 자체는 손 안 댐 - 그 결과(myFinalCount/oppFinalCount)만 가지고 "상대 로스터 중 몇
// 마리를 죽였는지" = 매치업 승수로 환산함. 배틀이 무승부(양쪽 동시 전멸 등 극히 드문 경우)로
// 끝나도 그 시점까지 실제로 몇 마리씩 죽었는지는 정확하므로 그대로 안전하게 씀.
function dinoBattleMatchupTrial({ my, opp, tileSettings, dinoCount }) {
  const r = runDinoBattleSimulation({
    my: { ...my, count: dinoCount },
    opp: { ...opp, count: dinoCount },
    tileSettings,
    collectLog: false
  });
  const myWins = dinoCount - r.oppFinalCount; // 상대 로스터 중 내가 죽인 수
  const oppWins = dinoCount - r.myFinalCount; // 내 로스터 중 상대가 죽인 수
  return { myWins, oppWins, n: myWins + oppWins, winner: r.winner, turns: r.turns };
}

// 후보끼리(picks) 서로 라운드로빈 - 모드 A/B 공용. yieldEvery는 dinoCount가 클수록(한 쌍에 걸리는
// 시간이 길수록) 자주 양보해야 UI가 안 멈춘 것처럼 느껴짐(스크리닝은 20쌍마다, 정밀검증은 5쌍마다).
async function dinoBattleRoundRobin(picks, baseProfile, levels, tileSettings, dinoCount, yieldEvery, onProgress) {
  const n = picks.length;
  const wins = new Array(n).fill(0);
  const games = new Array(n).fill(0);
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  for (let p = 0; p < pairs.length; p++) {
    const [i, j] = pairs[p];
    const profileI = dinoBattleMakeCandidateProfile(baseProfile, picks[i], levels);
    const profileJ = dinoBattleMakeCandidateProfile(baseProfile, picks[j], levels);
    // 양방향 다 돌림 - my/opp 역할 자체에 비대칭이 없는지 매번 새로 보장하지 않고(예: 진영별
    // 버프 타워 레벨이 다르게 설정돼 있을 수 있음) 방향을 바꿔가며 상쇄시킴
    const r1 = dinoBattleMatchupTrial({ my: profileI, opp: profileJ, tileSettings, dinoCount });
    wins[i] += r1.myWins; wins[j] += r1.oppWins; games[i] += r1.n; games[j] += r1.n;
    const r2 = dinoBattleMatchupTrial({ my: profileJ, opp: profileI, tileSettings, dinoCount });
    wins[j] += r2.myWins; wins[i] += r2.oppWins; games[i] += r2.n; games[j] += r2.n;
    if ((p + 1) % yieldEvery === 0 || p === pairs.length - 1) {
      onProgress(p + 1, pairs.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return picks.map((pick, i) => ({ pick, wins: wins[i], n: games[i], winRate: games[i] > 0 ? wins[i] / games[i] : 0 }));
}

// 모드 C(상대 지정) 전용 - 상대가 고정이라 라운드로빈이 아니라 후보 각각을 그 상대 한 명에게만 붙임
async function dinoBattleEvalAgainstOpp(picks, baseProfile, levels, opp, tileSettings, dinoCount, yieldEvery, onProgress) {
  const out = [];
  for (let i = 0; i < picks.length; i++) {
    const profile = dinoBattleMakeCandidateProfile(baseProfile, picks[i], levels);
    const r = dinoBattleMatchupTrial({ my: profile, opp, tileSettings, dinoCount });
    out.push({ pick: picks[i], wins: r.myWins, n: r.n, winRate: r.n > 0 ? r.myWins / r.n : 0 });
    if ((i + 1) % yieldEvery === 0 || i === picks.length - 1) {
      onProgress(i + 1, picks.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return out;
}

// 모드 C 잠금(상대 미설정) + 시작 버튼 잠금(내 공룡 미설정, 세 모드 다 필요)을 한 번에 갱신 -
// 예전엔 모드 C(당시 모드 B) 잠금만 했는데, "내 공룡" 미설정 상태로 돌리면 극단적으로 느려지는
// 문제가 실측으로 확인돼서(사용자 확정) 시작 버튼 잠금을 추가함
function dinoBattleRefreshOptimizeModeCLock() {
  const tabC = document.getElementById("optimizeSubmodeTabC");
  if (!tabC) return; // 조합 찾기 탭 DOM이 아직 없는 시점(초기 렌더 전) 방어
  const locked = !dinoBattleOpponentIsConfigured();
  tabC.classList.toggle("dropdown-locked", locked);
  // 모드 C가 선택된 상태에서 상대 설정이 지워졌다면(세션 종료 등) 모드 A로 되돌림
  if (locked && dinoOptimizeSubmode === "modeC") document.getElementById("optimizeSubmodeTabA").click();

  const startBtn = document.getElementById("dinoOptimizeBtn");
  if (startBtn) startBtn.classList.toggle("dropdown-locked", !dinoBattleMyProfileIsConfigured());
}

// 좌우 "내 공룡"/"상대 공룡" 패널은 조합 찾기 탭의 모드 A/B(상대 불필요, 내 후보끼리 라운드로빈)에서는
// 안 보이게 하고, 모드 C(상대 맞춤, 상대 프로필을 직접 설정해야 함)와 다른 탭(설정/빠른계산/
// 시뮬레이션 - 전부 상대가 필요함)에서는 그대로 보이게 함(사용자 확정 취지 유지)
function dinoBattleUpdateSidePanelsVisibility() {
  const onOptimizeTab = document.getElementById("modeTabOptimize").classList.contains("active");
  const hide = onOptimizeTab && (dinoOptimizeSubmode === "modeA" || dinoOptimizeSubmode === "modeB");
  document.getElementById("mySidePanel").style.display = hide ? "none" : "";
  document.getElementById("oppSidePanel").style.display = hide ? "none" : "";
  document.getElementById("myPeekBtn").style.display = hide ? "none" : "";
  document.getElementById("oppPeekBtn").style.display = hide ? "none" : "";
}

function dinoBattleInitOptimizeSubmodeTabs() {
  const tabsEl = document.getElementById("optimizeSubmodeTabs");
  const descEl = document.getElementById("optimizeSubmodeDesc");
  const submodes = [
    { key: "modeA", tabId: "optimizeSubmodeTabA", descKey: "dino_battle.optimize.modeA.desc" },
    { key: "modeB", tabId: "optimizeSubmodeTabB", descKey: "dino_battle.optimize.modeB.desc" },
    { key: "modeC", tabId: "optimizeSubmodeTabC", descKey: "dino_battle.optimize.modeC.desc" }
  ];
  submodes.forEach((s) => {
    document.getElementById(s.tabId).onclick = () => {
      if (s.key === "modeC" && !dinoBattleOpponentIsConfigured()) return; // dropdown-locked가 클릭을 이미 막지만 방어적으로 재확인
      dinoOptimizeSubmode = s.key;
      submodes.forEach((other) => {
        document.getElementById(other.tabId).classList.toggle("active", other.key === s.key);
        tabsEl.classList.toggle(`mode-${other.key}`, other.key === s.key);
      });
      descEl.textContent = t(s.descKey);
      document.getElementById("dinoOptimizeResult").innerHTML = "";
      dinoBattleUpdateSidePanelsVisibility();
    };
  });
  descEl.textContent = t("dino_battle.optimize.modeA.desc");
  dinoBattleRefreshOptimizeModeCLock();
}

// 모드 A(보유 룬 전체)/모드 B(에픽 이상만) 공용 실행부 - gradeFilter가 있으면 후보 풀을 그 등급들로
// 좁힘. 둘 다 "상대 미지정, 내 후보끼리 서로 라운드로빈"이라 로직은 완전히 같고 후보 풀만 다름.
async function dinoBattleRunModeAOrB(gradeFilter) {
  // 상대/내 공룡 입력칸(기본 스탯·별자리 등)은 onblur에만 저장되므로(my-dino-page.js), 방금
  // 입력하고 포커스가 그 칸에 남은 채로 바로 이 버튼을 눌렀다면 blur를 강제로 먼저 발생시켜
  // 저장을 커밋한 뒤에 읽어야 함(버그: 편집한 스탯이 반영 안 된 것처럼 보이는 문제 수정)
  document.activeElement.blur();
  const btn = document.getElementById("dinoOptimizeBtn");
  const resultEl = document.getElementById("dinoOptimizeResult");
  // .dropdown-locked가 클릭을 이미 막지만(dinoBattleRefreshOptimizeModeCLock), 방어적으로 재확인 -
  // 미설정 상태(기본 공격력1/체력10)로 돌리면 극단적으로 느려짐(실측 확인)
  if (!dinoBattleMyProfileIsConfigured()) {
    resultEl.innerHTML = `<p class="quickcalc-desc">${t("dino_battle.optimize.needMyProfileMsg")}</p>`;
    return;
  }
  const levels = loadDinoBattleOwnedLevels();
  let owned = dinoBattleSuitableRuneNames().filter((name) => levels[name] > 0);
  if (gradeFilter) owned = owned.filter((name) => gradeFilter.includes(RUNES_DATA[name].grade));
  if (owned.length === 0) {
    resultEl.innerHTML = `<p class="quickcalc-desc">${t(gradeFilter ? "dino_battle.optimize.needLevelsModeBMsg" : "dino_battle.optimize.needLevelsMsg")}</p>`;
    return;
  }
  const slotCount = Math.min(5, owned.length);
  let combos = dinoBattleCombinations(owned, slotCount);
  const baseProfile = getSideInputs(MY_DINO_PROFILE_KEY);
  const tileSettings = getEffectiveTileSettings();

  // 조합 찾기(1·2단계 라운드로빈)는 청크마다 await로 이벤트 루프에 양보하는 긴 비동기 작업이라,
  // 그동안 다른 페이지로 이동하면(SPA 라우터는 teardown 없이 #app만 새로 그림) 이 체인이 끝난 뒤
  // 이미 사라진 #dinoOptimizeResult를 document.getElementById로 다시 찾다가 null을 만나 콘솔
  // 에러가 남(사이트 전체 점검에서 발견) - 실시간 전투 재생에 이미 쓰던 battleToken(다른 페이지로
  // 이동하면 hashchange 리스너가 증가시킴) 패턴을 그대로 재사용해 각 단계 이후 무효화됐는지 확인
  const token = battleToken;

  btn.disabled = true;
  btn.classList.add("btn-progress");
  btn.style.setProperty("--progress", "0");
  resultEl.innerHTML = "";

  if (combos.length > DINO_BATTLE_MODE_AB_SHORTLIST_SIZE) {
    combos = combos
      .map((pick) => ({ pick, score: dinoBattleAnalyticPowerScore(pick, levels, baseProfile) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DINO_BATTLE_MODE_AB_SHORTLIST_SIZE)
      .map((c) => c.pick);
  }

  const onProgress = (progressBase, progressSpan) => (current, total) => {
    btn.textContent = t("dino_battle.optimize.roundRobinProgress", { current, total });
    btn.style.setProperty("--progress", String(progressBase + (current / total) * progressSpan));
  };

  const stage1 = await dinoBattleRoundRobin(combos, baseProfile, levels, tileSettings, DINO_BATTLE_SCREEN_DINO_COUNT, 20, onProgress(0, 40));
  if (token !== battleToken) return; // 기다리는 동안 다른 페이지로 이동함 - 이미 사라진 DOM은 안 건드림
  const contenders = dinoBattleSelectContenders(stage1, DINO_BATTLE_OPTIMIZER_VERIFY_TOP_N).map((r) => r.pick);
  const stage2 = await dinoBattleRoundRobin(contenders, baseProfile, levels, tileSettings, DINO_BATTLE_VERIFY_DINO_COUNT, 5, onProgress(40, 60));
  if (token !== battleToken) return;
  const ranked = stage2.sort((a, b) => b.winRate - a.winRate);

  btn.disabled = false;
  btn.textContent = t("dino_battle.optimize.startBtn");
  btn.classList.remove("btn-progress");
  btn.style.removeProperty("--progress");

  dinoBattleRenderOptimizeResults(ranked, { slotCount, ownedCount: owned.length, levels, showOppMetrics: false });
}

function dinoBattleRunModeA() {
  return dinoBattleRunModeAOrB(null);
}

function dinoBattleRunModeB() {
  return dinoBattleRunModeAOrB(["에픽", "유니크", "전설"]);
}

// 모드 C(상대 지정) - 이미 있는 "상대 공룡" 프로필을 고정 타겟으로 삼아, 내 후보 각각을 그 상대
// 하나에게만 붙여봄
async function dinoBattleRunModeC() {
  // startQuickCalc/startBattle과 같은 이유(onblur 저장 커밋 없이 바로 클릭되는 경우 방지)
  document.activeElement.blur();
  const btn = document.getElementById("dinoOptimizeBtn");
  const resultEl = document.getElementById("dinoOptimizeResult");
  if (!dinoBattleMyProfileIsConfigured()) {
    resultEl.innerHTML = `<p class="quickcalc-desc">${t("dino_battle.optimize.needMyProfileMsg")}</p>`;
    return;
  }
  if (!dinoBattleOpponentIsConfigured()) {
    resultEl.innerHTML = `<p class="quickcalc-desc">${t("dino_battle.optimize.modeC.needOpponentMsg")}</p>`;
    return;
  }
  const levels = loadDinoBattleOwnedLevels();
  const owned = dinoBattleSuitableRuneNames().filter((name) => levels[name] > 0);
  if (owned.length === 0) {
    resultEl.innerHTML = `<p class="quickcalc-desc">${t("dino_battle.optimize.needLevelsMsg")}</p>`;
    return;
  }
  const slotCount = Math.min(5, owned.length);
  let combos = dinoBattleCombinations(owned, slotCount);
  const baseProfile = getSideInputs(MY_DINO_PROFILE_KEY);
  const opp = getOppBattleInputs();
  const tileSettings = getEffectiveTileSettings();

  // 모드 A/B와 같은 이유로 battleToken을 재사용해 페이지 이동 중 무효화를 감지함(위 dinoBattleRunModeAOrB 참고)
  const token = battleToken;

  btn.disabled = true;
  btn.classList.add("btn-progress");
  btn.style.setProperty("--progress", "0");
  resultEl.innerHTML = "";

  if (combos.length > DINO_BATTLE_MODE_C_ANALYTIC_POOL) {
    combos = combos
      .map((pick) => ({ pick, score: dinoBattleAnalyticPowerScore(pick, levels, baseProfile) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DINO_BATTLE_MODE_C_ANALYTIC_POOL)
      .map((c) => c.pick);
  }

  const onProgress = (progressBase, progressSpan) => (current, total) => {
    btn.textContent = t("dino_battle.optimize.modeCProgress", { current, total });
    btn.style.setProperty("--progress", String(progressBase + (current / total) * progressSpan));
  };

  const stage1 = await dinoBattleEvalAgainstOpp(combos, baseProfile, levels, opp, tileSettings, DINO_BATTLE_SCREEN_DINO_COUNT, 20, onProgress(0, 40));
  if (token !== battleToken) return;
  const contenderPicks = dinoBattleSelectContenders(stage1, DINO_BATTLE_OPTIMIZER_VERIFY_TOP_N).map((r) => r.pick);
  const stage2 = await dinoBattleEvalAgainstOpp(contenderPicks, baseProfile, levels, opp, tileSettings, DINO_BATTLE_VERIFY_DINO_COUNT, 5, onProgress(40, 60));
  if (token !== battleToken) return;
  const ranked = stage2.sort((a, b) => b.winRate - a.winRate);

  btn.disabled = false;
  btn.textContent = t("dino_battle.optimize.startBtn");
  btn.classList.remove("btn-progress");
  btn.style.removeProperty("--progress");

  dinoBattleRenderOptimizeResults(ranked, { slotCount, ownedCount: owned.length, levels, showOppMetrics: true });
}

function dinoBattleRenderOptimizeResults(ranked, opts) {
  const resultEl = document.getElementById("dinoOptimizeResult");
  const { slotCount, ownedCount, levels, showOppMetrics } = opts;
  if (ranked.length === 0) {
    resultEl.innerHTML = `<p class="quickcalc-desc">${t("dino_battle.optimize.noResultMsg")}</p>`;
    return;
  }
  const best = ranked[0];
  const comboLine = (pick) => pick.map((n) => `${ruleDisplayName(n)} Lv.${levels[n]}`).join(" · ");
  const fmtPct = (x) => `${(x * 100).toFixed(1)}%`;

  // 상대와의 스탯 격차가 너무 크면 룬 조합 차이가 결과에 거의 안 드러남 - 모드 A/B는 항상 같은
  // 기본 스탯끼리 붙어서 구조적으로 해당 없으므로 showOppMetrics(모드 C)일 때만 검사함. "매치업
  // 승률"은 배틀 전체 승패와 달리 약간의 우위로 쉽게 포화되는 지표가 아니라서(이 세션 라운드로빈
  // 연구 실측 범위가 쭉 40~60%대) 극단값 자체가 격차가 크다는 신뢰할 수 있는 신호임
  // (DINO_BATTLE_LOPSIDED_WINRATE_THRESHOLD 정의부 참고)
  const warningHtml = (showOppMetrics && (best.winRate >= DINO_BATTLE_LOPSIDED_WINRATE_THRESHOLD || best.winRate <= 1 - DINO_BATTLE_LOPSIDED_WINRATE_THRESHOLD))
    ? `<div class="warning">${t("dino_battle.optimize.lopsidedWarning")}</div>`
    : "";

  const statTiles = `
      <div class="report-tile"><div class="metric-label">${t("dino_battle.optimize.winRateLabel")}</div><div class="metric-value accent">${fmtPct(best.winRate)}</div></div>
    `;

  resultEl.innerHTML = `
    ${slotCount < 5 ? `<p class="quickcalc-desc">${t("dino_battle.optimize.limitedSlotMsg", { count: ownedCount, slotCount })}</p>` : ""}
    ${warningHtml}
    <div class="dummy-optimize-result-box">
      <div class="report-grid">
        <div class="report-tile dummy-optimize-best-tile">
          <div class="metric-label">${t("dino_battle.optimize.bestComboLabel")}</div>
          <div class="dummy-optimize-best-combo" title="${t("dino_battle.optimize.comboClickTooltip")}">${comboLine(best.pick)}</div>
        </div>
        ${statTiles}
      </div>
    </div>
    ${ranked.length > 1 ? `
      <div class="dummy-optimize-runner-ups">
        ${ranked.slice(1, 15).map((r, i) => `<div class="dummy-optimize-runner-up">${t("dino_battle.optimize.runnerUpLineA", { rank: i + 2, names: r.pick.map(ruleDisplayName).join(", "), winRate: (r.winRate * 100).toFixed(1) })}</div>`).join("")}
      </div>
    ` : ""}
  `;

  resultEl.querySelector(".dummy-optimize-best-combo").onclick = () => {
    dinoOptimizeOpenApplyPresetModal(best.pick.map((name) => ({ name, lv: levels[name] })));
  };
}

function dinoOptimizeOpenApplyPresetModal(runes) {
  dinoOptimizeApplyPresetPendingRunes = runes;
  dinoOptimizeApplyPresetSelectedIdx = null;
  dinoOptimizeRenderApplyPresetList();
  document.getElementById("dinoOptimizeApplyPresetConfirmBtn").disabled = true;
  document.getElementById("dinoOptimizeApplyPresetOverlay").style.display = "flex";
  lockBodyScroll();
}

function dinoOptimizeRenderApplyPresetList() {
  const row = document.getElementById("dinoOptimizeApplyPresetList");
  const profile = loadMyDinoProfile();
  row.innerHTML = "";
  profile.runePresets.forEach((preset, idx) => {
    const btn = document.createElement("div");
    btn.className = "arena-preset-btn" + (idx === dinoOptimizeApplyPresetSelectedIdx ? " active" : "");
    btn.textContent = runePresetDisplayName(preset, idx);
    btn.onclick = () => {
      dinoOptimizeApplyPresetSelectedIdx = idx;
      dinoOptimizeRenderApplyPresetList();
      document.getElementById("dinoOptimizeApplyPresetConfirmBtn").disabled = false;
    };
    row.appendChild(btn);
  });
}

function dinoOptimizeCloseApplyPresetModal() {
  document.getElementById("dinoOptimizeApplyPresetOverlay").style.display = "none";
  dinoOptimizeApplyPresetPendingRunes = null;
  dinoOptimizeApplyPresetSelectedIdx = null;
  unlockBodyScroll();
}

function dinoOptimizeConfirmApplyPreset() {
  if (dinoOptimizeApplyPresetSelectedIdx === null || !dinoOptimizeApplyPresetPendingRunes) return;
  const idx = dinoOptimizeApplyPresetSelectedIdx;
  const runes = dinoOptimizeApplyPresetPendingRunes.map((r) => ({ ...r }));
  const profile = loadMyDinoProfile();
  profile.runePresets[idx].runes = runes;
  profile.activePresetIndex = idx;
  profile.runes = runes.map((r) => ({ ...r }));
  saveMyDinoProfile(profile);
  const presetName = runePresetDisplayName(profile.runePresets[idx], idx);
  dinoOptimizeCloseApplyPresetModal();
  renderMyDinoBattleSection();
  resetBattleDisplay();
  showToast(t("dino_battle.optimize.applyPreset.toastAppliedTo", { presetName }));
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
  // 상대/내 공룡 기본 스탯·별자리 입력칸은 onblur에만 저장됨(my-dino-page.js) - 방금 입력하고
  // 포커스가 그 칸에 남은 채로 바로 이 버튼을 눌렀다면 blur를 강제로 먼저 발생시켜 저장을
  // 커밋한 뒤에 읽어야 함(사용자 제보 버그: 편집한 상대 스탯이 반영 안 된 것처럼 보이는 문제)
  document.activeElement.blur();
  // 10,000회 통계 평균이라 시드로 고정할 이유가 없음(시드는 실전 대전 전용) - 타일 설정만
  // 세션 중이면 공유값으로 맞춰서 계산
  const tileSettings = getEffectiveTileSettings();
  const btn = document.getElementById("quickCalcBtn");
  btn.disabled = true;
  btn.innerText = t("dino_battle.quick.calcBtnBusy");

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

    document.getElementById("qcRatio").innerText = t("dino_battle.quick.ratioText", { myDeaths, oppDeaths });
    const normRatio = formatNormalizedRatio(myDeaths, oppDeaths);
    document.getElementById("qcRatioNorm").innerText = normRatio ? t("dino_battle.quick.exchangeRatioText", { ratio: normRatio }) : "";
    document.getElementById("qcMyDmg").innerText = Math.round(result.avgMyDmgPerHit).toLocaleString();
    document.getElementById("qcOppDmg").innerText = Math.round(result.avgOppDmgPerHit).toLocaleString();

    // "실전 대전"에서 VIP 최대치를 넘는 나쁜 교환비가 나오면 몇 마리를 못 채워서 결과를 못 보고
    // 끝나기 쉬움 - 실제 전투 로직은 안 건드리고, 이미 나온 사망비를 근거로 산수로만 계산
    // (상대 N마리를 전멸시키는 데 내가 최소 몇 마리 필요한지)
    let neededText;
    if (oppDeaths === 0) neededText = t("dino_battle.quick.neededImpossible");
    else if (myDeaths === 0) neededText = t("dino_battle.quick.neededOne");
    else neededText = t("dino_battle.quick.neededCountValue", { count: Math.ceil((myDeaths * oppInputs.count) / oppDeaths).toLocaleString() });
    document.getElementById("qcNeededCount").innerText = neededText;
    document.getElementById("qcNeededCountBase").innerText = t("dino_battle.quick.neededCountBase", { count: oppInputs.count });

    document.getElementById("quickCalcResult").style.display = "grid";

    btn.disabled = false;
    btn.innerText = t("dino_battle.quick.calcBtn", { trials: QUICK_CALC_TRIALS.toLocaleString() });
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
  selectedValue.textContent = sharedOptionLabel(BATTLE_SPEED_OPTIONS.find((o) => o.ms === currentMs).label);

  BATTLE_SPEED_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      localStorage.setItem(DINO_BATTLE_SPEED_KEY, String(opt.ms));
      selectedValue.textContent = sharedOptionLabel(opt.label);
      list.style.display = "none";
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
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
  tribeSelectedValue.textContent = t(TRIBE_LABEL_KEYS[settings.tribeControl]);

  Object.keys(TRIBE_LABEL_KEYS).forEach((key) => {
    const li = document.createElement("li");
    li.textContent = t(TRIBE_LABEL_KEYS[key]);
    li.onclick = () => {
      settings.tribeControl = key;
      tribeSelectedValue.textContent = t(TRIBE_LABEL_KEYS[key]);
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
  tribeSelectedValue.onclick = () => toggleDropdownList(tribeSelectedValue, tribeList);

  // 서버 레벨캡 - 4개 페이지가 공유하는 전역 설정이라 tileSettings가 아니라 별도 localStorage
  // 키(loadServerLevelCap/saveServerLevelCap, my-dino-page.js)를 직접 읽고 씀. 친구 세션
  // 공유값이 아니라 각자 자기 서버 기준으로 알아서 설정하는 개인 값이라 sendMyTileUpdate로
  // 전파하지 않음(자연의 포옹/부족 점령과는 다름 - 그건 "같은 타일" 개념이라 공유해야 함)
  const capLabelFor = (v) => sharedOptionLabel(SERVER_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label);
  const capList = document.getElementById("tileServerLevelCapList");
  const capSelectedValue = document.getElementById("tileServerLevelCapSelectedValue");
  capSelectedValue.textContent = capLabelFor(loadServerLevelCap());
  SERVER_LEVEL_CAP_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      saveServerLevelCap(opt.value);
      capSelectedValue.textContent = sharedOptionLabel(opt.label);
      capList.style.display = "none";
      // 레벨캡 40% 이하 별자리 차단 경고는 "내 공룡"/"상대 공룡" 요약 카드에 표시되는데, 그 카드는
      // 프로필 자체를 편집할 때만 갱신됨(updateSummary) - 레벨캡 값만 바뀐 지금 시점엔 다시 그려주지
      // 않으면 경고가 즉시 안 나타남(실제 전투 계산은 매번 getSideInputs를 새로 부르므로 이미 정확함)
      renderMyDinoBattleSection();
      renderOppPanel();
      resetBattleDisplay();
    };
    capList.appendChild(li);
  });
  capSelectedValue.onclick = () => toggleDropdownList(capSelectedValue, capList);

  // 별자리 레벨캡 - 서버 레벨캡과 마찬가지로 전역 공유 설정(마찬가지로 친구 세션에 전파 안 함)
  const constLabelFor = (v) => sharedOptionLabel(CONSTELLATION_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label);
  const constList = document.getElementById("tileConstellationCapList");
  const constSelectedValue = document.getElementById("tileConstellationCapSelectedValue");
  constSelectedValue.textContent = constLabelFor(loadConstellationLevelCap());
  CONSTELLATION_LEVEL_CAP_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      saveConstellationLevelCap(opt.value);
      constSelectedValue.textContent = sharedOptionLabel(opt.label);
      constList.style.display = "none";
      resetBattleDisplay();
    };
    constList.appendChild(li);
  });
  constSelectedValue.onclick = () => toggleDropdownList(constSelectedValue, constList);

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
  const labelFor = (v) => sharedOptionLabel(BUFF_TOWER_OPTIONS.find((o) => o.value === v).label);
  selectedValue.textContent = labelFor(settings[settingsField]);

  BUFF_TOWER_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = sharedOptionLabel(opt.label);
    li.onclick = () => {
      settings[settingsField] = opt.value;
      selectedValue.textContent = sharedOptionLabel(opt.label);
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
  selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
}

// sideKey: "my" | "opp" - 내 공룡/상대 공룡 각자 독립적으로 "대기 공룡을 같은 타일에 모을지,
// 다른 타일에 따로 둘지" 설정. settingsField는 tileSettings의 myTileArrangement/oppTileArrangement
function initArrangementDropdown(sideKey, settings) {
  const settingsField = `${sideKey}TileArrangement`;
  const list = document.getElementById(`${sideKey}TileArrangementList`);
  const selectedValue = document.getElementById(`${sideKey}TileArrangementSelectedValue`);
  selectedValue.textContent = t(ARRANGEMENT_LABEL_KEYS[settings[settingsField]]);
  applyTileArrangementClass(sideKey, settings[settingsField]);

  Object.keys(ARRANGEMENT_LABEL_KEYS).forEach((key) => {
    const li = document.createElement("li");
    li.textContent = t(ARRANGEMENT_LABEL_KEYS[key]);
    li.onclick = () => {
      settings[settingsField] = key;
      selectedValue.textContent = t(ARRANGEMENT_LABEL_KEYS[key]);
      list.style.display = "none";
      saveTileSettings(settings);
      applyTileArrangementClass(sideKey, key);
      if (sideKey === "my" && isFriendSessionActive()) sendMyTileUpdate({ arrangement: key });
      resetBattleDisplay();
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
}

// 앞장(전투 중인 1마리)은 항상 중앙 육각형 자기 편 절반을 기준으로 좌표를 잡음 - 공룡이 싸우는
// 자리는 항상 가운데 육각형이어야 한다는 원칙(사용자 확정)이라 배치 설정과 무관하게 안 바뀜.
// 이 설정이 실제로 바꾸는 건 "대기"(behind1~3)가 어느 육각형 중심을 기준으로 좌표를 잡을지뿐 -
// "한 타일"이면 앞장과 같은 중앙 절반 기준점을, "다른 타일"이면 바깥 육각형 중심을 씀(더 이상
// DOM을 옮기지 않고 formationGroup의 data-arrangement만 바꾼 뒤 좌표를 다시 계산함 - 세계좌표
// 방식으로 갈아엎으면서 appendChild 곡예가 필요 없어짐)
function applyTileArrangementClass(sideKey, arrangement) {
  const formationGroup = document.getElementById(`${sideKey}FormationGroup`);
  if (!formationGroup) return;
  const wasSeparate = formationGroup.dataset.arrangement === "separate";
  const willBeSeparate = arrangement === "separate";
  // "다른 타일"→"한 타일" 전환 순간에만 수렴 애니메이션 대상(대기 아바타가 실제로 화면에
  // 떠 있던 경우만) - 반대 방향이나 이미 같은 상태면 캡처할 필요 없음
  if (wasSeparate && !willBeSeparate) playConvergeGhosts(sideKey);
  formationGroup.dataset.arrangement = willBeSeparate ? "separate" : "same";
  updateStackDisplay(sideKey, lastAliveCount[sideKey]);
}

// "다른 타일"에서 실제로 보이던 대기 아바타(behind1~3) 위치를 바뀌기 직전에 화면 좌표로 캡처해서,
// 그 자리에 잠깐 "유령" 아바타를 띄운 뒤 앞장(전투 자리) 쪽으로 이동+축소+페이드시켜서 "모여든다"는
// 느낌을 줌. 실제 상태 전환(updateStackDisplay가 대기 아바타를 숨기고 체력바로 바꾸는 것)은 이
// 함수 직후 그대로 동기 진행되므로, 유령이 날아가는 동안 이미 밑에는 체력바가 나타나 있음 -
// "이동 후 정착"을 시각적으로 겹쳐서 표현(FLIP처럼 실측 좌표 기반, dx/dy 고정값 아님)
function playConvergeGhosts(sideKey) {
  const avatarEl = document.getElementById(`${sideKey}Avatar`);
  const behindSlots = [1, 2, 3].map((n) => document.getElementById(`${sideKey}Behind${n}Slot`));
  const visible = behindSlots.filter((slotEl) => slotEl && slotEl.style.display !== "none");
  if (!avatarEl || visible.length === 0) return;
  const targetRect = avatarEl.getBoundingClientRect();
  const colorClass = sideKey === "my" ? "my-avatar" : "opp-avatar";
  visible.forEach((slotEl) => {
    const avatarChild = slotEl.querySelector(".battle-avatar");
    const rect = (avatarChild || slotEl).getBoundingClientRect();
    if (rect.width === 0) return;
    const ghost = document.createElement("div");
    ghost.className = `battle-avatar battle-converge-ghost ${colorClass}`;
    ghost.style.position = "fixed";
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.margin = "0";
    const dx = (targetRect.left + targetRect.width / 2) - (rect.left + rect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (rect.top + rect.height / 2);
    ghost.style.setProperty("--converge-dx", `${dx}px`);
    ghost.style.setProperty("--converge-dy", `${dy}px`);
    document.body.appendChild(ghost);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ghost.classList.add("battle-converge-ghost-active"));
    });
    setTimeout(() => ghost.remove(), 360);
  });
}

// 서버 레벨캡(전역 공유 설정, my-dino-page.js) - 내 공룡/상대 공룡 둘 다 같은 서버에서 뛴다는
// 전제라 양쪽 다 적용함(getOppBattleInputs의 나머지 두 분기도 동일하게 적용, 아래 참고)
function getSideInputs(storageKey) {
  return applyLowLevelConstellationBlock(applyConstellationCap(applyServerLevelCap(getMyDinoBattleInputs(storageKey))));
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
    return applyLowLevelConstellationBlock(applyConstellationCap(applyServerLevelCap(dinoProfileToBattleInputs(session.friendProfile))));
  }
  if (friendSnapshotProfile) {
    return applyLowLevelConstellationBlock(applyConstellationCap(applyServerLevelCap(dinoProfileToBattleInputs(friendSnapshotProfile))));
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
  const arrangementLabel = t(ARRANGEMENT_LABEL_KEYS[session.friendSide.arrangement] || ARRANGEMENT_LABEL_KEYS.same);
  const atkLabel = sharedOptionLabel((BUFF_TOWER_OPTIONS.find((o) => o.value === session.friendSide.atkTowerLevel) || BUFF_TOWER_OPTIONS[0]).label);
  const hpLabel = sharedOptionLabel((BUFF_TOWER_OPTIONS.find((o) => o.value === session.friendSide.hpTowerLevel) || BUFF_TOWER_OPTIONS[0]).label);
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
  if (tribeSelectedValue) tribeSelectedValue.textContent = t(TRIBE_LABEL_KEYS[tribeControl]);
}

// "내 공룡"/"상대 공룡" 라벨(타일 설정 카드의 좌우 라벨, 전투 카드의 좌우 파이터 이름, 좌우 설정
// 패널의 헤더 타이틀)을 실시간 세션 중이거나 "친구 설정 불러오기" 스냅샷을 쓰는 중이면 실제
// 닉네임으로 바꿈(스냅샷은 실시간이 아니라 "내" 쪽은 그대로 두고 상대 쪽만 닉네임으로 바꿈).
// 세션 중이 아니어도 로그인 상태라면 "내 공룡" 대신 내 닉네임을 보여줌(사용자 확정 - 이미
// 로그인해서 닉네임을 정했는데 굳이 "내 공룡"이라고 뭉뚱그릴 필요 없음) - 폴백 문자열까지 포함해서
// js/ui/dino-display-ui.js의 getMyDisplayNameSync()로 통일(타이탄/건물 페이지와 같은 기준)
function updateFriendLabels() {
  const session = getActiveSession();
  const active = session && session.status === "active";
  const myLabel = active ? session.myNickname : getMyDisplayNameSync();
  const oppLabel = active ? session.friendNickname : (friendSnapshotProfile ? friendSnapshotNickname : t("dino_battle.defaultOppLabel"));
  const targets = [
    [".tile-side-col-label.my-side-label", myLabel],
    [".tile-side-col-label.opp-side-label", oppLabel],
    ["#myPanelTitleText", myLabel],
    ["#oppPanelTitleText", oppLabel]
  ];
  targets.forEach(([selector, label]) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = label;
  });
  // 육각형 안 슬롯마다(최대 4개) 반복되는 닉네임 라벨도 전부 갱신
  document.querySelectorAll("#myFormationGroup .battle-team-slot-name").forEach((el) => { el.textContent = myLabel; });
  document.querySelectorAll("#oppFormationGroup .battle-team-slot-name").forEach((el) => { el.textContent = oppLabel; });
}

// "상대 공룡" 자리를 지금 모드(일반 편집 / 스냅샷 / 실시간 세션)에 맞게 다시 그림
function renderOppPanel() {
  const container = document.getElementById("oppDinoBattleSection");
  if (!container) return;
  const session = getActiveSession();
  // 모든 분기가 공유하는 헤더(제목/툴바/닫기 버튼) - renderMyDinoPage에 그대로 넘기거나,
  // 탭 컴포넌트를 안 쓰는 임시 카드(초대 중/불러오는 중)에는 dinoPanelHeaderHtml로 직접 붙임
  const header = { title: t("dino_battle.panelHeader.oppDino"), titleId: "oppPanelTitleText", toolbarId: "oppPanelToolbar", closeId: "oppPanelClose", onClose: closeSidePanels };

  if (session && session.status === "inviting") {
    container.innerHTML = `
      <div class="card friend-session-waiting">
        ${dinoPanelHeaderHtml(header)}
        <div>${t("dino_battle.inviteSentLine", { nickname: session.friendNickname })}</div>
        <button class="friend-toolbar-btn" id="cancelInviteBtn">${t("dino_battle.cancelInviteBtn")}</button>
      </div>
    `;
    wireDinoPanelHeader(container, header);
    document.getElementById("cancelInviteBtn").onclick = () => leaveFriendSession();
  } else if (session && session.status === "active") {
    if (session.friendProfile) {
      renderMyDinoPage(container, {
        idPrefix: "oppB_",
        unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
        unsuitableLabel: t("dino_battle.unsuitableRuneLabel"),
        header,
        readOnly: { profile: session.friendProfile, tagText: t("dino_battle.readonlyLiveTag", { nickname: session.friendNickname }) }
      });
    } else {
      container.innerHTML = `
        <div class="card friend-session-waiting">
          ${dinoPanelHeaderHtml(header)}
          <div>${t("dino_battle.loadingFriendProfile", { nickname: session.friendNickname })}</div>
        </div>
      `;
      wireDinoPanelHeader(container, header);
    }
  } else if (friendSnapshotProfile) {
    // 스냅샷은 실시간 동기화가 없는 정적 사본이라, 관찰자가 로컬에서만 다른 프리셋을 미리 볼 수
    // 있게 허용함(친구의 실제 데이터는 전혀 안 바뀜 - allowPresetSwitch 참고)
    renderMyDinoPage(container, {
      idPrefix: "oppB_",
      unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
      unsuitableLabel: t("dino_battle.unsuitableRuneLabel"),
      header,
      readOnly: {
        profile: friendSnapshotProfile,
        tagText: t("dino_battle.readonlySnapshotTag", { nickname: friendSnapshotNickname }),
        allowPresetSwitch: true,
        onPresetSwitch: () => resetBattleDisplay()
      }
    });
  } else {
    renderMyDinoPage(container, {
      idPrefix: "oppB_",
      storageKey: DINO_BATTLE_OPPONENT_KEY,
      unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
      unsuitableLabel: t("dino_battle.unsuitableRuneLabel"),
      header,
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
    // 친구 기능 4단계: 상대의 준비 상태를 항상 보여줌(내가 지금 설정 탭에 있든 다른 탭에 있든
    // 무관하게 - 이게 예전에 없던 "상대가 언제 시작하려는지 전혀 모름" 문제의 해결책)
    const readyIndicator = session.status === "active"
      ? `<span class="battle-ready-indicator${session.friendReady ? " is-ready" : ""}" id="friendReadyIndicator">${session.friendReady ? t("dino_battle.friendReadyLabel") : t("dino_battle.friendWaitingLabel")}</span>`
      : "";
    toolbar.innerHTML = `${readyIndicator}<button class="friend-toolbar-btn friend-leave-btn" id="leaveFriendSessionBtn">${t("dino_battle.leaveSessionBtn")}</button>`;
    document.getElementById("leaveFriendSessionBtn").onclick = () => leaveFriendSession();
  } else if (friendSnapshotProfile) {
    toolbar.innerHTML = `<button class="friend-toolbar-btn" id="clearSnapshotBtn">${t("dino_battle.switchToLocalBtn")}</button>`;
    document.getElementById("clearSnapshotBtn").onclick = () => {
      friendSnapshotProfile = null;
      friendSnapshotNickname = null;
      renderOppPanel();
      updateFriendLabels();
      resetBattleDisplay();
    };
  } else if (myUserId) {
    toolbar.innerHTML = `
      <button class="friend-toolbar-btn" id="inviteFriendBtn">${t("dino_battle.inviteFriendBtn")}</button>
      <button class="friend-toolbar-btn" id="loadFriendBtn">${t("dino_battle.loadSettingsBtn")}</button>
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
  title.textContent = mode === "invite" ? t("dino_battle.friendPicker.inviteTitle") : t("dino_battle.friendPicker.snapshotTitle");
  list.innerHTML = `<div class="friend-picker-empty">${t("dino_battle.friendPicker.loading")}</div>`;
  overlay.style.display = "flex";
  lockBodyScroll();

  const friends = await getAcceptedFriends(myUserId);
  if (overlay.style.display === "none") return; // 그새 닫혔으면 무시

  if (friends.length === 0) {
    list.innerHTML = `<div class="friend-picker-empty">${t("dino_battle.friendPicker.empty")}</div>`;
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
    alert(t("dino_battle.loadFailedAlert"));
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
      // 지금 내가 보고 있는 탭도 전파 - 늦게 들어온 쪽이 곧바로 내 배지를 보게 함(위 타일 설정
      // 이중 전송과 같은 이유)
      sendTabChange("dino_battle", currentDinoBattleMode);
    }
    resetBattleDisplay();
    updatePresenceBadges();
  } else if (event.type === "friend-profile") {
    renderOppPanel();
    resetBattleDisplay();
  } else if (event.type === "friend-tile") {
    refreshSharedTileDisplayFromSession();
    refreshOppTileDisplayFromSession();
    resetBattleDisplay();
  } else if (event.type === "friend-tab-change") {
    updatePresenceBadges();
  } else if (event.type === "friend-ready") {
    // 친구 기능 4단계 - "battle-start"(시드 공유) 방식은 더 이상 안 씀. 상대가 준비 완료를 누른
    // 시점 - 나도 이미 준비 완료 상태였다면 지금 both-ready가 되어 계산이 바로 시작됨
    renderOppPanelToolbar();
    maybeStartServerlessBattle();
  } else if (event.type === "friend-ready-cancelled") {
    renderOppPanelToolbar();
    updateReadyButtonUI();
  } else if (event.type === "battle-result") {
    if (event.battleType === "dino_battle") handleReceivedBattleResult(event.result);
  } else if (event.type === "friend-left" || event.type === "left" || event.type === "declined") {
    renderOppPanel();
    updateFriendLabels();
    applyOppTileLock(false);
    resetBattleDisplay();
    updatePresenceBadges();
  }
}

// "타일 하나엔 최대 3마리까지 표시"라는 규칙은 타일 단위 - "한 타일"(합체)이면 앞장+대기가
// 전부 같은 중앙 타일 한 곳을 나눠 쓰므로 합쳐서 최대 3마리. "다른 타일"(단독)이면 앞장은
// 중앙 타일에서 항상 혼자(1마리)이고, 대기는 그와 별개인 바깥 타일에서 독립적으로 다시
// 최대 3마리까지 찰 수 있어서 총 표시 한도가 4마리(1+3)가 됨(사용자 확인 - 예전엔 대기 쪽도
// "전체 3마리에서 앞장 1마리를 뺀 나머지"로 잘못 계산해서 다른 타일이어도 최대 3마리에 묶여있었음)
function isArrangementSeparate(sideKey) {
  const formationGroup = document.getElementById(`${sideKey}FormationGroup`);
  return !!formationGroup && formationGroup.dataset.arrangement === "separate";
}

// 중앙(전투) 타일에는 배치 설정과 무관하게 항상 딱 1마리씩만 존재함(사용자 확정 - "한 타일"이
// 최대 3마리를 억지로 욱여넣던 건 버그였음, 매머드 룬을 껴도 축소돼서 압축 룬보다 작아 보이는
// 모순이 있었음). "다른 타일"만 대기가 실제 대기 육각형에 아바타로 보이고(최대 3), "한 타일"은
// 대기가 아예 타일 개념이 없어져서 아바타 없이 밑에 체력바로만 표시(renderOverflowBars가 처리)
function visibleAvatarCount(sideKey, aliveCount) {
  if (aliveCount <= 0) return 0;
  if (isArrangementSeparate(sideKey)) {
    return 1 + Math.min(3, aliveCount - 1);
  }
  return 1;
}

// 앞장(avatarSlot)은 항상 중앙 육각형 자기 편 절반 기준점(frontCenter)에서 혼자만 존재 - 배치
// 설정과 무관하게 다시는 안 바뀜(사용자 확정). "다른 타일"이면 대기(behind1~3)가 대기 육각형
// 중심(reserveCenter) 기준 독립 대형(0~3마리)으로 아바타 표시, "한 타일"이면 대기 아바타 자체를
// 전부 숨김(체력바만 renderOverflowBars가 따로 그림) - 세계좌표 함수로 앞/대기를 계산하고,
// DOM 이동(appendChild) 없이 매번 left/top을 직접 심음
function updateStackDisplay(sideKey, aliveCount) {
  const separate = isArrangementSeparate(sideKey);
  const awayDir = sideKey === "my" ? [-1, 0] : [1, 0]; // 자기 진영(대기 육각형) 쪽을 가리키는 방향
  const center = HEX_CENTERS.center;
  const frontCenter = [center[0] + awayDir[0] * CENTER_SPLIT_OFFSET, center[1] + awayDir[1] * CENTER_SPLIT_OFFSET];
  const reserveCenter = HEX_CENTERS[`${sideKey}Reserve`];

  const behindSlots = [1, 2, 3].map((n) => document.getElementById(`${sideKey}Behind${n}Slot`));
  const avatarSlot = document.getElementById(`${sideKey}AvatarSlot`);

  // 앞장 자리는 생존 마릿수와 무관하게 항상 "1마리 있을 때"의 정상 위치(상대와 거리를 벌린 자리)로
  // 계산함 - 예전엔 전멸(aliveCount===0) 시 formationPoints가 빈 배열을 반환해서 `|| frontCenter`
  // 폴백으로 떨어졌는데, frontCenter는 이 정상 위치보다 중앙에 더 가까운 지점이라 전멸한 공룡이
  // 순간 중앙 쪽으로 튀는 것처럼 보였음. 예전엔 전멸 시 완전히 투명해져서(front-defeated) 이
  // 위치 오차가 안 보였지만, 지금은 회색으로 남겨두는 방식(front-eliminated)이라 눈에 보이게 됨
  // (사용자 제보 - "죽은 공룡이 상대를 공격하는 것처럼 중앙 쪽으로 가서 멈춤")
  const avatarPoint = formationPoints(frontCenter, 1, 0, 0, awayDir)[0];
  const reserveCount = separate ? Math.max(0, Math.min(3, aliveCount - 1)) : 0;
  const reservePoints = separate ? formationPoints(reserveCenter, reserveCount, R2_RESERVE, R3_RESERVE, null) : [];

  const avatarPct = worldToPercent(avatarPoint);
  avatarSlot.style.left = avatarPct.left;
  avatarSlot.style.top = avatarPct.top;
  avatarSlot.style.setProperty("--avatar-formation-scale", 1);
  avatarSlot.style.setProperty("--perspective-scale", dinoBattlePerspectiveScale(avatarPoint));
  // 카메라와의 실제 거리로 z-index를 매김(가까울수록 위) - 예전엔 앞장/대기가 정적 tier(2/1)였는데,
  // 대기 3마리끼리는 전부 tier가 같아서 셋 중 실제로 가장 가까운(앞) 자리가 DOM 순서 때문에
  // 오히려 뒤 두 마리에게 가려지는 버그가 있었음(사용자 지적 - "가까이 있는게 되려 가려져")
  if (avatarPct.distance) avatarSlot.style.zIndex = Math.round(10000 - avatarPct.distance);

  behindSlots.forEach((slotEl, idx) => {
    const point = reservePoints[idx];
    if (!point) { slotEl.style.display = "none"; return; }
    slotEl.style.display = "flex";
    const pct = worldToPercent(point);
    slotEl.style.left = pct.left;
    slotEl.style.top = pct.top;
    slotEl.style.setProperty("--avatar-formation-scale", 1);
    slotEl.style.setProperty("--perspective-scale", dinoBattlePerspectiveScale(point));
    if (pct.distance) slotEl.style.zIndex = Math.round(10000 - pct.distance);
  });
}

// 팀 슬롯(avatar/behind1/behind2/behind3) 각자의 체력바 갱신 - dinos 배열 index 0~3 순서 그대로
// (behind3는 "다른 타일" 단독 배치일 때만 실제로 보임 - 합체 배치에선 항상 숨겨져 있어 무해)
function updateReserveHpBars(sideKey, dinos) {
  const fillIds = ["HpFill", "Behind1HpFill", "Behind2HpFill", "Behind3HpFill"];
  fillIds.forEach((suffix, idx) => {
    const fill = document.getElementById(`${sideKey}${suffix}`);
    if (!fill) return;
    const d = dinos && dinos[idx];
    // 이 함수는 전투 중(renderBattleEvent)에만 불리고 dinos 배열은 죽은 공룡을 splice로 제거하며
    // 줄어드는 구조라, 인덱스에 값이 없다는 건 "아직 데이터 없음"이 아니라 "죽어서 배열에서
    // 빠짐"을 의미함 - 풀피로 되돌리면 죽은 공룡의 체력바가 다시 가득 찬 것처럼 보이는 버그가
    // 있었음(사용자 지적). 그 외엔 js/ui/dino-display-ui.js의 setHpFillWidth로 통일(사용자 확정
    // "체력바 로직이랑... 전부 통일시켜")
    if (d && d.maxHp > 0) setHpFillWidth(fill, d.hp, d.maxHp);
    else fill.style.width = "0%";
  });
}

// 아바타로 표시되는 마릿수(visibleAvatarCount - 배치에 따라 3 또는 4)를 넘는 나머지 공룡들 -
// 아바타는 없지만 체력은 계속 추적되므로 타일들 밑에 얇은 체력바로 따로 보여줌(사용자 확정).
// dinos가 없으면(초기화 시점, 아직 전투 시작 전) 전원 풀피로 간주해서 개수만큼 꽉 찬 바를 그림
// 매 턴(renderBattleEvent)마다 호출되는데, 예전엔 매번 innerHTML을 통째로 다시 그려서 바뀐 게
// 없어도(체력이 그대로여도) 매번 새 DOM으로 교체됐음 - 여기 걸린 등장 애니메이션이 그래서 턴마다
// 계속 재생돼 화면이 깜빡이는 버그가 있었음(사용자 지적). 개수가 그대로면 기존 바를 그대로 두고
// 채움 폭만 갱신하고, 개수 자체가 바뀔 때만(승격/사망으로 오버플로우 마릿수가 실제로 변함) 다시 그림
function renderOverflowBars(sideKey, dinos, aliveCount) {
  const shown = visibleAvatarCount(sideKey, aliveCount);
  const overflowCount = Math.max(0, aliveCount - shown);
  const container = document.getElementById(`${sideKey}OverflowBars`);
  const fillClass = sideKey === "my" ? "my-hp-fill" : "opp-hp-fill";
  const items = dinos ? dinos.slice(shown) : Array.from({ length: overflowCount });
  const pctOf = (d) => (d && d.maxHp > 0 ? Math.max(0, (d.hp / d.maxHp) * 100) : 100);

  const existing = container.querySelectorAll(".battle-overflow-bar");
  if (existing.length !== items.length) {
    container.innerHTML = items
      .map((d) => `<div class="battle-overflow-bar"><div class="battle-overflow-bar-fill ${fillClass}" style="width:${pctOf(d)}%;"></div></div>`)
      .join("");
    return;
  }
  existing.forEach((bar, i) => {
    const d = items[i];
    const fill = bar.querySelector(".battle-overflow-bar-fill");
    if (d && d.maxHp > 0) setHpFillWidth(fill, d.hp, d.maxHp);
    else fill.style.width = "100%";
  });
}

// 매머드의 힘/압축된 힘 룬(둘은 동시 장착 불가) 장착 여부에 따라 그 진영 공룡 전체의 시각적
// 크기를 키우거나 줄임 - js/core/hex-scene3d.js의 hexSceneDinoRuneSizeScale로 통일(다이노 배틀에서
// 처음 확정된 배율을 4개 페이지 전부 공용으로 씀). CSS --dino-scale 변수로 넘겨서 .battle-avatar
// 크기에 곱해짐
function dinoScaleFor(selectedRunes) {
  return hexSceneDinoRuneSizeScale(selectedRunes);
}

// 앞장/대기가 이제 formationGroup 하나를 공유하므로(예전엔 별개 DOM 2곳에 따로 심어야 했음) 한
// 곳에만 심으면 됨 - 자식인 .battle-avatar들이 CSS 상속으로 전부 이어받음
function applyDinoScale(sideKey, selectedRunes) {
  const scale = dinoScaleFor(selectedRunes);
  const el = document.getElementById(`${sideKey}FormationGroup`);
  if (el) el.style.setProperty("--dino-scale", scale);
}

// 중앙(전투) 타일 색상 - 중립은 흰색, "부족 점령 상태"(tileTribeControl - 이미 있는 설정, 전투
// 수치에도 영향을 주는 값)에 따라 내 부족이면 골드, 상대 부족이면 빨강으로 바꿔서 시각적으로도
// 누가 그 타일을 점령했는지 바로 보이게 함(사용자 확정)
// "--"로 시작하면 hexSceneResolveColor(js/core/hex-scene3d.js)가 CSS 커스텀 프로퍼티로 읽어서
// 테마에 맞춰 자동 반영함(mine=--accent, 테마 토글에도 안전) - none/opponent는 테마와 무관한
// 고정색이라 리터럴 그대로 둠
const CENTER_TILE_COLORS = {
  none: "#ffffff",
  mine: "--accent",
  opponent: "#e0473f"
};
function applyCenterTileColor(tribeControl) {
  const color = CENTER_TILE_COLORS[tribeControl] || CENTER_TILE_COLORS.none;
  if (dinoBattleScene3d) dinoBattleScene3d.setTileTint(1, color); // 인덱스 1 = center 타일(hexTiles 순서 참고)
}

function resetBattleDisplay() {
  clearResultWaitTimeout();
  // 친구 기능 4단계: 준비 완료 핸드셰이크 대기 중(둘 다 준비되기 전)에 설정이 바뀌면(내 편집이든
  // 상대가 보낸 profile/tile 갱신이든, 이 함수가 두 경로 모두에서 호출됨) 이미 한 내 준비를
  // 자동으로 취소함 - "이 설정으로 붙자"는 약속이 방금 무효화된 것이므로. 계산이 이미 끝나
  // 재생 중(playing/paused)이면 그 결과는 계산 시점에 이미 확정된 스냅샷이라 여기서 손댈 필요 없음.
  const readySession = getActiveSession();
  if (readySession && readySession.myReady && battlePhase !== "playing" && battlePhase !== "paused") {
    sendReadyCancel();
  }
  // 진행 중이던 재생 체인이 있다면 무력화(룬/스탯 변경으로 리셋됐는데 예전 타이머가 계속 그림을
  // 덮어쓰는 재진입 버그 방지)
  battleToken++;
  battlePhase = "idle";
  currentBattleResult = null;
  currentBattleIndex = 0;
  updateRestartButtonState();

  const myInputs = getSideInputs(MY_DINO_PROFILE_KEY);
  const oppInputs = getOppBattleInputs();

  updateStackDisplay("my", myInputs.count);
  updateStackDisplay("opp", oppInputs.count);
  lastAliveCount = { my: myInputs.count, opp: oppInputs.count };
  ["myHpFill", "myBehind1HpFill", "myBehind2HpFill", "myBehind3HpFill", "oppHpFill", "oppBehind1HpFill", "oppBehind2HpFill", "oppBehind3HpFill"].forEach((id) => {
    setHpFillWidth(document.getElementById(id), 1, 1);
  });
  renderOverflowBars("my", null, myInputs.count);
  renderOverflowBars("opp", null, oppInputs.count);
  applyDinoScale("my", myInputs.selectedRunes);
  applyDinoScale("opp", oppInputs.selectedRunes);
  applyCenterTileColor(getEffectiveTileSettings().tribeControl);

  // 죽음 연출이 예전 "회색 필터"(formationGroup에 .defeated) 방식에서 지금의 "축소되며
  // 사라짐"(avatar에 .front-defeated, playDeathFlash) 방식으로 바뀌었는데 여기 정리 코드는 옛
  // 클래스 이름 그대로 남아있었음 - .defeated는 CSS 규칙조차 없는 죽은 코드라 사실상 아무 효과가
  // 없었고, 정작 실제로 붙는 .front-defeated는 전멸 시(isFinalDeath) 영구히 안 지워지는
  // 설계(사용자 확정 - "없어지면 그걸로 끝")라 다시 시작해도 계속 축소·투명 상태로 남아있던 버그
  // (사용자 제보 - "다시 시작 눌러도 맨 처음 공룡이 안 보임"). 새 전투를 시작하는 시점엔 이전
  // 전투의 흔적을 지워야 하므로 실제로 쓰이는 클래스/엘리먼트로 고침
  ["myAvatar", "oppAvatar"].forEach((elId) => document.getElementById(elId).classList.remove("front-defeated", "front-eliminated"));
  const result = document.getElementById("battleResult");
  result.style.display = "none";
  result.innerText = "";

  // 빠른 계산 결과도 설정이 바뀌면 무효화 - 예전엔 상대/내 공룡을 편집해도 이전 계산 결과가
  // 화면에 그대로 남아있어서, 편집한 스탯이 반영 안 된 것처럼 보이는 혼동을 줬음(사용자 제보)
  document.getElementById("quickCalcResult").style.display = "none";

  const startBtn = document.getElementById("battleStartBtn");
  startBtn.disabled = false;
  startBtn.innerText = t("dino_battle.startBtn");
  startBtn.classList.remove("is-pressed");
  // 친구 세션 중이면 위에서 방금 넣은 기본 라벨을 "준비 완료"류 라벨로 덮어씀(세션 아니면 무해)
  updateReadyButtonUI();
  renderOppPanelToolbar();
  updatePresenceBadges();

  // 이 함수는 my/opp 프로필이나 세션 상태가 바뀔 수 있는 모든 경로(로컬 편집/세션 참가·이탈/
  // 스냅샷 로드)에서 이미 공통으로 호출되고 있어서, 모드 C 잠금 상태를 다시 확인하기에 가장
  // 안전한 공용 지점임(조합 찾기 탭이 아직 안 열려있어도 dinoBattleRefreshOptimizeModeCLock
  // 안에서 DOM 존재 여부를 방어적으로 확인함)
  dinoBattleRefreshOptimizeModeCLock();
}

// js/core/simulation-dino-battle.js가 hit/aoe label로 넘기는 문자열은 "평타"(사전 정의된 비교용
// 상수, 화면에 안 보임) 아니면 대부분 룬 이름(RUNES_DATA 키) 그대로인데, 낙뢰/메테오 계열만 룬
// 이름에 괄호 설명을 덧붙인 별도 문자열("낙뢰(즉사)" 등)이라 RUNES_DATA 키가 아님 - 이 셋만 따로
// 번역 키에 매핑하고, 나머지는 ruleDisplayName()에 그대로 맡김(룬 이름이 아니면 원문 그대로 반환)
const DINO_BATTLE_SPECIAL_LABEL_KEYS = {
  "낙뢰(즉사)": "dino_battle.log.meteorInstant",
  "메테오(광역)": "dino_battle.log.meteorAoe",
  "메테오(주변 타일)": "dino_battle.log.meteorSurrounding"
};
function dinoBattleDisplayLabel(label) {
  const specialKey = DINO_BATTLE_SPECIAL_LABEL_KEYS[label];
  return specialKey ? t(specialKey) : ruleDisplayName(label);
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
    // building-page.js의 buildingSpawnDamagePopupOn과 동일한 null 가드 - 페이지를 벗어난 뒤
    // 밀린 setTimeout이 실행되면 fighter가 이미 사라진 상태일 수 있음(사이트 전체 점검에서 발견)
    if (!fighter) return;
    const isSkill = !!label && label !== "평타";
    const popup = document.createElement("div");
    popup.className = "battle-dmg-popup" + (isSkill ? " skill" : "") + (isCrit ? " crit" : "");
    popup.style.cssText = popupOffsetStyle(popupIndex);
    popup.innerText = (isSkill ? `${dinoBattleDisplayLabel(label)} ` : "") + Math.round(dmg).toLocaleString() + (isCrit ? "!" : "");
    fighter.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }, delayMs);
}

// cause는 대부분 룬 이름(흡혈/힐/희생/마지막 선물)이지만, 100회 교환 무한 교착 방지 규칙만
// 예외적으로 룬이 아닌 고정 문구("100회 교환 - 동시 사망")를 그대로 넘김 - dinoBattleDisplayLabel과
// 같은 패턴으로 이 하나만 따로 매핑하고 나머지는 ruleDisplayName()에 맡김
function dinoBattleDisplayHealCause(cause) {
  return cause === "100회 교환 - 동시 사망" ? t("dino_battle.mutualKillPopup") : ruleDisplayName(cause);
}

function spawnHealPopup(fighterElId, amount, cause, delayMs, popupIndex = 0) {
  setTimeout(() => {
    const fighter = document.getElementById(fighterElId);
    if (!fighter) return;
    const popup = document.createElement("div");
    popup.className = "battle-dmg-popup heal";
    popup.style.cssText = popupOffsetStyle(popupIndex);
    const causeLabel = dinoBattleDisplayHealCause(cause);
    popup.innerText = amount > 0 ? `+${Math.round(amount).toLocaleString()} (${causeLabel})` : causeLabel;
    fighter.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }, delayMs);
}

const DEATH_ANIM_MS = 350;

// 앞장 슬롯(myAvatar/oppAvatar)은 죽을 때마다 다음 공룡이 같은 엘리먼트를 재사용하므로, 공격속도가
// 빨라 350ms 안에 연달아 죽으면(예: 압도적으로 밀릴 때) 이전 죽음이 예약해둔 제거 타이머가 나중에
// 뒤늦게 발동해서, 그 사이 새로 걸린 "전멸(최종)" 상태를 무시하고 클래스를 지워버리는 경쟁 상태가
// 있었음(실측으로 재현 - 5연킬 테스트에서 마지막 죽음이 회색 대신 "완전히 안 보임"이어야 하는데
// 4번째 죽음의 낡은 타이머가 뒤늦게 지워버려 다시 보였음). 진영별로 타이머 핸들을 저장해뒀다가
// 새 죽음이 생기면 이전 타이머를 확실히 취소함(playLungeAndShake의 lungeShakeTimeout과 같은 패턴)
const deathFlashTimeout = { my: null, opp: null };
// handlePromotionEffects()가 죽는 애니메이션 뒤에 잇는 승격 연출도 같은 종류의 낡은 타이머 문제가
// 있어서(별도 함수의 별도 타이머라 위 deathFlashTimeout과는 다른 핸들 필요) 같이 취소 대상에 둠
const promotionTimeout = { my: null, opp: null };

// isFinalDeath: 이 죽음으로 그 진영이 전멸했는지(더 이상 승격할 공룡이 없음) - 전멸이면
// front-eliminated(회색조+반투명, 자리는 그대로 남음)로 영구히 표시함. 원래는 front-defeated
// (축소+투명화, 완전히 안 보이게)를 그대로 둬서 "없어지면 그걸로 끝"으로 처리했었는데, 실사용
// 확인 결과 체력바/닉네임만 남고 공룡 자체가 아예 안 보이는 게 어색하다는 피드백을 받아 재설계함
// (사용자 확정 - "이 설계 자체를 바꿔야 함") - 자리는 계속 보이되 회색조로 죽었음을 표시.
// 승격이 있는 경우(전멸 아님)엔 예전처럼 축소+투명 애니메이션(front-defeated)을 350ms만 잠깐
// 재생한 뒤 지워서 handlePromotionEffects가 이어서 등장 애니메이션을 재생하게 함 - 안 그러면
// (예전 버그) 전멸 시에도 무조건 지워져서 죽은 공룡이 완전히 보이는 상태로 튕겨 돌아왔었음
// (사용자 지적 - "회색 처리가... 다시 생기면서"). 새 죽음은 그 슬롯에 대해 예약돼있던 이전
// 죽음/승격 타이머를 전부 무효화함(공속이 빨라 350ms 안에 연달아 죽으면 낡은 타이머가 뒤늦게
// 발동해서 방금 막 걸린 상태를 지워버리는 경쟁 상태가 있었음 - 5연킬 실측으로 재현/확인)
function playDeathFlash(sideKey, isFinalDeath) {
  const avatar = document.getElementById(`${sideKey}Avatar`);
  clearTimeout(deathFlashTimeout[sideKey]);
  clearTimeout(promotionTimeout[sideKey]);
  if (isFinalDeath) {
    avatar.classList.remove("front-defeated");
    avatar.classList.add("front-eliminated");
    return;
  }
  avatar.classList.remove("front-eliminated");
  avatar.classList.add("front-defeated");
  deathFlashTimeout[sideKey] = setTimeout(() => avatar.classList.remove("front-defeated"), DEATH_ANIM_MS);
}

// 앞장이 죽어서 대기 중이던 공룡이 그 자리로 올라올 때 짧게(0.2~0.3초) 티가 나는 연출(사용자 확정) -
// 1) 앞장 아바타에 "옆에서 슬라이드해 들어옴" 효과(내 편은 왼쪽 대기 육각형에서 오니까 왼쪽에서,
//    상대는 오른쪽에서 - 실제 이동 거리를 매번 계산하는 대신 항상 같은 방향의 고정 슬라이드로 단순화)
// 2) 그 승격으로 대기 슬롯에 빈자리가 하나 생겼는데 마침 화면에 못 보여주고 있던(오버플로우) 공룡이
//    있었다면, 그 공룡이 이제 마지막 대기 슬롯에 새로 나타나므로 "작음 -> 원래 크기" 팝인 효과
function handlePromotionEffects(sideKey, before, after, prevBehind1Rect) {
  if (after <= 0 || after >= before) return; // 죽은 공룡 없음(또는 전멸) - 승격 연출 없음

  const avatar = document.getElementById(`${sideKey}Avatar`);
  // 이 함수가 여기까지 왔다는 건 방금 같은 턴에 이 앞장이 죽어서(playDeathFlash가 이미
  // front-defeated를 걸어둔 상태) 다음 공룡이 그 자리로 승격됐다는 뜻 - 죽는 축소 애니메이션이
  // 다 끝난 뒤에 등장 이동이 이어서 재생되도록 지연시킴(같은 엘리먼트에 두 애니메이션을 동시에
  // 걸면 CSS가 하나만 적용해서 순서대로 안 보임). 핸들을 저장해서, 이 타이머가 발동하기 전에
  // 같은 슬롯에서 또 죽음이 생기면(playDeathFlash) 취소될 수 있게 함(낡은 타이머 경쟁 상태 방지)
  clearTimeout(promotionTimeout[sideKey]);
  promotionTimeout[sideKey] = setTimeout(() => {
    avatar.classList.remove("front-defeated", "promote-in-left", "promote-in-right", "promote-in-flip", "promote-in-flip-active");
    void avatar.offsetWidth; // 강제 리플로우 - 같은 클래스를 연달아 붙여도 애니메이션이 매번 처음부터 재생되게 함

    // FLIP(First-Last-Invert-Play): "다른 타일"이라 대기 첫 자리(behind1)가 실제 화면에 있었다면
    // 그 위치와 승격된 자리(avatar)의 실제 화면 좌표 차이를 계산해서, 딱 그 위치에서 지금 자리로
    // 진짜 이동해온 것처럼 보이게 함(예전엔 방향만 맞추고 거리는 항상 고정 28px였음 - 이제 세계
    // 좌표가 있어서 실제 이동 거리/방향을 그대로 반영할 수 있음)
    if (prevBehind1Rect && prevBehind1Rect.width > 0) {
      const newRect = avatar.getBoundingClientRect();
      const dx = (prevBehind1Rect.left + prevBehind1Rect.width / 2) - (newRect.left + newRect.width / 2);
      const dy = (prevBehind1Rect.top + prevBehind1Rect.height / 2) - (newRect.top + newRect.height / 2);
      avatar.style.setProperty("--flip-dx", `${dx}px`);
      avatar.style.setProperty("--flip-dy", `${dy}px`);
      avatar.classList.add("promote-in-flip");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => avatar.classList.add("promote-in-flip-active"));
      });
      setTimeout(() => avatar.classList.remove("promote-in-flip", "promote-in-flip-active"), 400);
    } else {
      // "한 타일"이라 대기가 애초에 화면에 없었던 경우 - 실제 이동 거리를 잴 방법이 없으니
      // 예전처럼 방향만 맞춘 고정 슬라이드로 대체
      const promoteClass = sideKey === "my" ? "promote-in-left" : "promote-in-right";
      avatar.classList.add(promoteClass);
      setTimeout(() => avatar.classList.remove(promoteClass), 320);
    }
  }, DEATH_ANIM_MS);

  const visibleBefore = visibleAvatarCount(sideKey, before);
  const visibleAfter = visibleAvatarCount(sideKey, after);
  const reserveVisibleBefore = Math.max(0, visibleBefore - 1);
  const reserveVisibleAfter = Math.max(0, visibleAfter - 1);
  // 오버플로우 공룡이 있었고(before > visibleBefore) 대기 슬롯 표시 개수 자체는 그대로라면
  // (한 마리가 앞으로 승격되고 오버플로우에서 한 마리가 그 자리를 메꿈) 마지막 대기 슬롯이 새로 채워진 것
  if (before > visibleBefore && reserveVisibleAfter === reserveVisibleBefore && reserveVisibleAfter >= 1) {
    const newcomer = document.getElementById(`${sideKey}Behind${reserveVisibleAfter}`);
    if (newcomer) {
      newcomer.classList.remove("reserve-pop-in");
      void newcomer.offsetWidth;
      newcomer.classList.add("reserve-pop-in");
      setTimeout(() => newcomer.classList.remove("reserve-pop-in"), 300);
    }
  }
}

let lungeShakeTimeout = null;

// 공룡 이미지를 포기하고 구체로 되돌리면서 다시 필요해진 공격/피격 모션(사용자 확정 - 스프라이트
// 도입 전 원래 있던 그대로 복구). 공격자는 상대 쪽으로 살짝 돌진(lunge), 피격자는 제자리에서
// 흔들리며(hit-shake) 동시에 발톱으로 긁힌 자국이 잠깐 번쩍임(css의 .hit-shake::after)
// 허수아비/타이탄 페이지와 완전히 같은 피격 이펙트 이미지(dummySpawnHitEffect/titanPlayHit과 동일한
// 방식 - assets/sprites/Hit_Effect.png + css/dummy.css의 .dummy-hit-effect, 빨갛게 물들이는
// filter까지 그대로 재사용) - 사용자 확정으로 직접 만든 CSS 발톱 자국 대신 이걸 씀
// 대상(아바타)이 preserve-3d 안에 있어서 fx를 그냥 자식으로 넣으면 3D 깊이 다툼에 걸림(피격
// 흔들림 애니메이션이 filter를 쓰는 순간 CSS 스펙상 강제로 평면화돼서 translateZ가 무시됨 -
// 실측으로 확인) - 3D를 아예 우회해서 화면 좌표(position:fixed)로 직접 띄움. 항상 최상단에
// 그려지므로 대상 뒤에 가려지는 문제가 원천적으로 발생할 수 없음(사용자 지적 버그 수정)
function spawnDinoHitEffect(target) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
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

  // 승격 이동(promote-in-flip-active) 중인 아바타에는 돌진/피격 흔들림을 걸지 않음 - CSS는 같은
  // 프로퍼티(transform)에 animation과 transition이 동시에 걸리면 animation을 우선 적용하므로,
  // 이동 중에 흔들림 animation이 끼어들면 FLIP 이동 궤적이 뚝뚝 끊겨 순간이동처럼 보였음(사용자
  // 지적 - "이동하는 모션이 안 보여"). 이동이 끝날 때까지만 잠깐 생략하고, 발톱 이펙트(별개의
  // 자식 엘리먼트라 이동과 무관)는 그대로 보여줌
  const attackerFlipping = attackerAvatar.classList.contains("promote-in-flip-active");
  const defenderFlipping = defenderAvatar.classList.contains("promote-in-flip-active");
  if (!attackerFlipping) attackerAvatar.classList.add(lungeClass);
  if (!defenderFlipping) defenderAvatar.classList.add("hit-shake");
  spawnDinoHitEffect(defenderAvatar);
  lungeShakeTimeout = setTimeout(() => {
    attackerAvatar.classList.remove(lungeClass);
    defenderAvatar.classList.remove("hit-shake");
  }, 350);
}

function renderBattleEvent(ev) {
  playLungeAndShake(ev.attackerSide, ev.defenderSide);

  // 같은 슬롯에 뜨는 팝업들끼리 순서대로 인덱스를 매겨서 겹치지 않게 흩어줌 - js/ui/dino-display-ui.js
  // 공용 함수(아레나와 공유, createPopupStagger 주석 참고). 슬롯 단위로 키를 매겨서(진영 단위가
  // 아니라) 메테오 "주변 타일"처럼 한 이벤트에 여러 슬롯이 동시에 맞아도 슬롯마다 따로 쌓임
  const stagger = createPopupStagger();
  const avatarSlotId = (sideKey) => `${sideKey}AvatarSlot`;
  // 메테오 등 광역 효과의 타겟 인덱스(0=앞장, 1~3=대기 육각형의 behind1~3) -> 실제 슬롯 엘리먼트 id
  const aoeTargetSlotId = (sideKey, index) => (index === 0 ? avatarSlotId(sideKey) : `${sideKey}Behind${index}Slot`);

  ev.hits.forEach((hit) => {
    const slotId = avatarSlotId(hit.targetSide);
    const { index, delay } = stagger(slotId);
    spawnDamagePopup(slotId, hit.dmg, hit.isCrit, hit.label, delay, index);
  });
  ev.heals.forEach((heal) => {
    const slotId = avatarSlotId(heal.side);
    const { index, delay } = stagger(slotId);
    spawnHealPopup(slotId, heal.amount, heal.cause, delay, index);
  });

  if (ev.aoeList.length > 0) {
    const arena = document.getElementById("battleArena");
    arena.classList.add("area-flash");
    setTimeout(() => arena.classList.remove("area-flash"), 400);
    // 예전엔 맞은 인원을 하나로 묶어 "메테오(광역) N마리 적중"이라는 팝업 하나만 앞장 슬롯에
    // 띄웠는데, "메테오(주변 타일)"처럼 대기 육각형(근접 타일)의 다른 슬롯이 맞아도 그 슬롯엔
    // 아무 메시지가 안 뜨는 버그였음(사용자 지적) - 실제로 맞은 슬롯마다 개별 팝업을 띄우도록
    // 변경(아레나가 이미 하던 방식과 통일 - 다이노 배틀이 확정한 dinoBattleDisplayLabel 규칙을
    // spawnDamagePopup이 그대로 처리해주므로 라벨 조합 로직 중복 없음).
    // aoeList는 배열 - 메테오/가시처럼 광역기 룬 2개를 동시에 장착해 같은 턴에 둘 다 발동해도
    // (묶음 이후 추가된 "가시" 룬으로 처음 생긴 시나리오) 서로 안 덮어쓰고 전부 표시됨
    ev.aoeList.forEach((aoe) => {
      aoe.targets.forEach((target) => {
        const slotId = aoeTargetSlotId(ev.defenderSide, target.index);
        const dmg = Math.max(0, target.before - target.after);
        const { index, delay } = stagger(slotId);
        spawnDamagePopup(slotId, dmg, target.isCrit, aoe.label, delay, index);
      });
    });
  }

  if (ev.deaths.length > 0) {
    ev.deaths.forEach((d) => {
      const aliveAfter = d.side === "my" ? ev.myAliveCount : ev.oppAliveCount;
      playDeathFlash(d.side, aliveAfter === 0);
    });
  }

  // 평타 100회 교환 동시사망(무한 교착 방지 규칙) - 양쪽 다 표시
  if (ev.mutualKill) {
    const my = stagger(avatarSlotId("my"));
    const opp = stagger(avatarSlotId("opp"));
    spawnHealPopup("myAvatarSlot", 0, "100회 교환 - 동시 사망", my.delay, my.index);
    spawnHealPopup("oppAvatarSlot", 0, "100회 교환 - 동시 사망", opp.delay, opp.index);
  }

  const beforeCount = lastAliveCount;
  // FLIP 이동 애니메이션용: 승격이 일어날 수도 있으니 "다른 타일"의 맨 앞 대기(behind1)가 지금
  // 실제로 화면 어디 있는지 좌표 갱신 전에 미리 재둠(대기가 없거나 "한 타일"이라 안 보이면 전부
  // 0인 rect가 잡히는데, handlePromotionEffects가 그 경우 고정 슬라이드로 대체함)
  const prevBehind1Rect = {
    my: document.getElementById("myBehind1Slot").getBoundingClientRect(),
    opp: document.getElementById("oppBehind1Slot").getBoundingClientRect()
  };
  updateStackDisplay("my", ev.myAliveCount);
  updateStackDisplay("opp", ev.oppAliveCount);
  updateReserveHpBars("my", ev.myDinos);
  updateReserveHpBars("opp", ev.oppDinos);
  renderOverflowBars("my", ev.myDinos, ev.myAliveCount);
  renderOverflowBars("opp", ev.oppDinos, ev.oppAliveCount);
  handlePromotionEffects("my", beforeCount.my, ev.myAliveCount, prevBehind1Rect.my);
  handlePromotionEffects("opp", beforeCount.opp, ev.oppAliveCount, prevBehind1Rect.opp);
  lastAliveCount = { my: ev.myAliveCount, opp: ev.oppAliveCount };
}

function finishBattleDisplay(result) {
  const resultEl = document.getElementById("battleResult");
  resultEl.style.display = "block";
  if (result.winner === "draw") resultEl.innerText = t("dino_battle.result.draw");
  else if (result.winner === "my") resultEl.innerText = t("dino_battle.result.win");
  else resultEl.innerText = t("dino_battle.result.lose");

  battlePhase = "finished";
  const startBtn = document.getElementById("battleStartBtn");
  startBtn.innerText = t("dino_battle.startBtnRestart");
  startBtn.classList.remove("is-pressed"); // 재생이 멈춘 상태라 눌린 채로 두지 않음
}

// "전투 시작" 버튼 하나가 battlePhase에 따라 시작/일시정지/재개/다시시작을 전부 겸함.
// 눌린 것처럼(is-pressed) 보이는 건 실제로 재생 중(playing)일 때뿐 - 일시정지/다시시작처럼
// 재생이 멈춰 있으면 다시 눌러도 되는 버튼이라는 뜻으로 원래대로 떠 있어야 함
function onBattleButtonClick() {
  const startBtn = document.getElementById("battleStartBtn");
  if (battlePhase === "playing") {
    battlePhase = "paused";
    startBtn.innerText = t("dino_battle.startBtnResume");
    startBtn.classList.remove("is-pressed");
    return;
  }
  if (battlePhase === "paused") {
    battlePhase = "playing";
    startBtn.innerText = t("dino_battle.startBtnPause");
    startBtn.classList.add("is-pressed");
    runBattleStep(battleToken);
    return;
  }
  // idle 또는 finished. 친구 세션 중이면 곧바로 계산하지 않고 "준비 완료" 핸드셰이크부터 거침
  // (친구 기능 4단계 - 둘 다 준비되기 전까진 아무도 계산하지 않음)
  if (isFriendSessionActive()) {
    handleReadyButtonClick();
    return;
  }
  startBattle();
}

// ===== 친구 기능 4단계: 준비 완료 핸드셰이크 + "한쪽 계산, 결과 통째 전송" =====
// 각자 로컬에서 같은 시드로 독립 재계산하던 기존 방식은 (a) 서로 계산이 미묘하게 어긋날 위험이
// 있고 (b) 상대가 지금 뭘 보고 있는지 전혀 모른 채로 시작/설정변경이 뒤섞이는 문제가 있었음.
// 대신: 방 채널명(roomChannelName)과 같은 규칙(사전순 uid)으로 "계산 담당"을 결정론적으로 정해서
// 그 한쪽만 실제로 시뮬레이션을 돌리고, 완성된 이벤트 로그 전체를 상대에게 그대로 전송함(청크
// 분할은 friend-session.js의 sendBattleResult가 처리) - 두 번째 계산 자체가 없으니 "어긋난다"는
// 문제가 구조적으로 사라지고, 계산이 동기적으로 그 자리에서 끝나 바로 전송되므로 그 이후 설정이
// 바뀌어도 이미 보낸 결과엔 영향이 없음(스냅샷 고정이 설계로 자동 성립).

let resultWaitTimeoutId = null;

function clearResultWaitTimeout() {
  if (resultWaitTimeoutId) {
    clearTimeout(resultWaitTimeoutId);
    resultWaitTimeoutId = null;
  }
}

// roomChannelName과 동일한 정렬 규칙 - 사전순으로 앞선 uid 쪽이 계산 담당. 별도 조율 메시지 없이
// 양쪽이 각자 로컬에서 똑같은 결론에 도달함
function amICalculator(session) {
  return [session.myId, session.friendId].sort()[0] === session.myId;
}

function updateReadyButtonUI() {
  if (!isFriendSessionActive() || battlePhase === "playing" || battlePhase === "paused") return;
  const session = getActiveSession();
  const startBtn = document.getElementById("battleStartBtn");
  if (!session || !startBtn) return;
  startBtn.disabled = false;
  startBtn.classList.remove("is-pressed");
  startBtn.innerText = session.myReady ? t("dino_battle.readyWaitingBtn") : t("dino_battle.readyBtn");
}

function handleReadyButtonClick() {
  const session = getActiveSession();
  if (!session) return;
  if (session.myReady) {
    sendReadyCancel();
    updateReadyButtonUI();
    renderOppPanelToolbar();
    return;
  }
  // 상대/내 공룡 기본 스탯·별자리 입력칸은 onblur에만 저장됨 - 방금 입력하고 포커스가 그 칸에
  // 남은 채로 바로 "준비 완료"를 눌렀다면 blur를 강제로 먼저 발생시켜 저장을 커밋해야 함
  document.activeElement.blur();
  sendReadyRequest("dino_battle");
  updateReadyButtonUI();
  renderOppPanelToolbar();
  maybeStartServerlessBattle();
}

// 둘 다 준비됐는지는 로컬에서 바로 판정 가능(서버 조율 불필요) - 내가 방금 준비 완료를 눌렀을 때,
// 또는 상대의 "friend-ready" 이벤트를 받았을 때 둘 다 여기를 거침
function maybeStartServerlessBattle() {
  const session = getActiveSession();
  if (!session || !session.myReady || !session.friendReady) return;
  if (amICalculator(session)) {
    computeAndBroadcastBattleResult();
    return;
  }
  // 계산 담당이 아니면 결과가 브로드캐스트로 도착하길 기다림 - 계산 자체는 동기라 순식간이지만,
  // 청크 전송/네트워크 왕복 시간을 감안해 타임아웃을 걸어둠(계산 담당 탭이 그새 닫히는 등 결과가
  // 영영 안 오는 경우 화면이 무한정 멈춰 보이지 않도록)
  clearResultWaitTimeout();
  const startBtn = document.getElementById("battleStartBtn");
  startBtn.innerText = t("dino_battle.resolvingLabel");
  startBtn.disabled = true;
  resultWaitTimeoutId = setTimeout(() => {
    resultWaitTimeoutId = null;
    sendReadyCancel();
    updateReadyButtonUI();
    alert(t("dino_battle.resolveTimeoutAlert"));
  }, 10000);
}

function computeAndBroadcastBattleResult() {
  resetBattleReady();
  resetBattleDisplay();
  const result = runDinoBattleSimulation({
    my: getSideInputs(MY_DINO_PROFILE_KEY),
    opp: getOppBattleInputs(),
    tileSettings: getEffectiveTileSettings(),
    collectLog: true
  });
  sendBattleResult("dino_battle", result);
  beginBattlePlayback(result);
}

function handleReceivedBattleResult(result) {
  clearResultWaitTimeout();
  resetBattleReady();
  resetBattleDisplay();
  beginBattlePlayback(remapBattleResultPerspective(result));
}

// 계산 담당이 "my"/"opp"로 태깅한 이벤트 로그를, 계산 담당이 아닌 쪽 입장에서 뒤집음(계산 담당의
// "my"는 곧 이쪽 입장에선 "opp") - amICalculator()가 거짓인 쪽(=결과를 받기만 하는 쪽)에서만 호출됨
function remapBattleResultPerspective(result) {
  const swap = (s) => (s === "my" ? "opp" : s === "opp" ? "my" : s);
  const swapEvent = (ev) => ({
    ...ev,
    attackerSide: swap(ev.attackerSide),
    defenderSide: swap(ev.defenderSide),
    hits: ev.hits.map((h) => ({ ...h, targetSide: swap(h.targetSide) })),
    heals: ev.heals.map((h) => ({ ...h, side: swap(h.side) })),
    deaths: ev.deaths.map((d) => ({ ...d, side: swap(d.side) })),
    spawn: ev.spawn ? { ...ev.spawn, side: swap(ev.spawn.side) } : null,
    myDinos: ev.oppDinos, oppDinos: ev.myDinos,
    myAliveCount: ev.oppAliveCount, oppAliveCount: ev.myAliveCount,
    myFrontHp: ev.oppFrontHp, myFrontMaxHp: ev.oppFrontMaxHp,
    oppFrontHp: ev.myFrontHp, oppFrontMaxHp: ev.myFrontMaxHp
  });
  return {
    ...result,
    winner: swap(result.winner),
    myFinalCount: result.oppFinalCount,
    oppFinalCount: result.myFinalCount,
    events: result.events.map(swapEvent)
  };
}

function beginBattlePlayback(result) {
  battleToken++;
  const token = battleToken;
  currentBattleResult = result;
  currentBattleIndex = 0;
  battlePhase = "playing";
  const startBtn = document.getElementById("battleStartBtn");
  startBtn.disabled = false;
  startBtn.innerText = t("dino_battle.startBtnPause");
  startBtn.classList.add("is-pressed");
  document.getElementById("battleResult").style.display = "none";
  updateRestartButtonState();
  runBattleStep(token);
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

// 솔로 플레이(친구 세션 없음) 전용 - 세션 중엔 계산 담당/결과 수신 흐름(handleReadyButtonClick 등)
// 으로만 진행되고 이 함수는 절대 호출되지 않음(onBattleButtonClick의 분기 참고)
function startBattle() {
  if (isFriendSessionActive()) return;
  // 상대/내 공룡 기본 스탯·별자리 입력칸은 onblur에만 저장됨(my-dino-page.js) - 방금 입력하고
  // 포커스가 그 칸에 남은 채로 바로 "전투 시작"을 눌렀다면 blur를 강제로 먼저 발생시켜 저장을
  // 커밋한 뒤에 읽어야 함(사용자 제보 버그)
  document.activeElement.blur();
  // 직전 전투가 전멸로 끝났다면 죽은 쪽 avatar에 .front-defeated(축소+투명화, playDeathFlash)가
  // 영구히 남아있는 채임 - resetBattleDisplay()가 이 클래스 제거를 포함해 전체 시각 상태를 처음
  // 상태로 되돌려주므로, battleToken을 새로 발급하기 전에 먼저 호출해서 깨끗한 상태에서 시작함
  resetBattleDisplay();
  const result = runDinoBattleSimulation({
    my: getSideInputs(MY_DINO_PROFILE_KEY),
    opp: getOppBattleInputs(),
    tileSettings: getEffectiveTileSettings(),
    collectLog: true
  });
  beginBattlePlayback(result);
}

function updateRestartButtonState() {
  document.getElementById("battleRestartBtn").disabled = battlePhase === "idle";
}
