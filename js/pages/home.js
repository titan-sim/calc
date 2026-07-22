const HOME_TILES = [
  { href: "#my-dino", title: "내 공룡", desc: "룬 세팅 프리셋 관리", ready: true },
  { href: "#titan", title: "타이탄 시뮬레이터", desc: "보스 전투 결과 예측", ready: true },
  { href: "#dino-battle", title: "공룡 대전", desc: "공룡간 전투 결과 예측", ready: true },
  { href: "#arena", title: "아레나", desc: "5:5 진영전 예측", ready: true },
  { href: "#dummy", title: "허수아비", desc: "허수아비 대상 딜 측정", ready: true },
  { href: "#building", title: "건물", desc: "건물 공략 결과 예측", ready: false }
];

const GAME_DOWNLOAD_LINKS = [
  { label: "Google Play", href: "https://play.google.com/store/apps/details?id=com.mondayoff.dinomutant&pcampaignid=web_share" },
  { label: "App Store", href: "https://apps.apple.com/kr/app/dino-mutant-t-rex/id6451176533" }
];
const GAME_SKIN_PREVIEW_URL = "https://shop.mondayoff.me/dinopark/custom";

function renderHome(container) {
  container.innerHTML = `
    <button type="button" class="home-hero" id="homeHeroBtn">
      <div class="home-hero-glow"></div>
      <h1 class="home-hero-title">DINO MUTANT<span>시뮬레이터</span></h1>
      <p class="home-hero-sub">룬 조합부터 전투 결과까지, 미리 계산하고 전략을 세워보세요.</p>
    </button>
    <div class="home-bento">
      ${HOME_TILES.map((t, i) => `
        <a class="home-tile ${t.ready ? "home-tile-main" : "home-tile-soon"}" href="${t.href}" style="--i:${i}">
          ${t.ready ? `
            <div class="home-tile-edge home-tile-edge-r"></div>
            <div class="home-tile-edge home-tile-edge-l"></div>
            <div class="home-tile-edge home-tile-edge-b"></div>
            <div class="home-tile-edge home-tile-edge-t"></div>
          ` : ""}
          <div class="home-tile-title">${t.title}</div>
          <div class="home-tile-desc">${t.desc}${t.ready ? "" : ' <span class="nav-soon-tag">준비 중</span>'}</div>
        </a>
      `).join("")}
    </div>

    <div class="friend-picker-overlay" id="gameInfoOverlay" style="display:none;">
      <div class="friend-picker-modal game-info-modal">
        <div class="friend-picker-header">
          <span>다이노 뮤턴트 시뮬레이터</span>
          <button class="close-btn" id="gameInfoClose">✕</button>
        </div>
        <p class="game-info-desc">
          룬 조합, 별자리, 둥지·알스킨 등 다양한 설정을 바탕으로 공룡의 전투력과 대전 결과를 미리
          계산해볼 수 있는 도구입니다. 본 사이트는 게임 "다이노 뮤턴트"의 공식 사이트가 아니며,
          게임 개발사·배급사와 관련이 없는 개인이 만든 비공식 팬메이드 시뮬레이터입니다.
        </p>
        <div class="game-info-section">
          <div class="game-info-section-title">공식 게임 다운로드</div>
          <div class="game-info-links">
            ${GAME_DOWNLOAD_LINKS.map((l) => `<a class="game-info-link-btn" href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}</a>`).join("")}
          </div>
        </div>
        <div class="game-info-section">
          <div class="game-info-section-title">공룡 스킨 미리보기 (게임사 공식)</div>
          <div class="game-info-links">
            <a class="game-info-link-btn" href="${GAME_SKIN_PREVIEW_URL}" target="_blank" rel="noopener noreferrer">스킨 미리보기 사이트</a>
          </div>
        </div>
      </div>
    </div>
  `;

  initHomeTileTilt();

  const overlay = document.getElementById("gameInfoOverlay");
  document.getElementById("homeHeroBtn").onclick = () => { overlay.style.display = "flex"; };
  document.getElementById("gameInfoClose").onclick = () => { overlay.style.display = "none"; };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = "none"; };
}

// 데스크톱(마우스 포인터 있는 환경)에서만 카드가 커서를 향해 기울어지는 유리판 3D 틸트 효과.
// 터치 기기는 mousemove가 의미 없어서 아예 리스너를 안 닮.
// --shadow-x/y는 그림자를 카드가 들리는 반대 방향으로 밀어서 실제로 그 방향으로 뜬 것 같은
// 깊이감을 줌(CSS의 box-shadow가 이 값을 씀)
function initHomeTileTilt() {
  if (!window.matchMedia("(pointer: fine)").matches) return;

  document.querySelectorAll(".home-tile-main").forEach((tile) => {
    tile.addEventListener("mousemove", (e) => {
      const rect = tile.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const tiltX = (px - 0.5) * 2; // -1..1
      const tiltY = (py - 0.5) * 2; // -1..1
      const rotateY = tiltX * 18;
      const rotateX = -tiltY * 18;
      // perspective를 카드 폭보다 작게 잡아서 원근 왜곡(사각형이 사다리꼴로 찌그러지는 것)이
      // 눈에 뚜렷하게 보이게 함 - 이전엔 700px이라 거의 안 보였음
      tile.style.transform = `perspective(420px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px) scale(1.02)`;
      tile.style.setProperty("--shadow-x", `${-tiltX * 18}px`);
      tile.style.setProperty("--shadow-y", `${18 - tiltY * 14}px`);
    });
    tile.addEventListener("mouseleave", () => {
      tile.style.transform = "";
      tile.style.removeProperty("--shadow-x");
      tile.style.removeProperty("--shadow-y");
    });
  });
}
