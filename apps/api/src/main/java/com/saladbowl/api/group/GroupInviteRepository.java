package com.saladbowl.api.group;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupInviteRepository extends JpaRepository<GroupInvite, Long> {

    Optional<GroupInvite> findByToken(String token);
}
