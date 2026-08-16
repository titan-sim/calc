// 친구 추가/요청/목록 페이지. 로그인 상태에서만 의미가 있어서, 비로그인 상태면 안내만 보여줌.
// 실제 "친구와 함께 공룡 대전"(js/core/friend-session.js)의 초대/세션 관리는 이 페이지가 아니라
// 그쪽에서 전역으로 담당함 - 이 페이지는 친구 관계(친구 요청 보내기/받기/수락/끊기)까지만 담당함.

let unsubscribeFriendRequestNotif = null;

// 스탯 모달을 보다가 다른 탭/창에 갔다 브라우저가 이 탭을 백그라운드에서 통째로 새로고침해버리면
// (모바일/크롬 절전 기능 등 - 앱 코드로는 막을 수 없음) 모달이 닫힌 채로 돌아와 다시 눌러야 하는
// 게 불편하다는 피드백 반영 - 어떤 친구 모달이 열려있었는지만 세션 저장소에 남겨뒀다가 페이지가
// 다시 마운트될 때 자동으로 재오픈함
const FRIEND_STAT_REOPEN_KEY = "friendStatReopenFriendId";

async function renderFriendsPage(container) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    container.innerHTML = `
      <div class="card">
        <h2>${t("friends.title")}</h2>
        <p style="color:var(--text-sub); font-size:14px;">${t("friends.loginRequired")}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <h2>${t("friends.addTitle")}</h2>
      <div class="friend-search-row">
        <input type="text" id="friendSearchInput" placeholder="${t("friends.searchPlaceholder")}" autocomplete="off">
        <button class="friend-search-btn" id="friendSearchBtn">${t("friends.searchBtn")}</button>
      </div>
      <div class="auth-nickname-hint" id="friendSearchHint"></div>
    </div>

    <div class="card">
      <div class="dino-tabs">
        <button class="dino-tab active" data-panel="received">${t("friends.tab.received")}<span class="nav-soon-tag" id="countReceived"></span></button>
        <button class="dino-tab" data-panel="sent">${t("friends.tab.sent")}<span class="nav-soon-tag" id="countSent"></span></button>
        <button class="dino-tab" data-panel="friends">${t("friends.tab.friends")}<span class="nav-soon-tag" id="countFriends"></span></button>
        <div class="dino-tab-indicator"></div>
      </div>
      <div id="friendsPanelReceived"></div>
      <div id="friendsPanelSent" style="display:none;"></div>
      <div id="friendsPanelFriends" style="display:none;"></div>
    </div>

    <div class="friend-picker-overlay" id="friendStatOverlay" style="display:none;">
      <div class="friend-picker-modal">
        <div class="friend-picker-header">
          <span id="friendStatTitle">${t("friends.statModal.defaultTitle")}</span>
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
    sessionStorage.removeItem(FRIEND_STAT_REOPEN_KEY);
  };

  // 친구 페이지를 보고 있는 동안 새 요청이 오면 새로고침 없이 바로 목록을 다시 불러옴
  if (unsubscribeFriendRequestNotif) unsubscribeFriendRequestNotif();
  unsubscribeFriendRequestNotif = onFriendRequestNotification(() => {
    if (document.getElementById("friendsPanelReceived")) loadFriendsData(myId);
  });

  // 최초 마운트 때만 "직전에 열려있던 스탯 모달" 복구를 시도(그 외 loadFriendsData 호출은
  // 요청 알림/수락 등으로 목록만 새로고침하는 것뿐이라 매번 재오픈을 시도하면 사용자가 방금
  // 직접 닫은 모달도 다시 열려버림)
  loadFriendsData(myId).then((result) => {
    const { nicknameOf, friends } = result || {};
    if (!friends) return;
    const reopenFriendId = sessionStorage.getItem(FRIEND_STAT_REOPEN_KEY);
    if (!reopenFriendId) return;
    const match = friends.find((r) => (r.from_user === myId ? r.to_user : r.from_user) === reopenFriendId);
    if (match) showFriendStats(match, myId, nicknameOf);
    else sessionStorage.removeItem(FRIEND_STAT_REOPEN_KEY);
  });
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
    hint.innerText = t("friends.search.notFound");
    hint.classList.add("auth-nickname-hint-bad");
    return;
  }
  if (target.id === myId) {
    hint.innerText = t("friends.search.selfRequest");
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
      hint.innerText = t("friends.search.alreadyFriends");
      hint.classList.add("auth-nickname-hint-bad");
      return;
    }
    if (existing.from_user === myId) {
      hint.innerText = t("friends.search.alreadySent");
      hint.classList.add("auth-nickname-hint-bad");
      return;
    }
    // 상대가 이미 나에게 보낸 요청이 있으면, 새로 보내는 대신 그 자리에서 바로 수락 처리
    const { error } = await supabaseClient.from("friend_requests").update({ status: "accepted" }).eq("id", existing.id);
    if (!error) {
      hint.innerText = t("friends.search.mutualAccepted", { nickname: target.nickname });
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
    hint.innerText = t("friends.search.sendError");
    hint.classList.add("auth-nickname-hint-bad");
    return;
  }
  hint.innerText = t("friends.search.sent", { nickname: target.nickname });
  hint.classList.add("auth-nickname-hint-good");
  input.value = "";
  notifyFriendRequestSent(target.id, myId);
  loadFriendsData(myId);
}

// 상대의 개인 알림 채널(js/core/friend-session.js가 로그인 상태면 항상 구독 중)로 요청 왔다는
// 걸 실시간으로 쏴줌 - 새로고침 없이 바로 알림/목록 갱신이 되게 하기 위함
async function notifyFriendRequestSent(targetId, myId) {
  const me = await getCurrentUser();
  const myNickname = me && me.username ? me.username : t("friends.request.myNicknameFallback");
  const ch = supabaseClient.channel(`user-notify:${targetId}`, { config: { broadcast: { self: false } } });
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    ch.send({ type: "broadcast", event: "msg", payload: { type: "friend-request", fromNickname: myNickname } })
      .finally(() => supabaseClient.removeChannel(ch));
  });
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

  // 뱃지 숫자가 채워지면서 탭 버튼 너비가 바뀌는데, 인디케이터는 페이지 최초 렌더 시(뱃지가
  // 비어있던 시점) 잰 너비로 이미 고정돼있어서 그대로 두면 활성 탭과 밑줄 위치/너비가 어긋남
  const activeTab = document.querySelector(".dino-tab.active");
  const indicator = document.querySelector(".dino-tab-indicator");
  if (activeTab && indicator) {
    indicator.style.width = activeTab.offsetWidth + "px";
    indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
  }

  renderFriendList("friendsPanelReceived", received, (r) => [
    { label: t("friends.action.accept"), onClick: () => respondToRequest(r.id, "accept", myId) },
    { label: t("friends.action.decline"), onClick: () => respondToRequest(r.id, "decline", myId) }
  ], t("friends.list.receivedEmpty"), myId, nicknameOf);

  renderFriendList("friendsPanelSent", sent, (r) => [
    { label: t("friends.action.cancel"), onClick: () => respondToRequest(r.id, "decline", myId) }
  ], t("friends.list.sentEmpty"), myId, nicknameOf);

  renderFriendList("friendsPanelFriends", friends, (r) => [
    { label: t("friends.action.checkStats"), onClick: () => showFriendStats(r, myId, nicknameOf) },
    { label: t("friends.action.unfriend"), onClick: () => respondToRequest(r.id, "decline", myId) }
  ], t("friends.list.friendsEmpty"), myId, nicknameOf);

  return { nicknameOf, friends };
}

async function showFriendStats(row, myId, nicknameOf) {
  const friendId = row.from_user === myId ? row.to_user : row.from_user;
  const nickname = nicknameOf[friendId] || t("friends.unknownNickname");
  const overlay = document.getElementById("friendStatOverlay");
  const body = document.getElementById("friendStatBody");
  document.getElementById("friendStatTitle").textContent = t("friends.statModal.titleWithName", { nickname });
  body.innerHTML = `<div class="friend-picker-empty">${t("friends.statModal.loading")}</div>`;
  overlay.style.display = "flex";
  sessionStorage.setItem(FRIEND_STAT_REOPEN_KEY, friendId);

  const { data, error } = await supabaseClient.rpc("get_friend_dino_profile", { p_friend_id: friendId, p_purpose: "view" });
  if (overlay.style.display === "none") return; // 그새 닫혔으면 무시
  if (error || !data) {
    body.innerHTML = `<div class="friend-picker-empty">${t("friends.statModal.notShared")}</div>`;
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
        <div class="friend-stat-section-title">${t("friends.stat.sectionBase")}</div>
        <div class="friend-stat-grid">
          <div><span>${t("friends.stat.hp")}</span><b>${profile.baseHp}</b></div>
          <div><span>${t("friends.stat.atk")}</span><b>${profile.baseAtk}</b></div>
          <div><span>${t("friends.stat.moveSpeed")}</span><b>${profile.moveSpeed}</b></div>
          <div><span>${t("friends.stat.dinoCount")}</span><b>${t("friends.stat.dinoCountValue", { count: profile.dinoCount })}</b></div>
          <div><span>${t("friends.stat.vip")}</span><b>${profile.vip}</b></div>
          <div><span>${t("friends.stat.nestEggSkin")}</span><b>${t("friends.stat.nestEggSkinValue", { atk: profile.bonusPercent.atk, hp: profile.bonusPercent.hp })}</b></div>
        </div>
      </div>
    `);
  } else {
    sections.push(friendStatHiddenSection(t("friends.stat.sectionBase")));
  }

  if (profile.constellation !== undefined) {
    const c = profile.constellation || {};
    sections.push(`
      <div class="friend-stat-section">
        <div class="friend-stat-section-title">${t("friends.stat.sectionConstellation")}</div>
        <div class="friend-stat-grid">
          <div><span>${t("friends.stat.hp")}</span><b>+${c.hp || 0}</b></div>
          <div><span>${t("friends.stat.atk")}</span><b>+${c.atk || 0}</b></div>
          <div><span>${t("friends.stat.critRate")}</span><b>+${c.critRate || 0}%</b></div>
          <div><span>${t("friends.stat.critDmg")}</span><b>+${c.critDmg || 0}%</b></div>
        </div>
      </div>
    `);
  } else {
    sections.push(friendStatHiddenSection(t("friends.stat.sectionConstellation")));
  }

  // "룬"(현재 장착 중인 룬)과 "프리셋"(저장해둔 조합 목록)이 각자 룬 아이콘을 따로 보여주면
  // 같은 걸 두 번 보는 것처럼 헷갈려서 한 칸으로 합침 - 대신 프리셋 버튼을 누르면 위 룬 아이콘
  // 표시 자체가 그 프리셋의 룬 구성으로 바뀜(별도 미리보기 영역을 새로 만들지 않고 한 자리를 재사용)
  const runesBlockHtml = profile.runes !== undefined
    ? `<div class="readonly-slot-row friend-stat-slot-row" id="friendRuneSlots">${friendRuneSlotsHtml(profile.runes)}</div>`
    : `<div class="friend-stat-hidden-text">${t("friends.stat.hiddenLabel")}</div>`;

  let presetBlockHtml;
  if (profile.runePresets !== undefined) {
    const presets = profile.runePresets || [];
    presetBlockHtml = presets.length
      ? `<div class="friend-preset-list" id="friendPresetList">${presets.map((p, i) => `<div class="friend-preset-item${i === profile.activePresetIndex ? " active" : ""}" data-idx="${i}">${i === profile.activePresetIndex ? "★ " : ""}${p.name}</div>`).join("")}</div>`
      : `<span class="friend-stat-hidden-text">${t("friends.rune.noPresets")}</span>`;
  } else {
    presetBlockHtml = `<div class="friend-stat-hidden-text">${t("friends.stat.hiddenLabel")}</div>`;
  }

  sections.push(`
    <div class="friend-stat-section">
      <div class="friend-stat-section-title">${t("friends.rune.sectionTitle")}<span class="friend-stat-section-hint">${t("friends.rune.hint")}</span></div>
      ${runesBlockHtml}
      <div class="friend-stat-subrow">${presetBlockHtml}</div>
    </div>
  `);

  // 아레나 프리셋(5슬롯 배치)은 룬 프리셋의 인덱스를 참조하는 값이라 그쪽이 공개돼있을 때만 의미가
  // 있음(서버 쪽에서도 showPresets를 끄면 둘 다 같이 가려서 내려옴) - arenaFormations 자체는 친구가
  // 아직 한 번도 배치를 저장한 적 없으면 프로필에 필드 자체가 없을 수 있는데, 그때 섹션을 통째로
  // 숨겨버리면 "이 기능이 아예 없나?"로 헷갈리니 프리셋이 보이는 한 항상 칸은 띄우고 빈 상태만 표시
  if (profile.runePresets !== undefined) {
    sections.push(`
      <div class="friend-stat-section">
        <div class="friend-stat-section-title">${t("friends.arena.sectionTitle")}<span class="friend-stat-section-hint">${t("friends.arena.hint")}</span></div>
        <div class="friend-preset-list" id="friendArenaFormationList"></div>
        <div id="friendArenaFormationDetail"></div>
      </div>
    `);
  }

  container.innerHTML = sections.join("");

  if (profile.runePresets !== undefined) {
    mountFriendPresetPreview(container, profile);
    mountFriendArenaFormationViewer(container, profile);
  }
}

// 프리셋 버튼을 누르면 위 "룬" 아이콘 표시를 그 프리셋의 룬 구성으로 바꿔치기함(순수 조회용 -
// 아무것도 저장/전송하지 않고 이 모달 안에서만 어떤 프리셋을 보고 있는지 바뀜)
function mountFriendPresetPreview(container, profile) {
  const listEl = container.querySelector("#friendPresetList");
  const slotsEl = container.querySelector("#friendRuneSlots");
  if (!listEl || !slotsEl) return;
  const presets = profile.runePresets || [];

  listEl.querySelectorAll(".friend-preset-item").forEach((el) => {
    el.onclick = () => {
      listEl.querySelectorAll(".friend-preset-item").forEach((other) => other.classList.remove("active"));
      el.classList.add("active");
      const preset = presets[Number(el.dataset.idx)];
      slotsEl.innerHTML = friendRuneSlotsHtml(preset ? preset.runes : null);
    };
  });
}

function friendRuneSlotsHtml(runes) {
  return (runes && runes.length ? runes : [null, null, null, null, null])
    .map((rune) => {
      if (rune && rune.name && RUNES_DATA[rune.name]) {
        const r = RUNES_DATA[rune.name];
        const lvClass = getLvClass(rune.lv);
        return `<div class="slot slot-readonly"><img src="${getImgUrl(r.imgId)}" class="slot-img"><div class="slot-lv-tag ${lvClass}">${rune.lv}</div></div>`;
      }
      return `<div class="slot slot-readonly"><img src="./assets/rune slot image folder/RuneSprite_0.png" class="slot-plus-img"></div>`;
    })
    .join("");
}

// 아레나 배치 1개(5슬롯)를 룬 프리셋 인덱스 -> 실제 프리셋 이름/룬으로 풀어서 보여줌
function friendArenaFormationDetailHtml(formation, runePresets) {
  const slotPresetIndices = (formation && formation.slotPresetIndices) || [null, null, null, null, null];
  return slotPresetIndices.map((idx, i) => {
    const preset = idx !== null ? runePresets[idx] : null;
    const presetName = preset ? `· ${preset.name}` : t("friends.arena.unassigned");
    return `
      <div class="friend-arena-slot-row">
        <div class="friend-arena-slot-label">${t("friends.arena.slotLabel", { index: i + 1, presetName })}</div>
        <div class="readonly-slot-row friend-stat-slot-row">${friendRuneSlotsHtml(preset ? preset.runes : null)}</div>
      </div>
    `;
  }).join("");
}

function mountFriendArenaFormationViewer(container, profile) {
  const listEl = container.querySelector("#friendArenaFormationList");
  const detailEl = container.querySelector("#friendArenaFormationDetail");
  const runePresets = profile.runePresets || [];
  const arenaFormations = profile.arenaFormations || {};
  const activeFormationIndex = Number.isInteger(arenaFormations.activeFormationIndex) ? arenaFormations.activeFormationIndex : 0;
  let selectedIdx = activeFormationIndex;

  function render() {
    const formations = arenaFormations.formations || [];
    listEl.innerHTML = formations.length
      ? formations.map((f, i) => `<div class="friend-preset-item${i === selectedIdx ? " active" : ""}" data-idx="${i}">${i === activeFormationIndex ? "★ " : ""}${f.name}</div>`).join("")
      : `<span class="friend-stat-hidden-text">${t("friends.arena.noFormations")}</span>`;
    listEl.querySelectorAll(".friend-preset-item").forEach((el) => {
      el.onclick = () => {
        selectedIdx = Number(el.dataset.idx);
        render();
      };
    });
    const selected = formations[selectedIdx];
    detailEl.innerHTML = selected ? friendArenaFormationDetailHtml(selected, runePresets) : "";
  }
  render();
}

function friendStatHiddenSection(label) {
  return `
    <div class="friend-stat-section friend-stat-hidden">
      <div class="friend-stat-section-title">${label}</div>
      <div class="friend-stat-hidden-text">${t("friends.stat.hiddenLabel")}</div>
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
      const nickname = nicknameOf[otherId] || t("friends.unknownNickname");
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
