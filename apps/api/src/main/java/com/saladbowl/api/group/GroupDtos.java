package com.saladbowl.api.group;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class GroupDtos {

    private GroupDtos() {
    }

    public record GroupNameRequest(@NotBlank @Size(max = 50) String name) {
    }

    public record GroupSummary(long groupId, String name, GroupRole myRole, long memberCount) {
    }

    public record GroupDetail(long groupId, String name, GroupRole myRole, List<MemberRow> members) {
    }

    public record ShareRequest(@NotNull Boolean enabled) {
    }

    public record ShareResponse(boolean shareEnabled) {
    }
}
