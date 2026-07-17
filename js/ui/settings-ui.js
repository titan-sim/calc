// 기존 "설정" 드로어를 그대로 쓰되, 페이지 이동 링크를 같이 넣어서
// 모바일에서도 자연스러운 내비게이션 역할까지 겸하게 함.

const AppSettings = { isLogEnabled: false };

function toggleMenu() {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  const isOpen = menu.classList.toggle("open");
  overlay.style.display = isOpen ? "block" : "none";
}

function applyThemeState(isLight) {
  document.body.classList.toggle("light-mode", isLight);
  const slider = document.getElementById("themeSlider");
  if (slider) slider.classList.toggle("is-light", isLight);
  localStorage.setItem("dino_theme", isLight ? "light" : "dark");
}

function toggleTheme() {
  const isCurrentlyLight = document.getElementById("themeSlider").classList.contains("is-light");
  applyThemeState(!isCurrentlyLight);
}

function applyStoredTheme() {
  applyThemeState(localStorage.getItem("dino_theme") === "light");
}

function initSettingsDrawer() {
  applyStoredTheme();
  renderAuthRow();
  document.getElementById("themeSlider").onclick = toggleTheme;
  document.getElementById("logToggle").addEventListener("change", (e) => {
    AppSettings.isLogEnabled = e.target.checked;
    console.log("상세 로그 수집:", AppSettings.isLogEnabled);
  });

  // 페이지 이동 네비게이션 링크 클릭 시 드로어 닫기
  document.querySelectorAll("#sideMenu .nav-link").forEach((el) => {
    el.addEventListener("click", () => toggleMenu());
  });
}

function updateActiveNavLink(hash) {
  document.querySelectorAll("#sideMenu .nav-link").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("href") === hash);
  });
}
