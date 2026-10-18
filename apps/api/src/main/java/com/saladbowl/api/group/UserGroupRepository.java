package com.saladbowl.api.group;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserGroupRepository extends JpaRepository<UserGroup, Long> {

    /** 초대 수락처럼 정원을 검사하고 멤버를 추가하는 동안 같은 그룹의 동시 수락을 직렬화한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from UserGroup g where g.id = :id")
    Optional<UserGroup> findByIdForUpdate(@Param("id") Long id);
}
