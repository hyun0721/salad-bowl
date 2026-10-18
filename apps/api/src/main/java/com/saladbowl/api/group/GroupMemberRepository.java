package com.saladbowl.api.group;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

    Optional<GroupMember> findByGroupIdAndUserId(Long groupId, Long userId);

    List<GroupMember> findByUserIdOrderByJoinedAtAsc(Long userId);

    long countByGroupId(Long groupId);

    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    @Query("""
            select new com.saladbowl.api.group.MemberRow(m.userId, u.nickname, m.role, m.shareEnabled, m.joinedAt)
            from GroupMember m join User u on u.id = m.userId
            where m.groupId = :groupId
            order by m.joinedAt asc, m.id asc
            """)
    List<MemberRow> findMemberRows(@Param("groupId") Long groupId);
}
