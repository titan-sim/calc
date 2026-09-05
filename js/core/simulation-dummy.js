// 허수아비(건축물 판정 단일 대상) 전투 계산. 상대가 반격하지 않고 죽지도 않는 고정 표적이라
// 타이탄/공룡 대전처럼 시간에 따라 변하는 전투 상태(HP, 생존 수 등)가 없음 - 프로필+타일 설정이
// 고정이면 공격력/치명타 확률/치명타 피해도 전투 내내 고정값이라, 매 초 반복 시뮬레이션할 필요 없이
// 딱 한 번만 계산해두고 매 공격 틱마다 크리티컬 여부만 새로 굴리면 됨.
//
// 대미지 공식: {(기본 공격력 + 별자리atk) × (vip%+스킨%+룬%) + 건축물 피해 증가(정수)} × (파괴자1%+파괴자2%+파괴자3%)
// - 파괴자 1/2/3(룬)은 "증가"가 아니라 "증폭"이라 일반 %(atkP) 바구니에 안 넣고 최종 곱연산으로 따로 적용.
// - 건축물 피해 증가(별자리)는 %가 아니라 정수라 atkP를 곱한 "다음" 단계에서 더해짐(파괴자 곱연산 이전).
// - 트리플 임팩트는 건축물 대상 공격엔 적용되지 않는 것으로 확인되어(부적합 룬 목록으로 옮김)
//   여기선 아예 다루지 않음 - 매 공격이 독립적인 단발 히트뿐이라 틱 사이에 상태가 남지 않음.

/**
 * @param {Object} inputs - getMyDinoBattleInputs()가 주는 형태(baseAtk, count, selectedRunes, constellation, bonusPercent)
 * @param {{natureAdjacent:boolean, tribeControl:boolean, atkTowerLevel:(number|null)}} tileCfg
 * @returns {{atk:number, cRate:number, cDmg:number}}
 */
function computeDummyCombatValues(inputs, tileCfg) {
  const { baseAtk, count, selectedRunes, constellation = {}, bonusPercent = { atk: 0 }, currentHpPercent = 100 } = inputs;

  let atkF = constellation.atk || 0;
  let atkP = bonusPercent.atk || 0;
  let cRate = 3 + (constellation.critRate || 0);
  let cDmg = 105 + (constellation.critDmg || 0);
  let destroyerPercent = 0;

  const atkTowerLv = tileCfg.atkTowerLevel;
  if (atkTowerLv !== null && atkTowerLv !== undefined) atkP += BUFF_TOWER_PERCENTS[atkTowerLv];

  (selectedRunes || []).filter((r) => r !== null).forEach((r) => {
    const s = RUNES_DATA[r.name].levels[r.lv];
    if (r.name === "파괴자 1" || r.name === "파괴자 2" || r.name === "파괴자 3") { destroyerPercent += s.atk_p; return; }
    if (r.name === "자연의 포옹" && !tileCfg.natureAdjacent) return;
    if ((r.name === "부족의 축복 1" || r.name === "부족의 축복 2") && !tileCfg.tribeControl) return;
    if (r.name === "협동 공격" && count < 5) return;
    // 고독한 분노는 DUMMY_UNSUITABLE_RUNE_LIST(js/data/rune-data.js)에 있는 "허수아비에 부적합한
    // 룬" - 다른 부적합 룬들은 이 함수가 다루는 필드(atk_f/atk_p)가 아예 없어서(예: 체력 증가류는
    // hp_f만 있음) 자연히 기여가 0이었는데, 고독한 분노는 특이하게 atk_f/hp_f를 같이 갖고 있어서
    // 별도 제외 코드 없이는 count와 무관하게 atk_f가 그대로 더해져버림(사이트 전체 점검에서 발견) -
    // 부적합 목록에 있는 만큼 다른 부적합 룬들과 똑같이 기여 0으로 맞춤(인원수 조건부로 되살리는 게
    // 아님 - "부적합"이라는 분류 자체가 이미 사용자가 확정한 것이라 그대로 존중함)
    if (r.name === "고독한 분노") return;
    if (r.name === "광전사의 분노") { atkP += computeBerserkerAtkBonus(currentHpPercent, s); return; }
    if (s.atk_f) atkF += s.atk_f;
    if (s.atk_p) atkP += s.atk_p;
    if (r.name === "치명타 확률") cRate += s.prob;
    if (r.name === "치명타 피해") cDmg += s.crit_d;
  });

  const buildingDmgFlat = constellation.buildingDmg || 0;
  const atk = ((baseAtk + atkF) * (1 + atkP / 100) + buildingDmgFlat) * (1 + destroyerPercent / 100);

  return { atk, cRate, cDmg };
}

/**
 * 공격 한 틱(1초에 한 번)의 결과 - 실제 계산은 stat-calc.js의 rollCritHit 공용 함수(사용자 지적 -
 * "4개 페이지 모두 각각 따로따로... 그건 너무 비효율적인 코드 작성", 전투 수식 공용화 작업의
 * 일부). 여기 남은 건 값 객체(values)를 그 함수의 인자로 풀어주는 얇은 래퍼뿐.
 * @returns {{dmg:number, isCrit:boolean}}
 */
function rollDummyAttack(values) {
  return rollCritHit(values.atk, values.cRate, values.cDmg);
}

/**
 * 빠른 계산용 - 크리티컬 확률/피해까지 반영한 "1초당 기댓값"(stat-calc.js의
 * computeExpectedDpsFromCrit 공용 함수를 그대로 호출하는 얇은 래퍼)
 */
function computeDummyExpectedDps(values) {
  return computeExpectedDpsFromCrit(values.atk, values.cRate, values.cDmg);
}
