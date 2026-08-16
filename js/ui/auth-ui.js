// 사이드 메뉴 맨 위 로그인 영역. Supabase 로그인 세션을 기준으로 표시함.

async function getCurrentUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("nickname")
    .eq("id", session.user.id)
    .maybeSingle();
  return { id: session.user.id, username: profile ? profile.nickname : null };
}

async function renderAuthRow() {
  const row = document.getElementById("authRow");
  if (!row) return;
  const user = await getCurrentUser();

  if (user && user.username) {
    row.innerHTML = `
      <div class="auth-identity" id="authIdentityBtn" title="${t("common.authRow.profileTooltip")}">
        <div class="auth-avatar">${user.username.slice(0, 1)}</div>
        <div class="auth-username" title="${user.username}">${user.username}</div>
      </div>
      <div class="auth-actions">
        <button id="authFriendsBtn" class="auth-text-btn">${t("common.authRow.friendsBtn")}</button>
        <button id="logoutBtn" class="auth-text-btn">${t("common.authRow.logoutBtn")}</button>
      </div>
    `;
    document.getElementById("logoutBtn").onclick = handleLogout;
    document.getElementById("authFriendsBtn").onclick = () => {
      const sideMenu = document.getElementById("sideMenu");
      if (sideMenu && sideMenu.classList.contains("open")) toggleMenu();
      location.hash = "#friends";
    };
    document.getElementById("authIdentityBtn").onclick = () => {
      const sideMenu = document.getElementById("sideMenu");
      if (sideMenu && sideMenu.classList.contains("open")) toggleMenu();
      location.hash = "#profile";
    };
  } else {
    row.innerHTML = `<button id="loginBtn" class="login-btn">${t("common.authRow.loginBtn")}</button>`;
    document.getElementById("loginBtn").onclick = () => {
      const sideMenu = document.getElementById("sideMenu");
      if (sideMenu && sideMenu.classList.contains("open")) toggleMenu();
      openAuthModal("login");
    };
  }
}

async function handleLogout() {
  teardownFriendNotifications();
  await supabaseClient.auth.signOut();
}

// 회원 탈퇴: auth.users 행을 지우는 RPC를 호출함. profiles/user_data/friend_requests는
// 전부 auth.users를 참조하는 on delete cascade 외래키라 서버에서 자동으로 같이 삭제됨.
async function handleDeleteAccount() {
  const sure = confirm(t("common.deleteAccount.confirm"));
  if (!sure) return;

  const btn = document.getElementById("deleteAccountBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerText = t("common.deleteAccount.busy");
  }

  const { error } = await supabaseClient.rpc("delete_own_account");
  if (error) {
    alert(t("common.deleteAccount.error", { error: error.message }));
    if (btn) {
      btn.disabled = false;
      btn.innerText = t("common.deleteAccount.btn");
    }
    return;
  }

  await supabaseClient.auth.signOut();
  location.hash = "#home";
}

// 로그인/로그아웃/토큰 갱신 등 세션 상태가 바뀔 때마다 자동으로 화면을 다시 그림.
// 새로 로그인한 시점(SIGNED_IN)과 페이지 로드시 기존 세션이 있던 경우(INITIAL_SESSION)에만
// 서버 데이터를 끌어와 localStorage에 반영함(토큰 자동 갱신마다 매번 다시 불러오지 않도록).
//
// 주의: supabase-js는 탭이 백그라운드에 있다가 다시 보일 때(visibilitychange)도 세션을
// 재확인하면서 SIGNED_IN/INITIAL_SESSION을 다시 발화시킬 수 있음(진짜 로그인이 아니라 그냥
// 기존 세션 재확인인데도) - 이걸 그대로 pullRemote...()의 renderRoute() 호출까지 이어지게
// 두면, 탭을 잠깐 백그라운드에 뒀다 돌아올 때마다 #app 전체가 처음부터 다시 그려지면서
// 조합 찾기 결과·친구 세션 패널처럼 그 화면에만 있던 상태가 전부 날아감(실제 사용자 리포트로
// 확인된 문제 - "백그라운드 들어가는 순간 결과창이 닫힘"). 같은 유저 ID로 이미 한 번 처리한
// SIGNED_IN/INITIAL_SESSION은 다시 처리하지 않도록 마지막으로 처리한 유저 ID를 기억해뒀다가,
// 유저가 실제로 바뀌었을 때만(로그아웃 후 다른 계정으로 로그인 등) 다시 pull+렌더함.
let lastHandledAuthUserId = null;
supabaseClient.auth.onAuthStateChange((event, session) => {
  renderAuthRow();
  if (event === "SIGNED_OUT") {
    lastHandledAuthUserId = null;
    return;
  }
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
    const userId = session && session.user ? session.user.id : null;
    if (!userId || userId === lastHandledAuthUserId) return;
    lastHandledAuthUserId = userId;
    pullRemoteProfileOnLogin();
    pullRemoteTitanConfigOnLogin();
    // 친구 초대는 로그인 상태면 어느 페이지에 있든 받을 수 있어야 해서 여기서 한 번만 구독 시작
    getCurrentUser().then((user) => {
      if (user && user.username) initFriendNotifications(user.id, user.username);
    });
  }
});
