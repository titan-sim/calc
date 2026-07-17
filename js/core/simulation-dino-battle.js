// 공룡 대전(내 공룡 팀 vs 상대 공룡 팀) 1:1 앞장 대결 시뮬레이션.
// 타이탄전처럼 500회 돌려서 평균내는 게 아니라, 버튼 한 번 = 실제 대전 1회를 그대로 계산해서
// "이벤트 로그" 배열로 돌려주고, UI(dino-battle-page.js)가 그 로그를 순서대로 재생하며 애니메이션함.
//
// 규칙 요약(사용자 확정):
// - 양 팀 모두 타일 위에 자신의 공룡 수만큼 전부 올라와 있음(전부 풀피로 시작) -> 메테오 같은 광역
//   효과는 대기 중인 공룡까지 전부 맞음.
// - 실제로 서로 때리는 건 각 팀의 "앞장"(맨 위) 공룡끼리 1:1. 앞장이 죽으면 다음 공룡이 앞장이 됨.
// - 선공은 전투 시작 시점의 종합 공격력이 더 높은 쪽. 이후로는 공격권이 팀 단위로 계속 번갈아감
//   (내 공격 1회 -> 상대 공격 1회 -> ...).
// - 타이탄전에 부적합한 룬(보스/건축물 전용)과는 다른 기준으로 DINO_BATTLE_UNSUITABLE_RUNE_LIST에
//   있는 룬은 아예 효과가 없는 것으로 계산함(장착은 막지 않되 수치에 반영 안 함).

// 레벨 = 기본 공격력 + (기본 체력/10) + 이동속도 (룬 등으로 증폭되지 않은 순수 기본 스탯 기준).
// js/pages/my-dino-page.js의 updateSummary()에 쓰이는 계산식과 동일(요약 카드에 보이는 "레벨" 수치)
function levelOf(inputs) {
  return inputs.baseAtk + Math.floor(inputs.baseHp / 10) + inputs.moveSpeed;
}

function buildDinoSideRunes(selectedRunes) {
  return (selectedRunes || [])
    .filter((r) => r !== null && !DINO_BATTLE_UNSUITABLE_RUNE_LIST.includes(r.name))
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
    runes: buildDinoSideRunes(inputs.selectedRunes),
    count: inputs.count
  };
  side.vampBaseAtk = computeVampBaseAtk(side.baseAtk, side.runes, side.constellation, side.bonusPercent);

  const initVals = computeSideCombatValues(side, side.count, tileCfg);
  side.dinos = [];
  for (let i = 0; i < side.count; i++) {
    side.dinos.push({ hp: initVals.maxHp, maxHp: initVals.maxHp, giftAtk: 0, giftSteps: 0, shieldSteps: shieldTurnOf(side), attackCount: 0 });
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

function runDinoBattleSimulation({ my, opp, tileSettings }) {
  const tileCfg = tileSettings || { natureAdjacent: false, tribeControl: "none" };

  const mySide = makeDinoSide(my, "my", tileCfg);
  const oppSide = makeDinoSide(opp, "opp", tileCfg);

  const events = [];
  let turn = 0;
  const MAX_TURNS = 3000;

  // 선공 결정: 레벨이 더 높은 쪽부터. 레벨이 같으면 전투 시작 시점(전원 생존) 종합 공격력이
  // 더 높은 쪽. 그마저 같으면 내 공룡 먼저.
  const myLevel = levelOf(my);
  const oppLevel = levelOf(opp);
  let attackerKey;
  if (myLevel !== oppLevel) {
    attackerKey = myLevel > oppLevel ? "my" : "opp";
  } else {
    const myOpen = computeSideCombatValues(mySide, mySide.count, tileCfg);
    const oppOpen = computeSideCombatValues(oppSide, oppSide.count, tileCfg);
    attackerKey = myOpen.atk >= oppOpen.atk ? "my" : "opp";
  }

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

    // 협동 공격/고독한 분노 등으로 최대 체력이 바뀔 수 있어서, 양 팀 생존 개체 전원의 체력을 매 턴
    // 새 최대치에 맞춰 clamp(초과분만 깎임, 이미 그 아래였으면 그대로 - 타이탄전과 동일한 원칙)
    [{ side: mySide, vals: attackerKey === "my" ? attackerVals : defenderVals },
      { side: oppSide, vals: attackerKey === "my" ? defenderVals : attackerVals }]
      .forEach(({ side, vals }) => {
        aliveDinos(side).forEach((d) => {
          d.maxHp = vals.maxHp;
          if (d.hp > vals.maxHp) d.hp = vals.maxHp;
        });
      });

    const attacker = aliveDinos(attackerSide)[0];
    const defender = aliveDinos(defenderSide)[0];
    if (!attacker || !defender) break;

    turn++;
    attacker.attackCount++;

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

    const rollCrit = (vals) => Math.random() * 100 < vals.cRate;
    const withCrit = (val, isCrit, vals) => (isCrit ? val * (vals.cDmg / 100) : val);

    function hitDefender(rawDmg, isCrit, label) {
      let dmg = rawDmg;
      if (defender.shieldSteps > 0) {
        const shieldRune = defenderSide.runes.find((r) => r.name === "보호막");
        if (shieldRune) dmg *= (1 - shieldRune.s.red_p / 100);
        defender.shieldSteps--;
      }
      defenderSide.runes.forEach((r) => {
        if (r.name.includes("단단한 피부")) dmg -= r.s.red_f;
        if (r.name.includes("피해 저항") && Math.random() * 100 < r.s.prob) dmg -= r.s.red_f;
      });
      dmg = Math.max(0, dmg);
      defender.hp = Math.max(0, defender.hp - dmg);
      event.hits.push({ label, dmg, isCrit, targetSide: defenderKey, hpAfter: defender.hp });
      return dmg;
    }

    // 힐: 맞기 직전에 방어측 확률 발동
    defenderSide.runes.forEach((r) => {
      if (r.name === "힐" && Math.random() * 100 < r.s.prob) {
        const before = defender.hp;
        defender.hp = Math.min(defender.maxHp, defender.hp + (defender.maxHp * r.s.rec_p) / 100);
        if (defender.hp > before) event.heals.push({ side: defenderKey, amount: defender.hp - before, cause: "힐" });
      }
    });

    // 평타
    const finalAtk = attackerVals.atk + attacker.giftAtk;
    const basicCrit = rollCrit(attackerVals);
    hitDefender(withCrit(finalAtk, basicCrit, attackerVals), basicCrit, "평타");

    // 공격측 스킬 룬들
    attackerSide.runes.forEach((r) => {
      if (defender.hp <= 0) return;
      if (r.name === "트리플 임팩트" && attacker.attackCount % 3 === 0) {
        const c = rollCrit(attackerVals);
        hitDefender(withCrit(finalAtk * (r.s.burst_p / 100), c, attackerVals), c, "트리플 임팩트");
      }
      // 낙뢰: 룬 설명대로 "전투중인 상대 유닛"만 맞는 단일 대상 스킬 (21+ 즉사 확률 포함)
      if (r.name === "낙뢰" && Math.random() * 100 < r.s.prob) {
        const c = rollCrit(attackerVals);
        hitDefender(withCrit(finalAtk * (r.s.burst_p / 100), c, attackerVals), c, r.name);
        if (r.s.insta_hp !== undefined && defender.hp > 0) {
          const hpPct = (defender.hp / defender.maxHp) * 100;
          if (hpPct < r.s.insta_hp && Math.random() * 100 < r.s.insta_prob) {
            defender.hp = 0;
            event.hits.push({ label: "낙뢰(즉사)", dmg: 0, isCrit: false, targetSide: defenderKey, hpAfter: 0, insta: true });
          }
        }
      }
      // 메테오: 룬 설명대로 "현재 타일에 있는 모든 적"이 레벨과 무관하게 항상 맞음(대기 중인 공룡 포함).
      // 단, "대기 공룡 배치"를 다른 타일로 설정했다면 대기 중인 공룡은 물리적으로 이 타일에 없는 것이라
      // 앞장(defender)만 맞음. 21레벨부터 붙는 area_burst_p(주변 타일 추가 피해)는 아직 이 엔진에는
      // 해당 개념이 없어서(향후 육각타일맵에서 구현 예정) 지금은 쓰지 않음.
      if (r.name === "메테오" && Math.random() * 100 < r.s.prob) {
        const c = rollCrit(attackerVals);
        if (sameTile) {
          const dmgRaw = withCrit(finalAtk * (r.s.burst_p / 100), c, attackerVals);
          const targets = [];
          defenderSide.dinos.forEach((d, idx) => {
            if (d.hp <= 0) return;
            let dmg = dmgRaw;
            defenderSide.runes.forEach((rr) => { if (rr.name.includes("단단한 피부")) dmg -= rr.s.red_f; });
            dmg = Math.max(0, dmg);
            const before = d.hp;
            d.hp = Math.max(0, d.hp - dmg);
            targets.push({ index: idx, before, after: d.hp, isFront: d === defender });
          });
          event.aoe = { label: "메테오(광역)", isCrit: c, targets };
        } else {
          hitDefender(withCrit(finalAtk * (r.s.burst_p / 100), c, attackerVals), c, "메테오");
        }
      }
      if (r.name === "흡혈" && Math.random() * 100 < r.s.prob) {
        const before = attacker.hp;
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + (attackerSide.vampBaseAtk * r.s.rec_p) / 100);
        if (attacker.hp > before) event.heals.push({ side: attackerKey, amount: attacker.hp - before, cause: "흡혈" });
      }
    });

    // 앞장 사망 처리(평타/스킬/광역까지 다 반영된 최종 hp 기준)
    if (defender.hp <= 0) {
      event.deaths.push({ side: defenderKey });
      const stillAlive = defenderSide.dinos.filter((d) => d !== defender && d.hp > 0);
      defenderSide.runes.forEach((r) => {
        // 희생/마지막 선물은 죽은 공룡 주변의 "같은 타일" 아군에게 적용되는 효과라, 대기 공룡을
        // 다른 타일에 뒀다면(sameTile === false) 발동하지 않음
        if (r.name === "희생" && sameTile && Math.random() * 100 < r.s.prob) {
          stillAlive.forEach((target) => {
            const before = target.hp;
            target.hp = Math.min(target.maxHp, target.hp + (target.maxHp * r.s.rec_p) / 100);
            if (target.hp > before) event.heals.push({ side: defenderKey, amount: target.hp - before, cause: "희생" });
          });
        }
        if (r.name === "죽을 준비" && Math.random() * 100 < r.s.prob) {
          const burst = (defenderVals.atk * r.s.burst_p) / 100;
          attacker.hp = Math.max(0, attacker.hp - burst);
          event.hits.push({ label: "죽을 준비", dmg: burst, isCrit: false, targetSide: attackerKey, hpAfter: attacker.hp });
        }
        if (r.name === "마지막 선물" && sameTile && Math.random() * 100 < r.s.prob && stillAlive.length > 0) {
          stillAlive.forEach((target) => { target.giftAtk += r.s.atk_f; target.giftSteps = r.s.turn; });
          event.heals.push({ side: defenderKey, amount: 0, cause: "마지막 선물" });
        }
      });
      const idx = defenderSide.dinos.indexOf(defender);
      if (idx !== -1) defenderSide.dinos.splice(idx, 1);
      if (stillAlive.length > 0) event.spawn = { side: defenderKey };
    }

    if (attacker.giftSteps > 0 && --attacker.giftSteps === 0) attacker.giftAtk = 0;

    // UI가 매번 시뮬레이션 상태를 다시 훑지 않아도 재생만으로 그릴 수 있도록 이번 턴 종료 시점의
    // 스냅샷(생존 수, 앞장 체력/최대체력)을 이벤트에 그대로 실어둠
    event.myAliveCount = aliveDinos(mySide).length;
    event.oppAliveCount = aliveDinos(oppSide).length;
    event.myDinos = mySide.dinos.map((d) => ({ hp: d.hp, maxHp: d.maxHp }));
    event.oppDinos = oppSide.dinos.map((d) => ({ hp: d.hp, maxHp: d.maxHp }));
    const myFrontNow = aliveDinos(mySide)[0];
    const oppFrontNow = aliveDinos(oppSide)[0];
    event.myFrontHp = myFrontNow ? myFrontNow.hp : 0;
    event.myFrontMaxHp = myFrontNow ? myFrontNow.maxHp : (attackerKey === "my" ? attackerVals.maxHp : defenderVals.maxHp);
    event.oppFrontHp = oppFrontNow ? oppFrontNow.hp : 0;
    event.oppFrontMaxHp = oppFrontNow ? oppFrontNow.maxHp : (attackerKey === "opp" ? attackerVals.maxHp : defenderVals.maxHp);

    events.push(event);

    if (aliveDinos(mySide).length === 0 || aliveDinos(oppSide).length === 0) break;
    attackerKey = defenderKey;
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
  let attackerKey;
  if (myLevel !== oppLevel) {
    attackerKey = myLevel > oppLevel ? "my" : "opp";
  } else {
    const myOpen = computeSideCombatValues(mySide, 1, tileCfg);
    const oppOpen = computeSideCombatValues(oppSide, 1, tileCfg);
    attackerKey = myOpen.atk >= oppOpen.atk ? "my" : "opp";
  }

  let myKills = 0, oppKills = 0;
  let myDmgDealt = 0, oppDmgDealt = 0;
  let deaths = 0;
  let turn = 0;
  const MAX_TURNS = 200000; // 방어 스탯이 극단적으로 쌓여 죽지 않는 경우를 대비한 안전판

  while (deaths < totalDeaths && turn < MAX_TURNS) {
    turn++;
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

    const rollCrit = (vals) => Math.random() * 100 < vals.cRate;
    const withCrit = (val, isCrit, vals) => (isCrit ? val * (vals.cDmg / 100) : val);
    let dealt = 0;

    function hitDefender(rawDmg) {
      let dmg = rawDmg;
      if (defender.shieldSteps > 0) {
        const shieldRune = defenderSide.runes.find((r) => r.name === "보호막");
        if (shieldRune) dmg *= (1 - shieldRune.s.red_p / 100);
        defender.shieldSteps--;
      }
      defenderSide.runes.forEach((r) => {
        if (r.name.includes("단단한 피부")) dmg -= r.s.red_f;
        if (r.name.includes("피해 저항") && Math.random() * 100 < r.s.prob) dmg -= r.s.red_f;
      });
      dmg = Math.max(0, dmg);
      defender.hp = Math.max(0, defender.hp - dmg);
      dealt += dmg;
    }

    // 힐: 맞기 직전에 방어측 확률 발동
    defenderSide.runes.forEach((r) => {
      if (r.name === "힐" && Math.random() * 100 < r.s.prob) {
        defender.hp = Math.min(defender.maxHp, defender.hp + (defender.maxHp * r.s.rec_p) / 100);
      }
    });

    // 평타
    const finalAtk = attackerVals.atk + attacker.giftAtk;
    const basicCrit = rollCrit(attackerVals);
    hitDefender(withCrit(finalAtk, basicCrit, attackerVals));

    // 공격측 스킬 룬들 (1마리뿐이라 메테오의 "타일 전체" 피해도 사실상 이 상대 한 명에게만 적용됨)
    attackerSide.runes.forEach((r) => {
      if (defender.hp <= 0) return;
      if (r.name === "트리플 임팩트" && attacker.attackCount % 3 === 0) {
        const c = rollCrit(attackerVals);
        hitDefender(withCrit(finalAtk * (r.s.burst_p / 100), c, attackerVals));
      }
      if (r.name === "낙뢰" && Math.random() * 100 < r.s.prob) {
        const c = rollCrit(attackerVals);
        hitDefender(withCrit(finalAtk * (r.s.burst_p / 100), c, attackerVals));
        if (r.s.insta_hp !== undefined && defender.hp > 0) {
          const hpPct = (defender.hp / defender.maxHp) * 100;
          if (hpPct < r.s.insta_hp && Math.random() * 100 < r.s.insta_prob) defender.hp = 0;
        }
      }
      if (r.name === "메테오" && Math.random() * 100 < r.s.prob) {
        const c = rollCrit(attackerVals);
        hitDefender(withCrit(finalAtk * (r.s.burst_p / 100), c, attackerVals));
      }
      if (r.name === "흡혈" && Math.random() * 100 < r.s.prob) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + (attackerSide.vampBaseAtk * r.s.rec_p) / 100);
      }
    });

    if (attackerKey === "my") myDmgDealt += dealt; else oppDmgDealt += dealt;
    if (attacker.giftSteps > 0 && --attacker.giftSteps === 0) attacker.giftAtk = 0;

    if (defender.hp <= 0) {
      deaths++;
      if (attackerKey === "my") myKills++; else oppKills++;
      // 대기 공룡이 없는 단순화 모드라 죽는 즉시 그 자리에서 풀피로 부활(이동/딜레이 없음)
      defender.hp = defender.maxHp;
      defender.giftAtk = 0;
      defender.giftSteps = 0;
      defender.attackCount = 0;
      defender.shieldSteps = shieldTurnOf(defenderSide);
    }

    attackerKey = defenderKey;
  }

  return {
    trials: deaths,
    myKills,
    oppKills,
    avgMyDmgPerKill: myKills > 0 ? myDmgDealt / myKills : 0,
    avgOppDmgPerKill: oppKills > 0 ? oppDmgDealt / oppKills : 0,
    myDmgDealt,
    oppDmgDealt
  };
}
