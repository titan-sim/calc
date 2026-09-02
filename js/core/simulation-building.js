// 건물(#building) 전투 계산. 허수아비(simulation-dummy.js)와 대미지 공식은 완전히 같지만
// (건물도 "건축물 판정" 대상이라 파괴자/건축물 피해 증가 등 같은 룬 효과가 적용됨), 결정적으로
// 다른 점 하나 - 허수아비는 죽지 않는 고정 표적인 반면 여기 건물은 실제 체력을 갖고 파괴될 수
// 있음(사용자 확정 - 성벽 Lv.1/Lv.2 체력은 js/data/rune-data.js의 BUILDING_TYPES 참고). 그래서
// "공격력/치명타 확률/치명타 피해"는 프로필+타일 설정이 고정이면 전투 내내 고정값이라 한 번만
// 계산해두면 되는 건 허수아비와 같지만, 그 값을 건물 HP에 실제로 적용/차감하는 건 페이지(js/pages/
// building-page.js)가 매 틱 담당함(어떤 건물이 지금 타겟인지, 파괴됐는지는 화면 상태라서).
//
// 대미지 공식은 허수아비와 동일: {(기본 공격력 + 별자리atk) × (vip%+스킨%+룬%) + 건축물 피해
// 증가(정수)} × (파괴자1%+파괴자2%+파괴자3%)
//
// "지진" 룬만 여기 새로 추가됨 - 확률형이 아니라 주기형(레벨 1~20: 4타마다, 21~31: 3타마다)이라
// 다른 룬처럼 즉시 대미지에 반영되는 게 아니라, 별도로 {burst_p, count}를 반환해서 페이지 쪽의
// 공격 횟수 카운터가 주기 도달을 직접 판정하게 함(트리플 임팩트가 dino-battle 쪽에서
// attacker.attackCount % 3으로 판정되는 것과 같은 패턴).

/**
 * @param {Object} inputs - getMyDinoBattleInputs()가 주는 형태(baseAtk, count, selectedRunes, constellation, bonusPercent)
 * @param {{natureAdjacent:boolean, atkTowerLevel:(number|null), hpTowerLevel:(number|null)}} tileCfg
 *   hpTowerLevel은 여기 공격력 계산엔 안 쓰임(투석기 반격에 맞서는 내 공룡 체력 계산用 -
 *   computeBuildingDinoMaxHp 참고)
 * @param {number} [extraAtkFlat] - "마지막 선물"로 일부 공룡이 받은 임시 공격력 버프의 총합(이미
 *   대상 공룡 수만큼 합산된 값) - count를 곱하기 전이 아니라 "블렌드된 총 공격력"에 그대로
 *   한 번만 더해짐(각 버프가 그 버프를 받은 그 공룡 한 마리분에만 적용되는 값이라 count로
 *   다시 곱하면 안 됨). runBuildingSimulation 전용, 두 기존 호출부는 인자 생략으로 그대로 동작.
 * @returns {{atk:number, cRate:number, cDmg:number, earthquake:({burst_p:number, count:number}|null)}}
 */
function computeBuildingCombatValues(inputs, tileCfg, extraAtkFlat = 0) {
  const { baseAtk, count, selectedRunes, constellation = {}, bonusPercent = { atk: 0 }, currentHpPercent = 100 } = inputs;

  let atkF = constellation.atk || 0;
  let atkP = bonusPercent.atk || 0;
  let cRate = 3 + (constellation.critRate || 0);
  let cDmg = 105 + (constellation.critDmg || 0);
  let destroyerPercent = 0;
  let earthquake = null;

  const atkTowerLv = tileCfg.atkTowerLevel;
  if (atkTowerLv !== null && atkTowerLv !== undefined) atkP += BUFF_TOWER_PERCENTS[atkTowerLv];

  (selectedRunes || []).filter((r) => r !== null).forEach((r) => {
    const s = RUNES_DATA[r.name].levels[r.lv];
    if (r.name === "파괴자 1" || r.name === "파괴자 2" || r.name === "파괴자 3") { destroyerPercent += s.atk_p; return; }
    if (r.name === "지진") { earthquake = { burst_p: s.burst_p, count: s.count }; return; }
    if (r.name === "자연의 포옹" && !tileCfg.natureAdjacent) return;
    if (r.name === "협동 공격" && count < 5) return;
    // 건물 페이지 도입 당시엔 count가 항상 7(BUILDING_MAX_DINO_COUNT)로 고정돼 있어 "1마리일 때"
    // 조건이 성립할 일이 없어 이 게이팅이 빠져 있었음(잠재 버그) - 캐터펄트로 공룡이 죽고 실제로
    // count가 동적으로 변하는 이번 시뮬레이션에서는 성립할 수 있으므로 다른 페이지(titan/dummy 등)와
    // 같은 게이팅을 추가함
    if (r.name === "고독한 분노" && count !== 1) return;
    if (r.name === "광전사의 분노") { atkP += computeBerserkerAtkBonus(currentHpPercent, s); return; }
    if (s.atk_f) atkF += s.atk_f;
    if (s.atk_p) atkP += s.atk_p;
    if (r.name === "치명타 확률") cRate += s.prob;
    if (r.name === "치명타 피해") cDmg += s.crit_d;
  });

  const buildingDmgFlat = constellation.buildingDmg || 0;
  // count - 소환된 공룡 전부(또는 지금 살아있는 만큼)가 같은 타일의 건물을 동시에 때린다고 가정해서
  // 1마리분 공격력에 곱함(예전엔 count가 "협동 공격" 조건 판정에만 쓰이고 정작 여기 안 곱해져서
  // 실제론 1마리 몫만 계산되고 있었음 - 사용자 지적으로 수정)
  const atk = ((baseAtk + atkF) * (1 + atkP / 100) + buildingDmgFlat) * (1 + destroyerPercent / 100) * count + extraAtkFlat;

  return { atk, cRate, cDmg, earthquake };
}

// "관련 수치" 카드(js/pages/building-page.js) 전용 - computeBuildingCombatValues(시뮬레이션
// 핫패스, 가볍게 유지)와 별개로 화면에 필요한 세부 내역(파괴자 룬별 증폭 기여도 등)까지 풀어서
// 계산함(타이탄의 getBattleStats vs getTitanCombatMetrics 관계와 같은 구조 - js/core/stat-calc.js
// 참고). extraAtkFlat(마지막 선물) 개념은 정적 스냅샷엔 없으므로 다루지 않음.
// @returns {{preAmpAtk:number, atk:number, cRate:number, cDmg:number,
//   destroyerBreakdown:Array<{name:string, percent:number}>, atkAmpGain:number,
//   earthquake:({burst_p:number, count:number}|null), avgHitDamage:number, avgEarthquakeDamage:number}}
function computeBuildingCombatMetrics(inputs, tileCfg) {
  const { baseAtk, count, selectedRunes, constellation = {}, bonusPercent = { atk: 0 }, currentHpPercent = 100 } = inputs;

  let atkF = constellation.atk || 0;
  let atkP = bonusPercent.atk || 0;
  let cRate = 3 + (constellation.critRate || 0);
  let cDmg = 105 + (constellation.critDmg || 0);
  let earthquake = null;
  const destroyerBreakdown = [];

  const atkTowerLv = tileCfg.atkTowerLevel;
  if (atkTowerLv !== null && atkTowerLv !== undefined) atkP += BUFF_TOWER_PERCENTS[atkTowerLv];

  (selectedRunes || []).filter((r) => r !== null).forEach((r) => {
    const s = RUNES_DATA[r.name].levels[r.lv];
    if (r.name === "파괴자 1" || r.name === "파괴자 2" || r.name === "파괴자 3") {
      destroyerBreakdown.push({ name: r.name, percent: s.atk_p });
      return;
    }
    if (r.name === "지진") { earthquake = { burst_p: s.burst_p, count: s.count }; return; }
    if (r.name === "자연의 포옹" && !tileCfg.natureAdjacent) return;
    if (r.name === "협동 공격" && count < 5) return;
    if (r.name === "고독한 분노" && count !== 1) return;
    if (r.name === "광전사의 분노") { atkP += computeBerserkerAtkBonus(currentHpPercent, s); return; }
    if (s.atk_f) atkF += s.atk_f;
    if (s.atk_p) atkP += s.atk_p;
    if (r.name === "치명타 확률") cRate += s.prob;
    if (r.name === "치명타 피해") cDmg += s.crit_d;
  });

  const destroyerPercent = destroyerBreakdown.reduce((sum, d) => sum + d.percent, 0);
  const buildingDmgFlat = constellation.buildingDmg || 0;
  // 증폭 전/후를 나눠서 갖고 있어야 "공격력 증폭량"(파괴자 룬들의 곱연산 기여분)을 따로 보여줄 수
  // 있음(타이탄의 finalAtk vs ampFinalAtk와 같은 개념 - 여기선 곱연산 대상이 파괴자뿐이라 더 단순함)
  const preAmpAtk = ((baseAtk + atkF) * (1 + atkP / 100) + buildingDmgFlat) * count;
  const atk = preAmpAtk * (1 + destroyerPercent / 100);
  const atkAmpGain = atk - preAmpAtk;

  const avgHitDamage = computeBuildingExpectedDps({ atk, cRate, cDmg });
  const avgEarthquakeDamage = computeEarthquakeExpectedSplashDps({ atk, cRate, cDmg, earthquake });

  return { preAmpAtk, atk, cRate, cDmg, destroyerBreakdown, atkAmpGain, earthquake, avgHitDamage, avgEarthquakeDamage };
}

// 캐터펄트 반격에 맞서는 내 공룡 1마리의 최대 체력 - computeBuildingCombatValues와 같은
// 게이팅(자연의 포옹/협동 공격/고독한 분노)을 hp_f/hp_p에도 그대로 적용. computeBuildingCombatValues는
// 공격력만 계산하고 체력은 전혀 다루지 않았어서(캐터펄트가 없던 지금까지는 필요 없었음) 새로 추가.
function computeBuildingDinoMaxHp(inputs, tileCfg) {
  const { baseHp, count, selectedRunes, constellation = {}, bonusPercent = { hp: 0 } } = inputs;
  let hpF = constellation.hp || 0;
  let hpP = bonusPercent.hp || 0;

  const hpTowerLv = tileCfg.hpTowerLevel;
  if (hpTowerLv !== null && hpTowerLv !== undefined) hpP += BUFF_TOWER_PERCENTS[hpTowerLv];

  (selectedRunes || []).filter((r) => r !== null).forEach((r) => {
    const s = RUNES_DATA[r.name].levels[r.lv];
    if (r.name === "자연의 포옹" && !tileCfg.natureAdjacent) return;
    if (r.name === "협동 공격" && count < 5) return;
    if (r.name === "고독한 분노" && count !== 1) return;
    if (s.hp_f) hpF += s.hp_f;
    if (s.hp_p) hpP += s.hp_p;
  });

  return (baseHp + hpF) * (1 + hpP / 100);
}

// 강인함 1(정수 감소)/강인함 2(퍼센트 감소) - 건물 페이지에서 유일하게 허용된 피해 감소 룬(사용자
// 확정 - rune-data.js의 BUILDING_UNSUITABLE_RUNE_LIST 주석 "체력 증가/강인함류는... 건물엔
// 적합함" 참고. 힐/흡혈/보호막/단단한 피부/피해 저항 등은 전부 제외돼 있어서 캐터펄트 반격에 맞설
// 수 있는 수단은 이 둘(+ 체력 자체를 올리는 룬들)뿐임). 캐터펄트 피해는 확률 없이 항상 고정으로
// 들어오므로(사용자 확정) 퍼센트를 먼저 적용한 뒤 정수를 빼는 순서로 한 번만 계산해두면 전투
// 내내 고정값(타이탄의 보호막→단단한 피부 순서와 같은 관례)
function computeBuildingIncomingReduction(selectedRunes) {
  let flat = 0, percent = 0;
  (selectedRunes || []).filter((r) => r !== null).forEach((r) => {
    const s = RUNES_DATA[r.name].levels[r.lv];
    if (r.name === "강인함 1") flat += s.red_f;
    if (r.name === "강인함 2") percent += s.red_p;
  });
  return { flat, percent };
}

/**
 * 공격 한 틱(1초에 한 번)의 결과 - 실제 계산은 stat-calc.js의 rollCritHit 공용 함수(사용자 지적 -
 * "4개 페이지 모두 각각 따로따로... 그건 너무 비효율적인 코드 작성", 전투 수식 공용화 작업의
 * 일부). 여기 남은 건 값 객체(values)를 그 함수의 인자로 풀어주는 얇은 래퍼뿐.
 * @returns {{dmg:number, isCrit:boolean}}
 */
function rollBuildingAttack(values) {
  return rollCritHit(values.atk, values.cRate, values.cDmg);
}

// 지진은 낙뢰/메테오/트리플 임팩트 같은 "스킬형" 룬과 같은 종류라(타이탄의
// simulation-titan.js에서 스킬 대미지가 rollHit()으로 주공격과 별도로 크리를 다시 굴리는 것과
// 동일한 원리) 주공격의 크리 여부를 그대로 물려받지 않고, 증폭 후 공격력(values.atk)에서 새로
// 시작해 맞는 건물마다 각각 독립적으로 크리를 판정함(사용자 확정 - "지진도 결국에는 스킬이잖아.
// 크리티컬 독립시행이지. 모든 건물에 각각 확률 적용이야. 한번 크리 터졌다고 모든 건물에 동시
// 크리티컬 적용되는 게 아니거든") - 그래서 타겟/뒤 건물(또는 실전 시뮬레이션의 인접 건물들)에
// 이 함수를 맞은 건물 수만큼 각각 따로 호출해야 하고, 한 번 굴린 값을 재사용하면 안 됨. 지진
// 자체의 발동 여부(주기 도달)는 호출하는 쪽(페이지/runBuildingSimulation)에서 판정함.
function rollEarthquakeHit(values) {
  const skillBaseDmg = values.atk * (values.earthquake.burst_p / 100);
  return rollCritHit(skillBaseDmg, values.cRate, values.cDmg);
}

/**
 * 빠른 계산용 - 크리티컬 확률/피해까지 반영한 "1초당 기댓값"(지진 추가 피해는 제외 - 어떤 건물이
 * 타겟인지, 뒤 칸에 건물이 있는지 등 배치 상태에 따라 달라져서 고정 기댓값 공식으로 표현하기
 * 어려움. 실전 시뮬레이션에서는 정확히 반영됨). stat-calc.js의 computeExpectedDpsFromCrit 공용
 * 함수를 그대로 호출하는 얇은 래퍼 - computeEarthquakeExpectedSplashDps/
 * computeBuildingCombatMetrics 등 내부에서 이 이름으로 계속 부르므로 이름 자체는 유지함
 */
function computeBuildingExpectedDps(values) {
  return computeExpectedDpsFromCrit(values.atk, values.cRate, values.cDmg);
}

// 지진 룬의 "주기 도달 시 추가 피해"를 초당 기댓값으로 환산 - burst_p%의 스플래시가 count타마다
// 한 번씩 발동되므로(빠른 계산은 "1타 = 1초" 가정을 이미 쓰고 있음, computeBuildingExpectedDps
// 참고), 초당 기댓값은 (주공격 기댓값 × burst_p%) / count. 이 스플래시는 지금 공격 중인 건물
// 자신도 포함해서 맞으므로(룬 설명 그대로 - "내가 공격하는 건물 및 그 주위 1칸씩") 타겟 자신의
// 예상 dps에도 이 값을 더해야 하고, 실제로 인접한 "뒤에 있는 건물"(전투 설정에서 지정)에도
// 그대로 적용됨 - 실전 시뮬레이션(buildingRunAttackTick)과 같은 공식, 배치를 몰라도 전투 설정의
// 타겟/뒤 건물 관계만으로 계산 가능해서 더 이상 "배치 상태에 따라 달라져서 제외"할 필요 없음
function computeEarthquakeExpectedSplashDps(values) {
  if (!values.earthquake) return 0;
  const baseDps = computeBuildingExpectedDps(values);
  return (baseDps * (values.earthquake.burst_p / 100)) / values.earthquake.count;
}

// ===== 실전 시뮬레이션(캐터펄트 반격 + 지진 + 공룡 사망/재소환) - "빠른 계산"/"조합 찾기" 공용 엔진.
// 타이탄(simulation-titan.js runTitanSimulation)과 같은 Promise+배치(batchSize, setTimeout(0),
// onProgress) 구조지만 고정 틱이 아니라 이벤트 큐 방식임 - 내 공격 주기(1.0초 고정)와 캐터펄트
// 발사 주기(3.0~6.0초 가변)가 서로 안 맞아떨어져서 공배수 틱을 쓰면 대부분의 틱에서 아무 일도
// 안 일어나 낭비가 큼. 종료 조건은 (앞 건물 파괴) 또는 (연속 전투 꺼짐 + 전멸이고 대기 부활도 없음)
// 뿐(사용자 확정 - "딱히 시간을 제한하지 않았으므로 공룡이 전멸하든가, 또는 앞쪽 건물이 다
// 부서지는가"). 뒤 건물은 지진 스플래시만 받을 수 있고(직접 공격 대상이 아님) 없으면(behindHp=null)
// 관련 결과는 전부 null로 돌아옴.
//
// 캐터펄트는 적 부족이 이미 정착해 방어 중인 쪽이라 항상 장전 완료 상태 - 내 공룡이 도착하는 순간
// (시뮬레이션 시작)부터 바로 쏘기 시작함(사용자 확정) - 그래서 첫 캐터펄트 발사도 첫 내 공격과
// 똑같이 t=1초에 일어남.
//
// 내 공격은 공룡별 개별 굴림이 아니라 "블렌드 1회 굴림"으로 유지(살아있는 수만큼 count를 매 이벤트
// 재계산해서 computeBuildingCombatValues에 그대로 넘김) - 내가 받는 피해(캐터펄트)는 이미 전원
// 동일한 결정론적 값이라 공격 쪽까지 공룡별로 쪼개도 기댓값은 같고 분산만 미세하게 달라짐, 반면
// 기존 코드(computeBuildingCombatValues/rollBuildingAttack) 재사용 폭은 훨씬 커짐. 체력만 공룡별로
// 추적(사망/희생/마지막 선물 판정에 필요).
/**
 * @param {Object} cfg
 * @param {number} cfg.baseAtk
 * @param {number} cfg.baseHp
 * @param {Array} cfg.selectedRunes
 * @param {Object} [cfg.constellation]
 * @param {Object} [cfg.bonusPercent]
 * @param {number} [cfg.moveSpeed]
 * @param {number} [cfg.distanceTiles]
 * @param {boolean} [cfg.continuousBattle]
 * @param {{natureAdjacent:boolean, atkTowerLevel:(number|null), hpTowerLevel:(number|null)}} cfg.tileCfg
 * @param {number} cfg.targetHp - 직접 공격할(앞) 건물의 최대 체력
 * @param {number|null} [cfg.behindHp] - 뒤 건물의 최대 체력. null이면 뒤 건물 없음
 * @param {number|null} [cfg.catapultDmg] - 캐터펄트 한 발 대미지(BUILDING_CATAPULT_DAMAGE[레벨]). null이면 캐터펄트 없음
 * @param {number|null} [cfg.catapultPeriodSec] - 캐터펄트 발사 주기(초, BUILDING_CATAPULT_SPEED_SECONDS[속도레벨])
 * @param {number} cfg.maxDino - 최대 소환 마릿수(BUILDING_MAX_DINO_COUNT)
 * @param {number} [cfg.iterations=1]
 * @param {(completed:number, total:number)=>void} [cfg.onProgress]
 * @param {number} [cfg.batchSize=1]
 * @returns {Promise<Object>}
 */
function runBuildingSimulation(cfg) {
  const {
    baseAtk, baseHp, selectedRunes, constellation = {}, bonusPercent = {},
    currentHpPercent = 100,
    moveSpeed = 1, distanceTiles = 1, continuousBattle = false, tileCfg,
    targetHp, behindHp = null, catapultDmg = null, catapultPeriodSec = null,
    maxDino, iterations = 1, onProgress = () => {}, batchSize = 1
  } = cfg;

  const respawnDelaySec = getRespawnDelaySec(moveSpeed, distanceTiles);
  const incomingReduction = computeBuildingIncomingReduction(selectedRunes);
  const perShotDmg = catapultDmg === null
    ? 0
    : Math.max(1, catapultDmg * (1 - incomingReduction.percent / 100) - incomingReduction.flat);

  const sacrificeEquip = (selectedRunes || []).find((r) => r && r.name === "희생");
  const lastGiftEquip = (selectedRunes || []).find((r) => r && r.name === "마지막 선물");

  // 안전 상한(사용자에게 노출되는 설정이 아니라 순수 내부 안전장치) - 극단적으로 방어만 몰빵해서
  // 이론상으론 안 죽지만 캐터펄트가 없어서 전멸 조건도 성립 안 하는 등 퇴화 입력에서도 브라우저가
  // 안 멈추게 함. targetHp를 대략적인 dps로 나눈 값의 5배 정도면 실제로 걸릴 일은 거의 없음.
  const roughValues = computeBuildingCombatValues({ baseAtk, count: maxDino, selectedRunes, constellation, bonusPercent, currentHpPercent }, tileCfg);
  const roughDps = Math.max(1, computeBuildingExpectedDps(roughValues));
  const SAFETY_CAP_SEC = Math.max(3600, (targetHp / roughDps) * 5);

  return new Promise((resolve) => {
    const batch = Math.max(1, batchSize);
    let completed = 0;

    let sumTotalDmg = 0, sumEarthquakeDmg = 0;
    let frontBreakCount = 0, sumFrontBreakTime = 0;
    let behindBreakCount = 0, sumBehindBreakTime = 0, behindSurviveCount = 0, sumBehindRemainingHp = 0;
    let sumDeadCount = 0;
    let totalDeathEvents = 0, sumDeathTimes = 0;

    // "시간대별 공룡 체력 변화 추이" 차트용 - 초 단위로 표본을 모아 iteration 전체 평균을 냄
    // (타이탄의 timeSeriesHp/timeSeriesCount와 같은 방식). nextMyAttack이 항상 1부터 1.0씩만
    // 증가하고(공격 대상이 없어도 타이머 자체는 계속 흐름) 매번 그 시각에 정확히 한 번 처리되므로,
    // 별도 "표본 채취" 이벤트를 새로 안 만들고 내 공격 이벤트 처리 시점에 얹어서 기록함(항상 정수
    // 초 간격으로 정확히 맞아떨어짐)
    const hpSeriesSum = new Map();
    const hpSeriesCount = new Map();
    let maxSampleSecond = 0;

    const runOneIteration = () => {
      const dinos = [];
      for (let i = 0; i < maxDino; i++) dinos.push({ hp: 0, giftAtk: 0, giftSteps: 0, reviveAt: null });

      const seedMaxHp = computeBuildingDinoMaxHp({ baseHp, count: maxDino, selectedRunes, constellation, bonusPercent }, tileCfg);
      // currentHpPercent는 "전투 시작을 최대 체력의 몇 %로 할지"(사용자 확정) - 광전사의 분노 자체는
      // 이후 캐터펄트에 실제로 맞아 줄어드는 실시간 체력을 따름(아래 hpPercentAvg 참고)
      const startHp = seedMaxHp * (currentHpPercent / 100);
      dinos.forEach((d) => { d.hp = startHp; });

      let frontHpNow = targetHp;
      let behindHpNow = behindHp;
      let attackTickCount = 0;
      let totalDmg = 0, earthquakeDmg = 0;
      let frontBreakTime = null, behindBreakTime = null;
      const deathTimes = [];

      let time = 0;
      let nextMyAttack = 1;
      let nextCatapult = catapultDmg === null ? Infinity : 1;

      while (true) {
        if (frontHpNow <= 0) { frontBreakTime = time; break; }
        const aliveCount = dinos.filter((d) => d.hp > 0).length;
        const hasPendingRevive = dinos.some((d) => d.reviveAt !== null);
        if (!continuousBattle && aliveCount === 0 && !hasPendingRevive) break;
        if (time > SAFETY_CAP_SEC) break;

        let nextRevive = Infinity;
        dinos.forEach((d) => { if (d.reviveAt !== null && d.reviveAt < nextRevive) nextRevive = d.reviveAt; });

        const nextTime = Math.min(nextMyAttack, nextCatapult, nextRevive);
        time = nextTime;

        if (nextRevive === nextTime) {
          dinos.forEach((d) => {
            if (d.reviveAt !== null && d.reviveAt <= nextTime) {
              const nowAliveCount = dinos.filter((x) => x.hp > 0).length + 1; // 이번에 돌아오는 개체 포함
              d.hp = computeBuildingDinoMaxHp({ baseHp, count: nowAliveCount, selectedRunes, constellation, bonusPercent }, tileCfg);
              d.giftAtk = 0;
              d.giftSteps = 0;
              d.reviveAt = null;
            }
          });
        } else if (nextMyAttack === nextTime) {
          const sampleSec = Math.round(time);
          if (sampleSec > maxSampleSecond) maxSampleSecond = sampleSec;
          const hpPercentAvg = dinos.reduce((sum, d) => sum + (Math.max(0, d.hp) / seedMaxHp) * 100, 0) / maxDino;
          hpSeriesSum.set(sampleSec, (hpSeriesSum.get(sampleSec) || 0) + hpPercentAvg);
          hpSeriesCount.set(sampleSec, (hpSeriesCount.get(sampleSec) || 0) + 1);

          const aliveNow = dinos.filter((d) => d.hp > 0);
          if (aliveNow.length > 0) {
            const sumGiftAtk = aliveNow.reduce((s, d) => s + d.giftAtk, 0);
            // 광전사의 분노 판정용 - 살아있는 개체들의 지금 이 순간 평균 체력 비율(공격은 "블렌드
            // 1회 굴림"으로 유지하는 이 엔진 구조상 개체별로 따로 굴리지 않으므로, 살아있는 만큼의
            // 평균으로 근사함 - 캐터펄트가 전원에게 항상 동일한 피해를 주므로 대부분 다 같은 값임)
            const aliveAvgHpPercent = (aliveNow.reduce((s, d) => s + d.hp, 0) / aliveNow.length / seedMaxHp) * 100;
            const values = computeBuildingCombatValues(
              { baseAtk, count: aliveNow.length, selectedRunes, constellation, bonusPercent, currentHpPercent: aliveAvgHpPercent },
              tileCfg,
              sumGiftAtk
            );
            const { dmg } = rollBuildingAttack(values);
            frontHpNow = Math.max(0, frontHpNow - dmg);
            totalDmg += dmg;
            attackTickCount++;

            if (values.earthquake && attackTickCount % values.earthquake.count === 0) {
              // 스킬형 룬이라 맞는 건물마다 크리를 독립적으로 각각 굴림(사용자 확정 - 위
              // rollEarthquakeHit 주석 참고) - 타겟과 뒤 건물이 같은 발동에서도 크리 여부가 다를 수 있음
              if (frontHpNow > 0) {
                const frontSplash = rollEarthquakeHit(values).dmg;
                frontHpNow = Math.max(0, frontHpNow - frontSplash);
                totalDmg += frontSplash;
                earthquakeDmg += frontSplash;
              }
              if (behindHpNow !== null && behindHpNow > 0) {
                const behindSplash = rollEarthquakeHit(values).dmg;
                behindHpNow = Math.max(0, behindHpNow - behindSplash);
                totalDmg += behindSplash;
                earthquakeDmg += behindSplash;
                if (behindHpNow <= 0 && behindBreakTime === null) behindBreakTime = time;
              }
            }

            aliveNow.forEach((d) => { if (d.giftSteps > 0 && --d.giftSteps === 0) d.giftAtk = 0; });
          }
          nextMyAttack += 1;
        } else {
          // 캐터펄트 발사 - 그 순간 살아있는 공룡 전원이 동시에 전체 피해를 입음(사용자 확정).
          // 피해를 전원 먼저 적용한 "다음"에 사망 트리거(희생/마지막 선물)를 판정함(2단계 분리) -
          // 한 번의 forEach로 피해+트리거를 같이 처리하면, 배열에서 나중에 처리되는 공룡이 아직
          // "이번 발사"의 피해를 받기도 전에 앞서 죽은 공룡의 희생 회복부터 받아버려서 처리 순서에
          // 따라 결과가 달라지는 버그가 생김(진짜 동시 피격이라면 전원의 피해가 먼저 확정된 뒤에야
          // 사후 효과가 의미를 가져야 함)
          const aliveBefore = dinos.filter((d) => d.hp > 0);
          const newlyDead = [];
          aliveBefore.forEach((d) => {
            d.hp = Math.max(0, d.hp - perShotDmg);
            if (d.hp === 0) { newlyDead.push(d); deathTimes.push(time); }
          });
          newlyDead.forEach((d) => {
            const otherAlive = dinos.filter((x) => x.hp > 0);
            if (sacrificeEquip && otherAlive.length > 0) {
              const s = RUNES_DATA["희생"].levels[sacrificeEquip.lv];
              if (Math.random() * 100 < s.prob) {
                const targetMaxHp = computeBuildingDinoMaxHp(
                  { baseHp, count: otherAlive.length, selectedRunes, constellation, bonusPercent },
                  tileCfg
                );
                otherAlive.forEach((target) => {
                  target.hp = Math.min(targetMaxHp, target.hp + s.rec_f);
                });
              }
            }
            if (lastGiftEquip && otherAlive.length > 0) {
              const s = RUNES_DATA["마지막 선물"].levels[lastGiftEquip.lv];
              if (Math.random() * 100 < s.prob) {
                otherAlive.forEach((target) => {
                  target.giftAtk += s.atk_f;
                  target.giftSteps = s.turn;
                });
              }
            }
            if (continuousBattle) d.reviveAt = time + respawnDelaySec;
          });
          nextCatapult += catapultPeriodSec;
        }
      }

      sumTotalDmg += totalDmg;
      sumEarthquakeDmg += earthquakeDmg;
      if (frontBreakTime !== null) {
        frontBreakCount++;
        sumFrontBreakTime += frontBreakTime;
      }
      if (behindHp !== null) {
        if (behindBreakTime !== null) {
          behindBreakCount++;
          sumBehindBreakTime += behindBreakTime;
        } else {
          behindSurviveCount++;
          sumBehindRemainingHp += behindHpNow;
        }
      }
      sumDeadCount += deathTimes.length;
      totalDeathEvents += deathTimes.length;
      sumDeathTimes += deathTimes.reduce((sum, t) => sum + t, 0);
    };

    const runBatch = () => {
      const end = Math.min(completed + batch, iterations);
      for (let i = completed; i < end; i++) runOneIteration();
      completed = end;
      onProgress(completed, iterations);
      if (completed < iterations) setTimeout(runBatch, 0);
      else finalize();
    };

    const finalize = () => {
      // 타이탄(simulation-titan.js)의 chartData 산출과 같은 방식 - 표본이 iteration의 1% 미만인
      // 구간(대부분 일찍 끝난 시행들 때문에 표본이 희박해지는 꼬리)은 노이즈가 커서 버림
      let validTicks = 0, totalAvgSum = 0;
      const chartData = [];
      for (let k = 1; k <= maxSampleSecond; k++) {
        const cnt = hpSeriesCount.get(k) || 0;
        if (cnt > 0 && cnt >= iterations * 0.01) {
          const avg = hpSeriesSum.get(k) / cnt;
          chartData.push(avg);
          totalAvgSum += avg;
          validTicks++;
        }
      }
      const finalRollingAvg = totalAvgSum / (validTicks || 1);

      // 개체군이 사실상 전멸(0%대)해서 남은 구간이 평평한 꼬리뿐이면 그 꼬리를 잘라내고 여유만
      // 조금 남김("죽는/부서지는 시점" 위주로 보여주기) - 타이탄과 같은 트리밍 로직
      let displayChartData = chartData;
      if (chartData.length > 1) {
        const tailValue = chartData[chartData.length - 1];
        if (tailValue <= 5) {
          let lastMeaningfulIdx = 0;
          for (let idx = chartData.length - 1; idx >= 0; idx--) {
            if (Math.abs(chartData[idx] - tailValue) > 3) { lastMeaningfulIdx = idx; break; }
          }
          const padding = Math.max(10, Math.floor((lastMeaningfulIdx + 1) * 0.2));
          const cutoff = Math.min(chartData.length - 1, lastMeaningfulIdx + padding);
          displayChartData = chartData.slice(0, cutoff + 1);
        }
      }
      const displayLimitSec = displayChartData.length > 0 ? displayChartData.length : maxSampleSecond;

      resolve({
        avgTotalDmg: sumTotalDmg / iterations,
        avgEarthquakeDmg: sumEarthquakeDmg / iterations,
        avgFrontBreakTimeSec: frontBreakCount > 0 ? sumFrontBreakTime / frontBreakCount : null,
        frontBreakRate: frontBreakCount / iterations,
        avgBehindRemainingHp: behindHp === null ? null : (behindSurviveCount > 0 ? sumBehindRemainingHp / behindSurviveCount : 0),
        avgBehindBreakTimeSec: behindBreakCount > 0 ? sumBehindBreakTime / behindBreakCount : null,
        behindBreakRate: behindHp === null ? null : behindBreakCount / iterations,
        avgDeadCount: sumDeadCount / iterations,
        avgDeathTimeSec: totalDeathEvents > 0 ? sumDeathTimes / totalDeathEvents : null,
        avgSurvivalPercent: finalRollingAvg,
        chartData: displayChartData,
        limitSec: displayLimitSec
      });
    };

    runBatch();
  });
}
