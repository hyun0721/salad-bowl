package com.saladbowl.api.tax.law;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.tax.law.TaxLawDtos.FieldError;
import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import com.saladbowl.api.tax.law.TaxLawDtos.ValidationResponse;
import com.saladbowl.api.tax.law.TaxLawDtos.VersionResponse;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** 세법 버전 관리. 서비스 관리자 검사는 TaxAdminInterceptor가 /tax/admin/** 경로에서 한다. */
@Service
public class TaxLawService {

    // 한 문장으로 올리고 받는다. 카운터 행의 잠금이 커밋까지 유지되므로 동시에 만든 초안도 번호가 겹치지 않고,
    // 초안 저장이 실패해 롤백되면 번호도 함께 되돌아간다.
    private static final String NEXT_VERSION_NO = """
            INSERT INTO tax_law_year_counters (tax_year, last_version_no) VALUES (?, 1)
            ON CONFLICT (tax_year) DO UPDATE SET last_version_no = tax_law_year_counters.last_version_no + 1
            RETURNING last_version_no
            """;

    private final TaxLawVersionRepository versions;
    private final UserRepository users;
    private final JdbcTemplate jdbc;

    public TaxLawService(TaxLawVersionRepository versions, UserRepository users, JdbcTemplate jdbc) {
        this.versions = versions;
        this.users = users;
        this.jdbc = jdbc;
    }

    @Transactional
    public VersionResponse createDraft(long adminId, int taxYear) {
        Integer versionNo = jdbc.queryForObject(NEXT_VERSION_NO, Integer.class, taxYear);
        TaxLawVersion draft = TaxLawVersion.draft(taxYear, versionNo, adminId);
        currentApplied(taxYear).ifPresent(draft::copyValuesFrom);
        return toAdminResponse(versions.save(draft));
    }

    @Transactional(readOnly = true)
    public List<VersionResponse> list(int taxYear) {
        return versions.findByTaxYearOrderByVersionNoDesc(taxYear).stream().map(this::toAdminResponse).toList();
    }

    @Transactional(readOnly = true)
    public VersionResponse get(long id) {
        return toAdminResponse(versions.findById(id).orElseThrow(TaxLawService::notFound));
    }

    @Transactional
    public VersionResponse updateDraft(long id, UpdateRequest request) {
        TaxLawVersion draft = lockDraft(id);
        requireRowVersion(draft, request.rowVersion());
        draft.edit(request);
        // 응답에 올라간 rowVersion을 싣기 위해 여기서 반영한다.
        return toAdminResponse(versions.saveAndFlush(draft));
    }

    @Transactional
    public void deleteDraft(long id, long rowVersion) {
        TaxLawVersion draft = lockDraft(id);
        requireRowVersion(draft, rowVersion);
        versions.delete(draft);
    }

    @Transactional(readOnly = true)
    public ValidationResponse validate(long id) {
        return new ValidationResponse(
                TaxLawValidator.validate(versions.findById(id).orElseThrow(TaxLawService::notFound)));
    }

    /** 같은 초안의 수정·삭제·적용은 행 잠금 안에서 상태 확인과 검증을 마친다. */
    @Transactional
    public VersionResponse apply(long adminId, long id, long rowVersion) {
        TaxLawVersion draft = lockDraft(id);
        requireRowVersion(draft, rowVersion);
        List<FieldError> errors = TaxLawValidator.validate(draft);
        if (!errors.isEmpty()) {
            FieldError first = errors.get(0);
            throw new ApiException(ErrorCode.VALIDATION_FAILED, first.field() + ": " + first.message());
        }
        draft.apply(adminId, OffsetDateTime.now());
        return toAdminResponse(versions.saveAndFlush(draft));
    }

    /** 회원용: 그 귀속연도의 현재 적용 버전. 작성자·적용자 닉네임과 메모는 내리지 않는다. */
    @Transactional(readOnly = true)
    public VersionResponse current(int taxYear) {
        return currentApplied(taxYear).map(v -> VersionResponse.of(v, null, null, null))
                .orElseThrow(TaxLawService::notFound);
    }

    public Optional<TaxLawVersion> currentApplied(int taxYear) {
        return versions.findFirstByTaxYearAndStatusOrderByAppliedAtDescIdDesc(taxYear, TaxLawStatus.APPLIED);
    }

    /** 행을 잠그고 초안인지 확인한다. 잠금 뒤에 상태를 보므로 동시에 적용된 버전은 여기서 409가 된다. */
    private TaxLawVersion lockDraft(long id) {
        TaxLawVersion version = versions.findByIdForUpdate(id).orElseThrow(TaxLawService::notFound);
        if (version.getStatus() == TaxLawStatus.APPLIED) {
            throw new ApiException(ErrorCode.CONFLICT, "applied tax law version cannot be changed");
        }
        return version;
    }

    private VersionResponse toAdminResponse(TaxLawVersion version) {
        return VersionResponse.of(version, nickname(version.getCreatedBy()), nickname(version.getAppliedBy()),
                version.getMemo());
    }

    // shortcut: 버전마다 회원을 따로 읽는다(연도당 버전이 몇 개뿐이다). 목록이 느려지면 한 번에 읽도록 바꾼다.
    private String nickname(Long userId) {
        return userId == null ? null : users.findById(userId).map(User::getNickname).orElse(null);
    }

    private static void requireRowVersion(TaxLawVersion draft, long rowVersion) {
        if (draft.getRowVersion() != rowVersion) {
            throw new ApiException(ErrorCode.CONFLICT, "tax law version was modified elsewhere");
        }
    }

    private static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND, "tax law version not found");
    }
}
