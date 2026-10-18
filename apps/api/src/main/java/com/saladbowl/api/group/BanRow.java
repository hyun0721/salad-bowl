package com.saladbowl.api.group;

import java.time.OffsetDateTime;

/** 차단 목록의 한 행. 차단 기록과 회원 닉네임을 합친 조회 전용 값이다. */
public record BanRow(Long userId, String nickname, OffsetDateTime bannedAt) {
}
