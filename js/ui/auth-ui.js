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
      <div class="auth-username">${user.username}</div>
      <button id="logoutBtn" class="login-btn" style="margin-top:8px;">로그아웃</button>
    `;
    document.getElementById("logoutBtn").onclick = handleLogout;
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
  await supabaseClient.auth.signOut();
}

// 로그인/로그아웃/토큰 갱신 등 세션 상태가 바뀔 때마다 자동으로 화면을 다시 그림.
// 새로 로그인한 시점(SIGNED_IN)과 페이지 로드시 기존 세션이 있던 경우(INITIAL_SESSION)에만
// 서버 데이터를 끌어와 localStorage에 반영함(토큰 자동 갱신마다 매번 다시 불러오지 않도록).
supabaseClient.auth.onAuthStateChange((event, _session) => {
  renderAuthRow();
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
    pullRemoteProfileOnLogin();
  }
});
