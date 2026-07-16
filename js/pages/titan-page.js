function renderTitanPage(container) {
  container.innerHTML = `
    <div class="warning">※ 본 시뮬레이터는 참고용이며, 실제 연산 방식과 차이가 있을 수 있습니다.</div>

    <div id="myDinoSection"></div>

    <div class="card">
      <h2>관련 수치</h2>
      <div class="metrics-grid" id="metricsGrid">
        <button type="button" class="metric-tile" data-metric="basicDmg">
          <div class="metric-label">평타 대미지</div>
          <div class="metric-value" id="metricBasicDmg">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="skillDmg">
          <div class="metric-label">스킬 대미지</div>
          <div class="metric-value" id="metricSkillDmg">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="atkAmp">
          <div class="metric-label">공격력 증폭량</div>
          <div class="metric-value" id="metricAtkAmp">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="finalAvgDmg">
          <div class="metric-label">최종 평균 대미지</div>
          <div class="metric-value" id="metricFinalAvgDmg">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="reduction">
          <div class="metric-label">대미지 감소량</div>
          <div class="metric-value" id="metricReduction">0</div>
        </button>
        <button type="button" class="metric-tile" data-metric="recovery">
          <div class="metric-label">회복량</div>
          <div class="metric-value" id="metricRecovery">0</div>
        </button>
      </div>
      <div class="metric-detail" id="metricDetail" style="display:none;"></div>
    </div>

    <div class="card">
      <h2>전투 설정</h2>
      <div class="input-grid">
        <div class="full-width">
          <label>타이탄 레벨 선택</label>
          <div class="custom-dropdown" id="titanDropdown">
            <div class="selected-value" id="titanSelectedValue">Lv.1 (ATK 5 / HP 2,500,000)</div>
            <ul class="dropdown-list" id="titanList"></ul>
          </div>
        </div>
        <div class="full-width">
          <label>전투 제한 시간</label>
          <div class="custom-dropdown" id="timeDropdown">
            <div class="selected-value" id="timeSelectedValue">90분</div>
            <ul class="dropdown-list" id="timeList"></ul>
          </div>
        </div>
      </div>

      <div class="setting-list">
        <div class="setting-row">
          <div class="setting-label">타이탄과의 거리</div>
          <div class="affix-input has-suffix setting-control"><input type="tel" id="fDistance" value="1"><span class="affix-suffix">타일</span></div>
        </div>
        <div class="setting-row">
          <div class="setting-label">연속 전투</div>
          <label class="switch"><input type="checkbox" id="continuousToggle"><span class="slider round"></span></label>
        </div>
      </div>
    </div>

    <button class="btn-simulate" id="simulateBtn">시뮬레이션 시작</button>

    <div id="battleReport" class="card report-box">
      <h2>시뮬레이션 결과</h2>
      <div class="report-grid">
        <div class="report-tile"><div class="metric-label">총 입힌 피해량</div><div class="metric-value accent" id="repTotalDmg">0</div></div>
        <div class="report-tile"><div class="metric-label">남은 타이탄 체력</div><div class="metric-value accent" id="repTitanHp">0</div></div>
        <div class="report-tile"><div class="metric-label">평균 생존 시간</div><div class="metric-value" id="repTime">0</div></div>
        <div class="report-tile"><div class="metric-label">평균 공룡 사망 수</div><div class="metric-value" id="repDead">0</div></div>
      </div>
      <div class="report-chart-section">
        <div class="report-chart-label">시간대별 공룡 체력 변화 추이</div>
        <div class="report-chart-box">
          <canvas id="hpChart"></canvas>
        </div>
        <div id="avgMinHpPer" class="report-survival">평균 생존 체력: 0%</div>
      </div>
    </div>
  `;

  initTitanPage();
}

function initTitanPage() {
  const CONFIG_KEY = "dino_sim_config_titan";
  let lastMetrics = null;
  let activeMetricKey = null;

  // 내 공룡 설정 페이지를 그대로 이 자리에 임베드. 타이탄에 부적합한 룬은 구분선 아래 흐리게 표시됨.
  // 값이 바뀔 때마다(onChange) "관련 수치" 카드도 같이 다시 계산함
  renderMyDinoPage(document.getElementById("myDinoSection"), {
    unsuitableList: UNSUITABLE_RUNE_LIST,
    unsuitableLabel: "타이탄에 적합하지 않은 룬입니다",
    onChange: () => refreshMetricsCard()
  });

  // "관련 수치" 카드: 5개 항목을 누르면 그 항목에 관여하는 룬들의 개별 계산값을 아래에 펼쳐 보여줌
  function initMetricsCard() {
    document.querySelectorAll(".metric-tile").forEach((tile) => {
      tile.onclick = () => {
        const key = tile.dataset.metric;
        activeMetricKey = activeMetricKey === key ? null : key;
        document.querySelectorAll(".metric-tile").forEach((t) => t.classList.toggle("active", t.dataset.metric === activeMetricKey));
        renderMetricDetail();
      };
    });
  }

  // 0이면(해당 룬 미장착 등 기본 상태) 흰색, 0이 아니면(변화가 생겼으면) 노란색
  function setMetricTile(id, value) {
    const el = document.getElementById(id);
    const rounded = Math.round(value);
    el.innerText = rounded.toLocaleString();
    el.classList.toggle("value-changed", rounded !== 0);
  }

  function refreshMetricsCard() {
    const dino = getMyDinoBattleInputs();
    lastMetrics = getTitanCombatMetrics(dino);
    const finalAvgDmg = lastMetrics.avgHitDamage + lastMetrics.skillDmgTotal;
    setMetricTile("metricBasicDmg", lastMetrics.avgHitDamage);
    setMetricTile("metricSkillDmg", lastMetrics.skillDmgTotal);
    setMetricTile("metricAtkAmp", lastMetrics.atkAmpGain);
    setMetricTile("metricFinalAvgDmg", finalAvgDmg);
    setMetricTile("metricReduction", lastMetrics.reductionTotal);
    setMetricTile("metricRecovery", lastMetrics.recoveryTotal);
    renderMetricDetail();
  }

  function renderMetricDetail() {
    const box = document.getElementById("metricDetail");
    if (!activeMetricKey || !lastMetrics) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }
    const m = lastMetrics;
    let title = "";
    let rows = [];

    if (activeMetricKey === "basicDmg") {
      title = "평타 대미지 계산 내역";
      rows = [
        { label: "증폭 전 공격력", value: Math.round(m.finalAtk).toLocaleString() },
        { label: "증폭 후 공격력", value: Math.round(m.ampFinalAtk).toLocaleString() },
        { label: "치명타 확률", value: `${m.cRate.toFixed(2)}%` },
        { label: "치명타 피해", value: `${m.cDmg.toFixed(2)}%` }
      ];
    } else if (activeMetricKey === "atkAmp") {
      title = "공격력 증폭 내역";
      if (m.bossSlayerPercent > 0) {
        rows = [{ label: `보스 슬레이어 (증폭 +${m.bossSlayerPercent.toFixed(2)}%)`, value: `+${Math.round(m.atkAmpGain).toLocaleString()}` }];
      }
    } else if (activeMetricKey === "skillDmg") {
      title = "스킬 대미지 내역";
      rows = m.skillDetails.map((d) => ({ label: d.name, value: Math.round(d.avgDmg).toLocaleString() }));
    } else if (activeMetricKey === "finalAvgDmg") {
      title = "최종 평균 대미지 계산 내역";
      rows = [
        { label: "평타 대미지", value: Math.round(m.avgHitDamage).toLocaleString() },
        { label: "스킬 대미지 합계", value: Math.round(m.skillDmgTotal).toLocaleString() }
      ];
    } else if (activeMetricKey === "reduction") {
      title = "대미지 감소 내역";
      rows = m.reductions.map((r) => {
        if (r.type === "shield") {
          return { label: `${r.name} (${r.turn}회 ${r.red_p}% 감소)`, value: "-" };
        }
        return {
          label: r.type === "flat" ? r.name : `${r.name} (${r.prob}% 확률)`,
          value: Math.round(r.avg).toLocaleString()
        };
      });
    } else if (activeMetricKey === "recovery") {
      title = "회복량 내역";
      rows = m.recoveries.map((r) => ({
        label: `${r.name} (${r.prob}% 확률)`,
        value: Math.round(r.avg).toLocaleString()
      }));
    }

    if (rows.length === 0) {
      box.innerHTML = `<div class="metric-detail-title">${title}</div><div class="metric-detail-empty">장착된 관련 룬이 없습니다</div>`;
    } else {
      box.innerHTML = `<div class="metric-detail-title">${title}</div>${rows
        .map((r) => `<div class="metric-detail-row"><span>${r.label}</span><span>${r.value}</span></div>`)
        .join("")}`;
    }
    box.style.display = "block";
  }

  initMetricsCard();
  refreshMetricsCard();

  // 타이탄 레벨 커스텀 드롭다운
  const titanList = document.getElementById("titanList");
  const titanSelectedValue = document.getElementById("titanSelectedValue");
  let titanLevel = 1;
  for (let lv = 1; lv <= 120; lv++) {
    const { atk, hp } = TITAN_STATS[lv];
    const li = document.createElement("li");
    const label = `Lv. ${lv} (ATK ${atk} / HP ${hp.toLocaleString()})`;
    li.textContent = label;
    li.onclick = () => {
      titanSelectedValue.textContent = label;
      titanLevel = lv;
      titanList.style.display = "none";
      saveConfig();
    };
    titanList.appendChild(li);
  }
  document.getElementById("titanDropdown").querySelector(".selected-value").onclick = () => toggleDropdownList(titanList);

  // 전투 제한 시간 커스텀 드롭다운
  const timeList = document.getElementById("timeList");
  const timeSelectedValue = document.getElementById("timeSelectedValue");
  let timeLimitMinutes = 90;
  for (let m = 10; m <= 120; m += 10) {
    const li = document.createElement("li");
    li.textContent = `${m}분`;
    li.onclick = () => {
      timeSelectedValue.textContent = `${m}분`;
      timeLimitMinutes = m;
      timeList.style.display = "none";
      saveConfig();
    };
    timeList.appendChild(li);
  }
  document.getElementById("timeDropdown").querySelector(".selected-value").onclick = () => toggleDropdownList(timeList);

  function toggleDropdownList(list) {
    const isOpen = list.style.display === "block";
    document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
    list.style.display = isOpen ? "none" : "block";
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-dropdown")) {
      document.querySelectorAll(".dropdown-list").forEach((el) => (el.style.display = "none"));
    }
  });

  // 타이탄과의 거리 / 연속 전투 (연속 전투 재소환 이동시간 계산에 쓰임)
  const fDistance = document.getElementById("fDistance");
  const continuousToggle = document.getElementById("continuousToggle");
  let distanceTiles = 1;
  let continuousBattle = false;

  // 거리가 0일 수는 없으니 기본값 1타일, 최소 1타일로 clamp
  fDistance.onfocus = () => { if (fDistance.value === "1") fDistance.value = ""; };
  fDistance.oninput = () => { fDistance.value = fDistance.value.replace(/[^0-9]/g, ""); };
  fDistance.onblur = () => {
    distanceTiles = Math.max(1, Number(fDistance.value) || 1);
    fDistance.value = distanceTiles;
    saveConfig();
  };
  continuousToggle.onchange = () => {
    continuousBattle = continuousToggle.checked;
    saveConfig();
  };

  function saveConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ titanLevel, timeLimitMinutes, distanceTiles, continuousBattle }));
  }

  function loadConfig() {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (!saved) return;
    const cfg = JSON.parse(saved);
    titanLevel = cfg.titanLevel || 1;
    const t = TITAN_STATS[titanLevel];
    titanSelectedValue.textContent = `Lv. ${titanLevel} (ATK ${t.atk} / HP ${t.hp.toLocaleString()})`;
    timeLimitMinutes = cfg.timeLimitMinutes || 90;
    timeSelectedValue.textContent = `${timeLimitMinutes}분`;
    distanceTiles = Math.max(1, cfg.distanceTiles || 1);
    fDistance.value = distanceTiles;
    continuousBattle = cfg.continuousBattle || false;
    continuousToggle.checked = continuousBattle;
  }
  loadConfig();

  // 시뮬레이션 실행
  const btn = document.getElementById("simulateBtn");
  btn.onclick = async () => {
    btn.disabled = true;
    const dino = getMyDinoBattleInputs();
    const targetTitan = TITAN_STATS[titanLevel];
    const result = await runTitanSimulation({
      baseAtk: dino.baseAtk,
      baseHp: dino.baseHp,
      maxDino: dino.count,
      targetTitan,
      selectedRunes: dino.selectedRunes,
      constellation: dino.constellation,
      bonusPercent: dino.bonusPercent,
      moveSpeed: dino.moveSpeed,
      distanceTiles,
      continuousBattle,
      timeLimitMinutes,
      iterations: 500,
      collectLog: AppSettings.isLogEnabled,
      onProgress: (completed, total) => { btn.innerText = `시뮬레이션 중(${completed}/${total})...`; }
    });
    renderReport(result);
    btn.disabled = false;
    btn.innerText = "시뮬레이션 시작";
  };

  function renderReport(result) {
    const rep = document.getElementById("battleReport");
    rep.style.display = "block";
    document.getElementById("repTotalDmg").innerText = Math.floor(result.avgTotalDmg).toLocaleString();
    document.getElementById("repTitanHp").innerText = Math.floor(result.avgRemainingTitanHp).toLocaleString();
    document.getElementById("repTime").innerText = `${Math.floor(result.avgTimeSec / 60)}분 ${Math.floor(result.avgTimeSec % 60)}초`;
    document.getElementById("repDead").innerText = `${result.avgDeadCount.toFixed(1)}마리`;
    document.getElementById("avgMinHpPer").innerText = "평균 생존 체력: " + result.avgSurvivalPercent.toFixed(1) + "%";
    if (result.chartData.length > 0) {
      drawHpChart(document.getElementById("hpChart"), result.chartData, result.limitSec);
    }
    rep.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const oldBtn = document.getElementById("logDownloadBtn");
    if (oldBtn) oldBtn.remove();
    if (AppSettings.isLogEnabled && result.logs.length > 0) {
      const logBtn = document.createElement("button");
      logBtn.id = "logDownloadBtn";
      logBtn.innerHTML = "상세 로그(.txt) 다운로드";
      logBtn.className = "btn-simulate";
      logBtn.style.cssText = "margin-top:15px; background:#455a64; font-size:14px;";
      logBtn.onclick = () => {
        let content = "=== 상세 전투 로그 (1회차) ===\n\n";
        result.logs.forEach((entry) => {
          content += `[${entry.시간}] 타이탄HP: ${entry.타이탄HP} | 생존: ${entry.생존공룡}\n`;
          entry.공룡상태.forEach((d) => { content += `  - ${d.번호}번 공룡 HP: ${d.남은HP}\n`; });
          if (entry.이벤트 && entry.이벤트.length > 0) {
            entry.이벤트.forEach((ev) => { content += `  * ${ev}\n`; });
          }
          content += "--------------------------------\n";
        });
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `battle_log_${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      };
      rep.appendChild(logBtn);
    }
  }
}
