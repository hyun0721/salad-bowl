package com.saladbowl.api.group;

import java.time.OffsetDateTime;

public final class InviteDtos {

    private InviteDtos() {
    }

    public record InviteResponse(String token, OffsetDateTime expiresAt) {
    }

    public record InvitePreview(String groupName, long memberCount, int maxMembers, OffsetDateTime expiresAt,
                                boolean alreadyMember) {
    }

    public record AcceptResponse(long groupId) {
    }
}
