package com.saladbowl.api.transaction;

import com.saladbowl.api.transaction.TransactionDtos.TransactionView;

import java.util.List;

/** 조회 결과에 적용하는 화면 필터·정렬. 비어 있는 목록은 그 항목을 거르지 않는다. */
public record TransactionQuery(List<String> majors, List<String> minors, List<TransactionType> types,
                               TransactionSort sort) {

    public TransactionQuery {
        majors = majors == null ? List.of() : List.copyOf(majors);
        minors = minors == null ? List.of() : List.copyOf(minors);
        types = types == null ? List.of() : List.copyOf(types);
        sort = sort == null ? TransactionSort.DATE_DESC : sort;
    }

    public List<TransactionView> apply(List<TransactionView> views) {
        return views.stream()
                .filter(tx -> majors.isEmpty() || majors.contains(tx.categoryMajor()))
                .filter(tx -> minors.isEmpty() || minors.contains(tx.categoryMinor()))
                .filter(tx -> types.isEmpty() || types.contains(tx.type()))
                .sorted(sort.comparator())
                .toList();
    }
}
