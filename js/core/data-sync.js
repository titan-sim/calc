// 로그인 상태일 때만 dino_my_profile을 Supabase user_data 테이블과 주고받음.
// 로그아웃 상태면 전부 조용히 no-op이라, 로그인 기능이 생기기 전과 동일하게 localStorage만 씀.

let syncDebounceTimer = null;

// 룬 편집 등으로 프로필이 바뀔 때마다 my-dino-page.js의 saveMyDinoProfile()에서 호출됨.
// 매 호출마다 서버에 쏘면 너무 잦으니 800ms 디바운스.
function queueRemoteSync(profile) {
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { error } = await supabaseClient
      .from("user_data")
      .upsert({ user_id: session.user.id, dino_profile: profile });
    if (error) console.error("dino_profile 동기화 실패:", error.message);
  }, 800);
}

// 로그인 성공 직후 호출: 서버에 저장된 데이터가 있으면 그걸로 로컬을 덮어쓰고(서버가 항상 최신 소스),
// 없으면(신규 가입 등) 지금 이 기기의 localStorage 값을 서버로 최초 업로드함.
async function pullRemoteProfileOnLogin() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const { data, error } = await supabaseClient
    .from("user_data")
    .select("dino_profile")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("dino_profile 불러오기 실패:", error.message);
    return;
  }

  if (data && data.dino_profile) {
    localStorage.setItem(MY_DINO_PROFILE_KEY, JSON.stringify(data.dino_profile));
  } else {
    const localProfile = localStorage.getItem(MY_DINO_PROFILE_KEY);
    if (localProfile) {
      const { error: upsertError } = await supabaseClient
        .from("user_data")
        .upsert({ user_id: session.user.id, dino_profile: JSON.parse(localProfile) });
      if (upsertError) console.error("초기 dino_profile 업로드 실패:", upsertError.message);
    }
  }

  if (typeof renderRoute === "function") renderRoute();
}
