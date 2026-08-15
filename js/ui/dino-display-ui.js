// 공룡 아바타 표시(체력바 채움 폭 계산, 로그인 시 닉네임 표시)에 관련된 로직을 한 곳에 모음.
// 예전엔 타이탄/다이노배틀/건물 페이지가 각자 따로 구현해서(체력바는 클램프 방식이 페이지마다
// 조금씩 다르고, 닉네임 표시는 다이노 배틀에만 있었음 - 타이탄/건물은 로그인해도 "내 공룡"
// 고정) 서로 미묘하게 어긋나 있었음(사용자 지적 - "공룡 보이는거랑 체력바 로직이랑 로그인 하면
// 닉네임 보이는거 전부 통일시켜... 하나 함수로 만들든가"). 아바타의 실제 DOM 구조/3D 배치는
// 페이지마다 완전히 달라서(육각형 세계좌표 vs 팀 슬롯 vs 건물 클러스터) 그 부분까지 하나로
// 합치진 않고, "체력 퍼센트 계산+적용"과 "내 닉네임 결정" 두 가지 공통 로직만 공유 함수로 뺌.

// ===== 로그인 시 닉네임(내 공룡 이름표) =====
// getCurrentUser()(js/ui/auth-ui.js, Supabase 세션 조회)는 비동기라 매 렌더링마다 부르면 느리고
// 깜빡이므로, 한 번 물어본 결과를 캐시해두고 동기 함수(getMyDisplayNameSync)로 즉시 꺼내 씀 -
// 페이지 진입 시 loadMyDisplayName()으로 갱신을 걸어두면 그 뒤로는 캐시가 최신 상태를 유지함
let myDisplayNameCache = null;

// 로그인 상태면 실제 닉네임을 캐시해두고 그대로 반환, 비로그인/실패면 null로 비움(그럴 땐
// getMyDisplayNameSync가 알아서 "내 공룡"으로 대체함). 페이지 진입 시 한 번, 그리고 로그인/로그아웃이
// 일어날 수 있는 시점(예: 로그인 모달 닫힘)마다 다시 불러주면 됨 - 실시간 구독까진 필요 없음
// (다른 탭에서 로그인해도 이 탭은 새로고침/재진입 전까진 몰라도 되는 수준의 정보라 사용자 확정
// 없이 실용적으로 판단함)
async function loadMyDisplayName() {
  try {
    const user = await getCurrentUser();
    myDisplayNameCache = (user && user.username) ? user.username : null;
  } catch (e) {
    myDisplayNameCache = null;
  }
  return myDisplayNameCache;
}

// 이미 getCurrentUser()를 자기 목적(예: uid 조회)으로 부른 페이지가, 그 결과로 얻은 닉네임을
// 여기 공용 캐시에도 그대로 채워 넣을 때 씀 - Supabase를 또 한 번 조회하지 않고도 다른 페이지와
// 캐시를 공유하기 위함(다이노 배틀 페이지처럼 uid도 같이 필요한 경우)
function setMyDisplayNameCache(name) {
  myDisplayNameCache = name || null;
}

// 로그인 상태면 닉네임, 아니면(또는 아직 loadMyDisplayName이 안 끝났으면) "내 공룡"
function getMyDisplayNameSync() {
  return myDisplayNameCache || "내 공룡";
}

// selector에 걸리는 모든 요소(보통 여러 마리 분 이름표)의 텍스트를 지금 캐시된 내 닉네임으로 갱신
function applyMyDisplayName(selector) {
  const label = getMyDisplayNameSync();
  document.querySelectorAll(selector).forEach((el) => { el.textContent = label; });
}

// ===== 체력바 채움 폭 =====
// hp/maxHp 비율을 0~100% 사이로 클램프해서 fillEl의 width로 적용 - 페이지마다 상한 클램프가
// 있거나 없거나 제각각이었는데(다이노 배틀은 하한만, 건물 새 코드는 상하한 다 클램프) 항상 안전한
// 상하한 클램프로 통일함. maxHp가 0 이하면(아직 계산 전 등) 0%로 취급. fillEl이 없으면 조용히 무시.
function setHpFillWidth(fillEl, hp, maxHp) {
  if (!fillEl) return 0;
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  fillEl.style.width = `${pct}%`;
  return pct;
}
