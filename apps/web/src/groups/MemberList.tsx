import ConfirmDialog from '../common/ConfirmDialog'
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
  return (
    <li className={styles.member}>
      <span className={styles.memberName}>{member.nickname}</span>
      <span className={ui.muted}>
        {member.role === 'ADMIN' ? '관리자' : '멤버'} · {member.shareEnabled ? '공개' : '비공개'} · {formatInstant(member.joinedAt)} 합류
      </span>
      {canRemove && (
        <span className={styles.memberActions}>
          <ConfirmDialog triggerLabel="내보내기" triggerAriaLabel={`${member.nickname} 내보내기`}
            title={`${member.nickname} 내보내기`} description="내보내면 차단되어 다시 합류할 수 없습니다."
            confirmLabel="내보내기 확인" confirmAriaLabel={`${member.nickname} 내보내기 확인`}
            isPending={removeMember.isPending} error={removeMember.isError ? errorMessage(removeMember.error) : null}
            onOpen={() => removeMember.reset()}
            onConfirm={(close) => removeMember.mutate({ groupId, userId: member.userId }, { onSuccess: close })} />
        </span>
      )}
    </li>
  )
}
