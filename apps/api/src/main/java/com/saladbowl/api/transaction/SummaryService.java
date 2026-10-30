package com.saladbowl.api.transaction;

import com.saladbowl.api.group.GroupAccess;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.transaction.SummaryDtos.CategoryTotal;
import com.saladbowl.api.transaction.SummaryDtos.CategoryTrend;
import com.saladbowl.api.transaction.SummaryDtos.CategoryTrendSeries;
import com.saladbowl.api.transaction.SummaryDtos.MemberTotal;
import com.saladbowl.api.transaction.SummaryDtos.MonthlySummary;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 그룹 월간 요약: KRW만, 이체·숨긴 거래 제외, 지출은 양수 합계(환불은 차감). */
@Service
public class SummaryService {

    static final String SUMMARY_CURRENCY = "KRW";
    static final String UNCATEGORIZED = "미분류";
    static final int MAX_TREND_MONTHS = 12;

    private final LedgerTransactionRepository transactions;
    private final GroupAccess access;
    private final UserRepository users;
    private final TransactionViews views;

    public SummaryService(LedgerTransactionRepository transactions, GroupAccess access, UserRepository users,
                          TransactionViews views) {
        this.transactions = transactions;
        this.access = access;
        this.users = users;
        this.views = views;
    }

    /** 요약에 들어가는 그룹 거래. 합계와 거래 목록이 어긋나지 않도록 한 곳에서만 고른다. */
    private List<LedgerTransaction> summaryTransactions(List<Long> owners, YearMonth month) {
        return summaryTransactions(owners, month, month);
    }

    /** from~to(양끝 포함) 기간. 월 경계는 monthRange와 같아 월 하나일 때 결과가 같다. */
    private List<LedgerTransaction> summaryTransactions(List<Long> owners, YearMonth from, YearMonth to) {
        if (owners.isEmpty()) {
            return List.of();
        }
        LocalDateTime start = TransactionService.monthRange(from).from();
        LocalDateTime end = TransactionService.monthRange(to).to();
        return transactions.findVisibleBetween(owners, start, end).stream()
                .filter(tx -> SUMMARY_CURRENCY.equals(tx.getCurrency()))
                .filter(tx -> tx.getType() != TransactionType.TRANSFER)
                .toList();
    }

    /** 대분류가 비었으면 한 묶음으로 보이도록 "미분류"로 센다. 공백 제거는 하지 않는다(기존 집계 키 유지). */
    static String majorLabel(LedgerTransaction tx) {
        String major = tx.displayCategory().major();
        return major == null || major.isBlank() ? UNCATEGORIZED : major;
    }

    /** 집계와 거래 목록에서 빈 소분류를 같은 키로 취급한다. */
    static String minorLabel(LedgerTransaction tx) {
        String minor = tx.displayCategory().minor();
        return minor == null || minor.isBlank() ? UNCATEGORIZED : minor;
    }

    @Transactional(readOnly = true)
    public MonthlySummary monthly(long groupId, long userId, YearMonth month) {
        access.requireMember(groupId, userId);
        List<Long> owners = access.sharedOwnerIds(groupId);
        List<LedgerTransaction> txs = summaryTransactions(owners, month);

        BigDecimal income = sum(txs, TransactionType.INCOME);
        BigDecimal expense = sum(txs, TransactionType.EXPENSE).negate();

        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        for (LedgerTransaction tx : txs) {
            if (tx.getType() == TransactionType.EXPENSE) {
                byCategory.merge(majorLabel(tx), tx.getAmount().negate(), BigDecimal::add);
            }
        }
        List<CategoryTotal> categories = byCategory.entrySet().stream()
                .map(e -> new CategoryTotal(e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(CategoryTotal::expense).reversed()
                        .thenComparing(CategoryTotal::category))
                .toList();

        Map<Long, String> nicknames = users.findAllById(owners).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));
        List<MemberTotal> members = owners.stream()
                .map(ownerId -> {
                    List<LedgerTransaction> own = txs.stream().filter(t -> t.getOwnerId().equals(ownerId)).toList();
                    return new MemberTotal(ownerId, nicknames.get(ownerId),
                            sum(own, TransactionType.INCOME), sum(own, TransactionType.EXPENSE).negate());
                })
                .toList();

        return new MonthlySummary(month.toString(), income, expense, categories, members);
    }

    /** 월별 대분류 지출. 각 월 값은 그 달 monthly()의 byCategory와 같은 선별·키를 쓴다. */
    @Transactional(readOnly = true)
    public CategoryTrend trend(long groupId, long userId, YearMonth from, YearMonth to) {
        access.requireMember(groupId, userId);
        requireRange(from, to);
        List<YearMonth> months = new ArrayList<>();
        for (YearMonth m = from; !m.isAfter(to); m = m.plusMonths(1)) {
            months.add(m);
        }
        Map<String, BigDecimal[]> byCategory = new HashMap<>();
        for (LedgerTransaction tx : summaryTransactions(access.sharedOwnerIds(groupId), from, to)) {
            if (tx.getType() != TransactionType.EXPENSE) {
                continue;
            }
            BigDecimal[] row = byCategory.computeIfAbsent(majorLabel(tx), k -> zeros(months.size()));
            int i = months.indexOf(YearMonth.from(tx.getOccurredAt()));
            row[i] = row[i].add(tx.getAmount().negate());
        }
        List<CategoryTrendSeries> categories = byCategory.entrySet().stream()
                .map(e -> new CategoryTrendSeries(e.getKey(), List.of(e.getValue()),
                        java.util.Arrays.stream(e.getValue()).reduce(BigDecimal.ZERO, BigDecimal::add)))
                .sorted(Comparator.comparing(CategoryTrendSeries::total).reversed()
                        .thenComparing(CategoryTrendSeries::category))
                .toList();
        return new CategoryTrend(months.stream().map(YearMonth::toString).toList(), categories);
    }

    /** trend와 subcategories가 같은 기간 규칙을 쓴다. 연도 범위를 먼저 보고, 12개월 검사는 넘침 없는 월 차이로 한다. */
    private static void requireRange(YearMonth from, YearMonth to) {
        TransactionService.monthRange(from);
        TransactionService.monthRange(to);
        if (from.isAfter(to) || from.until(to, java.time.temporal.ChronoUnit.MONTHS) >= MAX_TREND_MONTHS) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "from must not be after to, and the range is at most " + MAX_TREND_MONTHS + " months");
        }
    }

    private static BigDecimal[] zeros(int n) {
        BigDecimal[] row = new BigDecimal[n];
        java.util.Arrays.fill(row, BigDecimal.ZERO);
        return row;
    }

    /** 요약의 대분류(선택 시 소분류) 조각을 이루는 거래. 환불도 넣어야 합계가 같다. */
    @Transactional(readOnly = true)
    public List<TransactionView> categoryTransactions(long groupId, long userId, YearMonth month, String category,
                                                      String minor) {
        access.requireMember(groupId, userId);
        List<LedgerTransaction> matched = summaryTransactions(access.sharedOwnerIds(groupId), month).stream()
                .filter(tx -> tx.getType() == TransactionType.EXPENSE)
                .filter(tx -> majorLabel(tx).equals(category))
                .filter(tx -> minor == null || minorLabel(tx).equals(minor))
                .toList();
        Map<Long, Boolean> editable = new HashMap<>();
        return views.toViews(matched,
                owner -> editable.computeIfAbsent(owner, id -> access.canEditOwnedBy(userId, id)));
    }

    /** from(없으면 month - 5)~month의 소분류별 순지출. 거래가 없는 월은 화면에서 0으로 채운다. */
    @Transactional(readOnly = true)
    public List<SummaryDtos.SubcategoryMonth> subcategories(long groupId, long userId, YearMonth month,
                                                            YearMonth from) {
        access.requireMember(groupId, userId);
        if (from == null) {
            // 기본 6개월은 검사 전에 month - 5를 계산하므로 month의 연도 범위를 먼저 본다.
            TransactionService.monthRange(month);
            from = month.minusMonths(5);
        }
        requireRange(from, month);
        List<Long> owners = access.sharedOwnerIds(groupId);
        if (owners.isEmpty()) return List.of();
        record Key(String month, String major, String minor) {}
        Map<Key, BigDecimal> totals = new LinkedHashMap<>();
        for (LedgerTransaction tx : summaryTransactions(owners, from, month)) {
            if (tx.getType() != TransactionType.EXPENSE) continue;
            Key key = new Key(YearMonth.from(tx.getOccurredAt()).toString(), majorLabel(tx), minorLabel(tx));
            totals.merge(key, tx.getAmount().negate(), BigDecimal::add);
        }
        return totals.entrySet().stream()
                .map(e -> new SummaryDtos.SubcategoryMonth(
                        e.getKey().month(), e.getKey().major(), e.getKey().minor(), e.getValue()))
                .sorted(Comparator.comparing(SummaryDtos.SubcategoryMonth::month)
                        .thenComparing(SummaryDtos.SubcategoryMonth::major)
                        .thenComparing(SummaryDtos.SubcategoryMonth::minor))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SummaryDtos.MemberCategoryExpense> memberCategories(long groupId, long userId, YearMonth month) {
        access.requireMember(groupId, userId);
        TransactionService.monthRange(month);
        List<Long> owners = access.sharedOwnerIds(groupId);
        if (owners.isEmpty()) return List.of();
        record Key(String major, String minor, long userId) {}
        Map<Key, BigDecimal> totals = new HashMap<>();
        for (LedgerTransaction tx : summaryTransactions(owners, month)) {
            if (tx.getType() != TransactionType.EXPENSE) continue;
            totals.merge(new Key(majorLabel(tx), minorLabel(tx), tx.getOwnerId()),
                    tx.getAmount().negate(), BigDecimal::add);
        }
        return totals.entrySet().stream()
                .map(e -> new SummaryDtos.MemberCategoryExpense(
                        e.getKey().major(), e.getKey().minor(), e.getKey().userId(), e.getValue()))
                .sorted(Comparator.comparing(SummaryDtos.MemberCategoryExpense::major)
                        .thenComparing(SummaryDtos.MemberCategoryExpense::minor)
                        .thenComparingLong(SummaryDtos.MemberCategoryExpense::userId))
                .toList();
    }

    private static BigDecimal sum(List<LedgerTransaction> txs, TransactionType type) {
        return txs.stream()
                .filter(tx -> tx.getType() == type)
                .map(LedgerTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
