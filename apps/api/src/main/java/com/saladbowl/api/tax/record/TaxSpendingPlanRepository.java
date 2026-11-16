package com.saladbowl.api.tax.record;

import org.springframework.data.jpa.repository.JpaRepository;

/** 기본 키가 연도 기록 id다. 소유한 연도 기록을 먼저 찾고 그 id로 읽는다. */
public interface TaxSpendingPlanRepository extends JpaRepository<TaxSpendingPlan, Long> {
}
