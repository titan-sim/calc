// 룬 슬롯 장착/해제 UI. idPrefix로 스코프를 나눠서 한 페이지에 여러 인스턴스를
// 동시에 마운트할 수 있음(예: 공룡 대전 페이지의 "내 공룡"/"상대 공룡" 동시 표시).

function getImgUrl(id) {
  return id
    ? `./assets/rune image folder/${id}.png`
    : "./assets/rune image folder/default.png";
}

const RUNE_STYLE_CONFIG = {
  "#ba0000": ["atk_f", "atk_p", "burst_p", "area_burst_p", "crit_d"],
  "#66bb6a": ["hp_f", "hp_p", "rec_p", "value"],
  "#eb5f0e": ["red_f", "red_p"],
  "#ff9800": ["prob", "turn", "count", "insta_prob"],
  "#29b6f6": ["insta_hp"]
};
const RUNE_COLOR_MAP = {};
for (const [color, keys] of Object.entries(RUNE_STYLE_CONFIG)) {
  keys.forEach((key) => (RUNE_COLOR_MAP[key] = color));
}
const RUNE_TAG_REGEX = /\{(\w+)\}/g;

// desc는 보통 고정 문자열이지만, 특정 레벨부터만 추가되는 설명(예: 즉사, 범위 피해)이 있는 룬은
// 레벨을 인자로 받는 함수로 정의돼 있음 -> 여기서 둘 다 처리
function resolveDesc(rune, level) {
  return typeof rune.desc === "function" ? rune.desc(level) : rune.desc;
}

function getFormattedDesc(runeName, level) {
  const rune = RUNES_DATA[runeName];
  if (!rune || !rune.levels[level]) return "";
  const stats = rune.levels[level];
  return resolveDesc(rune, level).replace(RUNE_TAG_REGEX, (match, key) => {
    const value = stats[key];
    if (value === undefined) return match;
    const color = RUNE_COLOR_MAP[key] || "#fff";
    return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
  });
}

function createRuneUI({ idPrefix = "", onChange = () => {}, unsuitableList = [], unsuitableLabel = "적합하지 않은 룬입니다" } = {}) {
  const id = (name) => idPrefix + name;
  const $ = (name) => document.getElementById(id(name));

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
      divider.textContent = `── ${unsuitableLabel} ──`;
      divider.style.display = hasUnsuitable ? "block" : "none";
    }
    if (unsuitableGrid) unsuitableGrid.style.display = hasUnsuitable ? "" : "none";
    Object.keys(RUNES_DATA).forEach((name) => {
      const r = RUNES_DATA[name];
      const isUn = hasUnsuitable && unsuitableList.includes(name);
      const item = document.createElement("div");
      item.className = "rune-item" + (isUn ? " rune-item-dim" : "");
      item.innerHTML = `<div class="rune-img-container" style="border-color:var(--${r.grade})"><img src="${getImgUrl(r.imgId)}"></div><div class="rune-label">${name}</div>`;
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
    selectedValue.onclick = () => {
      const isOpen = list.style.display === "block";
      document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
      list.style.display = isOpen ? "none" : "block";
    };
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
    $("detailName").innerText = name;
    $("detailGrade").innerText = r.grade;
    $("detailGrade").style.color = `var(--${r.grade})`;
    updateDetail(name, currentLevel);
    detailView.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function updateDetail(name, lv) {
    const r = RUNES_DATA[name];
    const s = r.levels[lv];
    let d = resolveDesc(r, lv) || "";
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
        warnEl.innerText = `⚠️ '${targetToRemove}'과 동시에 장착할 수 없습니다.`;
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
  }

  function removeRuneFromSlot() {
    if (activeSlotIdx === null) return;
    selectedRunes[activeSlotIdx] = null;
    renderSlotContent(activeSlotIdx);
    $("runePicker").style.display = "none";
    onChange(getSelectedRunes());
  }

  function mount() {
    renderSlots();
    renderRuneGrid();
    initLevelSelect();
    $("applyBtn").onclick = applyRuneToSlot;
    $("removeBtn").onclick = removeRuneFromSlot;
  }

  return { mount, getSelectedRunes, setSelectedRunes, renderSlots };
}
