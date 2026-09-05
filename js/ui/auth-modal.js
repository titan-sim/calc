// 로그인/회원가입/비밀번호 찾기 모달. 사이드 메뉴의 "로그인" 버튼에서 openAuthModal("login")으로 열림.
// 실제 인증 성공/실패 이후의 화면 갱신(닉네임 표시, 데이터 동기화 등)은 auth-ui.js의
// supabaseClient.auth.onAuthStateChange 리스너가 맡고, 이 파일은 폼/입력/에러 표시만 담당함.

let nicknameCheckTimer = null;

// 한글/영문/숫자/밑줄만 허용 - 투명 문자, 전각 문자, 유사 문자(키릴 등)로 상대를 속이는 걸 원천 차단
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]{2,12}$/;

function buildAuthModalDom() {
  const root = document.getElementById("authModalRoot");
  if (!root || root.dataset.built) return;
  root.dataset.built = "1";
  root.innerHTML = `
    <div class="menu-overlay" id="authModalOverlay"></div>
    <div class="auth-modal" id="authModalPanel">
      <div class="auth-modal-header">
        <span id="authModalTitle">${t("common.auth.title.login")}</span>
        <button class="close-btn" id="authModalCloseBtn">✕</button>
      </div>

      <div class="auth-modal-error" id="authModalError" style="display:none;"></div>
      <div class="auth-modal-success" id="authModalSuccess" style="display:none;"></div>

      <div id="authFieldsLogin">
        <div class="auth-field">
          <label>${t("common.auth.nicknameLabel")}</label>
          <input type="text" id="loginNickname" autocomplete="username">
        </div>
        <div class="auth-field">
          <label>${t("common.auth.passwordLabel")}</label>
          <input type="password" id="loginPassword" autocomplete="current-password">
        </div>
        <button class="btn-simulate auth-submit-btn" id="loginSubmitBtn">${t("common.auth.loginBtn")}</button>
        <div class="auth-modal-links">
          <a href="#" id="goToSignup">${t("common.auth.signupLink")}</a>
          <a href="#" id="goToForgot">${t("common.auth.forgotLink")}</a>
        </div>
      </div>

      <div id="authFieldsSignup" style="display:none;">
        <div class="auth-field">
          <label>${t("common.auth.nicknameLabel")}</label>
          <input type="text" id="signupNickname" autocomplete="username">
          <div class="auth-nickname-hint" id="signupNicknameHint"></div>
        </div>
        <div class="auth-field">
          <label>${t("common.auth.signupEmailLabel")}</label>
          <input type="email" id="signupEmail" autocomplete="email">
        </div>
        <div class="auth-field">
          <label>${t("common.auth.passwordLabel")}</label>
          <input type="password" id="signupPassword" autocomplete="new-password">
        </div>
        <div class="auth-field">
          <label>${t("common.auth.passwordConfirmLabel")}</label>
          <input type="password" id="signupPasswordConfirm" autocomplete="new-password">
        </div>
        <label class="auth-consent-row">
          <input type="checkbox" id="signupConsent">
          <span>${t("common.auth.consentLabel")}</span>
        </label>
        <button class="btn-simulate auth-submit-btn" id="signupSubmitBtn" disabled>${t("common.auth.signupBtn")}</button>
        <div class="auth-modal-links">
          <a href="#" id="backToLoginFromSignup">${t("common.auth.alreadyHaveAccount")}</a>
        </div>
      </div>

      <div id="authFieldsForgot" style="display:none;">
        <div class="auth-field">
          <label>${t("common.auth.forgotIdentifierLabel")}</label>
          <input type="text" id="forgotIdentifier">
        </div>
        <button class="btn-simulate auth-submit-btn" id="forgotSubmitBtn">${t("common.auth.forgotSubmitBtn")}</button>
        <div class="auth-modal-links">
          <a href="#" id="backToLoginFromForgot">${t("common.auth.backToLogin")}</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById("authModalOverlay").onclick = closeAuthModal;
  document.getElementById("authModalCloseBtn").onclick = closeAuthModal;
  document.getElementById("goToSignup").onclick = (e) => { e.preventDefault(); setAuthMode("signup"); };
  document.getElementById("goToForgot").onclick = (e) => { e.preventDefault(); setAuthMode("forgot"); };
  document.getElementById("backToLoginFromSignup").onclick = (e) => { e.preventDefault(); setAuthMode("login"); };
  document.getElementById("backToLoginFromForgot").onclick = (e) => { e.preventDefault(); setAuthMode("login"); };

  document.getElementById("loginSubmitBtn").onclick = handleLoginSubmit;
  document.getElementById("signupSubmitBtn").onclick = handleSignupSubmit;
  document.getElementById("forgotSubmitBtn").onclick = handleForgotSubmit;

  // 닉네임/비밀번호 입력 후 버튼을 직접 눌러야만 로그인되던 것 - 두 입력칸 어디서든 Enter를 누르면
  // 바로 제출되게 함(로그인 폼만 해당, 회원가입/비밀번호 찾기는 요청 범위 밖이라 그대로 둠)
  const submitLoginOnEnter = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleLoginSubmit();
  };
  document.getElementById("loginNickname").addEventListener("keydown", submitLoginOnEnter);
  document.getElementById("loginPassword").addEventListener("keydown", submitLoginOnEnter);

  document.getElementById("signupNickname").addEventListener("input", scheduleNicknameCheck);
  document.getElementById("signupConsent").addEventListener("change", (e) => {
    document.getElementById("signupSubmitBtn").disabled = !e.target.checked;
  });

  document.addEventListener("keydown", (e) => {
    const panel = document.getElementById("authModalPanel");
    if (e.key === "Escape" && panel && panel.classList.contains("open")) closeAuthModal();
  });
}

function openAuthModal(mode = "login") {
  buildAuthModalDom();
  setAuthMode(mode);
  document.getElementById("authModalOverlay").style.display = "block";
  document.getElementById("authModalPanel").classList.add("open");
  lockBodyScroll();
}

function closeAuthModal() {
  const overlay = document.getElementById("authModalOverlay");
  const panel = document.getElementById("authModalPanel");
  if (!overlay || !panel) return;
  overlay.style.display = "none";
  panel.classList.remove("open");
  unlockBodyScroll();
}

const AUTH_MODE_TITLE_KEYS = { login: "common.auth.title.login", signup: "common.auth.title.signup", forgot: "common.auth.title.forgot" };

// 폼 전환 시 필드/버튼/힌트를 전부 기본 상태로 리셋(가입완료 안내 등으로 필드를 숨겼던 상태 포함)
function setAuthMode(mode) {
  document.getElementById("authModalTitle").innerText = t(AUTH_MODE_TITLE_KEYS[mode]);
  document.getElementById("authFieldsLogin").style.display = mode === "login" ? "block" : "none";
  document.getElementById("authFieldsSignup").style.display = mode === "signup" ? "block" : "none";
  document.getElementById("authFieldsForgot").style.display = mode === "forgot" ? "block" : "none";

  document.querySelectorAll("#authFieldsSignup .auth-field, #authFieldsSignup .auth-consent-row, #authFieldsSignup button, #authFieldsSignup .auth-modal-links")
    .forEach((el) => (el.style.display = ""));
  document.querySelectorAll("#authFieldsForgot .auth-field, #authFieldsForgot button")
    .forEach((el) => (el.style.display = ""));

  document.getElementById("signupNicknameHint").innerText = "";
  document.getElementById("loginNickname").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("signupConsent").checked = false;
  document.getElementById("signupSubmitBtn").disabled = true;

  clearAuthError();
  clearAuthSuccess();
}

function showAuthError(msg) {
  clearAuthSuccess();
  const el = document.getElementById("authModalError");
  el.innerText = msg;
  el.style.display = "block";
}

function clearAuthError() {
  const el = document.getElementById("authModalError");
  if (!el) return;
  el.innerText = "";
  el.style.display = "none";
}

// 폼 필드를 숨기고 안내 문구만 보여줌(이메일 인증 대기, 재설정 메일 발송 완료 등)
function showAuthSuccessAndHideFields(containerId, msg) {
  clearAuthError();
  document.querySelectorAll(`#${containerId} .auth-field, #${containerId} .auth-consent-row, #${containerId} button`)
    .forEach((el) => (el.style.display = "none"));
  const el = document.getElementById("authModalSuccess");
  el.innerText = msg;
  el.style.display = "block";
}

function clearAuthSuccess() {
  const el = document.getElementById("authModalSuccess");
  if (!el) return;
  el.innerText = "";
  el.style.display = "none";
}

function setSubmitBusy(btnId, busy, busyText, idleText) {
  const btn = document.getElementById(btnId);
  btn.disabled = busy;
  btn.innerText = busy ? busyText : idleText;
}

// 닉네임 중복 여부 실시간 힌트(UX용 사전 체크일 뿐, 최종 중복 방지는 DB unique 제약이 담당)
function scheduleNicknameCheck() {
  clearTimeout(nicknameCheckTimer);
  const input = document.getElementById("signupNickname");
  const hint = document.getElementById("signupNicknameHint");
  const nickname = input.value.trim();
  hint.innerText = "";
  hint.className = "auth-nickname-hint";
  if (!nickname) return;
  if (!NICKNAME_PATTERN.test(nickname)) {
    hint.innerText = t("common.auth.nicknameRuleMsg");
    hint.classList.add("auth-nickname-hint-bad");
    return;
  }
  nicknameCheckTimer = setTimeout(async () => {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();
    if (error) return;
    if (data) {
      hint.innerText = t("common.auth.nicknameTaken");
      hint.classList.add("auth-nickname-hint-bad");
    } else {
      hint.innerText = t("common.auth.nicknameAvailable");
      hint.classList.add("auth-nickname-hint-good");
    }
  }, 400);
}

async function handleLoginSubmit() {
  clearAuthError();
  const nickname = document.getElementById("loginNickname").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!nickname || !password) {
    showAuthError(t("common.auth.loginMissingFields"));
    return;
  }

  setSubmitBusy("loginSubmitBtn", true, t("common.auth.loginBusy"), t("common.auth.loginBtn"));
  try {
    const { data: email, error: rpcError } = await supabaseClient.rpc("get_email_for_nickname", { p_nickname: nickname });
    if (rpcError || !email) {
      showAuthError(t("common.auth.loginWrong"));
      return;
    }
    const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (signInError) {
      showAuthError(t("common.auth.loginWrong"));
      return;
    }
    closeAuthModal();
  } finally {
    setSubmitBusy("loginSubmitBtn", false, t("common.auth.loginBusy"), t("common.auth.loginBtn"));
  }
}

async function handleSignupSubmit() {
  clearAuthError();
  const nickname = document.getElementById("signupNickname").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const passwordConfirm = document.getElementById("signupPasswordConfirm").value;

  if (!nickname || !email || !password || !passwordConfirm) {
    showAuthError(t("common.auth.signupMissingFields"));
    return;
  }
  if (!document.getElementById("signupConsent").checked) {
    showAuthError(t("common.auth.signupConsentRequired"));
    return;
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    showAuthError(t("common.auth.nicknameRuleMsg"));
    return;
  }
  if (password.length < 6) {
    showAuthError(t("common.auth.passwordTooShort"));
    return;
  }
  if (password !== passwordConfirm) {
    showAuthError(t("common.auth.passwordMismatch"));
    return;
  }

  setSubmitBusy("signupSubmitBtn", true, t("common.auth.signupBusy"), t("common.auth.signupBtn"));
  try {
    const { data: existing } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();
    if (existing) {
      showAuthError(t("common.auth.nicknameTakenPeriod"));
      return;
    }

    // nickname은 auth 메타데이터로 같이 보냄 -> DB 트리거(on_auth_user_created)가 profiles 행을 자동 생성함.
    // (이메일 인증이 켜져 있으면 가입 직후엔 세션이 없어서 클라이언트에서 직접 profiles insert가 안 되기 때문)
    // privacy_policy_agreed_at: 개인정보처리방침 동의 시각도 같이 기록(분쟁 시 "언제 동의했는지" 근거용)
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { nickname, privacy_policy_agreed_at: new Date().toISOString() } }
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("nickname")) {
        showAuthError(t("common.auth.nicknameTakenPeriod"));
      } else if (msg.includes("already registered") || msg.includes("already exists")) {
        showAuthError(t("common.auth.emailAlreadyRegistered"));
      } else {
        showAuthError(t("common.auth.signupGenericError", { error: error.message }));
      }
      return;
    }

    if (data.session) {
      // 이메일 인증이 꺼져 있으면 가입과 동시에 로그인 세션이 생김
      closeAuthModal();
    } else {
      showAuthSuccessAndHideFields("authFieldsSignup", t("common.auth.signupEmailSent"));
    }
  } finally {
    setSubmitBusy("signupSubmitBtn", false, t("common.auth.signupBusy"), t("common.auth.signupBtn"));
  }
}

async function handleForgotSubmit() {
  clearAuthError();
  const identifier = document.getElementById("forgotIdentifier").value.trim();
  if (!identifier) {
    showAuthError(t("common.auth.forgotMissingFields"));
    return;
  }

  setSubmitBusy("forgotSubmitBtn", true, t("common.auth.forgotBusy"), t("common.auth.forgotSubmitBtn"));
  try {
    let email = identifier.includes("@") ? identifier : null;
    if (!email) {
      const { data } = await supabaseClient.rpc("get_email_for_nickname", { p_nickname: identifier });
      email = data || null;
    }
    if (email) {
      await supabaseClient.auth.resetPasswordForEmail(email);
    }
    // 계정 존재 여부를 노출하지 않기 위해 찾았든 못 찾았든 같은 안내를 보여줌
    showAuthSuccessAndHideFields("authFieldsForgot", t("common.auth.forgotSent"));
  } finally {
    setSubmitBusy("forgotSubmitBtn", false, t("common.auth.forgotBusy"), t("common.auth.forgotSubmitBtn"));
  }
}
