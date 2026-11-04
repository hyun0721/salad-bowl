package com.saladbowl.api.transaction;

import com.saladbowl.api.transaction.TransactionDtos.TransactionView;

import java.util.List;

/** 조회 결과에 적용하는 화면 필터·정렬. 비어 있는 목록은 그 항목을 거르지 않는다. */
public record TransactionQuery(List<Exclude> excludes, List<TransactionType> types, TransactionSort sort) {

    public record Exclude(TransactionType type, String major, String minor) {
    }

    public TransactionQuery {
        excludes = excludes == null ? List.of() : List.copyOf(excludes);
        types = types == null ? List.of() : List.copyOf(types);
        sort = sort == null ? TransactionSort.DATE_DESC : sort;
    }

    public List<TransactionView> apply(List<TransactionView> views) {
        return views.stream()
                .filter(tx -> types.isEmpty() || types.contains(tx.type()))
                .filter(tx -> excludes.stream().noneMatch(exclude -> exclude.type() == tx.type()
                        && exclude.major().equals(tx.categoryMajor())
                        && (exclude.minor() == null || exclude.minor().equals(tx.categoryMinor()))))
                .sorted(sort.comparator())
                .toList();
    }
}
