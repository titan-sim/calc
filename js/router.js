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
  const renderFn = ROUTES[hash] || renderHome;
  const app = document.getElementById("app");
  await renderFn(app);
  if (mySeq !== routerRenderSeq) return; // 기다리는 동안 다른 곳으로 또 이동했으면 이 결과는 무시
  updateActiveNavLink(hash === "" ? "#home" : hash);
  document.body.dataset.page = (hash === "" ? "#home" : hash).replace("#", "");
  window.scrollTo(0, 0);
}

function initRouter() {
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}
