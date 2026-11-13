import { useIsMutating } from '@tanstack/react-query'
import { useState } from 'react'
import { menuLabel } from '../app/menu'
import Icon from '../common/Icon'
import Dialog from '../common/Dialog'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import PageHeader from '../common/PageHeader'
import Skeleton, { SkeletonRegion } from '../common/Skeleton'
import ui from '../common/ui.module.css'
import { usePageTitle } from '../common/usePageTitle'
import CreateGroupForm from './CreateGroupForm'
import GroupDetailSection from './GroupDetailSection'
import { useGroups } from './GroupProvider'
import styles from './GroupsPage.module.css'

export default function GroupsPage() {
  const narrow = useMediaQuery(NARROW)
  const title = menuLabel('/groups')
  usePageTitle(title)
  const { groups, selectedGroupId, selectGroup, isLoading, isError, retry } = useGroups()
  const [creating, setCreating] = useState(false)
  const createPending = useIsMutating({ mutationKey: ['groups', 'create'] }) > 0

  const addButton = (
    <button type="button" className={`${ui.button} ${ui.primary}`} aria-label="그룹 추가"
      onClick={() => setCreating(true)}><Icon name="plus" />추가</button>
  )

  return (
    <>
      <PageHeader title={title} action={narrow ? undefined : addButton} />
      <div className={styles.layout}>
        <section aria-labelledby="my-groups-title" className={ui.card}>
          {narrow ? <div className={styles.cardHeader}><h2 id="my-groups-title">내 그룹</h2>{addButton}</div>
            : <h2 id="my-groups-title">내 그룹</h2>}
          {isLoading && <SkeletonRegion><ul className={styles.groupList}>
            {[0, 1, 2].map((i) => <li key={i} className={styles.groupButton}><Skeleton width="60%" height="1lh" /><Skeleton width="35%" height="1lh" /></li>)}
          </ul></SkeletonRegion>}
          {isError && (
            <div className={styles.actionRow}>
              <p role="alert" className={ui.alert}>그룹을 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} onClick={retry}><Icon name="refresh-cw" size={18} />다시 시도</button>
            </div>
          )}
          {!isLoading && !isError && groups.length === 0 && (
            <p className={ui.status}>아직 속한 그룹이 없습니다. 그룹을 추가하거나 초대 링크로 합류하세요.</p>
          )}
          {groups.length > 0 && (
            <ul className={styles.groupList}>
              {groups.map((g) => (
                <li key={g.groupId}>
                  <button type="button" aria-pressed={g.groupId === selectedGroupId} className={styles.groupButton}
                    onClick={() => selectGroup(g.groupId)}>
                    <span className={styles.groupName}>{g.name}</span>
                    <span className={ui.muted}>{g.myRole === 'ADMIN' ? '관리자' : '멤버'} · {g.memberCount}/6명</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {selectedGroupId !== null && <GroupDetailSection key={selectedGroupId} groupId={selectedGroupId} />}
      </div>

      {creating && (
        <Dialog title="새 그룹 만들기" onClose={() => setCreating(false)} closeDisabled={createPending}>
          <CreateGroupForm onCreated={() => setCreating(false)} />
        </Dialog>
      )}
    </>
  )
}
