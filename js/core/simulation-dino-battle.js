// 공룡 대전(내 공룡 팀 vs 상대 공룡 팀) 1:1 앞장 대결 시뮬레이션.
// 타이탄전처럼 500회 돌려서 평균내는 게 아니라, 버튼 한 번 = 실제 대전 1회를 그대로 계산해서
// "이벤트 로그" 배열로 돌려주고, UI(dino-battle-page.js)가 그 로그를 순서대로 재생하며 애니메이션함.
//
// 규칙 요약(사용자 확정):
// - 양 팀 모두 타일 위에 자신의 공룡 수만큼 전부 올라와 있음(전부 풀피로 시작) -> 메테오 같은 광역
//   효과는 대기 중인 공룡까지 전부 맞음.
// - 실제로 서로 때리는 건 각 팀의 "앞장"(맨 위) 공룡끼리 1:1. 앞장이 죽으면 다음 공룡이 앞장이 됨.
// - 선공권(사용자 확정, decideInitiative 참고): 이동속도가 더 높은 쪽 -> 같으면 레벨이 더 높은
//   쪽 -> 그마저 같으면 랜덤. 앞장이 그대로 유지되는 동안은 공격권이 팀 단위로 계속 번갈아가지만
//   (내 공격 1회 -> 상대 공격 1회 -> ...), 앞장이 바뀔 때(누군가 죽어서 새 앞장이 나올 때)마다
//   이 순서로 다시 판정함. 단, 한쪽이 상대를 "단독으로"(자기 쪽은 안 죽고) 처치했다면 그 처치
//   보너스로 다음 매치업 1회는 이속/레벨과 무관하게 처치한 쪽이 그대로 선공을 유지함. 양쪽 앞장이
//   동시에 바뀌는 경우(100회 교환 무승부, 또는 "죽을 준비" 반격으로 우연히 같이 죽는 경우)는
//   "누가 죽였다"라고 할 수 없으니 처치 보너스 없이 다시 이속->레벨->랜덤으로 판정함.
// - 타이탄전에 부적합한 룬(보스/건축물 전용)과는 다른 기준으로 DINO_BATTLE_UNSUITABLE_RUNE_LIST에
//   있는 룬은 아예 효과가 없는 것으로 계산함(장착은 막지 않되 수치에 반영 안 함).

// 공격력/체력 버프 타워: Lv0~Lv14, 레벨이 오를수록 2%에서 15%까지 증가(전 구간이 1%p 단위는
// 아니고 초반 0.5%p 구간이 있음 - 사용자 확인값). tileCfg에 진영별로 레벨(정수, 미설치는 null)이
// 들어오고, 아래 배열의 인덱스가 곧 레벨.
const BUFF_TOWER_PERCENTS = [2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// mulberry32: 작고 빠른 시드 기반 PRNG. 친구와 함께 실시간으로 같은 전투를 볼 때, 서버 왕복 없이
// "같은 시드 + 같은 입력이면 양쪽 클라이언트가 완전히 동일한 이벤트 로그를 계산해낸다"를 보장하기
// 위한 용도(js/core/friend-session.js 등에서 라운드마다 새 시드를 만들어 runDinoBattleSimulation에 넘김).
function makeSeededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 레벨 = 기본 공격력 + (기본 체력/10) + 이동속도 (룬 등으로 증폭되지 않은 순수 기본 스탯 기준).
// js/pages/my-dino-page.js의 updateSummary()에 쓰이는 계산식과 동일(요약 카드에 보이는 "레벨" 수치)
function levelOf(inputs) {
  return inputs.baseAtk + Math.floor(inputs.baseHp / 10) + inputs.moveSpeed;
}

// 선공권 판정(사용자 확정): 이동속도 -> 레벨 -> 랜덤 순. my/opp는 baseAtk/baseHp/moveSpeed를 담은
// 원본 입력 객체(런타임 내내 안 바뀌는 순수 기본 스탯이라 myLevel/oppLevel은 호출부에서 한 번만
// 계산해 넘기면 됨). rand를 안 넘기면 Math.random 사용(quick-calc처럼 시드가 없는 호출부용).
function decideInitiative(my, opp, myLevel, oppLevel, rand = Math.random) {
  if (my.moveSpeed !== opp.moveSpeed) return my.moveSpeed > opp.moveSpeed ? "my" : "opp";
  if (myLevel !== oppLevel) return myLevel > oppLevel ? "my" : "opp";
  return rand() < 0.5 ? "my" : "opp";
}

// unsuitableList: 이 계산 컨텍스트(공룡 대전/아레나 등)에서 부적합한 룬 목록 - 장착은 막지 않되
// 수치에 반영 안 함(호출부마다 기준이 달라서 파라미터로 받음, 공룡 대전은 DINO_BATTLE_UNSUITABLE_
// RUNE_LIST, 아레나는 js/pages/arena-page.js가 쓰는 ARENA_UNSUITABLE_RUNE_LIST)
function buildDinoSideRunes(selectedRunes, unsuitableList) {
  return (selectedRunes || [])
    .filter((r) => r !== null && !unsuitableList.includes(r.name))
    .map((r) => ({ ...r, s: RUNES_DATA[r.name].levels[r.lv] }));
}

// 흡혈 기준 공격력(VAMP_EXCLUSION_LIST 적용된 별도 바구니)은 인원수 조건에 안 흔들려서 한 번만 계산
function computeVampBaseAtk(baseAtk, runes, constellation, bonusPercent) {
  let atkF = constellation.atk || 0, atkP = bonusPercent.atk || 0;
  runes.forEach((r) => {
    if (VAMP_EXCLUSION_LIST.includes(r.name)) return;
    if (r.s.atk_f) atkF += r.s.atk_f;
    if (r.s.atk_p) atkP += r.s.atk_p;
  });
  return (baseAtk + atkF) * (1 + atkP / 100);
}

// 매 턴 다시 계산해야 하는 값들(인원수 조건부 룬, 타일 조건부 룬, 치확/치피 등)
function computeSideCombatValues(side, aliveCount, tileCfg) {
  let atkF = side.constellation.atk || 0, atkP = side.bonusPercent.atk || 0;
  let hpF = side.constellation.hp || 0, hpP = side.bonusPercent.hp || 0;
  let cRate = 3 + (side.constellation.critRate || 0);
  let cDmg = 105 + (side.constellation.critDmg || 0);

  const atkTowerLv = tileCfg[`${side.key}AtkTowerLevel`];
  if (atkTowerLv !== null && atkTowerLv !== undefined) atkP += BUFF_TOWER_PERCENTS[atkTowerLv];
  const hpTowerLv = tileCfg[`${side.key}HpTowerLevel`];
  if (hpTowerLv !== null && hpTowerLv !== undefined) hpP += BUFF_TOWER_PERCENTS[hpTowerLv];

  side.runes.forEach((r) => {
    if (r.name === "마지막 선물") return; // 상시 스탯 아님(사망 시 임시 버프로 별도 처리)
    if (r.name === "자연의 포옹" && !tileCfg.natureAdjacent) return;
    if ((r.name === "부족의 축복 1" || r.name === "부족의 축복 2") && tileCfg.tribeControl !== side.key) return;

    const active = r.name === "협동 공격" ? aliveCount >= 5 : r.name === "고독한 분노" ? aliveCount === 1 : true;
    if (active) {
      if (r.s.atk_f) atkF += r.s.atk_f;
      if (r.s.atk_p) atkP += r.s.atk_p;
      if (r.s.hp_f) hpF += r.s.hp_f;
      if (r.s.hp_p) hpP += r.s.hp_p;
    }
    if (r.name === "치명타 확률") cRate += r.s.prob;
    if (r.name === "치명타 피해") cDmg += r.s.crit_d;
  });

  return {
    atk: (side.baseAtk + atkF) * (1 + atkP / 100),
    maxHp: (side.baseHp + hpF) * (1 + hpP / 100),
    cRate, cDmg
  };
}

function makeDinoSide(inputs, key, tileCfg) {
  const side = {
    key,
    baseAtk: inputs.baseAtk,
    baseHp: inputs.baseHp,
    constellation: inputs.constellation,
    bonusPercent: inputs.bonusPercent,
    runes: buildDinoSideRunes(inputs.selectedRunes, DINO_BATTLE_UNSUITABLE_RUNE_LIST),
    count: inputs.count
  };
  side.vampBaseAtk = computeVampBaseAtk(side.baseAtk, side.runes, side.constellation, side.bonusPercent);

  const initVals = computeSideCombatValues(side, side.count, tileCfg);
  side.dinos = [];
  for (let i = 0; i < side.count; i++) {
    side.dinos.push({
      hp: initVals.maxHp, maxHp: initVals.maxHp,
      giftAtk: 0, giftSteps: 0,           // 마지막 선물로 받은 임시 공격력 버프
      warCryAtkP: 0, warCrySteps: 0,      // 승리의 함성으로 받은 임시 공격력% 버프
      shieldSteps: shieldTurnOf(side), attackCount: 0
    });
  }
  return side;
}

function shieldTurnOf(side) {
  const shieldRune = side.runes.find((r) => r.name === "보호막");
  return shieldRune ? shieldRune.s.turn : 0;
}

function aliveDinos(side) {
  return side.dinos.filter((d) => d.hp > 0);
}

// seed가 주어지면(친구 세션의 "이번 라운드" 시드) 그 시드로 고정된 PRNG를 쓰고, 없으면(빠른 계산이
// 아닌 로컬 "실전 대전"처럼 매번 다른 결과가 나와야 하는 기존 호출부) 그대로 Math.random을 씀
function runDinoBattleSimulation({ my, opp, tileSettings, seed, collectLog = true }) {
  const rand = seed !== undefined && seed !== null ? makeSeededRng(seed) : Math.random;
  const tileCfg = tileSettings || { natureAdjacent: false, tribeControl: "none" };

  const mySide = makeDinoSide(my, "my", tileCfg);
  const oppSide = makeDinoSide(opp, "opp", tileCfg);

  const events = [];
  let turn = 0;
  const MAX_TURNS = 3000;
  // 방어력/힐이 지나치게 강해 서로 못 죽이는 무한 교착을 막기 위한 실제 게임 규칙: 같은 앞장 쌍이
  // 평타를 각자 100번씩(총 200회) 주고받으면 남은 체력과 무관하게 양쪽이 동시사망. 앞장이 바뀌면
  // (둘 중 하나라도 죽으면) 0부터 다시 셈.
  const MUTUAL_KILL_EXCHANGES = 200;
  let pairExchangeCount = 0;

  const myLevel = levelOf(my);
  const oppLevel = levelOf(opp);
  let attackerKey = decideInitiative(my, opp, myLevel, oppLevel, rand);
  // 앞장이 바뀔 때(새 매치업이 생길 때)마다 선공권을 재판정하기 위해, 지금 싸우고 있는 앞장
  // 공룡 인스턴스를 기억해뒀다가 매 턴 끝에 바뀌었는지 비교함(makeDinoSide가 만든 dinos 배열의
  // 첫 원소 = 전투 시작 시점의 앞장)
  let pairingFrontMy = mySide.dinos[0];
  let pairingFrontOpp = oppSide.dinos[0];

  while (turn < MAX_TURNS) {
    const attackerSide = attackerKey === "my" ? mySide : oppSide;
    const defenderSide = attackerKey === "my" ? oppSide : mySide;
    const defenderKey = attackerKey === "my" ? "opp" : "my";
    // 대기 공룡을 같은 타일에 모아둘지, 다른 타일에 따로 둘지는 "방어측"(맞는 쪽) 자신의 배치
    // 설정을 따름(메테오 광역/희생/마지막 선물이 방어측의 대기 공룡에게도 적용되는지를 가름)
    const sameTile = (defenderKey === "my" ? tileCfg.myTileArrangement : tileCfg.oppTileArrangement) !== "separate";

    const attackerAliveCount = aliveDinos(attackerSide).length;
    const defenderAliveCount = aliveDinos(defenderSide).length;
    if (attackerAliveCount === 0 || defenderAliveCount === 0) break;

    const attackerVals = computeSideCombatValues(attackerSide, attackerAliveCount, tileCfg);
    const defenderVals = computeSideCombatValues(defenderSide, defenderAliveCount, tileCfg);

    // 협동 공격/고독한 분노 등으로 최대 체력이 바뀔 수 있음 - 게임사 공식 답변 확인: 조건을
    // 잃어도 즉사하거나 현재 체력이 그대로 유지되는 게 아니라 "감소 전 최대 체력 대비 남은
    // 체력의 비율"로 재조정됨(체력 %가 유지되고 절대값만 같이 변함) - 최대치를 넘을 때만
    // 깎던 예전 clamp 방식과 다름. stat-calc.js의 rescaleOneUnitHp 공용 함수 사용(전투 수식
    // 공용화 작업)
    [{ side: mySide, vals: attackerKey === "my" ? attackerVals : defenderVals },
      { side: oppSide, vals: attackerKey === "my" ? defenderVals : attackerVals }]
      .forEach(({ side, vals }) => {
        aliveDinos(side).forEach((d) => rescaleOneUnitHp(d, vals.maxHp));
      });

    const attacker = aliveDinos(attackerSide)[0];
    const defender = aliveDinos(defenderSide)[0];
    if (!attacker || !defender) break;

    turn++;
    attacker.attackCount++;
    pairExchangeCount++;

    const event = {
      turn,
      attackerSide: attackerKey,
      defenderSide: defenderKey,
      hits: [],   // { label, dmg, isCrit, targetSide }
      heals: [],  // { side, amount, cause }
      aoe: null,  // { label, isCrit, targets: [{ index, before, after }] }
      deaths: [], // { side }
      spawn: null // { side } - 이번 턴에 새 앞장이 등장했는지
    };

    function hitDefender(rawDmg, isCrit, label) {
      let dmg = rawDmg;
      if (defender.shieldSteps > 0) {
        const shieldRune = defenderSide.runes.find((r) => r.name === "보호막");
        if (shieldRune) dmg *= (1 - shieldRune.s.red_p / 100);
        defender.shieldSteps--;
      }
      // 단단한 피부/피해 저항은 "평타"만 감소시킴 - 트리플 임팩트/낙뢰/메테오 같은 스킬로 인한
      // 추가 피해에는 적용되지 않음(사용자 확인). 보호막은 스킬 포함 전부 감소.
      if (label === "평타") {
        defenderSide.runes.forEach((r) => {
          if (r.name.includes("단단한 피부")) dmg -= r.s.red_f;
          if (r.name.includes("피해 저항") && rand() * 100 < r.s.prob) dmg -= r.s.red_f;
        });
      }
      dmg = Math.max(0, dmg);
      defender.hp = Math.max(0, defender.hp - dmg);
      event.hits.push({ label, dmg, isCrit, targetSide: defenderKey, hpAfter: defender.hp });
      return dmg;
    }

    // 힐: 맞기 직전에 방어측 확률 발동
    defenderSide.runes.forEach((r) => {
      if (r.name === "힐" && rand() * 100 < r.s.prob) {
        const before = defender.hp;
        defender.hp = Math.min(defender.maxHp, defender.hp + (defender.maxHp * r.s.rec_p) / 100);
        if (defender.hp > before) event.heals.push({ side: defenderKey, amount: defender.hp - before, cause: "힐" });
      }
    });

    // 평타 (마지막 선물의 giftAtk는 고정치 가산, 승리의 함성의 warCryAtkP는 % 가산이라 그 다음에 곱함)
    const finalAtk = (attackerVals.atk + attacker.giftAtk) * (1 + attacker.warCryAtkP / 100);
    const basicHit = rollCritHit(finalAtk, attackerVals.cRate, attackerVals.cDmg, rand);
    hitDefender(basicHit.dmg, basicHit.isCrit, "평타");

    // 공격측 스킬 룬들
    attackerSide.runes.forEach((r) => {
      if (defender.hp <= 0) return;
      if (r.name === "트리플 임팩트" && attacker.attackCount % 3 === 0) {
        const tripleHit = rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg, rand);
        hitDefender(tripleHit.dmg, tripleHit.isCrit, "트리플 임팩트");
      }
      // 낙뢰: 룬 설명대로 "전투중인 상대 유닛"만 맞는 단일 대상 스킬 (21+ 즉사 확률 포함)
      if (r.name === "낙뢰" && rand() * 100 < r.s.prob) {
        const lightningHit = rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg, rand);
        hitDefender(lightningHit.dmg, lightningHit.isCrit, r.name);
        if (r.s.insta_hp !== undefined && defender.hp > 0) {
          const hpPct = (defender.hp / defender.maxHp) * 100;
          if (hpPct < r.s.insta_hp && rand() * 100 < r.s.insta_prob) {
            defender.hp = 0;
            event.hits.push({ label: "낙뢰(즉사)", dmg: 0, isCrit: false, targetSide: defenderKey, hpAfter: 0, insta: true });
          }
        }
      }
      // 메테오: 룬 설명대로 "현재 타일에 있는 모든 적"이 레벨과 무관하게 항상 맞음(대기 중인 공룡 포함).
      // 단, "대기 공룡 배치"를 다른 타일로 설정했다면 대기 중인 공룡은 물리적으로 이 타일에 없는 것이라
      // 앞장(defender)만 맞음 - 대신 21레벨부터 붙는 area_burst_p(주변 타일 추가 피해, js/data/
      // rune-data.js에 이미 정의돼 있었지만 이 엔진엔 미구현이었음)로 그 대기 공룡들에게 별도의
      // (더 약한) 피해를 추가로 줌 - 이제 육각 타일맵이 실제로 있어서(대기 육각형이 전투 타일과
      // 진짜로 인접한 "주변 타일") 그 대기 공룡들이 정확히 이 효과의 대상이 됨. "한 타일" 배치라
      // sameTile===true면 대기가 이미 위 분기에서 메인 피해를 다 받았으므로(타일 개념이 없어져서
      // "주변 타일"도 없음) 이 추가 피해는 적용 안 함.
      if (r.name === "메테오" && rand() * 100 < r.s.prob) {
        if (sameTile) {
          // 광역기라 여러 마리가 한 번에 맞지만, 크리티컬은 맞는 공룡마다 독립적으로 판정됨(한
          // 마리가 크리 떴다고 나머지도 전부 크리 대미지를 받으면 안 됨). 스킬 피해라 단단한
          // 피부/피해 저항 같은 감소 룬도 적용 안 함(평타에만 적용되는 룬).
          const targets = [];
          defenderSide.dinos.forEach((d, idx) => {
            if (d.hp <= 0) return;
            const meteorAoeHit = rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg, rand);
            const dmg = Math.max(0, meteorAoeHit.dmg);
            const before = d.hp;
            d.hp = Math.max(0, d.hp - dmg);
            targets.push({ index: idx, before, after: d.hp, isFront: d === defender, isCrit: meteorAoeHit.isCrit });
          });
          event.aoe = { label: "메테오(광역)", isCrit: targets.some((t) => t.isCrit), targets };
        } else {
          const meteorHit = rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg, rand);
          hitDefender(meteorHit.dmg, meteorHit.isCrit, "메테오");
          if (r.s.area_burst_p !== undefined) {
            const areaTargets = [];
            defenderSide.dinos.forEach((d, idx) => {
              if (d === defender || d.hp <= 0) return;
              const meteorAreaHit = rollCritHit(finalAtk * (r.s.area_burst_p / 100), attackerVals.cRate, attackerVals.cDmg, rand);
              const dmg = Math.max(0, meteorAreaHit.dmg);
              const before = d.hp;
              d.hp = Math.max(0, d.hp - dmg);
              areaTargets.push({ index: idx, before, after: d.hp, isFront: false, isCrit: meteorAreaHit.isCrit });
            });
            if (areaTargets.length > 0) {
              event.aoe = { label: "메테오(주변 타일)", isCrit: areaTargets.some((t) => t.isCrit), targets: areaTargets };
            }
          }
        }
      }
      if (r.name === "흡혈" && rand() * 100 < r.s.prob) {
        const before = attacker.hp;
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + (attackerSide.vampBaseAtk * r.s.rec_p) / 100);
        if (attacker.hp > before) event.heals.push({ side: attackerKey, amount: attacker.hp - before, cause: "흡혈" });
      }
    });

    // 앞장 사망 처리(평타/스킬/광역까지 다 반영된 최종 hp 기준). dyingSide/dyingKey가 죽는 쪽,
    // otherDino/otherKey가 반대쪽 - 100회 교환 동시사망 때는 양쪽에 대해 이 함수를 각각 한 번씩 호출함
    function processFrontDeath(dyingDino, dyingSide, dyingKey, dyingVals, otherDino, otherKey) {
      event.deaths.push({ side: dyingKey });
      const stillAlive = dyingSide.dinos.filter((d) => d !== dyingDino && d.hp > 0);
      dyingSide.runes.forEach((r) => {
        // 희생/마지막 선물은 죽은 공룡 주변의 "같은 타일" 아군에게 적용되는 효과라, 대기 공룡을
        // 다른 타일에 뒀다면(sameTile === false) 발동하지 않음
        if (r.name === "희생" && sameTile && rand() * 100 < r.s.prob) {
          stillAlive.forEach((target) => {
            const before = target.hp;
            target.hp = Math.min(target.maxHp, target.hp + (target.maxHp * r.s.rec_p) / 100);
            if (target.hp > before) event.heals.push({ side: dyingKey, amount: target.hp - before, cause: "희생" });
          });
        }
        if (r.name === "죽을 준비" && rand() * 100 < r.s.prob) {
          const burst = (dyingVals.atk * r.s.burst_p) / 100;
          otherDino.hp = Math.max(0, otherDino.hp - burst);
          event.hits.push({ label: "죽을 준비", dmg: burst, isCrit: false, targetSide: otherKey, hpAfter: otherDino.hp });
        }
        if (r.name === "마지막 선물" && sameTile && rand() * 100 < r.s.prob && stillAlive.length > 0) {
          stillAlive.forEach((target) => { target.giftAtk += r.s.atk_f; target.giftSteps = r.s.turn; });
          event.heals.push({ side: dyingKey, amount: 0, cause: "마지막 선물" });
        }
      });
      const idx = dyingSide.dinos.indexOf(dyingDino);
      if (idx !== -1) dyingSide.dinos.splice(idx, 1);
      if (stillAlive.length > 0) event.spawn = { side: dyingKey };
    }

    if (defender.hp <= 0) {
      processFrontDeath(defender, defenderSide, defenderKey, defenderVals, attacker, attackerKey);
      // 승리의 함성: 적을 처치한 공격자 본인에게 공격력% 버프(강제 동시사망은 "처치"가 아니라
      // 무승부 교환이라 여기 자연사 분기에서만 발동함)
      attackerSide.runes.forEach((r) => {
        if (r.name === "승리의 함성") {
          attacker.warCryAtkP = r.s.atk_p;
          attacker.warCrySteps = r.s.turn;
        }
      });
    }

    // 100회 교환(각자 100번씩) 동안 서로 못 죽였으면 실제 게임 규칙대로 남은 체력과 무관하게
    // 양쪽 앞장이 동시사망(무한 교착 방지). 이번 턴에 이미 자연사한 경우는 건드리지 않음
    if (attacker.hp > 0 && defender.hp > 0 && pairExchangeCount >= MUTUAL_KILL_EXCHANGES) {
      event.mutualKill = true;
      defender.hp = 0;
      attacker.hp = 0;
      processFrontDeath(defender, defenderSide, defenderKey, defenderVals, attacker, attackerKey);
      processFrontDeath(attacker, attackerSide, attackerKey, attackerVals, defender, defenderKey);
    }

    if (defender.hp <= 0 || attacker.hp <= 0) pairExchangeCount = 0;

    if (attacker.giftSteps > 0 && --attacker.giftSteps === 0) attacker.giftAtk = 0;
    if (attacker.warCrySteps > 0 && --attacker.warCrySteps === 0) attacker.warCryAtkP = 0;

    // UI가 매번 시뮬레이션 상태를 다시 훑지 않아도 재생만으로 그릴 수 있도록 이번 턴 종료 시점의
    // 스냅샷(생존 수, 앞장 체력/최대체력)을 이벤트에 그대로 실어둠
    event.myAliveCount = aliveDinos(mySide).length;
    event.oppAliveCount = aliveDinos(oppSide).length;
    // collectLog:false(조합 찾기 등 반복 호출용)면 매 턴 배열 복제(myDinos/oppDinos)와 화면
    // 표시 전용 필드를 건너뛰어서, 수천 회 반복 시 events 배열이 통째로 쌓이며 생기는 메모리/GC
    // 비용을 없앰 - winner/turns 판정에 쓰이는 myFrontNow/oppFrontNow는 로그 여부와 무관하게 계속
    // 계산함(아래 선공권 재판정에 필요)
    if (collectLog) {
      event.myDinos = mySide.dinos.map((d) => ({ hp: d.hp, maxHp: d.maxHp }));
      event.oppDinos = oppSide.dinos.map((d) => ({ hp: d.hp, maxHp: d.maxHp }));
    }
    const myFrontNow = aliveDinos(mySide)[0];
    const oppFrontNow = aliveDinos(oppSide)[0];
    if (collectLog) {
      event.myFrontHp = myFrontNow ? myFrontNow.hp : 0;
      event.myFrontMaxHp = myFrontNow ? myFrontNow.maxHp : (attackerKey === "my" ? attackerVals.maxHp : defenderVals.maxHp);
      event.oppFrontHp = oppFrontNow ? oppFrontNow.hp : 0;
      event.oppFrontMaxHp = oppFrontNow ? oppFrontNow.maxHp : (attackerKey === "opp" ? attackerVals.maxHp : defenderVals.maxHp);
      events.push(event);
    }

    if (aliveDinos(mySide).length === 0 || aliveDinos(oppSide).length === 0) break;

    // 선공권 재판정: 앞장이 그대로면(둘 다 안 바뀜) 지금처럼 단순 교대. 딱 한쪽만 바뀌었다면
    // 상대를 "단독으로" 처치한 것이므로 attackerKey를 그대로 둬서(원래는 defenderKey로 넘어갔어야
    // 할 차례를) 처치한 쪽이 다음 매치업도 그대로 선공 유지. 양쪽이 동시에 바뀌었다면(100회 교환
    // 무승부든 "죽을 준비" 반격으로 우연히 같이 죽었든) "누가 죽였다"라고 할 수 없으니 처치
    // 보너스 없이 이속->레벨->랜덤으로 다시 판정.
    const myChanged = myFrontNow !== pairingFrontMy;
    const oppChanged = oppFrontNow !== pairingFrontOpp;
    if (myChanged && oppChanged) {
      attackerKey = decideInitiative(my, opp, myLevel, oppLevel, rand);
    } else if (!myChanged && !oppChanged) {
      attackerKey = defenderKey;
    }
    pairingFrontMy = myFrontNow;
    pairingFrontOpp = oppFrontNow;
  }

  const myAlive = aliveDinos(mySide).length > 0;
  const oppAlive = aliveDinos(oppSide).length > 0;
  const winner = myAlive && !oppAlive ? "my" : (oppAlive && !myAlive ? "opp" : "draw");

  return { events, winner, turns: turn, myFinalCount: aliveDinos(mySide).length, oppFinalCount: aliveDinos(oppSide).length };
}

// "빠른 계산" 모드: 대기 공룡 개념 없이 딱 1마리씩 맞붙어서, 죽으면 그 자리에서 즉시 풀피로
// 부활시키며 계속 싸움(타이탄전의 이동시간 있는 재소환과 달리 지연 없음). 이걸 totalDeaths번
// 죽을 때까지 반복해서 평균 교환비/데미지를 뽑음. 애니메이션이 없어서 이벤트 로그 없이 동기로
// 한 번에 계산해서 집계 결과만 돌려줌.
function runDinoQuickCalc({ my, opp, tileSettings, totalDeaths = 500 }) {
  const tileCfg = tileSettings || { natureAdjacent: false, tribeControl: "none" };

  const mySide = makeDinoSide({ ...my, count: 1 }, "my", tileCfg);
  const oppSide = makeDinoSide({ ...opp, count: 1 }, "opp", tileCfg);

  const myLevel = levelOf(my);
  const oppLevel = levelOf(opp);
  let attackerKey = decideInitiative(my, opp, myLevel, oppLevel);

  let myKills = 0, oppKills = 0;
  let myDmgDealt = 0, oppDmgDealt = 0;
  // "평균 대미지" = 평타/크리티컬/스킬/스킬 크리티컬/죽을 준비 반격까지 이 진영이 입힌 모든 개별
  // 타격을 다 합쳐서(킬 여부와 무관하게) 타격 횟수로 나눈 값. 킬당 평균이 아니라 "한 번 때릴 때
  // 평균적으로 얼마나 들어가는지"라 상대 체력/맷집에 안 휘둘리고 순수하게 이 진영의 화력을 보여줌
  let myHitCount = 0, oppHitCount = 0;
  let deaths = 0;
  let turn = 0;
  const MAX_TURNS = 200000; // 방어 스탯이 극단적으로 쌓여 죽지 않는 경우를 대비한 안전판
  // runDinoBattleSimulation과 동일한 100회 교환(각자 100번씩) 동시사망 규칙
  const MUTUAL_KILL_EXCHANGES = 200;
  let pairExchangeCount = 0;

  while (deaths < totalDeaths && turn < MAX_TURNS) {
    turn++;
    pairExchangeCount++;
    const attackerSide = attackerKey === "my" ? mySide : oppSide;
    const defenderSide = attackerKey === "my" ? oppSide : mySide;
    const defenderKey = attackerKey === "my" ? "opp" : "my";
    const attacker = attackerSide.dinos[0];
    const defender = defenderSide.dinos[0];

    const attackerVals = computeSideCombatValues(attackerSide, 1, tileCfg);
    const defenderVals = computeSideCombatValues(defenderSide, 1, tileCfg);
    attacker.maxHp = attackerVals.maxHp;
    defender.maxHp = defenderVals.maxHp;
    if (attacker.hp > attacker.maxHp) attacker.hp = attacker.maxHp;
    if (defender.hp > defender.maxHp) defender.hp = defender.maxHp;

    attacker.attackCount++;

    let dealt = 0;

    // isSkill: 트리플 임팩트/낙뢰/메테오 등 스킬 피해는 단단한 피부/피해 저항의 감소를 받지 않음
    // (해당 룬은 평타만 감소시킴 - 사용자 확인)
    function hitDefender(rawDmg, isSkill) {
      let dmg = rawDmg;
      if (defender.shieldSteps > 0) {
        const shieldRune = defenderSide.runes.find((r) => r.name === "보호막");
        if (shieldRune) dmg *= (1 - shieldRune.s.red_p / 100);
        defender.shieldSteps--;
      }
      if (!isSkill) {
        defenderSide.runes.forEach((r) => {
          if (r.name.includes("단단한 피부")) dmg -= r.s.red_f;
          if (r.name.includes("피해 저항") && Math.random() * 100 < r.s.prob) dmg -= r.s.red_f;
        });
      }
      dmg = Math.max(0, dmg);
      defender.hp = Math.max(0, defender.hp - dmg);
      dealt += dmg;
      if (attackerKey === "my") myHitCount++; else oppHitCount++;
    }

    // 힐: 맞기 직전에 방어측 확률 발동
    defenderSide.runes.forEach((r) => {
      if (r.name === "힐" && Math.random() * 100 < r.s.prob) {
        defender.hp = Math.min(defender.maxHp, defender.hp + (defender.maxHp * r.s.rec_p) / 100);
      }
    });

    // 평타 (마지막 선물의 giftAtk는 고정치 가산, 승리의 함성의 warCryAtkP는 % 가산이라 그 다음에 곱함)
    const finalAtk = (attackerVals.atk + attacker.giftAtk) * (1 + attacker.warCryAtkP / 100);
    hitDefender(rollCritHit(finalAtk, attackerVals.cRate, attackerVals.cDmg).dmg);

    // 공격측 스킬 룬들 (1마리뿐이라 메테오의 "타일 전체" 피해도 사실상 이 상대 한 명에게만 적용됨)
    attackerSide.runes.forEach((r) => {
      if (defender.hp <= 0) return;
      if (r.name === "트리플 임팩트" && attacker.attackCount % 3 === 0) {
        hitDefender(rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg).dmg, true);
      }
      if (r.name === "낙뢰" && Math.random() * 100 < r.s.prob) {
        hitDefender(rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg).dmg, true);
        if (r.s.insta_hp !== undefined && defender.hp > 0) {
          const hpPct = (defender.hp / defender.maxHp) * 100;
          if (hpPct < r.s.insta_hp && Math.random() * 100 < r.s.insta_prob) defender.hp = 0;
        }
      }
      if (r.name === "메테오" && Math.random() * 100 < r.s.prob) {
        hitDefender(rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg).dmg, true);
      }
      if (r.name === "흡혈" && Math.random() * 100 < r.s.prob) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + (attackerSide.vampBaseAtk * r.s.rec_p) / 100);
      }
    });

    if (attackerKey === "my") myDmgDealt += dealt; else oppDmgDealt += dealt;
    if (attacker.giftSteps > 0 && --attacker.giftSteps === 0) attacker.giftAtk = 0;
    if (attacker.warCrySteps > 0 && --attacker.warCrySteps === 0) attacker.warCryAtkP = 0;

    let diedThisTurn = false;
    // bothDied: 이번 턴에 양쪽이 다 죽었는지("죽을 준비" 반격으로 우연히 같이 죽거나, 100회
    // 교환 무승부) - 이 경우엔 "누가 죽였다"라고 할 수 없어 선공권 처치 보너스를 안 줌
    let bothDied = false;
    if (defender.hp <= 0) {
      diedThisTurn = true;
      deaths++;
      if (attackerKey === "my") myKills++; else oppKills++;
      // 승리의 함성: 처치한 공격자 본인에게 공격력% 버프
      attackerSide.runes.forEach((r) => {
        if (r.name === "승리의 함성") {
          attacker.warCryAtkP = r.s.atk_p;
          attacker.warCrySteps = r.s.turn;
        }
      });
      // 죽을 준비: 죽는 쪽(defender) 본인의 룬 - 자신을 처치한 상대(attacker)에게 반격.
      // 이 피해는 defenderSide가 입힌 타격이라 "평균 대미지" 집계도 defenderSide 쪽에 더함
      defenderSide.runes.forEach((r) => {
        if (r.name === "죽을 준비" && Math.random() * 100 < r.s.prob) {
          const burst = (defenderVals.atk * r.s.burst_p) / 100;
          attacker.hp = Math.max(0, attacker.hp - burst);
          if (attackerKey === "my") { oppDmgDealt += burst; oppHitCount++; } else { myDmgDealt += burst; myHitCount++; }
        }
      });
      if (attacker.hp <= 0) bothDied = true;
      // 대기 공룡이 없는 단순화 모드라 죽는 즉시 그 자리에서 풀피로 부활(이동/딜레이 없음)
      defender.hp = defender.maxHp;
      defender.giftAtk = 0;
      defender.giftSteps = 0;
      defender.warCryAtkP = 0;
      defender.warCrySteps = 0;
      defender.attackCount = 0;
      defender.shieldSteps = shieldTurnOf(defenderSide);
    }

    // 100회 교환 동안 서로 못 죽였으면 동시사망 - 무승부 교환이라 양쪽 다 1킬씩 잡힘(어느 한쪽에
    // 유리하게 치우치지 않도록, 승리의 함성도 발동 안 함 - "처치"가 아니라 무승부 교환이라)
    if (!diedThisTurn && pairExchangeCount >= MUTUAL_KILL_EXCHANGES) {
      diedThisTurn = true;
      bothDied = true;
      deaths += 2;
      myKills++;
      oppKills++;
      defender.hp = defender.maxHp;
      defender.giftAtk = 0;
      defender.giftSteps = 0;
      defender.warCryAtkP = 0;
      defender.warCrySteps = 0;
      defender.attackCount = 0;
      defender.shieldSteps = shieldTurnOf(defenderSide);
      attacker.hp = attacker.maxHp;
      attacker.giftAtk = 0;
      attacker.giftSteps = 0;
      attacker.warCryAtkP = 0;
      attacker.warCrySteps = 0;
      attacker.attackCount = 0;
      attacker.shieldSteps = shieldTurnOf(attackerSide);
    }

    if (diedThisTurn) pairExchangeCount = 0;

    // 선공권 재판정: 아무도 안 죽었으면(앞장 그대로) 단순 교대. 양쪽이 같이 죽었으면(무승부 교환/
    // 우연한 동시사망) 처치 보너스 없이 이속->레벨->랜덤으로 재판정. 한쪽만 죽었으면(단독 처치)
    // attackerKey를 그대로 둬서 처치한 쪽이 다음 매치업도 선공 유지.
    if (bothDied) {
      attackerKey = decideInitiative(my, opp, myLevel, oppLevel);
    } else if (!diedThisTurn) {
      attackerKey = defenderKey;
    }
  }

  return {
    trials: deaths,
    myKills,
    oppKills,
    // 평타/크리티컬/스킬/스킬 크리티컬/죽을 준비 반격까지 다 포함해서 "타격 한 번당 평균 대미지"
    // (킬 여부와 무관 - 상대 체력에 안 휘둘리고 이 진영 자체의 화력을 보여줌)
    avgMyDmgPerHit: myHitCount > 0 ? myDmgDealt / myHitCount : 0,
    avgOppDmgPerHit: oppHitCount > 0 ? oppDmgDealt / oppHitCount : 0,
    myDmgDealt,
    oppDmgDealt
  };
}

// 공룡 대전 "조합 찾기"(js/pages/dino-battle-page.js)용 반복 시행 래퍼. runDinoBattleSimulation은
// "버튼 한 번 = 실전 대전 1회"를 그대로 계산하는 동기 함수라 그 자체엔 반복/배치 개념이 없음
// (runTitanSimulation과 다른 점) - collectLog:false로 이벤트 로그 생성을 생략해 반복 호출 비용을
// 줄이고, batchSize 시행마다 한 번씩 setTimeout(0)으로 양보해 브라우저가 안 멈추게 함. 시드를
// 안 주므로(Math.random) 매 시행이 독립적인 실제 확률 분포를 따름 - "빠른 계산"처럼 재현 가능성이
// 필요 없는 통계 집계 용도.
async function runDinoBattleTrials({ my, opp, tileSettings, trials, batchSize = 20 }) {
  let myWins = 0, oppWins = 0, draws = 0, totalTurns = 0, myTotalLosses = 0, oppTotalLosses = 0;
  let completed = 0;
  while (completed < trials) {
    const end = Math.min(completed + batchSize, trials);
    for (let i = completed; i < end; i++) {
      const result = runDinoBattleSimulation({ my, opp, tileSettings, collectLog: false });
      if (result.winner === "my") myWins++;
      else if (result.winner === "opp") oppWins++;
      else draws++;
      totalTurns += result.turns;
      myTotalLosses += my.count - result.myFinalCount;
      oppTotalLosses += opp.count - result.oppFinalCount;
    }
    completed = end;
    if (completed < trials) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return {
    myWins, oppWins, draws, trials,
    winRate: myWins / trials,
    drawRate: draws / trials,
    avgTurns: totalTurns / trials,
    avgMyLosses: myTotalLosses / trials,
    avgOppLosses: oppTotalLosses / trials
  };
}
