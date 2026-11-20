package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.TaxAnalysisView.Status;
import com.saladbowl.api.tax.law.TaxLawVersionRepository;
import com.saladbowl.api.tax.record.TaxRecordDtos.CardView;
import com.saladbowl.api.tax.record.TaxRecordDtos.CashView;
import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
import com.saladbowl.api.tax.record.TaxRecordService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;

/**
 * 분석 조회. 회원 자료는 TaxRecordService.get(요청자, 귀속연도)으로만 읽으므로 남의 연도와 없는 연도는 같은 404다.
 * 아무것도 저장하지 않는다.
 */
@Service
public class TaxAnalysisService {

    private final TaxRecordService records;
    private final TaxLawVersionRepository lawVersions;

    public TaxAnalysisService(TaxRecordService records, TaxLawVersionRepository lawVersions) {
        this.records = records;
        this.lawVersions = lawVersions;
    }

    @Transactional(readOnly = true)
    public TaxAnalysisView get(long userId, int year) {
        TaxYearView view = records.get(userId, year);
        Status status = !view.hasInputs() ? Status.NO_INPUT
                : view.blankCount() > 0 ? Status.INCOMPLETE
                : view.lawVersion() == null ? Status.LAW_PENDING
                : Status.READY;

        DeductionResult deduction = null;
        Recommendation recommendation = null;
        TaxAnalysisView.LawRates lawRates = null;
        if (status == Status.READY) {
            // 현재 적용 버전이 아니라 연도 기록이 기억한 버전으로 계산한다(TAX-66).
            TaxLawValues law = TaxLawValues.from(lawVersions.findById(view.lawVersion().id()).orElseThrow());
            lawRates = TaxAnalysisView.LawRates.from(law);
            deduction = DeductionCalculator.calculate(view.totalSalary(), view.childCount(), view.totals(), law);
            if (view.plan() != null) {
                recommendation = Recommender.recommend(view.totalSalary(), view.childCount(), view.totals(),
                        view.plan(), law);
            }
        }
        List<LocalDate> asOfDates = Stream.concat(view.cards().stream().map(CardView::asOfDate),
                Stream.ofNullable(view.cashReceipt()).map(CashView::asOfDate)).sorted().toList();
        return new TaxAnalysisView(view.taxYear(), status, view.blankCount(), view.totals(), view.totalSalary(),
                view.asOfDateMismatch(),
                asOfDates.isEmpty() ? null : asOfDates.getFirst(),
                asOfDates.isEmpty() ? null : asOfDates.getLast(),
                view.workStartMonth() != 1 || view.workEndMonth() != 12,
                view.lawVersion(), lawRates, view.newerLawVersion(), view.plan() != null, deduction, recommendation);
    }
}
