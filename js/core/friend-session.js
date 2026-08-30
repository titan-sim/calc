// 친구와 함께 실시간으로 공룡 대전 이론크래프팅하는 세션 배관(친구 기능 3단계).
// DB에는 아무것도 안 남기고 Supabase Realtime의 broadcast(순수 pub/sub)만 사용함 - 완전히
// 일회성(ephemeral) 세션이라, 새로고침하거나 방을 나가면 그냥 끝나고 다시 초대해서 새로 시작함.
//
// 용어:
// - "알림 채널"(user-notify:{uid}): 로그인 상태면 항상 구독 중. 초대/거절 알림 수신용.
// - "방 채널"(friend-room:{uidA}:{uidB}): 세션 중에만 구독. 프로필/타일/전투시작 동기화용.
// - 좌석 개념 없음: 각자 화면에서 "나"는 항상 자기 자신, "상대"는 항상 친구. 서로 자기 쪽 변경만
//   전파하고, 상대가 전파한 걸 받아서 로컬 "상대" 자리를 갱신함(js/pages/dino-battle-page.js 참고).

let notifyChannel = null;
let notifyMyId = null;
let notifyMyNickname = null;
let currentSession = null; // { channel, myId, myNickname, friendId, friendNickname, status, friendProfile, sharedTile, friendSide, myReady, friendReady, friendPage, friendMode }
const sessionListeners = new Set();
const friendRequestListeners = new Set();

// "결과 통째 전송" 방식(친구 기능 4단계) - 계산 담당 쪽이 runDinoBattleSimulation/runArenaSimulation의
// 결과(이벤트 로그)를 JSON으로 통째로 브로드캐스트함. Supabase Realtime broadcast는 메시지당 payload
// 한도가 있어서(무료 티어 256KB - 실측 결과 13:13 방어 특화 조합은 이벤트 로그가 1.2MB까지도 나옴)
// 청크로 쪼개 보내고 받는 쪽에서 이어붙임. 수신 버퍼는 세션 하나당 최대 1개 배틀만 동시에 진행되므로
// currentSession이 아니라 이 모듈 전역 변수 하나로 충분함.
let resultChunkBuffer = null; // { battleType, total, chunks: [] }
const BATTLE_RESULT_CHUNK_SIZE = 150 * 1024; // 문자 기준 150KB - 256KB 한도 대비 여유(메시지 envelope 오버헤드 감안)

// 브라우저 절전/장시간 백그라운드 등으로 Realtime 소켓이 조용히 끊긴 채로 남아있으면(새로고침 전엔
// 초대 알림이 하나도 안 오는 문제) 탭이 다시 보이거나 네트워크가 돌아올 때 알림 채널을 강제로 다시
// 구독함. 세션 중이면 세션 채널은 건드리지 않음(끊겼으면 friend-left로 자연히 정리됨).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && notifyMyId) {
    initFriendNotifications(notifyMyId, notifyMyNickname);
  }
});
window.addEventListener("online", () => {
  if (notifyMyId) initFriendNotifications(notifyMyId, notifyMyNickname);
});

function defaultSharedTile() {
  return { natureAdjacent: false, tribeControlUserId: null };
}

function defaultFriendSide() {
  return { arrangement: "same", atkTowerLevel: null, hpTowerLevel: null };
}

function notifyListeners(event) {
  sessionListeners.forEach((cb) => {
    try { cb(event, currentSession); } catch (e) { console.error("friend-session listener 오류:", e); }
  });
}

// dino-battle-page.js 등이 세션 상태 변화를 구독. unsubscribe 함수를 반환함.
function onFriendSessionChange(callback) {
  sessionListeners.add(callback);
  return () => sessionListeners.delete(callback);
}

// friends-page.js가 "지금 친구 요청 목록을 보고 있다"는 동안만 구독해서, 새 요청이 오면
// 새로고침 없이 바로 목록을 다시 불러올 수 있게 함
function onFriendRequestNotification(callback) {
  friendRequestListeners.add(callback);
  return () => friendRequestListeners.delete(callback);
}

function notifyFriendRequestListeners(payload) {
  friendRequestListeners.forEach((cb) => {
    try { cb(payload); } catch (e) { console.error("friend-request listener 오류:", e); }
  });
}

function getActiveSession() {
  return currentSession;
}

function roomChannelName(idA, idB) {
  const [a, b] = [idA, idB].sort();
  return `friend-room:${a}:${b}`;
}

// ===== 알림 채널(초대 수신) =====

function initFriendNotifications(myId, myNickname) {
  notifyMyId = myId;
  notifyMyNickname = myNickname;
  if (notifyChannel) {
    supabaseClient.removeChannel(notifyChannel);
    notifyChannel = null;
  }
  notifyChannel = supabaseClient.channel(`user-notify:${myId}`, { config: { broadcast: { self: false } } });
  notifyChannel.on("broadcast", { event: "msg" }, ({ payload }) => {
    if (payload.type === "invite") {
      // 교차 초대(서로 거의 동시에 초대) 대응: 방 채널명이 대칭이라 서로 초대만 보내도 join/profile
      // 핸드셰이크로 이미 세션이 active가 될 수 있음(joinFriendRoom 참고) - 그 상태에서 뒤늦게
      // 도착한 이 초대 알림까지 배너로 띄우면, 사용자가 무심코 눌렀을 때 이미 멀쩡한 세션을
      // 허물 위험이 있어서(joinFriendRoom의 가드로 방지는 되지만) 애초에 배너 자체를 안 띄움
      const existing = getActiveSession();
      if (existing && existing.friendId === payload.fromId) return;
      showInviteBanner(myId, myNickname, payload.fromId, payload.fromNickname);
    } else if (payload.type === "invite-declined") {
      hideInviteWaitingIfFrom(payload.fromId);
    } else if (payload.type === "friend-request") {
      // 지금 친구 페이지를 보고 있으면 목록을 바로 다시 불러오고, 어디에 있든 토스트로 알림
      showToast(t("common.friendRequestToast", { nickname: payload.fromNickname }), "#friends");
      notifyFriendRequestListeners(payload);
    }
  });
  notifyChannel.subscribe((status) => {
    // 소켓이 끊기거나 시간 초과되면 잠깐 뒤 스스로 재구독(탭을 새로고침하지 않아도 알림이 다시 오게)
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      setTimeout(() => {
        if (notifyMyId === myId) initFriendNotifications(myId, myNickname);
      }, 2000);
    }
  });
}

function teardownFriendNotifications() {
  notifyMyId = null;
  notifyMyNickname = null;
  if (notifyChannel) {
    supabaseClient.removeChannel(notifyChannel);
    notifyChannel = null;
  }
  leaveFriendSession();
}

// ===== 토스트(친구 요청처럼 수락/거절 없이 그냥 알려주기만 하면 되는 알림, 몇 초 뒤 자동으로 사라짐) =====

let toastTimer = null;

function showToast(message, hash) {
  const toast = document.getElementById("friendToast");
  if (!toast) return;
  toast.innerHTML = `<span>${message}</span>`;
  toast.style.cursor = hash ? "pointer" : "default";
  toast.onclick = hash ? () => { location.hash = hash; hideToast(); } : null;
  toast.style.display = "flex";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 4000);
}

function hideToast() {
  const toast = document.getElementById("friendToast");
  if (toast) toast.style.display = "none";
}

// ===== 초대 배너(index.html의 #friendInviteBanner를 직접 그림 - 페이지 이동과 무관하게 항상 뜸) =====

function showInviteBanner(myId, myNickname, fromId, fromNickname) {
  const banner = document.getElementById("friendInviteBanner");
  if (!banner) return;
  banner.innerHTML = `
    <span class="friend-invite-text">${t("common.inviteBanner.text", { nickname: fromNickname })}</span>
    <div class="friend-invite-actions">
      <button class="friend-invite-accept">${t("friends.action.accept")}</button>
      <button class="friend-invite-decline">${t("friends.action.decline")}</button>
    </div>
  `;
  banner.style.display = "flex";
  banner.querySelector(".friend-invite-accept").onclick = () => {
    banner.style.display = "none";
    joinFriendRoom(myId, myNickname, fromId, fromNickname);
    // 초대는 어느 페이지에서든 받을 수 있으니, 수락하면 실제 세션 화면(공룡 대전)으로 이동시킴
    location.hash = "#dino-battle";
  };
  banner.querySelector(".friend-invite-decline").onclick = () => {
    banner.style.display = "none";
    const declineCh = supabaseClient.channel(`user-notify:${fromId}`, { config: { broadcast: { self: false } } });
    declineCh.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      declineCh.send({ type: "broadcast", event: "msg", payload: { type: "invite-declined", fromId: myId, fromNickname: myNickname } })
        .finally(() => supabaseClient.removeChannel(declineCh));
    });
  };
}

function hideInviteWaitingIfFrom(fromId) {
  if (currentSession && currentSession.status === "inviting" && currentSession.friendId === fromId) {
    leaveFriendSession();
    notifyListeners({ type: "declined" });
  }
}

// ===== 초대 보내기(내가 상대 공룡 패널에서 "친구 초대" 클릭) =====

function sendInviteToFriend(myId, myNickname, friendId, friendNickname) {
  // 초대를 보냄과 동시에 방 채널을 먼저 구독해둠(상대가 수락하기까지 몇 초는 걸리니, 그 사이
  // 이미 리스닝 중이어야 상대의 join 브로드캐스트를 놓치지 않음)
  joinFriendRoom(myId, myNickname, friendId, friendNickname, "inviting");

  const inviteCh = supabaseClient.channel(`user-notify:${friendId}`, { config: { broadcast: { self: false } } });
  inviteCh.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    inviteCh.send({ type: "broadcast", event: "msg", payload: { type: "invite", fromId: myId, fromNickname: myNickname } })
      .finally(() => supabaseClient.removeChannel(inviteCh));
  });
}

// ===== 방 채널(세션 본체) =====

// status: "inviting"(초대 보내고 응답 대기 중) | "active"(둘 다 참가, 정상 세션 중)
function joinFriendRoom(myId, myNickname, friendId, friendNickname, status = "active") {
  if (currentSession && currentSession.friendId === friendId) {
    // 이미 이 친구와 연결(active) 또는 연결 시도 중(inviting)인 세션이 있음 - 교차 초대나 중복
    // 수락 클릭으로 여기 다시 들어온 것. 허물고 다시 만들면 leaveFriendSession()이 진짜 "leave"를
    // 상대에게 브로드캐스트해버려서, 상대는 멀쩡히 연결돼 있던 세션이 갑자기 끊기는 것처럼 보임
    // (사용자 제보 - "친구가 들어왔다가 다시 나가버림"). 그냥 상태만 승격시키고 끝냄.
    if (currentSession.status === "inviting" && status === "active") {
      currentSession.status = "active";
      notifyListeners({ type: "joined" });
    }
    return;
  }
  leaveFriendSession();

  const channel = supabaseClient.channel(roomChannelName(myId, friendId), { config: { broadcast: { self: false } } });
  currentSession = {
    channel, myId, myNickname, friendId, friendNickname, status,
    friendProfile: null,
    sharedTile: defaultSharedTile(),
    friendSide: defaultFriendSide(),
    myReady: false,
    friendReady: false
  };
  resultChunkBuffer = null;

  channel.on("broadcast", { event: "msg" }, ({ payload }) => handleRoomMessage(payload));
  channel.subscribe((subStatus) => {
    if (subStatus !== "SUBSCRIBED" || !currentSession) return;
    // 초대를 "보낸" 쪽은 내 구독이 열렸다고 해서 상대가 들어온 게 아니므로 "inviting" 상태를
    // 그대로 유지함(실제로 active로 바뀌는 시점은 아래 handleRoomMessage에서 상대의 join을 받을 때).
    // 초대를 "수락"해서 들어온 쪽은 이 시점에 이미 상대가 존재를 알고 있는 방이므로 곧장 active.
    if (currentSession.status !== "inviting") currentSession.status = "active";
    // 참가 알림 + 내 현재 프로필도 곧바로 한 번 실어 보냄. 먼저 들어온 쪽이 이 시점에 보내는 건
    // 상대가 아직 구독 전이라 유실되지만, handleRoomMessage의 "join 받으면 내 프로필로 답장"
    // 로직이 그 경우를 보완해줌 - 결과적으로 어느 쪽이 먼저 들어오든 서로 프로필을 받게 됨.
    // 타일 설정은 이 모듈이 그 형태를 몰라서(dino-battle-page.js 소관) 여기서 안 보내고,
    // 호출부가 onFriendSessionChange의 "joined"/"friend-joined" 이벤트를 받아 직접 sendMyTileUpdate 함
    broadcastToRoom({ type: "join", nickname: currentSession.myNickname });
    broadcastToRoom({ type: "profile", profile: loadMyDinoProfile(MY_DINO_PROFILE_KEY) });
    notifyListeners({ type: "joined" });
  });
}

function handleRoomMessage(payload) {
  if (!currentSession) return;
  if (payload.type === "join") {
    currentSession.friendNickname = payload.nickname || currentSession.friendNickname;
    currentSession.status = "active"; // 상대가 실제로 방에 들어왔음이 이제서야 확인됨
    // 상대가 (나보다 늦게, 혹은 먼저) 들어왔다는 신호 - 내 현재 상태를 답례로 보내서
    // 어느 쪽이 먼저 join하든 서로 초기 동기화가 되게 함
    broadcastToRoom({ type: "profile", profile: loadMyDinoProfile(MY_DINO_PROFILE_KEY) });
    notifyListeners({ type: "friend-joined" });
  } else if (payload.type === "profile") {
    currentSession.friendProfile = payload.profile;
    notifyListeners({ type: "friend-profile" });
  } else if (payload.type === "tile") {
    if (payload.natureAdjacent !== undefined) currentSession.sharedTile.natureAdjacent = payload.natureAdjacent;
    if (payload.tribeControlUserId !== undefined) currentSession.sharedTile.tribeControlUserId = payload.tribeControlUserId;
    if (payload.arrangement !== undefined) currentSession.friendSide.arrangement = payload.arrangement;
    if (payload.atkTowerLevel !== undefined) currentSession.friendSide.atkTowerLevel = payload.atkTowerLevel;
    if (payload.hpTowerLevel !== undefined) currentSession.friendSide.hpTowerLevel = payload.hpTowerLevel;
    notifyListeners({ type: "friend-tile" });
  } else if (payload.type === "battle-start") {
    notifyListeners({ type: "battle-start", seed: payload.seed });
  } else if (payload.type === "ready-request") {
    currentSession.friendReady = true;
    notifyListeners({ type: "friend-ready", battleType: payload.battleType });
  } else if (payload.type === "ready-cancel") {
    currentSession.friendReady = false;
    resultChunkBuffer = null;
    notifyListeners({ type: "friend-ready-cancelled" });
  } else if (payload.type === "battle-result-start") {
    resultChunkBuffer = { battleType: payload.battleType, total: payload.total, chunks: new Array(payload.total) };
  } else if (payload.type === "battle-result-chunk") {
    if (resultChunkBuffer) resultChunkBuffer.chunks[payload.index] = payload.data;
  } else if (payload.type === "tab-change") {
    // 친구 기능 4단계 - 화면을 강제로 맞추지 않고, 상대가 지금 어느 탭을 보는지만 currentSession에
    // 저장해뒀다가 페이지 쪽(updatePresenceBadges류)이 탭 버튼 위에 배지로 표시함
    currentSession.friendPage = payload.page;
    currentSession.friendMode = payload.mode;
    notifyListeners({ type: "friend-tab-change" });
  } else if (payload.type === "battle-result-end") {
    if (resultChunkBuffer) {
      const { battleType, chunks } = resultChunkBuffer;
      resultChunkBuffer = null;
      try {
        const result = JSON.parse(chunks.join(""));
        notifyListeners({ type: "battle-result", battleType, result });
      } catch (e) {
        console.error("friend-session: battle-result 파싱 오류:", e);
      }
    }
  } else if (payload.type === "leave") {
    resultChunkBuffer = null;
    notifyListeners({ type: "friend-left" });
    leaveFriendSession();
  }
}

function broadcastToRoom(payload) {
  if (!currentSession || !currentSession.channel) return;
  currentSession.channel.send({ type: "broadcast", event: "msg", payload });
}

function sendMyProfileUpdate(profile) {
  broadcastToRoom({ type: "profile", profile });
}

function sendMyTileUpdate(partial) {
  broadcastToRoom({ type: "tile", ...partial });
}

function sendBattleStart(seed) {
  broadcastToRoom({ type: "battle-start", seed });
}

// 지금 내가 보고 있는 탭(page: "dino_battle"|"arena", mode: 그 페이지의 탭 모드 문자열)을 상대에게
// 알림 - 화면을 강제로 맞추진 않고, 상대 쪽에서 탭 버튼에 내 닉네임 배지를 띄우는 용도
function sendTabChange(page, mode) {
  broadcastToRoom({ type: "tab-change", page, mode });
}

// "준비 완료" - 내 상태를 브로드캐스트하고 로컬에도 즉시 반영(둘 다 준비됐는지 판정은 호출부가
// currentSession.myReady/friendReady를 직접 봄 - 서버 조율 없이 각자 로컬에서 판정 가능)
function sendReadyRequest(battleType) {
  if (currentSession) currentSession.myReady = true;
  broadcastToRoom({ type: "ready-request", battleType });
}

function sendReadyCancel() {
  if (currentSession) currentSession.myReady = false;
  resultChunkBuffer = null;
  broadcastToRoom({ type: "ready-cancel" });
}

// 계산 담당이 결과를 보냈거나(sender) 상대가 보낸 결과를 재생하기 시작할 때(receiver) 양쪽 다
// 다음 전투를 위해 로컬 준비 상태를 초기화 - 브로드캐스트 없음(양쪽 다 같은 타이밍에 각자 호출함)
function resetBattleReady() {
  if (currentSession) {
    currentSession.myReady = false;
    currentSession.friendReady = false;
  }
}

// 계산 담당 쪽이 전투 결과(이벤트 로그) 전체를 청크로 쪼개 상대에게 전송함. 순서 보장은 같은
// 채널의 broadcast가 순서대로 도착한다는 기존 가정(join -> profile 핸드셰이크에서도 이미 의존)에
// 기댐 - 별도 재정렬 로직 불필요.
function sendBattleResult(battleType, result) {
  const json = JSON.stringify(result);
  const total = Math.max(1, Math.ceil(json.length / BATTLE_RESULT_CHUNK_SIZE));
  broadcastToRoom({ type: "battle-result-start", battleType, total });
  for (let i = 0; i < total; i++) {
    const data = json.slice(i * BATTLE_RESULT_CHUNK_SIZE, (i + 1) * BATTLE_RESULT_CHUNK_SIZE);
    broadcastToRoom({ type: "battle-result-chunk", index: i, data });
  }
  broadcastToRoom({ type: "battle-result-end" });
}

function leaveFriendSession() {
  if (!currentSession) return;
  if (currentSession.status === "active") {
    try { broadcastToRoom({ type: "leave" }); } catch (e) { /* best-effort */ }
  }
  supabaseClient.removeChannel(currentSession.channel);
  currentSession = null;
  resultChunkBuffer = null;
  notifyListeners({ type: "left" });
}

// ===== 친구 선택 목록(초대/스냅샷 불러오기 공용) =====

async function getAcceptedFriends(myId) {
  const { data: rows, error } = await supabaseClient
    .from("friend_requests")
    .select("*")
    .eq("status", "accepted")
    .or(`from_user.eq.${myId},to_user.eq.${myId}`);
  if (error || !rows || rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.from_user === myId ? r.to_user : r.from_user));
  const { data: profiles } = await supabaseClient.from("profiles").select("id, nickname").in("id", otherIds);
  return (profiles || []).map((p) => ({ id: p.id, nickname: p.nickname }));
}
