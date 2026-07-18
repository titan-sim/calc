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
      <div class="auth-identity" id="authIdentityBtn" title="프로필로 이동">
        <div class="auth-avatar">${user.username.slice(0, 1)}</div>
        <div class="auth-username" title="${user.username}">${user.username}</div>
      </div>
      <div class="auth-actions">
        <button id="authFriendsBtn" class="auth-text-btn">친구</button>
        <button id="logoutBtn" class="auth-text-btn">로그아웃</button>
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
    row.innerHTML = `<button id="loginBtn" class="login-btn">로그인</button>`;
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
  const sure = confirm("정말 탈퇴하시겠습니까? 저장된 룬 조합 등 계정 데이터가 모두 삭제되며 되돌릴 수 없습니다.");
  if (!sure) return;

  const btn = document.getElementById("deleteAccountBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "탈퇴 처리 중...";
  }

  const { error } = await supabaseClient.rpc("delete_own_account");
  if (error) {
    alert("탈퇴 처리 중 오류가 발생했습니다: " + error.message);
    if (btn) {
      btn.disabled = false;
      btn.innerText = "회원 탈퇴";
    }
    return;
  }

  await supabaseClient.auth.signOut();
  location.hash = "#home";
}

// 로그인/로그아웃/토큰 갱신 등 세션 상태가 바뀔 때마다 자동으로 화면을 다시 그림.
// 새로 로그인한 시점(SIGNED_IN)과 페이지 로드시 기존 세션이 있던 경우(INITIAL_SESSION)에만
// 서버 데이터를 끌어와 localStorage에 반영함(토큰 자동 갱신마다 매번 다시 불러오지 않도록).
supabaseClient.auth.onAuthStateChange((event, _session) => {
  renderAuthRow();
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
    pullRemoteProfileOnLogin();
    // 친구 초대는 로그인 상태면 어느 페이지에 있든 받을 수 있어야 해서 여기서 한 번만 구독 시작
    getCurrentUser().then((user) => {
      if (user && user.username) initFriendNotifications(user.id, user.username);
    });
  }
});
