package com.saladbowl.api.transaction;

import org.springframework.data.jpa.repository.JpaRepository;
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
}
