package com.saladbowl.api.tax.law;

import com.saladbowl.api.tax.law.TaxLawDtos.FieldError;

import java.util.ArrayList;
import java.util.List;

/** 적용 전 검증(TAX-63, TAX-64). 필드 이름은 응답(VersionResponse)의 이름과 같다. 메모는 선택이라 보지 않는다. */
final class TaxLawValidator {

    private static final String REQUIRED = "값을 입력해야 합니다";

    private TaxLawValidator() {
    }

    static List<FieldError> validate(TaxLawVersion v) {
        List<FieldError> errors = new ArrayList<>();
        percent(errors, "minSpendRatePct", v.getMinSpendRatePct());
        percent(errors, "rateCreditPct", v.getRateCreditPct());
        percent(errors, "rateDebitCashPct", v.getRateDebitCashPct());
        percent(errors, "rateCulturePct", v.getRateCulturePct());
        percent(errors, "rateMarketPct", v.getRateMarketPct());
        percent(errors, "rateTransitPct", v.getRateTransitPct());
        amount(errors, "bracketBoundary", v.getBracketBoundary());
        amount(errors, "basicLimitLow[0]", v.getBasicLimitLow0());
        amount(errors, "basicLimitLow[1]", v.getBasicLimitLow1());
        amount(errors, "basicLimitLow[2]", v.getBasicLimitLow2());
        amount(errors, "basicLimitHigh[0]", v.getBasicLimitHigh0());
        amount(errors, "basicLimitHigh[1]", v.getBasicLimitHigh1());
        amount(errors, "basicLimitHigh[2]", v.getBasicLimitHigh2());
        amount(errors, "extraLimitLow", v.getExtraLimitLow());
        amount(errors, "extraLimitHigh", v.getExtraLimitHigh());
        required(errors, "basisLawName", v.getBasisLawName());
        required(errors, "basisArticle", v.getBasisArticle());
        if (required(errors, "basisUrl", v.getBasisUrl()) && !v.getBasisUrl().matches("(?i)https?://.+")) {
            // 화면이 링크로 그리는 값이다. javascript: 같은 주소를 막는다.
            errors.add(new FieldError("basisUrl", "http:// 또는 https://로 시작해야 합니다"));
        }
        boolean hasStart = required(errors, "periodStart", v.getPeriodStart());
        boolean hasEnd = required(errors, "periodEnd", v.getPeriodEnd());
        if (hasStart && hasEnd && v.getPeriodStart().isAfter(v.getPeriodEnd())) {
            errors.add(new FieldError("periodEnd", "종료일이 시작일보다 빠릅니다"));
        }
        return errors;
    }

    private static void percent(List<FieldError> errors, String field, Integer value) {
        if (required(errors, field, value) && (value < 0 || value > 100)) {
            errors.add(new FieldError(field, "0~100 사이여야 합니다"));
        }
    }

    private static void amount(List<FieldError> errors, String field, Long value) {
        if (required(errors, field, value)) {
            if (value < 0) {
                errors.add(new FieldError(field, "0 이상이어야 합니다"));
            } else if (value > 9_999_999_999_999L) {
                errors.add(new FieldError(field, "9,999,999,999,999원 이하로 입력하세요"));
            }
        }
    }

    /** 값이 있으면 true. 없으면 오류를 더하고 false. */
    private static boolean required(List<FieldError> errors, String field, Object value) {
        if (value == null || (value instanceof String text && text.isBlank())) {
            errors.add(new FieldError(field, REQUIRED));
            return false;
        }
        return true;
    }
}
