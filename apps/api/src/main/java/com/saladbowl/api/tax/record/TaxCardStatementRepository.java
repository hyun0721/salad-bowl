package com.saladbowl.api.tax.record;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** 카드 자료는 항상 소유한 연도 기록의 id와 함께 읽는다. id만으로 읽는 메서드(findById 등)를 서비스에서 쓰지 않는다. */
public interface TaxCardStatementRepository extends JpaRepository<TaxCardStatement, Long> {

    List<TaxCardStatement> findByRecordIdOrderByIdAsc(long recordId);

    Optional<TaxCardStatement> findByIdAndRecordId(long id, long recordId);

    long countByRecordId(long recordId);
}
