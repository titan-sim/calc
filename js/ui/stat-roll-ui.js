// 공용 "숫자 롤링" 애니메이션 - 스탯 요약바 값이 바뀔 때(사용자가 설정을 수정해서) 값이 커지면
// 초록, 작아지면 빨강으로 잠깐 강조되면서, 바뀐 자릿수만 그 자릿수 스트립(0~9)이 옛 숫자에서 새
// 숫자로 굴러가듯 넘어감(오도미터 방식) - 안 바뀐 자릿수/콤마/%/단위 접미사는 그대로 정적 텍스트.
// 문자열을 "숫자 덩어리"와 "그 외" 토큰으로 나눠서 숫자 덩어리별로 오른쪽 정렬 후 자릿수 비교함 -
// "3.00% / 105.00%"처럼 숫자가 여러 개 섞인 문자열도 각 숫자가 서로 안 섞이고 독립적으로 굴러감.

function statRollTokenize(text) {
  return text.match(/\d[\d,]*\.?\d*|[^\d]+/g) || [text];
}

function statRollAppendDigit(container, fromDigit, toDigit) {
  const box = document.createElement("span");
  box.className = "stat-roll-digit";
  const strip = document.createElement("span");
  strip.className = "stat-roll-strip";
  for (let d = 0; d <= 9; d++) {
    const glyph = document.createElement("span");
    glyph.textContent = String(d);
    strip.appendChild(glyph);
  }
  strip.style.transform = `translateY(${-fromDigit * 1.1}em)`;
  box.appendChild(strip);
  container.appendChild(box);
  // 리플로우가 먼저 끝난 뒤(from 위치로 그려진 뒤) 목표 위치로 트랜지션이 걸리게 두 프레임 뒤로 미룸
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { strip.style.transform = `translateY(${-toDigit * 1.1}em)`; });
  });
}

// el의 표시값을 newText로 바꾸되, 값이 실제로 달라졌을 때만 롤링 애니메이션으로 바꿈(같으면 아무 것도
// 안 함 - 매번 갱신되는 다른 스탯들 때문에 관계없는 값까지 애니메이션되지 않도록). el.dataset.
// statRollRaw에 마지막으로 표시한 "진짜" 문자열을 저장해둬서, DOM이 롤링용 <span>들로 쪼개진 뒤에도
// (el.textContent로는 원래 문자열을 그대로 못 읽으므로) 다음 비교 기준을 안전하게 유지함.
let statRollTokenSeq = 0;

function animateStatValue(el, newText) {
  if (!el) return;
  const oldText = el.dataset.statRollRaw !== undefined ? el.dataset.statRollRaw : el.textContent;
  el.dataset.statRollRaw = newText;
  if (oldText === newText) return;

  const oldNum = parseFloat(String(oldText).replace(/[^0-9.\-]/g, ""));
  const newNum = parseFloat(String(newText).replace(/[^0-9.\-]/g, ""));
  const increased = !Number.isNaN(oldNum) && !Number.isNaN(newNum) ? newNum >= oldNum : true;

  el.innerHTML = "";
  el.classList.remove("stat-roll-up", "stat-roll-down");
  void el.offsetWidth; // 강제 리플로우 - 연달아 바뀌어도 강조 애니메이션이 매번 처음부터 재생되게 함
  el.classList.add(increased ? "stat-roll-up" : "stat-roll-down");
  // css/my-dino.css의 stat-roll-flash-up/down 애니메이션 시간(0.9s)과 맞춤 - 사용자 요청으로
  // 카운트 모션을 조금 늘림
  setTimeout(() => el.classList.remove("stat-roll-up", "stat-roll-down"), 900);

  const oldTokens = statRollTokenize(String(oldText));
  const newTokens = statRollTokenize(String(newText));

  newTokens.forEach((newTok, i) => {
    if (!/\d/.test(newTok)) { el.appendChild(document.createTextNode(newTok)); return; }
    const oldTok = /\d/.test(oldTokens[i] || "") ? oldTokens[i] : "";
    const oldChars = oldTok.split("");
    const newChars = newTok.split("");
    const maxLen = Math.max(oldChars.length, newChars.length);
    const oldPadded = Array(maxLen - oldChars.length).fill(null).concat(oldChars);
    const newPadded = Array(maxLen - newChars.length).fill(null).concat(newChars);
    newPadded.forEach((newCh, j) => {
      // newCh가 null이면 padding 자리(새 숫자가 옛 숫자보다 자릿수가 적어서 이 위치엔 대응하는
      // 문자가 아예 없음 - 예: "11,704"(6자) -> "7,011"(5자)) - 그대로 두면 /\d/.test(null)이
      // "null" 문자열로 강제 변환돼 digit도 아니라고 판정되고, else 분기의
      // document.createTextNode(null)이 문자 그대로 "null"을 화면에 찍어버리는 버그가 있었음
      // (건물 페이지 "관련 수치" 카드에서 큰 값 -> 작은 값으로 바뀔 때 실제로 재현됨) - 대응하는
      // 새 문자가 없는 자리는 그냥 건너뜀
      if (newCh === null) return;
      const oldCh = oldPadded[j];
      if (/\d/.test(newCh)) {
        statRollAppendDigit(el, oldCh && /\d/.test(oldCh) ? Number(oldCh) : Number(newCh), Number(newCh));
      } else {
        el.appendChild(document.createTextNode(newCh)); // 콤마/소수점 - 정적
      }
    });
  });

  // 굴러가는 <span> 더미를 그대로 두면 el.textContent가 자릿수 스트립(0~9) 전체를 이어붙인 값이
  // 돼버려서(스크린리더/텍스트 선택 등에서 깨진 값이 읽힘) 트랜지션이 끝난 뒤 원래 문자열 하나로
  // 되돌림 - 그 사이에 또 다른 값 변경이 들어와 이 el을 다시 그렸다면(토큰 불일치) 덮어쓰지 않음
  const token = String(++statRollTokenSeq);
  el.dataset.statRollToken = token;
  // css/my-dino.css의 .stat-roll-strip transition(0.85s)이 다 끝난 뒤에 되돌려야 롤링이 덜 끝난
  // 채로 텍스트가 끊겨 보이지 않음 - 사용자 요청으로 모션을 늘리면서 같이 동기화(0.55s->0.85s에
  // 맞춰 600ms->850ms)
  setTimeout(() => {
    if (el.dataset.statRollToken === token) el.textContent = newText;
  }, 850);
}

// "관련 수치" 카드(h2 + .metrics-grid + .metric-tile들 + 클릭 시 펼쳐지는 .metric-detail) 공용
// 마크업 - 타이탄/건물 페이지가 같은 모양을 각자 손으로 중복 작성하고 있었음(사용자 지적 - "관련
// 수치 카드 자체 양식을 만들어서 공유해", "페이지마다 어디에 뭘 채울지 정하기만 하면 되는거잖아").
// 페이지는 타일 목록(각 타일의 id/label/data-metric용 key)과 그리드/디테일 컨테이너 id만 넘기면
// 됨 - 타일 클릭 시 펼쳐지는 세부 내역(수식 브레이크다운)은 페이지마다 계산 방식이 달라서 그대로
// 페이지 쪽 로직(각자의 metric-detail 렌더 함수)에 남겨둠, 여기선 마크업 뼈대만 공용화
function renderMetricsCard(gridId, detailId, tiles) {
  const tileHtml = tiles.map((tile) => `
        <button type="button" class="metric-tile" data-metric="${tile.key}">
          <div class="metric-label">${tile.label}</div>
          <div class="metric-value" id="${tile.id}">0</div>
        </button>`).join("");
  return `
    <div class="card">
      <h2>${t("common.relatedMetricsTitle")}</h2>
      <div class="metrics-grid" id="${gridId}">${tileHtml}
      </div>
      <div class="metric-detail" id="${detailId}" style="display:none;"></div>
    </div>`;
}

// 관련 수치 타일 하나의 값을 갱신 - NaN/undefined/null은 항상 0으로 정리하고(표시용 숫자를 다루는
// 곳이므로 "NaN"/"null" 글자가 그대로 노출되는 일이 없게 함), animateStatValue로 오도미터 롤링 +
// 색 플래시 모션을 줌(css/titan.css의 .metric-value.stat-roll-up/down이 전역 스타일이라 어느
// 페이지의 .metric-value든 동일하게 적용됨). 건물 페이지에서 먼저 쓰던 걸 타이탄에도 통일(사용자
// 지적 - "모든 페이지의 관련 수치에 모션을 넣어줘")
function setMetricTileValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const safeValue = Number.isFinite(value) ? value : 0;
  animateStatValue(el, Math.round(safeValue).toLocaleString());
}
