function renderHome(container) {
  container.innerHTML = `
    <div class="card">
      <h2>시뮬레이터 선택</h2>
      <div class="home-grid">
        <a class="home-card" href="#my-dino">
          <div class="home-card-title">내 공룡</div>
          <div class="home-card-desc">룬 세팅 프리셋 관리</div>
        </a>
        <a class="home-card" href="#titan">
          <div class="home-card-title">타이탄 시뮬레이터</div>
          <div class="home-card-desc">보스 전투 결과 예측</div>
        </a>
        <a class="home-card home-card-soon" href="#dino-battle">
          <div class="home-card-title">공룡 대전</div>
          <div class="home-card-desc">공룡간 전투 결과 예측 (준비 중)</div>
        </a>
        <a class="home-card home-card-soon" href="#arena">
          <div class="home-card-title">아레나</div>
          <div class="home-card-desc">5:5 진영전 예측 (준비 중)</div>
        </a>
        <a class="home-card home-card-soon" href="#dummy">
          <div class="home-card-title">허수아비</div>
          <div class="home-card-desc">허수아비 대상 딜 측정 (준비 중)</div>
        </a>
        <a class="home-card home-card-soon" href="#building">
          <div class="home-card-title">건물</div>
          <div class="home-card-desc">건물 공략 결과 예측 (준비 중)</div>
        </a>
      </div>
    </div>
  `;
}
