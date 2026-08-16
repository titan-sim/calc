// 다국어 지원 - 번역 데이터는 translations/translation-strings*.json(한국어 원문 포함 5개
// 언어, 각 683개 키로 완전히 동일한 그룹/키 구조)을 그대로 fetch해서 씀. 빌드 스텝이 없는
// 사이트라 js/core/update-check.js가 이미 version.json을 fetch하는 것과 같은 방식을 재사용함.
//
// 중요한 전제: RUNES_DATA의 룬 이름(키)과 grade 값("일반"/"희귀"/"에픽"/"유니크"/"전설")은
// 저장/비교/CSS 변수 이름으로도 쓰이는 내부 식별자라 번역 대상이 아님(절대 바꾸면 안 됨) - 화면에
// 보여줄 때만 ruleDisplayName()/gradeDisplayName()으로 별도 변환함. 자세한 근거는
// dino_mutant_simulator_plan.md 및 계획 문서 참고.

const I18N_SUPPORTED_LANGS = ["ko", "en", "ja", "vi", "zh-CN"];
const I18N_LANG_KEY = "dino_lang";
const I18N_FILE_MAP = {
  ko: "translations/translation-strings.json",
  en: "translations/translation-strings.en.json",
  ja: "translations/translation-strings.ja.json",
  vi: "translations/translation-strings.vi.json",
  "zh-CN": "translations/translation-strings.zh-CN.json"
};

let i18nCurrentLang = "ko";
let i18nActiveFlatMap = {};
let i18nKoFlatMap = null; // 한국어는 항상 로드해서 폴백(키 누락/로딩 실패 시 원문이라도 보이게)
const i18nLoadedCache = {}; // lang -> flat map, 한 번 받아온 언어는 다시 fetch하지 않음

// 그룹별로 나뉜 원본 JSON({index_html:{...}, titan:{...}, ...})을 한 단계 평평한
// {"titan.startBtn": "...", ...} 객체로 합침 - 키 이름 자체가 이미 전역적으로 고유하게
// 설계되어 있어서(번역 추출 작업 당시 페이지명을 접두사로 붙임) 충돌 걱정 없음
function i18nFlatten(grouped) {
  const flat = {};
  for (const group of Object.values(grouped)) {
    for (const [key, value] of Object.entries(group)) flat[key] = value;
  }
  return flat;
}

async function i18nLoadLang(lang) {
  if (i18nLoadedCache[lang]) return i18nLoadedCache[lang];
  const path = I18N_FILE_MAP[lang] || I18N_FILE_MAP.ko;
  const res = await fetch(path);
  const grouped = await res.json();
  const flat = i18nFlatten(grouped);
  i18nLoadedCache[lang] = flat;
  return flat;
}

function i18nDetectBrowserLang() {
  const raw = (navigator.language || "ko").toLowerCase();
  if (raw.startsWith("zh")) return "zh-CN";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("vi")) return "vi";
  if (raw.startsWith("en")) return "en";
  return "ko";
}

// main.js가 initRouter()보다 먼저 await로 호출 - 다크모드가 라우터 첫 렌더보다 먼저 적용되는
// 지금 순서(js/ui/settings-ui.js의 applyStoredTheme)와 같은 이유로, 첫 페인트부터 바로 맞는
// 언어로 나오게 함
async function initI18n() {
  const stored = localStorage.getItem(I18N_LANG_KEY);
  i18nCurrentLang = I18N_SUPPORTED_LANGS.includes(stored) ? stored : i18nDetectBrowserLang();
  i18nKoFlatMap = await i18nLoadLang("ko");
  i18nActiveFlatMap = i18nCurrentLang === "ko" ? i18nKoFlatMap : await i18nLoadLang(i18nCurrentLang);
  applyStaticI18n();
}

function getCurrentLang() {
  return i18nCurrentLang;
}

// 언어 전환 - localStorage에 기억해두고, 이미 그려진 정적 텍스트를 갱신한 뒤 지금 라우트를
// 다시 그려서(js/router.js의 renderRoute, 전역 함수) 페이지 전체가 새 언어로 다시 렌더링되게 함
async function setLang(lang) {
  if (!I18N_SUPPORTED_LANGS.includes(lang) || lang === i18nCurrentLang) return;
  i18nCurrentLang = lang;
  localStorage.setItem(I18N_LANG_KEY, lang);
  i18nActiveFlatMap = lang === "ko" ? i18nKoFlatMap : await i18nLoadLang(lang);
  applyStaticI18n();
  if (typeof renderRoute === "function") renderRoute();
}

// key가 없으면(로딩 전이거나 실수로 빠뜨린 키) 한국어 원문으로, 그것도 없으면 key 자체를 돌려줘서
// 화면에 빈 문자열 대신 뭐라도 보이게 함
function t(key, vars) {
  let str = i18nActiveFlatMap[key];
  if (str === undefined) str = i18nKoFlatMap ? i18nKoFlatMap[key] : undefined;
  if (str === undefined) return key;
  if (vars) {
    for (const [varKey, varValue] of Object.entries(vars)) {
      str = str.split(`{${varKey}}`).join(varValue);
    }
  }
  return str;
}

// 라우터가 다시 그리지 않는 정적 HTML(사이드 메뉴, 헤더, meta 태그)용 - data-i18n-key 속성이
// 붙은 요소를 전부 찾아 textContent를 채움. 언어 로드/전환 시 매번 호출됨
function applyStaticI18n() {
  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    el.textContent = t(el.dataset.i18nKey);
  });
  document.documentElement.lang = i18nCurrentLang;
  document.title = t("index_html.siteTitle");
  const setMetaContent = (selector, key) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", t(key));
  };
  setMetaContent('meta[name="description"]', "index_html.siteDescription");
  setMetaContent('meta[property="og:title"]', "index_html.siteTitle");
  setMetaContent('meta[property="og:description"]', "index_html.siteDescription");
  setMetaContent('meta[name="twitter:title"]', "index_html.siteTitle");
  setMetaContent('meta[name="twitter:description"]', "index_html.siteDescription");
}

// ===== 룬 이름/등급/설명 표시 전용 헬퍼 =====
// RUNES_DATA의 키(룬 이름)와 grade 값은 localStorage/Supabase 저장, 비교문, CSS 변수 이름
// (css/base.css의 --일반/--희귀 등)으로 그대로 쓰이는 내부 식별자라 절대 안 바꿈 - 이 함수들을
// 거쳐서 "화면에 보여줄 때만" 번역된 문자열로 바꿔치기함

function ruleDisplayName(koreanName) {
  const key = `rune_data.rune.${koreanName}.name`;
  const translated = t(key);
  return translated === key ? koreanName : translated;
}

const I18N_GRADE_KEY_MAP = { "일반": "normal", "희귀": "rare", "에픽": "epic", "유니크": "unique", "전설": "legendary" };

function gradeDisplayName(koreanGrade) {
  const gradeKey = I18N_GRADE_KEY_MAP[koreanGrade];
  return gradeKey ? t(`rune_data.grade.${gradeKey}`) : koreanGrade;
}

// 메테오/낙뢰는 RUNES_DATA 원본에서도 desc가 레벨에 따라 문구가 붙는 함수형이라(21레벨부터 추가
// 설명), 번역 파일에도 desc.base + desc.areaExtra/desc.instaExtra로 나뉘어 있음. 나머지 룬은
// desc 하나만 있는 평범한 문자열
const I18N_RUNE_DESC_LEVEL_EXTRA = {
  "메테오": { level: 21, extraKey: "areaExtra" },
  "낙뢰": { level: 21, extraKey: "instaExtra" }
};

function ruleDisplayDesc(koreanName, level) {
  const special = I18N_RUNE_DESC_LEVEL_EXTRA[koreanName];
  if (special) {
    const base = t(`rune_data.rune.${koreanName}.desc.base`);
    const extra = level >= special.level ? t(`rune_data.rune.${koreanName}.desc.${special.extraKey}`) : "";
    return base + extra;
  }
  return t(`rune_data.rune.${koreanName}.desc`);
}

// ===== 공유 옵션 배열(BATTLE_SPEED_OPTIONS/BUFF_TOWER_OPTIONS/SERVER_LEVEL_CAP_OPTIONS/
// CONSTELLATION_LEVEL_CAP_OPTIONS - dino-battle-page.js/my-dino-page.js/constellation-data.js에
// 정의, 5개 페이지가 전부 그대로 재사용) 전용 표시 헬퍼. 이 배열들은 각 페이지가 아직 순차적으로
// 전환 중이라(전부 한 번에 바꾸면 안전성 확인이 어려움) label 필드 자체는 한국어 원문 그대로 두고,
// 이미 i18n 전환이 끝난 페이지들만 화면에 표시하는 시점에 이 함수를 거쳐 번역함 - 페이지마다 각자
// 번역 맵을 만들면 나중에 하나만 고치고 다른 하나는 안 고치는 실수가 나기 쉬워서 공용 함수 하나로 통일
const I18N_SHARED_OPTION_LABEL_MAP = {
  "없음": "common.optionNone",
  "느림": "common.speed.slow",
  "보통": "common.speed.normal",
  "빠름": "common.speed.fast"
};
function sharedOptionLabel(koreanLabel) {
  const key = I18N_SHARED_OPTION_LABEL_MAP[koreanLabel];
  return key ? t(key) : koreanLabel;
}
