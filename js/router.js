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

function renderRoute() {
  const hash = location.hash || "#home";
  const renderFn = ROUTES[hash] || renderHome;
  const app = document.getElementById("app");
  renderFn(app);
  updateActiveNavLink(hash === "" ? "#home" : hash);
  document.body.dataset.page = (hash === "" ? "#home" : hash).replace("#", "");
  window.scrollTo(0, 0);
}

function initRouter() {
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}
