package com.saladbowl.api.tax.record;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.tax.law.TaxLawDtos.VersionResponse;
import com.saladbowl.api.tax.law.TaxLawService;
import com.saladbowl.api.tax.law.TaxLawVersion;
import com.saladbowl.api.tax.law.TaxLawVersionRepository;
import com.saladbowl.api.tax.record.TaxRecordDtos.LawVersionRef;
import com.saladbowl.api.tax.record.TaxRecordDtos.SavedYear;
import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

/**
 * 회원 본인의 소득공제 자료. 서버 검사는 "요청자 = 소유자" 하나이고 그룹과 무관하다(GroupAccess를 쓰지 않는다).
 * 모든 접근은 (요청자, 귀속연도)로 연도 기록을 찾는 데서 시작하므로 남의 자료와 없는 자료는 똑같이 404다.
 */
@Service
public class TaxRecordService {

    // "올해"는 한국 시각 기준이다. 서버 시계는 UTC라 그대로 쓰면 1월 1일 0~9시에 전년도가 올해가 된다.
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final TaxYearRecordRepository records;
    private final TaxLawService laws;
    private final TaxLawVersionRepository lawVersions;
    private final Clock clock;

    public TaxRecordService(TaxYearRecordRepository records, TaxLawService laws,
                            TaxLawVersionRepository lawVersions, Clock clock) {
        this.records = records;
        this.laws = laws;
        this.lawVersions = lawVersions;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public TaxYearView get(long userId, int year) {
        return view(requireOwned(userId, year));
    }

    /** 없으면 만들고(rowVersion 없이), 있으면 기본정보를 고친다(rowVersion 필수). */
    @Transactional
    public SavedYear saveYear(long userId, int year, YearRequest request) {
        if (request.workStartMonth() > request.workEndMonth()) {
            throw invalid("workEndMonth: 종료월이 시작월보다 빠릅니다");
        }
        Optional<TaxYearRecord> existing = records.findOwnedForUpdate(userId, year);
        if (existing.isEmpty()) {
            if (request.rowVersion() != null) {
                // 고치려던 기록이 다른 곳에서 삭제됐다. 말없이 다시 만들지 않는다.
                throw notFound();
            }
            requireCreatableYear(year);
            Long lawVersionId = laws.currentApplied(year).map(TaxLawVersion::getId).orElse(null);
            // 같은 회원이 동시에 두 번 만들면 UNIQUE (owner_id, tax_year)가 한쪽을 409로 만든다.
            TaxYearRecord created = records.saveAndFlush(TaxYearRecord.create(userId, year, request, lawVersionId));
            return new SavedYear(true, view(created));
        }
        TaxYearRecord record = existing.get();
        requireRowVersion(record.getRowVersion(), request.rowVersion());
        record.edit(request);
        // 응답에 올라간 rowVersion을 싣기 위해 여기서 반영한다.
        return new SavedYear(false, view(records.saveAndFlush(record)));
    }

    /** 연도 기록과 딸린 카드 자료·현금영수증 자료·지출계획을 지운다(딸린 행은 DB의 ON DELETE CASCADE). */
    @Transactional
    public void deleteYear(long userId, int year) {
        records.delete(lockOwned(userId, year));
    }

    /** 읽기용. 요청자의 그 귀속연도 기록이 없으면 404다. 조회(이 클래스와 PR 4의 분석)가 쓴다. */
    public TaxYearRecord requireOwned(long userId, int year) {
        return records.findByOwnerIdAndTaxYear(userId, year).orElseThrow(TaxRecordService::notFound);
    }

    /** 쓰기용. 연도 기록 행을 잠근다. 딸린 자료의 쓰기도 이 잠금 뒤에서 하므로 한 연도의 쓰기는 차례로 실행된다. */
    TaxYearRecord lockOwned(long userId, int year) {
        return records.findOwnedForUpdate(userId, year).orElseThrow(TaxRecordService::notFound);
    }

    private void requireCreatableYear(int year) {
        int thisYear = LocalDate.now(clock.withZone(KST)).getYear();
        if (year < thisYear - 1 || year > thisYear + 1) {
            throw invalid("year: 올해·전년도·다음 해만 만들 수 있습니다");
        }
    }

    private TaxYearView view(TaxYearRecord record) {
        LawVersionRef lawVersion = record.getLawVersionId() == null ? null
                : lawVersions.findById(record.getLawVersionId()).map(TaxRecordService::toRef).orElse(null);
        return new TaxYearView(record.getTaxYear(), record.getRowVersion(), record.getTotalSalary(),
                record.getWorkStartMonth(), record.getWorkEndMonth(), record.getChildCount(), lawVersion);
    }

    private static LawVersionRef toRef(TaxLawVersion version) {
        boolean childTiersApply = VersionResponse.of(version, null, null, null).childTiersApply();
        return new LawVersionRef(version.getId(), version.getVersionNo(), version.getAppliedAt(), childTiersApply);
    }

    /** 저장된 값과 요청의 rowVersion이 다르면(없는 것 포함) 다른 곳에서 먼저 바뀐 것이다. */
    static void requireRowVersion(long stored, Long requested) {
        if (requested == null || stored != requested) {
            throw new ApiException(ErrorCode.CONFLICT, "tax record was modified elsewhere");
        }
    }

    static ApiException invalid(String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message);
    }

    static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND, "tax record not found");
    }
}
