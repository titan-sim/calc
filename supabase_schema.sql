-- 이 파일은 몇 번을 다시 실행해도 안전합니다(이미 있는 건 건드리지 않고, 없는 것만 새로 만듦).
-- 새 기능이 추가될 때마다 이 파일 전체를 그대로 복사해서 Supabase SQL Editor에 붙여넣고
-- 실행하시면 됩니다 - 어디서부터 새로 생겼는지 직접 찾아서 나눠 실행하실 필요 없습니다.

-- 공개 가능한 정체성 정보만(이메일 절대 포함 안 함)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select using (true);
drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- 닉네임 스푸핑 방지: 한글/영문/숫자/밑줄만 허용(투명 문자·전각 문자·유사 문자로 남을 속이는 걸
-- 원천 차단). 클라이언트(auth-modal.js)에서도 같은 정규식으로 검증하지만, 우회 대비 이중 방어.
do $$ begin
  alter table public.profiles
    add constraint profiles_nickname_charset check (nickname ~ '^[가-힣a-zA-Z0-9_]{2,12}$');
exception when duplicate_object then null;
end $$;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 유저별 데이터 (내 공룡 룬 세팅, 타이탄 설정 저장용)
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dino_profile jsonb,
  titan_config jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;

drop policy if exists "users can read their own data" on public.user_data;
create policy "users can read their own data"
  on public.user_data for select using (auth.uid() = user_id);
drop policy if exists "users can insert their own data" on public.user_data;
create policy "users can insert their own data"
  on public.user_data for insert with check (auth.uid() = user_id);
drop policy if exists "users can update their own data" on public.user_data;
create policy "users can update their own data"
  on public.user_data for update using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists user_data_touch_updated_at on public.user_data;
create trigger user_data_touch_updated_at
  before update on public.user_data
  for each row execute function public.touch_updated_at();

-- ===== 친구 기능 1단계 =====

-- 친구 요청/친구 관계. status='accepted'인 행이 곧 친구 관계(별도 friendships 테이블 없음).
-- 거절/요청 취소/친구 끊기는 전부 이 행을 delete하는 것으로 처리(단순화).
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);
alter table public.friend_requests enable row level security;

drop policy if exists "본인이 관련된 요청만 조회" on public.friend_requests;
create policy "본인이 관련된 요청만 조회"
  on public.friend_requests for select
  using (auth.uid() = from_user or auth.uid() = to_user);
drop policy if exists "본인이 보낸 요청만 생성" on public.friend_requests;
create policy "본인이 보낸 요청만 생성"
  on public.friend_requests for insert
  with check (auth.uid() = from_user);
drop policy if exists "받은 사람만 수락 가능" on public.friend_requests;
create policy "받은 사람만 수락 가능"
  on public.friend_requests for update
  using (auth.uid() = to_user)
  with check (auth.uid() = to_user);
drop policy if exists "당사자는 삭제(거절/취소/친구끊기) 가능" on public.friend_requests;
create policy "당사자는 삭제(거절/취소/친구끊기) 가능"
  on public.friend_requests for delete
  using (auth.uid() = from_user or auth.uid() = to_user);

-- 회원 탈퇴: 본인 계정(auth.uid())만 삭제 가능. auth.users를 지우면 profiles/user_data/
-- friend_requests가 전부 on delete cascade 외래키로 걸려있어 관련 데이터가 자동으로 함께 삭제됨.
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
