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

// 타이탄 페이지의 전투 설정(레벨/제한시간/거리/연속전투), 타일 설정(자연의 포옹/부족의 축복/버프
// 타워), 조합 찾기용 보유 룬 레벨을 하나로 묶어 user_data.titan_config에 동기화. 재생 속도
// (dino_titan_speed_ms)는 빌드 정보가 아니라 순수 화면 재생 취향이라(다크모드처럼) 동기화 대상에서
// 뺌. 패턴은 위 dino_profile 동기화와 동일(로그인 상태에서만, 800ms 디바운스).
let titanSyncDebounceTimer = null;

function queueRemoteTitanSync() {
  clearTimeout(titanSyncDebounceTimer);
  titanSyncDebounceTimer = setTimeout(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const titanConfig = {
      config: JSON.parse(localStorage.getItem(TITAN_CONFIG_KEY) || "null"),
      tileSettings: JSON.parse(localStorage.getItem(TITAN_TILE_KEY) || "null"),
      ownedRuneLevels: JSON.parse(localStorage.getItem(TITAN_OWNED_LEVELS_KEY) || "null")
    };

    const { error } = await supabaseClient
      .from("user_data")
      .upsert({ user_id: session.user.id, titan_config: titanConfig });
    if (error) console.error("titan_config 동기화 실패:", error.message);
  }, 800);
}

// dino_profile과 동일한 로직: 서버에 이미 값이 있으면 서버가 최신 소스로 로컬을 덮어쓰고,
// 없으면(신규 로그인 등) 이 기기의 현재 값을 최초 업로드.
async function pullRemoteTitanConfigOnLogin() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const { data, error } = await supabaseClient
    .from("user_data")
    .select("titan_config")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("titan_config 불러오기 실패:", error.message);
    return;
  }

  if (data && data.titan_config) {
    const { config, tileSettings, ownedRuneLevels } = data.titan_config;
    if (config) localStorage.setItem(TITAN_CONFIG_KEY, JSON.stringify(config));
    if (tileSettings) localStorage.setItem(TITAN_TILE_KEY, JSON.stringify(tileSettings));
    if (ownedRuneLevels) localStorage.setItem(TITAN_OWNED_LEVELS_KEY, JSON.stringify(ownedRuneLevels));
  } else {
    const hasLocal = localStorage.getItem(TITAN_CONFIG_KEY)
      || localStorage.getItem(TITAN_TILE_KEY)
      || localStorage.getItem(TITAN_OWNED_LEVELS_KEY);
    if (hasLocal) queueRemoteTitanSync();
  }

  if (typeof renderRoute === "function") renderRoute();
}
