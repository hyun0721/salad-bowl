package com.saladbowl.api.transaction;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 회원별 가계부 쓰기 잠금. 업로드(DB 쓰기 구간)와 월 삭제가 다른 탭·기기에서 겹치지 않도록 차례로 실행한다.
 * Postgres 트랜잭션 범위 advisory lock이라 커밋·롤백 때 자동으로 풀린다.
 */
@Component
public class LedgerLock {

    /** advisory lock의 첫 번째 키. 다른 용도의 잠금과 섞이지 않도록 'LEDG'로 구분한다. */
    static final int NAMESPACE = 0x4C454447;

    private final EntityManager entityManager;

    public LedgerLock(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** 현재 DB 트랜잭션이 끝날 때까지 그 회원의 가계부 쓰기 잠금을 잡는다. 다른 트랜잭션이 쥐고 있으면 기다린다. */
    public void lockOwner(long ownerId) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("LedgerLock requires an active transaction");
        }
        entityManager.createNativeQuery("select pg_advisory_xact_lock(:namespace, :ownerId)")
                .setParameter("namespace", NAMESPACE)
                .setParameter("ownerId", Math.toIntExact(ownerId))
                .getSingleResult();
    }
}
