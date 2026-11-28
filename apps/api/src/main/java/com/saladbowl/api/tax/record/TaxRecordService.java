package com.saladbowl.api.tax.record;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.tax.law.TaxLawDtos.VersionResponse;
import com.saladbowl.api.tax.law.TaxLawService;
import com.saladbowl.api.tax.law.TaxLawVersion;
import com.saladbowl.api.tax.law.TaxLawVersionRepository;
import com.saladbowl.api.tax.record.TaxRecordDtos.CardRequest;
import com.saladbowl.api.tax.record.TaxRecordDtos.CardView;
import com.saladbowl.api.tax.record.TaxRecordDtos.CashRequest;
import com.saladbowl.api.tax.record.TaxRecordDtos.CashView;
import com.saladbowl.api.tax.record.TaxRecordDtos.LawVersionRef;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRequest;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;
import com.saladbowl.api.tax.record.TaxRecordDtos.SavedYear;
import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * 회원 본인의 소득공제 자료. 서버 검사는 "요청자 = 소유자" 하나이고 그룹과 무관하다(GroupAccess를 쓰지 않는다).
 * 모든 접근은 (요청자, 귀속연도)로 연도 기록을 찾는 데서 시작하므로 남의 자료와 없는 자료는 똑같이 404다.
 */
@Service
public class TaxRecordService {

    // "올해"는 한국 시각 기준이다. 서버 시계는 UTC라 그대로 쓰면 1월 1일 0~9시에 전년도가 올해가 된다.
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final TaxYearRecordRepository records;
    private final TaxCardStatementRepository cards;
    private final TaxCashReceiptRepository cashReceipts;
    private final TaxSpendingPlanRepository plans;
    private final TaxLawService laws;
    private final TaxLawVersionRepository lawVersions;
    private final Clock clock;

    public TaxRecordService(TaxYearRecordRepository records, TaxCardStatementRepository cards,
                            TaxCashReceiptRepository cashReceipts, TaxSpendingPlanRepository plans,
                            TaxLawService laws, TaxLawVersionRepository lawVersions, Clock clock) {
        this.records = records;
        this.cards = cards;
        this.cashReceipts = cashReceipts;
        this.plans = plans;
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
            throw invalid("workEndMonth: 종료월이 시작월보다 빨라요");
        }
        Optional<TaxYearRecord> existing = records.findOwnedForUpdate(userId, year);
        if (existing.isEmpty()) {
            if (request.rowVersion() != null) {
                // 고치려던 기록이 다른 곳에서 삭제됐다. 말없이 다시 만들지 않는다.
                throw notFound();
            }
            requireCreatableYear(year);
            Long lawVersionId = laws.currentAppliedForNewRecord(year).map(TaxLawVersion::getId).orElse(null);
            // 같은 회원이 동시에 두 번 만들면 UNIQUE (owner_id, tax_year)가 한쪽을 409로 만든다.
            TaxYearRecord created = records.saveAndFlush(TaxYearRecord.create(userId, year, request,
                    lawVersionId, records.nextRowVersion()));
            return new SavedYear(true, view(created));
        }
        TaxYearRecord record = existing.get();
        requireRowVersion(record.getRowVersion(), request.rowVersion());
        record.edit(request, records.nextRowVersion());
        // 응답에 올라간 rowVersion을 싣기 위해 여기서 반영한다.
        return new SavedYear(false, view(records.saveAndFlush(record)));
    }

    /** 연도 기록과 딸린 카드 자료·현금영수증 자료·지출계획을 지운다(딸린 행은 DB의 ON DELETE CASCADE). */
    @Transactional
    public void deleteYear(long userId, int year, long rowVersion) {
        TaxYearRecord record = lockOwned(userId, year);
        requireRowVersion(record.getRowVersion(), rowVersion);
        records.delete(record);
    }

    @Transactional
    public TaxYearView addCard(long userId, int year, CardRequest request) {
        TaxYearRecord record = lockOwned(userId, year);
        if (cards.countByRecordId(record.getId()) >= TaxRecordDtos.MAX_CARDS) {
            throw invalid("cards: 연도 기록당 " + TaxRecordDtos.MAX_CARDS + "건까지만 저장할 수 있어요");
        }
        cards.saveAndFlush(TaxCardStatement.create(record.getId(), issuerName(request.issuerName()),
                asOfDate(request.asOfDate(), year), blankToNull(request.memo()), request.amounts()));
        return viewWithinTotalLimit(record);
    }

    @Transactional
    public TaxYearView updateCard(long userId, int year, long cardId, CardRequest request) {
        TaxYearRecord record = lockOwned(userId, year);
        TaxCardStatement card = requireCard(record, cardId);
        requireRowVersion(card.getRowVersion(), request.rowVersion());
        card.edit(issuerName(request.issuerName()), asOfDate(request.asOfDate(), year),
                blankToNull(request.memo()), request.amounts());
        cards.saveAndFlush(card);
        return viewWithinTotalLimit(record);
    }

    @Transactional
    public void deleteCard(long userId, int year, long cardId, long rowVersion) {
        TaxYearRecord record = lockOwned(userId, year);
        TaxCardStatement card = requireCard(record, cardId);
        requireRowVersion(card.getRowVersion(), rowVersion);
        cards.delete(card);
    }

    @Transactional
    public TaxYearView saveCashReceipt(long userId, int year, CashRequest request) {
        TaxYearRecord record = lockOwned(userId, year);
        Optional<TaxCashReceipt> existing = cashReceipts.findById(record.getId());
        if (existing.isEmpty()) {
            if (request.rowVersion() != null) {
                throw conflict();
            }
            cashReceipts.saveAndFlush(TaxCashReceipt.create(record.getId(), asOfDate(request.asOfDate(), year),
                    blankToNull(request.memo()), request.amounts(), records.nextRowVersion()));
        } else {
            TaxCashReceipt cash = existing.get();
            requireRowVersion(cash.getRowVersion(), request.rowVersion());
            cash.edit(asOfDate(request.asOfDate(), year), blankToNull(request.memo()),
                    request.amounts(), records.nextRowVersion());
            cashReceipts.saveAndFlush(cash);
        }
        return viewWithinTotalLimit(record);
    }

    /** 계획은 연도당 하나이며 입력자료나 세법이 없어도 저장한다. */
    @Transactional
    public TaxYearView savePlan(long userId, int year, PlanRequest request) {
        TaxYearRecord record = lockOwned(userId, year);
        Optional<TaxSpendingPlan> existing = plans.findById(record.getId());
        if (existing.isEmpty()) {
            if (request.rowVersion() != null) {
                throw conflict();
            }
            plans.saveAndFlush(TaxSpendingPlan.create(record.getId(), request, records.nextRowVersion()));
        } else {
            TaxSpendingPlan plan = existing.get();
            requireRowVersion(plan.getRowVersion(), request.rowVersion());
            plan.edit(request, records.nextRowVersion());
            plans.saveAndFlush(plan);
        }
        return view(record);
    }

    @Transactional
    public TaxYearView refreshLawVersion(long userId, int year) {
        TaxYearRecord record = lockOwned(userId, year);
        Long lawVersionId = laws.currentApplied(year).map(TaxLawVersion::getId).orElse(record.getLawVersionId());
        record.useLawVersion(lawVersionId, records.nextRowVersion());
        return view(records.saveAndFlush(record));
    }

    /** 읽기용. 요청자의 그 귀속연도 기록이 없으면 404다. 조회(이 클래스와 PR 4의 분석)가 쓴다. */
    public TaxYearRecord requireOwned(long userId, int year) {
        return records.findByOwnerIdAndTaxYear(userId, year).orElseThrow(TaxRecordService::notFound);
    }

    /** 쓰기용. 연도 기록 행을 잠근다. 딸린 자료의 쓰기도 이 잠금 뒤에서 하므로 한 연도의 쓰기는 차례로 실행된다. */
    TaxYearRecord lockOwned(long userId, int year) {
        return records.findOwnedForUpdate(userId, year).orElseThrow(TaxRecordService::notFound);
    }

    private TaxCardStatement requireCard(TaxYearRecord record, long cardId) {
        return cards.findByIdAndRecordId(cardId, record.getId()).orElseThrow(TaxRecordService::notFound);
    }

    private static String issuerName(String raw) {
        rejectNul(raw);
        String name = raw.strip();
        if (name.isEmpty() || name.length() > 50) {
            throw invalid("issuerName: 1~50자로 입력하세요");
        }
        return name;
    }

    private static LocalDate asOfDate(LocalDate date, int year) {
        if (date.getYear() != year) {
            throw invalid("asOfDate: 귀속연도 안의 날짜로 입력하세요");
        }
        return date;
    }

    private static String blankToNull(String value) {
        rejectNul(value);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static void rejectNul(String value) {
        if (value != null && value.indexOf('\0') >= 0) {
            throw invalid("issuerName/memo: NUL 문자는 사용할 수 없어요");
        }
    }

    private TaxYearView viewWithinTotalLimit(TaxYearRecord record) {
        TaxYearView view = view(record);
        if (view.totals().max() > TaxRecordDtos.MAX_AMOUNT) {
            throw invalid("amounts: 연도 합계가 9,999,999,999,999원을 넘어요");
        }
        return view;
    }

    private void requireCreatableYear(int year) {
        int thisYear = LocalDate.now(clock.withZone(KST)).getYear();
        if (year < thisYear - 1 || year > thisYear + 1) {
            throw invalid("year: 올해·전년도·다음 해만 만들 수 있어요");
        }
    }

    private TaxYearView view(TaxYearRecord record) {
        LawVersionRef lawVersion = record.getLawVersionId() == null ? null
                : lawVersions.findById(record.getLawVersionId()).map(TaxRecordService::toRef).orElse(null);
        Long currentLawVersionId = laws.currentApplied(record.getTaxYear()).map(TaxLawVersion::getId).orElse(null);
        PlanView plan = plans.findById(record.getId()).map(p -> new PlanView(p.getRowVersion(), p.general(),
                p.market(), p.transit(), p.culture())).orElse(null);
        List<TaxCardStatement> cardRows = cards.findByRecordIdOrderByIdAsc(record.getId());
        TaxCashReceipt cash = cashReceipts.findById(record.getId()).orElse(null);
        List<CardView> cardViews = cardRows.stream().map(c -> new CardView(c.getId(), c.getRowVersion(),
                c.getIssuerName(), c.getAsOfDate(), c.getMemo(), c.amounts(), c.blankCount())).toList();
        CashView cashView = cash == null ? null : new CashView(cash.getRowVersion(), cash.getAsOfDate(),
                cash.getMemo(), cash.amounts(), cash.blankCount());
        int blankCount = cardRows.stream().mapToInt(TaxCardStatement::blankCount).sum()
                + (cash == null ? 4 : cash.blankCount());
        long asOfDates = Stream.concat(cardRows.stream().map(TaxCardStatement::getAsOfDate),
                Stream.ofNullable(cash).map(TaxCashReceipt::getAsOfDate)).distinct().count();
        return new TaxYearView(record.getTaxYear(), record.getRowVersion(), record.getTotalSalary(),
                record.getWorkStartMonth(), record.getWorkEndMonth(), record.getChildCount(), lawVersion,
                !Objects.equals(record.getLawVersionId(), currentLawVersionId),
                cardViews, cashView, plan, SpendingTotals.of(cardRows, cash), blankCount,
                !cardRows.isEmpty() || cash != null, asOfDates > 1);
    }

    private static LawVersionRef toRef(TaxLawVersion version) {
        boolean childTiersApply = VersionResponse.of(version, null, null, null).childTiersApply();
        return new LawVersionRef(version.getId(), version.getVersionNo(), version.getAppliedAt(), childTiersApply);
    }

    /** 저장된 값과 요청의 rowVersion이 다르면(없는 것 포함) 다른 곳에서 먼저 바뀐 것이다. */
    static void requireRowVersion(long stored, Long requested) {
        if (requested == null || stored != requested) {
            throw conflict();
        }
    }

    static ApiException conflict() {
        return new ApiException(ErrorCode.CONFLICT, "tax record was modified elsewhere");
    }

    static ApiException invalid(String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message);
    }

    static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND, "tax record not found");
    }
}
