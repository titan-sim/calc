const ROUTES = {
  "": renderHome,
  "#home": renderHome,
  "#titan": renderTitanPage,
  "#dino-battle": renderDinoBattlePage,
  "#arena": renderArenaPage,
  "#my-dino": renderMyDinoPage,
  "#friends": renderFriendsPage,
  "#profile": renderProfilePage,
  "#privacy": renderPrivacyPage,
  "#dummy": renderDummyPage,
  "#building": renderBuildingPage
};

// 프로필/친구 페이지처럼 렌더 함수가 async(로그인 세션을 먼저 조회한 뒤에야 innerHTML을 채움)인
// 경우, 예전엔 body.dataset.page를 그 조회가 끝나기도 전에 먼저 바꿔버려서 - 아직 화면엔 이전
// 페이지의 DOM이 그대로 남아있는데 body[data-page="..."] 스코프 CSS만 새 페이지 걸로 바뀌어
// 레이아웃 비율이 잠깐 깨져 보이는 문제가 있었음(예: 넓은 아레나 레이아웃이 프로필 페이지 CSS
// 컨텍스트를 뒤집어쓰고 순간적으로 좁아짐). await로 실제 내용이 다 채워진 뒤에 dataset.page를
// 바꾸면 그 틈 자체가 없어짐.
let routerRenderSeq = 0;

async function renderRoute() {
  const mySeq = ++routerRenderSeq;
  const hash = location.hash || "#home";
  // 존재하지 않는 해시(오타/삭제된 라우트/잘못된 링크)는 renderHome으로 대체 렌더링되는데, 예전엔
  // 이 대체 사실을 안 반영하고 화면엔 없는 원본(미매칭) 해시를 그대로 body[data-page]에 심어버려서
  // 실제로 그려진 홈 화면 콘텐츠가 body[data-page="home"] 스코프 CSS(css/home.css의 .container
  // 등)를 하나도 못 받는 버그가 있었음(사이트 전체 점검에서 발견) - "실제로 어떤 라우트가
  // 그려졌는지" 기준으로 통일함
  const resolvedHash = ROUTES[hash] ? hash : "#home";
  const renderFn = ROUTES[resolvedHash] || renderHome;
  const app = document.getElementById("app");
  await renderFn(app);
  if (mySeq !== routerRenderSeq) return; // 기다리는 동안 다른 곳으로 또 이동했으면 이 결과는 무시
  updateActiveNavLink(resolvedHash);
  document.body.dataset.page = resolvedHash.replace("#", "");
  window.scrollTo(0, 0);
}

function initRouter() {
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}
