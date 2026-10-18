package com.saladbowl.api.group;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GroupBanRepository extends JpaRepository<GroupBan, Long> {

    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    Optional<GroupBan> findByGroupIdAndUserId(Long groupId, Long userId);

    @Query("""
            select new com.saladbowl.api.group.BanRow(b.userId, u.nickname, b.bannedAt)
            from GroupBan b join User u on u.id = b.userId
            where b.groupId = :groupId
            order by b.bannedAt asc, b.id asc
            """)
    List<BanRow> findBanRows(@Param("groupId") Long groupId);
}
