package com.saladbowl.api.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    // 조회 후 저장이면 동시 로그아웃에서 증가가 유실되므로 DB에서 원자적으로 올린다. ver가 안 맞으면 0행이다.
    @Modifying
    @Query("update User u set u.tokenVersion = u.tokenVersion + 1 where u.id = :id and u.tokenVersion = :ver")
    int bumpTokenVersion(@Param("id") long id, @Param("ver") int ver);
}
