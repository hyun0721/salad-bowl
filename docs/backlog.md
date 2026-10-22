# 잔여 작업 (Backlog)

나중에 진행하기로 한 작업이다. 계획(Plan)에 들어가면 해당 계획 문서로 옮기고 여기서 지운다.

## 기능
- **대용량 엑셀 업로드(스트리밍 파싱)**: 지금은 한 번에 최대 3개월치·512KB로 제한한다(Plan 05). 1년치 같은 큰 파일을 받으려면 `가계부 내역` 시트만 행 단위로 읽는 스트리밍 파서(예: `excel-streaming-reader`, POI 5.5.x 필요)로 바꾸고, `memoryTest`의 상한 파일 크기를 함께 올린다. 파싱 메모리는 XSSF 기준 xlsx 1MB당 약 170MB다.
- **그룹 관리자 위임**: 지금 관리자는 그룹을 나갈 수도, 다른 멤버에게 관리자를 넘길 수도 없다(API `ADMIN_CANNOT_LEAVE`). 관리자 넘기기와, 넘긴 뒤 나가기를 만든다. 그룹 삭제도 함께 검토한다.

## 인프라
- **개인 도메인(B안)**: 1차는 Cloudflare Pages 프록시(A안)로 간다. 전환할 때는 쿠키 Path와 SameSite 설정, `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS` 값만 바꾼다.
