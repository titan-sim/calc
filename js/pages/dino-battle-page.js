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

// ===== 육각형 바닥과 완전히 같은 결합 좌표계(세계좌표) 위에 공룡을 "카메라로 촬영"하듯 배치 =====
// 예전엔 육각형 절반/전체를 감싸는 앵커 박스마다 서로 다른 %를 손으로 튜닝했음(박스 크기가
// 위치마다 달라서 대형을 만들 때마다 매번 눈대중 재조정 필요). 이제는 이 바닥 SVG와 정확히 같은
// 0~250 x 0~173.2 좌표계 하나에 정삼각형/나란히 배치를 실제 삼각함수로 계산해서 배치하고, 이미
// 걸려있는 CSS 3D(perspective+rotateX)가 그 좌표를 그대로 원근 투영해줌 - 그래서 이 상수/함수
// 몇 개만 손보면 어디(내 대기/중앙/상대 대기)든 동시에 반영됨. rotateX(55deg) 행렬을 직접 풀어보면
// local y가 클수록(내 쪽, y=129.9) 회전 후 z가 커져서 perspective 공식(scale=d/(d-z))상 확대되고,
// y가 작을수록(상대 쪽, y=43.3) 덜 확대됨 - 이미 걸린 3D 파이프라인 자체가 정확한 카메라라서
// JS로 원근 나누기를 따로 구현하지 않음(정답이 두 군데가 되는 유지보수 리스크만 생김).
const WORLD_W = 250, WORLD_H = 173.2;
const HEX_CENTERS = { myReserve: [50, 129.9], center: [125, 86.6], oppReserve: [200, 43.3] };
const CENTER_SPLIT_OFFSET = 20;          // 중앙 육각형 내/상대 절반 기준점 간격
const OUTWARD_1V1 = 12;                  // 1v1일 때 서로 반대쪽으로 더 벌리는 거리(중앙 타일엔
                                          // 배치 설정과 무관하게 항상 이 1v1 공식만 씀 - 사용자 확정)
const R2_RESERVE = 22;                   // 대기 육각형 2마리 나란히 반지름
const R3_RESERVE = 22;                   // 대기 육각형 3마리 정삼각형 반지름

function worldToPercent([x, y]) {
  return { left: `${(x / WORLD_W) * 100}%`, top: `${(y / WORLD_H) * 100}%` };
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
          <div class="setting-stack-pair">
            <div class="setting-stack">
              <label class="setting-label">서버 레벨캡</label>
              <div class="custom-dropdown" id="tileServerLevelCapDropdown">
                <div class="selected-value" id="tileServerLevelCapSelectedValue">없음</div>
                <ul class="dropdown-list" id="tileServerLevelCapList"></ul>
              </div>
            </div>
            <div class="setting-stack">
              <label class="setting-label">서버 별자리캡</label>
              <div class="custom-dropdown" id="tileConstellationCapDropdown">
                <div class="selected-value" id="tileConstellationCapSelectedValue">없음</div>
                <ul class="dropdown-list" id="tileConstellationCapList"></ul>
              </div>
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
        <div id="myDinoBattleSection"></div>
      </div>

      <div class="battle-arena-wrap">
        <button class="battle-peek-btn my-peek" id="myPeekBtn" title="내 공룡 설정">▶</button>

        <div class="card battle-main-card" id="battleMainCard">
          <div class="battle-mode-tabs mode-live" id="battleModeTabs">
            <span class="battle-mode-indicator"></span>
            <button class="battle-mode-tab" data-mode="quick" id="modeTabQuick"><span>빠른 계산</span></button>
            <button class="battle-mode-tab active" data-mode="live" id="modeTabLive"><span>시뮬레이션</span></button>
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
              <!-- flat-top 육각형(위/아래 변이 평행 - 허수아비/타이탄 페이지와 같은 계열) 3개를
                   대각선 이웃 스텝 (+75,-43.3)을 한 방향으로 두 번 이어서(지그재그 아님, 일직선
                   계단) 배치 - flat-top은 가로 일직선으로는 변이 안 맞물리고 이 대각선 스텝으로만
                   진짜 변공유가 됨(내-중앙, 중앙-상대 이음매 좌표 직접 대조 검증 완료).
                   결합 viewBox 250x173.2, 내 쪽이 아래(큰 y)/상대 쪽이 위(작은 y) - 이 좌표계가
                   그대로 공룡 배치의 "세계좌표"임(WORLD_W/WORLD_H, HEX_CENTERS 등 참고).
                   허수아비 페이지의 perspective+rotateX 기법을 그대로 가져오되, 내용물(아바타)까지
                   같은 preserve-3d 스택 안에 넣어서 진짜 원근 축소가 걸리게 함 - 안 그러면
                   "상대 쪽이 작게 보인다"를 구현할 방법이 없음(허수아비/타이탄은 내용물을 3D 밖의
                   평면 오버레이로 뺐지만 그래서 크기 차이가 안 생김). 대신 아바타 카드(.battle-
                   team-slot)에는 rotateX(-55deg) 반대회전 + translateZ(6px)를 순서 그대로 줘서
                   바닥과 같은 깊이에서 겹쳐 깜빡이는 z-fighting을 피함(순서를 바꾸면 발밑 기준점이
                   위로 밀려버림 - 절대 순서 바꾸지 말 것).
                   예전엔 육각형 절반/전체를 감싸는 앵커 박스 12개가 각자 다른 크기라 대형마다
                   손으로 % 튜닝을 따로 해야 했음(사용자 지적) - 이제 앞/대기 8칸(myAvatarSlot~
                   oppBehind3Slot) 전부 formationGroup 딱 2개의 직계 자식이고, 위치(left/top)는
                   updateStackDisplay()가 세계좌표 함수로 계산해서 매번 직접 심음(worldToPercent) -->
              <div class="battle-hex-field">
                <div class="battle-hex-stage" id="battleHexStage">
                  <div class="battle-hex-tilt">
                    <svg class="battle-hex-svg" viewBox="0 0 250 173.2" preserveAspectRatio="xMidYMid meet">
                      <defs>
                        <radialGradient id="battleHexGradMine" gradientUnits="userSpaceOnUse" cx="50" cy="129.9" r="55">
                          <stop offset="0%" style="stop-color:var(--accent); stop-opacity:0.3"></stop>
                          <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                        </radialGradient>
                        <radialGradient id="battleHexGradCenter" gradientUnits="userSpaceOnUse" cx="125" cy="86.6" r="60">
                          <stop id="battleHexCenterStop" offset="0%" style="stop-color:#ffffff; stop-opacity:0.18"></stop>
                          <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                        </radialGradient>
                        <radialGradient id="battleHexGradOpp" gradientUnits="userSpaceOnUse" cx="200" cy="43.3" r="55">
                          <stop offset="0%" style="stop-color:#e0473f; stop-opacity:0.3"></stop>
                          <stop offset="100%" style="stop-color:var(--card-bg); stop-opacity:1"></stop>
                        </radialGradient>
                      </defs>
                      <polygon points="25,86.6 75,86.6 100,129.9 75,173.2 25,173.2 0,129.9" fill="url(#battleHexGradMine)"></polygon>
                      <polygon points="100,43.3 150,43.3 175,86.6 150,129.9 100,129.9 75,86.6" fill="url(#battleHexGradCenter)"></polygon>
                      <polygon points="175,0 225,0 250,43.3 225,86.6 175,86.6 150,43.3" fill="url(#battleHexGradOpp)"></polygon>
                      <!-- 육각형 테두리를 "대각선 변"과 "위/아래 수평 변" 두 그룹으로 나눠서 따로
                           그림 - .battle-hex-tilt의 rotateX(55deg)가 화면상 세로(Y) 방향만 압축하는
                           변환이라, 수평 변(위/아래)은 그 굵기 방향이 통째로 Y축이라 온전히 다
                           압축되어 유독 얇아 보이고, 대각선 변은 굵기 방향에 X 성분도 섞여 있어
                           덜 압축됨(사용자 지적 - "노란 육각형 밑변이 얇다"). 그래서 수평 변만 stroke-
                           width를 더 굵게(3.6) 줘서 압축 후에도 대각선 변과 비슷한 두께로 보이게
                           보정함(실측 스크린샷으로 보정값 조정) */-->
                      <path d="M75,86.6 L100,129.9 L75,173.2 M25,173.2 L0,129.9 L25,86.6" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"></path>
                      <path d="M25,86.6 L75,86.6 M75,173.2 L25,173.2" fill="none" stroke="var(--accent)" stroke-width="3.6" vector-effect="non-scaling-stroke"></path>
                      <path d="M225,0 L250,43.3 L225,86.6 M175,86.6 L150,43.3 L175,0" fill="none" stroke="#e0473f" stroke-width="2" vector-effect="non-scaling-stroke"></path>
                      <path d="M175,0 L225,0 M225,86.6 L175,86.6" fill="none" stroke="#e0473f" stroke-width="3.6" vector-effect="non-scaling-stroke"></path>
                      <!-- 중앙(전투) 타일 - 두 유저가 만나 싸우는 자리(사용자 확정 - 중립을 상징하는
                           흰색 기본, applyCenterTileColor()가 "부족 점령 상태" 설정에 따라 노랑/
                           빨강으로 바꿔줌 - 대각선/수평 두 path 모두 .battle-hex-center-border
                           클래스로 묶어서 같이 갱신) -->
                      <path class="battle-hex-center-border" d="M150,43.3 L175,86.6 L150,129.9 M100,129.9 L75,86.6 L100,43.3" fill="none" stroke="#ffffff" stroke-width="2" vector-effect="non-scaling-stroke"></path>
                      <path class="battle-hex-center-border" d="M100,43.3 L150,43.3 M150,129.9 L100,129.9" fill="none" stroke="#ffffff" stroke-width="3.6" vector-effect="non-scaling-stroke"></path>
                    </svg>

                    <div class="battle-formation-group" id="myFormationGroup">
                      <div class="battle-team-slot battle-team-slot-avatar" id="myAvatarSlot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini my-hp-fill" id="myHpFill"></div></div>
                        <div class="battle-avatar my-avatar" id="myAvatar"></div>
                        <div class="battle-team-slot-name">내 공룡</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind1" id="myBehind1Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini my-hp-fill" id="myBehind1HpFill"></div></div>
                        <div class="battle-avatar my-avatar" id="myBehind1"></div>
                        <div class="battle-team-slot-name">내 공룡</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind2" id="myBehind2Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini my-hp-fill" id="myBehind2HpFill"></div></div>
                        <div class="battle-avatar my-avatar" id="myBehind2"></div>
                        <div class="battle-team-slot-name">내 공룡</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind3" id="myBehind3Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini my-hp-fill" id="myBehind3HpFill"></div></div>
                        <div class="battle-avatar my-avatar" id="myBehind3"></div>
                        <div class="battle-team-slot-name">내 공룡</div>
                      </div>
                    </div>
                    <div class="battle-formation-group" id="oppFormationGroup">
                      <div class="battle-team-slot battle-team-slot-avatar" id="oppAvatarSlot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini opp-hp-fill" id="oppHpFill"></div></div>
                        <div class="battle-avatar opp-avatar" id="oppAvatar"></div>
                        <div class="battle-team-slot-name">상대 공룡</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind1" id="oppBehind1Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini opp-hp-fill" id="oppBehind1HpFill"></div></div>
                        <div class="battle-avatar opp-avatar" id="oppBehind1"></div>
                        <div class="battle-team-slot-name">상대 공룡</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind2" id="oppBehind2Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini opp-hp-fill" id="oppBehind2HpFill"></div></div>
                        <div class="battle-avatar opp-avatar" id="oppBehind2"></div>
                        <div class="battle-team-slot-name">상대 공룡</div>
                      </div>
                      <div class="battle-team-slot battle-team-slot-behind3" id="oppBehind3Slot">
                        <div class="battle-hp-bar-mini"><div class="battle-hp-fill-mini opp-hp-fill" id="oppBehind3HpFill"></div></div>
                        <div class="battle-avatar opp-avatar" id="oppBehind3"></div>
                        <div class="battle-team-slot-name">상대 공룡</div>
                      </div>
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

function initDinoBattlePage() {
  renderMyDinoPage(document.getElementById("myDinoBattleSection"), {
    idPrefix: "myB_",
    storageKey: MY_DINO_PROFILE_KEY,
    unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
    unsuitableLabel: "공룡 대전에 적합하지 않은 룬입니다",
    header: { title: "내 공룡", titleId: "myPanelTitleText", closeId: "myPanelClose", onClose: closeSidePanels },
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
  tribeSelectedValue.onclick = () => toggleDropdownList(tribeSelectedValue, tribeList);

  // 서버 레벨캡 - 4개 페이지가 공유하는 전역 설정이라 tileSettings가 아니라 별도 localStorage
  // 키(loadServerLevelCap/saveServerLevelCap, my-dino-page.js)를 직접 읽고 씀. 친구 세션
  // 공유값이 아니라 각자 자기 서버 기준으로 알아서 설정하는 개인 값이라 sendMyTileUpdate로
  // 전파하지 않음(자연의 포옹/부족 점령과는 다름 - 그건 "같은 타일" 개념이라 공유해야 함)
  const capLabelFor = (v) => SERVER_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label;
  const capList = document.getElementById("tileServerLevelCapList");
  const capSelectedValue = document.getElementById("tileServerLevelCapSelectedValue");
  capSelectedValue.textContent = capLabelFor(loadServerLevelCap());
  SERVER_LEVEL_CAP_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      saveServerLevelCap(opt.value);
      capSelectedValue.textContent = opt.label;
      capList.style.display = "none";
      resetBattleDisplay();
    };
    capList.appendChild(li);
  });
  capSelectedValue.onclick = () => toggleDropdownList(capSelectedValue, capList);

  // 별자리 레벨캡 - 서버 레벨캡과 마찬가지로 전역 공유 설정(마찬가지로 친구 세션에 전파 안 함)
  const constLabelFor = (v) => CONSTELLATION_LEVEL_CAP_OPTIONS.find((o) => o.value === v).label;
  const constList = document.getElementById("tileConstellationCapList");
  const constSelectedValue = document.getElementById("tileConstellationCapSelectedValue");
  constSelectedValue.textContent = constLabelFor(loadConstellationLevelCap());
  CONSTELLATION_LEVEL_CAP_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = () => {
      saveConstellationLevelCap(opt.value);
      constSelectedValue.textContent = opt.label;
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
  selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
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
  return applyConstellationCap(applyServerLevelCap(getMyDinoBattleInputs(storageKey)));
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
    return applyConstellationCap(applyServerLevelCap(dinoProfileToBattleInputs(session.friendProfile)));
  }
  if (friendSnapshotProfile) {
    return applyConstellationCap(applyServerLevelCap(dinoProfileToBattleInputs(friendSnapshotProfile)));
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
// 닉네임으로 바꿈(스냅샷은 실시간이 아니라 "내" 쪽은 그대로 두고 상대 쪽만 닉네임으로 바꿈).
// 세션 중이 아니어도 로그인 상태라면(myNickname이 채워져 있으면) "내 공룡" 대신 내 닉네임을
// 보여줌(사용자 지적 - 이미 로그인해서 닉네임을 정했는데 굳이 "내 공룡"이라고 뭉뚱그릴 필요 없음)
function updateFriendLabels() {
  const session = getActiveSession();
  const active = session && session.status === "active";
  const myLabel = active ? session.myNickname : (myNickname || "내 공룡");
  const oppLabel = active ? session.friendNickname : (friendSnapshotProfile ? friendSnapshotNickname : "상대 공룡");
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
  const header = { title: "상대 공룡", titleId: "oppPanelTitleText", toolbarId: "oppPanelToolbar", closeId: "oppPanelClose", onClose: closeSidePanels };

  if (session && session.status === "inviting") {
    container.innerHTML = `
      <div class="card friend-session-waiting">
        ${dinoPanelHeaderHtml(header)}
        <div>${session.friendNickname}님에게 초대를 보냈습니다.<br>응답을 기다리는 중...</div>
        <button class="friend-toolbar-btn" id="cancelInviteBtn">초대 취소</button>
      </div>
    `;
    wireDinoPanelHeader(container, header);
    document.getElementById("cancelInviteBtn").onclick = () => leaveFriendSession();
  } else if (session && session.status === "active") {
    if (session.friendProfile) {
      renderMyDinoPage(container, {
        idPrefix: "oppB_",
        unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
        unsuitableLabel: "공룡 대전에 적합하지 않은 룬입니다",
        header,
        readOnly: { profile: session.friendProfile, tagText: `🔒 ${session.friendNickname} - 실시간으로 갱신됩니다` }
      });
    } else {
      container.innerHTML = `
        <div class="card friend-session-waiting">
          ${dinoPanelHeaderHtml(header)}
          <div>${session.friendNickname}님의 공룡 설정을 불러오는 중...</div>
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
      unsuitableLabel: "공룡 대전에 적합하지 않은 룬입니다",
      header,
      readOnly: {
        profile: friendSnapshotProfile,
        tagText: `🔒 ${friendSnapshotNickname} - 스냅샷 (편집 불가)`,
        allowPresetSwitch: true,
        onPresetSwitch: () => resetBattleDisplay()
      }
    });
  } else {
    renderMyDinoPage(container, {
      idPrefix: "oppB_",
      storageKey: DINO_BATTLE_OPPONENT_KEY,
      unsuitableList: DINO_BATTLE_UNSUITABLE_RUNE_LIST,
      unsuitableLabel: "공룡 대전에 적합하지 않은 룬입니다",
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

  const avatarPoint = formationPoints(frontCenter, aliveCount > 0 ? 1 : 0, 0, 0, awayDir)[0] || frontCenter;
  const reserveCount = separate ? Math.max(0, Math.min(3, aliveCount - 1)) : 0;
  const reservePoints = separate ? formationPoints(reserveCenter, reserveCount, R2_RESERVE, R3_RESERVE, null) : [];

  const avatarPct = worldToPercent(avatarPoint);
  avatarSlot.style.left = avatarPct.left;
  avatarSlot.style.top = avatarPct.top;
  avatarSlot.style.setProperty("--avatar-formation-scale", 1);

  behindSlots.forEach((slotEl, idx) => {
    const point = reservePoints[idx];
    if (!point) { slotEl.style.display = "none"; return; }
    slotEl.style.display = "flex";
    const pct = worldToPercent(point);
    slotEl.style.left = pct.left;
    slotEl.style.top = pct.top;
    slotEl.style.setProperty("--avatar-formation-scale", 1);
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
    const pct = d && d.maxHp > 0 ? Math.max(0, (d.hp / d.maxHp) * 100) : 100;
    fill.style.width = `${pct}%`;
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
    bar.querySelector(".battle-overflow-bar-fill").style.width = `${pctOf(items[i])}%`;
  });
}

// 매머드의 힘/압축된 힘 룬(둘은 동시 장착 불가) 장착 여부에 따라 그 진영 공룡 전체의 시각적
// 크기를 키우거나 줄임 - 룬 설명 문구("유닛의 크기가 커지며"/"유닛의 크기가 작아지며")를 그대로
// 반영. CSS --dino-scale 변수로 넘겨서 .battle-avatar 크기에 곱해짐
function dinoScaleFor(selectedRunes) {
  const names = (selectedRunes || []).filter(Boolean).map((r) => r.name);
  // 룬 자체 수치(공격력/체력 ±25%)를 시각적 크기에 그대로 곱하면 차이가 너무 커 보여서(사용자
  // 피드백), 시각적 배율은 절반 정도로만 완만하게 적용함
  if (names.includes("매머드의 힘")) return 1.12;
  if (names.includes("압축된 힘")) return 0.88;
  return 1;
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
const CENTER_TILE_COLORS = {
  none: "#ffffff",
  mine: "var(--accent)",
  opponent: "#e0473f"
};
function applyCenterTileColor(tribeControl) {
  const color = CENTER_TILE_COLORS[tribeControl] || CENTER_TILE_COLORS.none;
  const stop = document.getElementById("battleHexCenterStop");
  if (stop) stop.style.setProperty("stop-color", color);
  document.querySelectorAll(".battle-hex-center-border").forEach((border) => border.setAttribute("stroke", color));
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

  updateStackDisplay("my", myInputs.count);
  updateStackDisplay("opp", oppInputs.count);
  lastAliveCount = { my: myInputs.count, opp: oppInputs.count };
  ["myHpFill", "myBehind1HpFill", "myBehind2HpFill", "myBehind3HpFill", "oppHpFill", "oppBehind1HpFill", "oppBehind2HpFill", "oppBehind3HpFill"].forEach((id) => {
    document.getElementById(id).style.width = "100%";
  });
  renderOverflowBars("my", null, myInputs.count);
  renderOverflowBars("opp", null, oppInputs.count);
  applyDinoScale("my", myInputs.selectedRunes);
  applyDinoScale("opp", oppInputs.selectedRunes);
  applyCenterTileColor(getEffectiveTileSettings().tribeControl);

  ["myFormationGroup", "oppFormationGroup"].forEach((elId) => document.getElementById(elId).classList.remove("defeated"));
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

const DEATH_ANIM_MS = 350;

function playDeathFlash(sideKey) {
  const avatar = document.getElementById(`${sideKey}Avatar`);
  avatar.classList.add("front-defeated");
  setTimeout(() => avatar.classList.remove("front-defeated"), DEATH_ANIM_MS);
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
  // 걸면 CSS가 하나만 적용해서 순서대로 안 보임)
  setTimeout(() => {
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

  // 같은 타겟(내 공룡/상대 공룡)에게 뜨는 팝업들끼리 순서대로 인덱스를 매겨서 겹치지 않게 흩어줌
  const popupIndex = { my: 0, opp: 0 };
  const nextDelay = { my: 0, opp: 0 };
  const STAGGER_MS = 150;

  ev.hits.forEach((hit) => {
    const side = hit.targetSide;
    spawnDamagePopup(`${side}AvatarSlot`, hit.dmg, hit.isCrit, hit.label, nextDelay[side], popupIndex[side]);
    popupIndex[side]++;
    nextDelay[side] += STAGGER_MS;
  });
  ev.heals.forEach((heal) => {
    const side = heal.side;
    spawnHealPopup(`${side}AvatarSlot`, heal.amount, heal.cause, nextDelay[side], popupIndex[side]);
    popupIndex[side]++;
    nextDelay[side] += STAGGER_MS;
  });

  if (ev.aoe) {
    const arena = document.getElementById("battleArena");
    arena.classList.add("area-flash");
    setTimeout(() => arena.classList.remove("area-flash"), 400);
    const side = ev.defenderSide;
    spawnDamagePopup(`${side}AvatarSlot`, ev.aoe.targets.length, ev.aoe.isCrit, `${ev.aoe.label} ${ev.aoe.targets.length}마리 적중`, nextDelay[side], popupIndex[side]);
    popupIndex[side]++;
    nextDelay[side] += STAGGER_MS;
  }

  if (ev.deaths.length > 0) {
    ev.deaths.forEach((d) => playDeathFlash(d.side));
  }

  // 평타 100회 교환 동시사망(무한 교착 방지 규칙) - 양쪽 다 표시
  if (ev.mutualKill) {
    spawnHealPopup("myAvatarSlot", 0, "100회 교환 - 동시 사망", nextDelay.my, popupIndex.my);
    spawnHealPopup("oppAvatarSlot", 0, "100회 교환 - 동시 사망", nextDelay.opp, popupIndex.opp);
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
  document.getElementById("myFormationGroup").classList.toggle("defeated", result.myFinalCount === 0);
  document.getElementById("oppFormationGroup").classList.toggle("defeated", result.oppFinalCount === 0);

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
  // 직전 전투가 패배로 끝났다면 finishBattleDisplay()가 진 쪽 formationGroup에 .defeated(회색
  // 필터)를 남겨둔 채임 - 다시 시작해도 지워주는 로직이 없어서 새 전투 내내 회색으로 남아있던
  // 버그(사용자 지적). resetBattleDisplay()가 이 클래스 제거를 포함해 전체 시각 상태를 처음
  // 상태로 되돌려주므로, battleToken을 새로 발급하기 전에 먼저 호출해서 깨끗한 상태에서 시작함
  resetBattleDisplay();
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
