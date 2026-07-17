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
      <div class="battle-mode-tabs">
        <button class="battle-mode-tab active" data-panel="received">받은 요청<span class="nav-soon-tag" id="countReceived"></span></button>
        <button class="battle-mode-tab" data-panel="sent">보낸 요청<span class="nav-soon-tag" id="countSent"></span></button>
        <button class="battle-mode-tab" data-panel="friends">친구 목록<span class="nav-soon-tag" id="countFriends"></span></button>
      </div>
      <div id="friendsPanelReceived"></div>
      <div id="friendsPanelSent" style="display:none;"></div>
      <div id="friendsPanelFriends" style="display:none;"></div>
    </div>
  `;

  initFriendsPage(session.user.id);
}

function initFriendsPage(myId) {
  document.getElementById("friendSearchBtn").onclick = () => sendFriendRequest(myId);

  document.querySelectorAll(".battle-mode-tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".battle-mode-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      ["received", "sent", "friends"].forEach((p) => {
        document.getElementById(`friendsPanel${p[0].toUpperCase()}${p.slice(1)}`).style.display =
          p === tab.dataset.panel ? "block" : "none";
      });
    };
  });

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
    { label: "친구 끊기", onClick: () => respondToRequest(r.id, "decline", myId) }
  ], "아직 친구가 없습니다.", myId, nicknameOf);
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
