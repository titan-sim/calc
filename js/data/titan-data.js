// 타이탄(보스) 레벨별 공격력/체력 데이터
// 1~50레벨: 기존 script.js의 window.onload 안에 있던 생성 로직을 그대로 옮김 (수치 변경 없음)
// 51~140레벨: 신규 구간. 51레벨부터 티어 가중치(+18,750,000)가 적용된 뒤 매 레벨 +5,000,000씩
// 누적되는데, 게임 엔진이 32비트 부동소수점(Float32)으로 연산해서 매 누적 단계마다 반올림 오차가
// 남는다. 50레벨 기준값(181,875,000)을 Float32로 변환한 181,875,008을 시작점으로 삼아 그 오차까지
// 그대로 재현해야 실제 인게임 표기(58/60레벨 끝자리 8, 114레벨 끝자리 24 등)와 일치함. 121레벨부터도
// 새 티어 구간 없이 원래 공식(atk 선형 증가, hp 매 레벨 +5,000,000 누적) 그대로 이어짐.
function buildTitanStats() {
  const titanStats = [];
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
    titanStats[lv] = { atk, hp };
  }

  let hp51 = Math.fround(Math.fround(181875000) + 18750000);
  for (let lv = 51; lv <= 140; lv++) {
    if (lv > 51) hp51 = Math.fround(hp51 + 5000000);
    titanStats[lv] = { atk: 90 + (lv - 10) * 15, hp: hp51 };
  }
  return titanStats;
}

const TITAN_STATS = buildTitanStats();
