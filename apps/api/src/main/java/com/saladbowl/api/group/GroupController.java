package com.saladbowl.api.group;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.group.GroupDtos.GroupDetail;
import com.saladbowl.api.group.GroupDtos.GroupNameRequest;
import com.saladbowl.api.group.GroupDtos.GroupSummary;
import com.saladbowl.api.group.GroupDtos.ShareRequest;
import com.saladbowl.api.group.GroupDtos.ShareResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @PostMapping
    public ResponseEntity<GroupSummary> create(@CurrentUser Long userId,
                                               @Valid @RequestBody GroupNameRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(groupService.create(userId, request.name()));
    }

    @GetMapping
    public List<GroupSummary> list(@CurrentUser Long userId) {
        return groupService.listMine(userId);
    }

    @GetMapping("/{groupId}")
    public GroupDetail detail(@CurrentUser Long userId, @PathVariable long groupId) {
        return groupService.detail(groupId, userId);
    }

    @PatchMapping("/{groupId}")
    public GroupDetail rename(@CurrentUser Long userId, @PathVariable long groupId,
                              @Valid @RequestBody GroupNameRequest request) {
        return groupService.rename(groupId, userId, request.name());
    }

    @DeleteMapping("/{groupId}/members/me")
    public ResponseEntity<Void> leave(@CurrentUser Long userId, @PathVariable long groupId) {
        groupService.leave(groupId, userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{groupId}/members/{memberUserId}")
    public ResponseEntity<Void> removeMember(@CurrentUser Long userId, @PathVariable long groupId,
                                             @PathVariable long memberUserId) {
        groupService.removeMember(groupId, userId, memberUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/bans")
    public List<BanRow> listBans(@CurrentUser Long userId, @PathVariable long groupId) {
        return groupService.listBans(groupId, userId);
    }

    @DeleteMapping("/{groupId}/bans/{bannedUserId}")
    public ResponseEntity<Void> unban(@CurrentUser Long userId, @PathVariable long groupId,
                                      @PathVariable long bannedUserId) {
        groupService.unban(groupId, userId, bannedUserId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{groupId}/share")
    public ShareResponse setShare(@CurrentUser Long userId, @PathVariable long groupId,
                                  @Valid @RequestBody ShareRequest request) {
        return groupService.setShare(groupId, userId, request.enabled());
    }
}
