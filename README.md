# 농사 처방 시연 웹앱 (PWA) P0 골격 v0.1

작성: 2026-11-15 허간(개발 총괄) / 상태: 골격 (개발 착수 11/20 전 선작업, 게이트1 결정 전이라 허간 추천안 기준)

기준 문서
- 기능 목록·메뉴 트리 v0.1 (P0 7기능, 홈·일지·증빙·지원금 4탭, 첫 화면 1안)
- 영농일지 입력 항목표 v0.1 (P0 필드, 선택지, 표준 영농기록장 A~M열 매핑)
- 운영비 견적 v1 GCP (Firebase 구성, 이메일 링크 로그인)
- P0 와이어프레임 v0.1 (`261115_허간_기획_P0와이어프레임_v01.html`, 화면 구성·문구 기준)

빌드 도구 없음: 순수 HTML + ES 모듈 JS + CSS. 외부 라이브러리는 CDN ESM import
(SheetJS `https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs`, Firebase `https://www.gstatic.com/firebasejs/<버전>/...`).

## 지금 되는 것 (P0)

| 화면 | 상태 |
|-|-|
| 로그인 | 데모 로그인 동작 (이메일 입력 -> 메일 확인 -> [링크 누르기 (시연)]), "데모 계정으로 둘러보기". Firebase 이메일 링크는 연결 자리 |
| 농장·하우스 동 등록 | 이름, 농장 이름, 위치(시군구), 동 이름·지번·작목(토마토/방울토마토/딸기), 동 추가·삭제. "내 농장"에서 다시 수정 |
| 홈 (1안 바로 기록형) | 진행도 한 줄(이번 달 기록 일수, 미완성 건수) + 오늘 일지 쓰기 큰 버튼 + 오늘 날씨 한 줄 + 최근 기록 3건 |
| 일지 쓰기 | 작업일(오늘 기본), 동 복수 선택, 작목 자동(수정 가능), 날씨 자동 표시(눌러서 수정), 작업단계 6개 큰 버튼 + 세부 작업 칩(토마토/딸기 별도), 농약/비료 여러 줄(구분, 구입·사용, 종류, 제품명 최근 목록+직접, 양 숫자패드, 단위, 희석배수·대상 병해충), 처리 면적(선택), 세부작업내용 자동 문장(직접 고치기 가능), 메모 |
| 저장 | 빈칸 있어도 저장, "미완성" + 빠진 항목 표시. 작성 시각·수정 시각·작성자·위치 자동 저장 |
| 일지 목록 | 날짜순, 월별 묶음, 동별/미완성만 필터, 미완성·가상 표시 |
| 일지 상세 | 전체 항목, 메타(작성·수정 시각, 사후입력), 수정·삭제 |
| 엑셀 다운로드 | 기간(이번 달/영농기간 전체/직접 선택), 시트1 표준 영농기록장 A~M열, 시트2 증빙정보. 모바일은 공유 시트 버튼 |
| 증빙·지원금 탭 | "준비 중" 목업 (와이어프레임 그대로) |
| 데모 데이터 | 처음 설정의 "가상 데모 농장으로 채우기", 내 농장의 "가상 데모 일지 넣기/지우기". 모든 데모 기록은 `demo: true`, 화면 상단 "가상 데이터 (데모)" 띠와 "가상" 태그 |
| PWA | manifest, 서비스 워커(정적 파일 캐시, SheetJS CDN 캐시), 아이콘 SVG/PNG(192, 512, maskable) |

### 엑셀 규칙 (입력 항목표 v0.1 4장)
- 시트1 `영농기록장`: A 작업일, B 필지("1동(가상리 123), 2동(...)"), C 작목, D 날씨("맑음, 4~15℃"), E 구입/사용, F~H 농약 종류·제품명·양, I~K 비료 종류·제품명·양, L 작업단계(작업명), M 세부작업내용(+ 메모)
- 1행은 머리글만, 병합 없음, A열은 진짜 날짜 셀(yyyy-mm-dd), 빈 값은 빈칸(0 안 씀), 자재마다 1행(A~D, L, M 반복), 오래된 날짜부터
- 시트2 `증빙정보`: 기록ID, 작업일, 시트1 행 번호, 작성시각, 수정시각, 사후입력 여부, 작성자, 이메일, 농장 위치, 하늘상태, 최저/최고기온, 강수량, 날씨 출처, 미완성 항목, 영수증 사진 링크(P1 자리), 가상 데이터 여부
- 파일명: `영농기록장_{농장명}_{시작일}_{종료일}.xlsx`

### 날씨 규칙
- 지금은 `weather.js` 의 고정 가상 응답(오늘~모레만 값, 지난 날짜는 "미수집"). 못 받으면 0 이 아니라 `status: 'missing'`, 값은 `null`, 엑셀은 빈칸
- 사용자가 눌러서 고치면 `source: 'manual'` 로 저장(시트2 날씨 출처 "직접 수정")

## 파일 구조

```
index.html                 앱 셸 (js/app.js 모듈 로드)
manifest.webmanifest       PWA 설치 정보
sw.js                      서비스 워커 (정적 파일 캐시, 버전 올리면 갱신)
css/app.css                모바일 우선 스타일 (와이어프레임 색·간격)
icons/                     icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png
js/config.js               설정 스위치: 저장소, 로그인, 날씨, 첫 화면 안, P0 범위, Firebase 웹 설정
js/app.js                  화면 렌더링, 해시 라우팅, 이벤트
js/constants.js            선택지 (작업단계, 세부 작업, 병해충, 농약/비료 종류, 단위, 엑셀 머리글)
js/records.js              빈 레코드, 작목 자동, 세부작업내용 자동 문장, 미완성 판정, 사후입력 판정
js/excel.js                .xlsx 생성 (SheetJS CDN), 다운로드·공유
js/weather.js              날씨 어댑터 (mock / proxy), 기상청 격자 변환 함수
js/auth.js                 로그인 어댑터 (demo / firebase 이메일 링크)
js/demo.js                 가상 데모 농장·일지 20건
js/firebase-init.js        Firebase SDK CDN 로드 (firebase 모드일 때만)
js/storage/index.js        저장소 선택
js/storage/local.js        localStorage 어댑터 (지금 동작)
js/storage/firebase.js     Firestore 어댑터 (연결 자리, 미테스트)
firestore.rules            보안 규칙 초안 (본인 uid 만)
firebase.json              Hosting·Firestore 배포 설정 초안
serve.ps1                  python 없을 때 쓰는 PowerShell 정적 서버
```

데이터 모양 (local, firebase 공통)
- 프로필: `{ name, farmName, location, houses: [{ id, name, lot, crop }], demo? }`
- 일지: `{ id, workDate, houseIds[], crop, weather{status, sky, tmin, tmax, rain, source, reason}, stage, task, materials[{kind, action, type, name, qty, unit, dilution, pest}], area{value, unit}, detail, detailEdited, memo, author, authorEmail, location, missing[], createdAt, updatedAt, demo }`

## 로컬 실행

ES 모듈이라 `file://` 로 열면 안 되고 정적 서버가 필요합니다.

```
# python 있을 때
python -m http.server 8080 --directory C:\Users\Gani\Documents\Codex\nongsa-cheobang-web
# python 없을 때 (PowerShell)
pwsh -File serve.ps1 -Port 8080
```
브라우저에서 `http://localhost:8080/` 접속. 휴대폰 확인은 같은 와이파이에서 PC IP 로 접속하거나, Firebase Hosting 배포 후 확인 (서비스 워커·설치는 https 또는 localhost 에서만 동작).

데이터 초기화: 개발자 도구 > Application > Local Storage 에서 `nc:` 로 시작하는 키 삭제, 또는 내 농장 > 로그아웃.

## Firebase 연결 절차 (프로젝트 nongsacheobang 권한 받은 뒤)

1. 효신에게 GCP 프로젝트 `nongsacheobang` 편집자(또는 Firebase 관리자) 권한 요청
2. Firebase 콘솔에서 프로젝트 추가(기존 GCP 프로젝트 선택) -> 웹 앱 등록 -> 웹 설정값 복사해 `js/config.js` 의 `firebase` 에 붙이기 (apiKey 등 웹 설정은 공개 식별자. 서비스 계정 키·기상청 서비스키는 절대 커밋 금지)
3. Authentication -> 로그인 방법 -> "이메일/비밀번호" 사용 + "이메일 링크(비밀번호 없는 로그인)" 사용. 승인된 도메인에 `localhost`, `nongsacheobang.web.app`(배포 주소), 도메인 구매 시 그 도메인 추가
4. Firestore 생성: 위치 `asia-northeast3`(서울), 프로덕션 모드. `firestore.rules` 배포
5. `js/config.js` 에서 `storage: 'firebase'`, `auth: 'firebase'`, `firebaseVersion` 최신 확인
6. 로컬에서 로그인 메일 수신 -> 링크 클릭 -> 동 등록 -> 일지 저장 -> Firestore 콘솔에서 `users/{uid}/records` 확인
7. 배포: Firebase CLI 가 이 PC 에서 막혀 있으면(npm EPERM) Cloud Shell 에서 `firebase deploy --only hosting,firestore:rules` (저장소 업로드 후)
8. 날씨: Cloud Functions(2세대, asia-northeast3) 날씨 프록시 작성 -> 기상청 서비스키는 Secret Manager -> 격자별 Firestore 캐시 -> `config.weather: 'proxy'`, `weatherProxyUrl` 설정
9. 비용 안전장치(운영비 견적 v1 7장): 함수 최대 인스턴스 3, App Check, 목록 30건 페이지, 예산 알림 확인

## 남은 TODO

- [ ] Firebase 실제 연결과 테스트 (GCP 권한 받은 뒤). `storage/firebase.js`, `auth.js` firebase 모드는 코드만 있고 미테스트
- [ ] Firebase 세션 복원(onAuthStateChanged), createdAt 서버 시각(serverTimestamp) + 보안 규칙 검증
- [ ] 기상청 API 키 발급 후 Cloud Functions 날씨 프록시, 실패 시 마지막 성공값 캐시
- [ ] 농장 위치 -> 좌표(카카오 로컬) -> 격자(nx, ny) 저장. 격자 변환 함수 `latLonToGrid` 는 준비됨
- [ ] 과거 날짜(사후입력) 날씨 출처 결정 (단기예보는 과거 조회 불가, 지상관측 자료 API 필요 여부)
- [ ] 목록 페이지 나누기(30건), 오프라인 캐시(Firestore persistentLocalCache)
- [ ] 효신 검토 반영: 세부 작업명·병해충 목록·단위(`js/constants.js`), 자주 쓰는 템플릿 5개(P1), 실제 데모 농가 데이터(`js/demo.js` 교체)
- [ ] 실제 기기(안드로이드 크롬) 설치·공유 시트 확인, 아이콘 디자인 교체
- [ ] 배포 주소 확정 후 사업계획서 스크린샷·링크

## 게이트1(11/16) / 게이트2(11/18) 결정에 따라 바꿀 곳

| 결정 | 바꿀 곳 |
|-|-|
| 첫 화면 1안/2안/3안 | `js/config.js` `homeVariant`, `showProgressLine`. 2안·3안은 `js/app.js` 의 `vHome()` 옆에 화면 함수 추가 (2안 +1.5일, 3안 +1.5~2일 견적) |
| 로그인 방식 (이메일 링크 / 6자리 코드) | `js/config.js` `auth`, `js/auth.js` 에 어댑터 추가. 6자리 코드는 Cloud Functions + 외부 메일(Resend 등, 달러 결제 이슈) 필요. 로그인 화면 문구는 `vLogin()`, `vSent()` |
| P0 범위 (가) 엄격안 / (나) 지원금 목업을 실제 화면 / (다) 날씨 고정 응답 | `js/config.js` `features.editDelete`(수정·삭제 끄기), `weather: 'mock'` 유지, 지원금 화면은 `vSupport()` |
| 지원금 서비스 범위 (A / A+B) | `vSupport()` 문구 ("신청 대행" 표현 금지 유지) |
| 작업 목록·병해충·단위 | `js/constants.js` |
| 엑셀 열 구성(농업ON 호환 시트 P2 등) | `js/excel.js` `buildWorkbook()` |

## 동작 확인 기록 (2026-11-15)

- 이 PC 의 작업 환경은 명령마다 네트워크가 격리되어, `python -m http.server` 는 실행되지만 다른 프로세스(브라우저 포함)에서 접속이 안 되고(타임아웃), PowerShell HttpListener 는 시작 단계에서 막힘. 같은 프로세스 안에서는 python 서버가 정상 응답(200, text/html).
- 대신 브라우저에 실제 소스 파일(js 모듈 전부, css)을 그대로 주입해 실행하는 방식으로 주요 흐름을 클릭 확인함: 로그인(데모 링크) -> 처음 설정(동 2개) -> 일지 2건 입력(오늘 1동 토마토 농약 사용 / 어제 2동 딸기 비료, 양 빈칸 -> 미완성 표시, 날씨 미수집) -> 목록 -> 상세 -> 수정(양 채움 -> 미완성 해제, 수정시각 기록) -> 엑셀 다운로드(.xlsx 파싱 확인: 시트 2개, A~M 머리글, 병합 없음, A열 날짜 셀, 미수집 날씨 빈칸, 0 값 없음, 시트2 사후입력 Y) -> 데모 데이터 넣기/지우기 -> 삭제 -> 로그아웃 -> 데모 계정 -> 미완성만 필터 -> 영농기간 전체 엑셀(20건).
- 이 방식에서는 서비스 워커·manifest 설치는 실행 확인 못 함 (문법·JSON 검사만). 실제 서버(localhost 또는 Firebase Hosting)에서 다시 확인 필요.
