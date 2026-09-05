// 기존 "설정" 드로어를 그대로 쓰되, 페이지 이동 링크를 같이 넣어서
// 모바일에서도 자연스러운 내비게이션 역할까지 겸하게 함.

const AppSettings = { isLogEnabled: false };

// 메뉴가 열려 있는 동안 배경 페이지 스크롤을 잠금 - 안 잠그면 오버레이 뒤 배경 콘텐츠가 여전히
// 스크롤 가능한 상태로 남아있어서, 화면이 짧아 스크롤할 내용이 많은 경우 터치/휠로 배경을 스크롤할
// 때마다 스크롤바(모바일은 OS 자체 스크롤 인디케이터)가 잠깐 나타남 - 화면 크기에 따라 스크롤할
// 여백이 다르니 "화면 크기에 따라 생겼다 안 생겼다" 하는 것처럼 보였던 원인(사용자 지적).
// body는 이미 CSS로 overflow-x:hidden이 걸려있는데, 인라인 스타일 제거(""로 복귀)만으로 그
// 원래 규칙이 그대로 되살아나므로 서로 안 부딪힘
function toggleMenu() {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  const isOpen = menu.classList.toggle("open");
  overlay.style.display = isOpen ? "block" : "none";
  document.body.style.overflow = isOpen ? "hidden" : "";
}

function applyThemeState(isLight) {
  document.body.classList.toggle("light-mode", isLight);
  const slider = document.getElementById("themeSlider");
  if (slider) slider.classList.toggle("is-light", isLight);
  localStorage.setItem("dino_theme", isLight ? "light" : "dark");
  // Three.js 육각형 바닥(js/core/hex-scene3d.js)은 --accent/--card-bg 같은 테마색을 캔버스
  // 텍스처로 한 번 구워두는 방식이라, 새로고침 없이 즉시 바뀌는 이 테마 토글에 맞춰 다시 구워야
  // 색이 안 밀림(실측 확인) - 페이지별 씬이 각자 이 이벤트를 듣고 자기가 마운트돼 있을 때만 재굽기
  document.dispatchEvent(new CustomEvent("theme-changed"));
}

function toggleTheme() {
  const isCurrentlyLight = document.getElementById("themeSlider").classList.contains("is-light");
  applyThemeState(!isCurrentlyLight);
}

function applyStoredTheme() {
  applyThemeState(localStorage.getItem("dino_theme") === "light");
}

const LANG_OPTIONS = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "zh-CN", label: "中文(简体)" }
];

function initLangDropdown() {
  const list = document.getElementById("langList");
  const selectedValue = document.getElementById("langSelectedValue");
  const labelFor = (v) => (LANG_OPTIONS.find((o) => o.value === v) || LANG_OPTIONS[0]).label;
  selectedValue.textContent = labelFor(getCurrentLang());

  LANG_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.label;
    li.onclick = async () => {
      selectedValue.textContent = opt.label;
      list.style.display = "none";
      await setLang(opt.value);
    };
    list.appendChild(li);
  });
  selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
}

function initSettingsDrawer() {
  applyStoredTheme();
  renderAuthRow();
  initLangDropdown();
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
