package com.saladbowl.api.transaction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface LedgerTransactionRepository extends JpaRepository<LedgerTransaction, Long> {

    List<LedgerTransaction> findByOwnerIdAndDedupKeyIn(Long ownerId, Collection<String> dedupKeys);

    long countByOwnerId(Long ownerId);

    /** 소유자 본인 화면용. 숨긴 거래도 포함한다. */
    @Query("""
            select t from LedgerTransaction t
            where t.ownerId = :ownerId and t.occurredAt >= :from and t.occurredAt < :to
            order by t.occurredAt desc, t.id desc
            """)
    List<LedgerTransaction> findOwnedBetween(@Param("ownerId") Long ownerId,
                                             @Param("from") LocalDateTime from,
                                             @Param("to") LocalDateTime to);

    /** 그룹 화면·요약용. 숨긴 거래는 빠진다. ownerIds가 비어 있으면 호출하지 않는다. */
    @Query("""
            select t from LedgerTransaction t
            where t.ownerId in :ownerIds and t.hidden = false
              and t.occurredAt >= :from and t.occurredAt < :to
            order by t.occurredAt desc, t.id desc
            """)
    List<LedgerTransaction> findVisibleBetween(@Param("ownerIds") Collection<Long> ownerIds,
                                               @Param("from") LocalDateTime from,
                                               @Param("to") LocalDateTime to);

    /**
     * 내 거래의 월별 출처별 건수(시작 포함, 끝 미포함 범위). import 거래가 있는 달만 돌려준다.
     * 결과 행은 [월(1~12), import 건수, 수동 건수]. 숨긴 거래도 센다.
     */
    @Query("""
            select extract(month from t.occurredAt),
                   sum(case when t.source = com.saladbowl.api.transaction.TransactionSource.IMPORT then 1 else 0 end),
                   sum(case when t.source = com.saladbowl.api.transaction.TransactionSource.MANUAL then 1 else 0 end)
            from LedgerTransaction t
            where t.ownerId = :ownerId
              and t.occurredAt >= :from and t.occurredAt < :to
            group by extract(month from t.occurredAt)
            having sum(case when t.source = com.saladbowl.api.transaction.TransactionSource.IMPORT then 1 else 0 end) > 0
            order by extract(month from t.occurredAt)
            """)
    List<Object[]> countByMonth(@Param("ownerId") Long ownerId,
                                @Param("from") LocalDateTime from,
                                @Param("to") LocalDateTime to);

    /** 내 거래 중 한 출처의 기간 거래를 지운다. 수정 이력은 DB FK(ON DELETE CASCADE)로 함께 지워진다. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from LedgerTransaction t
            where t.ownerId = :ownerId and t.source = :source
              and t.occurredAt >= :from and t.occurredAt < :to
            """)
    int deleteOwnedBetween(@Param("ownerId") Long ownerId,
                           @Param("source") TransactionSource source,
                           @Param("from") LocalDateTime from,
                           @Param("to") LocalDateTime to);

    /** 내 거래의 화면 표시 카테고리(override 우선)별 건수. 결과 행은 [대분류, 소분류, 건수]. 숨긴 거래도 센다. */
    @Query("""
            select coalesce(t.categoryMajorOverride, t.categoryMajor),
                   coalesce(t.categoryMinorOverride, t.categoryMinor),
                   count(t)
            from LedgerTransaction t
            where t.ownerId = :ownerId
            group by coalesce(t.categoryMajorOverride, t.categoryMajor),
                     coalesce(t.categoryMinorOverride, t.categoryMinor)
            """)
    List<Object[]> countDisplayCategories(@Param("ownerId") Long ownerId);
}
