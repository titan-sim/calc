// 룬 슬롯 장착/해제 UI. idPrefix로 스코프를 나눠서 한 페이지에 여러 인스턴스를
// 동시에 마운트할 수 있음(예: 공룡 대전 페이지의 "내 공룡"/"상대 공룡" 동시 표시).

function getImgUrl(id) {
  return id
    ? `./assets/rune image folder/${id}.png`
    : "./assets/rune image folder/default.png";
}

const RUNE_STYLE_CONFIG = {
  "#ba0000": ["atk_f", "atk_p", "atk_p1", "atk_p2", "burst_p", "area_burst_p", "crit_d"],
  "#66bb6a": ["hp_f", "hp_p", "hp_p1", "hp_p2", "rec_p", "rec_f", "value"],
  "#eb5f0e": ["red_f", "red_p"],
  "#ff9800": ["prob", "turn", "count", "insta_prob", "side_tile_count"],
  "#29b6f6": ["insta_hp"]
};
const RUNE_COLOR_MAP = {};
for (const [color, keys] of Object.entries(RUNE_STYLE_CONFIG)) {
  keys.forEach((key) => (RUNE_COLOR_MAP[key] = color));
}
const RUNE_TAG_REGEX = /\{(\w+)\}/g;

function createRuneUI({ idPrefix = "", onChange = () => {}, unsuitableList = [], unsuitableLabel } = {}) {
  const id = (name) => idPrefix + name;
  const $ = (name) => document.getElementById(id(name));
  const resolvedUnsuitableLabel = unsuitableLabel || t("common.rune.defaultUnsuitableLabel");

  let selectedRunes = [null, null, null, null, null];
  let activeSlotIdx = null;
  let tempName = "";
  let currentLevel = 1;

  function setSelectedRunes(runes) {
    selectedRunes = runes.map((r) => (r ? { ...r } : null));
  }
  function getSelectedRunes() {
    return selectedRunes.map((r) => (r ? { ...r } : null));
  }

  function renderSlots() {
    const sc = $("slotContainer");
    sc.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const div = document.createElement("div");
      div.className = "slot";
      div.id = id(`slot-${i}`);
      div.onclick = () => openPicker(i);
      sc.appendChild(div);
      renderSlotContent(i);
    }
  }

  function renderSlotContent(idx) {
    const slot = document.getElementById(id(`slot-${idx}`));
    const rune = selectedRunes[idx];
    if (rune && rune.name && RUNES_DATA[rune.name]) {
      const r = RUNES_DATA[rune.name];
      const lvClass = getLvClass(rune.lv);
      slot.innerHTML = `
        <img src="${getImgUrl(r.imgId)}" class="slot-img">
        <div class="slot-lv-tag ${lvClass}">${rune.lv}</div>
      `;
    } else {
      slot.innerHTML = `<img src="./assets/rune slot image folder/RuneSprite_0.png" class="slot-plus-img">`;
    }
  }

  function renderRuneGrid() {
    const mainGrid = $("mainGrid");
    const unsuitableGrid = $("unsuitableGrid");
    const divider = $("unsuitableDivider");
    mainGrid.innerHTML = "";
    unsuitableGrid.innerHTML = "";
    const hasUnsuitable = unsuitableList.length > 0;
    if (divider) {
      divider.textContent = t("common.rune.unsuitableDividerLabel", { label: resolvedUnsuitableLabel });
      divider.style.display = hasUnsuitable ? "block" : "none";
    }
    if (unsuitableGrid) unsuitableGrid.style.display = hasUnsuitable ? "" : "none";
    Object.keys(RUNES_DATA).forEach((name) => {
      const r = RUNES_DATA[name];
      const isUn = hasUnsuitable && unsuitableList.includes(name);
      const item = document.createElement("div");
      item.className = "rune-item" + (isUn ? " rune-item-dim" : "");
      item.innerHTML = `<div class="rune-img-container" style="border-color:var(--${r.grade})"><img src="${getImgUrl(r.imgId)}"></div><div class="rune-label">${ruleDisplayName(name)}</div>`;
      item.onclick = () => showDetail(name);
      if (isUn) unsuitableGrid.appendChild(item);
      else mainGrid.appendChild(item);
    });
  }

  // 룬 레벨 선택도 다른 커스텀 드롭다운(VIP, 타이탄 레벨 등)과 같은 모양으로 통일 (사이트 기본 <select> 안 씀)
  function setLevel(lv) {
    currentLevel = Number(lv);
    $("levelSelectedValue").textContent = `Lv.${currentLevel}`;
  }

  function initLevelSelect() {
    const list = $("levelList");
    list.innerHTML = "";
    for (let i = 1; i <= 31; i++) {
      const li = document.createElement("li");
      li.textContent = `Lv.${i}`;
      li.onclick = () => {
        setLevel(i);
        list.style.display = "none";
        updateDetail(tempName, currentLevel);
      };
      list.appendChild(li);
    }
    setLevel(currentLevel);

    const selectedValue = $("levelSelectedValue");
    selectedValue.onclick = () => toggleDropdownList(selectedValue, list);
  }

  function openPicker(idx) {
    const picker = $("runePicker");
    const isSameSlot = activeSlotIdx === idx;
    const slots = document.querySelectorAll(`[id^="${idPrefix}slot-"]`);

    if (isSameSlot && picker.style.display === "block") {
      picker.style.display = "none";
      activeSlotIdx = null;
      slots.forEach((s) => s.classList.remove("active"));
    } else {
      activeSlotIdx = idx;
      picker.style.display = "block";
      slots.forEach((s, i) => s.classList.toggle("active", i === idx));

      const savedRune = selectedRunes[idx];
      if (savedRune && savedRune.name) {
        showDetail(savedRune.name);
        if (savedRune.lv) {
          setLevel(savedRune.lv);
          updateDetail(savedRune.name, savedRune.lv);
        }
      } else {
        $("runeDetail").style.display = "none";
      }
      picker.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function showDetail(name) {
    tempName = name;
    $("runeWarning").style.display = "none";
    const r = RUNES_DATA[name];
    const detailView = $("runeDetail");
    detailView.style.display = "block";
    $("detailName").innerText = ruleDisplayName(name);
    $("detailGrade").innerText = gradeDisplayName(r.grade);
    $("detailGrade").style.color = `var(--${r.grade})`;
    updateDetail(name, currentLevel);
    detailView.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function updateDetail(name, lv) {
    const r = RUNES_DATA[name];
    const s = r.levels[lv];
    let d = ruleDisplayDesc(name, lv) || "";
    if (s) {
      d = d.replace(RUNE_TAG_REGEX, (match, key) => {
        const value = s[key];
        if (value === undefined) return match;
        const color = RUNE_COLOR_MAP[key] || "#fff";
        return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
      });
    }
    $("detailDesc").innerHTML = d;
  }

  function applyRuneToSlot() {
    const lv = currentLevel;
    const warnEl = $("runeWarning");

    // 상호 배타 룬 쌍 체크. activeSlotIdx(지금 갈아끼우려는 그 슬롯)는 검사 대상에서 제외해야
    // "이미 매머드의 힘이 꽂혀있는 슬롯을 압축된 힘으로 교체" 같은 정상적인 교체가 막히지 않음
    const conflictPair = MUTUALLY_EXCLUSIVE_RUNE_PAIRS.find((pair) => pair.includes(tempName));
    if (conflictPair) {
      const targetToRemove = conflictPair.find((n) => n !== tempName);
      const hasOpposite = selectedRunes.some((r, idx) => idx !== activeSlotIdx && r && r.name === targetToRemove);
      if (hasOpposite) {
        warnEl.innerText = t("common.rune.mutualExclusionWarning", { runeName: ruleDisplayName(targetToRemove) });
        warnEl.style.display = "block";
        warnEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
    }

    selectedRunes.forEach((rune, idx) => {
      if (rune && rune.name === tempName) {
        selectedRunes[idx] = null;
        renderSlotContent(idx);
      }
    });

    selectedRunes[activeSlotIdx] = { name: tempName, lv: lv };
    renderSlotContent(activeSlotIdx);

    $("runePicker").style.display = "none";
    warnEl.style.display = "none";
    onChange(getSelectedRunes());
    // 모바일에서는 룬 목록이 화면 아래로 펼쳐진 채 장착하면, 목록만 사라지고 스크롤 위치는 그대로라
    // 정작 방금 채운 슬롯이 화면 밖(위쪽)에 남아있어 다시 스크롤해 올려야 했음 - 장착 직후 슬롯
    // 목록 쪽으로 자동 스크롤해서 바로 결과를 보여줌
    $("slotContainer").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function removeRuneFromSlot() {
    if (activeSlotIdx === null) return;
    selectedRunes[activeSlotIdx] = null;
    renderSlotContent(activeSlotIdx);
    $("runePicker").style.display = "none";
    onChange(getSelectedRunes());
    $("slotContainer").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function mount() {
    renderSlots();
    renderRuneGrid();
    initLevelSelect();
    // 슬롯을 하나 눌러 activeSlotIdx가 정해지기 전까지는 목록/상세 둘 다 숨김(어떤 슬롯을
    // 채우는 중인지도 모른 채 목록부터 뜨는 걸 방지)
    $("runePicker").style.display = "none";
    $("runeDetail").style.display = "none";
    $("applyBtn").onclick = applyRuneToSlot;
    $("removeBtn").onclick = removeRuneFromSlot;
  }

  // getSelectedRunes()는 이 안에서만 씀(applyRuneToSlot/removeRuneFromSlot이 onChange에 넘길 때) -
  // 바깥에서 부르는 곳이 없어서(항상 onChange 콜백으로만 결과를 받음) 반환 객체엔 안 담음
  return { mount, setSelectedRunes, renderSlots };
}

// 조합 찾기가 있는 4개 페이지(타이탄/허수아비/건물/공룡 대전)의 "보유 룬 레벨 입력 그리드"(적합 룬
// 전부를 나열하고 각각 레벨을 입력받는 표) - 룬 이름에 공백이 들어있어서(예: "압축된 힘") id
// 속성에 그대로 쓰면 CSS 선택자가 깨지므로 data-rune 속성으로만 식별함. 4페이지가 그리드/결과
// 엘리먼트 id와 적합 룬 목록·불러오기·저장 함수만 다를 뿐 나머지 로직이 완전히 같아서 공용화함
// (사이트 전체 점검에서 발견 - createRuneUI와 같은 이유로 이 파일에 둠. combinationsOf처럼 순수
// 계산이 아니라 DOM을 직접 건드리는 함수라 js/core/stat-calc.js가 아니라 여기에 둠).
function initOwnedRuneGrid({ gridId, resultElId, suitableNames, loadLevels, saveLevels }) {
  const levels = loadLevels();
  const grid = document.getElementById(gridId);
  grid.innerHTML = suitableNames().map((name) => `
    <div class="dummy-owned-rune-row">
      <span class="dummy-owned-rune-name">${ruleDisplayName(name)}</span>
      <input type="tel" inputmode="numeric" class="dummy-owned-rune-level" data-rune="${name}" value="${levels[name] || ""}" placeholder="0">
    </div>
  `).join("");

  grid.querySelectorAll(".dummy-owned-rune-level").forEach((input) => {
    input.oninput = () => { input.value = input.value.replace(/[^0-9]/g, ""); };
    // 엔터 키로도 커밋되게(예전엔 마우스로 다른 빈 공간을 눌러 포커스를 잃어야만 반영됐음 -
    // 사용자 지적) - blur()를 호출하면 아래 onblur 핸들러가 그대로 실행됨
    input.onkeydown = (e) => { if (e.key === "Enter") input.blur(); };
    input.onblur = () => {
      const name = input.dataset.rune;
      const v = Math.max(0, Math.min(31, Number(input.value) || 0));
      input.value = v || "";
      const current = loadLevels();
      current[name] = v;
      saveLevels(current);
      const resultEl = document.getElementById(resultElId);
      if (resultEl) resultEl.innerHTML = "";
    };
  });
}
