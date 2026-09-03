// "내 공룡" 페이지 = 공룡 하나의 현재 상태를 설정하는 곳.
// 기본 스탯 / 별자리 / 둥지·알스킨 / 룬 조합 4개 섹션. 룬 조합만 여러 개 프리셋으로 저장 가능.
// options.storageKey / options.idPrefix를 다르게 주면 한 페이지에 여러 인스턴스를 동시에 띄울 수
// 있음(예: 공룡 대전 페이지의 "내 공룡"/"상대 공룡"). 기본값은 지금까지와 완전히 동일하게 동작함.
const MY_DINO_PROFILE_KEY = "dino_my_profile";

// 별자리 9개 필드 - 아이콘(assets/constellation, 사용자가 실제 게임 아이콘을 업로드) + 레벨/수치
// 입력 배지 하나로 렌더링하는 단일 소스(템플릿 생성과 이벤트 와이어링이 이 배열 하나만 봄).
// decimal/suffix는 치확·치피·스튜처럼 소수+%로 표시되는 3개 필드만 true/"%" - 나머지는 정수.
// CONSTELLATION_CAP_TABLES(js/data/constellation-data.js)에 레벨표가 있는 6개 필드만 "레벨" 입력
// 칸이 같이 뜨고, 표 자체가 없는 3개(이동속도/보스 피해 감소·증가)는 수치만 입력받음(기존 그대로).
const CONSTELLATION_FIELDS = [
  { key: "hp", fieldId: "fConstHp", labelKey: "my_dino.field.constHp", decimal: false, suffix: null, icon: "HP_Icon.png" },
  { key: "atk", fieldId: "fConstAtk", labelKey: "my_dino.field.constAtk", decimal: false, suffix: null, icon: "Damage_Icon.png" },
  { key: "critRate", fieldId: "fConstCritRate", labelKey: "my_dino.field.constCritRate", decimal: true, suffix: "%", icon: "CriticalRate_Icon.png" },
  { key: "critDmg", fieldId: "fConstCritDmg", labelKey: "my_dino.field.constCritDmg", decimal: true, suffix: "%", icon: "CriticalDamage_Icon.png" },
  { key: "buildingDmg", fieldId: "fConstBuildingDmg", labelKey: "my_dino.field.constBuildingDmg", decimal: false, suffix: null, icon: "StructureDamageConst_Icon.png" },
  { key: "stewEffect", fieldId: "fConstStewEffect", labelKey: "my_dino.field.constStewEffect", decimal: false, suffix: null, icon: "MutationRate_Icon.png" },
  { key: "moveSpeed", fieldId: "fConstMoveSpeed", labelKey: "my_dino.field.constMoveSpeed", decimal: false, suffix: null, icon: "Speed_Icon.png" },
  { key: "bossDmgReduction", fieldId: "fConstBossDmgReduction", labelKey: "my_dino.field.constBossDmgReduction", decimal: false, suffix: null, icon: "BossReduction_Icon.png" },
  { key: "bossDmgIncrease", fieldId: "fConstBossDmgIncrease", labelKey: "my_dino.field.constBossDmgIncrease", decimal: false, suffix: null, icon: "BossDamageConst_Icon.png" }
];

// 레벨표(CONSTELLATION_CAP_TABLES)가 있는 필드용 옵션 표시 문구 - "Lv. 33 (+270)"(사용자 확정)
function constellationLevelOptionLabel(level, value, suffix) {
  // "Lv. X"와 "(+수치)" 사이를 스페이스 3~4칸 정도로 넉넉히 띄움(사용자 확정) - 일반 스페이스는
  // 여러 개 써도 브라우저가 하나로 붙여버리므로(white-space:normal 기본 동작), 줄어들지 않는
  // 공백 문자(non-breaking space,  )를 대신 씀
  return `Lv. ${level}    (+${value}${suffix || ""})`;
}

// idFn: renderMyDinoPage 인스턴스별 id(name) 헬퍼(idPrefix 접두) 그대로 받아서 씀. 레벨표가 있는
// 필드(6개)는 값을 직접 입력하는 대신 레벨을 고르는 드롭다운으로(사용자 확정 - "스튜효과까지
// 레벨로 되어 있는 건 드롭다운으로 해결하자"), 표가 없는 3개(이동속도/보스 피해 감소·증가)는
// 그대로 "+수치" 입력칸(가운데 정렬).
// "+수치[%]" 입력칸 - 실제 <input>은 박스 전체를 차지하되 글자색을 투명하게 만들고(caret만 보임),
// 그 위에 겹쳐놓은 표시 전용 레이어(.plus-value-display, pointer-events:none)가 "+"(흰 글자)와
// 숫자(노란 강조색)를 서로 붙여서 보여줌(사용자 확정 - "숫자 왼쪽에 + 표시를... 내가 입력한 숫자를
// 변수로 저장해 두고 앞에 흰색 +를 문자열로 붙여버리는 건 어때? 수치 부분은 노란색으로"). 이러면
// 클릭 가능 영역은 드롭다운과 동일하게 박스 전체(입력칸이 실제로 그만큼 넓음)이면서도, 보이는
// "+숫자"는 항상 붙어있고 원하는 색으로 표시됨 - 서로 달라 보이던 두 요구가 "실제 입력칸"과
// "보여주는 레이어"를 분리하면 동시에 만족됨.
function plusValueFieldHtml(fieldId, idFn, decimal, suffix, center) {
  const valueType = decimal ? "text" : "tel";
  const valueMode = decimal ? "decimal" : "numeric";
  return `
    <div class="plus-value-group${center ? " plus-value-group-center" : ""}">
      <div class="plus-value-display">
        <span class="plus-value-display-prefix">+</span>
        <span class="plus-value-display-number" id="${idFn(fieldId + "Display")}"></span>
        ${suffix ? `<span class="plus-value-display-suffix">${suffix}</span>` : ""}
      </div>
      <input type="${valueType}" inputmode="${valueMode}" class="plus-value-input" id="${idFn(fieldId)}">
    </div>
  `;
}

function constellationBadgeHtml(field, idFn) {
  const table = CONSTELLATION_CAP_TABLES[field.key];
  if (table) {
    return `
      <div>
        <label>${t(field.labelKey)}</label>
        <div class="const-badge">
          <img class="const-badge-icon" src="./assets/constellation/${field.icon}" alt="">
          <div class="custom-dropdown const-badge-dropdown" id="${idFn(field.fieldId + "Dropdown")}">
            <div class="selected-value" id="${idFn(field.fieldId + "SelectedValue")}"></div>
            <ul class="dropdown-list" id="${idFn(field.fieldId + "List")}"></ul>
          </div>
        </div>
      </div>
    `;
  }
  return `
    <div>
      <label>${t(field.labelKey)}</label>
      <div class="const-badge">
        <img class="const-badge-icon" src="./assets/constellation/${field.icon}" alt="">
        ${plusValueFieldHtml(field.fieldId, idFn, field.decimal, field.suffix, true)}
      </div>
    </div>
  `;
}

const RUNE_PRESET_COUNT = 9;

function defaultRunePresets() {
  return Array.from({ length: RUNE_PRESET_COUNT }, () => ({
    name: null,
    runes: [null, null, null, null, null]
  }));
}

// name이 null(한 번도 직접 이름을 바꾼 적 없음)이면 그 자리에서 지금 활성 언어로 "프리셋 N"을
// 계산해서 보여줌 - name을 아예 저장 안 해두는 이유는 언어를 바꿔도 항상 최신 언어를 따라가게
// 하기 위함([[i18n.js]]의 i18nIsDefaultName 마이그레이션과 짝을 이룸)
function runePresetDisplayName(preset, idx) {
  return (preset && preset.name) || t("my_dino.presetDefaultName", { index: idx + 1 });
}

function defaultMyDinoProfile() {
  return {
    baseAtk: 1,
    baseHp: 10,
    moveSpeed: 1,
    vip: 0,
    dinoCount: 5,
    currentHpPercent: 100, // 광전사의 분노 판정용(전투 중 실시간이 아니라 직접 설정하는 고정값)
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
  saved.runePresets.forEach((preset, i) => {
    preset.runes = sanitizeRuneConflicts(preset.runes);
    // 예전엔 이름을 한 번도 안 바꾼 프리셋도 name에 그때 언어로 번역된 문자열이 그대로 저장돼
    // 있었음 - 5개 언어 중 하나로 구워진 "자동 기본 이름"과 정확히 일치하면 다시 null로 되돌려서
    // runePresetDisplayName()이 항상 지금 언어로 계산해 보여주게 함(사용자 지적으로 발견한 버그)
    if (i18nIsDefaultName("my_dino.presetDefaultName", i + 1, preset.name)) preset.name = null;
  });
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
    bonusPercent: getEffectiveBonusPercent(p),
    currentHpPercent: p.currentHpPercent
  };
}

// 다른 페이지(타이탄, 공룡 대전 등)가 시뮬레이션 엔진에 바로 넣을 수 있는 형태로 변환
function getMyDinoBattleInputs(storageKey = MY_DINO_PROFILE_KEY) {
  return dinoProfileToBattleInputs(loadMyDinoProfile(storageKey));
}

// ===== 서버 레벨캡 - 타이탄/공룡대전/허수아비/건물 4개 페이지 공용(사용자 확정, 전역 공유 설정 -
// 페이지별 타일 설정이 아니라 localStorage 키 하나를 다같이 읽고 씀). "레벨" 자체는 이미 있는
// 공식(요약 카드/전투력에 쓰는 것과 동일 - my-dino-page.js의 updateSummary, arena-page.js의
// arenaComputeLevel): baseAtk + floor(baseHp/10) + moveSpeed. 레벨캡을 넘으면 이속은 그대로 두고
// (캡 대상 아님), 남은 예산을 "지금 공격력:체력(10당1) 비율" 그대로 나눠서 새 baseAtk/baseHp를
// 만듦 - 검증: 공격 600/체력 4000/이속 150(레벨 1150)에 캡 650을 걸면 remaining=500,
// newAtk=300, newHp=2000이 나오고, 이걸 같은 공식에 다시 넣으면 300+200+150=650으로 캡과
// 정확히 일치함(자기일관성 확인 완료) =====
const SERVER_LEVEL_CAP_KEY = "dino_server_level_cap";

// "없음" + 1200~3000(100단위, 사용자 확정) - BUFF_TOWER_OPTIONS 만드는 방식과 동일하게 매핑
const SERVER_LEVEL_CAP_OPTIONS = [
  { value: null, label: "없음" }, // dummy-page.js의 dummyOptLabel()이 표시 시점에 번역함(공유 상수라 label 원문은 그대로 둠)
  ...Array.from({ length: 19 }, (_, i) => {
    const v = 1200 + i * 100;
    return { value: v, label: v.toLocaleString() };
  })
];

function loadServerLevelCap() {
  const saved = Number(localStorage.getItem(SERVER_LEVEL_CAP_KEY));
  return SERVER_LEVEL_CAP_OPTIONS.some((o) => o.value === saved) ? saved : null;
}

function saveServerLevelCap(value) {
  localStorage.setItem(SERVER_LEVEL_CAP_KEY, String(value));
}

// dinoProfileToBattleInputs(p) 자체는 건드리지 않음(arena-page.js 등 이 스코프 밖 페이지도
// 그 함수를 그대로 쓰기 때문) - 캡을 적용하고 싶은 페이지가 이 함수를 한 번 더 거치게 함
function applyServerLevelCap(inputs) {
  const cap = loadServerLevelCap();
  if (cap === null) return inputs;

  const hpUnit = Math.floor(inputs.baseHp / 10);
  const level = inputs.baseAtk + hpUnit + inputs.moveSpeed;
  if (level <= cap) return inputs;

  const remaining = Math.max(0, cap - inputs.moveSpeed);
  const total = inputs.baseAtk + hpUnit;
  const newBaseAtk = total > 0 ? Math.round((remaining * inputs.baseAtk) / total) : 0;
  const newHpUnit = total > 0 ? Math.round((remaining * hpUnit) / total) : 0;

  return { ...inputs, baseAtk: newBaseAtk, baseHp: newHpUnit * 10 };
}

// 서버 레벨캡의 40% 이하 레벨이면 별자리 효과 자체가 적용되지 않는 신규 규칙(사용자 확정). 레벨캡이
// "없음"이면 성립 안 함. applyServerLevelCap은 레벨캡을 "초과"할 때만 baseAtk/baseHp를 깎으므로,
// 이 "미달" 판정 범위(40% 이하 <= 레벨캡)에서는 항상 원본 레벨 그대로라 순서와 무관하게 안전함
function isConstellationBlockedByLevelCap(level) {
  const cap = loadServerLevelCap();
  return cap !== null && level <= cap * 0.4;
}

// 위 규칙을 실제 전투 계산 입력값에 반영 - 별자리 필드를 전부 없앤 객체로 교체(각 엔진이 쓰는
// `constellation.xxx || 0` 폴백 패턴에 안전, RUNES_DATA 등과 무관하게 항상 0 취급됨)
function applyLowLevelConstellationBlock(inputs) {
  const level = inputs.baseAtk + Math.floor(inputs.baseHp / 10) + inputs.moveSpeed;
  if (!isConstellationBlockedByLevelCap(level)) return inputs;
  return { ...inputs, constellation: {} };
}

// ===== 별자리 레벨캡 - 서버 레벨캡과 같은 4개 페이지 공용/전역 공유 설정(사용자 확정 - "레벨캡을
// 사용하는 곳이라면 당연히 별자리 캡도 존재할 테니 그쪽에서"). 별자리는 지금도 "각 스탯의 최종
// 누적 수치"를 그대로 입력받는 방식이라(레벨 자체는 입력 안 받음) 그 입력 UI는 그대로 두고
// (사용자 확정 - "지금 별자리 입력하는 방식을 그대로 사용하되"), 캡을 걸면 입력값과 "캡 레벨의
// 누적치"(js/data/constellation-data.js) 중 작은 쪽을 씀. 자료가 없는 구간(치확 36+, 스튜
// 19+)은 캡을 걸 근거가 없어서 그냥 입력값 그대로 둠(틀린 값을 만들어내는 것보다 안전) =====
const CONSTELLATION_LEVEL_CAP_KEY = "dino_constellation_level_cap";

function loadConstellationLevelCap() {
  const saved = Number(localStorage.getItem(CONSTELLATION_LEVEL_CAP_KEY));
  return CONSTELLATION_LEVEL_CAP_OPTIONS.some((o) => o.value === saved) ? saved : null;
}

function saveConstellationLevelCap(value) {
  localStorage.setItem(CONSTELLATION_LEVEL_CAP_KEY, String(value));
}

function applyConstellationCap(inputs) {
  const cap = loadConstellationLevelCap();
  if (cap === null || !inputs.constellation) return inputs;

  const cappedConstellation = { ...inputs.constellation };
  Object.keys(CONSTELLATION_CAP_TABLES).forEach((statKey) => {
    const table = CONSTELLATION_CAP_TABLES[statKey];
    const capValueAtLevel = table[cap];
    if (capValueAtLevel === undefined) return; // 이 스탯은 해당 레벨까지 자료가 없음 - 캡 생략
    const current = cappedConstellation[statKey] || 0;
    if (current > capValueAtLevel) cappedConstellation[statKey] = capValueAtLevel;
  });

  return { ...inputs, constellation: cappedConstellation };
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
  // mousemove를 el이 아니라 window에 붙여야 함 - el에만 붙어있으면 드래그 도중 마우스 커서가
  // (버튼을 누른 채로) 이 요소의 경계 밖으로 나가는 순간 더 이상 이벤트가 안 잡혀서 스크롤이
  // 그 자리에서 멈춰버림. window 기준으로 좌표를 추적하면 커서가 어디에 있든(모달 바깥이어도)
  // 버튼을 뗄 때까지 계속 스크롤됨 - mouseleave로 드래그를 강제 종료하던 것도 함께 제거함.
  // window에 붙는 리스너라 el이 화면에서 사라져도(페이지 재방문 등) 스스로 안 지워지면 호출될
  // 때마다 계속 쌓임(사이트 전체 점검에서 발견) - renderMyDinoPage()는 같은 화면에 여러 인스턴스가
  // 동시에 뜰 수 있어서(다이노배틀/아레나의 "내 공룡"/"상대" 패널 등) 모듈 전역변수 하나로 막는
  // 방식은 안 맞음 - el이 더 이상 문서에 붙어있지 않으면 핸들러가 스스로 자신을 지우게 함
  // (js/ui/chart-ui.js의 리사이즈 리스너와 같은 해법)
  function onMouseUp() {
    if (!el.isConnected) { window.removeEventListener("mouseup", onMouseUp); return; }
    isDown = false;
    el.classList.remove("dragging");
  }
  window.addEventListener("mouseup", onMouseUp);

  function onMouseMove(e) {
    if (!el.isConnected) { window.removeEventListener("mousemove", onMouseMove); return; }
    if (!isDown) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 4) moved = true;
    el.scrollLeft = scrollStart - dx;
  }
  window.addEventListener("mousemove", onMouseMove);
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
  return 9; // VIP 13(최고 등급) = 부족 유닛 +4 -> 5+4=9. 여기에 공룡 수 증가 패키지(구매 시 +4)를
  // 더하면 전체 최대치가 13까지 올라감(사용자 확인) - DINO_COUNT_MAX 참고
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
  if (vip <= 7) return t("my_dino.vip.desc.tribeUnit1");
  if (vip <= 10) return t("my_dino.vip.desc.tribeUnit2");
  if (vip === 11) return t("my_dino.vip.desc.tribeUnit3pct3");
  if (vip === 12) return t("my_dino.vip.desc.tribeUnit3pct6");
  return t("my_dino.vip.desc.tribeUnit3pct9");
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
  const constellationFieldsHtml = CONSTELLATION_FIELDS.map((f) => constellationBadgeHtml(f, id)).join("");

  // splitCritStat: 아레나처럼 "공룡 수"가 의미 없는 컨텍스트에서, 그 자리를 비우는 대신 치확/치피를
  // 각각 별도 항목(칸)으로 나눠서 5칸을 그대로 채움. 기본값(공룡 수가 있는 컨텍스트)은 한 칸 안에
  // 치확/치피 두 쌍을 위아래로 쌓음(사용자 확정 - "치확/치피 한 칸에 아래위로 나눠서") - 두 경우
  // 모두 sumCritRate/sumCritDmg id를 그대로 쓰므로 updateSummary()는 분기 없이 항상 같은 코드로
  // 값을 채움(라벨 span에 stat-readout-label을 그대로 재사용해서 다른 칸의 라벨과 스타일이 완전히
  // 같아짐 - 이전엔 라벨까지 값 문자열 안에 통짜로 넣어서 값(굵은 글씨)과 스타일이 안 맞았음)
  const splitCrit = !!options.splitCritStat;
  const critItemsHtml = splitCrit
    ? `<div class="stat-readout-item"><div class="stat-readout-label">${t("my_dino.stat.critRate")}</div><div class="stat-readout-value" id="${id("sumCritRate")}">0%</div></div>
       <div class="stat-readout-item"><div class="stat-readout-label">${t("my_dino.stat.critDmg")}</div><div class="stat-readout-value" id="${id("sumCritDmg")}">0%</div></div>`
    : `<div class="stat-readout-item">
         <div class="stat-readout-crit-stack">
           <div class="stat-readout-crit-pair"><div class="stat-readout-label">${t("my_dino.stat.critRate")}</div><div class="stat-readout-value" id="${id("sumCritRate")}">0%</div></div>
           <div class="stat-readout-crit-pair"><div class="stat-readout-label">${t("my_dino.stat.critDmg")}</div><div class="stat-readout-value" id="${id("sumCritDmg")}">0%</div></div>
         </div>
       </div>
       <div class="stat-readout-item"><div class="stat-readout-label">${t("my_dino.stat.dinoCount")}</div><div class="stat-readout-value" id="${id("sumCount")}">${t("my_dino.stat.dinoCountValue", { count: 0 })}</div></div>`;

  // extraTab: 컨텍스트별로 탭을 하나 추가할 수 있는 훅(예: 아레나 배치) - { id, label, render(panelEl) }.
  // 이 파일은 어떤 페이지가 뭘 넣는지 몰라도 되게, 탭 전환/패널 표시만 일반적으로 처리함
  const extraTab = options.extraTab || null;

  container.innerHTML = `
    <div class="card dino-panel${readOnly ? " dino-panel-readonly" : ""}">
      ${dinoPanelHeaderHtml(options.header)}
      ${readOnly ? `<div class="dino-panel-readonly-tag">${options.readOnly.tagText || t("my_dino.readonlyDefaultTag")}</div>` : ""}
      <div class="dino-summary-bar">
        <div class="stat-readout">
          <div class="stat-readout-item"><div class="stat-readout-label">${t("my_dino.stat.level")}</div><div class="stat-readout-value accent" id="${id("sumLevel")}">0</div></div>
          <div class="stat-readout-item"><div class="stat-readout-label">${t("my_dino.stat.atk")}</div><div class="stat-readout-value" id="${id("sumAtk")}">0</div></div>
          <div class="stat-readout-item"><div class="stat-readout-label">${t("my_dino.stat.hp")}</div><div class="stat-readout-value" id="${id("sumHp")}">0</div></div>
          ${critItemsHtml}
        </div>
      </div>
      <div class="warning" id="${id("constellationCapWarning")}" style="display:none;">${t("my_dino.constellationCapWarning")}</div>

      <div class="dino-tabs">
        <button class="dino-tab active" data-tab="base">${t("my_dino.tab.base")}</button>
        <button class="dino-tab" data-tab="constellation">${t("my_dino.tab.constellation")}</button>
        <button class="dino-tab" data-tab="bonus">${t("my_dino.tab.bonus")}</button>
        <button class="dino-tab" data-tab="rune">${t("my_dino.tab.rune")}</button>
        ${extraTab ? `<button class="dino-tab" data-tab="${extraTab.id}">${extraTab.label}</button>` : ""}
        <div class="dino-tab-indicator" id="${id("tabIndicator")}"></div>
      </div>

      <div class="dino-tab-panel${readOnly ? " tab-panel-readonly" : ""}" data-panel="base">
        <div class="input-grid">
          <div class="full-width">
            <label>${t("my_dino.field.vip")}</label>
            <div class="custom-dropdown vip-dropdown" id="${id("vipDropdown")}">
              <div class="selected-value vip-selected-value" id="${id("vipSelectedValue")}"></div>
              <ul class="dropdown-list vip-dropdown-list" id="${id("vipList")}"></ul>
            </div>
          </div>
          <div><label>${t("my_dino.field.hp")}</label><div class="field-icon-row"><img class="field-icon" src="./assets/constellation/HP_Icon.png" alt=""><input type="tel" inputmode="numeric" id="${id("fBaseHp")}"></div></div>
          <div><label>${t("my_dino.field.atk")}</label><div class="field-icon-row"><img class="field-icon" src="./assets/constellation/Damage_Icon.png" alt=""><input type="tel" inputmode="numeric" id="${id("fBaseAtk")}"></div></div>
          <div><label>${t("my_dino.field.moveSpeed")}</label><div class="field-icon-row"><img class="field-icon" src="./assets/constellation/Speed_Icon.png" alt=""><input type="tel" inputmode="numeric" id="${id("fMoveSpeed")}"></div></div>
          <div>
            <label>${t("my_dino.field.dinoCount")}</label>
            <div class="custom-dropdown" id="${id("dinoCountDropdown")}">
              <div class="selected-value" id="${id("dinoCountSelectedValue")}"></div>
              <ul class="dropdown-list" id="${id("dinoCountList")}"></ul>
            </div>
          </div>
          <div class="full-width">
            <label>${t("my_dino.field.currentHpPercent")}</label>
            <div class="custom-dropdown" id="${id("currentHpPercentDropdown")}">
              <div class="selected-value" id="${id("currentHpPercentSelectedValue")}"></div>
              <ul class="dropdown-list" id="${id("currentHpPercentList")}"></ul>
            </div>
          </div>
        </div>
      </div>

      <div class="dino-tab-panel${readOnly ? " tab-panel-readonly" : ""}" data-panel="constellation" style="display:none;">
        <div class="input-grid">
          ${constellationFieldsHtml}
        </div>
      </div>

      <div class="dino-tab-panel${readOnly ? " tab-panel-readonly" : ""}" data-panel="bonus" style="display:none;">
        <div class="input-grid">
          <div>
            <label>${t("my_dino.field.bonusAtk")}</label>
            <div class="field-icon-row">
              <img class="field-icon" src="./assets/sprites/Tribe_Egg_0.png" alt="">
              ${plusValueFieldHtml("fBonusAtk", id, true, "%", false)}
            </div>
          </div>
          <div>
            <label>${t("my_dino.field.bonusHp")}</label>
            <div class="field-icon-row">
              <img class="field-icon" src="./assets/sprites/Nest_0.png" alt="">
              ${plusValueFieldHtml("fBonusHp", id, true, "%", false)}
            </div>
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
              <button class="btn-apply" id="${id("applyBtn")}">${t("my_dino.rune.applyBtn")}</button>
              <button class="btn-apply btn-apply-secondary" id="${id("removeBtn")}">${t("my_dino.rune.removeBtn")}</button>
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
  // 서버 레벨캡의 40% 이하 별자리 차단 경고 - 아레나는 서버 레벨캡 개념 자체를 안 쓰는 페이지라 꺼둠
  // (사용자 확정, arena-page.js의 renderMyDinoPage 호출부에서 false로 넘김)
  const showConstellationCapWarning = options.constellationLevelCapWarning !== false;
  // 아래 흩어진 el.onclick = ...같은 대입을 전부 이 헬퍼로 통일 - readOnly면 그냥 핸들러를 안
  // 붙이는 것 하나로 모든 입력/드롭다운/프리셋 항목이 한 번에 비활성화됨(각 자리마다
  // `if (readOnly) return;`을 반복해서 넣지 않아도 됨).
  // onblur 핸들러를 붙일 때는(=숫자 입력칸들) 엔터 키로도 같은 커밋이 되도록 keydown도 같이
  // 붙여줌 - 예전엔 마우스로 다른 빈 공간을 눌러 포커스를 잃어야만(blur) 값이 반영돼서 답답하다는
  // 지적(사용자 확정) - input.blur()를 호출하면 이미 등록된 onblur 핸들러가 그대로 실행되므로
  // 커밋 로직을 중복 작성할 필요 없음
  const on = (el, evt, fn) => {
    if (readOnly) return;
    el[evt] = fn;
    if (evt === "onblur") el.onkeydown = (e) => { if (e.key === "Enter") el.blur(); };
  };

  // "+수치[%]" 입력칸 공용 와이어링(별자리의 레벨표 없는 3종 + 둥지·알스킨 2종이 씀) - 실제
  // <input>은 투명해서 안 보이고, displayEl(.plus-value-display-number)이 "+숫자"를 색 입혀서
  // 보여줌. 타이핑할 때마다(oninput) 화면 표시도 같이 갱신해야 입력 중에도 뭘 쳤는지 보임.
  // onCommit(rawValue)는 profile에 최종 반영하고 저장할 숫자를 리턴해야 함.
  function wirePlusValueField(inputEl, displayEl, decimal, onCommit) {
    // 0이면 흰색(기본 글자색), 0보다 크면 노란 강조색(사용자 확정 - "이동속도부터 0이면 흰색하고
    // 그 이상부터는 그냥 노란색으로") - 다른 입력칸들과 같은 markChanged 관례를 그대로 씀
    const syncDisplay = () => {
      displayEl.textContent = inputEl.value;
      markChanged(displayEl, Number(inputEl.value) !== 0);
    };
    inputEl.value = displayEl.textContent;
    syncDisplay();
    if (readOnly) { inputEl.readOnly = true; return; }
    let beforeEditValue = inputEl.value;
    on(inputEl, "oninput", () => {
      if (decimal) sanitizeDecimalInput(inputEl); else sanitizeIntInput(inputEl);
      syncDisplay();
    });
    // 값이 0이 아니어도 편집을 시작하면 항상 빈 칸에서 새로 입력함(사용자 확정 - "입력창을
    // 클릭하면 +랑 수치가 다 안보여야 해") - 표시 레이어 자체는 CSS(.plus-value-group:focus-within
    // .plus-value-display)가 숨겨줌. 편집 시작 직전 값을 beforeEditValue에 기억해뒀다가, 아무것도
    // 안 치고 그냥 클릭으로 빠져나가면(blur) 그 값을 그대로 복원함 - 안 그러면 "이미 값이 있는데
    // 다시 눌렀다가 아무것도 안 치고 취소"만 해도 0으로 지워지는 버그가 생김(사용자 제보)
    on(inputEl, "onfocus", () => { beforeEditValue = inputEl.value; inputEl.value = ""; syncDisplay(); });
    on(inputEl, "onblur", () => {
      const raw = inputEl.value.trim() === "" ? beforeEditValue : inputEl.value;
      const committed = onCommit(raw);
      inputEl.value = committed;
      syncDisplay();
    });
  }

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
  // 폰트 로딩이 늦게 끝나면 처음 잰 위치가 어긋나므로 다시 맞춤(글자 폭만 바뀌고 탭 박스 크기
  // 자체는 그대로인 경우 대비 - flex:1이라 보통은 안 바뀌지만 혹시 몰라 유지)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => moveIndicator(root.querySelector(".dino-tab.active")));
  }
  // 예전엔 window resize 이벤트만 듣고 있어서, 창 크기는 그대로인데 탭 줄 자체의 폭만 바뀌는
  // 경우(예: 이 컴포넌트가 임베드되는 공룡대전/아레나/타이탄 사이드 패널에서 옆의 3D 캔버스가
  // 마운트 후 비동기로 크기를 잡으며 레이아웃을 흔드는 경우, 사이트 전체 점검에서 발견)엔 인디케이터
  // 폭이 갱신되지 않아 "기본 스탯" 탭 밑줄이 실제 탭 너비와 어긋나 보였음(노란색 가로바 가로크기
  // 오류) - window resize 대신 탭 줄 자체를 ResizeObserver로 직접 지켜봐서 원인 불문하고 크기가
  // 바뀔 때마다 항상 다시 맞추게 함
  const tabsRow = root.querySelector(".dino-tabs");
  const tabIndicatorObserver = new ResizeObserver(() => {
    if (!root.isConnected) { tabIndicatorObserver.disconnect(); return; }
    moveIndicator(root.querySelector(".dino-tab.active"));
  });
  tabIndicatorObserver.observe(tabsRow);

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
    dinoCountSelectedValue.textContent = t("my_dino.stat.dinoCountValue", { count });
    markChanged(dinoCountSelectedValue, count !== 5);
  }

  // 실제 게임의 절대 최대치는 13마리(VIP13 부족 유닛 +4 = 9, 여기에 공룡 수 증가 패키지 +4를
  // 더한 값 - 사용자 확인, 패키지 출시 전엔 9가 상한이었음)
  for (let i = 1; i <= 13; i++) {
    const li = document.createElement("li");
    li.textContent = t("my_dino.stat.dinoCountValue", { count: i });
    on(li, "onclick", () => {
      setDinoCount(i);
      dinoCountList.style.display = "none";
      persistAndRefresh();
    });
    dinoCountList.appendChild(li);
  }
  setDinoCount(profile.dinoCount);

  on(dinoCountSelectedValue, "onclick", () => toggleDropdownList(dinoCountSelectedValue, dinoCountList));

  // 현재 체력 % - 광전사의 분노 룬 판정용(사용자 확정 - "그냥 기본 스탯 제일 밑에 현재 체력 설정
  // 해놓고 10% 단위로 설정 가능하게 해"). 전투 중 실시간으로 바뀌는 값이 아니라, 허수아비/건물처럼
  // 체력 개념 자체가 없는 모드까지 전부 커버하는 단일 고정값 - dinoCount와 같은 커스텀 드롭다운 패턴
  const currentHpPercentList = $("currentHpPercentList");
  const currentHpPercentSelectedValue = $("currentHpPercentSelectedValue");

  function setCurrentHpPercent(percent) {
    profile.currentHpPercent = percent;
    currentHpPercentSelectedValue.textContent = t("my_dino.stat.currentHpPercentValue", { percent });
    markChanged(currentHpPercentSelectedValue, percent !== 100);
  }

  for (let v = 100; v >= 10; v -= 10) {
    const li = document.createElement("li");
    li.textContent = t("my_dino.stat.currentHpPercentValue", { percent: v });
    on(li, "onclick", () => {
      setCurrentHpPercent(v);
      currentHpPercentList.style.display = "none";
      persistAndRefresh();
    });
    currentHpPercentList.appendChild(li);
  }
  setCurrentHpPercent(profile.currentHpPercent);

  on(currentHpPercentSelectedValue, "onclick", () => toggleDropdownList(currentHpPercentSelectedValue, currentHpPercentList));

  // VIP (이미지 배지 + 설명이 들어가는 커스텀 드롭다운. <select>는 항목 안에 이미지를 넣을 수 없어서 직접 구현)
  const vipList = $("vipList");
  const vipSelectedValue = $("vipSelectedValue");

  function vipIconMarkup(vip, sizeClass) {
    return `<div class="vip-option-icon ${sizeClass || ""}" style="background-image:url('${getVipIconFile(vip)}')"><span class="vip-option-num">${vip}</span></div>`;
  }

  function renderVipSelected() {
    const label = profile.vip <= 0 ? t("my_dino.vip.noneLabel") : t("my_dino.vip.levelLabel", { level: profile.vip });
    vipSelectedValue.innerHTML = `${vipIconMarkup(profile.vip, "small")}<span>${label}</span>`;
    markChanged(vipSelectedValue, profile.vip !== 0);
  }

  for (let v = 0; v <= 13; v++) {
    const li = document.createElement("li");
    li.className = "vip-option";
    const label = v <= 0 ? t("my_dino.vip.noneLabel") : t("my_dino.vip.levelLabel", { level: v });
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

  // 별자리 - 레벨표(CONSTELLATION_CAP_TABLES, js/data/constellation-data.js)가 있는 6개 스탯은
  // 값을 직접 입력하는 대신 레벨을 고르는 드롭다운("Lv. 33 (+270)")으로(사용자 확정 - "스튜효과까지
  // 레벨로 되어 있는 건 드롭다운으로 해결하자" - 드롭다운은 항상 표에 있는 값만 고를 수 있어서
  // 잘못된 값 입력 자체가 불가능해짐), 나머지 3개(이동속도/보스 피해 감소·증가)는 원본 자료 자체가
  // 없어서 예전처럼 수치만 입력받음(가운데 정렬)
  CONSTELLATION_FIELDS.forEach(({ fieldId, key, decimal, suffix }) => {
    const table = CONSTELLATION_CAP_TABLES[key];

    if (table) {
      const selectedValueEl = $(`${fieldId}SelectedValue`);
      const listEl = $(`${fieldId}List`);
      const setLevel = (level) => {
        const value = table[level];
        profile.constellation[key] = value;
        selectedValueEl.textContent = constellationLevelOptionLabel(level, value, suffix);
        markChanged(selectedValueEl, value !== 0);
      };
      table.forEach((value, level) => {
        if (value === undefined) return; // 스튜처럼 일부 레벨까지만 자료가 있는 경우 그 이후는 생략
        const li = document.createElement("li");
        li.textContent = constellationLevelOptionLabel(level, value, suffix);
        on(li, "onclick", () => {
          setLevel(level);
          listEl.style.display = "none";
          persistAndRefresh();
        });
        listEl.appendChild(li);
      });
      // 기존 값이 표에 없는 예전 데이터 등 예외적인 경우 레벨 0으로 안전하게 보정
      const initialLevel = constellationLevelForValue(key, profile.constellation[key]) ?? 0;
      setLevel(initialLevel);
      on(selectedValueEl, "onclick", () => toggleDropdownList(selectedValueEl, listEl));
      return;
    }

    const el = $(fieldId);
    const displayEl = $(`${fieldId}Display`);
    displayEl.textContent = profile.constellation[key];
    wirePlusValueField(el, displayEl, decimal, (raw) => {
      profile.constellation[key] = Number(raw) || 0;
      persistAndRefresh();
      return profile.constellation[key];
    });
  });

  // 둥지·알스킨 (합산된 %값 하나씩만 존재)
  const fBonusAtk = $("fBonusAtk");
  const fBonusHp = $("fBonusHp");
  const fBonusAtkDisplay = $("fBonusAtkDisplay");
  const fBonusHpDisplay = $("fBonusHpDisplay");
  fBonusAtkDisplay.textContent = profile.bonusPercent.atk;
  fBonusHpDisplay.textContent = profile.bonusPercent.hp;
  wirePlusValueField(fBonusAtk, fBonusAtkDisplay, true, (raw) => {
    profile.bonusPercent.atk = Number(raw) || 0;
    persistAndRefresh();
    return profile.bonusPercent.atk;
  });
  wirePlusValueField(fBonusHp, fBonusHpDisplay, true, (raw) => {
    profile.bonusPercent.hp = Number(raw) || 0;
    persistAndRefresh();
    return profile.bonusPercent.hp;
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
    const input = document.createElement("input");
    input.type = "text";
    input.className = "preset-name-input";
    input.value = runePresetDisplayName(profile.runePresets[idx], idx);
    input.maxLength = 6;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      // 비워서 확정하면 null로 되돌려서(특정 문자열을 저장하는 게 아니라) 다시 "자동, 언어 따라감"
      // 상태로 리셋됨 - 지금 언어로 보인 기본 문구를 그대로 구워 넣지 않기 위함
      profile.runePresets[idx].name = input.value.trim() || null;
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
        <span class="preset-btn-name" data-idx="${idx}">${runePresetDisplayName(preset, idx)}</span>
        ${isActive && !readOnly ? `<button type="button" class="preset-edit-btn" title="${t("my_dino.preset.editTooltip")}">✏️</button>` : ""}
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
      updateSummary(profile, idPrefix, options.splitCritStat, true, showConstellationCapWarning);
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
    updateSummary(profile, idPrefix, options.splitCritStat, true, showConstellationCapWarning);
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

  updateSummary(profile, idPrefix, options.splitCritStat, false, showConstellationCapWarning);

  // extraTab(예: 아레나 배치)이 있으면 그 탭 패널에 컨텍스트가 제공한 렌더러를 한 번 실행 -
  // readOnly와 무관하게 항상 실행(아레나 배치는 상대가 읽기 전용이어도 로컬 편집 가능한 별개 데이터)
  if (options.extraTab) {
    const panelEl = $("extraTabPanel");
    if (panelEl) options.extraTab.render(panelEl);
  }

  // 헤더의 닫기 버튼은 매 렌더마다 새 DOM이라 여기서 매번 다시 바인딩
  wireDinoPanelHeader(root, options.header);
}

// animate=true면(사용자가 설정을 실제로 수정해서 재계산된 경우) 값이 바뀐 항목만 롤링 애니메이션으로
// 보여줌(js/ui/stat-roll-ui.js) - 처음 페이지를 열 때(마운트 시 최초 1회)는 "0 -> 실제값"으로 전부
// 애니메이션되면 산만하니 animate=false로 그냥 바로 표시함
function updateSummary(profile, idPrefix = "", splitCrit = false, animate = false, showConstellationCapWarning = true) {
  const id = (name) => idPrefix + name;
  // 레벨 = 기본 공격력 + (기본 체력 / 10) + 이동속도 (룬 등으로 증폭되지 않은 순수 기본 스탯 기준)
  // 검증: 체력 7810, 공격력 886, 이동속도 150 -> 886 + 781 + 150 = 1817
  const level = profile.baseAtk + Math.floor(profile.baseHp / 10) + profile.moveSpeed;
  // 서버 레벨캡의 40% 이하면 별자리가 적용되지 않는 신규 규칙 - 요약 카드도 실제 전투 계산과 같은
  // 결과를 보여줘야 하므로 여기서도 반영(아레나는 서버 레벨캡 자체를 안 쓰는 페이지라 이 경고를 끔)
  const constellationBlocked = showConstellationCapWarning && isConstellationBlockedByLevelCap(level);
  const stats = getBattleStats({
    baseAtk: profile.baseAtk,
    baseHp: profile.baseHp,
    count: profile.dinoCount,
    selectedRunes: profile.runes,
    constellation: constellationBlocked ? {} : profile.constellation,
    bonusPercent: getEffectiveBonusPercent(profile),
    currentHpPercent: profile.currentHpPercent
  });
  const setVal = (elId, text) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (animate) {
      animateStatValue(el, text);
    } else {
      el.textContent = text;
      el.dataset.statRollRaw = text;
    }
  };
  setVal(id("sumAtk"), Math.floor(stats.fAtk).toLocaleString());
  setVal(id("sumHp"), Math.floor(stats.fHp).toLocaleString());
  // 치확/치피는 splitCritStat이든 아니든(한 칸에 두 쌍을 쌓든, 별도 두 칸이든) 항상 같은 id를 쓰므로
  // 분기 없이 동일하게 채움 - 라벨은 HTML 쪽 stat-readout-label에 이미 있으니 여기서는 숫자값만
  setVal(id("sumCritRate"), `${stats.cRate.toFixed(2)}%`);
  setVal(id("sumCritDmg"), `${stats.cDmg.toFixed(2)}%`);
  if (!splitCrit) {
    setVal(id("sumCount"), t("my_dino.stat.dinoCountValue", { count: profile.dinoCount }));
  }
  setVal(id("sumLevel"), level.toLocaleString());
  const warnEl = document.getElementById(id("constellationCapWarning"));
  if (warnEl) warnEl.style.display = constellationBlocked ? "block" : "none";
}

