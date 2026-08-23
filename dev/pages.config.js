// 페이지별로 다른 값만 여기서 관리 - 공통 뼈대는 dev/site-template.js 하나에만 있음. 새 페이지를
// 추가하려면(예: 도구별 SEO 랜딩 페이지) 아래 배열에 객체 하나만 추가하고 저장소 루트에서
// "node dev/generate-pages.js"를 실행하면 됨.
const DEFAULT_HREFLANG = [
  { hreflang: "ko", href: "https://dinomutant-sim.com/" },
  { hreflang: "en", href: "https://dinomutant-sim.com/en" },
  { hreflang: "x-default", href: "https://dinomutant-sim.com/" }
];

// home.js의 renderHome()이 그리는 히어로 블록과 완전히 동일한 마크업/문구여야 함(주석 설명은
// dev/site-template.js의 #app 부분 참고) - renderHome()을 고칠 때 이 두 상수도 같이 맞출 것
const HOME_APP_HTML_KO = `      <button type="button" class="home-hero" id="homeHeroBtn">
        <div class="home-hero-glow"></div>
        <h1 class="home-hero-title">DINO MUTANT<span>시뮬레이터</span></h1>
        <p class="home-hero-sub">룬 조합부터 전투 결과까지, 미리 계산하고 전략을 세워보세요.</p>
      </button>`;

const HOME_APP_HTML_EN = `      <button type="button" class="home-hero" id="homeHeroBtn">
        <div class="home-hero-glow"></div>
        <h1 class="home-hero-title">DINO MUTANT<span>Simulator</span></h1>
        <p class="home-hero-sub">From rune combinations to battle outcomes — calculate in advance and plan your strategy.</p>
      </button>`;

module.exports = [
  {
    outputFile: "index.html",
    lang: "ko",
    title: "다이노 뮤턴트 시뮬레이터 - 스탯 계산기",
    description: "다이노 뮤턴트의 타이탄/공룡 대전/아레나 결과를 미리 예측할 수 있습니다.",
    canonical: "https://dinomutant-sim.com/",
    hreflang: DEFAULT_HREFLANG,
    appHtml: HOME_APP_HTML_KO,
    // 검색엔진 크롤러(구글봇 등)가 이 루트 페이지를 렌더링할 때 navigator.language가 보통
    // 영어라서, 저장된 dino_lang이 없으면 그 브라우저 언어를 그대로 따라가는 i18n.js의 자동감지
    // 때문에 한국어가 기본인 이 URL이 통째로 영어로 렌더링/색인되던 문제(사용자가 구글 검색결과
    // 스크린샷으로 발견) - en.html이 처음 방문자를 영어로 강제하는 것과 정반대로, 여기서는
    // 크롤러만 한국어로 강제함(실제 사람 방문자는 이 분기를 안 타므로 자동감지가 그대로 유지됨)
    preI18nBlock: `  <!-- 검색엔진 크롤러(구글봇 등)가 이 루트 페이지를 렌더링할 때 navigator.language가 보통
       영어라서(한국어가 기본인 이 URL이 통째로 영어로 색인되던 버그, 구글 검색결과로 발견) 크롤러만
       한국어로 강제함 - 실제 사람 방문자는 이 분기를 안 타므로 js/core/i18n.js의 브라우저 언어
       자동감지가 그대로 유지됨. 알려진 주요 크롤러 UA 토큰만 잡는 방식이라 완벽하진 않음 - 나중에
       또 다른 크롤러가 이 문제를 일으키면 여기 정규식에 추가할 것 -->
  <script>
    if (!localStorage.getItem("dino_lang") && /bot|crawl|spider|yeti|slurp|bingpreview|duckduckbot|baiduspider|yandex/i.test(navigator.userAgent)) {
      localStorage.setItem("dino_lang", "ko");
    }
  </script>
`
  },
  {
    outputFile: "en.html",
    lang: "en",
    title: "Dino Mutant Simulator - Stat Calculator",
    description: "Predict Dino Mutant's Titan, Dino Battle, and Arena results in advance.",
    canonical: "https://dinomutant-sim.com/en",
    hreflang: DEFAULT_HREFLANG,
    appHtml: HOME_APP_HTML_EN,
    preI18nBlock: `  <!-- 이 진입점(/en)으로 처음 들어온 방문자(dino_lang이 아직 저장 안 돼있음)만 영어로 시작하게
       강제함 - 이미 언어를 골라본 적 있는 재방문자는 그 선택을 그대로 존중함(아무것도 안 건드림) -->
  <script>
    if (!localStorage.getItem("dino_lang")) localStorage.setItem("dino_lang", "en");
  </script>
`
  }
];
