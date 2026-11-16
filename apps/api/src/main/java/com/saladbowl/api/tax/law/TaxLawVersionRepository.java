package com.saladbowl.api.tax.law;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TaxLawVersionRepository extends JpaRepository<TaxLawVersion, Long> {

    List<TaxLawVersion> findByTaxYearOrderByVersionNoDesc(int taxYear);

    /** 현재 적용 버전: 번호와 무관하게 가장 최근에 적용한 것. 적용 시각이 같으면 나중에 만든 것. */
    Optional<TaxLawVersion> findFirstByTaxYearAndStatusOrderByAppliedAtDescIdDesc(int taxYear, TaxLawStatus status);

    /** 수정·삭제·적용이 같은 버전에서 겹칠 때 한 번에 하나만 상태를 보고 바꾸도록 행을 잠근다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from TaxLawVersion v where v.id = :id")
    Optional<TaxLawVersion> findByIdForUpdate(@Param("id") long id);
}
