// Supabase 프로젝트 접속 정보. anon/publishable 키는 클라이언트에 노출돼도 안전함(RLS가 실제 보안 담당).
// service_role 키는 절대 여기 넣지 말 것.
const SUPABASE_URL = "https://njhhvyydsgulrvnbcvcd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2t93U8vqHUYV2UQ8IUoxYA_LHvB3JWR";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
