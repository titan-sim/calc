// 로그인한 유저의 프로필 페이지. 사이드 메뉴의 닉네임(아바타) 영역을 누르면 여기로 옴.
async function renderProfilePage(container) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    container.innerHTML = `
      <div class="card">
        <h2>프로필</h2>
        <p style="color:var(--text-sub); font-size:14px;">로그인 후 이용할 수 있습니다.</p>
      </div>
    `;
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("nickname, created_at")
    .eq("id", session.user.id)
    .maybeSingle();

  const { data: userData } = await supabaseClient
    .from("user_data")
    .select("stat_visibility")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const nickname = profile ? profile.nickname : "(알 수 없음)";
  const joinedAt = profile && profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("ko-KR")
    : "-";

  container.innerHTML = `
    <div class="card">
      <div class="profile-header">
        <div class="auth-avatar profile-avatar">${nickname.slice(0, 1)}</div>
        <div>
          <div class="profile-nickname">${nickname}</div>
          <div class="profile-email">${session.user.email || ""}</div>
        </div>
      </div>
      <div class="profile-meta">가입일: ${joinedAt}</div>
    </div>

    <div class="card" id="statVisibilityCard"></div>

    <div class="card profile-danger-zone">
      <h2>회원 탈퇴</h2>
      <p style="color:var(--text-sub); font-size:13px; line-height:1.6;">
        탈퇴하면 닉네임, 저장된 룬 조합 등 계정 데이터가 모두 삭제되며 되돌릴 수 없습니다.
      </p>
      <button id="deleteAccountBtn" class="profile-delete-btn">회원 탈퇴</button>
    </div>
  `;

  document.getElementById("deleteAccountBtn").onclick = handleDeleteAccount;
  renderStatVisibilitySection(session.user.id, (userData && userData.stat_visibility) || null);
}

const STAT_VISIBILITY_CATEGORIES = [
  { key: "showBase", label: "기본 스탯" },
  { key: "showConstellation", label: "별자리" },
  { key: "showRunes", label: "룬" },
  { key: "showPresets", label: "프리셋" }
];

function defaultStatVisibility() {
  return { enabled: true, showBase: true, showConstellation: true, showRunes: true, showPresets: true };
}

function renderStatVisibilitySection(myId, saved) {
  const vis = { ...defaultStatVisibility(), ...(saved || {}) };
  const card = document.getElementById("statVisibilityCard");

  card.innerHTML = `
    <h2>공룡 스탯 공개 설정</h2>
    <p style="color:var(--text-sub); font-size:13px; line-height:1.6; margin-bottom:14px;">
      친구가 내 공룡 스탯을 확인할 수 있는지, 어디까지 볼 수 있는지 정합니다. 친구 요청은 서로 수락해야
      맺어지는 관계라 기본값은 공개입니다.
    </p>
    <div class="setting-row" style="border-top:none; padding-top:0;">
      <div class="setting-label">친구에게 내 공룡 스탯 공개</div>
      <label class="switch"><input type="checkbox" id="statVisEnabled"><span class="slider round"></span></label>
    </div>
    <div id="statVisCategories" class="stat-visibility-categories"></div>
  `;

  const enabledToggle = document.getElementById("statVisEnabled");
  enabledToggle.checked = vis.enabled;

  function renderCategories() {
    const wrap = document.getElementById("statVisCategories");
    if (!vis.enabled) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = STAT_VISIBILITY_CATEGORIES.map((c) => `
      <label class="stat-visibility-item">
        <input type="checkbox" data-key="${c.key}" ${vis[c.key] ? "checked" : ""}>
        <span>${c.label}</span>
      </label>
    `).join("");
    wrap.querySelectorAll("input[data-key]").forEach((input) => {
      input.onchange = () => {
        vis[input.dataset.key] = input.checked;
        saveStatVisibility(myId, vis);
      };
    });
  }

  enabledToggle.onchange = () => {
    vis.enabled = enabledToggle.checked;
    renderCategories();
    saveStatVisibility(myId, vis);
  };

  renderCategories();
}

async function saveStatVisibility(myId, vis) {
  const { error } = await supabaseClient.from("user_data").upsert({ user_id: myId, stat_visibility: vis });
  if (error) console.error("stat_visibility 저장 실패:", error.message);
}
