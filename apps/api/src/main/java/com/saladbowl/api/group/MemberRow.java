package com.saladbowl.api.group;

import java.time.OffsetDateTime;

/** 그룹 멤버 목록의 한 행. 멤버십과 회원 닉네임을 합친 조회 전용 값이다. */
public record MemberRow(Long userId, String nickname, GroupRole role, boolean shareEnabled, OffsetDateTime joinedAt) {
}
