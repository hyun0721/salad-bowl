package com.saladbowl.api.transaction;

import java.math.BigDecimal;
import java.util.List;

public final class SummaryDtos {

    private SummaryDtos() {
    }

    /** month는 yyyy-MM. 금액은 KRW이고 지출은 양수로 표시한다. */
    public record MonthlySummary(String month, BigDecimal income, BigDecimal expense,
                                 List<CategoryTotal> byCategory, List<MemberTotal> byMember) {
    }

    public record CategoryTotal(String category, BigDecimal expense) {
    }

    public record MemberTotal(long userId, String nickname, BigDecimal income, BigDecimal expense) {
    }
}
