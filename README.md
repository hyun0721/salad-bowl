# Salad Bowl

뱅크샐러드 엑셀을 import해 그룹과 가계부를 공유하는 웹 서비스.

## 구조
- `apps/api` — Spring Boot API
- `apps/web` — React 웹앱 (Plan 04)
- `docs/superpowers` — 설계 문서와 구현 계획

## 로컬 실행
```bash
docker compose up -d
cd apps/api && ./gradlew bootRun
```
