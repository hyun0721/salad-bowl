package com.saladbowl.api.user;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import org.springframework.stereotype.Component;

/** 서비스 관리자 검사. 토큰에 권한을 넣지 않고 요청마다 DB를 읽으므로 회수하면 다음 요청부터 막힌다. */
@Component
public class ServiceAdminGuard {

    private final UserRepository users;

    public ServiceAdminGuard(UserRepository users) {
        this.users = users;
    }

    public void require(long userId) {
        if (!users.existsByIdAndServiceAdminTrue(userId)) {
            throw new ApiException(ErrorCode.FORBIDDEN, "service admin only");
        }
    }
}
