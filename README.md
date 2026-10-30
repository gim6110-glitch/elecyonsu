# 전자 연수등록부 — 교직원 전자서명 시스템

**현재 상태:** 소스코드 게시 완료 / **Supabase 프로젝트 연결과 OAuth 설정은 별도로 필요**합니다. 연결 전에는 실제 로그인·저장·QR 서명이 작동하지 않습니다.

- 관리자: Google 로그인 또는 이메일 로그인, 연수 CRUD, 참석자·확인코드, 명단 Excel 출력/가져오기
- 참여자: 공유 QR 링크 + 개별 확인코드 + 손글씨 전자서명
- 실시간: 관리자 화면의 완료 인원·서명 상태 반영
- 출력: 기본 A4 PDF·Excel, 사용자 PDF 양식 업로드 후 좌표 매핑 출력, 사용자 Excel(.xlsx) 서식 업로드 후 셀 매핑 출력
- 파일들은 공개 GitHub 저장소에 두되 **실제 개인정보 및 서명은 업로드하지 않습니다.**

## 먼저 할 일 (상세한 화면별 설명은 SETUP.md)

1. https://supabase.com/dashboard 에서 **New project** (Free) 생성
2. Supabase **SQL Editor**에서 `supabase_setup.sql` 내용 전체 실행
3. **Project Connect** 에서 Project URL / **publishable key** 복사
4. GitHub의 `config.js`에서 두 가지 값만 변경 (secret, service_role key 절대 금지)
5. https://app.netlify.com/ 에서 **Add new project > Import an existing project > GitHub** 에서 이 저장소 선택. Build command 없음, Publish directory `.`
6. 배포 주소를 Supabase **Authentication > URL Configuration**의 Site URL 및 Redirect URLs에 등록
7. Google 로그인은 **Authentication > Sign In / Providers > Google**에서 활성화. Google Cloud에서 Web OAuth Client를 만들고 Supabase callback 주소를 등록해야 함. 먼저 이메일 인증으로 기본 기능 점검 가능
8. 실제 교사 데이터가 아닌 **가상 인원으로 반드시 동작 검증**한 후 학교 정책에 따라 승인받아 운영

## 주의
- 학교 실명·직위·서명은 개인정보입니다. 본인 확인용 개별 확인코드는 관리자만 조회·배부할 수 있습니다. 공개 QR 링크만으로 서명을 제출할 수 없습니다.
- 파일 업로드는 관리자 계정별 비공개 저장소로 분리됩니다.
- 이 앱은 **법적 공인 전자서명 또는 신분 인증 서비스가 아닙니다.**
- 무료 Supabase 프로젝트는 장기간 미사용 시 일시 정지될 수 있고, 무료 자동 백업은 보장되지 않습니다. 중요한 자료는 PDF/Excel과 DB 백업 절차를 별도로 마련하세요.
- PDF 양식은 첫 페이지를 반복하여 출력하는 방식이며 입력 위치를 직접 점 좌표로 조정합니다.
- Excel 양식은 셀·행 지정 입력이며 고급 매크로·복잡한 인쇄 레이아웃의 완전 보존을 보장하지 않습니다.
