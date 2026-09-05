const RUNES_DATA = {
      // ===== 일반 (id 오름차순) =====
      "힐": {
        grade: "일반",
        imgId: "RuneSprite_6",
        // 사용자 확정(2026-09-02 밸런스 조정) - 희생과 동일하게 최대 체력 비례(%) 회복에서 고정
        // 수치 회복으로 공식이 바뀜. rec_p 대신 rec_f. 이 룬을 계산하는 곳(simulation-arena/
        // dino-battle/titan.js + js/core/stat-calc.js의 관련 수치 카드·타이탄 1단계 해석적 추정)
        // 전부 같이 고쳐야 함 - 건물/허수아비는 힐이 애초에 부적합 룬이라 안 씀
        desc: "유닛에게 공격당할 때 {prob}% 확률로 내 유닛 체력 {rec_f} 회복",
        levels: (function() {
          let lv = {};
          const p = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 13];
          const v = [50, 90, 130, 170, 210, 250, 290, 330, 370, 410, 430, 450, 470, 490, 510, 530, 550, 570, 590, 610, 630, 650, 670, 690, 710, 730, 750, 770, 790, 810, 830];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            rec_f: v[i]
          });
          return lv;
        })()
      },
      "공격력 증가 1": {
        grade: "일반",
        imgId: "RuneSprite_7",
        desc: "유닛 공격력 {atk_f} 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            atk_f: i
          };
          return lv;
        })()
      },
      "체력 증가 1": {
        grade: "일반",
        imgId: "RuneSprite_11",
        desc: "유닛 체력 {hp_f} 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            hp_f: i * 25
          };
          return lv;
        })()
      },
      "희생": {
        grade: "일반",
        imgId: "RuneSprite_16",
        // 사용자 확정(2026-09-02 밸런스 조정) - 최대 체력 비례(%) 회복에서 고정 수치 회복으로
        // 공식 자체가 바뀜(다른 룬들의 순수 수치 조정과 다름) - rec_p(퍼센트) 대신 rec_f(고정치)
        // 필드를 씀. 이 룬을 계산하는 5개 엔진(simulation-arena/dino-battle/titan/building.js)의
        // 회복 공식도 전부 "최대체력 * rec_p / 100"에서 "rec_f"로 같이 바꿔야 함
        desc: "사망 시 {prob}% 확률로 같은 타일에 있는 동일 부족 소속의 모든 유닛에게 체력 {rec_f} 회복",
        levels: (function() {
          let lv = {};
          const p = [35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 50];
          const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 350];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            rec_f: v[i]
          });
          return lv;
        })()
      },
      "마지막 선물": {
        grade: "일반",
        imgId: "RuneSprite_17",
        desc: "사망 시 {prob}% 확률로 같은 타일에 있는 동일 부족 소속의 유닛에게 공격력 {atk_f} 증가 버프 {turn}턴 지속",
        levels: (function() {
          let lv = {};
          const p = [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 60];
          const t = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4];
          for (let i = 1; i <= 31; i++) lv[i] = {
            prob: p[i - 1],
            atk_f: 14 + i,
            turn: t[i - 1]
          };
          return lv;
        })()
      },
      "승리의 함성": {
        grade: "일반",
        imgId: "RuneSprite_22",
        desc: "적 유닛을 처치 시 유닛의 공격력 {atk_p}% 버프 {turn}턴 지속",
        levels: (function() {
          let lv = {};
          const v = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0, 5.2, 5.4, 5.6, 5.8, 6.0, 6.2, 6.4, 6.6, 6.8, 7.5];
          const t = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8];
          v.forEach((x, i) => lv[i + 1] = {
            atk_p: x,
            turn: t[i]
          });
          return lv;
        })()
      },
      "자연의 포옹": {
        grade: "일반",
        imgId: "RuneSprite_23",
        desc: "자연 구조물(채집지 제외)이 있는 타일 옆에 있을 경우 유닛의 공격력 {atk_f} 체력 {hp_f} 버프",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            atk_f: i,
            hp_f: i * 25
          };
          return lv;
        })()
      },
      "트리플 임팩트": {
        grade: "일반",
        imgId: "RuneSprite_24",
        desc: "세번 째 공격마다 내 유닛의 공격력의 {burst_p}%의 추가 피해",
        levels: (function() {
          let lv = {};
          const v = [2, 2.5, 3, 3.5, 4, 6, 6.5, 7, 7.5, 8, 10, 10.5, 11, 11.5, 12, 14, 14.5, 15, 15.5, 16, 18, 18.5, 19, 19.5, 20, 22, 22.5, 23, 23.5, 24, 27];
          v.forEach((x, i) => lv[i + 1] = {
            burst_p: x
          });
          return lv;
        })()
      },
      "단단한 피부 1": {
        grade: "일반",
        imgId: "RuneSprite_25",
        desc: "적 유닛에게 공격당할 때 피해 {red_f}만큼 감소",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            red_f: i * 2
          };
          return lv;
        })()
      },
      "피해 저항 1": {
        grade: "일반",
        imgId: "RuneSprite_27",
        desc: "적 유닛에게 공격당할 때 {prob}%의 확률로 피해 {red_f}만큼 감소",
        levels: (function() {
          let lv = {};
          const p = [30, 30, 30, 30, 30, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 45, 45, 45, 45, 45, 50];
          const v = [30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            red_f: v[i]
          });
          return lv;
        })()
      },
      "보호막": {
        grade: "일반",
        imgId: "RuneSprite_29",
        desc: "{turn}번의 적 공격 피해를 {red_p}% 감소",
        levels: (function() {
          let lv = {};
          const t = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3];
          const v = [1, 1.5, 2, 2.5, 3, 5, 5.5, 6, 6.5, 7, 10, 10.5, 11, 11.5, 12, 13, 13.5, 14, 14.5, 15, 18, 18.5, 19, 19.5, 20, 22, 22.5, 23, 23.5, 24, 28];
          t.forEach((x, i) => lv[i + 1] = {
            turn: x,
            red_p: v[i]
          });
          return lv;
        })()
      },
      "파괴자 1": {
        grade: "일반",
        imgId: "RuneSprite_30",
        desc: "건축물을 공격할 때 유닛의 공격력 {atk_p}% 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) {
            let atk_p;
            if (i <= 5) atk_p = 5.1 + (i - 1) * 0.3;
            else if (i <= 10) atk_p = 7.5 + (i - 6) * 0.3;
            else if (i <= 15) atk_p = 9.9 + (i - 11) * 0.3;
            else if (i <= 20) atk_p = 13.2 + (i - 16) * 0.3;
            else if (i <= 25) atk_p = 17.1 + (i - 21) * 0.6;
            else if (i <= 30) atk_p = 23.1 + (i - 26) * 0.6;
            else atk_p = 30;
            lv[i] = {
              atk_p: parseFloat(atk_p.toFixed(1))
            };
          }
          return lv;
        })()
      },
      "강인함 1": {
        grade: "일반",
        imgId: "RuneSprite_33",
        desc: "건축물에게 공격당할 때 피해 {red_f} 감소",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            red_f: i
          };
          return lv;
        })()
      },
      "부족의 축복 1": {
        grade: "일반",
        imgId: "RuneSprite_34",
        desc: "내 부족이 점령한 타일 위에 있을 때 유닛의 공격력 {atk_f} 체력 {hp_f} 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            atk_f: i,
            hp_f: i * 25
          };
          return lv;
        })()
      },

      // ===== 희귀 (id 오름차순) =====
      "공격력 증가 2": {
        grade: "희귀",
        imgId: "RuneSprite_8",
        desc: "유닛 공격력 {atk_f} 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            atk_f: 15 + i - 1
          };
          return lv;
        })()
      },
      "체력 증가 2": {
        grade: "희귀",
        imgId: "RuneSprite_12",
        desc: "유닛 체력 {hp_f} 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            hp_f: 375 + (i - 1) * 25
          };
          return lv;
        })()
      },
      "협동 공격": {
        grade: "희귀",
        imgId: "RuneSprite_18",
        desc: "같은 타일에 내 유닛이 5마리 이상일 때 유닛의 공격력 {atk_f} 체력 {hp_f} 증가",
        levels: (function() {
          let lv = {};
          const a = [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 62, 64, 66, 68, 75];
          const h = [875, 900, 925, 950, 975, 1000, 1025, 1050, 1075, 1100, 1125, 1150, 1175, 1200, 1225, 1250, 1275, 1300, 1325, 1350, 1375, 1400, 1425, 1450, 1475, 1500, 1550, 1600, 1650, 1700, 1875];
          a.forEach((x, i) => lv[i + 1] = {
            atk_f: x,
            hp_f: h[i]
          });
          return lv;
        })()
      },
      "고독한 분노": {
        grade: "희귀",
        imgId: "RuneSprite_19",
        desc: "같은 타일에 내 유닛이 1마리일 때 유닛의 공격력 {atk_f} 체력 {hp_f} 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            atk_f: 15 + i - 1,
            hp_f: 375 + (i - 1) * 25
          };
          return lv;
        })()
      },
      "단단한 피부 2": {
        grade: "희귀",
        imgId: "RuneSprite_26",
        desc: "적 유닛에게 공격당할 때 피해 {red_f}만큼 감소",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            red_f: 30 + (i - 1) * 2
          };
          return lv;
        })()
      },
      "피해 저항 2": {
        grade: "희귀",
        imgId: "RuneSprite_28",
        desc: "적 유닛에게 공격당할 때 {prob}% 확률로 피해 {red_f}만큼 감소",
        levels: (function() {
          let lv = {};
          const p = [30, 30, 30, 30, 30, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 45, 45, 45, 45, 45, 50];
          const v = [70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 124, 128, 132, 136, 150];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            red_f: v[i]
          });
          return lv;
        })()
      },
      "파괴자 2": {
        grade: "희귀",
        imgId: "RuneSprite_31",
        desc: "건축물을 공격할 때 유닛의 공격력 {atk_p}% 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) {
            let atk_p;
            if (i <= 5) atk_p = 11.9 + (i - 1) * 0.7;
            else if (i <= 10) atk_p = 17.5 + (i - 6) * 0.7;
            else if (i <= 15) atk_p = 23.1 + (i - 11) * 0.7;
            else if (i <= 20) atk_p = 30.5 + (i - 16) * 0.7;
            else if (i <= 25) atk_p = 39.9 + (i - 21) * 1.4;
            else if (i <= 30) atk_p = 53.9 + (i - 26) * 1.4;
            else atk_p = 70;
            lv[i] = {
              atk_p: parseFloat(atk_p.toFixed(1))
            };
          }
          return lv;
        })()
      },
      "부족의 축복 2": {
        grade: "희귀",
        imgId: "RuneSprite_35",
        desc: "내 부족이 점령한 타일 위에 있을 때 유닛의 공격력 {atk_f} 체력 {hp_f} 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) lv[i] = {
            atk_f: 15 + (i - 1),
            hp_f: 375 + (i - 1) * 25
          };
          return lv;
        })()
      },

      // ===== 에픽 (id 오름차순) =====
      "치명타 확률": {
        grade: "에픽",
        imgId: "RuneSprite_4",
        desc: "유닛 치명타 확률 {prob}% 증가",
        levels: (function() {
          let lv = {};
          const v = [13, 13.3, 13.6, 13.9, 14.2, 17, 17.3, 17.6, 17.9, 18.2, 21, 21.3, 21.6, 21.9, 22.2, 25, 25.5, 26, 26.5, 27, 30, 30.5, 31, 31.5, 32, 35, 35.5, 36, 36.5, 37, 40];
          v.forEach((x, i) => lv[i + 1] = {
            prob: x
          });
          return lv;
        })()
      },
      "치명타 피해": {
        grade: "에픽",
        imgId: "RuneSprite_5",
        desc: "유닛 치명타 피해량 {crit_d}% 증가",
        levels: (function() {
          let lv = {};
          const v = [20, 20.5, 21, 21.5, 22, 25, 25.5, 26, 26.5, 27, 30, 30.5, 31, 31.5, 32, 35, 36, 37, 38, 39, 42, 43, 44, 45, 46, 50, 51, 52, 53, 54, 60];
          v.forEach((x, i) => lv[i + 1] = {
            crit_d: x
          });
          return lv;
        })()
      },
      "공격력 증가 3": {
        grade: "에픽",
        imgId: "RuneSprite_9",
        desc: "유닛 공격력 {atk_f} 증가",
        levels: (function() {
          let lv = {};
          const v = [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 62, 64, 66, 68, 75];
          v.forEach((x, i) => lv[i + 1] = {
            atk_f: x
          });
          return lv;
        })()
      },
      "체력 증가 3": {
        grade: "에픽",
        imgId: "RuneSprite_13",
        desc: "유닛 체력 {hp_f} 증가",
        levels: (function() {
          let lv = {};
          const v = [875, 900, 925, 950, 975, 1000, 1025, 1050, 1075, 1100, 1125, 1150, 1175, 1200, 1225, 1250, 1275, 1300, 1325, 1350, 1375, 1400, 1425, 1450, 1475, 1500, 1550, 1600, 1650, 1700, 1875];
          v.forEach((x, i) => lv[i + 1] = {
            hp_f: x
          });
          return lv;
        })()
      },
      "죽을 준비": {
        grade: "에픽",
        imgId: "RuneSprite_15",
        desc: "사망 시 {prob}% 확률로 현재 전투중인 유닛에게 나의 유닛의 공격력의 {burst_p}% 피해",
        levels: (function() {
          let lv = {};
          const p = [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 100];
          const v = [50, 51, 52, 53, 54, 60, 61, 62, 63, 64, 66, 67, 68, 69, 70, 76, 77, 78, 79, 80, 82, 83, 84, 85, 86, 90, 91, 92, 93, 94, 100];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            burst_p: v[i]
          });
          return lv;
        })()
      },
      "압축된 힘": {
        grade: "에픽",
        imgId: "RuneSprite_20",
        desc: "유닛의 크기가 작아지며 유닛의 공격력이 {atk_p}% 증가하고 최대 체력이 25% 감소",
        levels: (function() {
          let lv = {};
          const v = [15, 15.2, 15.4, 15.6, 15.8, 17, 17.5, 18, 18.5, 19, 22, 22.5, 23, 23.5, 24, 27, 27.5, 28, 28.5, 29, 33, 33.5, 34, 34.5, 35, 39, 39.5, 40, 40.5, 41, 45];
          v.forEach((x, i) => lv[i + 1] = {
            atk_p: x,
            hp_p: -25
          });
          return lv;
        })()
      },
      "매머드의 힘": {
        grade: "에픽",
        imgId: "RuneSprite_21",
        desc: "유닛의 크기가 커지며 유닛의 체력이 {hp_p}% 증가하고 공격력이 25% 감소",
        levels: (function() {
          let lv = {};
          const v = [19.5, 20, 20.5, 21, 21.5, 27, 27.5, 28, 28.5, 29, 34.5, 35.5, 36.5, 37.5, 38.5, 44.5, 45.8, 47, 48.3, 49.5, 59.5, 60.8, 62, 63.3, 64.5, 79.5, 80.8, 82, 83.3, 84.5, 102];
          v.forEach((x, i) => lv[i + 1] = {
            hp_p: x,
            atk_p: -25
          });
          return lv;
        })()
      },
      "파괴자 3": {
        grade: "에픽",
        imgId: "RuneSprite_32",
        desc: "건축물을 공격할 때 유닛의 공격력 {atk_p}% 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) {
            let atk_p;
            if (i <= 5) atk_p = 28.0 + (i - 1) * 0.8;
            else if (i <= 10) atk_p = 40.0 + (i - 6) * 0.8;
            else if (i <= 15) atk_p = 52.0 + (i - 11) * 1.6;
            else if (i <= 20) atk_p = 68.0 + (i - 16) * 2.0;
            else if (i <= 25) atk_p = 92.0 + (i - 21) * 2.0;
            else if (i <= 30) atk_p = 124.0 + (i - 26) * 2.0;
            else atk_p = 160.0;
            lv[i] = {
              atk_p: parseFloat(atk_p.toFixed(1))
            };
          }
          return lv;
        })()
      },
      "타이탄 가드": {
        grade: "에픽",
        imgId: "RuneSprite_39",
        desc: "보스에게 공격당할 때 피해 {red_f}만큼 감소",
        levels: (function() {
          let lv = {};
          const v = [30, 33, 36, 39, 42, 50, 53, 56, 59, 62, 70, 73, 76, 79, 82, 90, 93, 96, 99, 102, 110, 113, 116, 119, 122, 130, 135, 140, 145, 150, 160];
          v.forEach((x, i) => lv[i + 1] = {
            red_f: x
          });
          return lv;
        })()
      },

      // ===== 유니크 (id 오름차순) =====
      "흡혈": {
        grade: "유니크",
        imgId: "RuneSprite_3",
        desc: "유닛을 공격할 때 {prob}% 확률로 내 유닛 공격력의 {rec_p}% 만큼 체력 회복",
        levels: (function() {
          let lv = {};
          const p = [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 30];
          const v = [30, 32, 34, 36, 38, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 95, 97, 99, 101, 103, 110];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            rec_p: v[i]
          });
          return lv;
        })()
      },
      "강타": {
        grade: "유니크",
        imgId: "RuneSprite_10",
        desc: "유닛 공격력 {atk_p}% 증가",
        levels: (function() {
          let lv = {};
          const v = [10, 10.5, 11, 11.5, 12, 14, 14.5, 15, 15.5, 16, 18, 18.5, 19, 19.5, 20, 22, 22.5, 23, 23.5, 24, 28, 29, 30, 31, 32, 38, 39, 40, 41, 42, 50];
          v.forEach((x, i) => lv[i + 1] = {
            atk_p: x
          });
          return lv;
        })()
      },
      "방어벽": {
        grade: "유니크",
        imgId: "RuneSprite_14",
        desc: "유닛 체력 {hp_p}% 증가",
        levels: (function() {
          let lv = {};
          const v = [17.5, 18, 18.5, 19, 19.5, 25, 25.5, 26, 26.5, 27, 32.5, 33.5, 34.5, 35.5, 36.5, 42.5, 43.8, 45, 46.3, 47.5, 57.5, 58.8, 60, 61.3, 62.5, 77.5, 78.8, 80, 81.3, 82.5, 100];
          v.forEach((x, i) => lv[i + 1] = {
            hp_p: x
          });
          return lv;
        })()
      },
      "강인함 2": {
        grade: "유니크",
        imgId: "RuneSprite_36",
        desc: "건축물에게 공격당할 때 피해 {red_p}% 감소",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) {
            let red_p;
            if (i <= 5) red_p = 30.0 + (i - 1) * 0.5;
            else if (i <= 10) red_p = 35.0 + (i - 6) * 0.5;
            else if (i <= 15) red_p = 40.0 + (i - 11) * 0.5;
            else if (i <= 20) red_p = 45.0 + (i - 16) * 0.5;
            else if (i <= 25) red_p = 50.0 + (i - 21) * 0.5;
            else if (i <= 30) red_p = 55.0 + (i - 26) * 0.5;
            else red_p = 60.0;
            lv[i] = {
              red_p: parseFloat(red_p.toFixed(1))
            };
          }
          return lv;
        })()
      },
      "지진": {
        grade: "유니크",
        imgId: "RuneSprite_37",
        desc: "적 건축물 대상 {count}번째 공격마다 주변 1칸 타일에 있는 적 건축물까지 건축물 대상 최종 피해량의 {burst_p}%만큼 피해를 줍니다.",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) {
            let burst_p, count;
            count = (i >= 21) ? 3 : 4;
            if (i <= 5) burst_p = 200 + (i - 1) * 10;
            else if (i <= 10) burst_p = 270 + (i - 6) * 10;
            else if (i <= 15) burst_p = 340 + (i - 11) * 10;
            else if (i <= 20) burst_p = 410 + (i - 16) * 10;
            else if (i <= 25) burst_p = 450 + (i - 21) * 10;
            else if (i <= 30) burst_p = 530 + (i - 26) * 10;
            else burst_p = 600;
            lv[i] = {
              burst_p: burst_p,
              count: count
            };
          }
          return lv;
        })()
      },
      "보스 슬레이어": {
        grade: "유니크",
        imgId: "RuneSprite_38",
        desc: "보스를 공격할 때 유닛의 공격력 {atk_p}% 증가",
        levels: (function() {
          let lv = {};
          const v = [20, 22, 24, 26, 28, 40, 42, 44, 46, 48, 60, 62, 64, 66, 68, 80, 83, 86, 89, 92, 110, 115, 120, 125, 130, 150, 160, 170, 180, 190, 250];
          v.forEach((x, i) => lv[i + 1] = {
            atk_p: x
          });
          return lv;
        })()
      },
      // 21레벨부터 2단계 임계값이 30%->40%로 올라감(사용자 확인) - hp_p2를 레벨별로 직접 갖고
      // 있어서 desc의 {hp_p2}도 레벨에 맞춰 자동으로 30/40이 표시됨
      "광전사의 분노": {
        grade: "유니크",
        imgId: "RuneSprite_41",
        desc: "체력이 {hp_p1}% 이하일 때 공격력이 {atk_p1}% 증가하며, 체력이 {hp_p2}% 이하일 때 공격력이 추가로 {atk_p2}% 증가",
        levels: (function() {
          let lv = {};
          const a1 = [11.0, 12.0, 12.0, 13.0, 13.0, 15.0, 16.0, 17.0, 17.0, 18.0, 20.0, 20.0, 21.0, 22.0, 22.0, 24.0, 25.0, 25.0, 26.0, 26.0, 31.0, 32.0, 33.0, 34.0, 35.0, 42.0, 43.0, 44.0, 45.0, 46.0, 55.0];
          const a2 = [8.5, 9.0, 9.5, 9.5, 10.5, 12.0, 12.5, 12.5, 13.5, 13.5, 15.0, 16.0, 16.0, 16.5, 17.0, 19.0, 19.0, 19.5, 20.0, 20.5, 21.0, 22.0, 22.5, 23.5, 24.0, 28.5, 29.5, 30.0, 31.0, 31.5, 37.5];
          a1.forEach((x, i) => lv[i + 1] = {
            hp_p1: 60,
            atk_p1: x,
            hp_p2: (i + 1) <= 20 ? 30 : 40,
            atk_p2: a2[i]
          });
          return lv;
        })()
      },

      // ===== 전설 (id 오름차순) =====
      "메테오": {
        grade: "전설",
        imgId: "RuneSprite_1",
        // 21레벨부터 "주변 타일 추가 피해" 설명 한 줄이 더 붙음
        desc: (level) => {
          const area = level >= 21 ? "\n*주변 타일에 있는 모든 적에게 {area_burst_p}% 추가 스킬 피해" : "";
          return `유닛을 공격할 때 {prob}% 확률로 현재 타일에 있는 모든 적에게 공격력의 {burst_p}% 스킬 추가 피해${area}\n레전더리 패시브 : 공격력 {atk_p}%, 체력 {hp_p}% 증가`;
        },
        levels: (function() {
          let lv = {};
          const p = [50, 50, 50, 50, 50, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 60, 60, 60, 60, 60, 65, 65, 65, 65, 65, 65];
          const v = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 40, 41, 42, 43, 44, 50, 51, 52, 53, 54, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 80];
          const pas = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 10];
          // 21레벨부터: 현재 타일 피해와 별개로 주변 타일의 모든 적에게도 추가 스킬 피해
          const areaBurst = { 21: 10, 22: 11, 23: 12, 24: 13, 25: 14, 26: 18, 27: 19, 28: 20, 29: 21, 30: 22, 31: 25 };
          p.forEach((x, i) => {
            const level = i + 1;
            lv[level] = {
              prob: x,
              burst_p: v[i],
              atk_p: pas[i],
              hp_p: pas[i]
            };
            if (areaBurst[level] !== undefined) {
              lv[level].area_burst_p = areaBurst[level];
            }
          });
          return lv;
        })()
      },
      "낙뢰": {
        grade: "전설",
        imgId: "RuneSprite_2",
        // 21레벨부터 "즉사" 설명 한 줄이 더 붙음
        desc: (level) => {
          const insta = level >= 21 ? "\n*상대 체력이 {insta_hp}% 미만일 경우 {insta_prob}%확률로 즉사" : "";
          return `유닛을 공격할 때 {prob}% 확률로 전투중인 상대 유닛에게 {burst_p}% 스킬 추가 피해${insta}\n레전더리 패시브 : 공격력 {atk_p}%, 체력 {hp_p}% 증가`;
        },
        levels: (function() {
          let lv = {};
          const p = [40, 40, 40, 40, 40, 45, 45, 45, 45, 45, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 60, 60, 60, 60, 60, 65, 65, 65, 65, 65, 65];
          const v = [60, 61, 62, 63, 64, 75, 76, 77, 78, 79, 100, 101, 102, 103, 104, 124, 125, 126, 127, 128, 135, 136, 137, 138, 139, 150, 151, 152, 153, 154, 170];
          const pas = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 10];
          // 21레벨부터: 타이탄 체력이 일정 % 미만이면 확률적으로 즉사시키는 효과 추가
          const instaHp = { 21: 15, 22: 16, 23: 17, 24: 18, 25: 19, 26: 20, 27: 21, 28: 22, 29: 23, 30: 24, 31: 30 };
          const instaProb = { 21: 20, 22: 20, 23: 20, 24: 20, 25: 20, 26: 25, 27: 25, 28: 25, 29: 25, 30: 25, 31: 30 };
          p.forEach((x, i) => {
            const level = i + 1;
            lv[level] = {
              prob: x,
              burst_p: v[i],
              atk_p: pas[i],
              hp_p: pas[i]
            };
            if (instaHp[level] !== undefined) {
              lv[level].insta_hp = instaHp[level];
              lv[level].insta_prob = instaProb[level];
            }
          });
          return lv;
        })()
      },
      // 신규 룬(2026-09-02 추가) - 메테오와 완전히 같은 "현재 타일 전체 + 주변 타일 추가 피해"
      // 구조(사용자 확정). 실제 게임은 "주위 6개 타일 중 무작위로 side_tile_count개"(25레벨까지 1개,
      // 26레벨부터 2개)에 추가로 맞지만, 이 사이트의 공룡 대전 엔진은 "대기 육각형" 딱 1개만 그
      // 후보가 될 수 있는 3타일 구조라(js/core/simulation-dino-battle.js 참고) side_tile_count/6
      // 확률로 근사함. 타이탄은 "직접 때리는 피해"(burst_p)만 적용되고 주변 타일 부분은 애초에
      // 해당 없음(보스 1마리뿐), 아레나는 5마리가 전부 "하나의 타일"이라 메테오와 완전히 동일하게
      // 취급됨(사용자 확정, js/core/simulation-arena.js/simulation-titan.js 참고). 건물/허수아비는
      // 설명에 "유닛을 공격할 때"라고 명시돼 있어 부적합 룬 목록에 포함(사용자 확정)
      "가시": {
        grade: "전설",
        imgId: "RuneSprite_40",
        desc: "유닛을 공격할 때 {prob}% 확률로 현재 타일에 있는 모든 적에게 공격력의 {burst_p}% 스킬 추가 피해, 주위 6개 타일 중 겹치지 않는 무작위 {side_tile_count}개 타일에도 같은 확률로 공격력의 {burst_p}% 스킬 추가 피해\n레전더리 패시브 : 공격력 {atk_p}%, 체력 {hp_p}% 증가",
        levels: (function() {
          let lv = {};
          const p = [70, 70, 70, 70, 70, 75, 75, 75, 75, 75, 80, 80, 80, 80, 80, 85, 85, 85, 85, 85, 90, 90, 90, 90, 90, 95, 95, 95, 95, 95, 100];
          const v = [5.5, 6, 6.5, 7, 7.5, 8.5, 9, 10, 11, 12, 13, 14, 15, 16, 17, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 26, 27, 28, 29, 30, 32];
          const pas = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 10];
          p.forEach((x, i) => {
            const level = i + 1;
            lv[level] = {
              prob: x,
              burst_p: v[i],
              side_tile_count: level >= 26 ? 2 : 1,
              atk_p: pas[i],
              hp_p: pas[i]
            };
          });
          return lv;
        })()
      },
    };
    //룬 데이터 종료

// 타이탄전에 적합하지 않은 룬 목록 (UI에서 별도 그리드로 분리 표시)
const UNSUITABLE_RUNE_LIST = [
  "강인함 1",
  "강인함 2",
  "승리의 함성",
  "파괴자 1",
  "파괴자 2",
  "파괴자 3",
  "지진"
];

// 공룡 대전(공룡 vs 공룡)에 적합하지 않은 룬 목록. 타이탄전 목록과는 기준이 다름
// (예: 자연의 포옹/부족의 축복은 여기선 적합하지만, 보스 전용 룬인 타이탄 가드/보스 슬레이어는 부적합)
const DINO_BATTLE_UNSUITABLE_RUNE_LIST = [
  "파괴자 1",
  "파괴자 2",
  "파괴자 3",
  "강인함 1",
  "강인함 2",
  "타이탄 가드",
  "지진",
  "보스 슬레이어"
];

// 아레나(5:5 진영전)에 적합하지 않은 룬 목록. 아레나는 "타일" 개념 자체가 없어서(항상 고정 1:1
// 매치, 배치 방식/버프 타워 없음) 공룡 대전에선 적합한 자연의 포옹/부족의 축복도 여기선 부적합함
const ARENA_UNSUITABLE_RUNE_LIST = [
  "자연의 포옹",
  "강인함 1",
  "강인함 2",
  "파괴자 1",
  "파괴자 2",
  "파괴자 3",
  "부족의 축복 1",
  "부족의 축복 2",
  "타이탄 가드",
  "지진",
  "보스 슬레이어"
];

// 허수아비(건축물 판정 단일 대상)에 적합하지 않은 룬 목록. 적합한 룬(자연의 포옹/파괴자 1·2·3/
// 부족의 축복 1·2/공격력 증가 1·2·3/협동 공격/치명타 확률·피해/압축된 힘/강타/광전사의 분노) 15개를
// 빼고 전부 부적합 처리 - 대부분 사망/타일 배치/보스 전용 등 허수아비 시나리오와 무관한 룬들.
// 트리플 임팩트는 건축물 대상 공격에는 적용되지 않는 것으로 확인되어 부적합으로 옮김
const DUMMY_UNSUITABLE_RUNE_LIST = [
  "힐",
  "체력 증가 1",
  "희생",
  "마지막 선물",
  "승리의 함성",
  "트리플 임팩트",
  "단단한 피부 1",
  "피해 저항 1",
  "보호막",
  "강인함 1",
  "체력 증가 2",
  "고독한 분노",
  "단단한 피부 2",
  "피해 저항 2",
  "체력 증가 3",
  "죽을 준비",
  "매머드의 힘",
  "타이탄 가드",
  "흡혈",
  "방어벽",
  "강인함 2",
  "지진",
  "보스 슬레이어",
  "메테오",
  "낙뢰",
  "가시"
];

// 건물(#building) 페이지용 - 사용자가 직접 확정한 목록(허수아비 목록과는 다름 - 예를 들어
// 부족의 축복 1·2는 허수아비엔 적합했지만 건물엔 부적합, 체력 증가/강인함류는 반대로 건물엔
// 적합함). 나머지 룬은 전부 적합으로 취급
const BUILDING_UNSUITABLE_RUNE_LIST = [
  "메테오",
  "낙뢰",
  "가시",
  "흡혈",
  "보스 슬레이어",
  "죽을 준비",
  "타이탄 가드",
  "단단한 피부 1",
  "단단한 피부 2",
  "피해 저항 1",
  "피해 저항 2",
  "부족의 축복 1",
  "부족의 축복 2",
  "힐",
  "승리의 함성",
  "트리플 임팩트",
  "보호막"
];

// 건물 전체 목록 + 체력(사용자 확정, assets/tribe/ 실제 파일과 전부 대조 완료). locked: true인
// 2종(대미지/체력 버프 타워)은 사용자 확인상 인게임에 아직 안 풀린 건물이라 선택 그리드엔 보이되
// 고를 수 없게 잠가둠(building-page.js의 건설 모달 참고)
//
// anchorX/anchorY: 이 이미지에서 "육각형 중심(발밑)"에 와야 하는 지점의 좌표(사용자가 직접 측정해서
// 준 값 - 이미지 왼쪽 위 기준 %). 예전엔 발밑 정렬(-50%,-100%) 기준으로 알파채널 여백/그림자
// 방향을 하나하나 어림짐작으로 보정했는데(투명 여백 있는 UI 아이콘은 떠 보이고, 그림자가 오른쪽에
// 있는 벽/짚더미는 왼쪽으로 치우쳐 보이고, 부족 본부처럼 원근감이 있는 그림은 뒤로 밀려 보이는 등
// 사진마다 원인이 다 달라서), 매번 스크린샷 찍고 다시 재는 식으로는 정확히 안 맞았음 - 이제 이미지
// 좌표를 직접 앵커로 써서(translate(-anchorX%, -anchorY%)) 그런 보정이 전부 필요 없어짐.
//
// scale은 전부 제거함(사용자 확정 - "일단은 모든 이미지 파일들 크기는 원본으로 해놔봐") - 예전엔
// UI 아이콘(작음)과 실제 에셋(큼)이 섞여있어서 건물마다 2배/1.7배 배율을 따로 줬었는데, 지금은
// assets/tribe/ 전체를 실제 에셋으로 통일해서(UIIcon 파일 전부 교체됨) 배율 없이 전부 같은
// 기준(.building-sprite의 clamp)으로 그려도 됨
// labelKey: i18n.js의 t()로 표시할 때 쓰는 번역 키(js/core/i18n.js가 main.js의 DOMContentLoaded에서
// initI18n()으로 로드되기 전에 이 파일이 먼저 파싱되므로, 여기서 t()를 직접 호출해 label을 채우면
// 안 됨 - label 자체는 항상 한국어 원문 그대로 두고, 화면에 보여줄 때만 labelKey로 번역함)
const BUILDING_TYPES = [
  { id: "alarm_tower", label: "알람 타워", labelKey: "building.type.alarmTower", img: "AlarmTower.png", hp: 1500000, anchorX: 37.57, anchorY: 78.25 },
  { id: "ammo_distributor", label: "탄 분배기", labelKey: "building.type.ammoDistributor", img: "AmmoDistributor.png", hp: 3000000, anchorX: 45.28, anchorY: 77.02 },
  // 캐터펄트(사용자 확정 - 체력값 4종). 원본 PNG 4장이 다른 건물 에셋들과 달리 실제 그림 주위에
  // 여백이 많이 남아있어서(사용자 지적 - "다른 이미지들은... 크게 보이는데 캐터필드는... 작게
  // 보여") 처음엔 여기서 자동으로 알파 bbox 기준 크롭 + 좌표 재계산을 했었는데, 이후 사용자가
  // 직접 "최대한 여백 없이" 다시 잘라 에셋 파일 자체를 교체하고 그 새 크롭 기준으로 4장 각각
  // 실측한 좌표를 줬음 - 그 값을 그대로 반영(자동 계산값 폐기, 4장 전부 서로 다름)
  { id: "catapult_wood", label: "투석기 Lv.1", labelKey: "building.type.catapultLv1", img: "Catapult_Wood.png", hp: 1500000, anchorX: 60.66, anchorY: 66.05 },
  { id: "catapult_stone", label: "투석기 Lv.2", labelKey: "building.type.catapultLv2", img: "Catapult_Stone.png", hp: 2000000, anchorX: 59.47, anchorY: 67.59 },
  { id: "catapult_metal", label: "투석기 Lv.3", labelKey: "building.type.catapultLv3", img: "Catapult_Metal.png", hp: 3000000, anchorX: 60.19, anchorY: 67.45 },
  { id: "catapult_realmetal", label: "투석기 Lv.4", labelKey: "building.type.catapultLv4", img: "Catapult_RealMetal.png", hp: 4500000, anchorX: 60.19, anchorY: 67.45 },
  // 공격력/체력 버프 타워 - 적 부족이 이미 세워둔 걸 우리가 부술 수도 있는 상황이라 잠금 해제
  // (사용자 확정 - 체력값도 이미 둘 다 확정해서 줬었음)
  { id: "damage_buff_tower", label: "공격력 버프 타워", labelKey: "building.type.damageBuffTower", img: "DamageBuffTower.png", hp: 3000000, anchorX: 33.14, anchorY: 90.14 },
  { id: "hp_buff_tower", label: "체력 버프 타워", labelKey: "building.type.hpBuffTower", img: "HpBuffTower.png", hp: 3000000, anchorX: 33.14, anchorY: 90.14 },
  { id: "base", label: "둥지", labelKey: "building.type.base", img: "Tribe_Base_Icon.png", hp: 50000, anchorX: 50.00, anchorY: 67.19 },
  { id: "notice_board", label: "부족 게시판", labelKey: "building.type.noticeBoard", img: "Noticeboard.png", hp: 1500000, anchorX: 39.58, anchorY: 98.01 },
  { id: "portal_blue", label: "전쟁 포탈", labelKey: "building.type.portalBlue", img: "Tribe_Tribeportal_Blue.png", hp: 5, anchorX: 49.02, anchorY: 82.23 },
  { id: "portal_green", label: "부족 포탈", labelKey: "building.type.portalGreen", img: "Tribe_Tribeportal_Green.png", hp: 3000000, anchorX: 49.02, anchorY: 82.23 },
  { id: "lv1", label: "벽 Lv.1", labelKey: "building.type.wallLv1", img: "Tribe_Wall_Lv1.png", hp: 7000000, anchorX: 36.57, anchorY: 94.41 },
  { id: "lv2", label: "벽 Lv.2", labelKey: "building.type.wallLv2", img: "Tribe_Wall_Lv2.png", hp: 12000000, anchorX: 36.57, anchorY: 94.41 },
  // Lv3/Lv4는 게임 업데이트로 새로 풀림(사용자 확정, 체력 2000만/3000만) - anchorX/Y는 아직
  // 실측 좌표를 안 주셔서 같은 벽 시리즈인 Lv1/Lv2 값을 임시로 재사용함(모양이 비슷할 가능성이
  // 높아서) - 실제로 안 맞으면 정확한 좌표로 교체 필요
  { id: "lv3", label: "벽 Lv.3", labelKey: "building.type.wallLv3", img: "Tribe_Wall_Lv3.png", hp: 20000000, anchorX: 36.57, anchorY: 94.41 },
  { id: "lv4", label: "벽 Lv.4", labelKey: "building.type.wallLv4", img: "Tribe_Wall_Lv4.png", hp: 30000000, anchorX: 36.57, anchorY: 94.41 },
  { id: "warehouse", label: "부족 본부", labelKey: "building.type.warehouse", img: "Tribe_WareHouse.png", hp: 300000, anchorX: 47.43, anchorY: 80.90 },
  { id: "straw_wall", label: "짚더미", labelKey: "building.type.strawWall", img: "StrawWall.png", hp: 3000000, anchorX: 42.19, anchorY: 69.34 }
];

// 흡혈량 계산 시 공격력 보너스에서 제외되는 룬 목록 (오버밸런스 방지용)
const VAMP_EXCLUSION_LIST = [
  "고독한 분노",
  "협동 공격",
  "마지막 선물",
  "보스 슬레이어"
];

// 동시 장착 불가능한 룬 쌍(둘 다 들어있으면 안 됨)
const MUTUALLY_EXCLUSIVE_RUNE_PAIRS = [
  ["압축된 힘", "매머드의 힘"]
];

// 저장된 룬 슬롯 배열에서 상호 배타 쌍이 동시에 들어있으면 뒤쪽 슬롯의 룬을 제거해서 정합성을 맞춤
function sanitizeRuneConflicts(runes) {
  if (!runes) return runes;
  const result = runes.map((r) => (r ? { ...r } : null));
  MUTUALLY_EXCLUSIVE_RUNE_PAIRS.forEach(([a, b]) => {
    const idxA = result.findIndex((r) => r && r.name === a);
    const idxB = result.findIndex((r) => r && r.name === b);
    if (idxA !== -1 && idxB !== -1) {
      if (idxA < idxB) result[idxB] = null;
      else result[idxA] = null;
    }
  });
  return result;
}
