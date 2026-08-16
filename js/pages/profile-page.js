// 로그인한 유저의 프로필 페이지. 사이드 메뉴의 닉네임(아바타) 영역을 누르면 여기로 옴.
async function renderProfilePage(container) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    container.innerHTML = `
      <div class="card">
        <h2>${t("profile.title")}</h2>
        <p style="color:var(--text-sub); font-size:14px;">${t("profile.loginRequired")}</p>
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

  const nickname = profile ? profile.nickname : t("profile.unknownNickname");
  // toLocaleDateString의 locale 인자도 지금 언어에 맞춰줌 - "가입일: {date}" 자체는 번역해도 그
  // 안의 날짜 형식이 계속 한국식(2026. 1. 1.)으로 고정돼 있으면 어색함
  const DATE_LOCALE_MAP = { ko: "ko-KR", en: "en-US", ja: "ja-JP", vi: "vi-VN", "zh-CN": "zh-CN" };
  const joinedAt = profile && profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(DATE_LOCALE_MAP[getCurrentLang()] || "ko-KR")
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
      <div class="profile-meta">${t("profile.joinedAtLabel", { date: joinedAt })}</div>
    </div>

    <div class="card" id="friendListCard"></div>

    <div class="card" id="statVisibilityCard"></div>

    <div class="card profile-danger-zone">
      <h2>${t("profile.dangerZone.title")}</h2>
      <p style="color:var(--text-sub); font-size:13px; line-height:1.6;">
        ${t("profile.dangerZone.desc")}
      </p>
      <button id="deleteAccountBtn" class="profile-delete-btn">${t("profile.dangerZone.btn")}</button>
    </div>
  `;

  document.getElementById("deleteAccountBtn").onclick = handleDeleteAccount;
  renderStatVisibilitySection(session.user.id, (userData && userData.stat_visibility) || null);
  renderProfileFriendListCard(session.user.id);
}

// 프로필의 친구 목록 카드 - 한 "페이지"에 5명씩 가로로 두고, 그보다 많으면 화살표를 눌러 페이지
// 전체가 옆으로 슬라이딩하며 넘어감(연속 스크롤이 아니라 책장을 넘기듯 페이지 단위로 전환)
const PROFILE_FRIENDS_PER_PAGE = 5;

async function renderProfileFriendListCard(myId) {
  const card = document.getElementById("friendListCard");
  if (!card) return;
  card.innerHTML = `<h2>${t("profile.friendList.title")}</h2><p style="color:var(--text-sub); font-size:13px;">${t("profile.friendList.loading")}</p>`;

  const friends = await getAcceptedFriends(myId);
  if (!document.getElementById("friendListCard")) return; // 그새 다른 페이지로 이동했으면 중단

  if (friends.length === 0) {
    card.innerHTML = `
      <h2>${t("profile.friendList.title")}</h2>
      <p style="color:var(--text-sub); font-size:13px;">${t("profile.friendList.empty")}</p>
    `;
    return;
  }

  const pages = [];
  for (let i = 0; i < friends.length; i += PROFILE_FRIENDS_PER_PAGE) {
    pages.push(friends.slice(i, i + PROFILE_FRIENDS_PER_PAGE));
  }

  const pagesHtml = pages.map((page) => `
    <div class="profile-friend-page">
      ${page.map((f) => `
        <div class="profile-friend-item">
          <div class="auth-avatar profile-friend-avatar">${(f.nickname || "?").slice(0, 1)}</div>
          <div class="profile-friend-name">${f.nickname}</div>
        </div>
      `).join("")}
    </div>
  `).join("");

  card.innerHTML = `
    <h2>${t("profile.friendList.title")}</h2>
    <div class="profile-friend-viewport">
      <div class="profile-friend-track" id="profileFriendTrack">${pagesHtml}</div>
    </div>
    ${pages.length > 1 ? `
      <div class="profile-friend-nav">
        <button type="button" class="profile-friend-nav-btn" id="profileFriendPrev" disabled>‹</button>
        <span class="profile-friend-page-indicator" id="profileFriendPageIndicator">${t("profile.friendList.pageIndicator", { page: 1, total: pages.length })}</span>
        <button type="button" class="profile-friend-nav-btn" id="profileFriendNext">›</button>
      </div>
    ` : ""}
  `;

  if (pages.length > 1) {
    let pageIndex = 0;
    const track = document.getElementById("profileFriendTrack");
    const prevBtn = document.getElementById("profileFriendPrev");
    const nextBtn = document.getElementById("profileFriendNext");
    const indicator = document.getElementById("profileFriendPageIndicator");

    function renderPageState() {
      track.style.transform = `translateX(-${pageIndex * 100}%)`;
      indicator.textContent = t("profile.friendList.pageIndicator", { page: pageIndex + 1, total: pages.length });
      prevBtn.disabled = pageIndex === 0;
      nextBtn.disabled = pageIndex === pages.length - 1;
    }

    prevBtn.onclick = () => { pageIndex = Math.max(0, pageIndex - 1); renderPageState(); };
    nextBtn.onclick = () => { pageIndex = Math.min(pages.length - 1, pageIndex + 1); renderPageState(); };
  }
}

// label은 모듈 로드 시점(i18n 준비 전)에 평가되면 안 되므로 번역 키만 들고, 표시할 때 t()로 변환
const STAT_VISIBILITY_CATEGORIES = [
  { key: "showBase", labelKey: "profile.statVisibility.category.showBase" },
  { key: "showConstellation", labelKey: "profile.statVisibility.category.showConstellation" },
  { key: "showRunes", labelKey: "profile.statVisibility.category.showRunes" },
  { key: "showPresets", labelKey: "profile.statVisibility.category.showPresets" }
];

function defaultStatVisibility() {
  return { enabled: true, showBase: true, showConstellation: true, showRunes: true, showPresets: true };
}

function renderStatVisibilitySection(myId, saved) {
  const vis = { ...defaultStatVisibility(), ...(saved || {}) };
  const card = document.getElementById("statVisibilityCard");

  card.innerHTML = `
    <h2>${t("profile.statVisibility.title")}</h2>
    <p style="color:var(--text-sub); font-size:13px; line-height:1.6; margin-bottom:14px;">
      ${t("profile.statVisibility.desc")}
    </p>
    <div class="setting-row" style="border-top:none; padding-top:0;">
      <div class="setting-label">${t("profile.statVisibility.enabledLabel")}</div>
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
        <span>${t(c.labelKey)}</span>
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
