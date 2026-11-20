package com.saladbowl.api.tax.calc;

/** 소비구분 4개마다 하나씩 있는 값. */
public record ByCategory<T>(T general, T market, T transit, T culture) {

    public T get(SpendingCategory category) {
        return switch (category) {
            case GENERAL -> general;
            case MARKET -> market;
            case TRANSIT -> transit;
            case CULTURE -> culture;
        };
    }
}
