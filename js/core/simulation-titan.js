// 타이탄 전투 시뮬레이션 엔진. DOM을 직접 건드리지 않고 결과 객체를 돌려줌.
// UI 쪽(js/pages/titan-page.js)에서 이 결과를 받아 화면에 그림.

/**
 * @param {Object} cfg
 * @param {number} cfg.baseAtk
 * @param {number} cfg.baseHp
 * @param {number} cfg.maxDino
 * @param {{atk:number, hp:number}} cfg.targetTitan
 * @param {Array} cfg.selectedRunes
 * @param {number} cfg.timeLimitMinutes
 * @param {Object} [cfg.constellation]
 * @param {Object} [cfg.bonusPercent] 알스킨/둥지 %
 * @param {number} [cfg.moveSpeed] 이동속도(1~150). 연속 전투 재소환 이동시간 계산에 씀
 * @param {number} [cfg.distanceTiles] 둥지-타이탄 거리(타일). 연속 전투 재소환 이동시간 계산에 씀
 * @param {boolean} [cfg.continuousBattle] 켜져 있으면 공룡이 죽어도 1.5초 후 재소환 + 이동시간 뒤 다시 합류
 * @param {number|null} [cfg.atkTowerLevel] 공격력 버프 타워 레벨(0~14). null이면 미설치
 * @param {number|null} [cfg.hpTowerLevel] 체력 버프 타워 레벨(0~14). null이면 미설치
 * @param {number} [cfg.iterations]
 * @param {boolean} [cfg.collectLog] 1회차 상세 로그 수집 여부
 * @param {(completed:number, total:number)=>void} [cfg.onProgress]
 * @returns {Promise<Object>} 시뮬레이션 결과
 */
function runTitanSimulation(cfg) {
  const {
    baseAtk, baseHp, maxDino, targetTitan, selectedRunes,
    timeLimitMinutes,
    constellation = { atk: 0, hp: 0, critRate: 0, critDmg: 0, bossDmgIncrease: 0 },
    bonusPercent = { atk: 0, hp: 0 },
    moveSpeed = 1,
    distanceTiles = 0,
    continuousBattle = false,
    natureAdjacent = false,
    tribeControl = false,
    atkTowerLevel = null,
    hpTowerLevel = null,
    iterations = 500,
    collectLog = false,
    onProgress = () => {},
    batchSize: batchSizeCfg = 1
  } = cfg;
  const atkTowerP = (atkTowerLevel !== null && atkTowerLevel !== undefined) ? BUFF_TOWER_PERCENTS[atkTowerLevel] : 0;
  const hpTowerP = (hpTowerLevel !== null && hpTowerLevel !== undefined) ? BUFF_TOWER_PERCENTS[hpTowerLevel] : 0;

  // 재소환 딜레이(1.5초 고정) + 둥지<->타이탄 이동 시간(거리 × 타일당 이동시간)
  const respawnDelaySec = 1.5 + distanceTiles * getTileMoveSeconds(moveSpeed);

  return new Promise((resolve) => {
    // onProgress를 안 쓰는 호출(조합 찾기 최적화기 내부)은 batchSize를 키워서 반복마다
    // setTimeout(0)으로 쪼개지는 타이머 오버헤드를 줄일 수 있음. 실전 시뮬레이션(진행률 표시용
    // onProgress 사용)은 기본값 1을 그대로 써서 매끄러운 진행률 갱신을 유지함.
    const batchSize = Math.max(1, batchSizeCfg);
    let completed = 0;
    const detailedLogs = [];
    let totalTitanHp = 0, totalTime = 0, totalDead = 0, totalDmg = 0;

    const limitSec = timeLimitMinutes * 60;
    let timeSeriesHp = new Array(limitSec + 1).fill(0);
    let timeSeriesCount = new Array(limitSec + 1).fill(0);

    const activeRunes = selectedRunes
      .filter((r) => r !== null)
      .map((r) => ({ ...r, s: RUNES_DATA[r.name].levels[r.lv] }));

    // 자연의 포옹/부족의 축복은 해당 타일 조건이 충족된 상태여야만 효과가 적용됨(허수아비/공룡
    // 대전과 같은 조건). 다른 룬은 항상 적용.
    const isTileGated = (r) =>
      r.name === "자연의 포옹" ? !natureAdjacent
      : (r.name === "부족의 축복 1" || r.name === "부족의 축복 2") ? !tribeControl
      : false;

    let atkF_vamp = 0, atkP_vamp = 0;
    activeRunes.forEach((r) => {
      if (VAMP_EXCLUSION_LIST.includes(r.name)) return;
      if (isTileGated(r)) return;
      if (r.s.atk_f) atkF_vamp += r.s.atk_f;
      if (r.s.atk_p) atkP_vamp += r.s.atk_p;
    });
    atkF_vamp += constellation.atk || 0;
    atkP_vamp += (bonusPercent.atk || 0) + atkTowerP;
    const vampBaseAtk = (baseAtk + atkF_vamp) * (1 + atkP_vamp / 100);

    const runBatch = () => {
      const end = Math.min(completed + batchSize, iterations);
      for (let i = completed; i < end; i++) {
        let dinos = [];
        for (let dIdx = 0; dIdx < maxDino; dIdx++) {
          dinos.push({ hp: 0, giftAtk: 0, giftSteps: 0, shieldSteps: 0, attackCount: 0, originalDied: false });
        }

        let tHp = targetTitan.hp;
        let sessionTime = 0;
        let deathEventCount = 0;
        let firstDeathTick = null;
        let initialFullHp = 0;
        let tickEvents = []; // 1회차(i===0)에서만 채워지는 "주요 이벤트" 로그(치명타/사망/룬 발동/재소환)
        let titanDefeated = false; // 이번 틱에 타이탄 체력이 0이 됐는지 - 로그를 남기고 나서 break하기 위함

        for (let t = 1; t <= limitSec; t++) {
          sessionTime = t;
          tickEvents = [];

          // 연속 전투: 재소환 타이머(사망 1.5초 후 + 이동시간)가 다 된 공룡을 부활 대기 상태로 표시.
          // 실제 체력 채움은 이번 틱의 currentMaxHp가 나온 뒤에 함(협동 공격 등 인원수 조건과 맞물리므로).
          dinos.forEach((d) => {
            if (d.reviveAtTime !== undefined && t >= d.reviveAtTime) {
              d.reviving = true;
              d.reviveAtTime = undefined;
            }
          });

          let aliveDinos = dinos.filter((d) => d.hp > 0 || d.reviving);
          let aliveCount = t === 1 ? maxDino : aliveDinos.length;
          // 전멸 상태여도 재소환을 기다리는 공룡이 있으면 그 공룡이 돌아올 때까지는 시간을 계속 흘려보냄
          const hasPendingRevive = dinos.some((d) => d.reviveAtTime !== undefined);
          if (aliveCount <= 0 && !hasPendingRevive) break;

          let atkF = constellation.atk || 0, atkP = (bonusPercent.atk || 0) + atkTowerP;
          let hpF = constellation.hp || 0, hpP = (bonusPercent.hp || 0) + hpTowerP;
          let cRate = 3 + (constellation.critRate || 0);
          let cDmg = 105 + (constellation.critDmg || 0);
          // 보스 슬레이어(룬, %)는 일반 % 바구니(atkP)에 안 넣고 최종 곱연산으로 따로 적용함.
          // 보스 피해 증가(별자리)는 %가 아니라 정수 고정값이라 atkF(별자리 atk 등)처럼 곱하기 전에
          // 더해지면 안 되고, (기본 공격력+별자리atk)*(vip/스킨/룬%) 를 계산한 "다음"에 더한 뒤
          // 보스 슬레이어를 곱해야 함 - 그래서 별도 변수로 갖고 있다가 currentAtk 계산식 안에서만 씀
          let bossSlayerPercent = 0;
          const bossDmgIncreaseFlat = constellation.bossDmgIncrease || 0;
          activeRunes.forEach((r) => {
            if (r.name === "보스 슬레이어") { bossSlayerPercent += r.s.atk_p; return; }
            // 마지막 선물의 atk_f는 사망한 아군이 남은 아군에게 넘겨주는 임시 버프량(giftAtk)이지
            // 상시 스탯이 아님 -> 상시 % 바구니에는 넣지 않음
            if (r.name === "마지막 선물") return;
            if (isTileGated(r)) return;
            let active = r.name === "협동 공격" ? aliveCount >= 5 : r.name === "고독한 분노" ? aliveCount === 1 : true;
            if (active) {
              if (r.s.atk_f) atkF += r.s.atk_f;
              if (r.s.atk_p) atkP += r.s.atk_p;
              if (r.s.hp_f) hpF += r.s.hp_f;
              if (r.s.hp_p) hpP += r.s.hp_p;
            }
            if (r.name === "치명타 확률") cRate += r.s.prob;
            if (r.name === "치명타 피해") cDmg += r.s.crit_d;
          });

          const currentMaxHp = (baseHp + hpF) * (1 + hpP / 100);
          const currentAtk = ((baseAtk + atkF) * (1 + atkP / 100) + bossDmgIncreaseFlat) * (1 + bossSlayerPercent / 100);

          if (t === 1) {
            initialFullHp = currentMaxHp;
            const sRune = activeRunes.find((r) => r.name === "보호막");
            dinos.forEach((d) => {
              d.hp = initialFullHp;
              d.shieldSteps = sRune ? sRune.s.turn : 0;
            });
            aliveDinos = dinos;
          } else {
            // 협동 공격/고독한 분노처럼 인원 조건에 따라 최대 체력이 오르내리는 룬 대응.
            // 조건을 잃어 최대 체력이 줄어들면 그 초과분만 깎임(현재 체력이 이미 그 아래였다면 그대로 유지, 즉사 아님)
            aliveDinos.forEach((d) => { if (d.hp > currentMaxHp) d.hp = currentMaxHp; });
            // 연속 전투로 복귀하는 공룡: 새로 소환된 것과 같으므로 체력을 꽉 채우고 상태를 초기화
            dinos.forEach((d) => {
              if (d.reviving) {
                d.hp = currentMaxHp;
                d.giftAtk = 0;
                d.giftSteps = 0;
                d.attackCount = 0;
                const sRune = activeRunes.find((r) => r.name === "보호막");
                d.shieldSteps = sRune ? sRune.s.turn : 0;
                d.reviving = false;
                if (collectLog && i === 0) {
                  tickEvents.push(`${dinos.indexOf(d) + 1}번 공룡 재소환 복귀 (체력 ${Math.round(currentMaxHp).toLocaleString()})`);
                }
              }
            });
          }

          for (let d of aliveDinos) {
            d.attackCount++;
            let finalBaseAtk = currentAtk + d.giftAtk;
            // 치명타 여부까지 같이 돌려줘야 "주요 이벤트" 로그(치명타 발동)에 남길 수 있음
            const rollHit = (val) => {
              const isCrit = Math.random() * 100 < cRate;
              return { dmg: isCrit ? val * (cDmg / 100) : val, isCrit };
            };

            const basicHit = rollHit(finalBaseAtk);
            tHp -= basicHit.dmg;
            if (collectLog && i === 0 && basicHit.isCrit) {
              tickEvents.push(`${dinos.indexOf(d) + 1}번 공룡 평타 치명타 (타이탄 ${Math.round(basicHit.dmg).toLocaleString()} 피해)`);
            }

            activeRunes.forEach((r) => {
              if ((r.name === "낙뢰" || r.name === "메테오") && Math.random() * 100 < r.s.prob) {
                const skillHit = rollHit(finalBaseAtk * (r.s.burst_p / 100));
                tHp -= skillHit.dmg;
                if (collectLog && i === 0) {
                  tickEvents.push(`${dinos.indexOf(d) + 1}번 공룡 ${r.name} 발동${skillHit.isCrit ? "(치명타)" : ""} (타이탄 ${Math.round(skillHit.dmg).toLocaleString()} 피해)`);
                }
              }
              if (r.name === "트리플 임팩트" && d.attackCount % 3 === 0) {
                const skillHit = rollHit(finalBaseAtk * (r.s.burst_p / 100));
                tHp -= skillHit.dmg;
                if (collectLog && i === 0) {
                  tickEvents.push(`${dinos.indexOf(d) + 1}번 공룡 트리플 임팩트 발동${skillHit.isCrit ? "(치명타)" : ""} (타이탄 ${Math.round(skillHit.dmg).toLocaleString()} 피해)`);
                }
              }
              if (r.name === "흡혈" && Math.random() * 100 < r.s.prob) {
                const before = d.hp;
                d.hp = Math.min(currentMaxHp, d.hp + (vampBaseAtk * r.s.rec_p) / 100);
                if (collectLog && i === 0 && d.hp > before) {
                  tickEvents.push(`${dinos.indexOf(d) + 1}번 공룡 흡혈 발동 (체력 +${Math.round(d.hp - before).toLocaleString()})`);
                }
              }
            });

            if (tHp <= 0) { tHp = 0; titanDefeated = true; break; }
            if (d.giftSteps > 0 && --d.giftSteps === 0) d.giftAtk = 0;
          }

          // 타이탄이 이미 죽었으면(위 공룡 공격 단계에서) 반격 없이 바로 이번 틱을 로그에 남기고
          // 끝냄 - 죽은 타이탄이 그 턴에 다시 공격하면 안 되므로 !titanDefeated로 막음
          if (!titanDefeated && t % 3 === 0) {
            let baseTDmg = targetTitan.atk;
            for (let d of dinos) {
              if (d.hp <= 0) continue;

              activeRunes.forEach((r) => {
                if (r.name === "힐" && Math.random() * 100 < r.s.prob) {
                  const before = d.hp;
                  d.hp = Math.min(currentMaxHp, d.hp + (currentMaxHp * r.s.rec_p) / 100);
                  if (collectLog && i === 0 && d.hp > before) {
                    tickEvents.push(`${dinos.indexOf(d) + 1}번 공룡 힐 발동 (체력 +${Math.round(d.hp - before).toLocaleString()})`);
                  }
                }
              });

              // 감소 적용 순서(인게임 문의 답변 기준): 특정 대상 % -> 특정 대상 상수값 -> 일반 % -> 일반 상수값
              // 타이탄전에서 "특정 대상"(보스/캐터펄트) 룬 중 타이탄에 적용 가능한 건 타이탄 가드(상수값)뿐이라 특정 대상 %는 없음
              let currentTDmg = baseTDmg;

              const guardRune = activeRunes.find((r) => r.name === "타이탄 가드");
              if (guardRune) currentTDmg -= guardRune.s.red_f;

              if (d.shieldSteps > 0) {
                const sRune = activeRunes.find((r) => r.name === "보호막");
                currentTDmg *= (1 - (sRune ? sRune.s.red_p : 0) / 100);
                d.shieldSteps--;
              }

              activeRunes.forEach((r) => {
                if (r.name.includes("단단한 피부")) currentTDmg -= r.s.red_f;
                if (r.name.includes("피해 저항") && Math.random() * 100 < r.s.prob) {
                  currentTDmg -= r.s.red_f;
                  if (collectLog && i === 0) {
                    tickEvents.push(`${dinos.indexOf(d) + 1}번 공룡 ${r.name} 발동 (피해 ${r.s.red_f} 감소)`);
                  }
                }
              });

              // 원본 게임 로직: 감소를 아무리 많이 쌓아도 최종 피해는 최소 1 - 완전 무피해(면역)는
              // 존재하지 않음(사용자 확인). 여기를 0으로 클램프하면 "감소량 >= 상대 공격력"인
              // 경우(예: 낮은 레벨 타이탄 상대로 단단한 피부를 여러 개 낀 경우) 시뮬레이션에서만
              // 완전 면역(영구 생존)으로 잘못 계산되어, 실제로는 조금씩이라도 깎이는 게 맞는데도
              // 회복형 룬(흡혈 등)과 비교할 때 "감소형" 쪽이 부당하게 유리해지는 문제가 있었음
              currentTDmg = Math.max(1, currentTDmg);
              d.hp = Math.max(0, d.hp - currentTDmg);

              if (d.hp === 0) {
                // 사망 이벤트 자체를 센다. 연속 전투로 되살아난 개체는 원래 그 공룡이 아니라
                // "새로 소환된 다른 개체"이므로, 나중에 그 슬롯이 생존해 있어도 이 죽음은 그대로 카운트됨
                deathEventCount++;
                d.originalDied = true;
                if (firstDeathTick === null) firstDeathTick = t;
                const deadIdx = dinos.indexOf(d);
                if (collectLog && i === 0) {
                  tickEvents.push(`${deadIdx + 1}번 공룡 사망`);
                }
                activeRunes.forEach((r) => {
                  if (r.name === "희생" && Math.random() * 100 < r.s.prob) {
                    dinos.forEach((target, tIdx) => {
                      if (target.hp > 0) {
                        const before = target.hp;
                        target.hp = Math.min(currentMaxHp, target.hp + (currentMaxHp * r.s.rec_p) / 100);
                        if (collectLog && i === 0 && target.hp > before) {
                          tickEvents.push(`${deadIdx + 1}번 공룡 사망 -> 희생 발동, ${tIdx + 1}번 공룡 체력 +${Math.round(target.hp - before).toLocaleString()}`);
                        }
                      }
                    });
                  }
                  if (r.name === "죽을 준비" && Math.random() * 100 < r.s.prob) {
                    const burst = (currentAtk * r.s.burst_p) / 100;
                    tHp = Math.max(0, tHp - burst);
                    if (collectLog && i === 0) {
                      tickEvents.push(`${deadIdx + 1}번 공룡 사망 -> 죽을 준비 발동, 타이탄에게 ${Math.round(burst).toLocaleString()} 피해`);
                    }
                  }
                  if (r.name === "마지막 선물" && Math.random() * 100 < r.s.prob) {
                    dinos.forEach((target, tIdx) => {
                      if (target.hp > 0) {
                        target.giftAtk += r.s.atk_f;
                        target.giftSteps = r.s.turn;
                        if (collectLog && i === 0) {
                          tickEvents.push(`${deadIdx + 1}번 공룡 사망 -> 마지막 선물 발동, ${tIdx + 1}번 공룡 공격력 +${r.s.atk_f} (${r.s.turn}회 지속)`);
                        }
                      }
                    });
                  }
                });
                // 연속 전투: 죽어도 완전히 이탈하지 않고 1.5초 후 재소환 + 이동시간 뒤 다시 합류
                if (continuousBattle) {
                  d.reviveAtTime = t + respawnDelaySec;
                }
              }
            }
            if (tHp <= 0) titanDefeated = true;
          }

          if (collectLog && i === 0) {
            detailedLogs.push({
              시간: t + "초",
              타이탄HP: Math.floor(tHp).toLocaleString(),
              타이탄HP_raw: Math.max(0, tHp),
              타이탄최대HP_raw: targetTitan.hp,
              생존공룡: aliveCount + "마리",
              공룡상태: dinos.map((d, idx) => ({ 번호: idx + 1, 남은HP: Math.max(0, d.hp).toFixed(0) })),
              공룡최대HP_raw: currentMaxHp,
              이벤트: tickEvents
            });
          }
          // 그래프는 "처음 시작한 그 공룡들"의 체력 추이만 보여줌. 연속 전투로 되살아난 개체는
          // 전투 계산(실제 tHp/d.hp)에는 정상적으로 참여하지만, 원본이 한 번이라도 죽었다면
          // 그래프에서는 그 슬롯을 계속 0%로 취급해서 "다른 개체가 대신 살아있는 것"처럼 보이지 않게 함
          let tickHpSum = 0;
          let safeFullHp = initialFullHp > 0 ? initialFullHp : 1;
          dinos.forEach((d) => {
            const chartHp = d.originalDied ? 0 : d.hp;
            tickHpSum += (Math.max(0, chartHp) / safeFullHp) * 100;
          });
          timeSeriesHp[t] += tickHpSum / maxDino;
          timeSeriesCount[t]++;

          // 로그/그래프에 이번 틱(타이탄 체력 0 포함) 기록을 다 남긴 뒤에 끝냄 - 예전엔 죽은 걸
          // 확인하자마자 바로 break해서 정작 죽는 그 틱(체력 0인 순간)이 로그에 안 남았고, 그래서
          // 리플레이가 체력이 0이 되기 "직전" 틱에서 멈춘 것처럼 보였음(실제 계산 자체는 항상
          // 정확히 0까지 갔음 - 화면에 보여주는 로그만 그 마지막 틱을 빠뜨렸던 것)
          if (titanDefeated) break;
        }
        totalTitanHp += Math.max(0, tHp);
        // "평균 전투 시간"은 전체 세션 길이가 아니라 "공룡이 처음 죽기까지 걸린 시간"의 평균.
        // 연속 전투 때문에 세션 자체는 90분까지 계속 이어질 수 있어서, 그 길이를 그대로 보여주면
        // 정작 궁금한 "얼마나 버티는지"와 동떨어진 숫자가 됨. 한 번도 안 죽었으면 제한 시간(limitSec)
        // 전체를 버틴 것으로 침(공룡이 안 죽었다면, 그게 타이탄이 먼저 죽어서 세션이 일찍 끝난 것이든
        // 실제로 제한 시간을 다 채운 것이든 "이 조합으로는 안 죽는다"는 같은 사실을 말해줌 - 타이탄이
        // 먼저 죽어 짧게 끝난 세션 길이(sessionTime)를 그대로 쓰면 오히려 딜이 약해서 전투가 길게
        // 늘어진 조합이 "더 오래 버틴 것"처럼 보이는 역전 현상이 생김)
        totalTime += firstDeathTick !== null ? firstDeathTick : limitSec;
        totalDead += deathEventCount;
        totalDmg += targetTitan.hp - Math.max(0, tHp);
      }
      completed = end;
      onProgress(completed, iterations);
      if (completed < iterations) setTimeout(runBatch, 0);
      else finalize();
    };

    const finalize = () => {
      let validTicks = 0, totalAvgSum = 0;
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

      // chartData[i]는 항상 (i+1)초 시점의 값(1% 미만 표본만 남은 구간은 이미 위에서 걸러졌음).
      // 그래서 그래프가 실제로 보여주는 구간의 길이는 항상 chartData.length(초) — 원래 설정한
      // limitSec을 그대로 라벨에 쓰면, 다들 일찍 죽어서 데이터가 짧게 끝났는데도 축은 "90분"까지
      // 표시되는 불일치가 생김. 추가로, 개체군이 사실상 전멸(0%대)해서 남은 구간이 평평한 꼬리뿐이면
      // 그 꼬리를 더 잘라내고 여유만 조금 남김("죽는 시점" 위주로 보여주기). 다들 잘 버텨서 값이
      // 여전히 높으면 꼬리를 자르지 않고 있는 데이터를 그대로 다 보여줌.
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
      const displayLimitSec = displayChartData.length > 0 ? displayChartData.length : limitSec;

      resolve({
        avgTotalDmg: totalDmg / iterations,
        avgRemainingTitanHp: Math.max(0, totalTitanHp / iterations),
        avgTimeSec: totalTime / iterations,
        avgDeadCount: totalDead / iterations,
        avgSurvivalPercent: finalRollingAvg,
        chartData: displayChartData,
        limitSec: displayLimitSec,
        logs: collectLog ? detailedLogs : []
      });
    };

    runBatch();
  });
}
