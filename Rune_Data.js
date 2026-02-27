    const RUNES_DATA = {
      "힐": {
        grade: "일반",
        imgId: "10kOU5_hHneBmIpMJ-Hx0FuN-UanR5FDN",
        desc: "유닛에게 공격당할 때 {prob}% 확률로 내 유닛 최대 체력의 {rec_p}% 회복",
        levels: (function() {
          let lv = {};
          const p = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 13];
          const v = [1, 1.1, 1.2, 1.3, 1.4, 2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.5, 3.6, 3.7, 3.8, 3.9, 4, 4.1, 4.2, 4.3, 4.4, 5, 5.1, 5.2, 5.3, 5.4, 8];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            rec_p: v[i]
          });
          return lv;
        })()
      },
      "공격력 증가 1": {
        grade: "일반",
        imgId: "1ihowBMqeNvWag_4ou2JLgYilpLGvgnPa",
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
        imgId: "1vNpdtLIozfnNOhjl2-gIMFH33xLmgh3P",
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
        imgId: "1Yuy6PLeo7Jx-fAef04PVuqmiZjR_mw64",
        desc: "사망 시 {prob}% 확률로 같은 타일에 있는 동일 부족 소속의 유닛에게 나의 유닛 최대 체력의 {rec_p}% 회복",
        levels: (function() {
          let lv = {};
          const p = [35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 50];
          const v = [10, 10.5, 11, 11.5, 12, 15, 15.5, 16, 16.5, 17, 20, 20.5, 21, 21.5, 22, 25, 25.5, 26, 26.5, 27, 30, 30.5, 31, 31.5, 32, 35, 35.5, 36, 36.5, 37, 45];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            rec_p: v[i]
          });
          return lv;
        })()
      },
      "마지막 선물": {
        grade: "일반",
        imgId: "16X52VhA2_Z-UFH6bNFdqA_XkXwPdWZJg",
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
      "트리플 임팩트": {
        grade: "일반",
        imgId: "1nO4CtfdB_FH7ZvCmL3uj1QPLDJte5mLB",
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
        imgId: "1oHu7Ep7BwL7Es4dBRVdTyfnSrfd_xIq1",
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
        imgId: "1tBCAdO-UyCTP32gHwEc7TVISeRINsrqa",
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
        imgId: "1-FCajygUymZcpCCxaK7_Scg5NtiPKyiM",
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
      "공격력 증가 2": {
        grade: "희귀",
        imgId: "1PKky7_H1ZXJNxzZJhByTw7hUclQ0aTRG",
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
        imgId: "1oIkxrSL3mVZo-fHXOv2Ot2Zmmftwpp3H",
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
        imgId: "1DzFWPRILgHZAF28JrzUzKZQWKCtAN2vR",
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
        imgId: "1hAyyAwatFwvlKqth4sunU_gURWoTY4ZJ",
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
        imgId: "1XfdIrPSz_xm9v1KHB-TArpaRdv47zHLF",
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
        imgId: "13As5kbKRnyJA81fUClKxILhq8P9Rws0c",
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
      "치명타 확률": {
        grade: "에픽",
        imgId: "1rZUa6JfGfbksXt1qOO32veoEty9er_Bu",
        desc: "유닛 치명타 확률 {prob}% 증가",
        levels: (function() {
          let lv = {};
          const v = [13, 13.3, 13.6, 13.9, 14.2, 17, 17.3, 17.6, 17.9, 18.2, 21, 21.3, 21.6, 21.9, 22.2, 25, 25.5, 26, 26.5, 27, 30, 30.5, 31, 31.5, 32, 35, 35.5, 36, 36.5, 37, 40];
          v.forEach((x, i) => lv[i + 1] = {
            crit_p: x
          });
          return lv;
        })()
      },
      "치명타 피해": {
        grade: "에픽",
        imgId: "127l8ExJLlQENOySkwk_TiNDLO5gKo7Rm",
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
        imgId: "1MBbzM8Snw4awmVoS-mBe1ATN_WlkcwqL",
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
        imgId: "1r_tPl7V2ydsAD3p_amPfL1d92i-6AFLN",
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
        imgId: "1x77384PZAogZ_hTJeRH1iLXPrOfM5e_g",
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
        imgId: "1aaijjlcR-GjrDeZy4WzBqFN2J7oBiw2C",
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
        imgId: "14UVrJVEIr5xZghRiG96doS_QhOQ0VxBK",
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
      "흡혈": {
        grade: "유니크",
        imgId: "1wpM4jrjnyShM9jkrWQuleCMRQzqajRg-",
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
        imgId: "1duFRCFWSfwJIT4FcOfDcJU5t9_sYYSNd",
        desc: "유닛 공격력 {atk_p}% 증가",
        levels: (function() {
          let lv = {};
          const v = [7, 7.2, 7.4, 7.6, 7.8, 10, 10.2, 10.4, 10.6, 10.8, 13, 13.4, 13.8, 14.2, 14.6, 17, 17.5, 18, 18.5, 19, 23, 23.5, 24, 24.5, 25, 31, 31.5, 32, 32.5, 33, 40];
          v.forEach((x, i) => lv[i + 1] = {
            atk_p: x
          });
          return lv;
        })()
      },
      "방어벽": {
        grade: "유니크",
        imgId: "19nNX-o2m8lDQfKLe5YXd7JijVf7HK0iI",
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
      "보스 슬레이어": {
        grade: "유니크",
        imgId: "1UaNaWoiuUASIRx62ixYoUTleH-wc_gFI",
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
      "메테오": {
        grade: "전설",
        imgId: "1fJVyoKiTVH1i0votjXaXuwAbTZjxnM-P",
        desc: "유닛을 공격할 때 {prob}% 확률로 현재 타일에 있는 모든 적에게 공격력의 {burst_p}% 스킬 추가 피해\n레전더리 패시브 : 공격력 {atk_p}%, 체력 {hp_p}% 증가",
        levels: (function() {
          let lv = {};
          const p = [50, 50, 50, 50, 50, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 60, 60, 60, 60, 60, 65];
          const v = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 40, 41, 42, 43, 44, 50, 51, 52, 53, 54, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 80];
          const pas = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 10];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            burst_p: v[i],
            atk_p: pas[i],
            hp_p: pas[i]
          });
          return lv;
        })()
      },
      "낙뢰": {
        grade: "전설",
        imgId: "1pPUwyTblvZJDbTAPUOJYr8hdUqPTZmy4",
        desc: "유닛을 공격할 때 {prob}% 확률로 전투중인 상대 유닛에게 {burst_p}% 스킬 추가 피해\n레전더리 패시브 : 공격력 {atk_p}%, 체력 {hp_p}% 증가",
        levels: (function() {
          let lv = {};
          const p = [40, 40, 40, 40, 40, 45, 45, 45, 45, 45, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 60, 60, 60, 60, 60, 65, 65, 65, 65, 65, 65];
          const v = [40, 40.5, 41, 41.5, 42, 50, 50.5, 51, 51.5, 52, 67.5, 68, 68.5, 69, 69.5, 82.5, 83, 83.5, 84, 84.5, 90, 90.5, 91, 91.5, 92, 100, 100.5, 101, 101.5, 102, 115];
          const pas = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 10];
          p.forEach((x, i) => lv[i + 1] = {
            prob: x,
            burst_p: v[i],
            atk_p: pas[i],
            hp_p: pas[i]
          });
          return lv;
        })()
      },
      // 부적합 룬 목록 (데이터 추가됨)
      "승리의 함성": {
        grade: "일반",
        imgId: "1kdYTPMnC9sHD_xVfJ7KlMEAmepKrI5U3",
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
        imgId: "11shDd_9139ob8f3NJpu51kASPqzfDZTF",
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
      "파괴자 1": {
        grade: "일반",
        imgId: "1gEKQmAPtu3APq91BSK7YlUldIkPQQKV3",
        desc: "건축물을 공격할 때 유닛의 공격력 {atk_p}% 증가",
        levels: (function() {
          let lv = {};
          for (let i = 1; i <= 31; i++) {
            let atk_p;
            if (i <= 5) atk_p = 5.1 + (i - 1) * 3;
            else if (i <= 10) atk_p = 7.5 + (i - 6) * 3;
            else if (i <= 15) atk_p = 9.9 + (i - 11) * 3;
            else if (i <= 20) atk_p = 13.2 + (i - 16) * 3;
            else if (i <= 25) atk_p = 17.1 + (i - 21) * 6;
            else if (i <= 30) atk_p = 23.1 + (i - 26) * 6;
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
        imgId: "1USRrGEG4SiMnOwYYV_IYy0hllT6fXNhN",
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
        imgId: "19K30pdy48M0_TW7kR5Iz8Cxbx5NxYVkX",
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
      "파괴자 2": {
        grade: "희귀",
        imgId: "1XWpJQ3PShBg43fHvfVgf1f8t0pDoD5mj",
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
        imgId: "1EIJibIbgJ2EXyMhJT59cSWNACb-ROxxv",
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
      "파괴자 3": {
        grade: "에픽",
        imgId: "1sSwqcPHGFhZIR1i-UfwHuU34NvvDPwN2",
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
      "강인함 2": {
        grade: "유니크",
        imgId: "12R07txrHKhMhwoxbE4M-QBw4mxxOUTxf",
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
        imgId: "1qH0wEmw_otlxQBBofd-H4kuA2SMKIVKn",
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
    };
    //룬 데이터 종료
