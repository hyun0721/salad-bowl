package com.saladbowl.api.group;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** 동시에 들어오는 초대 수락이 6명 정원을 넘지 못하는지 실제 트랜잭션과 행 잠금으로 확인한다. */
class ConcurrentAcceptTest extends IntegrationTest {

    private static final int ROUNDS = 3;
    private static final int GUESTS = 9;

    @Autowired
    UserRepository users;
    @Autowired
    GroupService groupService;
    @Autowired
    InviteService inviteService;
    @Autowired
    GroupMemberRepository members;

    @Test
    void concurrentAcceptsNeverExceedSixMembers() throws Exception {
        for (int round = 0; round < ROUNDS; round++) {
            User admin = users.save(new User("admin" + round + "@test.com", "hash", "관리자"));
            long groupId = groupService.create(admin.getId(), "group" + round).groupId();
            String token = inviteService.issue(groupId, admin.getId()).token();
            List<Long> guestIds = new ArrayList<>();
            for (int i = 0; i < GUESTS; i++) {
                guestIds.add(users.save(new User("guest" + round + "_" + i + "@test.com", "hash", "손님")).getId());
            }

            Map<String, Integer> tally = acceptConcurrently(token, guestIds);

            assertThat(members.countByGroupId(groupId)).as("round %d members", round).isEqualTo(6);
            assertThat(tally).as("round %d tally", round)
                    .containsOnlyKeys("OK", "GROUP_FULL")
                    .containsEntry("OK", 5)
                    .containsEntry("GROUP_FULL", 4);
        }
    }

    private Map<String, Integer> acceptConcurrently(String token, List<Long> guestIds) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(guestIds.size());
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<String>> results = new ArrayList<>();
            for (long guestId : guestIds) {
                results.add(pool.submit(() -> {
                    if (!start.await(30, TimeUnit.SECONDS)) {
                        return "NOT_STARTED";
                    }
                    try {
                        inviteService.accept(token, guestId);
                        return "OK";
                    } catch (ApiException e) {
                        return e.code().name();
                    } catch (Exception e) {
                        return e.getClass().getName();
                    }
                }));
            }
            start.countDown();
            Map<String, Integer> tally = new TreeMap<>();
            for (Future<String> result : results) {
                tally.merge(result.get(30, TimeUnit.SECONDS), 1, Integer::sum);
            }
            return tally;
        } finally {
            pool.shutdownNow();
        }
    }
}
