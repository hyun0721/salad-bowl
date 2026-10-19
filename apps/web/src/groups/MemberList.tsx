import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../common/errorMessage'
import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import type { GroupDetail, GroupMember } from './groupsApi'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

type Props = { group: GroupDetail; canRemove: boolean }

export default function MemberList({ group, canRemove }: Props) {
  return (
    <section aria-labelledby="members-title" className={ui.stack}>
      <h3 id="members-title" className={styles.subTitle}>멤버 ({group.members.length}/6)</h3>
      <ul className={styles.memberList}>
        {group.members.map((m) => (
          <MemberRow key={m.userId} groupId={group.groupId} member={m} canRemove={canRemove && m.role !== 'ADMIN'} />
        ))}
      </ul>
    </section>
  )
}

function MemberRow({ groupId, member, canRemove }: { groupId: number; member: GroupMember; canRemove: boolean }) {
  const { removeMember } = useGroupMutations()
  const [confirming, setConfirming] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const focusNext = useRef<'cancel' | 'trigger' | null>(null)
  // 누른 버튼이 사라져도 포커스가 body로 떨어지지 않도록, 확인 단계가 열리면 취소로, 취소하면 원래 버튼으로 옮긴다.
  useEffect(() => {
    if (focusNext.current === 'cancel') cancel.current?.focus()
    else if (focusNext.current === 'trigger') trigger.current?.focus()
    focusNext.current = null
  }, [confirming])
  function toggleConfirm(open: boolean) {
    focusNext.current = open ? 'cancel' : 'trigger'
    setConfirming(open)
  }
  return (
    <li className={styles.member}>
      <span className={styles.memberName}>{member.nickname}</span>
      <span className={ui.muted}>
        {member.role === 'ADMIN' ? '관리자' : '멤버'} · {member.shareEnabled ? '공개' : '비공개'} · {formatInstant(member.joinedAt)} 합류
      </span>
      {canRemove && (
        <span className={styles.memberActions}>
          {confirming ? (
            <>
              <span className={ui.muted}>내보내면 차단되어 다시 합류할 수 없습니다.</span>
              <button type="button" className={`${ui.button} ${ui.danger}`} disabled={removeMember.isPending}
                aria-label={`${member.nickname} 내보내기 확인`}
                onClick={() => removeMember.mutate({ groupId, userId: member.userId })}>내보내기 확인</button>
              <button ref={cancel} type="button" className={ui.button} onClick={() => toggleConfirm(false)}>취소</button>
            </>
          ) : (
            <button ref={trigger} type="button" className={`${ui.button} ${ui.danger}`} aria-label={`${member.nickname} 내보내기`}
              onClick={() => toggleConfirm(true)}>내보내기</button>
          )}
        </span>
      )}
      {removeMember.isError && <p role="alert" className={ui.alert}>{errorMessage(removeMember.error)}</p>}
    </li>
  )
}
