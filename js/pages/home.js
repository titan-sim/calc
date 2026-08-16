const HOME_TILES = [
  { href: "#my-dino", titleKey: "home.tile.myDino.title", descKey: "home.tile.myDino.desc", ready: true },
  { href: "#titan", titleKey: "home.tile.titan.title", descKey: "home.tile.titan.desc", ready: true },
  { href: "#dino-battle", titleKey: "home.tile.dinoBattle.title", descKey: "home.tile.dinoBattle.desc", ready: true },
  { href: "#arena", titleKey: "home.tile.arena.title", descKey: "home.tile.arena.desc", ready: true },
  { href: "#dummy", titleKey: "home.tile.dummy.title", descKey: "home.tile.dummy.desc", ready: true },
  { href: "#building", titleKey: "home.tile.building.title", descKey: "home.tile.building.desc", ready: true }
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
      <h1 class="home-hero-title">DINO MUTANT<span>${t("home.heroTitleSuffix")}</span></h1>
      <p class="home-hero-sub">${t("home.heroSub")}</p>
    </button>
    <div class="home-bento">
      ${HOME_TILES.map((tile, i) => `
        <a class="home-tile ${tile.ready ? "home-tile-main" : "home-tile-soon"}" href="${tile.href}" style="--i:${i}">
          ${tile.ready ? `
            <div class="home-tile-edge home-tile-edge-r"></div>
            <div class="home-tile-edge home-tile-edge-l"></div>
            <div class="home-tile-edge home-tile-edge-b"></div>
            <div class="home-tile-edge home-tile-edge-t"></div>
          ` : ""}
          <div class="home-tile-title">${t(tile.titleKey)}</div>
          <div class="home-tile-desc">${t(tile.descKey)}${tile.ready ? "" : ` <span class="nav-soon-tag">${t("home.tile.soonTag")}</span>`}</div>
        </a>
      `).join("")}
    </div>

    <div class="friend-picker-overlay" id="gameInfoOverlay" style="display:none;">
      <div class="friend-picker-modal game-info-modal">
        <div class="friend-picker-header">
          <span>${t("home.gameInfoModal.title")}</span>
          <button class="close-btn" id="gameInfoClose">✕</button>
        </div>
        <p class="game-info-desc">
          ${t("home.gameInfoModal.desc")}
        </p>
        <div class="game-info-section">
          <div class="game-info-section-title">${t("home.gameInfoModal.downloadSectionTitle")}</div>
          <div class="game-info-links">
            ${GAME_DOWNLOAD_LINKS.map((l) => `<a class="game-info-link-btn" href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}</a>`).join("")}
          </div>
        </div>
        <div class="game-info-section">
          <div class="game-info-section-title">${t("home.gameInfoModal.skinSectionTitle")}</div>
          <div class="game-info-links">
            <a class="game-info-link-btn" href="${GAME_SKIN_PREVIEW_URL}" target="_blank" rel="noopener noreferrer">${t("home.gameInfoModal.skinLinkLabel")}</a>
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
