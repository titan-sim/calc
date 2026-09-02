// 아레나(5:5 진영전): 전열 2(슬롯 0,1) / 후열 3(슬롯 2,3,4) 고정 편성. 두 진영 다 "룬만 슬롯별로
// 다르고 기본 스탯/VIP/별자리/둥지·알스킨은 공유"라는 전제라, 슬롯 하나하나를
// simulation-dino-battle.js의 computeSideCombatValues/buildDinoSideRunes/computeVampBaseAtk/
// levelOf/shieldTurnOf/makeSeededRng에 "룬만 다른 가상의 side"로 넘겨서 그 판정식을 그대로
// 재사용함(협동 공격/고독한 분노/치확치피/버프타워 등 전부 동일 로직, 중복 구현 없음).
//
// 공룡 대전과의 차이:
// - 5:5 고정, 대기 개념 없음(항상 5마리 전부 전장에 있음).
// - 앞장 1:1이 아니라, 진영별로 슬롯 1~5가 죽은 슬롯을 건너뛰며 순서대로 공격(사용자 확정).
// - 방어측은 전열(생존자 있으면 전열 중 무작위), 전열 전멸 시 후열 중 무작위로 맞음.
// - 5마리가 항상 "한 타일"이라 협동 공격/희생/마지막 선물/메테오가 다른 4마리 전원에게 적용됨
//   (공룡 대전의 "다른 타일 배치" 개념 자체가 없음).
// - 100회 교환 동시사망 규칙은 "고정된 앞장 쌍"이 전제라 매 공격 대상이 랜덤인 아레나엔 적용 불가.
//   대신 ARENA_MAX_TURNS 안전판만 두고, 그마저 넘기면 무승부로 처리.

const ARENA_MAX_TURNS = 5000;

// side(공유 스탯) + slot(그 슬롯의 룬)을 합쳐서, 기존 computeSideCombatValues/shieldTurnOf가
// 기대하는 "{key, baseAtk, baseHp, constellation, bonusPercent, runes}" 형태로 위장시킴
function pseudoSideFor(side, slot) {
  return {
    key: side.key,
    baseAtk: side.baseAtk,
    baseHp: side.baseHp,
    constellation: side.constellation,
    bonusPercent: side.bonusPercent,
    currentHpPercent: side.currentHpPercent,
    runes: slot.runes
  };
}

// slotRunesList: 슬롯 0~4 각각의 룬 배열을 담은 길이 5 배열(js/pages/arena-page.js의
// arenaGetActiveSlotRunes(sideKey)) - "포메이션" 하나가 5마리 전원의 룬을 통째로 담고 있어서,
// 여기선 그 5개 룬 배열을 그대로 받기만 하면 됨(프리셋 풀에서 인덱스로 찾아오던 이전 방식 폐지).
// runArenaQuickCalc가 트라이얼(기본 2000회)마다 이 함수를 처음부터 다시 불러 RUNES_DATA 조회 +
// 배열 할당을 반복하던 걸 정리(사용자 지적 - 사이트 전체 점검) - 룬/기본 스탯은 트라이얼 내내
// 안 바뀌므로 "룬 조립"(이 함수, 트라이얼 루프 밖에서 1회)과 "체력/턴 포인터 등 매 트라이얼
// 초기화"(resetArenaSideMutableState, 매 트라이얼)를 분리함. runArenaSimulation(실전 1회용)과
// arena-page.js의 다른 호출자들은 원래처럼 이 함수(buildArenaSide) 그대로 씀 - 매 트라이얼
// 반복 호출이 아니라서 분리할 이유가 없음
function buildArenaSideRunes(profile, slotRunesList, key) {
  const inputs = dinoProfileToBattleInputs(profile);
  const slots = slotRunesList.map((runesRaw, slotIndex) => {
    const runes = buildDinoSideRunes(runesRaw || [], ARENA_UNSUITABLE_RUNE_LIST);
    return {
      slotIndex,
      row: slotIndex < 2 ? "front" : "back",
      runes,
      vampBaseAtk: computeVampBaseAtk(inputs.baseAtk, runes, inputs.constellation, inputs.bonusPercent, inputs.currentHpPercent),
      hp: 0, maxHp: 0,
      giftAtk: 0, giftSteps: 0,       // 마지막 선물
      warCryAtkP: 0, warCrySteps: 0,  // 승리의 함성
      shieldSteps: 0,
      attackCount: 0
    };
  });
  return {
    key,
    pointer: 0, // 이 진영의 다음 공격 시도 시작 슬롯(죽은 슬롯은 건너뜀)
    baseAtk: inputs.baseAtk,
    baseHp: inputs.baseHp,
    constellation: inputs.constellation,
    bonusPercent: inputs.bonusPercent,
    currentHpPercent: inputs.currentHpPercent != null ? inputs.currentHpPercent : 100,
    slots
  };
}

function buildArenaSide(profile, slotRunesList, key) {
  return buildArenaSideRunes(profile, slotRunesList, key);
}

// 트라이얼(또는 실전 1회) 시작 전에 룬/기본 스탯은 그대로 두고, 직전 트라이얼에서 전투 중 변했을
// 수 있는 상태만 초기값으로 되돌림(hp/maxHp는 곧이어 initSlotHp가 다시 채움 - 여기선 그 전에
// 확실히 0으로 정리만 해둠)
function resetArenaSideMutableState(side) {
  side.pointer = 0;
  side.slots.forEach((slot) => {
    slot.hp = 0;
    slot.maxHp = 0;
    slot.giftAtk = 0;
    slot.giftSteps = 0;
    slot.warCryAtkP = 0;
    slot.warCrySteps = 0;
    slot.shieldSteps = 0;
    slot.attackCount = 0;
  });
}

function aliveSlots(side) {
  return side.slots.filter((s) => s.hp > 0);
}

// 슬롯은 죽어도 배열에서 빼지 않고 hp=0으로 고정 슬롯 번호를 유지함(전투 순서/전열-후열 정체성이
// 슬롯 번호에 묶여 있어서, 공룡 대전처럼 앞으로 당겨쓰는 배열이 아니라 5칸이 항상 그대로 있어야 함)
function nextAttacker(side) {
  for (let i = 0; i < side.slots.length; i++) {
    const idx = (side.pointer + i) % side.slots.length;
    const slot = side.slots[idx];
    if (slot.hp > 0) {
      side.pointer = (idx + 1) % side.slots.length;
      return slot;
    }
  }
  return null;
}

// 방어측: 전열(슬롯 0,1)이 살아있으면 그중 무작위, 전열이 전멸했을 때만 후열(슬롯 2,3,4) 중 무작위
function pickDefender(side, rand) {
  const front = side.slots.filter((s) => s.row === "front" && s.hp > 0);
  const pool = front.length > 0 ? front : side.slots.filter((s) => s.row === "back" && s.hp > 0);
  if (pool.length === 0) return null;
  return pool[Math.floor(rand() * pool.length)];
}

function initSlotHp(side, tileCfg) {
  const aliveCount = side.slots.length; // 전투 시작 시점은 전원 생존(5)
  side.slots.forEach((slot) => {
    const vals = computeSideCombatValues(pseudoSideFor(side, slot), aliveCount, tileCfg);
    slot.maxHp = vals.maxHp;
    // currentHpPercent는 "전투 시작을 최대 체력의 몇 %로 할지"(사용자 확정) - 광전사의 분노 자체는
    // 이후 실시간 체력을 따름(simulation-dino-battle.js의 makeDinoSide와 동일한 원리)
    slot.hp = vals.maxHp * ((side.currentHpPercent != null ? side.currentHpPercent : 100) / 100);
    slot.shieldSteps = shieldTurnOf(pseudoSideFor(side, slot));
  });
}

function runArenaSimulation({ myProfile, oppProfile, mySlotRunes, oppSlotRunes, tileSettings, seed }) {
  const rand = seed !== undefined && seed !== null ? makeSeededRng(seed) : Math.random;
  const tileCfg = tileSettings || {
    natureAdjacent: false, tribeControl: "none",
    myAtkTowerLevel: null, myHpTowerLevel: null, oppAtkTowerLevel: null, oppHpTowerLevel: null
  };

  const mySide = buildArenaSide(myProfile, mySlotRunes, "my");
  const oppSide = buildArenaSide(oppProfile, oppSlotRunes, "opp");
  initSlotHp(mySide, tileCfg);
  initSlotHp(oppSide, tileCfg);

  // 선공: 레벨(순수 기본 스탯) 총합이 높은 쪽 - 아레나는 5마리가 전부 같은 기본 스탯을 공유하므로
  // levelOf(profile) 단순 비교로 충분함. 동률이면 5마리 종합 공격력(룬 반영) 합이 높은 쪽.
  const myLevel = levelOf(myProfile);
  const oppLevel = levelOf(oppProfile);
  let attackerKey;
  if (myLevel !== oppLevel) {
    attackerKey = myLevel > oppLevel ? "my" : "opp";
  } else {
    const sumAtk = (side) => side.slots.reduce(
      (acc, s) => acc + computeSideCombatValues(pseudoSideFor(side, s), side.slots.length, tileCfg).atk, 0
    );
    attackerKey = sumAtk(mySide) >= sumAtk(oppSide) ? "my" : "opp";
  }

  const events = [];
  let turn = 0;

  while (turn < ARENA_MAX_TURNS) {
    if (aliveSlots(mySide).length === 0 || aliveSlots(oppSide).length === 0) break;

    const attackerSide = attackerKey === "my" ? mySide : oppSide;
    const defenderSide = attackerKey === "my" ? oppSide : mySide;
    const defenderKey = attackerKey === "my" ? "opp" : "my";

    const attacker = nextAttacker(attackerSide);
    if (!attacker) break;

    // 협동 공격/고독한 분노 등 인원수 조건부 룬으로 최대 체력이 바뀔 수 있음 - 게임사 공식 답변
    // 확인: 조건을 잃어도 즉사하거나 현재 체력이 그대로 유지되는 게 아니라 "감소 전 최대 체력
    // 대비 남은 체력의 비율"로 재조정됨(공룡 대전과 동일 원칙, 최대치를 넘을 때만 깎던 예전
    // clamp 방식과 다름). stat-calc.js의 rescaleOneUnitHp 공용 함수 사용(전투 수식 공용화 작업)
    [mySide, oppSide].forEach((side) => {
      const aliveCount = aliveSlots(side).length;
      aliveSlots(side).forEach((slot) => {
        const v = computeSideCombatValues(pseudoSideFor(side, slot), aliveCount, tileCfg);
        rescaleOneUnitHp(slot, v.maxHp);
      });
    });

    const defender = pickDefender(defenderSide, rand);
    if (!defender) break;

    turn++;
    attacker.attackCount++;

    const attackerVals = computeSideCombatValues(pseudoSideFor(attackerSide, attacker), aliveSlots(attackerSide).length, tileCfg);
    const defenderVals = computeSideCombatValues(pseudoSideFor(defenderSide, defender), aliveSlots(defenderSide).length, tileCfg);

    const event = {
      turn,
      attackerSide: attackerKey, attackerSlot: attacker.slotIndex,
      defenderSide: defenderKey, defenderSlot: defender.slotIndex,
      hits: [], heals: [], aoeList: [], deaths: [],
      mySlots: null, oppSlots: null, myAliveCount: 0, oppAliveCount: 0
    };

    function hitDefender(rawDmg, isCrit, label, target, targetKey) {
      let dmg = rawDmg;
      if (target.shieldSteps > 0) {
        const shieldRune = target.runes.find((r) => r.name === "보호막");
        if (shieldRune) dmg *= (1 - shieldRune.s.red_p / 100);
        target.shieldSteps--;
      }
      // 단단한 피부/피해 저항은 "평타"만 감소시킴 - 트리플 임팩트/낙뢰/메테오 같은 스킬 피해에는
      // 적용되지 않음(보호막은 스킬 포함 전부 감소, 위에서 이미 처리)
      if (label === "평타") {
        target.runes.forEach((r) => {
          if (r.name.includes("단단한 피부")) dmg -= r.s.red_f;
          if (r.name.includes("피해 저항") && rand() * 100 < r.s.prob) dmg -= r.s.red_f;
        });
      }
      dmg = Math.max(0, dmg);
      target.hp = Math.max(0, target.hp - dmg);
      event.hits.push({ label, dmg, isCrit, targetSide: targetKey, targetSlot: target.slotIndex, hpAfter: target.hp });
      return dmg;
    }

    // 힐: 맞기 직전에 방어측(그 슬롯 본인의 룬) 확률 발동
    defender.runes.forEach((r) => {
      if (r.name === "힐" && rand() * 100 < r.s.prob) {
        const before = defender.hp;
        defender.hp = Math.min(defender.maxHp, defender.hp + r.s.rec_f);
        if (defender.hp > before) event.heals.push({ side: defenderKey, slot: defender.slotIndex, amount: defender.hp - before, cause: "힐" });
      }
    });

    // 평타. 광전사의 분노는 지금 공격하는 그 슬롯의 실시간 체력 비율로 판정(사용자 확정 -
    // "현재 체력 설정"은 시작 체력%일 뿐, 룬 자체는 전투 중 실시간 체력을 따름)
    const berserkerRune = attacker.runes.find((r) => r.name === "광전사의 분노");
    const berserkerBonus = berserkerRune ? computeBerserkerAtkBonus((attacker.hp / attackerVals.maxHp) * 100, berserkerRune.s) : 0;
    const finalAtk = (attackerVals.atk + attacker.giftAtk) * (1 + attacker.warCryAtkP / 100) * (1 + berserkerBonus / 100);
    const basicHit = rollCritHit(finalAtk, attackerVals.cRate, attackerVals.cDmg, rand);
    hitDefender(basicHit.dmg, basicHit.isCrit, "평타", defender, defenderKey);

    // 공격측 스킬 룬들(그 공격 슬롯 본인의 룬)
    attacker.runes.forEach((r) => {
      if (defender.hp <= 0) return;
      if (r.name === "트리플 임팩트" && attacker.attackCount % 3 === 0) {
        const tripleHit = rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg, rand);
        hitDefender(tripleHit.dmg, tripleHit.isCrit, "트리플 임팩트", defender, defenderKey);
      }
      if (r.name === "낙뢰" && rand() * 100 < r.s.prob) {
        const lightningHit = rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg, rand);
        hitDefender(lightningHit.dmg, lightningHit.isCrit, r.name, defender, defenderKey);
        if (r.s.insta_hp !== undefined && defender.hp > 0) {
          const hpPct = (defender.hp / defender.maxHp) * 100;
          if (hpPct < r.s.insta_hp && rand() * 100 < r.s.insta_prob) {
            defender.hp = 0;
            event.hits.push({ label: "낙뢰(즉사)", dmg: 0, isCrit: false, targetSide: defenderKey, targetSlot: defender.slotIndex, hpAfter: 0, insta: true });
          }
        }
      }
      // 메테오/가시: 5마리가 항상 "한 타일"이라 방어측 살아있는 슬롯 전원(전열+후열)이 다 맞음. 광역기라
      // 여러 마리가 한 번에 맞지만 크리티컬은 맞는 슬롯마다 독립적으로 판정됨(한 마리가 크리 떴다고
      // 나머지도 전부 크리 대미지를 받으면 안 됨). 스킬 피해라 단단한 피부/피해 저항 적용 안 함.
      // 가시는 다이노 배틀에선 "주위 6개 타일 중 일부"에 추가 피해를 주는 룬이지만, 아레나는
      // 애초에 5마리가 전부 "하나의 타일"이라(사용자 확정 "아레나는 그냥 전체가 하나의 타일로
      // 치니까") 그 "주변 타일" 개념 자체가 없음 - 메테오와 완전히 동일하게 전원에게 한 번만 적용
      if ((r.name === "메테오" || r.name === "가시") && rand() * 100 < r.s.prob) {
        const targets = [];
        aliveSlots(defenderSide).forEach((d) => {
          const aoeHit = rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg, rand);
          const dmg = Math.max(0, aoeHit.dmg);
          const before = d.hp;
          d.hp = Math.max(0, d.hp - dmg);
          targets.push({ slot: d.slotIndex, before, after: d.hp, isTarget: d === defender, isCrit: aoeHit.isCrit });
        });
        event.aoeList.push({ label: r.name === "메테오" ? "메테오(광역)" : "가시", isCrit: targets.some((t) => t.isCrit), targets });
      }
      if (r.name === "흡혈" && rand() * 100 < r.s.prob) {
        const before = attacker.hp;
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + (attacker.vampBaseAtk * r.s.rec_p) / 100);
        if (attacker.hp > before) event.heals.push({ side: attackerKey, slot: attacker.slotIndex, amount: attacker.hp - before, cause: "흡혈" });
      }
    });

    // 사망 처리(그 슬롯 본인의 룬만 발동 - 희생/마지막 선물은 같은 진영의 살아있는 나머지
    // 슬롯 전원에게 적용됨, "한 타일" 취급이라 예외 없음)
    function processSlotDeath(dyingSlot, dyingSide, dyingKey, dyingVals, otherSlot, otherKey) {
      event.deaths.push({ side: dyingKey, slot: dyingSlot.slotIndex });
      const stillAlive = aliveSlots(dyingSide).filter((s) => s !== dyingSlot);
      dyingSlot.runes.forEach((r) => {
        if (r.name === "희생" && rand() * 100 < r.s.prob) {
          stillAlive.forEach((target) => {
            const before = target.hp;
            target.hp = Math.min(target.maxHp, target.hp + r.s.rec_f);
            if (target.hp > before) event.heals.push({ side: dyingKey, slot: target.slotIndex, amount: target.hp - before, cause: "희생" });
          });
        }
        if (r.name === "죽을 준비" && rand() * 100 < r.s.prob) {
          const burst = (dyingVals.atk * r.s.burst_p) / 100;
          otherSlot.hp = Math.max(0, otherSlot.hp - burst);
          event.hits.push({ label: "죽을 준비", dmg: burst, isCrit: false, targetSide: otherKey, targetSlot: otherSlot.slotIndex, hpAfter: otherSlot.hp });
        }
        if (r.name === "마지막 선물" && rand() * 100 < r.s.prob && stillAlive.length > 0) {
          stillAlive.forEach((target) => { target.giftAtk += r.s.atk_f; target.giftSteps = r.s.turn; });
          event.heals.push({ side: dyingKey, slot: dyingSlot.slotIndex, amount: 0, cause: "마지막 선물" });
        }
      });
    }

    if (defender.hp <= 0) {
      processSlotDeath(defender, defenderSide, defenderKey, defenderVals, attacker, attackerKey);
      // 승리의 함성: 처치한 공격 슬롯 본인에게 공격력% 버프
      attacker.runes.forEach((r) => {
        if (r.name === "승리의 함성") {
          attacker.warCryAtkP = r.s.atk_p;
          attacker.warCrySteps = r.s.turn;
        }
      });
    }

    if (attacker.giftSteps > 0 && --attacker.giftSteps === 0) attacker.giftAtk = 0;
    if (attacker.warCrySteps > 0 && --attacker.warCrySteps === 0) attacker.warCryAtkP = 0;

    event.mySlots = mySide.slots.map((s) => ({ hp: s.hp, maxHp: s.maxHp, row: s.row }));
    event.oppSlots = oppSide.slots.map((s) => ({ hp: s.hp, maxHp: s.maxHp, row: s.row }));
    event.myAliveCount = aliveSlots(mySide).length;
    event.oppAliveCount = aliveSlots(oppSide).length;

    events.push(event);

    if (aliveSlots(mySide).length === 0 || aliveSlots(oppSide).length === 0) break;
    attackerKey = defenderKey;
  }

  const myAlive = aliveSlots(mySide).length > 0;
  const oppAlive = aliveSlots(oppSide).length > 0;
  const winner = myAlive && !oppAlive ? "my" : (oppAlive && !myAlive ? "opp" : "draw");

  return {
    events, winner, turns: turn,
    myFinalCount: aliveSlots(mySide).length, oppFinalCount: aliveSlots(oppSide).length
  };
}

// ===== "빠른 계산": 독립된 5:5 전투를 N번 반복해서 승률/앞열이 먼저 죽는 진영 통계를 냄 =====
// runArenaSimulation과 판정식은 동일하지만(재사용), 매 시행마다 이벤트 로그를 만들지 않고 승패와
// "앞열 전멸이 어느 쪽에서 먼저 나는지"만 집계함(공룡 대전의 runDinoQuickCalc와 같은 이유로 별도
// 경량 루프 - 매번 새 5:5 매치를 처음부터 다시 여는 구조라 이벤트 객체를 안 만드는 게 훨씬 빠름)

function arenaQuickHitDefender(rawDmg, label, target) {
  let dmg = rawDmg;
  if (target.shieldSteps > 0) {
    const shieldRune = target.runes.find((r) => r.name === "보호막");
    if (shieldRune) dmg *= (1 - shieldRune.s.red_p / 100);
    target.shieldSteps--;
  }
  if (label === "평타") {
    target.runes.forEach((r) => {
      if (r.name.includes("단단한 피부")) dmg -= r.s.red_f;
      if (r.name.includes("피해 저항") && Math.random() * 100 < r.s.prob) dmg -= r.s.red_f;
    });
  }
  dmg = Math.max(0, dmg);
  target.hp = Math.max(0, target.hp - dmg);
  return dmg;
}

function arenaQuickProcessDeath(dyingSlot, dyingSide, dyingVals, otherSlot) {
  const stillAlive = aliveSlots(dyingSide).filter((s) => s !== dyingSlot);
  dyingSlot.runes.forEach((r) => {
    if (r.name === "희생" && Math.random() * 100 < r.s.prob) {
      stillAlive.forEach((target) => {
        target.hp = Math.min(target.maxHp, target.hp + r.s.rec_f);
      });
    }
    if (r.name === "죽을 준비" && Math.random() * 100 < r.s.prob) {
      const burst = (dyingVals.atk * r.s.burst_p) / 100;
      otherSlot.hp = Math.max(0, otherSlot.hp - burst);
    }
    if (r.name === "마지막 선물" && Math.random() * 100 < r.s.prob && stillAlive.length > 0) {
      stillAlive.forEach((target) => { target.giftAtk += r.s.atk_f; target.giftSteps = r.s.turn; });
    }
  });
}

function runArenaQuickCalc({ myProfile, oppProfile, mySlotRunes, oppSlotRunes, tileSettings, trials = 2000 }) {
  const tileCfg = tileSettings || {
    natureAdjacent: false, tribeControl: "none",
    myAtkTowerLevel: null, myHpTowerLevel: null, oppAtkTowerLevel: null, oppHpTowerLevel: null
  };

  let myWins = 0, oppWins = 0, draws = 0;
  let myFrontFirst = 0, oppFrontFirst = 0;

  const mySide = buildArenaSideRunes(myProfile, mySlotRunes, "my");
  const oppSide = buildArenaSideRunes(oppProfile, oppSlotRunes, "opp");

  for (let trial = 0; trial < trials; trial++) {
    resetArenaSideMutableState(mySide);
    resetArenaSideMutableState(oppSide);
    initSlotHp(mySide, tileCfg);
    initSlotHp(oppSide, tileCfg);

    const myLevel = levelOf(myProfile);
    const oppLevel = levelOf(oppProfile);
    let attackerKey;
    if (myLevel !== oppLevel) {
      attackerKey = myLevel > oppLevel ? "my" : "opp";
    } else {
      const sumAtk = (side) => side.slots.reduce(
        (acc, s) => acc + computeSideCombatValues(pseudoSideFor(side, s), side.slots.length, tileCfg).atk, 0
      );
      attackerKey = sumAtk(mySide) >= sumAtk(oppSide) ? "my" : "opp";
    }

    let frontRecorded = false;
    let turn = 0;

    while (turn < ARENA_MAX_TURNS) {
      if (aliveSlots(mySide).length === 0 || aliveSlots(oppSide).length === 0) break;

      const attackerSide = attackerKey === "my" ? mySide : oppSide;
      const defenderSide = attackerKey === "my" ? oppSide : mySide;
      const defenderKey = attackerKey === "my" ? "opp" : "my";

      const attacker = nextAttacker(attackerSide);
      if (!attacker) break;

      // 협동 공격/고독한 분노 인원수 변화 시 체력 비율 재조정(위 runArenaSimulation과 동일 원칙,
      // stat-calc.js의 rescaleOneUnitHp 공용 함수 사용)
      [mySide, oppSide].forEach((side) => {
        const aliveCount = aliveSlots(side).length;
        aliveSlots(side).forEach((slot) => {
          const v = computeSideCombatValues(pseudoSideFor(side, slot), aliveCount, tileCfg);
          rescaleOneUnitHp(slot, v.maxHp);
        });
      });

      const defender = pickDefender(defenderSide, Math.random);
      if (!defender) break;

      turn++;
      attacker.attackCount++;

      const attackerVals = computeSideCombatValues(pseudoSideFor(attackerSide, attacker), aliveSlots(attackerSide).length, tileCfg);
      const defenderVals = computeSideCombatValues(pseudoSideFor(defenderSide, defender), aliveSlots(defenderSide).length, tileCfg);

      defender.runes.forEach((r) => {
        if (r.name === "힐" && Math.random() * 100 < r.s.prob) {
          defender.hp = Math.min(defender.maxHp, defender.hp + r.s.rec_f);
        }
      });

      const berserkerRune = attacker.runes.find((r) => r.name === "광전사의 분노");
      const berserkerBonus = berserkerRune ? computeBerserkerAtkBonus((attacker.hp / attackerVals.maxHp) * 100, berserkerRune.s) : 0;
      const finalAtk = (attackerVals.atk + attacker.giftAtk) * (1 + attacker.warCryAtkP / 100) * (1 + berserkerBonus / 100);
      arenaQuickHitDefender(rollCritHit(finalAtk, attackerVals.cRate, attackerVals.cDmg).dmg, "평타", defender);

      attacker.runes.forEach((r) => {
        if (defender.hp <= 0) return;
        if (r.name === "트리플 임팩트" && attacker.attackCount % 3 === 0) {
          arenaQuickHitDefender(rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg).dmg, "트리플 임팩트", defender);
        }
        if (r.name === "낙뢰" && Math.random() * 100 < r.s.prob) {
          arenaQuickHitDefender(rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg).dmg, "낙뢰", defender);
          if (r.s.insta_hp !== undefined && defender.hp > 0) {
            const hpPct = (defender.hp / defender.maxHp) * 100;
            if (hpPct < r.s.insta_hp && Math.random() * 100 < r.s.insta_prob) defender.hp = 0;
          }
        }
        if ((r.name === "메테오" || r.name === "가시") && Math.random() * 100 < r.s.prob) {
          aliveSlots(defenderSide).forEach((d) => {
            const dmg = Math.max(0, rollCritHit(finalAtk * (r.s.burst_p / 100), attackerVals.cRate, attackerVals.cDmg).dmg);
            d.hp = Math.max(0, d.hp - dmg);
          });
        }
        if (r.name === "흡혈" && Math.random() * 100 < r.s.prob) {
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + (attacker.vampBaseAtk * r.s.rec_p) / 100);
        }
      });

      if (defender.hp <= 0) {
        arenaQuickProcessDeath(defender, defenderSide, defenderVals, attacker);
        attacker.runes.forEach((r) => {
          if (r.name === "승리의 함성") {
            attacker.warCryAtkP = r.s.atk_p;
            attacker.warCrySteps = r.s.turn;
          }
        });
      }

      if (attacker.giftSteps > 0 && --attacker.giftSteps === 0) attacker.giftAtk = 0;
      if (attacker.warCrySteps > 0 && --attacker.warCrySteps === 0) attacker.warCryAtkP = 0;

      // 앞열(슬롯 0,1) 전멸이 어느 쪽에서 먼저 나는지 이번 시행에서 딱 한 번만 기록
      if (!frontRecorded) {
        const myFrontAlive = mySide.slots.some((s) => s.row === "front" && s.hp > 0);
        const oppFrontAlive = oppSide.slots.some((s) => s.row === "front" && s.hp > 0);
        if (!myFrontAlive) { myFrontFirst++; frontRecorded = true; }
        else if (!oppFrontAlive) { oppFrontFirst++; frontRecorded = true; }
      }

      if (aliveSlots(mySide).length === 0 || aliveSlots(oppSide).length === 0) break;
      attackerKey = defenderKey;
    }

    const myAlive = aliveSlots(mySide).length > 0;
    const oppAlive = aliveSlots(oppSide).length > 0;
    if (myAlive && !oppAlive) myWins++;
    else if (oppAlive && !myAlive) oppWins++;
    else draws++;
  }

  return { trials, myWins, oppWins, draws, myFrontFirst, oppFrontFirst };
}
