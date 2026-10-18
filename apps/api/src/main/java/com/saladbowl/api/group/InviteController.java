package com.saladbowl.api.group;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.group.InviteDtos.AcceptResponse;
import com.saladbowl.api.group.InviteDtos.InvitePreview;
import com.saladbowl.api.group.InviteDtos.InviteResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InviteController {

    private final InviteService inviteService;

    public InviteController(InviteService inviteService) {
        this.inviteService = inviteService;
    }

    @PostMapping("/groups/{groupId}/invites")
    public ResponseEntity<InviteResponse> issue(@CurrentUser Long userId, @PathVariable long groupId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inviteService.issue(groupId, userId));
    }

    @GetMapping("/invites/{token}")
    public InvitePreview preview(@CurrentUser Long userId, @PathVariable String token) {
        return inviteService.preview(token, userId);
    }

    @PostMapping("/invites/{token}/accept")
    public AcceptResponse accept(@CurrentUser Long userId, @PathVariable String token) {
        return inviteService.accept(token, userId);
    }
}
