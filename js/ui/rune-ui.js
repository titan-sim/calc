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

// 룬 레벨은 "슬롯/프리셋"이 아니라 "그 룬 자체"(=보유한 아이템)의 속성(사용자 확정) - 그래서
// (1) 목록에 그 룬을 몇 레벨 보유했는지 항상 보여줘야 하고(getSuggestedLevel), (2) 레벨 드롭다운
// 에서 레벨을 "고르는" 그 순간 바로 보유 레벨로 반영돼야 함 - "적용" 버튼으로 슬롯에 장착하는 것과
// 별개 결정이라, 장착까지 안 가고 목록만 닫아도 방금 고친 레벨은 남아있어야 함(사용자 확정: "목록
// 에서 레벨을 수정했을 때 반영이 되었으면 한다" - 예전엔 장착을 확정해야만 레벨이 반영되는 버그가
// 있었음). 이 컴포넌트 자신은 지금 열려있는 5슬롯만 알 뿐 "보유 룬 레벨"이라는 더 큰 개념을 모르므로,
// 조회(getSuggestedLevel)와 "이 레벨로 확정됐다"는 통지(onRuneLevelChanged - 레벨 드롭다운 선택
// 시점과 장착 확정 시점 둘 다에서 호출됨)를 호출자(my-dino-page.js/arena-page.js)에게 위임함.
// 기본값(no-op)은 항상 null/아무 일도 안 함이라 이 옵션을 안 넘기는 호출부(있다면)는 그냥
// "제안 없음"으로 동작함
function defaultGetSuggestedLevel() { return null; }
function defaultOnRuneLevelChanged() {}

function createRuneUI({
  idPrefix = "",
  onChange = () => {},
  unsuitableList = [],
  unsuitableLabel,
  getSuggestedLevel = defaultGetSuggestedLevel,
  onRuneLevelChanged = defaultOnRuneLevelChanged
} = {}) {
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
      const suggestedLv = getSuggestedLevel(name);
      // 레벨이 한 번도 설정된 적 없는 룬 = 아직 보유하지 않은 룬으로 취급(사용자 확정) - 부적합
      // 룬 취급(.rune-item-dim)보다는 약하게 죽여서 "적합하지만 아직 없음"과 "이 컨텍스트엔 애초에
      // 안 맞음"을 구분되게 보여줌. 레벨이 하나라도(1이라도) 설정되면 바로 원래 색으로 돌아옴
      const isOwned = !!suggestedLv;
      const item = document.createElement("div");
      item.className = "rune-item" + (isUn ? " rune-item-dim" : "") + (isOwned ? "" : " rune-item-unowned");
      const lvTag = suggestedLv ? `<div class="slot-lv-tag ${getLvClass(suggestedLv)}">${suggestedLv}</div>` : "";
      item.innerHTML = `<div class="rune-img-container" style="border-color:var(--${r.grade})"><img src="${getImgUrl(r.imgId)}">${lvTag}</div><div class="rune-label">${ruleDisplayName(name)}</div>`;
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
        // 레벨을 고른 순간 바로 "보유 레벨"로 반영 - "적용" 버튼을 눌러 슬롯에 장착하지 않고
        // 목록을 닫거나 다른 프리셋으로 이동해도 방금 고친 레벨 자체는 남아있어야 함(사용자 확정:
        // "목록에서 레벨을 수정했을 때 반영이 되었으면 한다") - 장착 여부와 레벨 소유는 별개 결정
        onRuneLevelChanged(tempName, i);
        renderRuneGrid();
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
    // 이 룬이 다른 프리셋에 이미 있으면 그 레벨을 기본값으로 채움(위 getSuggestedLevel 참고) -
    // 이미 장착된 슬롯을 다시 열 때는 openPicker가 이 호출 바로 다음에 실제 슬롯 레벨로 다시
    // 덮어쓰므로("장착된 그대로" 우선), 여기서는 "새로 고르는 상황"의 기본값만 책임짐
    setLevel(getSuggestedLevel(name) || 1);
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
    // 같은 룬을 쓰는 다른 프리셋들도 이 레벨로 맞춰달라고 호출자에게 통지(같은 아이템이니 레벨도
    // 하나 - 위 getSuggestedLevel/onRuneLevelChanged 설명 참고), 목록의 레벨 배지도 바로 갱신
    onRuneLevelChanged(tempName, lv);
    renderRuneGrid();

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
// 이 그리드는 더 이상 페이지별 독립 저장소를 갖지 않음 - "내 공룡" 프로필의 보유 룬 레벨
// (profile.ownedRuneLevels, getOwnedRuneLevel/setOwnedRuneLevel)을 그대로 읽고 쓰는 창일 뿐임
// (사용자 확정: "그냥 목록에 되어있는 대로 보유한 룬과 해당 룬들의 레벨만 적용시켜" - "이미 값이
// 있으면 안 건드린다"는 예전 프리필/보존 절충안은 여기서 직접 편집해도 룬 목록과 어긋날 일이
// 없도록 폐기함). 그래서 이 그리드에서 입력을 바꾸면 룬 목록/다른 조합 찾기 페이지에도 즉시 같은
// 값이 반영됨(같은 원본을 보는 것뿐이라 당연함)
function initOwnedRuneGrid({ gridId, resultElId, suitableNames }) {
  const levels = loadOwnedRuneLevelsFromProfile(suitableNames());
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
      const profile = loadMyDinoProfile();
      if (v > 0) {
        setOwnedRuneLevel(profile, name, v);
      } else if (profile.ownedRuneLevels) {
        // 0으로 지움 = "여기서 직접 설정했던 값"을 취소 - 장착돼 있는 프리셋이 있으면 그쪽에서
        // 다시 값을 가져옴(getOwnedRuneLevel의 프리셋 스캔 폴백), 없으면 완전히 미보유로 돌아감
        delete profile.ownedRuneLevels[name];
      }
      saveMyDinoProfile(profile);
      const resultEl = document.getElementById(resultElId);
      if (resultEl) resultEl.innerHTML = "";
    };
  });
}
