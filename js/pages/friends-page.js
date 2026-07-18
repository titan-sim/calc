// 친구 추가/요청/목록 페이지. 로그인 상태에서만 의미가 있어서, 비로그인 상태면 안내만 보여줌.
// 실제 "친구와 함께 공룡 대전"은 다음 단계(Realtime 실시간 세션)에서 dino-battle-page.js에 붙임 -
// 이 페이지는 친구 관계(친구 요청 보내기/받기/수락/끊기)까지만 담당함.

async function renderFriendsPage(container) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    container.innerHTML = `
      <div class="card">
        <h2>친구</h2>
        <p style="color:var(--text-sub); font-size:14px;">로그인 후 이용할 수 있습니다.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <h2>친구 추가</h2>
      <div class="friend-search-row">
        <input type="text" id="friendSearchInput" placeholder="닉네임 입력" autocomplete="off">
        <button class="friend-search-btn" id="friendSearchBtn">요청 보내기</button>
      </div>
      <div class="auth-nickname-hint" id="friendSearchHint"></div>
    </div>

    <div class="card">
      <div class="dino-tabs">
        <button class="dino-tab active" data-panel="received">받은 요청<span class="nav-soon-tag" id="countReceived"></span></button>
        <button class="dino-tab" data-panel="sent">보낸 요청<span class="nav-soon-tag" id="countSent"></span></button>
        <button class="dino-tab" data-panel="friends">친구 목록<span class="nav-soon-tag" id="countFriends"></span></button>
        <div class="dino-tab-indicator"></div>
      </div>
      <div id="friendsPanelReceived"></div>
      <div id="friendsPanelSent" style="display:none;"></div>
      <div id="friendsPanelFriends" style="display:none;"></div>
    </div>

    <div class="friend-picker-overlay" id="friendStatOverlay" style="display:none;">
      <div class="friend-picker-modal">
        <div class="friend-picker-header">
          <span id="friendStatTitle">공룡 스탯</span>
          <button class="close-btn" id="friendStatClose">✕</button>
        </div>
        <div id="friendStatBody"></div>
      </div>
    </div>
  `;

  initFriendsPage(session.user.id);
}

function initFriendsPage(myId) {
  document.getElementById("friendSearchBtn").onclick = () => sendFriendRequest(myId);

  // 내 공룡 페이지와 같은 슬라이딩 밑줄 탭(.dino-tab). 예전엔 공룡 대전의 골드 알약형 탭
  // (.battle-mode-tab)을 그대로 갖다 썼는데, 그건 뒤에 깔리는 슬라이딩 배경(.battle-mode-indicator)이
  // 있어야 활성 탭 글씨(어두운 색)가 보이는 구조라 여기선 배경 없이 어두운 글씨만 남아 안 보였음
  const indicator = document.querySelector(".dino-tab-indicator");
  function moveIndicator(btn) {
    indicator.style.width = btn.offsetWidth + "px";
    indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
  }

  document.querySelectorAll(".dino-tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".dino-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      moveIndicator(tab);
      ["received", "sent", "friends"].forEach((p) => {
        document.getElementById(`friendsPanel${p[0].toUpperCase()}${p.slice(1)}`).style.display =
          p === tab.dataset.panel ? "block" : "none";
      });
    };
  });
  moveIndicator(document.querySelector(".dino-tab.active"));

  document.getElementById("friendStatClose").onclick = () => {
    document.getElementById("friendStatOverlay").style.display = "none";
  };

  loadFriendsData(myId);
}

async function sendFriendRequest(myId) {
  const input = document.getElementById("friendSearchInput");
  const hint = document.getElementById("friendSearchHint");
  const nickname = input.value.trim();
  hint.className = "auth-nickname-hint";
  hint.innerText = "";
  if (!nickname) return;

  const { data: target, error: lookupError } = await supabaseClient
    .from("profiles")
    .select("id, nickname")
    .eq("nickname", nickname)
    .maybeSingle();

  if (lookupError || !target) {
    hint.innerText = "해당 닉네임의 유저를 찾을 수 없습니다.";
    hint.classList.add("auth-nickname-hint-bad");
    return;
  }
  if (target.id === myId) {
    hint.innerText = "본인에게는 친구 요청을 보낼 수 없습니다.";
    hint.classList.add("auth-nickname-hint-bad");
    return;
  }

  const { data: existing } = await supabaseClient
    .from("friend_requests")
    .select("*")
    .or(`and(from_user.eq.${myId},to_user.eq.${target.id}),and(from_user.eq.${target.id},to_user.eq.${myId})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") {
      hint.innerText = "이미 친구입니다.";
      hint.classList.add("auth-nickname-hint-bad");
      return;
    }
    if (existing.from_user === myId) {
      hint.innerText = "이미 요청을 보냈습니다.";
      hint.classList.add("auth-nickname-hint-bad");
      return;
    }
    // 상대가 이미 나에게 보낸 요청이 있으면, 새로 보내는 대신 그 자리에서 바로 수락 처리
    const { error } = await supabaseClient.from("friend_requests").update({ status: "accepted" }).eq("id", existing.id);
    if (!error) {
      hint.innerText = `${target.nickname}님과 서로 요청이 있어 바로 친구가 되었습니다.`;
      hint.classList.add("auth-nickname-hint-good");
      input.value = "";
      loadFriendsData(myId);
    }
    return;
  }

  const { error: insertError } = await supabaseClient
    .from("friend_requests")
    .insert({ from_user: myId, to_user: target.id, status: "pending" });

  if (insertError) {
    hint.innerText = "요청 전송 중 오류가 발생했습니다.";
    hint.classList.add("auth-nickname-hint-bad");
    return;
  }
  hint.innerText = `${target.nickname}님에게 요청을 보냈습니다.`;
  hint.classList.add("auth-nickname-hint-good");
  input.value = "";
  loadFriendsData(myId);
}

async function loadFriendsData(myId) {
  const { data: rows, error } = await supabaseClient
    .from("friend_requests")
    .select("*")
    .or(`from_user.eq.${myId},to_user.eq.${myId}`);

  if (error || !rows) return;

  const otherIds = [...new Set(rows.map((r) => (r.from_user === myId ? r.to_user : r.from_user)))];
  let nicknameOf = {};
  if (otherIds.length > 0) {
    const { data: profiles } = await supabaseClient.from("profiles").select("id, nickname").in("id", otherIds);
    (profiles || []).forEach((p) => (nicknameOf[p.id] = p.nickname));
  }

  const received = rows.filter((r) => r.status === "pending" && r.to_user === myId);
  const sent = rows.filter((r) => r.status === "pending" && r.from_user === myId);
  const friends = rows.filter((r) => r.status === "accepted");

  document.getElementById("countReceived").innerText = received.length > 0 ? ` (${received.length})` : "";
  document.getElementById("countSent").innerText = sent.length > 0 ? ` (${sent.length})` : "";
  document.getElementById("countFriends").innerText = friends.length > 0 ? ` (${friends.length})` : "";

  renderFriendList("friendsPanelReceived", received, (r) => [
    { label: "수락", onClick: () => respondToRequest(r.id, "accept", myId) },
    { label: "거절", onClick: () => respondToRequest(r.id, "decline", myId) }
  ], "받은 요청이 없습니다.", myId, nicknameOf);

  renderFriendList("friendsPanelSent", sent, (r) => [
    { label: "취소", onClick: () => respondToRequest(r.id, "decline", myId) }
  ], "보낸 요청이 없습니다.", myId, nicknameOf);

  renderFriendList("friendsPanelFriends", friends, (r) => [
    { label: "스탯 확인", onClick: () => showFriendStats(r, myId, nicknameOf) },
    { label: "친구 끊기", onClick: () => respondToRequest(r.id, "decline", myId) }
  ], "아직 친구가 없습니다.", myId, nicknameOf);
}

async function showFriendStats(row, myId, nicknameOf) {
  const friendId = row.from_user === myId ? row.to_user : row.from_user;
  const nickname = nicknameOf[friendId] || "(알 수 없음)";
  const overlay = document.getElementById("friendStatOverlay");
  const body = document.getElementById("friendStatBody");
  document.getElementById("friendStatTitle").textContent = `${nickname}의 공룡 스탯`;
  body.innerHTML = `<div class="friend-picker-empty">불러오는 중...</div>`;
  overlay.style.display = "flex";

  const { data, error } = await supabaseClient.rpc("get_friend_dino_profile", { p_friend_id: friendId, p_purpose: "view" });
  if (overlay.style.display === "none") return; // 그새 닫혔으면 무시
  if (error || !data) {
    body.innerHTML = `<div class="friend-picker-empty">이 친구는 공룡 스탯을 공개하지 않았습니다.</div>`;
    return;
  }
  renderFriendStatBreakdown(body, data);
}

// get_friend_dino_profile(purpose:'view')는 공개 설정에 따라 일부 필드가 아예 빠진 채로 올 수
// 있어서(예: constellation 없이 최종 스탯 계산 불가) renderReadOnlyDinoSummary처럼 "합쳐진 최종
// 수치"를 계산하지 않고, 카테고리별로 있는 원본 값만 그대로 나열함. 없는 카테고리는 "비공개" 표시.
function renderFriendStatBreakdown(container, profile) {
  const sections = [];

  if (profile.baseAtk !== undefined) {
    sections.push(`
      <div class="friend-stat-section">
        <div class="friend-stat-section-title">기본 스탯</div>
        <div class="friend-stat-grid">
          <div><span>체력</span><b>${profile.baseHp}</b></div>
          <div><span>공격력</span><b>${profile.baseAtk}</b></div>
          <div><span>이동속도</span><b>${profile.moveSpeed}</b></div>
          <div><span>공룡 수</span><b>${profile.dinoCount}마리</b></div>
          <div><span>VIP</span><b>${profile.vip}</b></div>
          <div><span>둥지·알스킨</span><b>공 +${profile.bonusPercent.atk}% / 체 +${profile.bonusPercent.hp}%</b></div>
        </div>
      </div>
    `);
  } else {
    sections.push(friendStatHiddenSection("기본 스탯"));
  }

  if (profile.constellation !== undefined) {
    const c = profile.constellation || {};
    sections.push(`
      <div class="friend-stat-section">
        <div class="friend-stat-section-title">별자리</div>
        <div class="friend-stat-grid">
          <div><span>체력</span><b>+${c.hp || 0}</b></div>
          <div><span>공격력</span><b>+${c.atk || 0}</b></div>
          <div><span>치명타 확률</span><b>+${c.critRate || 0}%</b></div>
          <div><span>치명타 피해</span><b>+${c.critDmg || 0}%</b></div>
        </div>
      </div>
    `);
  } else {
    sections.push(friendStatHiddenSection("별자리"));
  }

  if (profile.runes !== undefined) {
    const slotsHtml = (profile.runes && profile.runes.length ? profile.runes : [null, null, null, null, null])
      .map((rune) => {
        if (rune && rune.name && RUNES_DATA[rune.name]) {
          const r = RUNES_DATA[rune.name];
          const lvClass = getLvClass(rune.lv);
          return `<div class="slot slot-readonly"><img src="${getImgUrl(r.imgId)}" class="slot-img"><div class="slot-lv-tag ${lvClass}">${rune.lv}</div></div>`;
        }
        return `<div class="slot slot-readonly"><img src="./assets/rune slot image folder/RuneSprite_0.png" class="slot-plus-img"></div>`;
      })
      .join("");
    sections.push(`
      <div class="friend-stat-section">
        <div class="friend-stat-section-title">룬</div>
        <div class="readonly-slot-row friend-stat-slot-row">${slotsHtml}</div>
      </div>
    `);
  } else {
    sections.push(friendStatHiddenSection("룬"));
  }

  if (profile.runePresets !== undefined) {
    const presetsHtml = (profile.runePresets || [])
      .map((p, i) => `<div class="friend-preset-item">${i === profile.activePresetIndex ? "★ " : ""}${p.name}</div>`)
      .join("");
    sections.push(`
      <div class="friend-stat-section">
        <div class="friend-stat-section-title">프리셋</div>
        <div class="friend-preset-list">${presetsHtml || '<span class="friend-stat-hidden-text">저장된 프리셋이 없습니다.</span>'}</div>
      </div>
    `);
  } else {
    sections.push(friendStatHiddenSection("프리셋"));
  }

  container.innerHTML = sections.join("");
}

function friendStatHiddenSection(label) {
  return `
    <div class="friend-stat-section friend-stat-hidden">
      <div class="friend-stat-section-title">${label}</div>
      <div class="friend-stat-hidden-text">비공개</div>
    </div>
  `;
}

function renderFriendList(containerId, rows, buildActions, emptyMsg, myId, nicknameOf) {
  const el = document.getElementById(containerId);
  if (rows.length === 0) {
    el.innerHTML = `<p style="color:var(--text-sub); font-size:14px; margin-top:14px;">${emptyMsg}</p>`;
    return;
  }
  el.innerHTML = rows
    .map((r) => {
      const otherId = r.from_user === myId ? r.to_user : r.from_user;
      const nickname = nicknameOf[otherId] || "(알 수 없음)";
      const actions = buildActions(r)
        .map((a, i) => `<button class="friend-row-btn" data-row="${r.id}" data-action="${i}">${a.label}</button>`)
        .join("");
      return `<div class="friend-row"><span class="friend-row-name">${nickname}</span><div class="friend-row-actions">${actions}</div></div>`;
    })
    .join("");

  rows.forEach((r) => {
    const actions = buildActions(r);
    actions.forEach((a, i) => {
      const btn = el.querySelector(`.friend-row-btn[data-row="${r.id}"][data-action="${i}"]`);
      if (btn) btn.onclick = a.onClick;
    });
  });
}

async function respondToRequest(rowId, action, myId) {
  if (action === "accept") {
    await supabaseClient.from("friend_requests").update({ status: "accepted" }).eq("id", rowId);
  } else {
    await supabaseClient.from("friend_requests").delete().eq("id", rowId);
  }
  loadFriendsData(myId);
}
