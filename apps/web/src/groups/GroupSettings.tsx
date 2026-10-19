import { useState } from 'react'
import { errorMessage } from '../common/errorMessage'
import ui from '../common/ui.module.css'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

export function RenameForm({ groupId, name }: { groupId: number; name: string }) {
  const { rename } = useGroupMutations()
  const [value, setValue] = useState(name)
  const trimmed = value.trim()

  return (
    <form className={ui.row} onSubmit={(e) => { e.preventDefault(); rename.mutate({ groupId, name: trimmed }) }}>
      <label className={ui.field}>
        <span>새 이름</span>
        <input className={ui.input} required maxLength={50} value={value}
          onChange={(e) => { setValue(e.target.value); rename.reset() }} />
      </label>
      <button type="submit" className={ui.button}
        disabled={rename.isPending || trimmed === '' || trimmed === name}>이름 바꾸기</button>
      {rename.isSuccess && <p role="status" className={ui.status}>이름을 바꿨습니다.</p>}
      {rename.isError && <p role="alert" className={ui.alert}>{errorMessage(rename.error)}</p>}
    </form>
  )
}

export function ShareToggle({ groupId, enabled }: { groupId: number; enabled: boolean }) {
  const { setShare } = useGroupMutations()
  return (
    <div className={ui.stack}>
      <label className={styles.check}>
        <input type="checkbox" checked={enabled} disabled={setShare.isPending}
          onChange={(e) => setShare.mutate({ groupId, enabled: e.target.checked })} />
        <span>내 거래를 이 그룹에 공개</span>
      </label>
      <p className={ui.muted}>끄면 이 그룹의 대시보드와 그룹 거래에서 내 거래가 빠집니다. 숨긴 거래는 켜도 보이지 않습니다.</p>
      {setShare.isError && <p role="alert" className={ui.alert}>{errorMessage(setShare.error)}</p>}
    </div>
  )
}

export function LeaveGroup({ groupId, name }: { groupId: number; name: string }) {
  const { leave } = useGroupMutations()
  const [confirming, setConfirming] = useState(false)
  return (
    <div className={ui.stack}>
      {confirming ? (
        <div className={ui.row}>
          <p className={ui.status}>{name}에서 나가면 다시 초대받아야 합류할 수 있습니다. 나갈까요?</p>
          <button type="button" className={`${ui.button} ${ui.danger}`} disabled={leave.isPending}
            onClick={() => leave.mutate(groupId)}>나가기 확인</button>
          <button type="button" className={ui.button} onClick={() => setConfirming(false)}>취소</button>
        </div>
      ) : (
        <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => setConfirming(true)}>그룹 나가기</button>
      )}
      {leave.isError && <p role="alert" className={ui.alert}>{errorMessage(leave.error)}</p>}
    </div>
  )
}
