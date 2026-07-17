// "내 공룡" 페이지 = 공룡 하나의 현재 상태를 설정하는 곳.
// 기본 스탯 / 별자리 / 둥지·알스킨 / 룬 조합 4개 섹션. 룬 조합만 여러 개 프리셋으로 저장 가능.
// options.storageKey / options.idPrefix를 다르게 주면 한 페이지에 여러 인스턴스를 동시에 띄울 수
// 있음(예: 공룡 대전 페이지의 "내 공룡"/"상대 공룡"). 기본값은 지금까지와 완전히 동일하게 동작함.
const MY_DINO_PROFILE_KEY = "dino_my_profile";

const RUNE_PRESET_COUNT = 9;

function defaultRunePresets() {
  return Array.from({ length: RUNE_PRESET_COUNT }, (_, i) => ({
    name: `프리셋 ${i + 1}`,
    runes: [null, null, null, null, null]
  }));
}

function defaultMyDinoProfile() {
  return {
    baseAtk: 1,
    baseHp: 10,
    moveSpeed: 1,
    vip: 0,
    dinoCount: 5,
    constellation: {
      hp: 0, atk: 0, critRate: 0, critDmg: 0, buildingDmg: 0, stewEffect: 0,
      moveSpeed: 0, bossDmgReduction: 0, bossDmgIncrease: 0
    },
    bonusPercent: { atk: 0, hp: 0 },
    runes: [null, null, null, null, null],
    runePresets: defaultRunePresets(),
    activePresetIndex: 0
  };
}

function loadMyDinoProfile(storageKey = MY_DINO_PROFILE_KEY) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return defaultMyDinoProfile();
    const profile = { ...defaultMyDinoProfile(), ...saved };
    // 별자리 항목이 나중에 추가된 경우 대비: 얕은 병합 대신 필드 단위로 병합
    profile.constellation = { ...defaultMyDinoProfile().constellation, ...(saved.constellation || {}) };
    // 프리셋 도입 이전 저장분: 기존 룬 조합을 1번 프리셋으로 이관
    if (!saved.runePresets) {
      profile.runePresets = defaultRunePresets();
      if (saved.runes && saved.runes.some((r) => r)) {
        profile.runePresets[0].runes = saved.runes;
      }
    }
    // 압축된 힘/매머드의 힘처럼 동시 장착이 불가능한 룬 쌍이 저장 데이터에 섞여 있으면 정리
    // (수동 localStorage 편집, 예전 버전 저장분 등으로 꼬였을 가능성 방어)
    profile.runePresets.forEach((preset) => { preset.runes = sanitizeRuneConflicts(preset.runes); });
    profile.runes = sanitizeRuneConflicts(profile.runes);
    return profile;
  } catch (e) {
    return defaultMyDinoProfile();
  }
}

function saveMyDinoProfile(profile, storageKey = MY_DINO_PROFILE_KEY) {
  localStorage.setItem(storageKey, JSON.stringify(profile));
  // 서버 동기화는 "내 공룡"(로그인한 유저 본인의 데이터)에만 해당됨. 공룡 대전의 "상대 공룡"처럼
  // 다른 storageKey를 쓰는 가상의 비교용 프로필은 동기화 대상이 아니라서 이 기기에만 남음.
  if (storageKey === MY_DINO_PROFILE_KEY && typeof queueRemoteSync === "function") {
    queueRemoteSync(profile);
  }
}

// 다른 페이지(타이탄, 공룡 대전 등)가 시뮬레이션 엔진에 바로 넣을 수 있는 형태로 변환
function getMyDinoBattleInputs(storageKey = MY_DINO_PROFILE_KEY) {
  const p = loadMyDinoProfile(storageKey);
  return {
    baseAtk: p.baseAtk,
    baseHp: p.baseHp,
    count: p.dinoCount,
    moveSpeed: p.moveSpeed,
    selectedRunes: p.runes,
    constellation: p.constellation,
    bonusPercent: getEffectiveBonusPercent(p)
  };
}

// 프리셋 인덱스 -> 버튼 이미지 경로. 0번은 Select.png, 1~8번은 Select0~7.png (에셋이 9종뿐이라 프리셋도 9개로 고정)
function getPresetBtnImg(index, active) {
  if (!active) return "./assets/rune preset/PresetBtn.png";
  return index === 0
    ? "./assets/rune preset/PresetBtn_Select.png"
    : `./assets/rune preset/PresetBtn_Select${index - 1}.png`;
}

// 프리셋 버튼 줄은 9개라 가로 스크롤이 필요한데, 스크롤바를 직접 잡아끄는 것 말고
// 마우스로 아무 데나 누르고 드래그해도 넘어가도록 함(모바일 터치는 브라우저가 기본 지원)
function enableDragScroll(el) {
  let isDown = false;
  let startX = 0;
  let scrollStart = 0;
  let moved = false;

  el.addEventListener("mousedown", (e) => {
    isDown = true;
    moved = false;
    startX = e.pageX;
    scrollStart = el.scrollLeft;
    el.classList.add("dragging");
  });
  window.addEventListener("mouseup", () => { isDown = false; el.classList.remove("dragging"); });
  el.addEventListener("mouseleave", () => { isDown = false; el.classList.remove("dragging"); });
  el.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 4) moved = true;
    el.scrollLeft = scrollStart - dx;
  });
  // 드래그 도중 놓았을 때 프리셋 버튼의 클릭(선택)이 함께 발생하지 않도록 캡처 단계에서 차단
  el.addEventListener("click", (e) => {
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}

// 숫자 입력칸 공통 처리: 숫자가 아닌 문자는 입력 즉시 제거, "0001" 같은 앞자리 0도 바로 "1"로 정리
function sanitizeIntInput(el) {
  el.value = el.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
}

// 소수 입력칸 공통 처리: 숫자와 점만 허용(음수 부호, 문자 전부 차단), 점은 첫 번째 것만 유지
function sanitizeDecimalInput(el) {
  let v = el.value.replace(/[^0-9.]/g, "");
  const dot = v.indexOf(".");
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
  el.value = v;
}

// 기본값에서 바뀐 값만 노란색으로 강조 (안 바뀌었으면 흰 글씨 그대로)
function markChanged(el, changed) {
  el.classList.toggle("value-changed", changed);
}

function vipToDinoCount(vip) {
  if (vip <= 0) return 5;
  if (vip <= 7) return 6;
  if (vip <= 10) return 7;
  if (vip <= 12) return 8;
  return 13;
}

// VIP 레벨 -> 드롭다운에 쓸 배지 이미지 (없음~4는 0번, 5~7은 1번, 8~10은 2번, 11~13은 3번)
function getVipIconFile(vip) {
  if (vip <= 4) return "./assets/vip/Vip_Setting_Icon0.png";
  if (vip <= 7) return "./assets/vip/Vip_Setting_Icon1.png";
  if (vip <= 10) return "./assets/vip/Vip_Setting_Icon2.png";
  return "./assets/vip/Vip_Setting_Icon3.png";
}

// VIP 레벨별 설명(부족 유닛 슬롯 + 11~13은 공격력·체력 % 보너스도 함께 표시)
function getVipDesc(vip) {
  if (vip <= 0) return "";
  if (vip <= 7) return "부족 유닛: +1";
  if (vip <= 10) return "부족 유닛: +2";
  if (vip === 11) return "부족 유닛: +3, 공·체 +3%";
  if (vip === 12) return "부족 유닛: +3, 공·체 +6%";
  return "부족 유닛: +3, 공·체 +9%";
}

// VIP 11~13의 공격력/체력 %보너스. 룬·둥지·알스킨과 같은 퍼센트 바구니에 더해짐
function getVipStatBonusPercent(vip) {
  if (vip === 11) return 3;
  if (vip === 12) return 6;
  if (vip === 13) return 9;
  return 0;
}

// 룬/둥지·알스킨 %보너스에 VIP 11~13의 %보너스까지 합친 최종 퍼센트 바구니
function getEffectiveBonusPercent(profile) {
  const vipBonus = getVipStatBonusPercent(profile.vip);
  return {
    atk: profile.bonusPercent.atk + vipBonus,
    hp: profile.bonusPercent.hp + vipBonus
  };
}

function renderMyDinoPage(container, options = {}) {
  const idPrefix = options.idPrefix || "";
  const storageKey = options.storageKey || MY_DINO_PROFILE_KEY;
  const id = (name) => idPrefix + name;
  const profile = loadMyDinoProfile(storageKey);

  container.innerHTML = `
    <div class="card dino-panel">
      <div class="dino-summary-bar">
        <div class="stat-readout">
          <div class="stat-readout-item"><div class="stat-readout-label">레벨</div><div class="stat-readout-value accent" id="${id("sumLevel")}">0</div></div>
          <div class="stat-readout-item"><div class="stat-readout-label">공격력</div><div class="stat-readout-value" id="${id("sumAtk")}">0</div></div>
          <div class="stat-readout-item"><div class="stat-readout-label">체력</div><div class="stat-readout-value" id="${id("sumHp")}">0</div></div>
          <div class="stat-readout-item"><div class="stat-readout-label">치확 / 치피</div><div class="stat-readout-value" id="${id("sumCrit")}">0% / 0%</div></div>
          <div class="stat-readout-item"><div class="stat-readout-label">공룡 수</div><div class="stat-readout-value" id="${id("sumCount")}">0마리</div></div>
        </div>
      </div>

      <div class="dino-tabs">
        <button class="dino-tab active" data-tab="base">기본 스탯</button>
        <button class="dino-tab" data-tab="constellation">별자리</button>
        <button class="dino-tab" data-tab="bonus">둥지·알스킨</button>
        <button class="dino-tab" data-tab="rune">룬 조합</button>
        <div class="dino-tab-indicator" id="${id("tabIndicator")}"></div>
      </div>

      <div class="dino-tab-panel" data-panel="base">
        <div class="input-grid">
          <div class="full-width">
            <label>VIP</label>
            <div class="custom-dropdown vip-dropdown" id="${id("vipDropdown")}">
              <div class="selected-value vip-selected-value" id="${id("vipSelectedValue")}"></div>
              <ul class="dropdown-list vip-dropdown-list" id="${id("vipList")}"></ul>
            </div>
          </div>
          <div><label>체력</label><input type="tel" inputmode="numeric" id="${id("fBaseHp")}"></div>
          <div><label>공격력</label><input type="tel" inputmode="numeric" id="${id("fBaseAtk")}"></div>
          <div><label>이동속도</label><input type="tel" inputmode="numeric" id="${id("fMoveSpeed")}"></div>
          <div>
            <label>공룡 수</label>
            <div class="custom-dropdown" id="${id("dinoCountDropdown")}">
              <div class="selected-value" id="${id("dinoCountSelectedValue")}"></div>
              <ul class="dropdown-list" id="${id("dinoCountList")}"></ul>
            </div>
          </div>
        </div>
      </div>

      <div class="dino-tab-panel" data-panel="constellation" style="display:none;">
        <div class="input-grid">
          <div>
            <label>체력</label>
            <div class="affix-input"><span class="affix-prefix">+</span><input type="tel" inputmode="numeric" id="${id("fConstHp")}"></div>
          </div>
          <div>
            <label>공격력</label>
            <div class="affix-input"><span class="affix-prefix">+</span><input type="tel" inputmode="numeric" id="${id("fConstAtk")}"></div>
          </div>
          <div>
            <label>치명타 확률</label>
            <div class="affix-input has-suffix"><span class="affix-prefix">+</span><input type="text" inputmode="decimal" id="${id("fConstCritRate")}"><span class="affix-suffix">%</span></div>
          </div>
          <div>
            <label>치명타 피해</label>
            <div class="affix-input has-suffix"><span class="affix-prefix">+</span><input type="text" inputmode="decimal" id="${id("fConstCritDmg")}"><span class="affix-suffix">%</span></div>
          </div>
          <div>
            <label>건축물 피해 증가</label>
            <div class="affix-input"><span class="affix-prefix">+</span><input type="tel" inputmode="numeric" id="${id("fConstBuildingDmg")}"></div>
          </div>
          <div>
            <label>스튜 효과 증가</label>
            <div class="affix-input has-suffix"><span class="affix-prefix">+</span><input type="text" inputmode="decimal" id="${id("fConstStewEffect")}"><span class="affix-suffix">%</span></div>
          </div>
          <div>
            <label>이동 속도</label>
            <div class="affix-input"><span class="affix-prefix">+</span><input type="tel" inputmode="numeric" id="${id("fConstMoveSpeed")}"></div>
          </div>
          <div>
            <label>보스 피해 감소</label>
            <div class="affix-input"><span class="affix-prefix">+</span><input type="tel" inputmode="numeric" id="${id("fConstBossDmgReduction")}"></div>
          </div>
          <div>
            <label>보스 피해 증가</label>
            <div class="affix-input"><span class="affix-prefix">+</span><input type="tel" inputmode="numeric" id="${id("fConstBossDmgIncrease")}"></div>
          </div>
        </div>
      </div>

      <div class="dino-tab-panel" data-panel="bonus" style="display:none;">
        <div class="input-grid">
          <div>
            <label>공격력</label>
            <div class="affix-input has-suffix"><span class="affix-prefix">+</span><input type="text" inputmode="decimal" id="${id("fBonusAtk")}"><span class="affix-suffix">%</span></div>
          </div>
          <div>
            <label>체력</label>
            <div class="affix-input has-suffix"><span class="affix-prefix">+</span><input type="text" inputmode="decimal" id="${id("fBonusHp")}"><span class="affix-suffix">%</span></div>
          </div>
        </div>
      </div>

      <div class="dino-tab-panel" data-panel="rune" style="display:none;">
        <div class="slot-wrapper" id="${id("slotContainer")}"></div>
        <div class="preset-row" id="${id("presetRow")}"></div>
        <div id="${id("runePicker")}">
          <div class="rune-scroll-container">
            <div class="rune-grid" id="${id("mainGrid")}"></div>
            <div class="divider" id="${id("unsuitableDivider")}" style="text-align:center; color:#e74c3c; font-size:11px; padding:15px 0;"></div>
            <div class="rune-grid" id="${id("unsuitableGrid")}"></div>
          </div>
          <div id="${id("runeDetail")}" style="border-top:1px solid var(--border-color); margin-top:15px; padding-top:15px;">
            <div id="${id("detailGrade")}" style="font-size:11px; font-weight:bold;"></div>
            <h3 id="${id("detailName")}" style="margin:5px 0; font-size:1.1rem;"></h3>
            <div id="${id("runeWarning")}" style="color:#ff4444; font-size:12px; font-weight:bold; margin-bottom:8px; display:none; background:rgba(255,68,68,0.1); padding:5px; border-radius:4px;"></div>
            <div id="${id("levelArea")}">
              <div class="custom-dropdown" id="${id("levelDropdown")}">
                <div class="selected-value" id="${id("levelSelectedValue")}">Lv.1</div>
                <ul class="dropdown-list" id="${id("levelList")}"></ul>
              </div>
              <div class="desc-box" id="${id("detailDesc")}"></div>
            </div>
            <button class="btn-apply" id="${id("applyBtn")}">슬롯에 장착</button>
            <button class="btn-apply" id="${id("removeBtn")}" style="border-color:var(--border-color); color:var(--text-sub); margin-top:5px;">장착 해제</button>
          </div>
        </div>
      </div>
    </div>
  `;

  initMyDinoPage(profile, { ...options, idPrefix, storageKey }, container);
}

function initMyDinoPage(profile, options = {}, container) {
  const idPrefix = options.idPrefix || "";
  const storageKey = options.storageKey || MY_DINO_PROFILE_KEY;
  const id = (name) => idPrefix + name;
  const $ = (name) => document.getElementById(id(name));
  const root = container || document;

  // 탭 전환 (+ 밑줄 인디케이터 슬라이드 애니메이션). 인스턴스가 여러 개 떠 있을 수 있어서
  // document 전체가 아니라 이 인스턴스의 root 안에서만 탭을 찾음.
  const indicator = $("tabIndicator");
  function moveIndicator(btn) {
    indicator.style.width = btn.offsetWidth + "px";
    indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
  }

  root.querySelectorAll(".dino-tab").forEach((tabBtn) => {
    tabBtn.onclick = () => {
      root.querySelectorAll(".dino-tab").forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");
      moveIndicator(tabBtn);
      const target = tabBtn.dataset.tab;
      root.querySelectorAll(".dino-tab-panel").forEach((p) => {
        p.style.display = p.dataset.panel === target ? "block" : "none";
      });
    };
  });
  moveIndicator(root.querySelector(".dino-tab.active"));
  // 폰트 로딩이 늦게 끝나거나 화면 폭이 바뀌면(카드 크기에 비례해서 탭 너비도 변함) 처음 잰 위치가 어긋나므로 다시 맞춤
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => moveIndicator(root.querySelector(".dino-tab.active")));
  }
  window.addEventListener("resize", () => moveIndicator(root.querySelector(".dino-tab.active")));

  // 기본 스탯
  const fBaseAtk = $("fBaseAtk");
  const fBaseHp = $("fBaseHp");
  const fMoveSpeed = $("fMoveSpeed");
  fBaseAtk.value = profile.baseAtk;
  markChanged(fBaseAtk, profile.baseAtk !== 1);
  fBaseHp.value = profile.baseHp;
  markChanged(fBaseHp, profile.baseHp !== 10);
  fMoveSpeed.value = profile.moveSpeed;
  markChanged(fMoveSpeed, profile.moveSpeed !== 1);

  // 공룡 수: 다른 커스텀 드롭다운(VIP, 타이탄 레벨 등)과 같은 스타일을 쓰기 위해 <select> 대신 직접 구현
  const dinoCountList = $("dinoCountList");
  const dinoCountSelectedValue = $("dinoCountSelectedValue");

  function setDinoCount(count) {
    profile.dinoCount = count;
    dinoCountSelectedValue.textContent = `${count}마리`;
    markChanged(dinoCountSelectedValue, count !== 5);
  }

  for (let i = 1; i <= 13; i++) {
    const li = document.createElement("li");
    li.textContent = `${i}마리`;
    li.onclick = () => {
      setDinoCount(i);
      dinoCountList.style.display = "none";
      persistAndRefresh();
    };
    dinoCountList.appendChild(li);
  }
  setDinoCount(profile.dinoCount);

  dinoCountSelectedValue.onclick = () => {
    const isOpen = dinoCountList.style.display === "block";
    document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
    dinoCountList.style.display = isOpen ? "none" : "block";
  };

  // VIP (이미지 배지 + 설명이 들어가는 커스텀 드롭다운. <select>는 항목 안에 이미지를 넣을 수 없어서 직접 구현)
  const vipList = $("vipList");
  const vipSelectedValue = $("vipSelectedValue");

  function vipIconMarkup(vip, sizeClass) {
    return `<div class="vip-option-icon ${sizeClass || ""}" style="background-image:url('${getVipIconFile(vip)}')"><span class="vip-option-num">${vip}</span></div>`;
  }

  function renderVipSelected() {
    const label = profile.vip <= 0 ? "VIP 없음" : `VIP ${profile.vip}`;
    vipSelectedValue.innerHTML = `${vipIconMarkup(profile.vip, "small")}<span>${label}</span>`;
    markChanged(vipSelectedValue, profile.vip !== 0);
  }

  for (let v = 0; v <= 13; v++) {
    const li = document.createElement("li");
    li.className = "vip-option";
    const label = v <= 0 ? "VIP 없음" : `VIP ${v}`;
    const desc = getVipDesc(v);
    li.innerHTML = `
      ${vipIconMarkup(v)}
      <div class="vip-option-text">
        <div class="vip-option-title">${label}</div>
        ${desc ? `<div class="vip-option-desc">${desc}</div>` : ""}
      </div>
    `;
    li.onclick = () => {
      profile.vip = v;
      setDinoCount(vipToDinoCount(v));
      renderVipSelected();
      vipList.style.display = "none";
      persistAndRefresh();
    };
    vipList.appendChild(li);
  }
  renderVipSelected();

  vipSelectedValue.onclick = () => {
    const isOpen = vipList.style.display === "block";
    document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
    vipList.style.display = isOpen ? "none" : "block";
  };
  // 드롭다운 바깥 클릭 시 전부 닫기: 인스턴스마다 중복 등록되지 않도록 한 번만 붙임
  if (!window.__dinoDropdownCloseHandlerBound) {
    window.__dinoDropdownCloseHandlerBound = true;
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".custom-dropdown")) {
        document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
      }
    });
  }
  fBaseAtk.oninput = () => sanitizeIntInput(fBaseAtk);
  fBaseAtk.onblur = () => {
    profile.baseAtk = Math.max(1, Number(fBaseAtk.value) || 1);
    fBaseAtk.value = profile.baseAtk;
    markChanged(fBaseAtk, profile.baseAtk !== 1);
    persistAndRefresh();
  };
  fBaseHp.oninput = () => sanitizeIntInput(fBaseHp);
  fBaseHp.onblur = () => {
    profile.baseHp = Math.max(10, Number(fBaseHp.value) || 10);
    fBaseHp.value = profile.baseHp;
    markChanged(fBaseHp, profile.baseHp !== 10);
    persistAndRefresh();
  };
  fMoveSpeed.oninput = () => sanitizeIntInput(fMoveSpeed);
  fMoveSpeed.onblur = () => {
    profile.moveSpeed = Math.min(150, Math.max(1, Number(fMoveSpeed.value) || 1));
    fMoveSpeed.value = profile.moveSpeed;
    markChanged(fMoveSpeed, profile.moveSpeed !== 1);
    persistAndRefresh();
  };

  // 별자리
  const constFields = [
    ["fConstHp", "hp"], ["fConstAtk", "atk"],
    ["fConstCritRate", "critRate"], ["fConstCritDmg", "critDmg"],
    ["fConstBuildingDmg", "buildingDmg"], ["fConstStewEffect", "stewEffect"],
    ["fConstMoveSpeed", "moveSpeed"], ["fConstBossDmgReduction", "bossDmgReduction"],
    ["fConstBossDmgIncrease", "bossDmgIncrease"]
  ];
  const DECIMAL_CONST_FIELDS = ["critRate", "critDmg", "stewEffect"];
  constFields.forEach(([fieldId, key]) => {
    const el = $(fieldId);
    el.value = profile.constellation[key];
    markChanged(el, profile.constellation[key] !== 0);
    el.oninput = () => (DECIMAL_CONST_FIELDS.includes(key) ? sanitizeDecimalInput(el) : sanitizeIntInput(el));
    el.onfocus = () => { if (el.value === "0") el.value = ""; };
    el.onblur = () => {
      profile.constellation[key] = Number(el.value) || 0;
      el.value = profile.constellation[key];
      markChanged(el, profile.constellation[key] !== 0);
      persistAndRefresh();
    };
  });

  // 둥지·알스킨 (합산된 %값 하나씩만 존재)
  const fBonusAtk = $("fBonusAtk");
  const fBonusHp = $("fBonusHp");
  fBonusAtk.value = profile.bonusPercent.atk;
  markChanged(fBonusAtk, profile.bonusPercent.atk !== 0);
  fBonusHp.value = profile.bonusPercent.hp;
  markChanged(fBonusHp, profile.bonusPercent.hp !== 0);
  fBonusAtk.onfocus = () => { if (fBonusAtk.value === "0") fBonusAtk.value = ""; };
  fBonusHp.onfocus = () => { if (fBonusHp.value === "0") fBonusHp.value = ""; };
  fBonusAtk.onblur = () => {
    profile.bonusPercent.atk = Number(fBonusAtk.value) || 0;
    fBonusAtk.value = profile.bonusPercent.atk;
    markChanged(fBonusAtk, profile.bonusPercent.atk !== 0);
    persistAndRefresh();
  };
  fBonusHp.onblur = () => {
    profile.bonusPercent.hp = Number(fBonusHp.value) || 0;
    fBonusHp.value = profile.bonusPercent.hp;
    markChanged(fBonusHp, profile.bonusPercent.hp !== 0);
    persistAndRefresh();
  };

  // 룬 조합 (편집한 내용은 현재 활성 프리셋에 바로 반영됨)
  // unsuitableList가 주어지면(타이탄 등 특정 컨텍스트) 해당 룬을 구분선 아래 흐리게 모아서 표시하고,
  // 없으면(내 공룡 페이지 단독 진입) 모든 룬을 구분 없이 보여줌
  const runeUI = createRuneUI({
    idPrefix,
    unsuitableList: options.unsuitableList || [],
    unsuitableLabel: options.unsuitableLabel,
    onChange: (runes) => {
      profile.runes = runes;
      profile.runePresets[profile.activePresetIndex].runes = runes.map((r) => (r ? { ...r } : null));
      persistAndRefresh();
    }
  });
  runeUI.mount();
  runeUI.setSelectedRunes(profile.runes);
  runeUI.renderSlots();
  renderPresetRow();
  enableDragScroll($("presetRow"));

  function selectPreset(idx) {
    if (idx === profile.activePresetIndex) return;
    profile.activePresetIndex = idx;
    profile.runes = profile.runePresets[idx].runes.map((r) => (r ? { ...r } : null));
    runeUI.setSelectedRunes(profile.runes);
    runeUI.renderSlots();
    renderPresetRow();
    persistAndRefresh();
  }

  function startRenamePreset(idx) {
    const nameEl = root.querySelector(`.preset-btn-name[data-idx="${idx}"]`);
    if (!nameEl) return;
    const current = profile.runePresets[idx].name;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "preset-name-input";
    input.value = current;
    input.maxLength = 6;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      profile.runePresets[idx].name = input.value.trim() || current;
      persistAndRefresh();
      renderPresetRow();
    };
    input.onblur = commit;
    input.onkeydown = (e) => { if (e.key === "Enter") input.blur(); };
  }

  function renderPresetRow() {
    const row = $("presetRow");
    row.innerHTML = "";
    profile.runePresets.forEach((preset, idx) => {
      const isActive = idx === profile.activePresetIndex;
      const btn = document.createElement("div");
      btn.className = "preset-btn" + (isActive ? " active" : "");
      btn.style.backgroundImage = `url("${getPresetBtnImg(idx, isActive)}")`;
      btn.innerHTML = `
        <span class="preset-btn-name" data-idx="${idx}">${preset.name}</span>
        ${isActive ? '<button type="button" class="preset-edit-btn" title="이름 수정">✏️</button>' : ""}
      `;
      btn.onclick = (e) => {
        if (e.target.closest(".preset-edit-btn")) return;
        selectPreset(idx);
      };
      const editBtn = btn.querySelector(".preset-edit-btn");
      if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); startRenamePreset(idx); };
      row.appendChild(btn);
    });
  }

  function persistAndRefresh() {
    saveMyDinoProfile(profile, storageKey);
    updateSummary(profile, idPrefix);
    if (options.onChange) options.onChange(profile);
  }

  updateSummary(profile, idPrefix);
}

function updateSummary(profile, idPrefix = "") {
  const id = (name) => idPrefix + name;
  const stats = getBattleStats({
    baseAtk: profile.baseAtk,
    baseHp: profile.baseHp,
    count: profile.dinoCount,
    selectedRunes: profile.runes,
    constellation: profile.constellation,
    bonusPercent: getEffectiveBonusPercent(profile)
  });
  document.getElementById(id("sumAtk")).innerText = Math.floor(stats.fAtk).toLocaleString();
  document.getElementById(id("sumHp")).innerText = Math.floor(stats.fHp).toLocaleString();
  document.getElementById(id("sumCrit")).innerText = `${stats.cRate.toFixed(2)}% / ${stats.cDmg.toFixed(2)}%`;
  document.getElementById(id("sumCount")).innerText = `${profile.dinoCount}마리`;
  // 레벨 = 기본 공격력 + (기본 체력 / 10) + 이동속도 (룬 등으로 증폭되지 않은 순수 기본 스탯 기준)
  // 검증: 체력 7810, 공격력 886, 이동속도 150 -> 886 + 781 + 150 = 1817
  const level = profile.baseAtk + Math.floor(profile.baseHp / 10) + profile.moveSpeed;
  document.getElementById(id("sumLevel")).innerText = level.toLocaleString();
}
