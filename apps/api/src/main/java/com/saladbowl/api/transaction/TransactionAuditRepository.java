package com.saladbowl.api.transaction;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransactionAuditRepository extends JpaRepository<TransactionAudit, Long> {

    List<TransactionAudit> findByTransactionIdOrderByChangedAtAscIdAsc(Long transactionId);
}
