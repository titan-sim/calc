function getImgUrl(id) {
  // assets / rune image folder 경로 반영
  return id
    ? `./assets/rune image folder/${id}.png`
    : "./assets/rune image folder/default.png";
}
// 전역 변수 선언부
let isLogEnabled = false;
let detailedLogs = [];
// 상세 로그 토글 이벤트 (스크립트 하단에 추가)
document.getElementById("logToggle").addEventListener("change", (e) => {
  isLogEnabled = e.target.checked;
  // 로그를 켜면 기존 로그 초기화
  if (isLogEnabled) {
    detailedLogs = [];
    console.log("상세 로그 수집 활성화");
  }
});

function toggleDropdown(id) {
  const list = document.getElementById(id);
  const isOpen = list.style.display === "block";
  document
    .querySelectorAll(".dropdown-list")
    .forEach((el) => (el.style.display = "none"));
  list.style.display = isOpen ? "none" : "block";
}
// 외부 클릭 시 드롭다운 닫기
window.addEventListener("click", (e) => {
  if (!e.target.closest(".custom-dropdown")) {
    document
      .querySelectorAll(".dropdown-list")
      .forEach((el) => (el.style.display = "none"));
  }
});

function toggleMenu() {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  const isOpen = menu.classList.toggle("open");
  overlay.style.display = isOpen ? "block" : "none";
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  const themeBtn = document.getElementById("themeBtn");
  themeBtn.innerText = isLight ? "☀️ 라이트 모드" : "🌙 다크 모드";
  localStorage.setItem("dino_theme", isLight ? "light" : "dark");
}
window.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("dino_theme") === "light") {
    document.body.classList.add("light-mode");
    const themeBtn = document.getElementById("themeBtn");
    if (themeBtn) themeBtn.innerText = "☀️ 라이트 모드";
  }
});
// 룬 데이터 영역 (이곳에 수정하신 룬 데이터를 붙여넣으세요)

// --- 룬 설명 색상 설정 및 변환 로직 추가 ---
const RUNE_STYLE_CONFIG = {
  "#ba0000": ["atk_f", "atk_p", "burst_p", "crit_d"], // 빨강 (전설 등급색) - 공격
  "#66bb6a": ["hp_f", "hp_p", "rec_p", "value"], // 초록 (희귀 등급색) - 체력/회복
  "#eb5f0e": ["red_f", "red_p"], // 주황 (유니크 등급색) - 피해 감소
  "#ff9800": ["prob", "turn", "count"] // 노랑 (에픽 등급색) - 확률/턴
};
const RUNE_COLOR_MAP = {};
for (const [color, keys] of Object.entries(RUNE_STYLE_CONFIG)) {
  keys.forEach((key) => (RUNE_COLOR_MAP[key] = color));
}
const RUNE_TAG_REGEX = /\{(\w+)\}/g;

function getFormattedDesc(runeName, level) {
  const rune = RUNES_DATA[runeName];
  if (!rune || !rune.levels[level]) return "";
  const stats = rune.levels[level];
  return rune.desc.replace(RUNE_TAG_REGEX, (match, key) => {
    const value = stats[key];
    if (value === undefined) return match;
    const color = RUNE_COLOR_MAP[key] || "#fff";
    return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
  });
}
// ------------------------------------------
const titanStats = [];
const unsuitableList = [
  "강인함 1",
  "강인함 2",
  "자연의 포옹",
  "승리의 함성",
  "부족의 축복 1",
  "부족의 축복 2",
  "파괴자 1",
  "파괴자 2",
  "파괴자 3",
  "지진"
];
const vampExclusion = [
  "고독한 분노",
  "협동 공격",
  "마지막 선물",
  "보스 슬레이어"
];
let selectedRunes = [null, null, null, null, null];
let activeSlotIdx = null;
let tempName = "";
function getLvClass(lv) {
  const n = parseInt(lv);
  if (n <= 5) return "lv-5";
  if (n <= 10) return "lv-10";
  if (n <= 15) return "lv-15";
  if (n <= 20) return "lv-20";
  if (n <= 25) return "lv-25";
  if (n <= 30) return "lv-30";
  return "lv-31"; 
}
// 모든 설정값 저장 함수
function saveUserConfig() {
  const config = {
    baseAtk: document.getElementById("baseAtk").value,
    baseHp: document.getElementById("baseHp").value,
    dinoCount: document.getElementById("dinoCount").value,
    titanLevel: document.getElementById("titanLevelSelect").value,
    timeLimit: document.getElementById("timeLimitSelect").value,
    selectedRunes: selectedRunes // [ {name, lv}, ... ]
  };
  localStorage.setItem("dino_sim_config", JSON.stringify(config));
}
// 저장된 데이터 불러오기 함수
function loadUserConfig() {
  const saved = localStorage.getItem("dino_sim_config");
  if (!saved) return;
  const config = JSON.parse(saved);
  // 기본 정보 복구
  document.getElementById("baseAtk").value = config.baseAtk;
  document.getElementById("baseHp").value = config.baseHp;
  document.getElementById("dinoCount").value = config.dinoCount;
  // 1. 타이탄 레벨 복구 및 라벨 갱신
  const tLevel = config.titanLevel || 1;
  document.getElementById("titanLevelSelect").value = tLevel;
  if (titanStats[tLevel]) {
    const atk = titanStats[tLevel].atk;
    const hp = titanStats[tLevel].hp.toLocaleString();
    document.querySelector(
      "#titanDropdown .selected-value"
    ).textContent = `Lv. ${tLevel} (ATK ${atk} / HP ${hp})`;
  }
  // 2. 시간 제한 복구 및 라벨 갱신
  const tLimit = config.timeLimit || 90;
  document.getElementById("timeLimitSelect").value = tLimit;
  document.querySelector(
    "#timeDropdown .selected-value"
  ).textContent = `${tLimit}분`;
// 룬 슬롯 복구
if (config.selectedRunes) {
  selectedRunes = config.selectedRunes;
  selectedRunes.forEach((rune, idx) => {
    const slot = document.getElementById(`slot-${idx}`);
    if (rune && rune.name && RUNES_DATA[rune.name]) {
      const r = RUNES_DATA[rune.name];
      const lvClass = getLvClass(rune.lv); // 공통 함수 호출

      // [최종 수정] 룬 테두리 클래스를 제거하고 이미지와 레벨만 배치
      slot.innerHTML = `
        <img src="${getImgUrl(r.imgId)}" class="slot-img">
        <div class="slot-lv-tag ${lvClass}">${rune.lv}</div>
      `;
    } else {
      slot.innerHTML = ""; // 데이터 없으면 비우기
    }
  });
}
  calcFinal(); // 화면 스탯 갱신
}
window.onload = () => {
  // 1. 타이탄 데이터 및 커스텀 드롭다운 목록 생성
  const titanList = document.getElementById("titanList");
  for (let lv = 1; lv <= 50; lv++) {
    let atk, hp;
    if (lv <= 6) {
      atk = lv * 5;
      hp = 2500000 * lv;
    } else if (lv <= 10) {
      atk = 30 + (lv - 6) * 15;
      const hps = {
        7: 20625000,
        8: 24375000,
        9: 28125000,
        10: 31875000
      };
      hp = hps[lv];
    } else {
      atk = 90 + (lv - 10) * 15;
      hp = 31875000 + (lv - 10) * 3750000;
    }
    titanStats[lv] = {
      atk,
      hp
    };
    // 커스텀 드롭다운용 <li> 생성
    const li = document.createElement("li");
    const label = `Lv. ${lv} (ATK ${atk} / HP ${hp.toLocaleString()})`;
    li.textContent = label;
    li.onclick = () => {
      document.querySelector(
        "#titanDropdown .selected-value"
      ).textContent = label;
      document.getElementById("titanLevelSelect").value = lv; // hidden input에 저장
      titanList.style.display = "none";
      saveUserConfig();
    };
    titanList.appendChild(li);
  }
  // 2. 시간 제한 목록 생성 (10~120분)
  const timeList = document.getElementById("timeList");
  for (let m = 10; m <= 120; m += 10) {
    const li = document.createElement("li");
    li.textContent = `${m}분`;
    li.onclick = () => {
      document.querySelector(
        "#timeDropdown .selected-value"
      ).textContent = `${m}분`;
      document.getElementById("timeLimitSelect").value = m; // hidden input에 저장
      timeList.style.display = "none";
      saveUserConfig();
    };
    timeList.appendChild(li);
  }
  // 3. 공룡 마리수 (기존 select 유지)
  const dCount = document.getElementById("dinoCount");
  for (let i = 1; i <= 9; i++) dCount.add(new Option(`${i}마리`, i));
// 4. 룬 슬롯 생성
const sc = document.getElementById("slotContainer");
for (let i = 0; i < 5; i++) {
  const div = document.createElement("div");
  div.className = "slot";
  div.id = `slot-${i}`;
  div.onclick = () => openPicker(i);
  sc.appendChild(div);
}
  // 5. 룬 그리드 생성
  const mainGrid = document.getElementById("mainGrid");
  const unsuitableGrid = document.getElementById("unsuitableGrid");
  Object.keys(RUNES_DATA).forEach((name) => {
    const r = RUNES_DATA[name];
    const isUn = unsuitableList.includes(name);
    const item = document.createElement("div");
    item.className = "rune-item";
    item.innerHTML = `<div class="rune-img-container" style="border-color:var(--${
      r.grade
    })"><img src="${getImgUrl(
      r.imgId
    )}"></div><div class="rune-label">${name}</div>`;
    item.onclick = () => showDetail(name);
    if (isUn) unsuitableGrid.appendChild(item);
    else mainGrid.appendChild(item);
  });
  // 6. 룬 레벨 셀렉트 (기존 select 유지)
  const ls = document.getElementById("levelSelect");
  for (let i = 1; i <= 31; i++) ls.add(new Option(`Lv.${i}`, i));
  ls.onchange = () => updateDetail(tempName, ls.value);
  // 7. 설정 불러오기
  loadUserConfig();
};

function openPicker(idx) {
  const picker = document.getElementById("runePicker");
  const isSameSlot = activeSlotIdx === idx;

  if (isSameSlot && picker.style.display === "block") {
    picker.style.display = "none";
    activeSlotIdx = null;
    document.querySelectorAll(".slot").forEach((s) => s.classList.remove("active"));
  } else {
    activeSlotIdx = idx;
    picker.style.display = "block";
    document.querySelectorAll(".slot").forEach((s, i) => {
      s.classList.toggle("active", i === idx);
    });

    // [수정 핵심] 장착된 룬 데이터 가져오기
    const savedRune = selectedRunes[idx]; 

    if (savedRune && savedRune.name) {
      // 1. 상세창에 이름과 등급 표시
      showDetail(savedRune.name);
      
      // 2. 저장된 레벨이 있다면 레벨 선택 셀렉트 박스 값을 맞추고 상세 설명 갱신
      if (savedRune.lv) {
        document.getElementById("levelSelect").value = savedRune.lv;
        updateDetail(savedRune.name, savedRune.lv);
      }
    } else {
      // 장착된 룬이 없는 빈 슬롯이면 상세창 숨김
      document.getElementById("runeDetail").style.display = "none";
    }

    picker.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }
}

function showDetail(name) {
  tempName = name;
  const r = RUNES_DATA[name];
  document.getElementById("runeDetail").style.display = "block";
  document.getElementById("detailName").innerText = name;
  document.getElementById("detailGrade").innerText = r.grade;
  document.getElementById("detailGrade").style.color = `var(--${r.grade})`;
  updateDetail(name, document.getElementById("levelSelect").value);
}

function updateDetail(name, lv) {
  const r = RUNES_DATA[name];
  const s = r.levels[lv];
  let d = r.desc || "";
  if (s) {
    // {key} 형태의 태그를 찾아 매핑된 색상과 수치로 치환
    d = d.replace(/\{(\w+)\}/g, (match, key) => {
      const value = s[key];
      if (value === undefined) return match;
      const color = RUNE_COLOR_MAP[key] || "#fff"; // 매핑 없으면 흰색
      return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
    });
  }
  document.getElementById("detailDesc").innerHTML = d;
}
// 1. 중복 체크 및 장착 로직
function applyRuneToSlot() {
  const lv = document.getElementById("levelSelect").value;
  const slot = document.getElementById(`slot-${activeSlotIdx}`);
  const warnEl = document.getElementById("runeWarning");

  // --- 상호 배타적 체크 (기존 로직 유지) ---
  const isAddingCompression = tempName === "압축된 힘";
  const isAddingMammoth = tempName === "매머드의 힘";

  if (isAddingCompression || isAddingMammoth) {
    const targetToRemove = isAddingCompression ? "매머드의 힘" : "압축된 힘";
    const hasOpposite = selectedRunes.some((r) => r && r.name === targetToRemove);

    if (hasOpposite) {
      warnEl.innerText = `⚠️ '${targetToRemove}'과 동시에 장착할 수 없습니다.`;
      warnEl.style.display = "block";
      warnEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
  }

  // 중복 룬 제거 로직
  selectedRunes.forEach((rune, idx) => {
    if (rune && rune.name === tempName) {
      selectedRunes[idx] = null;
      document.getElementById(`slot-${idx}`).innerHTML = ""; 
    }
  });

  // [수정 포인트] 레벨 클래스 계산 (이게 없어서 장착이 안 됐던 것임)
  const lvClass = getLvClass(lv); 

  // 데이터 저장
  selectedRunes[activeSlotIdx] = { name: tempName, lv: lv };

  // [구조 유지] 기존에 위치가 잘 잡혔던 구조에 클래스만 추가
  slot.innerHTML = `
    <img src="${getImgUrl(RUNES_DATA[tempName].imgId)}" class="slot-img">
    <div class="slot-lv-tag ${lvClass}">${lv}</div>
  `;

  // 장착 성공 시 UI 정리
  document.getElementById("runePicker").style.display = "none";
  warnEl.style.display = "none";
  calcFinal();
  saveUserConfig();
}
// 2. 장착 해제 로직
function removeRuneFromSlot() {
  if (activeSlotIdx === null) return;
  selectedRunes[activeSlotIdx] = null;
  const slot = document.getElementById(`slot-${activeSlotIdx}`);
  // 안전하게 비우고 기본 텍스트 삽입
  slot.textContent = "";
  document.getElementById("runePicker").style.display = "none";
  calcFinal();
  saveUserConfig();
}
// 3. 상세 정보 표시 및 자동 스크롤
function showDetail(name) {
  tempName = name;
  document.getElementById("runeWarning").style.display = "none";
  const r = RUNES_DATA[name];
  const detailView = document.getElementById("runeDetail");
  detailView.style.display = "block";
  document.getElementById("detailName").innerText = name;
  document.getElementById("detailGrade").innerText = r.grade;
  document.getElementById("detailGrade").style.color = `var(--${r.grade})`;
  updateDetail(name, document.getElementById("levelSelect").value);
  // 하단 상세창으로 자동 스크롤
  detailView.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}
// 전투 스탯 계산 (보스 슬레이어 및 정수/퍼센트 합산)
let isDefenseExpected = false; // 피해 감소 기대값 모드 여부
let isVampExpected = false; // 흡혈 기대값 모드 여부
function getBattleStats() {
  const bAtk = Number(document.getElementById("baseAtk").value);
  const bHp = Number(document.getElementById("baseHp").value);
  const count = Number(document.getElementById("dinoCount").value);
  let atkF = 0,
    atkP = 0,
    hpF = 0,
    hpP = 0,
    cRate = 3,
    cDmg = 105;
  // 추가 스탯 변수
  let redF = 0; // 단단한 피부 합산
  let resProb1 = 0,
    resVal1 = 0,
    resProb2 = 0,
    resVal2 = 0; // 피해 저항 스탯
  let vProb = 0,
    vRecP = 0; // 흡혈 스탯
  // 흡혈 기준 공격력(vampBaseAtk) 계산용 변수
  let atkF_vamp = 0,
    atkP_vamp = 0;
  selectedRunes.forEach((r) => {
    if (!r) return;
    const s = RUNES_DATA[r.name].levels[r.lv];
    // 1. 기본 공격력/체력 조건부 합산
    let active =
      r.name === "협동 공격"
        ? count >= 5
        : r.name === "고독한 분노"
        ? count === 1
        : true;
    if (active) {
      if (s.atk_f) atkF += s.atk_f;
      if (s.atk_p) atkP += s.atk_p;
      if (s.hp_f) hpF += s.hp_f;
      if (s.hp_p) hpP += s.hp_p;
    }
    // 2. 흡혈 전용 공격력 합산 (협동/고독 제외)
    if (!vampExclusion.includes(r.name)) {
      if (s.atk_f) atkF_vamp += s.atk_f;
      if (s.atk_p) atkP_vamp += s.atk_p;
    }
    // 3. 치명타 및 기타 스탯
    if (r.name === "치명타 확률") cRate += s.prob;
    if (r.name === "치명타 피해") cDmg += s.crit_d;
    // 4. 피해 감소/저항 합산
    if (r.name.includes("단단한 피부")) redF += s.red_f;
    if (r.name === "피해 저항 1") {
      resProb1 = s.prob;
      resVal1 = s.red_f;
    }
    if (r.name === "피해 저항 2") {
      resProb2 = s.prob;
      resVal2 = s.red_f;
    }
    // 5. 흡혈 합산
    if (r.name === "흡혈") {
      vProb = s.prob;
      vRecP = s.rec_p;
    }
  });
  // 흡혈 기준 공격력 및 1회 회복량 계산
  const vBaseAtk = (bAtk + atkF_vamp) * (1 + atkP_vamp / 100);
  const singleVamp = vBaseAtk * (vRecP / 100);
  return {
    fAtk: (bAtk + atkF) * (1 + atkP / 100),
    fHp: (bHp + hpF) * (1 + hpP / 100),
    cRate,
    cDmg,
    // 피해 감소 관련
    redF,
    resTotal: resVal1 + resVal2,
    resExpected: (resVal1 * resProb1) / 100 + (resVal2 * resProb2) / 100,
    // 흡혈 관련
    vProb,
    vampAmount: singleVamp,
    vampExpected: vBaseAtk * (vRecP / 100) * (vProb / 100) * 3
  };
}

function calcFinal() {
  const s = getBattleStats();
  // 1. 기본 공격력/체력 출력
  document.getElementById("resAtk").innerText = Math.floor(
    s.fAtk
  ).toLocaleString();
  document.getElementById("resHp").innerText = Math.floor(
    s.fHp
  ).toLocaleString();
  // 2. 피해 감소량 출력 (클릭 시 토글)
  const resRedEl = document.getElementById("resRed");
  if (isDefenseExpected) {
    const totalExp = s.redF + s.resExpected;
    resRedEl.innerHTML = `${Math.floor(
      totalExp
    ).toLocaleString()} <span style="font-size:0.75em; opacity:0.8;">(1회 피격당 기대값)</span>`;
  } else {
    resRedEl.innerText = `${s.redF.toLocaleString()} (+${s.resTotal})`;
  }
  // 3. 흡혈 회복량 출력 (클릭 시 토글)
  const resVampEl = document.getElementById("resVamp");
  if (isVampExpected) {
    resVampEl.innerHTML = `${Math.floor(
      s.vampExpected
    ).toLocaleString()} <span style="font-size:0.75em; opacity:0.8;">(1회 피격당 기대값)</span>`;
  } else {
    resVampEl.innerText =
      s.vProb > 0
        ? `${Math.floor(s.vampAmount).toLocaleString()} (${s.vProb}% 확률)`
        : "0";
  }
  saveUserConfig();
}
// 모드 전환용 함수
function toggleDefenseMode() {
  isDefenseExpected = !isDefenseExpected;
  calcFinal();
}

function toggleVampMode() {
  isVampExpected = !isVampExpected;
  calcFinal();
}
async function startSimulation() {
  const iterations = 500;
  const batchSize = 1;
  let completed = 0;
  detailedLogs = [];
  // 통계 합산용 변수 (최저 기록 관련 변수 제거)
  let totalTitanHp = 0,
    totalTime = 0,
    totalDead = 0,
    totalDmg = 0;
  const limitSec =
    Number(document.getElementById("timeLimitSelect").value) * 60;
  let timeSeriesHp = new Array(limitSec + 1).fill(0);
  let timeSeriesCount = new Array(limitSec + 1).fill(0);
  const btn = document.querySelector(".btn-simulate");
  const originalBtnText = "시뮬레이션 시작 ⚔️";
  btn.disabled = true;
  const bAtk = Number(document.getElementById("baseAtk").value);
  const bHp = Number(document.getElementById("baseHp").value);
  const tLv = document.getElementById("titanLevelSelect").value;
  const targetTitan = titanStats[tLv];
  const maxDino = Number(document.getElementById("dinoCount").value);
  const runes = selectedRunes.map((r) =>
    r
      ? {
          ...r,
          s: RUNES_DATA[r.name].levels[r.lv]
        }
      : null
  );
  let atkF_vamp = 0,
    atkP_vamp = 0;
  runes.forEach((r) => {
    if (
      !r ||
      (typeof vampExclusion !== "undefined" && vampExclusion.includes(r.name))
    )
      return;
    if (r.s.atk_f) atkF_vamp += r.s.atk_f;
    if (r.s.atk_p) atkP_vamp += r.s.atk_p;
  });
  const vampBaseAtk = (bAtk + atkF_vamp) * (1 + atkP_vamp / 100);
  const runBatch = () => {
    const end = Math.min(completed + batchSize, iterations);
    for (let i = completed; i < end; i++) {
      let dinos = [];
      for (let dIdx = 0; dIdx < maxDino; dIdx++) {
        dinos.push({
          hp: 0,
          giftAtk: 0,
          giftSteps: 0,
          shieldSteps: 0,
          attackCount: 0
        });
      }
      let tHp = targetTitan.hp;
      let sessionTime = 0;
      let prevAliveCount = maxDino;
      let initialFullHp = 0;
      for (let t = 1; t <= limitSec; t++) {
        sessionTime = t;
        let aliveDinos = dinos.filter((d) => d.hp > 0);
        let aliveCount = t === 1 ? maxDino : aliveDinos.length;
        if (aliveCount <= 0) break;
        if (t > 1 && aliveCount < prevAliveCount) {
          if (prevAliveCount >= 5 && aliveCount < 5) {
            const coopRune = runes.find((r) => r && r.name === "협동 공격");
            if (coopRune && coopRune.s.hp_f) {
              dinos.forEach((d) => {
                if (d.hp > 0) d.hp = Math.max(0, d.hp - coopRune.s.hp_f);
              });
            }
          }
          if (prevAliveCount === 1 && aliveCount > 1) {
            const soloRune = runes.find((r) => r && r.name === "고독한 분노");
            if (soloRune && soloRune.s.hp_f) {
              dinos.forEach((d) => {
                if (d.hp > 0) d.hp = Math.max(0, d.hp - soloRune.s.hp_f);
              });
            }
          }
          aliveDinos = dinos.filter((d) => d.hp > 0);
          aliveCount = aliveDinos.length;
          if (aliveCount <= 0) break;
        }
        prevAliveCount = aliveCount;
        let atkF = 0,
          atkP = 0,
          hpF = 0,
          hpP = 0;
        let cRate = 3,
          cDmg = 105;
        runes.forEach((r) => {
          if (!r) return;
          let active =
            r.name === "협동 공격"
              ? aliveCount >= 5
              : r.name === "고독한 분노"
              ? aliveCount === 1
              : true;
          if (active) {
            if (r.s.atk_f) atkF += r.s.atk_f;
            if (r.s.atk_p) atkP += r.s.atk_p;
            if (r.s.hp_f) hpF += r.s.hp_f;
            if (r.s.hp_p) hpP += r.s.hp_p;
          }
          if (r.name === "치명타 확률") cRate += r.s.prob;
          if (r.name === "치명타 피해") cDmg += r.s.crit_d;
        });
        const currentMaxHp = (bHp + hpF) * (1 + hpP / 100);
        const currentAtk = (bAtk + atkF) * (1 + atkP / 100);
        if (t === 1) {
          initialFullHp = currentMaxHp;
          const sRune = runes.find((r) => r && r.name === "보호막");
          dinos.forEach((d) => {
            d.hp = initialFullHp;
            d.shieldSteps = sRune ? sRune.s.turn : 0;
          });
          aliveDinos = dinos;
        }
        // --- 공룡 공격 시작 ---
        for (let d of aliveDinos) {
          d.attackCount++;
          let finalBaseAtk = currentAtk + d.giftAtk;
          const calcDmg = (val) =>
            Math.random() * 100 < cRate ? val * (cDmg / 100) : val;
          // 평타
          tHp -= calcDmg(finalBaseAtk);
          // 낙뢰: s.prob(확률), s.burst_p(데미지 배율)
          const thunder = runes.find((r) => r && r.name === "낙뢰");
          if (thunder && Math.random() * 100 < thunder.s.prob) {
            tHp -= calcDmg(finalBaseAtk * (thunder.s.burst_p / 100));
          }
          // 메테오: s.prob(확률), s.burst_p(데미지 배율)
          const meteor = runes.find((r) => r && r.name === "메테오");
          if (meteor && Math.random() * 100 < meteor.s.prob) {
            tHp -= calcDmg(finalBaseAtk * (meteor.s.burst_p / 100));
          }
          // 트리플 임팩트: s.burst_p(데미지 배율)
          const triple = runes.find((r) => r && r.name === "트리플 임팩트");
          if (triple && d.attackCount % 3 === 0) {
            tHp -= calcDmg(finalBaseAtk * (triple.s.burst_p / 100));
          }
          // 타이탄 사망 체크
          if (tHp <= 0) {
            tHp = 0;
            break;
          }
          // 흡혈: s.prob(확률), s.rec_p(회복 배율)
          const vRune = runes.find((r) => r && r.name === "흡혈");
          if (vRune && Math.random() * 100 < vRune.s.prob) {
            d.hp = Math.min(
              currentMaxHp,
              d.hp + (vampBaseAtk * vRune.s.rec_p) / 100
            );
          }
          if (d.giftSteps > 0) {
            d.giftSteps--;
            if (d.giftSteps === 0) d.giftAtk = 0;
          }
        }
        if (tHp <= 0) {
          tHp = 0;
          break;
        }
        // --- 공룡 공격 끝 ---
        if (t % 3 === 0) {
          let baseTDmg = targetTitan.atk;
          const healRune = runes.find((r) => r && r.name === "힐");
          const sRune = runes.find((r) => r && r.name === "보호막");
          const sacrificeRune = runes.find((r) => r && r.name === "희생");
          const giftRune = runes.find((r) => r && r.name === "마지막 선물");
          const deathRune = runes.find((r) => r && r.name === "죽을 준비");
          for (let d of dinos) {
            if (d.hp > 0) {
              if (healRune && Math.random() * 100 < healRune.s.prob)
                d.hp = Math.min(
                  currentMaxHp,
                  d.hp + (currentMaxHp * healRune.s.rec_p) / 100
                );
              let currentTDmg = baseTDmg;
              const skin1 = runes.find((r) => r && r.name === "단단한 피부 1");
              const skin2 = runes.find((r) => r && r.name === "단단한 피부 2");
              const res1 = runes.find((r) => r && r.name === "피해 저항 1");
              const res2 = runes.find((r) => r && r.name === "피해 저항 2");
              if (skin1) currentTDmg -= skin1.s.red_f;
              if (skin2) currentTDmg -= skin2.s.red_f;
              if (res1 && Math.random() * 100 < res1.s.prob)
                currentTDmg -= res1.s.red_f;
              if (res2 && Math.random() * 100 < res2.s.prob)
                currentTDmg -= res2.s.red_f;
              currentTDmg = Math.max(0, currentTDmg);
              if (d.shieldSteps > 0) {
                currentTDmg =
                  currentTDmg * (1 - (sRune ? sRune.s.red_p : 0) / 100);
                d.shieldSteps--;
              }
              d.hp = Math.max(0, d.hp - currentTDmg);
              // 사망 시 발동 효과
              if (d.hp === 0) {
                if (
                  sacrificeRune &&
                  Math.random() * 100 < sacrificeRune.s.prob
                ) {
                  dinos.forEach((target) => {
                    if (target.hp > 0)
                      target.hp = Math.min(
                        currentMaxHp,
                        target.hp + (currentMaxHp * sacrificeRune.s.rec_p) / 100
                      );
                  });
                }
                if (deathRune && Math.random() * 100 < deathRune.s.prob) {
                  tHp -= (currentAtk * deathRune.s.burst_p) / 100;
                  if (tHp <= 0) tHp = 0;
                }
                if (giftRune && Math.random() * 100 < giftRune.s.prob) {
                  dinos.forEach((target) => {
                    if (target.hp > 0) {
                      target.giftAtk += giftRune.s.atk_f;
                      target.giftSteps = giftRune.s.turn;
                    }
                  });
                }
              }
            }
          }
          if (tHp <= 0) {
            tHp = 0;
            break;
          }
        }
        // t 루프 내부 (공룡 공격/타이탄 공격 로직 근처)
        if (isLogEnabled && i === 0) {
          // 로그가 켜져 있고, 첫 번째 반복일 때만 기록
          detailedLogs.push({
            시간: t + "초",
            타이탄HP: Math.floor(tHp).toLocaleString(),
            생존공룡: aliveCount + "마리",
            공룡상태: dinos.map((d, idx) => ({
              번호: idx + 1,
              남은HP: Math.max(0, d.hp).toFixed(0)
            }))
          });
        }
        let tickHpSum = 0;
        let safeFullHp = initialFullHp > 0 ? initialFullHp : 1;
        dinos.forEach(
          (d) => (tickHpSum += (Math.max(0, d.hp) / safeFullHp) * 100)
        );
        timeSeriesHp[t] += tickHpSum / maxDino;
        timeSeriesCount[t]++;
        if (tHp <= 0) {
          tHp = 0;
          break;
        }
      }
      totalTitanHp += Math.max(0, tHp);
      totalTime += sessionTime;
      totalDead += dinos.filter((d) => d.hp <= 0).length;
      totalDmg += targetTitan.hp - Math.max(0, tHp);
    }
    completed = end;
    btn.innerText = `시뮬레이션 중(${completed}/500)...`;
    if (completed < iterations) {
      setTimeout(runBatch, 0);
    } else {
      finalize();
    }
  };
  const finalize = () => {
    const rep = document.getElementById("battleReport");
    rep.style.display = "block";
    let validTicks = 0,
      totalAvgSum = 0;
    const chartData = [];
    for (let k = 1; k <= limitSec; k++) {
      if (timeSeriesCount[k] > 0) {
        const avg = timeSeriesHp[k] / timeSeriesCount[k];
        if (timeSeriesCount[k] >= iterations * 0.01) {
          chartData.push(avg);
          totalAvgSum += avg;
          validTicks++;
        }
      }
    }
    const finalRollingAvg = totalAvgSum / (validTicks || 1);
    // 2. 기본 정보 출력
    document.getElementById("repTotalDmg").innerText = Math.floor(
      totalDmg / iterations
    ).toLocaleString();
    document.getElementById("repTitanHp").innerText = Math.max(
      0,
      Math.floor(totalTitanHp / iterations)
    ).toLocaleString();
    const avgSec = totalTime / iterations;
    document.getElementById("repTime").innerText = `${Math.floor(
      avgSec / 60
    )}분 ${Math.floor(avgSec % 60)}초`;
    document.getElementById("repDead").innerText = `${(
      totalDead / iterations
    ).toFixed(1)}마리`;
    document.getElementById("avgMinHpPer").innerText =
      "평균 생존 체력: " + finalRollingAvg.toFixed(1) + "%";
    // 5. 그래프 그리기 함수 호출
    if (chartData.length > 0) {
      drawHpChart(chartData);
    }
    const simulateBtn = document.querySelector(".btn-simulate");
    if (simulateBtn) {
      simulateBtn.disabled = false;
      simulateBtn.innerText = "시뮬레이션 시작 ⚔️";
    }
    if (rep) {
      rep.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
    // finalize 함수 끝부분
    if (isLogEnabled && detailedLogs.length > 0) {
      const reportBox = document.getElementById("battleReport");
      // 기존 버튼 중복 방지
      const oldBtn = document.getElementById("logDownloadBtn");
      if (oldBtn) oldBtn.remove();
      const logBtn = document.createElement("button");
      logBtn.id = "logDownloadBtn";
      logBtn.innerHTML = "📊 상세 로그(.txt) 다운로드";
      logBtn.className = "btn-simulate";
      logBtn.style.cssText =
        "margin-top:15px; background:#455a64; font-size:14px;";
      logBtn.onclick = () => {
        // 텍스트 파일 내용 구성
        let content = "=== 상세 전투 로그 (1회차) ===\n\n";
        detailedLogs.forEach((entry) => {
          content += `[${entry.시간}] 타이탄HP: ${entry.타이탄HP} | 생존: ${entry.생존공룡}\n`;
          entry.공룡상태.forEach((d) => {
            content += `  - ${d.번호}번 공룡 HP: ${d.남은HP}\n`;
          });
          content += "--------------------------------\n";
        });
        const blob = new Blob([content], {
          type: "text/plain"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `battle_log_${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      };
      reportBox.appendChild(logBtn);
    }
  };
  runBatch();
}

function drawHpChart(data) {
  const canvas = document.getElementById("hpChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  // 부모 컨테이너 크기에 맞춤
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width - 20;
  canvas.height = rect.height - 20;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  // 가이드라인 (50% 점선)
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // 선 그래프 그리기
  ctx.beginPath();
  ctx.strokeStyle = "#2ecc71";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  const stepX = w / (data.length - 1);
  data.forEach((val, i) => {
    const x = i * stepX;
    const y = h - (val * h) / 100;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // 하단 채우기
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(46, 204, 113, 0.2)");
  grad.addColorStop(1, "rgba(46, 204, 113, 0)");
  ctx.fillStyle = grad;
  ctx.fill();
}
