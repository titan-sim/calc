// 공용 HTML 셸(뼈대) - index.html/en.html(그리고 앞으로 추가할 도구별 SEO 랜딩 페이지)이 전부
// 여기서 찍혀 나옴. 페이지마다 다른 부분(제목/설명/canonical/히어로 문구 등)만
// dev/pages.config.js가 config로 넘기고, 나머지(사이드 메뉴/헤더/스타일시트 목록/스크립트 목록)는
// 이 파일 한 곳에서만 관리함 - CSS 파일을 추가하거나 메뉴 항목이 바뀌어도 여기 한 번만 고치면 됨.
//
// 빌드 도구가 아님 - "node dev/generate-pages.js"를 손으로 실행할 때만 쓰이는 개발용 스크립트고,
// 그 결과물(index.html 등)을 그대로 커밋해서 배포함. 사이트 자체(JS/CSS)는 여전히 런타임 빌드
// 단계 없이 순수 정적 파일 그대로 서빙됨 - 여기서 찍어내는 건 반복되는 HTML 셸뿐임.
function renderPage(cfg) {
  const hreflangHtml = cfg.hreflang.map((h) => `  <link rel="alternate" hreflang="${h.hreflang}" href="${h.href}">`).join("\n");

  return `<!DOCTYPE html>
<!-- 이 파일은 dev/generate-pages.js가 dev/pages.config.js + dev/site-template.js로부터 자동
     생성함 - 직접 고치지 말 것(다음 생성 때 덮어써서 사라짐). 고칠 내용에 따라:
     - 이 페이지만의 값(제목/설명/히어로 문구 등) -> dev/pages.config.js
     - 모든 페이지가 공유하는 부분(메뉴/헤더/스타일시트·스크립트 목록) -> dev/site-template.js
     고친 뒤 저장소 루트에서 "node dev/generate-pages.js"를 다시 실행할 것 -->
<html lang="${cfg.lang}">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cfg.title}</title>
  <meta name="description" content="${cfg.description}">
  <meta name="google-site-verification" content="L98MFUbflpT6ium7ciRsL5ztwsoQ40egIudAwjXgR7c" />
  <meta name="naver-site-verification" content="b2ec2a63ccaf10094af28e7c90b0e1df6aa39e43" />

  <!-- 이 URL과 짝을 이루는 다른 언어 버전이 있다고 구글에 알려주는 태그 - 각자 자기 자신을
       canonical로 가리킴(서로를 가리키면 구글이 한쪽을 무시하고 다른 쪽으로 합쳐버림) -->
  <link rel="canonical" href="${cfg.canonical}">
${hreflangHtml}

  <link rel="icon" type="image/png" href="assets/branding/Constellation_Icon.png">
  <link rel="apple-touch-icon" href="assets/branding/Constellation_Icon.png">

  <!-- Supabase(jsdelivr)/Three.js(cdnjs) 요청용 DNS+TLS를 페이지 파싱 초반부터 미리 열어둠 -
       두 스크립트 다 body 끝에서야 등장하지만, 그때 가서 연결을 새로 맺으면 왕복(RTT)이 그대로
       로딩 지연으로 남음 -->
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>

  <meta property="og:type" content="website">
  <meta property="og:title" content="${cfg.title}">
  <meta property="og:description" content="${cfg.description}">
  <meta property="og:image" content="https://dinomutant-sim.com/assets/branding/OG_Banner.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${cfg.canonical}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${cfg.title}">
  <meta name="twitter:description" content="${cfg.description}">
  <meta name="twitter:image" content="https://dinomutant-sim.com/assets/branding/OG_Banner.png">

  <!-- css/style.css(단일 4600여 줄 파일)를 여러 파일로 분리한 것 - 순서가 원본 cascade 순서와
       같아야 하므로(뒤에 오는 파일이 앞의 것을 덮어쓸 수 있음) 이 순서를 함부로 바꾸지 말 것 -->
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/rune-picker.css">
  <link rel="stylesheet" href="css/nav.css">
  <link rel="stylesheet" href="css/auth-friends.css">
  <link rel="stylesheet" href="css/privacy.css">
  <link rel="stylesheet" href="css/profile.css">
  <link rel="stylesheet" href="css/home.css">
  <link rel="stylesheet" href="css/my-dino.css">
  <link rel="stylesheet" href="css/combat-shared.css">
  <link rel="stylesheet" href="css/dino-battle.css">
  <link rel="stylesheet" href="css/arena.css">
  <link rel="stylesheet" href="css/dummy.css">
  <link rel="stylesheet" href="css/building.css">
  <link rel="stylesheet" href="css/titan.css">
</head>

<body>
  <!-- 다크모드가 기본값(:root)이고 라이트모드는 body.light-mode 클래스로만 켜지는데(css/base.css),
       이 클래스는 원래 js/ui/settings-ui.js의 applyStoredTheme()가 DOMContentLoaded 시점에서야
       붙여줬음 - body 끝의 스크립트 30여 개가 다 로드/실행되고 i18n 번역까지 fetch된 뒤라 라이트모드
       사용자는 매번 "어두운 화면 -> 밝은 화면"으로 깜빡이는 게 눈에 보였음(사용자 제보). 첫 페인트
       전에 동기적으로 끝나도록 body 맨 앞으로 옮김 - localStorage만 읽으므로 다른 스크립트에 의존
       없이 즉시 실행 가능. applyStoredTheme()는 그대로 두어 테마 슬라이더 UI 상태 동기화와
       theme-changed 이벤트(3D 육각형 바닥 텍스처 재굽기)는 계속 담당하게 함 -->
  <script>
    try {
      if (localStorage.getItem("dino_theme") === "light") document.body.classList.add("light-mode");
    } catch (e) {}
  </script>

  <div id="sideMenu" class="side-menu">
    <div class="side-header">
      <span style="font-weight: bold;" data-i18n-key="index_html.menuLabel">메뉴</span>
      <button class="close-btn" id="closeMenuBtn">✕</button>
    </div>
    <div class="menu-content">
      <div class="auth-row" id="authRow"></div>

      <div class="menu-divider"></div>

      <nav class="nav-list">
        <a class="nav-link" href="#home" data-i18n-key="index_html.navHome">홈</a>
        <a class="nav-link" href="#my-dino" data-i18n-key="index_html.navMyDino">내 공룡</a>
        <a class="nav-link" href="#titan" data-i18n-key="index_html.navTitan">타이탄</a>
        <a class="nav-link" href="#dino-battle" data-i18n-key="index_html.navDinoBattle">공룡 대전</a>
        <a class="nav-link" href="#arena" data-i18n-key="index_html.navArena">아레나</a>
        <a class="nav-link" href="#dummy" data-i18n-key="index_html.navDummy">허수아비</a>
        <a class="nav-link" href="#building" data-i18n-key="index_html.navBuilding">건물</a>
        <div class="menu-divider"></div>
        <div class="nav-section-label" data-i18n-key="index_html.navExternalSiteLabel">외부 사이트</div>
        <a class="nav-link nav-link-external" href="https://3n74l.github.io/Dino_Run/" target="_blank" rel="noopener noreferrer"><span data-i18n-key="index_html.navExternalGameLink">Dino Run (팬메이드 게임)</span><svg class="external-link-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zM19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z"/></svg></a>
      </nav>

      <div class="menu-bottom">
        <div class="menu-divider"></div>
        <div class="menu-setting-row">
          <button type="button" class="theme-slider" id="themeSlider">
            <span class="theme-slider-glow"></span>
            <span class="theme-slider-label theme-slider-label-dark" data-i18n-key="index_html.themeDark">다크모드</span>
            <span class="theme-slider-label theme-slider-label-light" data-i18n-key="index_html.themeLight">라이트모드</span>
          </button>
        </div>
        <div class="menu-setting-row">
          <span style="font-size: 14px;" data-i18n-key="common.languageLabel">언어</span>
          <div class="custom-dropdown menu-lang-dropdown" id="langDropdown">
            <div class="selected-value" id="langSelectedValue">한국어</div>
            <ul class="dropdown-list" id="langList"></ul>
          </div>
        </div>
        <div class="menu-setting-row">
          <span style="font-size: 14px;" data-i18n-key="index_html.logToggleLabel">상세 로그 수집</span>
          <label class="switch">
            <input type="checkbox" id="logToggle">
            <span class="slider round"></span>
          </label>
        </div>
        <a class="menu-footer-link" href="#privacy" data-i18n-key="index_html.privacyFooterLink">개인정보처리방침</a>
      </div>
    </div>
  </div>
  <div id="menuOverlay" class="menu-overlay"></div>

  <div id="authModalRoot"></div>

  <div id="friendInviteBanner" class="friend-invite-banner" style="display:none;"></div>
  <div id="friendToast" class="friend-toast" style="display:none;"></div>

  <header class="app-bar">
    <div class="header-left">
      <button class="menu-btn" id="menuBtn">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </button>
      <a href="#home" class="app-title">
        <span class="brand">DINO MUTANT</span>
        <span class="sub" data-i18n-key="index_html.headerSubtitle">시뮬레이터</span>
      </a>
    </div>
  </header>

  <div class="container" style="margin-top: 50px;">
    <!-- JS 로딩 전(또는 JS를 실행 안 하는 크롤러)이 봤을 때도 h1/콘텐츠가 비어있지 않도록 하는
         정적 폴백 - 이 페이지가 실제로 보여줄 화면(보통 홈)을 그리는 render 함수가 그리는 마크업과
         동일해야 함(cfg.appHtml, dev/pages.config.js). JS가 로드되면 router.js의 renderRoute()가
         이 안을 통째로 innerHTML로 덮어써서 즉시(거의 같은 프레임에) 대체되므로 실사용자에게는
         시각적 차이가 없음 -->
    <div id="app">
${cfg.appHtml}
    </div>
  </div>

  <!-- defer: 30여 개 스크립트를 순서대로 하나씩 받아서 실행하던(직렬 다운로드+실행) 방식 대신,
       파일들을 병렬로 미리 받아두고 실행만 문서 순서대로 DOMContentLoaded 직전에 몰아서 하게 함.
       실행 순서 보장(데이터 파일 -> 그걸 쓰는 코드, THREE -> hex-scene3d.js 등)은 defer끼리는
       항상 문서 순서대로라 그대로 유지됨. 단, 이 목록 뒤에 오던 순수 인라인 스크립트(툴바 버튼
       바인딩)는 defer 스크립트들보다 먼저(파서가 도달하는 즉시) 실행돼버려 toggleMenu가 아직
       정의되기 전이라 깨지므로 js/main.js의 DOMContentLoaded 안으로 옮김 -->
  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script defer src="js/core/supabase-config.js"></script>
  <script defer src="js/core/data-sync.js"></script>
  <script defer src="js/core/friend-session.js"></script>
  <script defer src="js/core/update-check.js"></script>
${cfg.preI18nBlock || ""}  <script defer src="js/core/i18n.js"></script>
  <script defer src="js/data/rune-data.js"></script>
  <script defer src="js/data/titan-data.js"></script>
  <script defer src="js/data/constellation-data.js"></script>
  <!-- Three.js(WebGL) - 다이노 배틀/타이탄/허수아비/건물 페이지의 육각형 바닥을 진짜 3D로 렌더링
       (js/core/hex-scene3d.js가 이걸 씀). CSS rotateX+perspective 가짜 3D의 렌더링 버그를 겪은
       뒤 사용자 확정으로 전면 교체 - hex-scene3d.js보다 반드시 먼저 로드돼야 함 -->
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script defer src="js/core/hex-scene3d.js"></script>
  <script defer src="js/core/stat-calc.js"></script>
  <script defer src="js/core/simulation-titan.js"></script>
  <script defer src="js/core/simulation-dino-battle.js"></script>
  <script defer src="js/core/simulation-arena.js"></script>
  <script defer src="js/core/simulation-dummy.js"></script>
  <script defer src="js/core/simulation-building.js"></script>
  <script defer src="js/ui/chart-ui.js"></script>
  <script defer src="js/ui/stat-roll-ui.js"></script>
  <script defer src="js/ui/dropdown-ui.js"></script>
  <script defer src="js/ui/rune-ui.js"></script>
  <script defer src="js/ui/auth-modal.js"></script>
  <script defer src="js/ui/auth-ui.js"></script>
  <script defer src="js/ui/dino-display-ui.js"></script>
  <script defer src="js/ui/settings-ui.js"></script>
  <script defer src="js/pages/home.js"></script>
  <script defer src="js/pages/my-dino-page.js"></script>
  <script defer src="js/pages/friends-page.js"></script>
  <script defer src="js/pages/profile-page.js"></script>
  <script defer src="js/pages/privacy-page.js"></script>
  <script defer src="js/pages/titan-page.js"></script>
  <script defer src="js/pages/dino-battle-page.js"></script>
  <script defer src="js/pages/arena-page.js"></script>
  <script defer src="js/pages/dummy-page.js"></script>
  <script defer src="js/pages/building-page.js"></script>
  <script defer src="js/router.js"></script>
  <script defer src="js/main.js"></script>
</body>

</html>
`;
}

module.exports = { renderPage };
