package com.saladbowl.api.group;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.group.GroupDtos.GroupDetail;
import com.saladbowl.api.group.GroupDtos.GroupNameRequest;
import com.saladbowl.api.group.GroupDtos.GroupSummary;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
}
