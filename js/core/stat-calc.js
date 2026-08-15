// 순수 계산 함수 모음. DOM을 전혀 건드리지 않음 -> 나중에 서버(Node)에서도 그대로 재사용 가능.

// 이동속도 레벨(1~150) -> 타일 1칸을 이동하는 데 걸리는 시간(초)
// 1레벨=10초, 150레벨(만렙)=5초이고 그 사이는 "시간"이 레벨에 비례해 균등하게 줄어듦
function getTileMoveSeconds(moveSpeed) {
  const lv = Math.min(150, Math.max(1, moveSpeed || 1));
  return 10 - ((lv - 1) * 5) / 149;
}

// 연속 전투 재소환 지연(초) = 고정 1.5초 + 둥지<->타이탄 이동 시간. simulation-titan.js,
// simulation-building.js(js/pages/building-page.js), estimateTitanExpectedDeaths(1단계 해석적
// 추정) 전부 똑같이 써야 해서 공용 헬퍼로 뽑음
function getRespawnDelaySec(moveSpeed, distanceTiles) {
  return 1.5 + distanceTiles * getTileMoveSeconds(moveSpeed);
}

// 치명타 굴림 - "치확 확률로 cDmg%, 아니면 100% 대미지"라는 동일한 계산이 타이탄/건물/허수아비/
// 다이노배틀/아레나 5개 엔진에 전부 각자 구현돼있던 걸 공용화(사용자 지적 - "4개 페이지 모두
// 각각 따로따로 체력이나 공격력을 계산했던거야? 그건 너무 비효율적인 코드 작성"). rand를 인자로
// 받는 이유: 다이노배틀/아레나의 친구 동기화 재생은 시드 고정 RNG를 써서 똑같은 결과가 재생되게
// 하므로, 여기서 Math.random을 직접 호출하지 않고 호출자가 준 rand()를 그대로 씀(기본값은
// Math.random - 시드가 필요 없는 나머지 엔진은 그냥 기본값을 씀)
function rollCritHit(baseDmg, cRate, cDmg, rand = Math.random) {
  const isCrit = rand() * 100 < cRate;
  return { dmg: isCrit ? baseDmg * (cDmg / 100) : baseDmg, isCrit };
}

// 치확/치피 평균을 반영한 기대 대미지 배율(빠른 계산용 - 확률/굴림 없이 "1초당 기댓값"으로 환산)
function computeExpectedDpsFromCrit(atk, cRate, cDmg) {
  return atk * (1 + (cRate / 100) * (cDmg / 100 - 1));
}

// 전투 중 최대체력이 바뀔 때(인원수 조건부 룬 임계값을 넘나들 때 등) 살아있는 유닛의 현재체력을
// "감소 전 최대체력 대비 남은 체력의 비율"로 재조정(체력 %가 유지되고 절대값만 같이 줄거나 늚) -
// 게임사 공식 답변 기준 규칙. prevMaxHp가 0이면(이론상 나올 일은 없지만) 0으로 나누기를 막음.
// 페이지마다 공룡 체력을 담는 자료구조 모양이 달라서(타이탄은 유닛 배열 전체가 같은 prevMaxHp를
// 공유, 다이노배틀/아레나는 유닛마다 자기 maxHp를 따로 들고 있음, 건물은 순수 숫자 배열) 핵심
// 비율 계산(hpRescaleRatio)만 공용화하고 세 가지 모양별로 얇은 래퍼를 둠
function hpRescaleRatio(newMaxHp, prevMaxHp) {
  return (prevMaxHp > 0 && newMaxHp !== prevMaxHp) ? newMaxHp / prevMaxHp : 1;
}

// 타이탄처럼 살아있는 유닛 배열 전체가 같은 이전 최대체력(prevMaxHp)을 공유하는 경우
function rescaleAliveHpForMaxHpChange(aliveUnits, newMaxHp, prevMaxHp) {
  const ratio = hpRescaleRatio(newMaxHp, prevMaxHp);
  if (ratio !== 1) aliveUnits.forEach((u) => { u.hp *= ratio; });
}

// 다이노배틀/아레나처럼 유닛 하나하나가 자기 maxHp를 따로 들고 있는 경우 - 재조정과 동시에
// maxHp 자체도 새 값으로 갱신함(호출자가 따로 안 해도 되게)
function rescaleOneUnitHp(unit, newMaxHp) {
  const ratio = hpRescaleRatio(newMaxHp, unit.maxHp);
  if (ratio !== 1) unit.hp *= ratio;
  unit.maxHp = newMaxHp;
}

// 건물 페이지처럼 공룡 체력을 객체가 아니라 순수 숫자 배열(buildingDinoHp)로 들고 있는 경우 -
// 배열 자체를 제자리에서 수정함(살아있는(>0) 유닛만)
function rescaleHpArrayForMaxHpChange(hpArray, newMaxHp, prevMaxHp) {
  const ratio = hpRescaleRatio(newMaxHp, prevMaxHp);
  if (ratio === 1) return;
  for (let i = 0; i < hpArray.length; i++) {
    if (hpArray[i] > 0) hpArray[i] *= ratio;
  }
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

    // 스킬 대미지: 트리플 임팩트(3타마다 확정 발동 = 공격 1회당 평균 1/3), 낙뢰/메테오(확률 발동).
    // prob 필드는 낙뢰/메테오에만 있음(트리플 임팩트는 undefined로 남겨서 "확정 주기형"과
    // "확률형"을 구분함 - reductions의 type:"flat"/"prob" 구분과 같은 목적)
    if (r.name === "트리플 임팩트") {
      skillHits.push({ name: r.name, triggerRate: 1 / 3, burstP: s.burst_p });
    }
    if (r.name === "낙뢰" || r.name === "메테오") {
      skillHits.push({ name: r.name, triggerRate: s.prob / 100, burstP: s.burst_p, prob: s.prob });
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

  // avgDmg는 발동 확률(빈도)까지 반영된 평균값, rawDmg는 "발동됐을 때 실제로 들어가는 대미지"
  // (치확/치피 평균은 반영하되 발동 확률은 안 곱한 값), critDmg는 그 발동이 확정 크리티컬이었을
  // 때의 대미지(치확/치피를 평균으로 안 섞고 cDmg%를 그대로 적용) - 관련 수치 카드의 breakdown에서
  // "원래 대미지"/"평균 대미지"/"크리티컬 대미지" 세 줄로 나란히 보여주는 용도(rawDmg * triggerRate
  // = avgDmg로 항상 일치함)
  const skillDetails = skillHits.map((h) => ({
    name: h.name,
    avgDmg: ampFinalAtk * (h.burstP / 100) * h.triggerRate * critMult,
    rawDmg: ampFinalAtk * (h.burstP / 100) * critMult,
    critDmg: ampFinalAtk * (h.burstP / 100) * (cDmg / 100),
    prob: h.prob
  }));
  const skillDmgTotal = skillDetails.reduce((sum, d) => sum + d.avgDmg, 0);

  const reductionTotal = reductions.reduce((sum, r) => sum + r.avg, 0);

  // 흡혈 기준 공격력은 오버밸런스 방지용 제외 목록이 적용된 별도 바구니(VAMP_EXCLUSION_LIST) 사용
  const vBaseAtk = (baseAtk + atkF_vamp) * (1 + atkP_vamp / 100);
  const healAvg = ((finalHp * healRecP) / 100) * (healProb / 100);
  const vampAvg = vBaseAtk * (vRecP / 100) * (vProb / 100);
  // rawAmount = "발동됐을 때 실제로 회복되는 양"(발동 확률을 안 곱한 절대값) - avg는 발동 확률까지
  // 반영된 평균값이라 관련 수치 카드 breakdown에서 "평균"과 "원래 회복량"을 나란히 보여줄 때 씀
  const recoveries = [
    { name: "힐", value: healRecP, prob: healProb, avg: healAvg, rawAmount: (finalHp * healRecP) / 100 },
    { name: "흡혈", value: vRecP, prob: vProb, avg: vampAvg, rawAmount: (vBaseAtk * vRecP) / 100 }
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
    vampAvg,
    // 아래는 estimateTitanExpectedDeaths()가 확률분포(기댓값이 아니라 각 발동 확률·크기)를
    // 그대로 써야 해서 추가로 노출함 - 전부 이미 위에서 계산되던 지역변수라 순수 추가일 뿐,
    // 기존 소비자(관련 수치 카드 등)에는 영향 없음
    healProb,
    healRecP,
    vProb,
    vRecP,
    vBaseAtk
  };
}

// 타이탄 조합 최적화기(titan-page.js titanRunOptimizer)의 1단계 스크리닝 전용: 시뮬레이션(RNG
// 반복) 없이, 연속 전투(무한 재소환 - 죽어도 respawnDelaySec 뒤 다시 만수 체력으로 합류) 기준
// "기대 사망 횟수"를 노이즈 없는 수학적 모델로 추정한다.
//
// [배경] 예전엔 평균 net 소모율(기댓값)만으로 생존 시간을 추정했는데 두 가지 구조적 문제가
// 있었다: (1) 오버힐 미반영 - 흡혈/힐 평균 회복량은 "체력이 이미 최대치면 낭비된다"는 걸 모르는
// 순수 기댓값이라, 회복량이 큰 조합일수록 점수가 실제보다 부풀려짐(하필 "회복이 소모를 이기는"
// 안전한 조합일수록 캡 근처에 머무는 시간이 길어서, 왜곡이 가장 클 때 가장 크게 틀림 - 실측 확인:
// 사망률 42.7% 조합이 0.7% 조합보다 옛 공식에서 더 높은 점수를 받은 사례). (2) 최솟값 위험 미반영
// - 공룡 count마리 중 한 마리라도 먼저 죽는 게 실제 위험인데, 평균 기반 수식은 "평균적인 공룡
// 1마리"만 모델링해서 이 위험을 과소평가함. 게다가 연속 전투 하에서는 "안 죽는다"가 목표가
// 아니라 "얼마나 적게 죽는지"가 목표라, 필요한 건 "무사망 확률"이 아니라 "기대 사망 횟수".
//
// [모델] 재생 이론(renewal theory): 공룡 한 마리가 만수 체력에서 시작해 처음 죽기까지 걸리는
// 평균 시간(MTTF, mean time to failure)만 구하면, 그 뒤로는 죽을 때마다 respawnDelaySec만큼
// 대기 후 다시 만수 체력에서 완전히 동일한 과정이 반복되므로(첫 사이클도 다르지 않음 - 매
// 사이클이 "만수 체력에서 시작"이라는 동일 조건이라 재생 과정의 정의 그대로) 기대 사망
// 횟수(T) = T / (MTTF + respawnDelaySec).
//
// MTTF는 체력을 TITAN_SURVIVAL_BUCKETS개 구간으로 이산화한 흡수 마르코프 체인에서, "k사이클
// 후에도 살아있을 확률"(alive mass, 항상 0~1로 유계)을 앞으로 전파하며 그 총합을 누적하는 방식으로
// 구함(아래 singleDinoMTTFCycles) - E[T]=Σ P(T>k) 항등식과 감쇠 비율이 안정되면(퀘이사이-정상
// 분포) 남은 무한 꼬리를 등비급수로 근사하는 트릭을 씀(자세한 유도는 함수 주석 참고). 3초 사이클
// = 공룡 공격 3회(각각 흡혈 확률 발동) + 마지막 틱의 힐 확률 발동 + 타이탄 공격 1회(확정/확률
// 감소 후 최소 1 피해). 오버힐을 정확히 반영하는 핵심은 "사이클 안의 회복(흡혈 최대 3회 + 힐
// 1회) 총합을 먼저 만수 체력에 클램프한 뒤에 피해를 빼고 0에 클램프"하는 순서를 절대 하나의 net
// delta로 뭉치지 않는 것 - 예: 90%에서 +20% 회복 후 클램프=100%, 그 다음 -15% 피해 = 85%. 이걸
// net delta(+20-15=+5)로 뭉치면 95%가 나와서 틀림.
//
// count(공룡 마릿수) 합산은 기대 사망 횟수 × count(기댓값의 선형성 - 독립성 불필요, 단순 합).

// 체력을 몇 구간으로 이산화할지. 25는 너무 거칠어서 사이클마다 여러 구간을 한 번에 건너뛰는
// 조합(예: 방어가 거의 없어 한 방에 여러 버킷씩 깎이는 경우)에서 오차가 40배 넘게 났음(실측
// 대조로 확인) - 200으로 올리면 훨씬 정확해짐(실측 72.2 기준 25개=1.6 -> 200개=58.3). 문제는
// 버킷 수가 늘면 수렴까지 필요한 사이클 수도 같이 늘어나는 조합이 있어서(체감 오차 감소 자체는
// "공짜"가 아니었음 - 조합 수천~수십만 개를 전부 이 정확도로 스크리닝하면 실측상 감당 안 될 만큼
// 느려짐), 전체 스크리닝은 이 기본값(빠름)으로 하고, 후보로 뽑힌 소수만 더 높은 정밀도로
// 다시 계산하는 2단 구조를 씀(titan-page.js의 refineExpectedDeathCount 호출부 참고)
const TITAN_SURVIVAL_BUCKETS = 25;
const TITAN_SURVIVAL_REFINE_BUCKETS = 200; // 후보로 뽑힌 소수 조합만 이 정밀도로 재계산
// 감쇠 비율(λ) 수렴 대기 상한. 처음엔 30이었는데 실측으로 너무 작다는 게 드러남 - 이산화 때문에
// λ가 짝/홀 사이클마다 진동하는 조합에서는 lookback 비교 없이는 가짜 수렴에 속기 쉬움. lookback
// 비교를 도입한 뒤로는 100 정도로도 충분히 정확한 방향(랭킹)을 잡아냄을 실측으로 확인함(400까지
// 올려도 값이 거의 안 바뀜 - 100이면 이미 대부분 수렴 근처) - 200k개 조합을 스크리닝해야 하는
// 1단계 비용을 고려해 100으로 둠
const TITAN_SURVIVAL_WARMUP_CYCLES = 100;
// lookback개 전 λ와 비교해서 진동에 안 속게 함(바로 위 주석 참고) - 값이 너무 작으면 여전히
// 진동 주기 안에서 우연히 가까워 보일 수 있고, 너무 크면 그만큼 더 오래 돌아야 함
const TITAN_SURVIVAL_LOOKBACK = 15;
// 확정형(분기 1개)이거나 방어가 극도로 강한 조합은 TITAN_SURVIVAL_WARMUP_CYCLES 안에 단 한 번도
// 죽음이 관측되지 않을 수 있음(아직 "감쇠"라고 할 게 없어서 λ가 그냥 항상 1) - 이 경우에만 훨씬
// 넓은 상한까지 계속 찾아봄(singleDinoMTTFCycles의 sawDecay 분기, extendedCap 참고 - 실제
// 평가 기간(horizonCycles)보다 짧으면 안 됨)
const TITAN_SURVIVAL_EXTENDED_CYCLES = 150;

// 공룡 한 마리, 3초 사이클 하나에 대한 (확률, 회복량, 피해량) 조합을 전부 열거 - 힐
// Bernoulli(healProb%) x 흡혈 Binomial(3, vProb%) = 최대 8가지 "위로" 분기, 확률형 감소 룬
// (피해 저항류) 2^k 발동 조합 = 최대 4가지 "아래로" 분기(k=2 기준) - 조합당 한 번만 계산하면
// 되고(시간 불변), reductions 배열을 그대로 순회해서 확률형 룬 종류가 늘어도 자동 대응됨
function buildTitanCycleBranches(metrics, targetTitan) {
  const healP = metrics.healProb / 100;
  const healAmount = (metrics.finalHp * metrics.healRecP) / 100;
  const healOutcomes = healP > 0
    ? [{ prob: 1 - healP, amount: 0 }, { prob: healP, amount: healAmount }]
    : [{ prob: 1, amount: 0 }];

  const vampP = metrics.vProb / 100;
  const vampAmount = (metrics.vBaseAtk * metrics.vRecP) / 100;
  const binomCoeff = [1, 3, 3, 1];
  const vampOutcomes = vampP > 0
    ? [0, 1, 2, 3].map((k) => ({
        prob: binomCoeff[k] * Math.pow(vampP, k) * Math.pow(1 - vampP, 3 - k),
        amount: k * vampAmount
      }))
    : [{ prob: 1, amount: 0 }];

  const upBranches = [];
  for (const h of healOutcomes) {
    for (const v of vampOutcomes) {
      const prob = h.prob * v.prob;
      if (prob > 1e-12) upBranches.push({ prob, amount: h.amount + v.amount });
    }
  }

  // 타이탄 가드는 보호막의 곱연산 배율이 적용되기 "전"에 빠지고, 단단한 피부/피해 저항은 그
  // 배율이 적용된 "다음"에 빠짐(simulation-titan.js의 감소 적용 순서 - 특정 대상 상수값(가드) ->
  // 보호막(곱연산) -> 일반 상수값(단단한 피부)/확률형(피해 저항) 순 - 와 정확히 같아야 보호막
  // 장착 시 오차가 안 생김. 둘 다 getTitanCombatMetrics에서는 같은 type:"flat"으로 뭉쳐 나오므로
  // 여기서 이름으로 다시 나눔
  const guardFlat = metrics.reductions.filter((r) => r.name === "타이탄 가드").reduce((s, r) => s + r.value, 0);
  const hardskinFlat = metrics.reductions
    .filter((r) => r.type === "flat" && r.name !== "타이탄 가드")
    .reduce((s, r) => s + r.value, 0);
  const probReductions = metrics.reductions.filter((r) => r.type === "prob");
  let reductionBranches = [{ prob: 1, reduction: hardskinFlat }];
  for (const r of probReductions) {
    const p = r.prob / 100;
    const next = [];
    for (const b of reductionBranches) {
      next.push({ prob: b.prob * (1 - p), reduction: b.reduction });
      next.push({ prob: b.prob * p, reduction: b.reduction + r.value });
    }
    reductionBranches = next;
  }

  // 보호막(N사이클 동안 M% 곱연산 감소)은 확률이 아니라 스폰/재소환 이후 흐른 사이클 수만으로
  // 정확히 결정되는 확정 카운트다운(simulation-titan.js의 shieldSteps와 동일 - 매 사이클 무조건
  // 1씩 감소) - 그래서 별도의 마르코프 상태 차원(버킷 수를 몇 배로 불릴)을 늘릴 필요 없이, "사이클
  // k가 지속 기간(shieldTurns) 안인지"만으로 골라 쓸 두 세트의 분기(있음/없음)를 미리 만들어두고
  // singleDinoMTTFCycles가 사이클 인덱스에 따라 골라 쓰게 함(계산량 증가 거의 없음)
  const shield = metrics.reductions.find((r) => r.type === "shield");
  const shieldTurns = shield ? shield.turn : 0;
  const shieldMult = shield ? 1 - shield.red_p / 100 : 1;
  const baseAfterGuard = targetTitan.atk - guardFlat;
  const downBranchesShielded = reductionBranches.map((b) => ({
    prob: b.prob,
    amount: Math.max(1, baseAfterGuard * shieldMult - b.reduction)
  }));
  const downBranchesUnshielded = reductionBranches.map((b) => ({
    prob: b.prob,
    amount: Math.max(1, baseAfterGuard - b.reduction)
  }));

  return { upBranches, downBranchesShielded, downBranchesUnshielded, shieldTurns };
}

// 상태 확률 분포(v, 길이 B+1)에 한 사이클을 적용 - v[0]은 이미 죽은 확률질량(흡수됨), v[1..B]가
// "살아있는" 확률질량. 시작 분포(전부 만수 체력)에서 출발해 매 사이클 앞으로 전파(propagate)함
function propagateOneCycle(v, combined, B, finalHp, step) {
  // finalHp가 0 이하면 hpDown/finalHp가 0으로 나누기가 돼서 NaN이 조용히 확률 버킷을 오염시킴 -
  // singleDinoMTTFCycles가 이미 이 경우를 걸러서 이 함수까지 안 오게 막아두지만(호출자 가드), 이
  // 함수가 앞으로 다른 곳에서도 직접 호출될 가능성에 대비해 여기도 방어적으로 같은 가드를 둠
  if (finalHp <= 0) return v;

  const next = new Float64Array(B + 1);
  for (let s = 1; s <= B; s++) {
    const mass = v[s];
    if (mass <= 0) continue;
    const hp = s * step;
    for (const br of combined) {
      const hpUp = Math.min(finalHp, hp + br.up);
      const hpDown = Math.max(0, hpUp - br.down);
      let bucket = Math.round((hpDown / finalHp) * B);
      if (bucket < 0) bucket = 0;
      else if (bucket > B) bucket = B;
      next[bucket] += mass * br.prob;
    }
  }
  return next;
}

// 공룡 한 마리의 MTTF(기대 사이클 수, 3초 단위) 추정.
//
// 처음엔 "흡수까지 기대 스텝 수" 선형계(n[s]=1+ΣQ·n)를 Jacobi 반복으로 직접 풀려고 했는데, 이
// 방식은 근본적인 문제가 있었다: 매 반복마다 n이 최대 +1씩만 늘 수 있어서, 반복 횟수(성능 예산상
// 20~40회)로는 절대 큰 MTTF(예: 수백~수천 사이클)에 도달할 수 없다 - "이미 압도적으로 안전하니
// 조기 종료" 조건(n이 큰 임계값을 넘으면 종료)도 n 자체가 반복 횟수에 막혀 그 임계값에 도달할
// 수 없어서 사실상 죽은 코드였다(Node 벤치마크로 실측: 방어가 전무한 조합과 극도로 안전한 조합이
// 똑같이 반복 상한(≈캡 값)으로 수렴해버려 전혀 구분이 안 됨).
//
// 대신 "k사이클 후에도 살아있을 확률"(alive mass, 항상 0~1로 유계)을 앞으로 전파하면서 그 총합을
// 누적하는 방식을 씀 - E[T] = Σ_{k=0}^∞ P(T>k) 항등식(T=흡수까지 걸리는 사이클 수)을 이용해서,
// alive mass의 감쇠 비율(λ = aliveMass_k / aliveMass_{k-1})이 안정되면(퀘이사이-정상 분포로
// 수렴 - 마르코프 체인의 스펙트럴 갭 덕분에 실제 MTTF 크기와 무관하게 보통 수십 사이클 안에
// 안정됨) 나머지 무한 꼬리를 등비급수로 근사: Σ_{k=K}^∞ aliveMass_k ≈ aliveMass_{K-1}·λ/(1-λ).
// 이러면 λ가 1에 아주 가까울수록(극도로 안전) 꼬리 항이 자연히 커져서 큰 MTTF를 정확히 반영하고,
// 반복 횟수 자체에 상한이 걸리지 않는다.
function singleDinoMTTFCycles(metrics, targetTitan, horizonCycles, buckets = TITAN_SURVIVAL_BUCKETS) {
  // finalHp가 0 이하면(이론상 나올 일은 없지만 - 사이트 전체 점검에서 지적된 방어적 가드) 이미
  // 죽은 것과 같으므로 사이클 0으로 바로 반환 - 안 그러면 아래 propagateOneCycle의 hpDown/finalHp가
  // 0으로 나누기가 돼서 NaN이 조용히 확률 버킷을 오염시킴
  if (metrics.finalHp <= 0) return 0;

  const { upBranches, downBranchesShielded, downBranchesUnshielded, shieldTurns } = buildTitanCycleBranches(metrics, targetTitan);
  const combine = (downBranches) => {
    const combined = [];
    for (const u of upBranches) {
      for (const d of downBranches) {
        const prob = u.prob * d.prob;
        if (prob > 1e-12) combined.push({ prob, up: u.amount, down: d.amount });
      }
    }
    return combined;
  };
  // 보호막은 사이클 인덱스(k)만으로 활성 여부가 결정되는 확정 카운트다운이라(위
  // buildTitanCycleBranches 주석 참고), 두 분기 세트를 한 번씩만 만들어두고 사이클마다 골라 씀
  const combinedShielded = combine(downBranchesShielded);
  const combinedUnshielded = combine(downBranchesUnshielded);

  const B = buckets;
  const finalHp = metrics.finalHp;
  const step = finalHp / B;
  let v = new Float64Array(B + 1);
  v[B] = 1; // 시작 상태: 만수 체력에서 확률 1

  let sumAlive = 0;
  let aliveMass = 1;
  let prevAliveMass = 1;
  let lambda = 0;
  let sawDecay = false; // 확률질량이 조금이라도 흡수(사망)된 적이 있는지 - 이게 한 번도 없으면
  // "감쇠 비율이 안정됐다"고 착각하면 안 됨(확정형/저확률 조합은 아직 한 번도 안 죽어서 λ가
  // 그냥 항상 정확히 1인 것뿐 - 진짜 정상 감쇠가 아니라 "아직 관측된 죽음이 없다"는 뜻)

  // λ 이력을 남겨서 "몇 사이클 전 값"과 비교(lookback) - 딱 1사이클 전 값과만 비교하면 이산화
  // 특유의 주기적 진동(짝/홀 사이클마다 λ가 살짝 다르게 번갈아 나오는 패턴, 실측으로 확인됨)
  // 때문에 진짜로는 전혀 안정되지 않은 상태를 "수렴했다"고 오판함 - 실측 사례: 방어 룬이 전혀
  // 없는 고DPS 조합에서 5~10사이클째의 λ(≈0.9999985)를 "수렴"으로 잘못 봤는데, 실제 참값은
  // 200사이클 이후에야 드러나는 λ(≈0.9998429)로 100배 넘게 차이났음(tail=aliveMass·λ/(1-λ)라
  // 1-λ가 100배 작게 잡히면 추정 MTTF가 100배 부풀려짐 - 고DPS·무방어 조합이 "거의 안 죽는다"로
  // 잘못 나온 원인이 바로 이 조기 수렴 오판이었음).
  const lambdaHistory = [];

  // sawDecay가 아직 false인 동안은(단 한 번도 흡수를 못 봄) 훨씬 넓은 상한(EXTENDED)까지 계속
  // 찾아봄 - 확정형 조합이 사망 사이클에 늦게 도달하거나 방어가 극도로 강한 경우를 대비. 이 상한은
  // 반드시 horizonCycles(실제로 평가해야 하는 기간) 이상이어야 함 - 고정값만 쓰면 전투 제한시간이
  // 긴 설정(예: 120분=2400사이클)에서 그 일부만 들여다보고 "안 죽는다"고 성급히 단정해버림.
  const extendedCap = Math.max(TITAN_SURVIVAL_EXTENDED_CYCLES, horizonCycles);
  for (let k = 0; k < (sawDecay ? TITAN_SURVIVAL_WARMUP_CYCLES : extendedCap); k++) {
    aliveMass = 0;
    for (let s = 1; s <= B; s++) aliveMass += v[s];
    sumAlive += aliveMass;
    if (aliveMass < 1e-9) { lambda = 0; sawDecay = true; break; } // 이미 사실상 확실히 죽음(그 자체가 감쇠의 극단) - 꼬리 무시 가능
    if (k > 0) {
      const newLambda = aliveMass / prevAliveMass;
      if (newLambda < 1 - 1e-9) sawDecay = true;
      lambdaHistory.push(newLambda);
      lambda = newLambda;
      // lookback개 전 값과 "감쇠율(1-λ)"을 상대오차로 비교 - λ 자체(항상 1에 아주 가까움)를
      // 절대오차로 비교하면 사실상 항상 "가깝다"고 나와서 의미가 없음(위 주석의 100배 오판
      // 사례가 바로 이 실수). decayNow가 극히 작을 때(거의 안 죽음)는 상대오차가 불안정해질 수
      // 있어 절대오차 하한(1e-9)도 같이 둠
      if (sawDecay && lambdaHistory.length > TITAN_SURVIVAL_LOOKBACK) {
        const pastLambda = lambdaHistory[lambdaHistory.length - 1 - TITAN_SURVIVAL_LOOKBACK];
        const decayNow = 1 - newLambda;
        const decayPast = 1 - pastLambda;
        if (Math.abs(decayNow - decayPast) < Math.max(1e-9, decayNow * 0.02)) break;
      }
    }
    prevAliveMass = aliveMass;
    v = propagateOneCycle(v, k < shieldTurns ? combinedShielded : combinedUnshielded, B, finalHp, step);
  }

  if (!sawDecay) {
    // 확장 상한 안에서도 단 한 번도 죽음이 관측되지 않음 - "MTTF가 최소 이 반복 횟수보다 훨씬
    // 크다"는 뜻이라, 큰 상수를 돌려줘도 랭킹(다른 조합과의 상대적 순서)엔 지장이 없음 - 실제
    // 죽는 조합들은 전부 이보다 작은 값을 받으므로 항상 더 안전하게 줄세워짐
    return extendedCap * 1000;
  }
  const tail = lambda > 0 && lambda < 1 ? (aliveMass * lambda) / (1 - lambda) : 0;
  return sumAlive + tail;
}

// 공룡 1마리 기준 "기대 사망 횟수"(count마리 합산은 호출부에서 × count, dps 계산 관례와 동일).
// buckets를 넘기면 그 정밀도로(기본은 빠른 스크리닝용 TITAN_SURVIVAL_BUCKETS) 계산함 - 1단계
// 전체 스크리닝은 기본값을 쓰고, 후보로 추려진 소수만 TITAN_SURVIVAL_REFINE_BUCKETS로 재계산함
function estimateTitanExpectedDeaths(metrics, targetTitan, effectiveHorizonSec, respawnDelaySec, buckets = TITAN_SURVIVAL_BUCKETS) {
  if (effectiveHorizonSec <= 0) return 0;
  const horizonCycles = effectiveHorizonSec / 3;
  const mttfCycles = singleDinoMTTFCycles(metrics, targetTitan, horizonCycles, buckets);
  const mttfSec = mttfCycles * 3;
  return effectiveHorizonSec / (mttfSec + respawnDelaySec);
}
