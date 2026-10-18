package com.saladbowl.api.user;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeController {

    public record MeResponse(long userId, String email, String nickname) {
    }

    private final UserRepository users;

    public MeController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/me")
    public MeResponse me(@CurrentUser Long userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "user not found"));
        return new MeResponse(user.getId(), user.getEmail(), user.getNickname());
    }
}
