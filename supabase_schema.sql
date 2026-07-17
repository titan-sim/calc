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
