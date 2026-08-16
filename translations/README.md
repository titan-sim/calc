# 번역 파일 안내

다이노 뮤턴트 시뮬레이터 사이트의 사용자 노출 텍스트(683개 키, 13개 구역)를 정리한 번역 참고 자료입니다.
**아직 사이트 코드에는 연결되어 있지 않은 순수 참고/작업용 파일**입니다 — 실제 언어 전환 기능은 별도로 구현해야 합니다.

## 파일 구성

| 언어 | JSON (키-값) | MD (한국어 대조표) |
|---|---|---|
| 한국어 (원본) | `translation-strings.json` | — |
| 영어 | `translation-strings.en.json` | `translation-strings.en.md` |
| 중국어 간체 | `translation-strings.zh-CN.json` | `translation-strings.zh-CN.md` |
| 일본어 | `translation-strings.ja.json` | `translation-strings.ja.md` |
| 베트남어 | `translation-strings.vi.json` | `translation-strings.vi.md` |

- **JSON**: 그룹별(`index_html`, `home`, `titan`, `rune_data` 등) 키-값 객체. 5개 언어 파일 모두 정확히 같은 683개 키를 가지고 있어서, 나중에 실제 다국어 기능을 코드에 넣을 때 그대로 재사용할 수 있습니다.
- **MD**: 같은 내용을 `키 | 원문(한국어) | 번역` 3열 표로 정리한, 사람이 훑어보기 편한 버전. 한국어 원문은 별도 MD 없이 각 언어 MD 안에 같이 들어있습니다.
- `{placeholder}` 형태는 실행 중에 실제 값으로 채워지는 자리이므로 모든 언어에서 그대로 유지되어 있습니다.

## 검수 이력

영어·일본어·베트남어·중국어(간체) 전부 제미나이(Gemini) 교차 검수를 거쳐 반영했습니다. 검수 과정에서 발견된 사이트 자체의 원문 버그(예: 허수아비 툴팁의 "(훈련 인형)" 괄호 설명 누락)는 `js/pages/dummy-page.js`의 실제 소스에도 함께 반영했습니다.
