# Supabase 프로젝트 설정 가이드

로그인 시스템이 실제로 동작하려면 아래 과정을 **직접** 진행하신 뒤, 얻은 값을
`js/core/supabase-config.js` 파일에 넣어주셔야 합니다 (이 파일은 이번에 같이
만들어드렸고, 어디를 채워야 하는지 주석으로 표시해뒀습니다).

## 1. 프로젝트 생성

1. https://supabase.com 접속 → 회원가입/로그인
2. **New project** 클릭
   - 이름: 예) `dino-mutant-sim`
   - Database Password: 아무 값이나 강한 비밀번호로 설정 (이 비밀번호는 클라이언트 코드에는 안 쓰이니 그냥 어딘가에 잘 적어두시면 됩니다)
   - Region: 가까운 지역 선택(예: Northeast Asia - Seoul 있으면 그걸로)
3. 프로젝트가 생성될 때까지 1~2분 정도 기다립니다.

## 2. Project URL / anon key 확인

1. 왼쪽 메뉴에서 **Project Settings → API** 로 이동
2. **Project URL** 복사 (예: `https://abcdefgh.supabase.co`)
3. **Project API keys** 항목에서 **anon / public** 키 복사
   - ⚠️ **service_role** 키는 절대 복사해서 코드에 넣지 마세요. 그건 관리자 권한 키라 노출되면 안 됩니다. 우리가 쓸 건 `anon` 키뿐입니다 (이 키는 원래 클라이언트 코드에 공개되는 게 정상이며, 실제 보안은 아래 3번의 RLS 정책이 담당합니다).

이 두 값을 `js/core/supabase-config.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`에 붙여넣어주세요.

## 3. SQL 실행

1. 왼쪽 메뉴에서 **SQL Editor** 클릭 → **New query**
2. 아래 SQL을 통째로 붙여넣고 **Run** (딱 한 번만 실행하면 됩니다)

```sql
-- 공개 가능한 정체성 정보만(이메일 절대 포함 안 함)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- 닉네임 -> 이메일 조회용 RPC (로그인/비밀번호 찾기에서 닉네임을 이메일로 변환할 때 씀)
create or replace function public.get_email_for_nickname(p_nickname text)
returns text language sql security definer set search_path = public as $$
  select u.email from auth.users u
  join public.profiles p on p.id = u.id
  where p.nickname = p_nickname limit 1;
$$;
revoke all on function public.get_email_for_nickname(text) from public;
grant execute on function public.get_email_for_nickname(text) to anon, authenticated;

-- 회원가입 시 auth 메타데이터로 같이 보낸 nickname을 profiles로 자동 복사하는 트리거.
-- (이메일 인증이 켜져 있으면 가입 직후엔 로그인 세션이 없어서 클라이언트가 직접 profiles에
--  insert를 못 하기 때문에, 세션 유무와 상관없이 항상 동작하는 이 트리거 방식을 씀)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, new.raw_user_meta_data->>'nickname')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 유저별 데이터 (내 공룡 룬 세팅, 타이탄 설정 저장용)
create table public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dino_profile jsonb,
  titan_config jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;

create policy "users can read their own data"
  on public.user_data for select using (auth.uid() = user_id);
create policy "users can insert their own data"
  on public.user_data for insert with check (auth.uid() = user_id);
create policy "users can update their own data"
  on public.user_data for update using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger user_data_touch_updated_at
  before update on public.user_data
  for each row execute function public.touch_updated_at();
```

3. 초록색 성공 메시지가 뜨면 완료입니다. (혹시 에러가 나면 스크린샷/메시지를 그대로 저에게 보여주세요.)

## 4. 이메일 인증 설정 (선택)

- **Authentication → Providers → Email** 은 기본적으로 켜져 있어서 별도 설정 없이 바로 회원가입/로그인이 됩니다.
- 기본값은 "가입 시 이메일 인증 링크 클릭 필요"입니다. 테스트 단계에서 매번 이메일 인증하기 번거로우시면 **Authentication → Settings** 에서 "Confirm email"을 꺼두셔도 됩니다(나중에 다시 켤 수 있음).

## 5. (나중에) Google 로그인 연동

이건 지금 당장은 안 하셔도 됩니다 — 로그인 창에 닉네임/이메일/비밀번호 방식이 먼저 동작하고 나서, 준비되시면 아래를 진행해주세요.

1. https://console.cloud.google.com 접속 → 프로젝트 생성(또는 기존 프로젝트 선택)
2. **APIs & Services → OAuth consent screen** → External로 설정, 앱 이름/이메일 등 입력
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: Web application
4. Supabase 대시보드의 **Authentication → Providers → Google** 페이지에 나와있는 **Callback URL**을 복사해서, 방금 만든 Google OAuth 클라이언트의 "승인된 리디렉션 URI"에 붙여넣기
5. 발급된 **Client ID / Client Secret**을 Supabase의 Google Provider 설정 화면에 입력하고 저장
6. Supabase **Authentication → URL Configuration** 에서 Site URL을 `https://titan-sim.github.io/calc/` 로 설정하고, Redirect URLs에도 같은 주소를 추가

여기까지 되면 저에게 "구글 로그인도 켜줘"라고 말씀해주시면 버튼을 활성화해드리겠습니다.

---

**정리: 지금 당장 저에게 필요한 건 2번에서 얻으신 Project URL과 anon key입니다.** 이 두 값을 알려주시면 제가 `supabase-config.js`에 바로 넣어서 실제로 동작하게 만들어드릴게요. (이 파일은 프로젝트 루트에 임시로 만든 안내 문서라 git에는 안 올릴게요 — 다 보시고 필요없으시면 지우셔도 됩니다.)
