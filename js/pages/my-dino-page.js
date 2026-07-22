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

// 저장된(혹은 친구에게서 받은) 원본 객체를 완전한 형태로 채워 넣음 - localStorage에서 막 읽은
// 객체든, 친구 세션/스냅샷에서 받은 외부 객체든 똑같이 씀. **객체 참조를 그대로 유지**(새 객체로
// 복사하지 않고 saved 자체에 필드를 채움)하는 게 중요함 - 읽기 전용 모드에서 로컬 프리셋 미리보기가
// 이 함수가 반환한 객체를 그대로 들고 있다가 나중에 전투 계산(getOppBattleInputs 등)에도 쓰이는데,
// 새 객체로 복사해버리면 그 변경이 원래 참조에는 반영되지 않아 미리보기가 전투 계산과 어긋나게 됨.
function normalizeDinoProfile(saved) {
  if (!saved) return defaultMyDinoProfile();
  const defaults = defaultMyDinoProfile();
  Object.keys(defaults).forEach((key) => {
    if (saved[key] === undefined) saved[key] = defaults[key];
  });
  // 별자리 항목이 나중에 추가된 경우 대비: 얕은 병합 대신 필드 단위로 병합
  saved.constellation = { ...defaults.constellation, ...(saved.constellation || {}) };
  // 프리셋 도입 이전 저장분: 기존 룬 조합을 1번 프리셋으로 이관
  if (!saved.runePresets) {
    saved.runePresets = defaultRunePresets();
    if (saved.runes && saved.runes.some((r) => r)) {
      saved.runePresets[0].runes = saved.runes;
    }
  }
  // 압축된 힘/매머드의 힘처럼 동시 장착이 불가능한 룬 쌍이 저장 데이터에 섞여 있으면 정리
  // (수동 localStorage 편집, 예전 버전 저장분 등으로 꼬였을 가능성 방어)
  saved.runePresets.forEach((preset) => { preset.runes = sanitizeRuneConflicts(preset.runes); });
  // top-level runes가 아예 없는 데이터(친구 세션/스냅샷이 넘기는 원본은 runePresets만 있고 runes가
  // 없을 수 있음)는 활성 프리셋에서 유도
  saved.runes = sanitizeRuneConflicts(
    (saved.runes && saved.runes.length ? saved.runes : saved.runePresets[saved.activePresetIndex || 0].runes)
    || [null, null, null, null, null]
  );
  return saved;
}

function loadMyDinoProfile(storageKey = MY_DINO_PROFILE_KEY) {
  try {
    return normalizeDinoProfile(JSON.parse(localStorage.getItem(storageKey)));
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

// 저장된(혹은 친구에게서 받은) 원본 프로필 형태 -> 시뮬레이션 엔진에 바로 넣을 수 있는 형태로 변환.
// localStorage를 거치지 않는 순수 변환이라, 친구 세션에서 받은 프로필(js/core/friend-session.js)도
// 그대로 재사용할 수 있음.
function dinoProfileToBattleInputs(p) {
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

// 다른 페이지(타이탄, 공룡 대전 등)가 시뮬레이션 엔진에 바로 넣을 수 있는 형태로 변환
function getMyDinoBattleInputs(storageKey = MY_DINO_PROFILE_KEY) {
  return dinoProfileToBattleInputs(loadMyDinoProfile(storageKey));
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
  // mousemove를 el이 아니라 window에 붙여야 함 - el에만 붙어있으면 드래그 도중 마우스 커서가
  // (버튼을 누른 채로) 이 요소의 경계 밖으로 나가는 순간 더 이상 이벤트가 안 잡혀서 스크롤이
  // 그 자리에서 멈춰버림. window 기준으로 좌표를 추적하면 커서가 어디에 있든(모달 바깥이어도)
  // 버튼을 뗄 때까지 계속 스크롤됨 - mouseleave로 드래그를 강제 종료하던 것도 함께 제거함
  window.addEventListener("mousemove", (e) => {
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

// 패널 헤더(제목 + 상대 진영 툴바 + 닫기 버튼)를 카드 안 첫 줄로 렌더링하기 위한 공용 조각.
// header를 안 주면(타이탄/허수아비처럼 헤더가 필요 없는 컨텍스트) 빈 문자열 - 기존 동작과 동일.
// toolbarId/closeId는 idPrefix를 거치지 않는 "페이지가 그냥 정해준 고유 id" - 기존
// renderOppPanelToolbar()/renderArenaOppToolbar()가 이 id로 직접 getElementById를 하므로
// 그 함수들은 전혀 안 건드려도 계속 동작함.
function dinoPanelHeaderHtml(header) {
  if (!header) return "";
  const titleAttr = header.titleId ? ` id="${header.titleId}"` : "";
  const toolbarHtml = header.toolbarId ? `<div class="opp-panel-toolbar" id="${header.toolbarId}"></div>` : "";
  const closeHtml = header.closeId ? `<button class="close-btn battle-panel-close" id="${header.closeId}">✕</button>` : "";
  return `
    <div class="battle-panel-header">
      <span${titleAttr}>${header.title || ""}</span>
      ${toolbarHtml}
      ${closeHtml}
    </div>
  `;
}

// container.innerHTML이 매 렌더마다 통째로 새로 쓰이므로, 닫기 버튼도 매번 새 DOM 노드임 -
// 페이지 초기화 시점에 한 번만 바깥에서 붙이면 재렌더 후 죽으므로, 렌더될 때마다 다시 불러야 함.
function wireDinoPanelHeader(root, header) {
  if (!header || !header.closeId || !header.onClose) return;
  const btn = (root || document).querySelector(`#${CSS.escape(header.closeId)}`);
  if (btn) btn.onclick = header.onClose;
}

function renderMyDinoPage(container, options = {}) {
  const idPrefix = options.idPrefix || "";
  const storageKey = options.storageKey || MY_DINO_PROFILE_KEY;
  const id = (name) => idPrefix + name;
  const readOnly = !!options.readOnly;
  const profile = readOnly ? normalizeDinoProfile(options.readOnly.profile) : loadMyDinoProfile(storageKey);

  // splitCritStat: 아레나처럼 "공룡 수"가 의미 없는 컨텍스트에서, 그 자리를 비우는 대신 치확/치피를
  // 각각 별도 항목으로 나눠서 5칸을 그대로 채움(기본값은 기존 그대로 "치확 / 치피" 한 칸 + 공룡 수)
  const splitCrit = !!options.splitCritStat;
  const critItemsHtml = splitCrit
    ? `<div class="stat-readout-item"><div class="stat-readout-label">치명타 확률</div><div class="stat-readout-value" id="${id("sumCritRate")}">0%</div></div>
       <div class="stat-readout-item"><div class="stat-readout-label">치명타 피해</div><div class="stat-readout-value" id="${id("sumCritDmg")}">0%</div></div>`
    : `<div class="stat-readout-item"><div class="stat-readout-label">치확 / 치피</div><div class="stat-readout-value" id="${id("sumCrit")}">0% / 0%</div></div>
       <div class="stat-readout-item"><div class="stat-readout-label">공룡 수</div><div class="stat-readout-value" id="${id("sumCount")}">0마리</div></div>`;

  // extraTab: 컨텍스트별로 탭을 하나 추가할 수 있는 훅(예: 아레나 배치) - { id, label, render(panelEl) }.
  // 이 파일은 어떤 페이지가 뭘 넣는지 몰라도 되게, 탭 전환/패널 표시만 일반적으로 처리함
  const extraTab = options.extraTab || null;

  container.innerHTML = `
    <div class="card dino-panel${readOnly ? " dino-panel-readonly" : ""}">
      ${dinoPanelHeaderHtml(options.header)}
      ${readOnly ? `<div class="dino-panel-readonly-tag">${options.readOnly.tagText || "🔒 읽기 전용"}</div>` : ""}
      <div class="dino-summary-bar">
        <div class="stat-readout">
          <div class="stat-readout-item"><div class="stat-readout-label">레벨</div><div class="stat-readout-value accent" id="${id("sumLevel")}">0</div></div>
          <div class="stat-readout-item"><div class="stat-readout-label">공격력</div><div class="stat-readout-value" id="${id("sumAtk")}">0</div></div>
          <div class="stat-readout-item"><div class="stat-readout-label">체력</div><div class="stat-readout-value" id="${id("sumHp")}">0</div></div>
          ${critItemsHtml}
        </div>
      </div>

      <div class="dino-tabs">
        <button class="dino-tab active" data-tab="base">기본 스탯</button>
        <button class="dino-tab" data-tab="constellation">별자리</button>
        <button class="dino-tab" data-tab="bonus">둥지·알스킨</button>
        <button class="dino-tab" data-tab="rune">룬 조합</button>
        ${extraTab ? `<button class="dino-tab" data-tab="${extraTab.id}">${extraTab.label}</button>` : ""}
        <div class="dino-tab-indicator" id="${id("tabIndicator")}"></div>
      </div>

      <div class="dino-tab-panel${readOnly ? " tab-panel-readonly" : ""}" data-panel="base">
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

      <div class="dino-tab-panel${readOnly ? " tab-panel-readonly" : ""}" data-panel="constellation" style="display:none;">
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

      <div class="dino-tab-panel${readOnly ? " tab-panel-readonly" : ""}" data-panel="bonus" style="display:none;">
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

      <div class="dino-tab-panel${readOnly ? " tab-panel-readonly" : ""}" data-panel="rune" style="display:none;">
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
            <div class="btn-apply-row">
              <button class="btn-apply" id="${id("applyBtn")}">슬롯에 장착</button>
              <button class="btn-apply btn-apply-secondary" id="${id("removeBtn")}">장착 해제</button>
            </div>
          </div>
        </div>
      </div>
      ${extraTab ? `<div class="dino-tab-panel" data-panel="${extraTab.id}" style="display:none;" id="${id("extraTabPanel")}"></div>` : ""}
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
  const readOnly = !!options.readOnly;
  // 아래 흩어진 el.onclick = ...같은 대입을 전부 이 헬퍼로 통일 - readOnly면 그냥 핸들러를 안
  // 붙이는 것 하나로 모든 입력/드롭다운/프리셋 항목이 한 번에 비활성화됨(각 자리마다
  // `if (readOnly) return;`을 반복해서 넣지 않아도 됨)
  const on = (el, evt, fn) => { if (!readOnly) el[evt] = fn; };

  // 탭 전환 (+ 밑줄 인디케이터 슬라이드 애니메이션). 인스턴스가 여러 개 떠 있을 수 있어서
  // document 전체가 아니라 이 인스턴스의 root 안에서만 탭을 찾음. readOnly여도 탭 전환 자체는
  // 절대 막지 않음 - 읽기 전용 모드의 핵심 목적이 4개 탭을 전부 볼 수 있게 하는 것이므로.
  const indicator = $("tabIndicator");
  // btn이 null일 수 있음 - 이 패널이 나중에 다른 프로필로 통째로 재렌더된 뒤에도(예: 아레나에서
  // "설정 불러오기"), 여기서 등록한 resize 리스너는 그대로 남아있어서 다음 리사이즈 때 이미 사라진
  // 탭을 찾으려다 null이 나올 수 있음
  function moveIndicator(btn) {
    if (!btn) return;
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
      // 룬 조합 탭은 프리셋 데이터를 이 탭 바깥(예: 아레나 배치 탭의 슬롯 편집 팝업)에서도 같은
      // storageKey로 직접 수정할 수 있어서, 탭에 진입할 때마다 저장소에서 다시 읽어와야 그 변경이
      // 여기 화면에도 즉시 반영됨(탭 전환은 단순 display 토글이라 마운트 시점 클로저가 그대로 남음).
      // readOnly는 storageKey가 아니라 외부 profile 객체가 원본이라 저장소를 다시 읽으면 안 됨
      // (엉뚱하게 뷰어 자신의 로컬 프로필로 덮어써버리는 버그가 됨) - 탭 전환 자체는 항상 허용.
      if (target === "rune" && !readOnly) refreshRuneTabFromStorage();
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
  // readOnly면 값은 그대로 잘 보이게 두고(불투명도 안 낮춤) 타이핑만 막음 - opacity로 흐리면
  // 정작 친구 스탯을 읽으러 온 화면의 목적과 어긋남
  if (readOnly) { fBaseAtk.readOnly = true; fBaseHp.readOnly = true; fMoveSpeed.readOnly = true; }

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
    on(li, "onclick", () => {
      setDinoCount(i);
      dinoCountList.style.display = "none";
      persistAndRefresh();
    });
    dinoCountList.appendChild(li);
  }
  setDinoCount(profile.dinoCount);

  on(dinoCountSelectedValue, "onclick", () => toggleDropdownList(dinoCountSelectedValue, dinoCountList));

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
    on(li, "onclick", () => {
      profile.vip = v;
      setDinoCount(vipToDinoCount(v));
      renderVipSelected();
      vipList.style.display = "none";
      persistAndRefresh();
    });
    vipList.appendChild(li);
  }
  renderVipSelected();

  on(vipSelectedValue, "onclick", () => toggleDropdownList(vipSelectedValue, vipList));
  // 드롭다운 바깥 클릭 시 전부 닫기: 인스턴스마다 중복 등록되지 않도록 한 번만 붙임
  if (!window.__dinoDropdownCloseHandlerBound) {
    window.__dinoDropdownCloseHandlerBound = true;
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".custom-dropdown")) {
        document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
      }
    });
  }
  on(fBaseAtk, "oninput", () => sanitizeIntInput(fBaseAtk));
  on(fBaseAtk, "onblur", () => {
    profile.baseAtk = Math.max(1, Number(fBaseAtk.value) || 1);
    fBaseAtk.value = profile.baseAtk;
    markChanged(fBaseAtk, profile.baseAtk !== 1);
    persistAndRefresh();
  });
  on(fBaseHp, "oninput", () => sanitizeIntInput(fBaseHp));
  on(fBaseHp, "onblur", () => {
    profile.baseHp = Math.max(10, Number(fBaseHp.value) || 10);
    fBaseHp.value = profile.baseHp;
    markChanged(fBaseHp, profile.baseHp !== 10);
    persistAndRefresh();
  });
  on(fMoveSpeed, "oninput", () => sanitizeIntInput(fMoveSpeed));
  on(fMoveSpeed, "onblur", () => {
    profile.moveSpeed = Math.min(150, Math.max(1, Number(fMoveSpeed.value) || 1));
    fMoveSpeed.value = profile.moveSpeed;
    markChanged(fMoveSpeed, profile.moveSpeed !== 1);
    persistAndRefresh();
  });

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
    if (readOnly) el.readOnly = true;
    on(el, "oninput", () => (DECIMAL_CONST_FIELDS.includes(key) ? sanitizeDecimalInput(el) : sanitizeIntInput(el)));
    on(el, "onfocus", () => { if (el.value === "0") el.value = ""; });
    on(el, "onblur", () => {
      profile.constellation[key] = Number(el.value) || 0;
      el.value = profile.constellation[key];
      markChanged(el, profile.constellation[key] !== 0);
      persistAndRefresh();
    });
  });

  // 둥지·알스킨 (합산된 %값 하나씩만 존재)
  const fBonusAtk = $("fBonusAtk");
  const fBonusHp = $("fBonusHp");
  fBonusAtk.value = profile.bonusPercent.atk;
  markChanged(fBonusAtk, profile.bonusPercent.atk !== 0);
  fBonusHp.value = profile.bonusPercent.hp;
  markChanged(fBonusHp, profile.bonusPercent.hp !== 0);
  if (readOnly) { fBonusAtk.readOnly = true; fBonusHp.readOnly = true; }
  on(fBonusAtk, "onfocus", () => { if (fBonusAtk.value === "0") fBonusAtk.value = ""; });
  on(fBonusHp, "onfocus", () => { if (fBonusHp.value === "0") fBonusHp.value = ""; });
  on(fBonusAtk, "onblur", () => {
    profile.bonusPercent.atk = Number(fBonusAtk.value) || 0;
    fBonusAtk.value = profile.bonusPercent.atk;
    markChanged(fBonusAtk, profile.bonusPercent.atk !== 0);
    persistAndRefresh();
  });
  on(fBonusHp, "onblur", () => {
    profile.bonusPercent.hp = Number(fBonusHp.value) || 0;
    fBonusHp.value = profile.bonusPercent.hp;
    markChanged(fBonusHp, profile.bonusPercent.hp !== 0);
    persistAndRefresh();
  });

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

  if (readOnly) {
    // 룬 슬롯/그리드는 CSS(.tab-panel-readonly .slot 등)로 클릭을 이미 막아서 rune-ui.js는 무수정
    // - 다만 Apply/Remove는 진짜 <button>이라 pointer-events:none만으론 키보드 Enter 활성화를 못
    // 막으므로 .disabled도 같이 줌
    $("applyBtn").disabled = true;
    $("removeBtn").disabled = true;
    // 커스텀 드롭다운(VIP/공룡 수/룬 레벨)은 기존에 있던 "잠긴 컨트롤" 스타일을 재사용해서
    // 흐리게 표시 - 값 자체를 보여주는 입력칸/룬 아이콘과 달리 이건 버튼처럼 생겨서 흐려도 무방함
    // extraTab(예: 아레나 배치) 패널은 readOnly와 무관하게 항상 편집 가능해야 하므로 제외하고,
    // 기본 4개 탭(.tab-panel-readonly) 안의 드롭다운만 잠금
    root.querySelectorAll(".tab-panel-readonly .custom-dropdown").forEach((el) => el.classList.add("dropdown-locked"));
  }

  function selectPreset(idx) {
    if (idx === profile.activePresetIndex) return;
    // 실시간 세션(allowPresetSwitch 없음)은 로컬 미리보기도 막고, 스냅샷(allowPresetSwitch:true)은
    // 로컬로만 전환 허용(persistAndRefresh 자체가 readOnly면 저장을 안 하므로 안전)
    if (readOnly && !(options.readOnly && options.readOnly.allowPresetSwitch)) return;
    profile.activePresetIndex = idx;
    profile.runes = profile.runePresets[idx].runes.map((r) => (r ? { ...r } : null));
    runeUI.setSelectedRunes(profile.runes);
    runeUI.renderSlots();
    renderPresetRow();
    persistAndRefresh();
    if (readOnly && options.readOnly.onPresetSwitch) options.readOnly.onPresetSwitch(profile);
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
        ${isActive && !readOnly ? '<button type="button" class="preset-edit-btn" title="이름 수정">✏️</button>' : ""}
      `;
      // selectPreset() 자기 자신이 readOnly/allowPresetSwitch 가드를 갖고 있으므로 여기서는 그냥
      // 항상 호출 - 다른 el들처럼 on()으로 감싸지 않음(스냅샷 로컬 미리보기 때는 readOnly여도
      // 이 클릭이 계속 살아있어야 함)
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
    // readOnly는 남의 프로필(친구 세션/스냅샷)이라 이 profile을 절대 storageKey에 저장하면 안 됨 -
    // 화면 갱신만 하고 여기서 끝냄(프리셋 로컬 미리보기 등도 이 가드 하나로 안전해짐)
    if (readOnly) {
      updateSummary(profile, idPrefix, options.splitCritStat);
      return;
    }
    // 이 profile 객체는 마운트 시점에 한 번 로드해서 계속 재사용하는 클로저라, 이 모듈이 관리하지
    // 않는 필드(예: 아레나 배치 탭이 저장하는 arenaFormations)는 여기서 절대 안 바뀌고 마운트 당시
    // 값 그대로 멈춰있음. 그런데 저장은 이 profile 객체 전체를 통째로 덮어쓰기 때문에, 마운트 이후
    // 다른 코드 경로(아레나 배치 탭)가 저장소에 직접 써넣은 최신값을 여기서 base/룬 등을 편집할
    // 때마다 오래된 값으로 되돌려버리는 버그가 있었음(아레나 프리셋을 설정해도 다른 탭에서 뭘 조금만
    // 고치면 사라짐) - 저장 직전에 그 필드만 저장소에서 다시 읽어와 최신값으로 맞춰줌
    const latest = loadMyDinoProfile(storageKey);
    profile.arenaFormations = latest.arenaFormations;
    saveMyDinoProfile(profile, storageKey);
    updateSummary(profile, idPrefix, options.splitCritStat);
    if (options.onChange) options.onChange(profile);
  }

  function refreshRuneTabFromStorage() {
    const fresh = loadMyDinoProfile(storageKey);
    profile.runePresets = fresh.runePresets;
    profile.activePresetIndex = fresh.activePresetIndex;
    profile.runes = profile.runePresets[profile.activePresetIndex].runes.map((r) => (r ? { ...r } : null));
    runeUI.setSelectedRunes(profile.runes);
    runeUI.renderSlots();
    renderPresetRow();
  }

  updateSummary(profile, idPrefix, options.splitCritStat);

  // extraTab(예: 아레나 배치)이 있으면 그 탭 패널에 컨텍스트가 제공한 렌더러를 한 번 실행 -
  // readOnly와 무관하게 항상 실행(아레나 배치는 상대가 읽기 전용이어도 로컬 편집 가능한 별개 데이터)
  if (options.extraTab) {
    const panelEl = $("extraTabPanel");
    if (panelEl) options.extraTab.render(panelEl);
  }

  // 헤더의 닫기 버튼은 매 렌더마다 새 DOM이라 여기서 매번 다시 바인딩
  wireDinoPanelHeader(root, options.header);
}

function updateSummary(profile, idPrefix = "", splitCrit = false) {
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
  if (splitCrit) {
    document.getElementById(id("sumCritRate")).innerText = `${stats.cRate.toFixed(2)}%`;
    document.getElementById(id("sumCritDmg")).innerText = `${stats.cDmg.toFixed(2)}%`;
  } else {
    document.getElementById(id("sumCrit")).innerText = `${stats.cRate.toFixed(2)}% / ${stats.cDmg.toFixed(2)}%`;
    document.getElementById(id("sumCount")).innerText = `${profile.dinoCount}마리`;
  }
  // 레벨 = 기본 공격력 + (기본 체력 / 10) + 이동속도 (룬 등으로 증폭되지 않은 순수 기본 스탯 기준)
  // 검증: 체력 7810, 공격력 886, 이동속도 150 -> 886 + 781 + 150 = 1817
  const level = profile.baseAtk + Math.floor(profile.baseHp / 10) + profile.moveSpeed;
  document.getElementById(id("sumLevel")).innerText = level.toLocaleString();
}

