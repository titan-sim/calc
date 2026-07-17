// 로그인/회원가입/비밀번호 찾기 모달. 사이드 메뉴의 "로그인" 버튼에서 openAuthModal("login")으로 열림.
// 실제 인증 성공/실패 이후의 화면 갱신(닉네임 표시, 데이터 동기화 등)은 auth-ui.js의
// supabaseClient.auth.onAuthStateChange 리스너가 맡고, 이 파일은 폼/입력/에러 표시만 담당함.

let nicknameCheckTimer = null;

function buildAuthModalDom() {
  const root = document.getElementById("authModalRoot");
  if (!root || root.dataset.built) return;
  root.dataset.built = "1";
  root.innerHTML = `
    <div class="menu-overlay" id="authModalOverlay"></div>
    <div class="auth-modal" id="authModalPanel">
      <div class="auth-modal-header">
        <span id="authModalTitle">로그인</span>
        <button class="close-btn" id="authModalCloseBtn">✕</button>
      </div>

      <div class="auth-modal-error" id="authModalError" style="display:none;"></div>
      <div class="auth-modal-success" id="authModalSuccess" style="display:none;"></div>

      <div id="authFieldsLogin">
        <div class="auth-field">
          <label>닉네임</label>
          <input type="text" id="loginNickname" autocomplete="username">
        </div>
        <div class="auth-field">
          <label>비밀번호</label>
          <input type="password" id="loginPassword" autocomplete="current-password">
        </div>
        <button class="btn-simulate auth-submit-btn" id="loginSubmitBtn">로그인</button>
        <div class="auth-modal-links">
          <a href="#" id="goToSignup">회원가입</a>
          <a href="#" id="goToForgot">비밀번호를 잊으셨나요?</a>
        </div>
      </div>

      <div id="authFieldsSignup" style="display:none;">
        <div class="auth-field">
          <label>닉네임</label>
          <input type="text" id="signupNickname" autocomplete="username">
          <div class="auth-nickname-hint" id="signupNicknameHint"></div>
        </div>
        <div class="auth-field">
          <label>이메일 (비밀번호 재설정에 사용)</label>
          <input type="email" id="signupEmail" autocomplete="email">
        </div>
        <div class="auth-field">
          <label>비밀번호</label>
          <input type="password" id="signupPassword" autocomplete="new-password">
        </div>
        <div class="auth-field">
          <label>비밀번호 확인</label>
          <input type="password" id="signupPasswordConfirm" autocomplete="new-password">
        </div>
        <button class="btn-simulate auth-submit-btn" id="signupSubmitBtn">가입하기</button>
        <div class="auth-modal-links">
          <a href="#" id="backToLoginFromSignup">이미 계정이 있으신가요? 로그인</a>
        </div>
      </div>

      <div id="authFieldsForgot" style="display:none;">
        <div class="auth-field">
          <label>닉네임 또는 이메일</label>
          <input type="text" id="forgotIdentifier">
        </div>
        <button class="btn-simulate auth-submit-btn" id="forgotSubmitBtn">재설정 링크 보내기</button>
        <div class="auth-modal-links">
          <a href="#" id="backToLoginFromForgot">로그인으로 돌아가기</a>
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

  document.getElementById("signupNickname").addEventListener("input", scheduleNicknameCheck);

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
}

function closeAuthModal() {
  const overlay = document.getElementById("authModalOverlay");
  const panel = document.getElementById("authModalPanel");
  if (!overlay || !panel) return;
  overlay.style.display = "none";
  panel.classList.remove("open");
}

const AUTH_MODE_TITLES = { login: "로그인", signup: "회원가입", forgot: "비밀번호 찾기" };

// 폼 전환 시 필드/버튼/힌트를 전부 기본 상태로 리셋(가입완료 안내 등으로 필드를 숨겼던 상태 포함)
function setAuthMode(mode) {
  document.getElementById("authModalTitle").innerText = AUTH_MODE_TITLES[mode];
  document.getElementById("authFieldsLogin").style.display = mode === "login" ? "block" : "none";
  document.getElementById("authFieldsSignup").style.display = mode === "signup" ? "block" : "none";
  document.getElementById("authFieldsForgot").style.display = mode === "forgot" ? "block" : "none";

  document.querySelectorAll("#authFieldsSignup .auth-field, #authFieldsSignup button, #authFieldsSignup .auth-modal-links")
    .forEach((el) => (el.style.display = ""));
  document.querySelectorAll("#authFieldsForgot .auth-field, #authFieldsForgot button")
    .forEach((el) => (el.style.display = ""));

  document.getElementById("signupNicknameHint").innerText = "";
  document.getElementById("loginNickname").value = "";
  document.getElementById("loginPassword").value = "";

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
  document.querySelectorAll(`#${containerId} .auth-field, #${containerId} button`)
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
  nicknameCheckTimer = setTimeout(async () => {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();
    if (error) return;
    if (data) {
      hint.innerText = "이미 사용 중인 닉네임입니다";
      hint.classList.add("auth-nickname-hint-bad");
    } else {
      hint.innerText = "사용 가능한 닉네임입니다";
      hint.classList.add("auth-nickname-hint-good");
    }
  }, 400);
}

async function handleLoginSubmit() {
  clearAuthError();
  const nickname = document.getElementById("loginNickname").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!nickname || !password) {
    showAuthError("닉네임과 비밀번호를 입력해주세요.");
    return;
  }

  setSubmitBusy("loginSubmitBtn", true, "로그인 중...", "로그인");
  try {
    const { data: email, error: rpcError } = await supabaseClient.rpc("get_email_for_nickname", { p_nickname: nickname });
    if (rpcError || !email) {
      showAuthError("닉네임 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (signInError) {
      showAuthError("닉네임 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    closeAuthModal();
  } finally {
    setSubmitBusy("loginSubmitBtn", false, "로그인 중...", "로그인");
  }
}

async function handleSignupSubmit() {
  clearAuthError();
  const nickname = document.getElementById("signupNickname").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const passwordConfirm = document.getElementById("signupPasswordConfirm").value;

  if (!nickname || !email || !password || !passwordConfirm) {
    showAuthError("모든 항목을 입력해주세요.");
    return;
  }
  if (password.length < 6) {
    showAuthError("비밀번호는 6자 이상이어야 합니다.");
    return;
  }
  if (password !== passwordConfirm) {
    showAuthError("비밀번호가 일치하지 않습니다.");
    return;
  }

  setSubmitBusy("signupSubmitBtn", true, "가입 중...", "가입하기");
  try {
    const { data: existing } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();
    if (existing) {
      showAuthError("이미 사용 중인 닉네임입니다.");
      return;
    }

    // nickname은 auth 메타데이터로 같이 보냄 -> DB 트리거(on_auth_user_created)가 profiles 행을 자동 생성함.
    // (이메일 인증이 켜져 있으면 가입 직후엔 세션이 없어서 클라이언트에서 직접 profiles insert가 안 되기 때문)
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { nickname } }
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("nickname")) {
        showAuthError("이미 사용 중인 닉네임입니다.");
      } else if (msg.includes("already registered") || msg.includes("already exists")) {
        showAuthError("이미 가입된 이메일입니다.");
      } else {
        showAuthError("회원가입 중 오류가 발생했습니다: " + error.message);
      }
      return;
    }

    if (data.session) {
      // 이메일 인증이 꺼져 있으면 가입과 동시에 로그인 세션이 생김
      closeAuthModal();
    } else {
      showAuthSuccessAndHideFields("authFieldsSignup", "가입 확인 이메일을 보냈습니다. 이메일의 링크를 눌러 인증을 완료한 뒤 로그인해주세요.");
    }
  } finally {
    setSubmitBusy("signupSubmitBtn", false, "가입 중...", "가입하기");
  }
}

async function handleForgotSubmit() {
  clearAuthError();
  const identifier = document.getElementById("forgotIdentifier").value.trim();
  if (!identifier) {
    showAuthError("닉네임 또는 이메일을 입력해주세요.");
    return;
  }

  setSubmitBusy("forgotSubmitBtn", true, "전송 중...", "재설정 링크 보내기");
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
    showAuthSuccessAndHideFields("authFieldsForgot", "입력하신 정보와 일치하는 계정이 있다면, 이메일로 재설정 링크를 보내드렸습니다.");
  } finally {
    setSubmitBusy("forgotSubmitBtn", false, "전송 중...", "재설정 링크 보내기");
  }
}
