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
2. 이 프로젝트 루트의 **`supabase_schema.sql` 파일 내용 전체**를 복사해서 붙여넣고 **Run**

이 파일은 몇 번을 다시 실행해도 안전하게(idempotent) 만들어져 있습니다 — 이미 있는 테이블/정책은 건드리지 않고, 새로 추가된 부분만 반영됩니다. 그래서 **매번 어디가 새로 생겼는지 찾아 나눠 실행할 필요 없이, 항상 파일 전체를 통째로 복사해서 실행**하시면 됩니다. 앞으로 기능이 추가돼서 이 파일이 갱신되면, 똑같이 전체를 다시 복사+실행해주시면 됩니다.

⚠️ 딱 하나 예외: 닉네임에 문자 제한을 거는 부분(`profiles_nickname_charset`)은 **이미 가입된 유저 중 한글/영문/숫자/밑줄 외의 문자가 든 닉네임이 있으면 에러**가 납니다(이건 재실행 여부와 무관하게, 기존 데이터가 새 규칙에 위배될 때 나는 정상적인 에러입니다). 본인 테스트 계정뿐이라면 문제없을 거예요. 에러가 나면 Table Editor에서 `profiles` 테이블의 `nickname` 값들을 먼저 확인해주세요.

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
