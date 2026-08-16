# 번역용 텍스트 목록 (한국어 → 영어)

다이노 뮤턴트 시뮬레이터 사이트 전체의 사용자 노출 텍스트를 한국어 원문과 영어 번역으로 정리한 표입니다. `{placeholder}` 형태는 실행 중에 채워지는 변수 자리이므로 그대로 유지했습니다. 같은 내용이 `translation-strings.json`(한국어 원문)과 `translation-strings.en.json`(번역)에 키-값 형태로도 들어있습니다.

## index.html (메타 태그·메뉴)

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `index_html.siteTitle` | 다이노 뮤턴트 시뮬레이터 | Dino Mutant Simulator |
| `index_html.siteDescription` | 다이노 뮤턴트의 타이탄/공룡 대전/아레나 결과를 미리 예측할 수 있습니다. | Predict Dino Mutant's Titan, Dino Battle, and Arena results in advance. |
| `index_html.menuLabel` | 메뉴 | Menu |
| `index_html.navHome` | 홈 | Home |
| `index_html.navMyDino` | 내 공룡 | My Dino |
| `index_html.navTitan` | 타이탄 | Titan |
| `index_html.navDinoBattle` | 공룡 대전 | Dino Battle |
| `index_html.navArena` | 아레나 | Arena |
| `index_html.navDummy` | 허수아비 | Dummy |
| `index_html.navBuilding` | 건물 | Buildings |
| `index_html.navExternalSiteLabel` | 외부 사이트 | External Site |
| `index_html.navExternalGameLink` | Dino Run (팬메이드 게임) | Dino Run (Fan-made Game) |
| `index_html.themeDark` | 다크모드 | Dark Mode |
| `index_html.themeLight` | 라이트모드 | Light Mode |
| `index_html.logToggleLabel` | 상세 로그 수집 | Collect Detailed Logs |
| `index_html.privacyFooterLink` | 개인정보처리방침 | Privacy Policy |
| `index_html.headerSubtitle` | 시뮬레이터 | Simulator |

## 홈

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `home.heroTitleSuffix` | 시뮬레이터 | Simulator |
| `home.heroSub` | 룬 조합부터 전투 결과까지, 미리 계산하고 전략을 세워보세요. | From rune combinations to battle outcomes — calculate in advance and plan your strategy. |
| `home.tile.myDino.title` | 내 공룡 | My Dino |
| `home.tile.myDino.desc` | 룬 세팅 프리셋 관리 | Manage rune setup presets |
| `home.tile.titan.title` | 타이탄 시뮬레이터 | Titan Simulator |
| `home.tile.titan.desc` | 보스 전투 결과 예측 | Predict boss battle results |
| `home.tile.dinoBattle.title` | 공룡 대전 | Dino Battle |
| `home.tile.dinoBattle.desc` | 공룡간 전투 결과 예측 | Predict dino-vs-dino battle results |
| `home.tile.arena.title` | 아레나 | Arena |
| `home.tile.arena.desc` | 5:5 진영전 예측 | Predict 5v5 team battle results |
| `home.tile.dummy.title` | 허수아비 | Dummy |
| `home.tile.dummy.desc` | 허수아비 대상 딜 측정 | Measure DPS against a training dummy |
| `home.tile.building.title` | 건물 | Buildings |
| `home.tile.building.desc` | 건물 공략 결과 예측 | Predict building siege results |
| `home.tile.soonTag` | 준비 중 | Coming Soon |
| `home.gameInfoModal.title` | 다이노 뮤턴트 시뮬레이터 | Dino Mutant Simulator |
| `home.gameInfoModal.desc` | 룬 조합, 별자리, 둥지·알스킨 등 다양한 설정을 바탕으로 공룡의 전투력과 대전 결과를 미리 계산해볼 수 있는 도구입니다. 본 사이트는 게임 "다이노 뮤턴트"의 공식 사이트가 아니며, 게임 개발사·배급사와 관련이 없는 개인이 만든 비공식 팬메이드 시뮬레이터입니다. | A tool for calculating your dino's combat power and battle outcomes based on rune combinations, constellations, nest/egg skins, and other settings. This site is not the official site for the game "Dino Mutant" and is an unofficial fan-made simulator with no affiliation to the game's developer or publisher. |
| `home.gameInfoModal.downloadSectionTitle` | 공식 게임 다운로드 | Official Game Download |
| `home.gameInfoModal.skinSectionTitle` | 공룡 스킨 미리보기 (게임사 공식) | Dino Skin Preview (Official) |
| `home.gameInfoModal.skinLinkLabel` | 스킨 미리보기 사이트 | Skin Preview Site |

## 허수아비

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `dummy.heading` | 허수아비 | Dummy |
| `dummy.warning` | ※ 본 시뮬레이터는 참고용이며, 실제 연산 방식과 차이가 있을 수 있습니다. | ※ This simulator is for reference only and may differ from the actual game's calculations. |
| `dummy.tileCard.title` | 타일 설정 | Tile Settings |
| `dummy.tile.natureLabel` | 자연 구조물과 인접 (자연의 포옹) | Adjacent to Nature Structure (Nature's Embrace) |
| `dummy.tile.tribeLabel` | 부족 점령 상태 (부족의 축복) | Tribe Control Status (Tribe's Blessing) |
| `dummy.tile.tribeTooltip` | 허수아비는 부족이 점령한 타일에만 설치할 수 있어서 항상 켜져 있습니다 | The Dummy can only be placed on a tile controlled by a tribe, so this setting is always active. |
| `dummy.tile.atkTowerLabel` | 공격력 버프 타워 | Attack Buff Tower |
| `dummy.tile.noneOption` | 없음 | None |
| `dummy.tile.serverLevelCapLabel` | 서버 레벨캡 | Server Level Cap |
| `dummy.tile.constellationCapLabel` | 서버 별자리캡 | Server Constellation Cap |
| `dummy.tab.quick` | 빠른 계산 | Quick Calc |
| `dummy.tab.live` | 시뮬레이션 | Simulation |
| `dummy.tab.optimize` | 조합 찾기 | Find Combo |
| `dummy.quick.desc` | 현재 설정의 크리티컬 확률·피해까지 반영한 1초당 평균 대미지(기댓값)와, 그 페이스로 10분간 공격했을 때의 예상 총 대미지를 바로 계산합니다. | Instantly calculates the average damage per second (expected value), including critical rate/damage under the current settings, and the projected total damage after attacking at that pace for 10 minutes. |
| `dummy.quick.calcBtn` | 계산하기 | Calculate |
| `dummy.quick.tenMinLabel` | 10분간 예상 총 대미지 | Projected Total Damage in 10 Min |
| `dummy.quick.dpsLabel` | 예상 평균 초당 대미지 | Projected Average DPS |
| `dummy.quick.critRateLabel` | 치명타 확률 | Critical Rate |
| `dummy.quick.critDmgLabel` | 치명타 피해 | Critical Damage |
| `dummy.optimize.title` | 내 룬 레벨로 최적 조합 찾기 | Find the Best Combo with My Rune Levels |
| `dummy.optimize.desc` | 적합 룬 14종 중 보유한 룬의 레벨을 입력하세요(0 = 미보유). 지금 스탯·별자리·타일 설정 기준으로 가장 대미지가 높은 5개 조합을 찾아줍니다. | Enter the levels of the suitable runes you own (14 types, 0 = not owned). Finds the 5-rune combo with the highest damage based on your current stats, constellation, and tile settings. |
| `dummy.optimize.btn` | 최적 조합 찾기 | Find Best Combo |
| `dummy.optimize.needLevelsMsg` | 보유한 룬 레벨을 먼저 입력해주세요. | Please enter your owned rune levels first. |
| `dummy.optimize.limitedSlotMsg` | 보유한 적합 룬이 {count}개뿐이라 {slotCount}개짜리 조합까지만 계산했습니다. | Only {count} suitable runes are owned, so only {slotCount}-rune combos were calculated. |
| `dummy.optimize.bestComboLabel` | 최적 조합 | Best Combo |
| `dummy.optimize.runnerUpLine` | {rank}위 · {names} ({dps}) | #{rank} · {names} ({dps}) |
| `dummy.scarecrowAlt` | 허수아비 | Dummy |
| `dummy.stats.totalDmgLabel` | 총 대미지 | Total Damage |
| `dummy.stats.elapsedLabel` | 경과 시간 | Elapsed Time |
| `dummy.stats.elapsedValue` | {sec}초 | {sec}s |
| `dummy.stats.dpsLabel` | 평균 초당 대미지 | Average DPS |
| `dummy.startBtnIdle` | 공격 시작 | Start Attack |
| `dummy.startBtnRunning` | 일시정지 | Pause |
| `dummy.startBtnPaused` | 재개 | Resume |
| `dummy.restartBtnTooltip` | 처음부터 다시 시작 | Restart from the Beginning |
| `dummy.unsuitableRuneLabel` | 허수아비에 적합하지 않은 룬입니다 | Rune not suitable for the Dummy |

## 프로필

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `profile.title` | 프로필 | Profile |
| `profile.loginRequired` | 로그인 후 이용할 수 있습니다. | Please log in to use this. |
| `profile.joinedAtLabel` | 가입일: {date} | Joined: {date} |
| `profile.dangerZone.title` | 회원 탈퇴 | Delete Account |
| `profile.dangerZone.desc` | 탈퇴하면 닉네임, 저장된 룬 조합 등 계정 데이터가 모두 삭제되며 되돌릴 수 없습니다. | Deleting your account will permanently erase your nickname, saved rune combos, and all other account data. This cannot be undone. |
| `profile.dangerZone.btn` | 회원 탈퇴 | Delete Account |
| `profile.unknownNickname` | (알 수 없음) | (Unknown) |
| `profile.friendList.title` | 친구 목록 | Friends List |
| `profile.friendList.loading` | 불러오는 중... | Loading... |
| `profile.friendList.empty` | 아직 친구가 없습니다. "친구" 메뉴에서 친구를 추가해보세요. | You don't have any friends yet. Add friends from the "Friends" menu. |
| `profile.friendList.pageIndicator` | {page} / {total} | {page} / {total} |
| `profile.statVisibility.title` | 공룡 스탯 공개 설정 | Dino Stat Visibility Settings |
| `profile.statVisibility.desc` | 친구가 내 공룡 스탯을 확인할 수 있는지, 어디까지 볼 수 있는지 정합니다. 친구 요청은 서로 수락해야 맺어지는 관계라 기본값은 공개입니다. | Decide whether friends can view your dino stats, and how much they can see. Since friend requests require mutual acceptance, the default is public. |
| `profile.statVisibility.enabledLabel` | 친구에게 내 공룡 스탯 공개 | Show My Dino Stats to Friends |
| `profile.statVisibility.category.showBase` | 기본 스탯 | Base Stats |
| `profile.statVisibility.category.showConstellation` | 별자리 | Constellation |
| `profile.statVisibility.category.showRunes` | 룬 | Runes |
| `profile.statVisibility.category.showPresets` | 프리셋 | Presets |

## 개인정보처리방침

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `privacy.title` | 개인정보처리방침 | Privacy Policy |
| `privacy.updatedLine` | 시행일자: {effectiveDate} · 최종 수정일: {lastUpdated} | Effective Date: {effectiveDate} · Last Updated: {lastUpdated} |
| `privacy.lead` | 다이노 뮤턴트 시뮬레이터(이하 "본 사이트")는 이용자의 개인정보를 소중히 다루며, 아래와 같은 기준으로 개인정보를 수집·이용·보관합니다. | Dino Mutant Simulator ("this site") values your privacy and collects, uses, and retains your personal information according to the standards below. |
| `privacy.section1.title` | 1. 수집하는 개인정보 항목 | 1. Personal Information Collected |
| `privacy.section1.item1` | <b>회원가입 시</b>: 닉네임, 이메일, 비밀번호(암호화되어 저장되며 운영자도 열람할 수 없습니다) | <b>When signing up</b>: Nickname, email, and password (stored encrypted; not even the operator can view it) |
| `privacy.section1.item2` | <b>로그인 이용 중</b>: "내 공룡" 탭에서 설정한 룬 조합·별자리·기본 스탯 등 시뮬레이터 프로필 데이터 (다른 시뮬레이터의 설정은 서버에 저장되지 않고 이용 중인 기기의 브라우저에만 남습니다) | <b>While logged in</b>: Simulator profile data such as rune combos, constellation, and base stats set in the "My Dino" tab (settings for other simulators are not saved to the server and remain only in your device's browser) |
| `privacy.section2.title` | 2. 수집 목적 | 2. Purpose of Collection |
| `privacy.section2.item1` | 닉네임·비밀번호: 로그인 인증 | Nickname/password: Login authentication |
| `privacy.section2.item2` | 이메일: 비밀번호 재설정 링크 발송 용도로만 사용하며, 그 외 목적(광고성 메일 발송 등)으로 쓰지 않습니다 | Email: Used only to send password reset links, never for other purposes (e.g. promotional emails) |
| `privacy.section2.item3` | 시뮬레이터 프로필 데이터: 여러 기기에서 같은 설정을 이어서 볼 수 있도록 동기화 | Simulator profile data: Syncing your settings so you can continue on other devices |
| `privacy.section3.title` | 3. 보관 기간 및 삭제 | 3. Retention and Deletion Period |
| `privacy.section3.body` | 수집한 개인정보는 회원 탈퇴 또는 삭제 요청 시 지체 없이 파기합니다. | Collected personal information is destroyed without delay upon account deletion or deletion request. |
| `privacy.section3.note` | 로그인 후 사이드 메뉴의 닉네임을 눌러 프로필로 이동하시면, 회원 탈퇴 버튼이 있습니다. <a href="#profile">여기</a>를 눌러 바로 이동할 수도 있습니다. 확인 절차를 거쳐 계정과 저장된 데이터가 즉시 삭제됩니다. 로그인이 어려운 경우 아래 문의처로 가입하신 이메일과 닉네임을 알려주시면 대신 처리해드립니다. | After logging in, tap your nickname in the side menu to go to your profile, where you'll find an account deletion button. You can also go there directly by clicking <a href="#profile">here</a>. After a confirmation step, your account and stored data will be deleted immediately. If you're unable to log in, contact us at the email below with your registered email and nickname and we'll process it for you. |
| `privacy.section4.title` | 4. 개인정보 처리 위탁 | 4. Outsourcing of Personal Information Processing |
| `privacy.section4.body` | 본 사이트는 원활한 서비스 제공(인증 및 데이터 저장)을 위해 외부 서비스인 <b>Supabase</b>(해외 서비스)를 이용하고 있으며, 이에 따라 개인정보 처리 업무를 위탁하고 있습니다. 이용자가 입력한 정보는 Supabase의 서버에 저장되며, Supabase 자체의 개인정보처리방침이 함께 적용됩니다. 그 외의 목적으로 제3자에게 개인정보를 제공하지 않습니다. | This site uses the external service <b>Supabase</b> (an overseas service) to provide reliable service (authentication and data storage), and accordingly outsources personal information processing to it. Information you enter is stored on Supabase's servers, and Supabase's own privacy policy applies as well. We do not provide personal information to any other third party for any other purpose. |
| `privacy.section5.title` | 5. 안전성 확보 조치 | 5. Security Measures |
| `privacy.section5.body` | 본 사이트는 이용자의 개인정보를 보호하기 위해 기술적·관리적 보호 조치를 취하고 있습니다. 비밀번호는 암호화되어 저장되어 운영자를 포함한 누구도 원문을 확인할 수 없으며, 데이터베이스 접근은 인증된 본인만 가능하도록 제한되어 있습니다. | This site takes technical and administrative measures to protect your personal information. Passwords are stored encrypted so that no one, including the operator, can view the original text, and database access is restricted to authenticated individuals only. |
| `privacy.section6.title` | 6. 브라우저에 저장되는 데이터 | 6. Data Stored in Your Browser |
| `privacy.section6.body` | 로그인 여부와 무관하게, 입력한 스탯·룬 조합 등 시뮬레이터 설정은 편의를 위해 이용 중인 기기의 브라우저(localStorage)에도 저장됩니다. 이 데이터는 서버로 전송되지 않으며(로그인한 "내 공룡" 탭 제외), 브라우저 저장공간을 지우면 함께 삭제됩니다. | Regardless of login status, simulator settings such as entered stats and rune combos are also stored in your device's browser (localStorage) for convenience. This data is not transmitted to the server (except for the logged-in "My Dino" tab), and is deleted when you clear your browser storage. |
| `privacy.section7.title` | 7. 이용자의 권리 | 7. User Rights |
| `privacy.section7.body` | 이용자는 언제든 자신의 개인정보 열람·정정·삭제를 요청할 수 있습니다. 아래 문의처로 연락해주시면 확인 후 조치해드립니다. | You may request to view, correct, or delete your personal information at any time. Please contact us at the address below and we will take action after confirmation. |
| `privacy.section8.title` | 8. 비공식 팬메이드 안내 | 8. Unofficial Fan-made Notice |
| `privacy.section8.body` | 본 사이트는 게임 "다이노 뮤턴트"의 공식 사이트가 아니며, 게임 개발사·배급사와 아무런 관련이 없는 개인이 만든 비공식 팬메이드 시뮬레이터입니다. | This site is not the official site for the game "Dino Mutant" and is an unofficial fan-made simulator with no affiliation to the game's developer or publisher. |
| `privacy.section9.title` | 9. 개인정보보호 책임자 및 문의처 | 9. Privacy Officer and Contact |
| `privacy.section9.body` | 본 사이트의 개인정보보호 책임자는 운영자 본인이며, 개인정보 관련 문의는 아래 이메일로 연락해주세요. | The privacy officer for this site is the operator themself. For privacy-related inquiries, please contact the email address below. |

## 친구

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `friends.title` | 친구 | Friends |
| `friends.loginRequired` | 로그인 후 이용할 수 있습니다. | Please log in to use this. |
| `friends.addTitle` | 친구 추가 | Add Friend |
| `friends.searchPlaceholder` | 닉네임 입력 | Enter nickname |
| `friends.searchBtn` | 요청 보내기 | Send Request |
| `friends.tab.received` | 받은 요청 | Received |
| `friends.tab.sent` | 보낸 요청 | Sent |
| `friends.tab.friends` | 친구 목록 | Friends |
| `friends.statModal.defaultTitle` | 공룡 스탯 | Dino Stats |
| `friends.statModal.titleWithName` | {nickname}의 공룡 스탯 | {nickname}'s Dino Stats |
| `friends.statModal.loading` | 불러오는 중... | Loading... |
| `friends.statModal.notShared` | 이 친구는 공룡 스탯을 공개하지 않았습니다. | This friend has not made their dino stats public. |
| `friends.search.notFound` | 해당 닉네임의 유저를 찾을 수 없습니다. | No user found with that nickname. |
| `friends.search.selfRequest` | 본인에게는 친구 요청을 보낼 수 없습니다. | You can't send a friend request to yourself. |
| `friends.search.alreadyFriends` | 이미 친구입니다. | You're already friends. |
| `friends.search.alreadySent` | 이미 요청을 보냈습니다. | You've already sent a request. |
| `friends.search.mutualAccepted` | {nickname}님과 서로 요청이 있어 바로 친구가 되었습니다. | You and {nickname} both sent requests to each other, so you're now friends. |
| `friends.search.sendError` | 요청 전송 중 오류가 발생했습니다. | An error occurred while sending the request. |
| `friends.search.sent` | {nickname}님에게 요청을 보냈습니다. | Sent a request to {nickname}. |
| `friends.request.myNicknameFallback` | 친구 | Friend |
| `friends.list.receivedEmpty` | 받은 요청이 없습니다. | No received requests. |
| `friends.list.sentEmpty` | 보낸 요청이 없습니다. | No sent requests. |
| `friends.list.friendsEmpty` | 아직 친구가 없습니다. | You don't have any friends yet. |
| `friends.action.accept` | 수락 | Accept |
| `friends.action.decline` | 거절 | Decline |
| `friends.action.cancel` | 취소 | Cancel |
| `friends.action.checkStats` | 스탯 확인 | Check Stats |
| `friends.action.unfriend` | 친구 끊기 | Unfriend |
| `friends.unknownNickname` | (알 수 없음) | (Unknown) |
| `friends.stat.hiddenLabel` | 비공개 | Private |
| `friends.stat.sectionBase` | 기본 스탯 | Base Stats |
| `friends.stat.sectionConstellation` | 별자리 | Constellation |
| `friends.stat.hp` | 체력 | HP |
| `friends.stat.atk` | 공격력 | Attack |
| `friends.stat.moveSpeed` | 이동속도 | Move Speed |
| `friends.stat.dinoCount` | 공룡 수 | Dino Count |
| `friends.stat.dinoCountValue` | {count}마리 | {count} |
| `friends.stat.vip` | VIP | VIP |
| `friends.stat.nestEggSkin` | 둥지·알스킨 | Nest/Egg Skin |
| `friends.stat.nestEggSkinValue` | 공 +{atk}% / 체 +{hp}% | ATK +{atk}% / HP +{hp}% |
| `friends.stat.critRate` | 치명타 확률 | Critical Rate |
| `friends.stat.critDmg` | 치명타 피해 | Critical Damage |
| `friends.rune.sectionTitle` | 룬 | Runes |
| `friends.rune.hint` | 프리셋을 눌러 룬 구성 미리보기 | Tap a preset to preview its rune setup |
| `friends.rune.noPresets` | 저장된 프리셋이 없습니다. | No saved presets. |
| `friends.arena.sectionTitle` | 아레나 프리셋 | Arena Preset |
| `friends.arena.hint` | 눌러서 배치 보기 | Tap to view formation |
| `friends.arena.slotLabel` | {index}번 {presetName} | #{index} {presetName} |
| `friends.arena.unassigned` | · 미배정 | · Unassigned |
| `friends.arena.noFormations` | 저장된 배치가 없습니다. | No saved formations. |

## 공용 UI (인증 모달·차트 등)

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `common.auth.title.login` | 로그인 | Log In |
| `common.auth.title.signup` | 회원가입 | Sign Up |
| `common.auth.title.forgot` | 비밀번호 찾기 | Find Password |
| `common.auth.nicknameLabel` | 닉네임 | Nickname |
| `common.auth.passwordLabel` | 비밀번호 | Password |
| `common.auth.loginBtn` | 로그인 | Log In |
| `common.auth.signupLink` | 회원가입 | Sign Up |
| `common.auth.forgotLink` | 비밀번호를 잊으셨나요? | Forgot your password? |
| `common.auth.signupEmailLabel` | 이메일 (비밀번호 재설정에 사용) | Email (used for password reset) |
| `common.auth.passwordConfirmLabel` | 비밀번호 확인 | Confirm Password |
| `common.auth.consentLabel` | [필수] 개인정보 수집 및 이용에 동의합니다. (<a href="#privacy" target="_blank" rel="noopener">전문 보기</a>) | [Required] I agree to the collection and use of my personal information. (<a href="#privacy" target="_blank" rel="noopener">View full policy</a>) |
| `common.auth.signupBtn` | 가입하기 | Sign Up |
| `common.auth.alreadyHaveAccount` | 이미 계정이 있으신가요? 로그인 | Already have an account? Log in |
| `common.auth.forgotIdentifierLabel` | 닉네임 또는 이메일 | Nickname or Email |
| `common.auth.forgotSubmitBtn` | 재설정 링크 보내기 | Send Reset Link |
| `common.auth.backToLogin` | 로그인으로 돌아가기 | Back to Login |
| `common.auth.nicknameRuleMsg` | 닉네임은 한글/영문/숫자/밑줄만 사용해 2~12자로 입력해주세요. | Nicknames must be 2-12 characters, using only Korean, letters, numbers, and underscores. |
| `common.auth.nicknameTaken` | 이미 사용 중인 닉네임입니다 | This nickname is already in use |
| `common.auth.nicknameAvailable` | 사용 가능한 닉네임입니다 | This nickname is available |
| `common.auth.loginMissingFields` | 닉네임과 비밀번호를 입력해주세요. | Please enter your nickname and password. |
| `common.auth.loginBusy` | 로그인 중... | Logging in... |
| `common.auth.loginWrong` | 닉네임 또는 비밀번호가 올바르지 않습니다. | Incorrect nickname or password. |
| `common.auth.signupMissingFields` | 모든 항목을 입력해주세요. | Please fill in all fields. |
| `common.auth.signupConsentRequired` | 개인정보 수집 및 이용에 동의해주세요. | Please agree to the collection and use of personal information. |
| `common.auth.passwordTooShort` | 비밀번호는 6자 이상이어야 합니다. | Password must be at least 6 characters. |
| `common.auth.passwordMismatch` | 비밀번호가 일치하지 않습니다. | Passwords do not match. |
| `common.auth.signupBusy` | 가입 중... | Signing up... |
| `common.auth.nicknameTakenPeriod` | 이미 사용 중인 닉네임입니다. | This nickname is already in use. |
| `common.auth.signupGenericError` | 회원가입 중 오류가 발생했습니다: {error} | An error occurred while signing up: {error} |
| `common.auth.emailAlreadyRegistered` | 이미 가입된 이메일입니다. | This email is already registered. |
| `common.auth.signupEmailSent` | 가입 확인 이메일을 보냈습니다. 이메일의 링크를 눌러 인증을 완료한 뒤 로그인해주세요. | A confirmation email has been sent. Please click the link in the email to complete verification, then log in. |
| `common.auth.forgotMissingFields` | 닉네임 또는 이메일을 입력해주세요. | Please enter your nickname or email. |
| `common.auth.forgotBusy` | 전송 중... | Sending... |
| `common.auth.forgotSent` | 입력하신 정보와 일치하는 계정이 있다면, 이메일로 재설정 링크를 보내드렸습니다. | If an account matches the information you entered, a reset link has been sent to that email. |
| `common.authRow.friendsBtn` | 친구 | Friends |
| `common.authRow.logoutBtn` | 로그아웃 | Log Out |
| `common.authRow.loginBtn` | 로그인 | Log In |
| `common.deleteAccount.confirm` | 정말 탈퇴하시겠습니까? 저장된 룬 조합 등 계정 데이터가 모두 삭제되며 되돌릴 수 없습니다. | Are you sure you want to delete your account? Your saved rune combos and all other account data will be permanently deleted. This cannot be undone. |
| `common.deleteAccount.busy` | 탈퇴 처리 중... | Processing deletion... |
| `common.deleteAccount.error` | 탈퇴 처리 중 오류가 발생했습니다: {error} | An error occurred while deleting your account: {error} |
| `common.deleteAccount.btn` | 회원 탈퇴 | Delete Account |
| `common.rune.defaultUnsuitableLabel` | 적합하지 않은 룬입니다 | Not a suitable rune |
| `common.rune.unsuitableDividerLabel` | ── {label} ── | ── {label} ── |
| `common.rune.mutualExclusionWarning` | ⚠️ '{runeName}'과 동시에 장착할 수 없습니다. | ⚠️ Cannot be equipped at the same time as '{runeName}'. |
| `common.myDinoFallbackName` | 내 공룡 | My Dino |
| `common.relatedMetricsTitle` | 관련 수치 | Related Stats |
| `common.chart.secondsFormat` | {sec}초 | {sec}s |
| `common.chart.minutesSecondsFormat` | {m}분 {s}초 | {m}m {s}s |
| `common.chart.minutesFormat` | {m}분 | {m}m |
| `common.updateBanner.text` | 새 버전이 있습니다 | A new version is available |
| `common.updateBanner.refreshBtn` | 새로고침 | Refresh |
| `common.updateBanner.dismissAriaLabel` | 닫기 | Close |
| `common.friendRequestToast` | {nickname}님이 친구 요청을 보냈습니다 | {nickname} sent you a friend request |

## 내 공룡

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `my_dino.presetDefaultName` | 프리셋 {index} | Preset {index} |
| `my_dino.readonlyDefaultTag` | 🔒 읽기 전용 | 🔒 Read-only |
| `my_dino.stat.level` | 레벨 | Level |
| `my_dino.stat.atk` | 공격력 | Attack |
| `my_dino.stat.hp` | 체력 | HP |
| `my_dino.stat.critRate` | 치명타 확률 | Critical Rate |
| `my_dino.stat.critDmg` | 치명타 피해 | Critical Damage |
| `my_dino.stat.critCombined` | 치확 / 치피 | Crit Rate / Crit Dmg |
| `my_dino.stat.dinoCount` | 공룡 수 | Dino Count |
| `my_dino.stat.dinoCountValue` | {count}마리 | {count} |
| `my_dino.tab.base` | 기본 스탯 | Base Stats |
| `my_dino.tab.constellation` | 별자리 | Constellation |
| `my_dino.tab.bonus` | 둥지·알스킨 | Nest/Egg Skin |
| `my_dino.tab.rune` | 룬 조합 | Rune Combo |
| `my_dino.field.vip` | VIP | VIP |
| `my_dino.field.hp` | 체력 | HP |
| `my_dino.field.atk` | 공격력 | Attack |
| `my_dino.field.moveSpeed` | 이동속도 | Move Speed |
| `my_dino.field.dinoCount` | 공룡 수 | Dino Count |
| `my_dino.field.constHp` | 체력 | HP |
| `my_dino.field.constAtk` | 공격력 | Attack |
| `my_dino.field.constCritRate` | 치명타 확률 | Critical Rate |
| `my_dino.field.constCritDmg` | 치명타 피해 | Critical Damage |
| `my_dino.field.constBuildingDmg` | 건축물 피해 증가 | Building Damage Increase |
| `my_dino.field.constStewEffect` | 스튜 효과 증가 | Stew Effect Increase |
| `my_dino.field.constMoveSpeed` | 이동 속도 | Move Speed |
| `my_dino.field.constBossDmgReduction` | 보스 피해 감소 | Boss Damage Reduction |
| `my_dino.field.constBossDmgIncrease` | 보스 피해 증가 | Boss Damage Increase |
| `my_dino.field.bonusAtk` | 공격력 | Attack |
| `my_dino.field.bonusHp` | 체력 | HP |
| `my_dino.rune.applyBtn` | 슬롯에 장착 | Equip to Slot |
| `my_dino.rune.removeBtn` | 장착 해제 | Unequip |
| `my_dino.preset.editTooltip` | 이름 수정 | Edit Name |
| `my_dino.vip.noneLabel` | VIP 없음 | No VIP |
| `my_dino.vip.levelLabel` | VIP {level} | VIP {level} |
| `my_dino.vip.desc.tribeUnit1` | 부족 유닛: +1 | Tribe Units: +1 |
| `my_dino.vip.desc.tribeUnit2` | 부족 유닛: +2 | Tribe Units: +2 |
| `my_dino.vip.desc.tribeUnit3pct3` | 부족 유닛: +3, 공·체 +3% | Tribe Units: +3, ATK/HP +3% |
| `my_dino.vip.desc.tribeUnit3pct6` | 부족 유닛: +3, 공·체 +6% | Tribe Units: +3, ATK/HP +6% |
| `my_dino.vip.desc.tribeUnit3pct9` | 부족 유닛: +3, 공·체 +9% | Tribe Units: +3, ATK/HP +9% |

## 타이탄

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `titan.heading` | 타이탄 | Titan |
| `titan.warning` | ※ 본 시뮬레이터는 참고용이며, 실제 연산 방식과 차이가 있을 수 있습니다. | ※ This simulator is for reference only and may differ from the actual game's calculations. |
| `titan.unsuitableRuneLabel` | 타이탄에 적합하지 않은 룬입니다 | Rune not suitable for Titan |
| `titan.metrics.basicDmg` | 평타 대미지 | Basic Attack Damage |
| `titan.metrics.skillDmg` | 스킬 대미지 | Skill Damage |
| `titan.metrics.atkAmp` | 공격력 증폭량 | Attack Amplification |
| `titan.metrics.finalAvgDmg` | 최종 평균 대미지 | Final Average Damage |
| `titan.metrics.reduction` | 대미지 감소량 | Damage Reduction |
| `titan.metrics.recovery` | 회복량 | Recovery Amount |
| `titan.tab.settings` | 전투 설정 | Battle Settings |
| `titan.tab.quick` | 빠른 계산 | Quick Calc |
| `titan.tab.live` | 시뮬레이션 | Simulation |
| `titan.tab.optimize` | 조합 찾기 | Find Combo |
| `titan.settings.natureLabel` | 자연 구조물과 인접 | Adjacent to Nature Structure |
| `titan.settings.tribeLabel` | 부족 점령 상태 | Tribe Control Status |
| `titan.settings.atkTowerLabel` | 공격력 버프 타워 | Attack Buff Tower |
| `titan.settings.hpTowerLabel` | 체력 버프 타워 | HP Buff Tower |
| `titan.settings.serverLevelCapLabel` | 서버 레벨캡 | Server Level Cap |
| `titan.settings.constellationCapLabel` | 서버 별자리캡 | Server Constellation Cap |
| `titan.settings.titanLevelLabel` | 타이탄 레벨 | Titan Level |
| `titan.settings.timeLimitLabel` | 전투 제한시간 | Battle Time Limit |
| `titan.settings.distanceLabel` | 타이탄 거리 | Distance to Titan |
| `titan.settings.distanceUnit` | 타일 | tiles |
| `titan.settings.continuousBattleLabel` | 연속 전투 | Continuous Battle |
| `titan.settings.noneOption` | 없음 | None |
| `titan.settings.defaultTimeLimit` | 90분 | 90 min |
| `titan.quick.calcBtn` | 빠른 계산하기 | Quick Calculate |
| `titan.quick.calcBtnBusy` | 계산 중 ({current}/{total})... | Calculating ({current}/{total})... |
| `titan.quick.report.totalDmg` | 총 입힌 피해량 | Total Damage Dealt |
| `titan.quick.report.remainingTitanHp` | 남은 타이탄 체력 | Titan's Remaining HP |
| `titan.quick.report.avgSurvivalTime` | 평균 생존 시간 | Average Survival Time |
| `titan.quick.report.avgDeadCount` | 평균 공룡 사망 수 | Average Dino Deaths |
| `titan.quick.report.chartLabel` | 시간대별 공룡 체력 변화 추이 | Dino HP Over Time |
| `titan.quick.report.avgSurvivalHpLabel` | 평균 생존 체력: {percent}% | Average Surviving HP: {percent}% |
| `titan.quick.report.logDownloadBtn` | 상세 로그(.txt) 다운로드 | Download Detailed Log (.txt) |
| `titan.quick.report.logFileHeader` | === 상세 전투 로그 (1회차) === | === Detailed Battle Log (Run 1) === |
| `titan.optimize.title` | 내 룬 레벨로 최적 조합 찾기 | Find the Best Combo with My Rune Levels |
| `titan.optimize.desc` | 적합 룬 중 보유한 룬의 레벨을 입력하세요(0 = 미보유). 지금 전투 설정 기준으로(연속 전투는 항상 켠 상태로 계산) "가장 안 죽는 조합", "시간당 대미지가 가장 높은 조합", "둘의 균형이 가장 좋은 조합"을 찾아줍니다. 조합 수가 많으면 시간이 걸릴 수 있습니다. | Enter the levels of the suitable runes you own (0 = not owned). Based on your current battle settings (Continuous Battle is always calculated as on), finds the "combo that survives longest", the "combo with the highest damage per time", and the "combo with the best balance of both". This may take a while if there are many possible combos. |
| `titan.optimize.ownedRuneHeaderLabel` | 보유 룬 레벨 입력 | Enter Owned Rune Levels |
| `titan.optimize.collapseTooltip` | 목록 접기/펼치기 | Collapse/Expand List |
| `titan.optimize.startBtn` | 조합 찾기 시작 | Start Finding Combo |
| `titan.optimize.needLevelsMsg` | 보유한 룬 레벨을 먼저 입력해주세요. | Please enter your owned rune levels first. |
| `titan.optimize.stage1Progress` | 1단계 계산 중 ({current}/{total})... | Stage 1 Calculating ({current}/{total})... |
| `titan.optimize.stage1Done` | 1단계 계산 완료, 2단계 정밀 계산 시작... | Stage 1 complete, starting Stage 2 precise calculation... |
| `titan.optimize.refineProgress` | 후보 정밀 재계산 중 ({current}/{total})... | Recalculating Candidates Precisely ({current}/{total})... |
| `titan.optimize.stage2Progress` | 2단계 정밀 계산 중 ({current}/{total})... | Stage 2 Precise Calculation ({current}/{total})... |
| `titan.optimize.stage3PrescanRecheckProgress` | 3단계 예비 검증 중 ({current}/{total}, 무사망 재확인 중)... | Stage 3 Preliminary Verification ({current}/{total}, rechecking zero deaths)... |
| `titan.optimize.stage3PrescanProgress` | 3단계 예비 검증 중 ({current}/{total})... | Stage 3 Preliminary Verification ({current}/{total})... |
| `titan.optimize.stage3FinalProgress` | 3단계 최종 검증 중 ({current}/{total})... | Stage 3 Final Verification ({current}/{total})... |
| `titan.optimize.limitedSlotMsg` | 보유한 적합 룬이 {count}개뿐이라 {slotCount}개짜리 조합까지만 계산했습니다. | Only {count} suitable runes are owned, so only {slotCount}-rune combos were calculated. |
| `titan.optimize.bestSurvivalTitle` | 최대 생존 조합 | Max Survival Combo |
| `titan.optimize.bestDpsTitle` | 최대 대미지 조합 | Max Damage Combo |
| `titan.optimize.bestBalanceTitle` | 추천 조합 | Recommended Combo |
| `titan.optimize.comboClickTooltip` | 클릭하면 프리셋에 장착할 수 있어요 | Click to equip this combo to a preset |
| `titan.optimize.avgDeathTimeLabel` | 평균 사망 시간 | Average Time to Death |
| `titan.optimize.avgDeathCountLabel` | 평균 사망 수 | Average Death Count |
| `titan.optimize.avgDeathCountValue` | 평균 {count}회 | Average {count} times |
| `titan.optimize.estimatedDpsLabel` | 예상 초당 대미지 | Estimated DPS |
| `titan.optimize.totalDmgLabel` | 평균 대미지 합계 | Average Total Damage |
| `titan.optimize.timeFormat` | {m}분 {s}초 | {m}m {s}s |
| `titan.applyPreset.modalTitle` | 어느 프리셋에 장착할까요? | Which preset should this be equipped to? |
| `titan.applyPreset.confirmBtn` | 확인 | Confirm |
| `titan.applyPreset.toastAppliedTo` | "{presetName}"에 조합을 장착했습니다 | Equipped the combo to "{presetName}" |
| `titan.live.startBtnIdle` | 시뮬레이션 시작 | Start Simulation |
| `titan.live.startBtnCalculating` | 계산 중... | Calculating... |
| `titan.live.startBtnPause` | 일시정지 | Pause |
| `titan.live.startBtnResume` | 재생 | Resume |
| `titan.live.startBtnRestartSim` | 다시 시뮬레이션 | Restart Simulation |
| `titan.live.restartTooltip` | 처음부터 다시 시작 | Restart from the Beginning |
| `titan.live.speedNormal` | 보통 | Normal |
| `titan.live.stats.cumulativeDmg` | 누적 대미지 | Cumulative Damage |
| `titan.live.stats.currentDps` | 현재 초당 대미지 | Current DPS |
| `titan.live.stats.deadDinoCount` | 사망한 공룡 수 | Dinos Dead |
| `titan.live.stats.elapsedSurvivalTime` | 경과(생존) 시간 | Elapsed (Survival) Time |
| `titan.live.deadCountValue` | {count}마리 | {count} |
| `titan.live.elapsedSecValue` | {sec}초 | {sec}s |
| `titan.live.hpValueFormat` | {current} / {max} | {current} / {max} |
| `titan.detail.basicDmgTitle` | 평타 대미지 계산 내역 | Basic Attack Damage Breakdown |
| `titan.detail.originalAtkLabel` | 증폭 전 공격력 | Attack Before Amplification |
| `titan.detail.ampAtkLabel` | 증폭 후 공격력 | Attack After Amplification |
| `titan.detail.ampCritDmgLabel` | 증폭 후 크리티컬 대미지 | Critical Damage After Amplification |
| `titan.detail.atkAmpTitle` | 공격력 증폭 내역 | Attack Amplification Breakdown |
| `titan.detail.bossSlayerLabel` | 보스 슬레이어 (증폭 +{percent}%) | Boss Slayer (Amplify +{percent}%) |
| `titan.detail.skillDmgTitle` | 스킬 대미지 내역 | Skill Damage Breakdown |
| `titan.detail.skillProbLabel` | {name} ({prob}% 확률) | {name} ({prob}% chance) |
| `titan.detail.skillFixedLabel` | {name} (3타마다 확정 발동) | {name} (guaranteed every 3 hits) |
| `titan.detail.avgDmgSub` | 평균 대미지 {value} | Average Damage {value} |
| `titan.detail.critDmgSub` | 크리티컬 대미지 {value} | Critical Damage {value} |
| `titan.detail.finalAvgDmgTitle` | 최종 평균 대미지 계산 내역 | Final Average Damage Breakdown |
| `titan.detail.basicDmgLabel` | 평타 대미지 | Basic Attack Damage |
| `titan.detail.skillDmgTotalLabel` | 스킬 대미지 합계 | Total Skill Damage |
| `titan.detail.reductionTitle` | 대미지 감소 내역 | Damage Reduction Breakdown |
| `titan.detail.shieldReductionLabel` | {name} ({turn}회 {percent}% 감소) | {name} ({turn} turns, {percent}% reduction) |
| `titan.detail.probReductionLabel` | {name} ({prob}% 확률) | {name} ({prob}% chance) |
| `titan.detail.avgReductionSub` | 평균 감소량 {value} | Average Reduction {value} |
| `titan.detail.recoveryTitle` | 회복량 내역 | Recovery Breakdown |
| `titan.detail.recoveryProbLabel` | {name} ({prob}% 확률) | {name} ({prob}% chance) |
| `titan.detail.avgRecoverySub` | 평균 회복량 {value} | Average Recovery {value} |
| `titan.detail.emptyMsg` | 장착된 관련 룬이 없습니다 | No related runes equipped |
| `titan.levelOptionLabel` | Lv. {level} (ATK {atk} / HP {hp}) | Lv. {level} (ATK {atk} / HP {hp}) |
| `titan.timeOptionLabel` | {minutes}분 | {minutes} min |
| `titan.log.respawnReturn` | {index}번 공룡 재소환 복귀 (체력 {hp}) | Dino #{index} respawned and returned (HP {hp}) |
| `titan.log.basicCrit` | {index}번 공룡 평타 치명타 (타이탄 {dmg} 피해) | Dino #{index} basic attack crit (dealt {dmg} damage to Titan) |
| `titan.log.skillProc` | {index}번 공룡 {skillName} 발동{critTag} (타이탄 {dmg} 피해) | Dino #{index} triggered {skillName}{critTag} (dealt {dmg} damage to Titan) |
| `titan.log.critTag` | (치명타) |  (Critical) |
| `titan.log.tripleImpactProc` | {index}번 공룡 트리플 임팩트 발동{critTag} (타이탄 {dmg} 피해) | Dino #{index} triggered Triple Impact{critTag} (dealt {dmg} damage to Titan) |
| `titan.log.vampProc` | {index}번 공룡 흡혈 발동 (체력 +{amount}) | Dino #{index} triggered Life Steal (HP +{amount}) |
| `titan.log.healProc` | {index}번 공룡 힐 발동 (체력 +{amount}) | Dino #{index} triggered Heal (HP +{amount}) |
| `titan.log.resistProc` | {index}번 공룡 {runeName} 발동 (피해 {amount} 감소) | Dino #{index} triggered {runeName} (reduced {amount} damage) |
| `titan.log.death` | {index}번 공룡 사망 | Dino #{index} died |
| `titan.log.sacrificeProc` | {index}번 공룡 사망 -> 희생 발동, {targetIndex}번 공룡 체력 +{amount} | Dino #{index} died -> triggered Sacrifice, Dino #{targetIndex} HP +{amount} |
| `titan.log.readyToDieProc` | {index}번 공룡 사망 -> 죽을 준비 발동, 타이탄에게 {amount} 피해 | Dino #{index} died -> triggered Ready to Die, dealt {amount} damage to Titan |
| `titan.log.lastGiftProc` | {index}번 공룡 사망 -> 마지막 선물 발동, {targetIndex}번 공룡 공격력 +{amount} ({turns}회 지속) | Dino #{index} died -> triggered Last Gift, Dino #{targetIndex} Attack +{amount} (lasts {turns} turns) |
| `titan.log.fileLine1` | [{time}] 타이탄HP: {titanHp} \| 생존: {aliveCount} | [{time}] Titan HP: {titanHp} \| Alive: {aliveCount} |
| `titan.log.fileLine2` |   - {index}번 공룡 HP: {hp} |   - Dino #{index} HP: {hp} |
| `titan.log.fileLine3` |   * {event} |   * {event} |

## 공룡 대전

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `dino_battle.heading` | 공룡 대전 | Dino Battle |
| `dino_battle.tileCard.title` | 타일 설정 | Tile Settings |
| `dino_battle.tileGroup.environment` | 환경 | Environment |
| `dino_battle.tile.natureLabel` | 자연 구조물과 인접 (자연의 포옹) | Adjacent to Nature Structure (Nature's Embrace) |
| `dino_battle.tile.tribeLabel` | 부족 점령 상태 (부족의 축복) | Tribe Control Status (Tribe's Blessing) |
| `dino_battle.tile.serverLevelCapLabel` | 서버 레벨캡 | Server Level Cap |
| `dino_battle.tile.constellationCapLabel` | 서버 별자리캡 | Server Constellation Cap |
| `dino_battle.tileGroup.perSide` | 진영별 설정 | Per-Side Settings |
| `dino_battle.side.myDino` | 내 공룡 | My Dino |
| `dino_battle.side.oppDino` | 상대 공룡 | Opponent Dino |
| `dino_battle.side.arrangementLabel` | 배치 | Arrangement |
| `dino_battle.side.atkTowerLabel` | 공격력 버프 타워 | Attack Buff Tower |
| `dino_battle.side.hpTowerLabel` | 체력 버프 타워 | HP Buff Tower |
| `dino_battle.tribe.none` | 없음 | None |
| `dino_battle.tribe.mine` | 내 부족 | My Tribe |
| `dino_battle.tribe.opponent` | 상대 부족 | Opponent's Tribe |
| `dino_battle.arrangement.same` | 한 타일 | Same Tile |
| `dino_battle.arrangement.separate` | 다른 타일 | Separate Tiles |
| `dino_battle.tab.quick` | 빠른 계산 | Quick Calc |
| `dino_battle.tab.live` | 시뮬레이션 | Simulation |
| `dino_battle.quick.desc` | 대기 공룡 없이 공룡 1마리씩 맞붙어서, 죽으면 그 자리에서 즉시 부활시키며 {trials}번 죽을 때까지 반복합니다. 사망 횟수 비율과 평균 대미지(평타·크리티컬·스킬·죽을 준비 반격까지 전부 포함)를 계산합니다. | Pits your dinos against the opponent's one at a time with no reserves, instantly reviving whichever dies until {trials} deaths occur. Calculates the death ratio and average damage (including basic attacks, criticals, skills, and Ready to Die counterattacks). |
| `dino_battle.quick.calcBtn` | {trials}회 계산하기 | Calculate {trials} Times |
| `dino_battle.quick.calcBtnBusy` | 계산 중... | Calculating... |
| `dino_battle.quick.resultLabel` | 전투 결과 ({trials}번 중) | Battle Result (of {trials}) |
| `dino_battle.quick.myDmgLabel` | 내 공룡 평균 대미지 | My Dino's Average Damage |
| `dino_battle.quick.oppDmgLabel` | 상대 공룡의 평균 대미지 | Opponent's Average Damage |
| `dino_battle.quick.neededCountLabel` | 상대 전멸에 필요한 공룡 수 | Dinos Needed to Wipe Out Opponent |
| `dino_battle.quick.ratioText` | 사망횟수 {myDeaths} : {oppDeaths} | Deaths {myDeaths} : {oppDeaths} |
| `dino_battle.quick.exchangeRatioText` | 교환비 {ratio} | Exchange Ratio {ratio} |
| `dino_battle.quick.neededImpossible` | 상관없음(전멸 불가) | N/A (cannot wipe out) |
| `dino_battle.quick.neededOne` | 1마리 | 1 |
| `dino_battle.quick.neededCountValue` | {count}마리 | {count} |
| `dino_battle.quick.neededCountBase` | 상대 {count}마리 기준 | Based on {count} opponent dinos |
| `dino_battle.myAvatarLabel` | 내 공룡 | My Dino |
| `dino_battle.oppAvatarLabel` | 상대 공룡 | Opponent Dino |
| `dino_battle.speedNormal` | 보통 | Normal |
| `dino_battle.startBtn` | 전투 시작 | Start Battle |
| `dino_battle.restartTooltip` | 처음부터 다시 시작 | Restart from the Beginning |
| `dino_battle.myPeekTooltip` | 내 공룡 설정 | My Dino Settings |
| `dino_battle.oppPeekTooltip` | 상대 공룡 설정 | Opponent Dino Settings |
| `dino_battle.friendPicker.defaultTitle` | 친구 선택 | Select a Friend |
| `dino_battle.friendPicker.inviteTitle` | 누구를 초대할까요? | Who would you like to invite? |
| `dino_battle.friendPicker.snapshotTitle` | 누구의 설정을 불러올까요? | Whose settings would you like to load? |
| `dino_battle.friendPicker.loading` | 불러오는 중... | Loading... |
| `dino_battle.friendPicker.empty` | 친구가 없습니다. 먼저 친구를 추가해주세요. | You have no friends. Please add a friend first. |
| `dino_battle.unsuitableRuneLabel` | 공룡 대전에 적합하지 않은 룬입니다 | Rune not suitable for Dino Battle |
| `dino_battle.panelHeader.myDino` | 내 공룡 | My Dino |
| `dino_battle.panelHeader.oppDino` | 상대 공룡 | Opponent Dino |
| `dino_battle.inviteSentLine` | {nickname}님에게 초대를 보냈습니다.<br>응답을 기다리는 중... | Invite sent to {nickname}.<br>Waiting for response... |
| `dino_battle.cancelInviteBtn` | 초대 취소 | Cancel Invite |
| `dino_battle.loadingFriendProfile` | {nickname}님의 공룡 설정을 불러오는 중... | Loading {nickname}'s dino settings... |
| `dino_battle.readonlyLiveTag` | 🔒 {nickname} - 실시간으로 갱신됩니다 | 🔒 {nickname} - updating in real time |
| `dino_battle.readonlySnapshotTag` | 🔒 {nickname} - 스냅샷 (편집 불가) | 🔒 {nickname} - snapshot (not editable) |
| `dino_battle.leaveSessionBtn` | 세션 나가기 | Leave Session |
| `dino_battle.switchToLocalBtn` | 직접 설정으로 전환 | Switch to My Own Settings |
| `dino_battle.inviteFriendBtn` | 친구 초대 | Invite Friend |
| `dino_battle.loadSettingsBtn` | 설정 불러오기 | Load Settings |
| `dino_battle.loadFailedAlert` | 설정을 불러오지 못했습니다. 친구가 스탯 공개를 꺼두었거나 친구 관계가 아닐 수 있습니다. | Failed to load settings. Your friend may have turned off stat visibility, or you may no longer be friends. |
| `dino_battle.defaultOppLabel` | 상대 공룡 | Opponent Dino |
| `dino_battle.result.draw` | 무승부! | Draw! |
| `dino_battle.result.win` | 승리! | Victory! |
| `dino_battle.result.lose` | 패배 | Defeat |
| `dino_battle.startBtnPause` | 일시정지 | Pause |
| `dino_battle.startBtnResume` | 재개 | Resume |
| `dino_battle.startBtnRestart` | 다시 시작 | Restart |
| `dino_battle.aoeHitLabel` | {label} {count}마리 적중 | {label} hit {count} |
| `dino_battle.mutualKillPopup` | 100회 교환 - 동시 사망 | 100 Exchanges - Mutual Death |
| `dino_battle.log.meteorInstant` | 낙뢰(즉사) | Lightning Strike (Instant Kill) |
| `dino_battle.log.meteorAoe` | 메테오(광역) | Meteor (AoE) |
| `dino_battle.log.meteorSurrounding` | 메테오(주변 타일) | Meteor (Surrounding Tiles) |
| `dino_battle.basicHitLabel` | 평타 | Basic Attack |

## 아레나

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `arena.heading` | 아레나 | Arena |
| `arena.myPeekTooltip` | 내 진영 설정 | My Formation Settings |
| `arena.oppPeekTooltip` | 상대 진영 설정 | Opponent Formation Settings |
| `arena.tab.quick` | 빠른 계산 | Quick Calc |
| `arena.tab.live` | 시뮬레이션 | Simulation |
| `arena.quick.desc` | 현재 배치로 독립된 5:5 전투를 {trials}번 반복해서 평균 승률과, 어느 진영의 앞열이 보통 먼저 전멸하는지 계산합니다. | Repeats an independent 5v5 battle with the current formation {trials} times, calculating the average win rate and which side's front row usually gets wiped out first. |
| `arena.quick.calcBtn` | {trials}회 계산하기 | Calculate {trials} Times |
| `arena.quick.calcBtnBusy` | 계산 중... | Calculating... |
| `arena.quick.winCountLabel` | 승리 횟수 ({trials}번 중) | Wins (of {trials}) |
| `arena.quick.frontFirstLabel` | 앞열이 먼저 전멸하는 진영 | Side Whose Front Row Dies First |
| `arena.quick.winCountValue` | 내 {myWins} : 상대 {oppWins} | Mine {myWins} : Opponent {oppWins} |
| `arena.quick.dominantWin` | {label} 압도적 우세 (전승) | {label} dominant advantage (all wins) |
| `arena.quick.winRatio` | {weakerLabel} 1 : {strongerLabel} {ratio} | {weakerLabel} 1 : {strongerLabel} {ratio} |
| `arena.quick.frontUndetermined` | 판정 불가 | Cannot be determined |
| `arena.quick.frontResultValue` | {count}/{total}회 ({percent}%) | {count}/{total} times ({percent}%) |
| `arena.myLabel` | 내 진영 | My Formation |
| `arena.oppLabel` | 상대 진영 | Opponent Formation |
| `arena.speedNormal` | 보통 | Normal |
| `arena.startBtn` | 전투 시작 | Start Battle |
| `arena.restartTooltip` | 처음부터 다시 시작 | Restart from the Beginning |
| `arena.friendPicker.defaultTitle` | 친구 선택 | Select a Friend |
| `arena.friendPicker.inviteTitle` | 누구를 초대할까요? | Who would you like to invite? |
| `arena.friendPicker.snapshotTitle` | 누구의 설정을 불러올까요? | Whose settings would you like to load? |
| `arena.friendPicker.loading` | 불러오는 중... | Loading... |
| `arena.friendPicker.empty` | 친구가 없습니다. 먼저 친구를 추가해주세요. | You have no friends. Please add a friend first. |
| `arena.slotEdit.defaultTitle` | 슬롯 | Slot |
| `arena.slotEdit.numberedTitle` | {index}번 슬롯 | Slot #{index} |
| `arena.slotEdit.confirmHint` | 더블클릭하여 확정 | Double-click to confirm |
| `arena.slotEdit.readonlyHint` | 읽기 전용(친구의 조합) | Read-only (friend's combo) |
| `arena.rune.applyBtn` | 슬롯에 장착 | Equip to Slot |
| `arena.rune.removeBtn` | 장착 해제 | Unequip |
| `arena.unsuitableRuneLabel` | 아레나에 적합하지 않은 룬입니다 | Rune not suitable for Arena |
| `arena.panelHeader.myFormation` | 내 진영 | My Formation |
| `arena.panelHeader.oppFormation` | 상대 진영 | Opponent Formation |
| `arena.formationDefaultName` | 배치 {index} | Formation {index} |
| `arena.formationTabLabel` | 아레나 배치 | Arena Formation |
| `arena.presetEditTooltip` | 이름 수정 | Edit Name |
| `arena.inviteSentLine` | {nickname}님에게 초대를 보냈습니다.<br>응답을 기다리는 중... | Invite sent to {nickname}.<br>Waiting for response... |
| `arena.cancelInviteBtn` | 초대 취소 | Cancel Invite |
| `arena.loadingFriendProfile` | {nickname}님의 공룡 설정을 불러오는 중... | Loading {nickname}'s dino settings... |
| `arena.readonlyLiveTag` | 🔒 {nickname} - 실시간으로 갱신됩니다 | 🔒 {nickname} - updating in real time |
| `arena.readonlySnapshotTag` | 🔒 {nickname} - 스냅샷 (편집 불가) | 🔒 {nickname} - snapshot (not editable) |
| `arena.leaveSessionBtn` | 세션 나가기 | Leave Session |
| `arena.switchToLocalBtn` | 직접 설정으로 전환 | Switch to My Own Settings |
| `arena.inviteFriendBtn` | 친구 초대 | Invite Friend |
| `arena.loadSettingsBtn` | 설정 불러오기 | Load Settings |
| `arena.loadFailedAlert` | 설정을 불러오지 못했습니다. 친구가 스탯 공개를 꺼두었거나 친구 관계가 아닐 수 있습니다. | Failed to load settings. Your friend may have turned off stat visibility, or you may no longer be friends. |
| `arena.result.draw` | 무승부! | Draw! |
| `arena.result.win` | 승리! | Victory! |
| `arena.result.lose` | 패배 | Defeat |
| `arena.startBtnPause` | 일시정지 | Pause |
| `arena.startBtnResume` | 재개 | Resume |
| `arena.startBtnRestart` | 다시 시작 | Restart |

## 건물

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `building.heading` | 건물 | Buildings |
| `building.warning` | ※ 본 시뮬레이터는 참고용이며, 실제 연산 방식과 차이가 있을 수 있습니다. | ※ This simulator is for reference only and may differ from the actual game's calculations. |
| `building.metrics.basicDmg` | 평타 대미지 | Basic Attack Damage |
| `building.metrics.quakeDmg` | 지진 대미지 | Earthquake Damage |
| `building.metrics.atkAmp` | 공격력 증폭량 | Attack Amplification |
| `building.metrics.finalAvgDmg` | 최종 평균 대미지 | Final Average Damage |
| `building.tab.settings` | 전투 설정 | Battle Settings |
| `building.tab.quick` | 빠른 계산 | Quick Calc |
| `building.tab.live` | 시뮬레이션 | Simulation |
| `building.tab.optimize` | 조합 찾기 | Find Combo |
| `building.settings.natureLabel` | 자연 구조물과 인접 | Adjacent to Nature Structure |
| `building.settings.tribeLabel` | 부족 점령 상태 | Tribe Control Status |
| `building.settings.tribeTooltip` | 건물 공략에서는 의미가 없어 항상 꺼져 있습니다 | Not meaningful for building sieges, so this setting is always disabled |
| `building.settings.atkTowerLabel` | 공격력 버프 타워 | Attack Buff Tower |
| `building.settings.hpTowerLabel` | 체력 버프 타워 | HP Buff Tower |
| `building.settings.serverLevelCapLabel` | 서버 레벨캡 | Server Level Cap |
| `building.settings.constellationCapLabel` | 서버 별자리캡 | Server Constellation Cap |
| `building.settings.targetBuildingLabel` | 직접 공격할 건물 | Building to Attack Directly |
| `building.settings.behindBuildingLabel` | 뒤에 있는 건물 | Building Behind It |
| `building.settings.distanceLabel` | 건물까지의 거리 | Distance to Building |
| `building.settings.distanceUnit` | 타일 | tiles |
| `building.settings.continuousBattleLabel` | 연속 전투 | Continuous Battle |
| `building.settings.catapultLevelLabel` | 적 투석기 공격 레벨 | Enemy Catapult Attack Level |
| `building.settings.catapultSpeedLabel` | 적 투석기 발사속도 레벨 | Enemy Catapult Firing Speed Level |
| `building.settings.noneOption` | 없음 | None |
| `building.settings.catapultSpeedDefault` | Lv.0 (6.0초) | Lv.0 (6.0s) |
| `building.settings.catapultLevelOption` | {level}레벨 ({dmg}) | Level {level} ({dmg}) |
| `building.settings.catapultSpeedOption` | Lv.{level} ({sec}초) | Lv.{level} ({sec}s) |
| `building.quick.desc` | 전투 설정에 지정한 건물·캐터펄트 조건 그대로, 공룡이 전멸하거나 앞쪽(직접 공격할) 건물이 부서질 때까지 실전과 같은 방식으로 시뮬레이션합니다. | Simulates the battle exactly as configured in Battle Settings (building and catapult conditions), the same way as the live simulation, until your dinos are wiped out or the front (directly attacked) building is destroyed. |
| `building.quick.calcBtn` | 계산하기 | Calculate |
| `building.quick.calcBtnBusy` | 계산 중 ({current}/{total})... | Calculating ({current}/{total})... |
| `building.quick.needTargetGuide` | 먼저 전투 설정에서 직접 공격할 건물을 지정해주세요. | Please specify a building to attack directly in Battle Settings first. |
| `building.quick.totalDmgLabel` | 총 대미지 | Total Damage |
| `building.quick.quakeDmgLabel` | 지진 대미지 | Earthquake Damage |
| `building.quick.frontBreakTimeLabel` | 전방 건물 파괴 시간 | Front Building Break Time |
| `building.quick.behindRemainingHpLabel` | 뒤쪽 남은 체력 | Rear Remaining HP |
| `building.quick.behindBreakTimeLabel` | 후방 건물 파괴 시간 | Rear Building Break Time |
| `building.quick.behindRemainingHpLabel2` | 후방 건물 남은 체력 | Rear Building Remaining HP |
| `building.quick.deadCountLabel` | 죽은 공룡 수 | Dead Dinos |
| `building.quick.deadCountValue` | {count}마리 | {count} |
| `building.quick.avgDeathTimeLabel` | 평균 사망 시간 | Average Time to Death |
| `building.quick.chartLabel` | 시간대별 공룡 체력 변화 추이 | Dino HP Over Time |
| `building.quick.avgSurvivalHpLabel` | 평균 생존 체력: {percent}% | Average Surviving HP: {percent}% |
| `building.optimize.title` | 내 룬 레벨로 최적 조합 찾기 | Find the Best Combo with My Rune Levels |
| `building.optimize.desc` | 적합 룬 중 보유한 룬의 레벨을 입력하세요(0 = 미보유). 지금 스탯·별자리·전투 설정 기준으로 적 건물을 가장 빨리 부수는 조합을 "빠른 계산"과 같은 방식으로 실전 시뮬레이션해 찾아줍니다. | Enter the levels of the suitable runes you own (0 = not owned). Based on your current stats, constellation, and battle settings, runs a live simulation the same way as "Quick Calc" to find the combo that destroys the enemy building the fastest. |
| `building.optimize.startBtn` | 최적 조합 찾기 | Find Best Combo |
| `building.optimize.needLevelsMsg` | 보유한 룬 레벨을 먼저 입력해주세요. | Please enter your owned rune levels first. |
| `building.optimize.needTargetMsg` | 먼저 전투 설정에서 직접 공격할 건물을 지정해주세요. | Please specify a building to attack directly in Battle Settings first. |
| `building.optimize.stage1Progress` | 1단계 계산 중 ({current}/{total})... | Stage 1 Calculating ({current}/{total})... |
| `building.optimize.stage2Progress` | 2단계 정밀 계산 중 ({current}/{total})... | Stage 2 Precise Calculation ({current}/{total})... |
| `building.optimize.limitedSlotMsg` | 보유한 적합 룬이 {count}개뿐이라 {slotCount}개짜리 조합까지만 계산했습니다. | Only {count} suitable runes are owned, so only {slotCount}-rune combos were calculated. |
| `building.optimize.bestComboLabel` | 최적 조합 | Best Combo |
| `building.optimize.resultLabel` | 결과 | Result |
| `building.optimize.brokeInTime` | {time} 만에 파괴 | Destroyed in {time} |
| `building.optimize.notBroken` | {dmg} 대미지 (파괴 못 함) | {dmg} damage (not destroyed) |
| `building.startBtnIdle` | 공격 시작 | Start Attack |
| `building.startBtnRunning` | 일시정지 | Pause |
| `building.startBtnPaused` | 재개 | Resume |
| `building.restartTooltip` | 처음부터 다시 시작 | Restart from the Beginning |
| `building.stats.totalDmgLabel` | 총 대미지 | Total Damage |
| `building.stats.elapsedLabel` | 경과 시간 | Elapsed Time |
| `building.stats.elapsedValue` | {sec}초 | {sec}s |
| `building.stats.dpsLabel` | 평균 초당 대미지 | Average DPS |
| `building.speedNormal` | 보통 | Normal |
| `building.unsuitableRuneLabel` | 건물 공략에 적합하지 않은 룬입니다 | Rune not suitable for building sieges |
| `building.selectModal.title` | 건축물 선택 | Select Building |
| `building.selectModal.emptyLabel` | 없음 | None |
| `building.selectModal.emptyLabelClear` | 없음(비우기) | None (Clear) |
| `building.selectModal.lockedTag` | 미출시 | Not Released |
| `building.moveBtn.empty` | {label}: 비어있음 | {label}: Empty |
| `building.moveBtn.destroyed` | {label}: 파괴됨 | {label}: Destroyed |
| `building.moveBtn.attacking` | {label}: 공격 중 | {label}: Attacking |
| `building.moveBtn.moveTo` | {label}으로 이동 | Move to {label} |
| `building.moveBtnDisabledTooltip` | 먼저 건물을 세우고, 아래 이동 버튼으로 공격할 타일로 이동해주세요 | Select a building first, then use the move buttons below to move to the tile you want to attack |
| `building.slotLabels.center` | 중앙 | Center |
| `building.slotLabels.front` | 정면 | Front |
| `building.slotLabels.left` | 좌측 | Left |
| `building.slotLabels.right` | 우측 | Right |
| `building.detail.basicDmgTitle` | 평타 대미지 계산 내역 | Basic Attack Damage Breakdown |
| `building.detail.originalAtkLabel` | 증폭 전 공격력 | Attack Before Amplification |
| `building.detail.ampAtkLabel` | 증폭 후 공격력 | Attack After Amplification |
| `building.detail.ampCritDmgLabel` | 증폭 후 크리티컬 대미지 | Critical Damage After Amplification |
| `building.detail.quakeDmgTitle` | 지진 대미지 계산 내역 | Earthquake Damage Breakdown |
| `building.detail.quakeLabel` | 지진 ({count}타마다 {percent}% 스플래시) | Earthquake ({percent}% splash every {count} hits) |
| `building.detail.critDmgSub` | 크리티컬 대미지 {value} | Critical Damage {value} |
| `building.detail.atkAmpTitle` | 공격력 증폭 내역 | Attack Amplification Breakdown |
| `building.detail.destroyerLabel` | {name} (증폭 +{percent}%) | {name} (Amplify +{percent}%) |
| `building.detail.finalAvgDmgTitle` | 최종 평균 대미지 계산 내역 | Final Average Damage Breakdown |
| `building.detail.basicDmgLabel` | 평타 대미지 | Basic Attack Damage |
| `building.detail.quakeDmgLabel` | 지진 대미지 | Earthquake Damage |
| `building.detail.emptyMsg` | 장착된 관련 룬이 없습니다 | No related runes equipped |
| `building.summary.targetBuildingLabel` | 직접 공격할 건물 | Building to Attack Directly |
| `building.summary.behindBuildingLabel` | 뒤에 있는 건물 | Building Behind It |
| `building.summary.distanceLabel` | 건물까지의 거리 | Distance to Building |
| `building.summary.continuousBattleLabel` | 연속 전투 | Continuous Battle |
| `building.summary.catapultLevelLabel` | 적 투석기 공격 레벨 | Enemy Catapult Attack Level |
| `building.summary.catapultSpeedLabel` | 적 투석기 발사속도 레벨 | Enemy Catapult Firing Speed Level |
| `building.dinoAvatarNameFallback` | 내 공룡 | My Dino |
| `building.quakeDamagePopupPrefix` | 지진  | Earthquake  |

## 룬 데이터

| 키 | 원문(한국어) | 번역 |
|---|---|---|
| `rune_data.grade.normal` | 일반 | Common |
| `rune_data.grade.rare` | 희귀 | Rare |
| `rune_data.grade.epic` | 에픽 | Epic |
| `rune_data.grade.unique` | 유니크 | Unique |
| `rune_data.grade.legendary` | 전설 | Legendary |
| `rune_data.rune.힐.name` | 힐 | Heal |
| `rune_data.rune.힐.desc` | 유닛에게 공격당할 때 {prob}% 확률로 내 유닛 최대 체력의 {rec_p}% 회복 | When attacked by an enemy unit, has a {prob}% chance to recover {rec_p}% of its own max HP |
| `rune_data.rune.공격력 증가 1.name` | 공격력 증가 1 | Attack Increase 1 |
| `rune_data.rune.공격력 증가 1.desc` | 유닛 공격력 {atk_f} 증가 | Increases unit attack by {atk_f} |
| `rune_data.rune.체력 증가 1.name` | 체력 증가 1 | HP Increase 1 |
| `rune_data.rune.체력 증가 1.desc` | 유닛 체력 {hp_f} 증가 | Increases unit HP by {hp_f} |
| `rune_data.rune.희생.name` | 희생 | Sacrifice |
| `rune_data.rune.희생.desc` | 사망 시 {prob}% 확률로 같은 타일에 있는 동일 부족 소속의 유닛에게 나의 유닛 최대 체력의 {rec_p}% 회복 | Upon death, {prob}% chance to recover {rec_p}% of my unit's max HP for a unit of the same tribe on the same tile |
| `rune_data.rune.마지막 선물.name` | 마지막 선물 | Last Gift |
| `rune_data.rune.마지막 선물.desc` | 사망 시 {prob}% 확률로 같은 타일에 있는 동일 부족 소속의 유닛에게 공격력 {atk_f} 증가 버프 {turn}턴 지속 | Upon death, {prob}% chance to grant a unit of the same tribe on the same tile a buff of +{atk_f} attack for {turn} turns |
| `rune_data.rune.승리의 함성.name` | 승리의 함성 | Victory Cry |
| `rune_data.rune.승리의 함성.desc` | 적 유닛을 처치 시 유닛의 공격력 {atk_p}% 버프 {turn}턴 지속 | On defeating an enemy unit, grants the unit a +{atk_p}% attack buff for {turn} turns |
| `rune_data.rune.자연의 포옹.name` | 자연의 포옹 | Nature's Embrace |
| `rune_data.rune.자연의 포옹.desc` | 자연 구조물(채집지 제외)이 있는 타일 옆에 있을 경우 유닛의 공격력 {atk_f} 체력 {hp_f} 버프 | When adjacent to a tile with a nature structure (excluding gathering sites), grants the unit +{atk_f} attack and +{hp_f} HP |
| `rune_data.rune.트리플 임팩트.name` | 트리플 임팩트 | Triple Impact |
| `rune_data.rune.트리플 임팩트.desc` | 세번 째 공격마다 내 유닛의 공격력의 {burst_p}%의 추가 피해 | Every 3rd attack deals an extra {burst_p}% of my unit's attack as bonus damage |
| `rune_data.rune.단단한 피부 1.name` | 단단한 피부 1 | Tough Skin 1 |
| `rune_data.rune.단단한 피부 1.desc` | 적 유닛에게 공격당할 때 피해 {red_f}만큼 감소 | When attacked by an enemy unit, reduces damage by {red_f} |
| `rune_data.rune.피해 저항 1.name` | 피해 저항 1 | Damage Resistance 1 |
| `rune_data.rune.피해 저항 1.desc` | 적 유닛에게 공격당할 때 {prob}%의 확률로 피해 {red_f}만큼 감소 | When attacked by an enemy unit, {prob}% chance to reduce damage by {red_f} |
| `rune_data.rune.보호막.name` | 보호막 | Shield |
| `rune_data.rune.보호막.desc` | {turn}번의 적 공격 피해를 {red_p}% 감소 | Reduces damage from the next {turn} enemy attacks by {red_p}% |
| `rune_data.rune.파괴자 1.name` | 파괴자 1 | Destroyer 1 |
| `rune_data.rune.파괴자 1.desc` | 건축물을 공격할 때 유닛의 공격력 {atk_p}% 증가 | Increases unit attack by {atk_p}% when attacking buildings |
| `rune_data.rune.강인함 1.name` | 강인함 1 | Toughness 1 |
| `rune_data.rune.강인함 1.desc` | 건축물에게 공격당할 때 피해 {red_f} 감소 | Reduces damage by {red_f} when attacked by a building |
| `rune_data.rune.부족의 축복 1.name` | 부족의 축복 1 | Tribe's Blessing 1 |
| `rune_data.rune.부족의 축복 1.desc` | 내 부족이 점령한 타일 위에 있을 때 유닛의 공격력 {atk_f} 체력 {hp_f} 증가 | When on a tile controlled by my tribe, increases unit attack by {atk_f} and HP by {hp_f} |
| `rune_data.rune.공격력 증가 2.name` | 공격력 증가 2 | Attack Increase 2 |
| `rune_data.rune.공격력 증가 2.desc` | 유닛 공격력 {atk_f} 증가 | Increases unit attack by {atk_f} |
| `rune_data.rune.체력 증가 2.name` | 체력 증가 2 | HP Increase 2 |
| `rune_data.rune.체력 증가 2.desc` | 유닛 체력 {hp_f} 증가 | Increases unit HP by {hp_f} |
| `rune_data.rune.협동 공격.name` | 협동 공격 | Cooperative Attack |
| `rune_data.rune.협동 공격.desc` | 같은 타일에 내 유닛이 5마리 이상일 때 유닛의 공격력 {atk_f} 체력 {hp_f} 증가 | When there are 5 or more of my units on the same tile, increases unit attack by {atk_f} and HP by {hp_f} |
| `rune_data.rune.고독한 분노.name` | 고독한 분노 | Lone Fury |
| `rune_data.rune.고독한 분노.desc` | 같은 타일에 내 유닛이 1마리일 때 유닛의 공격력 {atk_f} 체력 {hp_f} 증가 | When there is only 1 of my units on the same tile, increases unit attack by {atk_f} and HP by {hp_f} |
| `rune_data.rune.단단한 피부 2.name` | 단단한 피부 2 | Tough Skin 2 |
| `rune_data.rune.단단한 피부 2.desc` | 적 유닛에게 공격당할 때 피해 {red_f}만큼 감소 | When attacked by an enemy unit, reduces damage by {red_f} |
| `rune_data.rune.피해 저항 2.name` | 피해 저항 2 | Damage Resistance 2 |
| `rune_data.rune.피해 저항 2.desc` | 적 유닛에게 공격당할 때 {prob}% 확률로 피해 {red_f}만큼 감소 | When attacked by an enemy unit, {prob}% chance to reduce damage by {red_f} |
| `rune_data.rune.파괴자 2.name` | 파괴자 2 | Destroyer 2 |
| `rune_data.rune.파괴자 2.desc` | 건축물을 공격할 때 유닛의 공격력 {atk_p}% 증가 | Increases unit attack by {atk_p}% when attacking buildings |
| `rune_data.rune.부족의 축복 2.name` | 부족의 축복 2 | Tribe's Blessing 2 |
| `rune_data.rune.부족의 축복 2.desc` | 내 부족이 점령한 타일 위에 있을 때 유닛의 공격력 {atk_f} 체력 {hp_f} 증가 | When on a tile controlled by my tribe, increases unit attack by {atk_f} and HP by {hp_f} |
| `rune_data.rune.치명타 확률.name` | 치명타 확률 | Critical Rate |
| `rune_data.rune.치명타 확률.desc` | 유닛 치명타 확률 {prob}% 증가 | Increases unit critical rate by {prob}% |
| `rune_data.rune.치명타 피해.name` | 치명타 피해 | Critical Damage |
| `rune_data.rune.치명타 피해.desc` | 유닛 치명타 피해량 {crit_d}% 증가 | Increases unit critical damage by {crit_d}% |
| `rune_data.rune.공격력 증가 3.name` | 공격력 증가 3 | Attack Increase 3 |
| `rune_data.rune.공격력 증가 3.desc` | 유닛 공격력 {atk_f} 증가 | Increases unit attack by {atk_f} |
| `rune_data.rune.체력 증가 3.name` | 체력 증가 3 | HP Increase 3 |
| `rune_data.rune.체력 증가 3.desc` | 유닛 체력 {hp_f} 증가 | Increases unit HP by {hp_f} |
| `rune_data.rune.죽을 준비.name` | 죽을 준비 | Ready to Die |
| `rune_data.rune.죽을 준비.desc` | 사망 시 {prob}% 확률로 현재 전투중인 유닛에게 나의 유닛의 공격력의 {burst_p}% 피해 | Upon death, {prob}% chance to deal {burst_p}% of my unit's attack as damage to the unit currently in battle |
| `rune_data.rune.압축된 힘.name` | 압축된 힘 | Compressed Power |
| `rune_data.rune.압축된 힘.desc` | 유닛의 크기가 작아지며 유닛의 공격력이 {atk_p}% 증가하고 최대 체력이 25% 감소 | Shrinks the unit's size, increasing attack by {atk_p}% and decreasing max HP by 25% |
| `rune_data.rune.매머드의 힘.name` | 매머드의 힘 | Mammoth's Power |
| `rune_data.rune.매머드의 힘.desc` | 유닛의 크기가 커지며 유닛의 체력이 {hp_p}% 증가하고 공격력이 25% 감소 | Enlarges the unit's size, increasing HP by {hp_p}% and decreasing attack by 25% |
| `rune_data.rune.파괴자 3.name` | 파괴자 3 | Destroyer 3 |
| `rune_data.rune.파괴자 3.desc` | 건축물을 공격할 때 유닛의 공격력 {atk_p}% 증가 | Increases unit attack by {atk_p}% when attacking buildings |
| `rune_data.rune.타이탄 가드.name` | 타이탄 가드 | Titan Guard |
| `rune_data.rune.타이탄 가드.desc` | 보스에게 공격당할 때 피해 {red_f}만큼 감소 | Reduces damage by {red_f} when attacked by a boss |
| `rune_data.rune.흡혈.name` | 흡혈 | Life Steal |
| `rune_data.rune.흡혈.desc` | 유닛을 공격할 때 {prob}% 확률로 내 유닛 공격력의 {rec_p}% 만큼 체력 회복 | When attacking a unit, {prob}% chance to recover HP equal to {rec_p}% of my unit's attack |
| `rune_data.rune.강타.name` | 강타 | Heavy Strike |
| `rune_data.rune.강타.desc` | 유닛 공격력 {atk_p}% 증가 | Increases unit attack by {atk_p}% |
| `rune_data.rune.방어벽.name` | 방어벽 | Barrier |
| `rune_data.rune.방어벽.desc` | 유닛 체력 {hp_p}% 증가 | Increases unit HP by {hp_p}% |
| `rune_data.rune.강인함 2.name` | 강인함 2 | Toughness 2 |
| `rune_data.rune.강인함 2.desc` | 건축물에게 공격당할 때 피해 {red_p}% 감소 | Reduces damage by {red_p}% when attacked by a building |
| `rune_data.rune.지진.name` | 지진 | Earthquake |
| `rune_data.rune.지진.desc` | 적 건축물 대상 {count}번째 공격마다 주변 1칸 타일에 있는 적 건축물까지 건축물 대상 최종 피해량의 {burst_p}%만큼 피해를 줍니다. | Every {count}th attack on an enemy building also deals {burst_p}% of the building-target final damage to enemy buildings on adjacent tiles. |
| `rune_data.rune.보스 슬레이어.name` | 보스 슬레이어 | Boss Slayer |
| `rune_data.rune.보스 슬레이어.desc` | 보스를 공격할 때 유닛의 공격력 {atk_p}% 증가 | Increases unit attack by {atk_p}% when attacking a boss |
| `rune_data.rune.메테오.name` | 메테오 | Meteor |
| `rune_data.rune.메테오.desc.base` | 유닛을 공격할 때 {prob}% 확률로 현재 타일에 있는 모든 적에게 공격력의 {burst_p}% 스킬 추가 피해<br>레전더리 패시브 : 공격력 {atk_p}%, 체력 {hp_p}% 증가 | When attacking a unit, {prob}% chance to deal an extra {burst_p}% of attack as skill damage to all enemies on the current tile<br>Legendary Passive: Increases attack by {atk_p}% and HP by {hp_p}% |
| `rune_data.rune.메테오.desc.areaExtra` | <br>*주변 타일에 있는 모든 적에게 {area_burst_p}% 추가 스킬 피해 | <br>*Deals an extra {area_burst_p}% skill damage to all enemies on surrounding tiles |
| `rune_data.rune.낙뢰.name` | 낙뢰 | Lightning Strike |
| `rune_data.rune.낙뢰.desc.base` | 유닛을 공격할 때 {prob}% 확률로 전투중인 상대 유닛에게 {burst_p}% 스킬 추가 피해<br>레전더리 패시브 : 공격력 {atk_p}%, 체력 {hp_p}% 증가 | When attacking a unit, {prob}% chance to deal an extra {burst_p}% skill damage to the opposing unit currently in battle<br>Legendary Passive: Increases attack by {atk_p}% and HP by {hp_p}% |
| `rune_data.rune.낙뢰.desc.instaExtra` | <br>*상대 체력이 {insta_hp}% 미만일 경우 {insta_prob}%확률로 즉사 | <br>*If the opponent's HP is below {insta_hp}%, {insta_prob}% chance to instantly kill them |

