import { useQuery } from '@tanstack/react-query'
import { errorMessage } from '../common/errorMessage'
import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import { groupsApi } from './groupsApi'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

export default function BanList({ groupId }: { groupId: number }) {
  const bans = useQuery({ queryKey: ['bans', groupId], queryFn: () => groupsApi.bans(groupId) })
  const { unban } = useGroupMutations()

  return (
    <section aria-labelledby="bans-title" className={ui.stack}>
      <h3 id="bans-title" className={styles.subTitle}>차단 목록</h3>
      <p className={ui.muted}>내보낸 사람은 초대 링크로 다시 합류할 수 없습니다. 차단을 해제하면 다시 초대할 수 있습니다.</p>
      {bans.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
      {bans.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>차단 목록을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void bans.refetch()}>차단 목록 다시 시도</button>
        </div>
      )}
      {bans.data?.length === 0 && <p className={ui.status}>차단한 사람이 없습니다.</p>}
      {bans.data && bans.data.length > 0 && (
        <ul className={styles.memberList}>
          {bans.data.map((b) => (
            <li key={b.userId} className={styles.member}>
              <span className={styles.memberName}>{b.nickname}</span>
              <span className={ui.muted}>{formatInstant(b.bannedAt)} 차단</span>
              <span className={styles.memberActions}>
                <button type="button" className={ui.button} disabled={unban.isPending}
                  aria-label={`${b.nickname} 차단 해제`}
                  onClick={() => unban.mutate({ groupId, userId: b.userId })}>차단 해제</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {unban.isError && <p role="alert" className={ui.alert}>{errorMessage(unban.error)}</p>}
    </section>
  )
}
