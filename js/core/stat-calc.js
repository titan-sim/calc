// 순수 계산 함수 모음. DOM을 전혀 건드리지 않음 -> 나중에 서버(Node)에서도 그대로 재사용 가능.

// 이동속도 레벨(1~150) -> 타일 1칸을 이동하는 데 걸리는 시간(초)
// 1레벨=10초, 150레벨(만렙)=5초이고 그 사이는 "시간"이 레벨에 비례해 균등하게 줄어듦
function getTileMoveSeconds(moveSpeed) {
  const lv = Math.min(150, Math.max(1, moveSpeed || 1));
  return 10 - ((lv - 1) * 5) / 149;
}

// 룬 레벨 -> 슬롯 테두리 색상 클래스
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

/**
 * 최종 전투 스탯 계산.
 * @param {Object} p
 * @param {number} p.baseAtk 기본 공격력
 * @param {number} p.baseHp 기본 체력
 * @param {number} p.count 공룡 수 (협동 공격/고독한 분노 조건 판정용)
 * @param {Array<{name:string, lv:number|string}|null>} p.selectedRunes 장착된 룬 5슬롯
 * @param {Object} [p.constellation] 별자리 보너스 (정수 가산)
 * @param {number} [p.constellation.atk]
 * @param {number} [p.constellation.hp]
 * @param {number} [p.constellation.critRate]
 * @param {number} [p.constellation.critDmg]
 * @param {Object} [p.bonusPercent] 알 스킨/둥지 등 % 가산 보너스
 * @param {number} [p.bonusPercent.atk]
 * @param {number} [p.bonusPercent.hp]
 */
function getBattleStats({
  baseAtk,
  baseHp,
  count,
  selectedRunes,
  constellation = { atk: 0, hp: 0, critRate: 0, critDmg: 0 },
  bonusPercent = { atk: 0, hp: 0 }
}) {
  let atkF = 0, atkP = 0, hpF = 0, hpP = 0;
  let cRate = 3, cDmg = 105;

  selectedRunes.forEach((r) => {
    if (!r) return;
    const s = RUNES_DATA[r.name].levels[r.lv];

    // 보스 슬레이어는 "증가"가 아니라 "증폭"(보스전에서만 최종 곱연산) 개념이라
    // 이 함수의 일반 % 바구니에는 넣지 않음. 증폭 계산은 getTitanCombatMetrics에서 별도 처리.
    if (r.name === "보스 슬레이어") return;

    // 마지막 선물의 atk_f는 사망한 아군이 남은 아군에게 넘겨주는 임시 버프량이지 상시 스탯이 아님
    if (r.name === "마지막 선물") return;

    let active =
      r.name === "협동 공격" ? count >= 5
      : r.name === "고독한 분노" ? count === 1
      : true;

    if (active) {
      if (s.atk_f) atkF += s.atk_f;
      if (s.atk_p) atkP += s.atk_p;
      if (s.hp_f) hpF += s.hp_f;
      if (s.hp_p) hpP += s.hp_p;
    }
    if (r.name === "치명타 확률") cRate += s.prob;
    if (r.name === "치명타 피해") cDmg += s.crit_d;
  });

  // 별자리: 룬과 같은 정수/치명타 바구니에 그대로 합산
  atkF += constellation.atk || 0;
  hpF += constellation.hp || 0;
  cRate += constellation.critRate || 0;
  cDmg += constellation.critDmg || 0;

  // 알 스킨/둥지: 룬과 같은 퍼센트 바구니에 그대로 합산
  atkP += bonusPercent.atk || 0;
  hpP += bonusPercent.hp || 0;

  return {
    fAtk: (baseAtk + atkF) * (1 + atkP / 100),
    fHp: (baseHp + hpF) * (1 + hpP / 100),
    cRate,
    cDmg
  };
}

/**
 * 타이탄전 "관련 수치" 패널용 계산. getBattleStats와 파라미터 모양은 같지만
 * 보스 상대로만 의미가 있는 값들(보스 슬레이어 증폭, 스킬 룬 평균 대미지 등)까지 계산함.
 * @param {Object} p getBattleStats와 동일한 파라미터
 * @returns {Object} finalAtk, ampFinalAtk, avgHitDamage, atkAmpGain, bossSlayerPercent,
 *   skillDetails(배열), skillDmgTotal, reductions(배열), reductionTotal,
 *   recoveries(배열), recoveryTotal
 */
function getTitanCombatMetrics({
  baseAtk,
  baseHp,
  count,
  selectedRunes,
  constellation = { atk: 0, hp: 0, critRate: 0, critDmg: 0, bossDmgIncrease: 0 },
  bonusPercent = { atk: 0, hp: 0 }
}, tileCfg = {}) {
  let atkF = 0, atkP = 0, hpF = 0, hpP = 0;
  if (tileCfg.atkTowerLevel !== null && tileCfg.atkTowerLevel !== undefined) atkP += BUFF_TOWER_PERCENTS[tileCfg.atkTowerLevel];
  if (tileCfg.hpTowerLevel !== null && tileCfg.hpTowerLevel !== undefined) hpP += BUFF_TOWER_PERCENTS[tileCfg.hpTowerLevel];
  let cRate = 3, cDmg = 105;
  let bossSlayerPercent = 0;
  const reductions = [];
  const skillHits = [];
  let healProb = 0, healRecP = 0;
  let vProb = 0, vRecP = 0;
  let atkF_vamp = 0, atkP_vamp = 0;

  selectedRunes.forEach((r) => {
    if (!r) return;
    const s = RUNES_DATA[r.name].levels[r.lv];
    const isAmpRune = r.name === "보스 슬레이어"; // 현재 유일한 "증폭"형 룬. 일반 % 바구니엔 안 들어감
    const isGiftRune = r.name === "마지막 선물"; // atk_f는 사망한 아군이 넘겨주는 임시 버프량이지 상시 스탯이 아님
    // 자연의 포옹/부족의 축복은 타일 조건이 충족돼야만 효과가 붙음(허수아비/공룡 대전과 동일)
    const isTileGated =
      r.name === "자연의 포옹" ? !tileCfg.natureAdjacent
      : (r.name === "부족의 축복 1" || r.name === "부족의 축복 2") ? !tileCfg.tribeControl
      : false;

    let active =
      r.name === "협동 공격" ? count >= 5
      : r.name === "고독한 분노" ? count === 1
      : true;

    if (active && !isAmpRune && !isGiftRune && !isTileGated) {
      if (s.atk_f) atkF += s.atk_f;
      if (s.atk_p) atkP += s.atk_p;
      if (s.hp_f) hpF += s.hp_f;
      if (s.hp_p) hpP += s.hp_p;
    }
    if (isAmpRune) bossSlayerPercent += s.atk_p;

    if (!VAMP_EXCLUSION_LIST.includes(r.name) && !isTileGated) {
      if (s.atk_f) atkF_vamp += s.atk_f;
      if (s.atk_p) atkP_vamp += s.atk_p;
    }

    if (r.name === "치명타 확률") cRate += s.prob;
    if (r.name === "치명타 피해") cDmg += s.crit_d;

    // 대미지 감소: 정직하게 정수만큼 감소(단단한 피부, 타이탄 가드) vs 확률로 정수만큼 감소(피해 저항)
    if (r.name.includes("단단한 피부") || r.name === "타이탄 가드") {
      reductions.push({ name: r.name, type: "flat", value: s.red_f, avg: s.red_f });
    }
    if (r.name === "피해 저항 1" || r.name === "피해 저항 2") {
      reductions.push({ name: r.name, type: "prob", value: s.red_f, prob: s.prob, avg: (s.red_f * s.prob) / 100 });
    }
    // 보호막: "N회 동안 M% 감소"라 확정 횟수 이후엔 효과가 끊기는 일회성 방어라
    // 다른 항목들처럼 매 타격 평균값으로 합산하지 않고 횟수/퍼센트 그대로 별도 표기만 함(avg는 합계에 영향 없도록 0)
    if (r.name === "보호막") {
      reductions.push({ name: r.name, type: "shield", turn: s.turn, red_p: s.red_p, avg: 0 });
    }

    // 스킬 대미지: 트리플 임팩트(3타마다 확정 발동 = 공격 1회당 평균 1/3), 낙뢰/메테오(확률 발동)
    if (r.name === "트리플 임팩트") {
      skillHits.push({ name: r.name, triggerRate: 1 / 3, burstP: s.burst_p });
    }
    if (r.name === "낙뢰" || r.name === "메테오") {
      skillHits.push({ name: r.name, triggerRate: s.prob / 100, burstP: s.burst_p });
    }

    if (r.name === "힐") { healProb = s.prob; healRecP = s.rec_p; }
    if (r.name === "흡혈") { vProb = s.prob; vRecP = s.rec_p; }
  });

  atkF += constellation.atk || 0;
  hpF += constellation.hp || 0;
  cRate += constellation.critRate || 0;
  cDmg += constellation.critDmg || 0;
  atkF_vamp += constellation.atk || 0;

  atkP += bonusPercent.atk || 0;
  hpP += bonusPercent.hp || 0;
  atkP_vamp += bonusPercent.atk || 0;
  if (tileCfg.atkTowerLevel !== null && tileCfg.atkTowerLevel !== undefined) atkP_vamp += BUFF_TOWER_PERCENTS[tileCfg.atkTowerLevel];

  const finalAtk = (baseAtk + atkF) * (1 + atkP / 100);
  // 보스 피해 증가(별자리, 정수 고정값)는 %가 아니라서 finalAtk에 곱셈으로 안 들어가고, 보스
  // 슬레이어(룬, %)를 곱하기 "전" 단계에서 더해짐 - simulation-titan.js의 currentAtk 공식과 동일한 순서
  const ampFinalAtk = (finalAtk + (constellation.bossDmgIncrease || 0)) * (1 + bossSlayerPercent / 100);
  const finalHp = (baseHp + hpF) * (1 + hpP / 100);

  // 치확/치피를 반영한 평균 배율: 치명타면 cDmg%, 아니면 100%
  const critMult = (cRate / 100) * (cDmg / 100) + (1 - cRate / 100);
  const avgHitDamage = ampFinalAtk * critMult;
  const atkAmpGain = ampFinalAtk - finalAtk;

  const skillDetails = skillHits.map((h) => ({
    name: h.name,
    avgDmg: ampFinalAtk * (h.burstP / 100) * h.triggerRate * critMult
  }));
  const skillDmgTotal = skillDetails.reduce((sum, d) => sum + d.avgDmg, 0);

  const reductionTotal = reductions.reduce((sum, r) => sum + r.avg, 0);

  // 흡혈 기준 공격력은 오버밸런스 방지용 제외 목록이 적용된 별도 바구니(VAMP_EXCLUSION_LIST) 사용
  const vBaseAtk = (baseAtk + atkF_vamp) * (1 + atkP_vamp / 100);
  const healAvg = ((finalHp * healRecP) / 100) * (healProb / 100);
  const vampAvg = vBaseAtk * (vRecP / 100) * (vProb / 100);
  const recoveries = [
    { name: "힐", value: healRecP, prob: healProb, avg: healAvg },
    { name: "흡혈", value: vRecP, prob: vProb, avg: vampAvg }
  ].filter((r) => r.prob > 0);
  const recoveryTotal = healAvg + vampAvg;

  return {
    finalAtk,
    ampFinalAtk,
    finalHp,
    cRate,
    cDmg,
    avgHitDamage,
    atkAmpGain,
    bossSlayerPercent,
    skillDetails,
    skillDmgTotal,
    reductions,
    reductionTotal,
    recoveries,
    recoveryTotal,
    healAvg,
    vampAvg
  };
}

// 타이탄 조합 최적화기(titan-page.js titanRunOptimizer)의 1단계 스크리닝 전용: 시뮬레이션을
// 돌리지 않고 getTitanCombatMetrics() 결과만으로 노이즈 없는 생존 시간을 추정한다.
// 타이탄 공격/힐은 3초 주기(simulation-titan.js의 t%3===0), 흡혈은 공룡 자신의 공격 주기인
// 1초 주기라 나누는 분모가 다르다. 보호막(일회성 방어)과 사망 트리거 룬(마지막 선물/희생/
// 죽을 준비), 연속 전투 재소환은 정의상 "첫 사망 시각"에 영향을 줄 수 없어 여기서는 반영하지
// 않아도 오차가 없다(runTitanSimulation의 avgTimeSec도 첫 사망 시각의 평균).
function estimateTitanSurvivalSec(metrics, targetTitan, timeLimitSec) {
  const netDrainPerSec = Math.max(0, targetTitan.atk - metrics.reductionTotal) / 3
    - metrics.healAvg / 3 - metrics.vampAvg;
  return netDrainPerSec <= 0 ? timeLimitSec : metrics.finalHp / netDrainPerSec;
}
