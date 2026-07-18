const HOME_TILES = [
  { href: "#my-dino", title: "내 공룡", desc: "룬 세팅 프리셋 관리", ready: true },
  { href: "#titan", title: "타이탄 시뮬레이터", desc: "보스 전투 결과 예측", ready: true },
  { href: "#dino-battle", title: "공룡 대전", desc: "공룡간 전투 결과 예측", ready: true },
  { href: "#arena", title: "아레나", desc: "5:5 진영전 예측", ready: true },
  { href: "#dummy", title: "허수아비", desc: "허수아비 대상 딜 측정", ready: false },
  { href: "#building", title: "건물", desc: "건물 공략 결과 예측", ready: false }
];

function renderHome(container) {
  container.innerHTML = `
    <div class="home-hero">
      <div class="home-hero-glow"></div>
      <h1 class="home-hero-title">DINO MUTANT<span>시뮬레이터</span></h1>
      <p class="home-hero-sub">룬 조합부터 전투 결과까지, 미리 계산하고 전략을 세워보세요.</p>
    </div>
    <div class="home-bento">
      ${HOME_TILES.map((t, i) => `
        <a class="home-tile ${t.ready ? "home-tile-main" : "home-tile-soon"}" href="${t.href}" style="--i:${i}">
          ${t.ready ? '<div class="home-tile-glare"></div>' : ""}
          <div class="home-tile-title">${t.title}</div>
          <div class="home-tile-desc">${t.desc}${t.ready ? "" : ' <span class="nav-soon-tag">준비 중</span>'}</div>
        </a>
      `).join("")}
    </div>
  `;

  initHomeTileTilt();
}

// 데스크톱(마우스 포인터 있는 환경)에서만 카드가 커서를 향해 살짝 기울어지는 3D 틸트 효과.
// 터치 기기는 mousemove가 의미 없어서 아예 리스너를 안 닮.
function initHomeTileTilt() {
  if (!window.matchMedia("(pointer: fine)").matches) return;

  document.querySelectorAll(".home-tile-main").forEach((tile) => {
    tile.addEventListener("mousemove", (e) => {
      const rect = tile.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 10;
      const rotateX = (0.5 - py) * 10;
      tile.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      tile.style.setProperty("--glare-x", `${px * 100}%`);
      tile.style.setProperty("--glare-y", `${py * 100}%`);
    });
    tile.addEventListener("mouseleave", () => {
      tile.style.transform = "";
    });
  });
}
