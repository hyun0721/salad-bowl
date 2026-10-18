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

    @Query("""
            select m.userId from GroupMember m
            where m.groupId = :groupId and m.shareEnabled = true
            order by m.joinedAt asc, m.id asc
            """)
    List<Long> findSharedUserIds(@Param("groupId") Long groupId);

    @Query("""
            select case when count(a) > 0 then true else false end
            from GroupMember a, GroupMember o
            where a.groupId = o.groupId
              and a.userId = :actorId and a.role = com.saladbowl.api.group.GroupRole.ADMIN
              and o.userId = :ownerId and o.shareEnabled = true
            """)
    boolean existsAdminOverSharedMember(@Param("actorId") Long actorId, @Param("ownerId") Long ownerId);

    @Query("""
            select case when count(v) > 0 then true else false end
            from GroupMember v, GroupMember o
            where v.groupId = o.groupId
              and v.userId = :viewerId
              and o.userId = :ownerId and o.shareEnabled = true
            """)
    boolean existsSharedWith(@Param("viewerId") Long viewerId, @Param("ownerId") Long ownerId);
}
