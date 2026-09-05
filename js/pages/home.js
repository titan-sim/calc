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
  document.getElementById("homeHeroBtn").onclick = () => { overlay.style.display = "flex"; lockBodyScroll(); };
  document.getElementById("gameInfoClose").onclick = () => { overlay.style.display = "none"; unlockBodyScroll(); };
  overlay.onclick = (e) => { if (e.target === overlay) { overlay.style.display = "none"; unlockBodyScroll(); } };
}

// 유리판 3D 틸트 - 카드 위에 커서가 있을 때만 그 카드 하나가 반응하던 예전 방식과 달리, 화면 어디서
// 포인터/터치가 움직이든 "홈의 카드 전부"가 동시에 그 좌표 쪽을 향해 기울어짐(다들 같은 광원을 보는
// 것처럼). Pointer Events로 마우스/터치/펜을 한 코드로 처리(터치도 지원 - 예전엔 아예 리스너를 안
// 달았음). 카드마다 매번 getBoundingClientRect를 다시 재는 대신 rAF로 프레임당 한 번만 갱신함.
const HOME_TILT_MAX_ANGLE = 2; // deg - 너무 크면 만화같아 보여서 자제(14deg가 과하다는 피드백으로 낮춤)
const HOME_TILT_FALLOFF_PX = 820; // 포인터에서 이만큼 멀어지면 거의 안 기울어짐
const HOME_TILT_MIN_INTENSITY = 0.15; // 아무리 멀어도 완전히 죽지는 않게(전부 반응한다는 느낌 유지)

let homeTiltPointerX = null;
let homeTiltPointerY = null;
let homeTiltRafId = null;
let homeTiltMoveHandler = null;
let homeTiltReleaseHandler = null;

function initHomeTileTilt() {
  // #home을 재방문할 때마다 document 리스너가 쌓이지 않도록 항상 먼저 정리
  teardownHomeTileTilt();

  const tiles = Array.from(document.querySelectorAll(".home-tile-main"));
  if (!tiles.length) return;

  const scheduleUpdate = () => {
    if (homeTiltRafId != null) return;
    homeTiltRafId = requestAnimationFrame(() => {
      homeTiltRafId = null;
      applyHomeTileTilt(tiles, homeTiltPointerX, homeTiltPointerY);
    });
  };

  // 다른 페이지로 이동한 뒤에도 이 document 리스너가 계속 붙어있는 걸 막기 위해(리스너 누수),
  // 이동 후 첫 포인터 이벤트에서 바로 스스로 정리하고 빠짐 - router.js가 라우트를 그릴 때마다
  // body.dataset.page를 갱신해주는 걸 그대로 이용함
  homeTiltMoveHandler = (e) => {
    if (document.body.dataset.page !== "home") { teardownHomeTileTilt(); return; }
    homeTiltPointerX = e.clientX;
    homeTiltPointerY = e.clientY;
    scheduleUpdate();
  };

  // 마우스는 버튼을 떼도(클릭) 커서가 화면 위 어딘가에 그대로 있으니 유지하고, 터치가 끝나거나
  // 포인터가 화면 밖으로 나갔을 때만 전부 평평한 상태로 되돌림
  homeTiltReleaseHandler = (e) => {
    if (document.body.dataset.page !== "home") { teardownHomeTileTilt(); return; }
    if (e.type === "pointerleave" || e.pointerType !== "mouse") {
      homeTiltPointerX = null;
      homeTiltPointerY = null;
      resetHomeTileTilt(tiles);
    }
  };

  document.addEventListener("pointermove", homeTiltMoveHandler, { passive: true });
  document.addEventListener("pointerdown", homeTiltMoveHandler, { passive: true });
  document.addEventListener("pointerup", homeTiltReleaseHandler, { passive: true });
  document.addEventListener("pointercancel", homeTiltReleaseHandler, { passive: true });
  document.addEventListener("pointerleave", homeTiltReleaseHandler, { passive: true });
}

function teardownHomeTileTilt() {
  if (homeTiltMoveHandler) {
    document.removeEventListener("pointermove", homeTiltMoveHandler);
    document.removeEventListener("pointerdown", homeTiltMoveHandler);
  }
  if (homeTiltReleaseHandler) {
    document.removeEventListener("pointerup", homeTiltReleaseHandler);
    document.removeEventListener("pointercancel", homeTiltReleaseHandler);
    document.removeEventListener("pointerleave", homeTiltReleaseHandler);
  }
  if (homeTiltRafId != null) { cancelAnimationFrame(homeTiltRafId); homeTiltRafId = null; }
  homeTiltMoveHandler = null;
  homeTiltReleaseHandler = null;
}

// 카드 중심 -> 포인터 방향 벡터(nx, ny, -1..1)를 그대로 rotateY/rotateX 각도비로 씀(포인터가 오른쪽에
// 있으면 오른쪽 옆면이 보는 사람 쪽으로 들리는 방향). --edge-glow-*는 같은 방향값을 재사용해서, 딱
// 포인터를 향해 들린 그 옆면(유리 모서리)만 css/home.css의 ::after가 살짝 빛나게 함(광원이 그
// 방향에 있는 것처럼) - 나머지 세 면은 0이라 안 빛남. 이 자리에서 이미 각 타일의 rect를 구하고
// 있으므로, 포인터가 실제로 그 rect 안에 들어와 있는지도 같이 판정해서 home-tile-focused 클래스를
// 딱 그 카드에만 붙임(css/home.css의 :hover와 같은 강조를 받음) - 터치는 :hover가 안정적으로 안
// 잡히므로 이 판정이 유일한 강조 수단이 됨.
function applyHomeTileTilt(tiles, pointerX, pointerY) {
  if (pointerX == null) return;
  tiles.forEach((tile) => {
    const rect = tile.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = pointerX - cx;
    const dy = pointerY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const intensity = Math.max(HOME_TILT_MIN_INTENSITY, 1 - dist / HOME_TILT_FALLOFF_PX);
    const rotateY = nx * HOME_TILT_MAX_ANGLE * intensity;
    const rotateX = -ny * HOME_TILT_MAX_ANGLE * intensity;
    tile.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(${(-4 * intensity).toFixed(2)}px) scale(${(1 + 0.015 * intensity).toFixed(3)})`;
    tile.style.setProperty("--shadow-x", `${(-nx * 16 * intensity).toFixed(2)}px`);
    tile.style.setProperty("--shadow-y", `${(10 - ny * 12 * intensity).toFixed(2)}px`);
    tile.style.setProperty("--edge-glow-r", Math.max(0, nx * intensity).toFixed(3));
    tile.style.setProperty("--edge-glow-l", Math.max(0, -nx * intensity).toFixed(3));
    tile.style.setProperty("--edge-glow-b", Math.max(0, ny * intensity).toFixed(3));
    tile.style.setProperty("--edge-glow-t", Math.max(0, -ny * intensity).toFixed(3));
    const isFocused = pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
    tile.classList.toggle("home-tile-focused", isFocused);
  });
}

function resetHomeTileTilt(tiles) {
  tiles.forEach((tile) => {
    tile.style.transform = "";
    tile.style.removeProperty("--shadow-x");
    tile.style.removeProperty("--shadow-y");
    tile.style.removeProperty("--edge-glow-r");
    tile.style.removeProperty("--edge-glow-l");
    tile.style.removeProperty("--edge-glow-b");
    tile.style.removeProperty("--edge-glow-t");
    tile.classList.remove("home-tile-focused");
  });
}
