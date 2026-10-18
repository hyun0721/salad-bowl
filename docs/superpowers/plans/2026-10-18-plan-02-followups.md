# Plan 02 후속 과제

Plan 02(그룹·초대·공개 설정)의 Task별 리뷰와 최종 리뷰에서 나왔지만 이후 계획으로 넘긴 항목이다. Plan 01 후속 과제([plan-01-followups.md](2026-10-18-plan-01-followups.md))와 함께 본다.

## Plan 03 (import·거래)
- **`GroupAccess` 사용 규칙**: `sharedOwnerIds`는 멤버십을 검사하지 않는다. `canEditOwnedBy(x, x)`는 멤버가 아니어도 true다. 그룹 범위 API는 항상 `requireMember`를 먼저 호출한다. 메서드 Javadoc에 이 전제 조건을 적는다.
- **조회 권한 메서드 추가**: `canViewOwnedBy`를 추가한다. `PATCH /transactions/{id}`는 볼 수 없는 회원에게 404, 볼 수는 있지만 수정할 수 없는 MEMBER에게 403을 돌려준다(그룹의 존재 숨김 규칙과 일관되게).
- **교차 그룹 권한 테스트**: 그룹 A에서는 비공개이고 그룹 B에서는 공개한 소유자에 대해, B의 ADMIN만 수정할 수 있는지 거래 권한 테스트와 함께 검증한다.
- **`DataIntegrityViolationException` 매핑**:
  - 지금은 모든 무결성 오류가 409 `CONFLICT`다.
  - 거래 `dedup_key` unique 충돌은 명시적으로 처리한다.
  - unique 위반(SQLState 23505)만 409로 보내고 나머지는 500으로 보낼지 검토한다.
- **테스트 비용**:
  - Spring context가 3개로 늘었다(MockMvc, `ExceptionMappingTest`의 `@Import`, RANDOM_PORT). `@MockitoBean`이나 `@TestPropertySource`로 context를 더 늘리지 않는다.
  - 테스트용 BCrypt cost를 낮추거나, 리포지토리 수준의 회원 픽스처를 검토한다.
- **테스트 보강(사소함)**:
  - rename 후 저장된 이름 확인
  - 초대 만료 경계(`now == expiresAt`)
  - `ALREADY_MEMBER`와 `GROUP_FULL`의 우선순위
  - 비멤버의 DELETE가 404인지
  - 스키마의 cascade·check 제약
- `@PreAuthorize` 같은 메서드 보안을 도입하면, `AccessDeniedException` 핸들러가 익명 요청에도 401 대신 403을 내지 않는지 확인한다.

## Plan 04 (웹앱)
- **그룹 이름 정규화**: `trim()`과 `@NotBlank`·`@Size`의 공백 기준이 다르다. `strip()`으로 바꾸고 DTO에서 정규화하는 방안을 FE 검증과 함께 정한다. 50자 초과 이름 테스트도 추가한다.
- **`listMine` N+1**: 그룹당 쿼리가 2개씩 나간다. 한 회원이 속한 그룹 수에는 제한이 없으므로 join과 group by 쿼리로 바꾼다.
- **회원가입 경쟁 조건 응답**: 동시 가입 시 `EMAIL_ALREADY_EXISTS` 대신 `CONFLICT`가 나간다. `signup`에서 무결성 오류를 잡아 `EMAIL_ALREADY_EXISTS`로 바꾼다.
- **삭제된 회원의 JWT**: 삭제된 회원의 토큰으로 `POST /groups`를 호출하면 FK 위반이 409로 보인다. 계정 삭제 기능을 설계할 때 처리하고, `created_by` FK의 ON DELETE 정책과 인덱스도 함께 정한다.

## Plan 05 (배포·운영)
- 비관적 락 대기에 상한이 없다. `lock_timeout`을 설정하고, `PessimisticLockingFailureException`·`CannotAcquireLockException`을 409나 503으로 매핑한다.
- 만료된 초대를 정리(purge)하고, 초대 발급 횟수를 제한한다.
- 프레임워크 4xx의 `detail`이 그대로 응답에 나가서 파라미터 이름이 노출된다. 고정 메시지로 바꿀지 검토한다.
- 차단(ban)에는 만료가 없다. ADMIN이 해제해야만 풀린다. 운영 정책이 필요하면 다시 검토한다.
