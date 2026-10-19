import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import ui from '../common/ui.module.css'
import BanList from './BanList'
import { LeaveGroup, RenameForm, ShareToggle } from './GroupSettings'
import { groupsApi } from './groupsApi'
import styles from './GroupsPage.module.css'
import InviteSection from './InviteSection'
import MemberList from './MemberList'

export default function GroupDetailSection({ groupId }: { groupId: number }) {
  const { me } = useAuth()
  const detail = useQuery({ queryKey: ['groups', groupId], queryFn: () => groupsApi.detail(groupId) })

  if (detail.isPending) {
    return <section className={ui.card}><p className={ui.status}>불러오는 중입니다.</p></section>
  }
  if (detail.isError) {
    return (
      <section className={ui.card}>
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>그룹 정보를 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void detail.refetch()}>그룹 정보 다시 시도</button>
        </div>
      </section>
    )
  }

  const group = detail.data
  const isAdmin = group.myRole === 'ADMIN'
  const mine = group.members.find((m) => m.userId === me?.userId)
  return (
    <section aria-labelledby="group-detail-title" className={`${ui.card} ${styles.detail}`}>
      <h2 id="group-detail-title">{group.name}</h2>
      {isAdmin && <RenameForm groupId={groupId} name={group.name} />}
      {mine && <ShareToggle groupId={groupId} enabled={mine.shareEnabled} />}
      <MemberList group={group} canRemove={isAdmin} />
      {isAdmin && <InviteSection groupId={groupId} memberCount={group.members.length} />}
      {isAdmin && <BanList groupId={groupId} />}
      {!isAdmin && <LeaveGroup groupId={groupId} name={group.name} />}
    </section>
  )
}
