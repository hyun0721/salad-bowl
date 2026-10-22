import { useIsMutating } from '@tanstack/react-query'
import { useState } from 'react'
import Icon from '../common/Icon'
import Modal from '../common/Modal'
import ui from '../common/ui.module.css'
import { usePageTitle } from '../common/usePageTitle'
import CreateGroupForm from './CreateGroupForm'
import GroupDetailSection from './GroupDetailSection'
import { useGroups } from './GroupProvider'
import styles from './GroupsPage.module.css'

export default function GroupsPage() {
  usePageTitle('그룹 관리')
  const { groups, selectedGroupId, selectGroup, isLoading, isError, retry } = useGroups()
  const [creating, setCreating] = useState(false)
  const createPending = useIsMutating({ mutationKey: ['groups', 'create'] }) > 0

  return (
    <>
      <h1>그룹 관리</h1>
      <div className={styles.actions}>
        <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} />그룹 만들기
        </button>
      </div>
      <div className={styles.layout}>
        <section aria-labelledby="my-groups-title" className={ui.card}>
          <h2 id="my-groups-title">내 그룹</h2>
          {isLoading && <p className={ui.status}>불러오는 중입니다.</p>}
          {isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>그룹을 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} onClick={retry}>그룹 목록 다시 시도</button>
            </div>
          )}
          {!isLoading && !isError && groups.length === 0 && (
            <p className={ui.status}>아직 속한 그룹이 없습니다. 위의 그룹 만들기로 새로 만들거나, 받은 초대 링크를 열어 합류합니다.</p>
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
        <Modal title="새 그룹 만들기" onClose={() => setCreating(false)} closeDisabled={createPending}>
          <CreateGroupForm onCreated={() => setCreating(false)} />
        </Modal>
      )}
    </>
  )
}
