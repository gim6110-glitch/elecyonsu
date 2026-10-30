> ⚠️ **현재 설치 안내의 일부는 v1 기준입니다. 이미 생성된 Supabase 프로젝트는 먼저 [UPGRADE_V4.md](./UPGRADE_V4.md)의 SQL 마이그레이션을 실행하세요. 최신 버전에는 개인별 확인코드가 없습니다.**\n\n# Supabase 연결 안내 — 이 순서대로 따라 하세요

## 1. 프로젝트 만들기
1. https://supabase.com/dashboard 열기 (이미 GitHub 계정으로 가입한 상태면 로그인)
2. **New project** 누르기
3. Organization 선택 → Name: `elecyonsu`
4. Database Password 새로 설정하여 안전하게 보관
5. Region은 **Northeast Asia (Seoul)** 선택 가능하면 선택
6. Free 플랜으로 프로젝트 만들기

> GitHub로 Supabase에 가입한 것과 **Supabase 프로젝트를 생성한 것은 별개**입니다. 프로젝트를 한 개 생성해야 DB와 API 주소가 나옵니다.

## 2. SQL 실행
1. Supabase 왼쪽 메뉴 **SQL Editor**
2. **New query**
3. GitHub의 `supabase_setup.sql` 전체 복사·붙여넣기
4. **Run** 클릭
5. 에러가 나면 실제 에러 메시지를 보고 수정해야 합니다. 에러가 있는데도 다음 단계로 넘어가지 마세요.

## 3. 프로젝트 API 주소 입력
1. Supabase Dashboard → **Connect** 또는 **Project Settings → API Keys**
2. **Project URL**(https://xxxxx.supabase.co), **publishable key**(`sb_publishable_...`)를 찾기
3. https://github.com/gim6110-glitch/elecyonsu/blob/main/config.js 열기
4. 연필 아이콘 클릭 → `YOUR_SUPABASE_PROJECT_URL`, `YOUR_SUPABASE_PUBLISHABLE_KEY`를 각각 교체
5. **Commit changes** 저장

**절대 붙여 넣지 말아야 하는 키:** `service_role`, `sb_secret_...`, 데이터베이스 암호.
공개 GitHub 저장소의 `config.js`는 모두 볼 수 있습니다. publishable key만 허용됩니다.

## 4. Netlify 연결
1. https://app.netlify.com 로그인
2. **Add new project → Import an existing project → GitHub**
3. GitHub 접근 승인 후 `gim6110-glitch/elecyonsu` 선택
4. Build command: **비워 둠**
5. Publish directory: **.**
6. Deploy 진행
7. 발급된 `https://...netlify.app` 주소 기록

GitHub 저장소에 커밋할 때마다 Netlify가 새 버전을 자동 배포합니다.

## 5. 이메일 로그인 먼저 테스트
1. Supabase **Authentication → Providers → Email**이 활성화되어 있는지 확인
2. **Authentication → URL Configuration**에서
    - Site URL을 Netlify 주소로 변경
    - Redirect URLs에 `https://발급받은이름.netlify.app/**` 추가
3. Netlify 주소를 열고 **이메일 회원가입**
4. 확인 메일 인증 후 로그인
5. **연수 만들기 → 명단 입력 → 확인코드 보관 → QR 링크를 휴대전화로 열고 서명** 시험

## 6. Google 로그인 설정 (선택, 다만 공식 운영 전에 권장)
GitHub로 Supabase에 가입했다고 해서 앱 이용자의 Google OAuth가 자동 활성화되지는 않습니다.

1. https://console.cloud.google.com 에서 프로젝트 만들기
2. **Google Auth Platform / OAuth consent screen** 구성 (테스트 앱이면 테스트 사용자 등록)
3. **Clients → Create client → Web application** 선택
4. Authorized redirect URI는 Supabase **Authentication → Sign In / Providers → Google** 화면에 표시된 callback URI(`https://프로젝트ref.supabase.co/auth/v1/callback`)를 정확히 등록
5. 생성된 **Client ID / Client secret**을 Supabase Google Provider 설정에 입력 (GitHub 코드가 아님!)
6. Enable → Save
7. 로그인 버튼 테스트 및 Netlify Site URL/Redirect URLs 검증

## 7. 기능 사용 요령
- 명단: 직위 / 성명 두 열이 포함된 `.xlsx` 파일을 업로드할 수 있습니다.
- 확인코드: 새 참석자를 추가할 때 코드가 만들어지고 **그 시점에만 표시**됩니다. 엑셀 업로드·명단 복사 시 CSV 파일로 바로 내려받습니다. 분실 시 새 코드를 발급하는 기능은 아직 제공되지 않으므로 참석자 기록을 다시 등록해야 합니다.
- 서명 참여자는 QR 링크뿐 아니라 개인별 확인코드도 필요합니다.
- 기본 등록부 인쇄 버튼에서 브라우저 인쇄 대화상자의 **PDF로 저장**을 선택하면 한글과 서명 이미지 포함 출력이 가능합니다.
- 학교 양식: 등록부 PDF 또는 XLSX를 업로드, 각 좌표 또는 셀을 매핑합니다.
- **주의: 학교 PDF 양식의 자동 입력은 복잡한 원본과 한글 폰트 문제가 있어 아직 품질 검증 전입니다. XLSX 파일에는 현재 서명 이미지 대신 서명 완료 시각이 기록됩니다.** 이 기능은 현재 제한적 베타입니다.

## 8. 중요한 운영 제한과 보안
- 개인정보 및 서명은 실명 테스트 전에 학교 승인과 안전성 점검이 필요합니다.
- 공개 QR 페이지는 확인코드를 요구하지만, 코드 제출에 대한 **사용자/IP별 속도 제한 및 CAPTCHA는 아직 구현되지 않았습니다.** 정식 서비스 전 Supabase Edge Functions + rate limit 등의 보호가 필요합니다.
- 신원 확인이 완벽한 공인전자서명 서비스는 아닙니다.
- PDF/Excel 원본 양식은 현재 DB에 Base64로 저장되므로 2.5MB 파일 제한을 적용합니다. 큰 파일·장기 사용은 Supabase Storage로 개선하는 것이 적절합니다.
- 브라우저 CDN 라이브러리를 사용하므로 인터넷이 필요합니다.
- 무료 Supabase는 일정 기간 미사용하면 일시 정지될 수 있으며 중요한 자료는 정기 백업하세요.

## 9. 시험할 항목
- 서로 다른 관리자 계정에서 상대방 연수 목록 조회 불가
- 명단 추가 / 순서 이동 / 삭제 / 엑셀 업로드
- 휴대전화 QR → 확인코드 → 서명 → PC에서 완료 상태 갱신
- 서명 초기화 후 재서명
- 30명, 31명 명단의 인쇄 페이지 분할
- 한글·서명 이미지 포함 PDF 인쇄
- 실제 학교 PDF 및 Excel 양식에서 위치 매핑 결과 확인

이 프로그램은 기초 기능을 개발한 **시범 버전**이며, 아직 실사용 환경·실제 학교 양식으로 통합 검증되지는 않았습니다.
