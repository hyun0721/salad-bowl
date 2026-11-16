package com.saladbowl.api.tax.record;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/** 연도 기록은 항상 소유 회원 조건으로 읽는다. id만으로 읽는 메서드(findById 등)를 서비스에서 쓰지 않는다. */
public interface TaxYearRecordRepository extends JpaRepository<TaxYearRecord, Long> {

    @Query(value = "SELECT nextval('tax_row_version_seq')", nativeQuery = true)
    long nextRowVersion();

    Optional<TaxYearRecord> findByOwnerIdAndTaxYear(long ownerId, int taxYear);

    /** 연도 기록과 딸린 자료의 쓰기를 한 번에 하나만 실행하도록 연도 기록 행을 잠근다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from TaxYearRecord r where r.ownerId = :ownerId and r.taxYear = :taxYear")
    Optional<TaxYearRecord> findOwnedForUpdate(@Param("ownerId") long ownerId, @Param("taxYear") int taxYear);
}
