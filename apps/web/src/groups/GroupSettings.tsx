import { useState } from 'react'
import ConfirmDialog from '../common/ConfirmDialog'
import { errorMessage } from '../common/errorMessage'
import ui from '../common/ui.module.css'
import TextField from '../common/TextField'
import Switch from '../common/Switch'
import { useGroupMutations } from './useGroupMutations'

export function RenameForm({ groupId, name }: { groupId: number; name: string }) {
  const { rename } = useGroupMutations()
  const [value, setValue] = useState(name)
  const trimmed = value.trim()

  return (
    <form className={ui.row} onSubmit={(e) => { e.preventDefault(); rename.mutate({ groupId, name: trimmed }) }}>
      <TextField label="새 이름" value={value}
        onChange={(v) => { setValue(v); rename.reset() }} isRequired maxLength={50} />
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
      <Switch isSelected={enabled} isDisabled={setShare.isPending}
        onChange={(v) => setShare.mutate({ groupId, enabled: v })}>내 거래를 이 그룹에 공개</Switch>
      <p className={ui.muted}>끄면 이 그룹의 대시보드와 그룹 거래에서 내 거래가 빠집니다. 숨긴 거래는 켜도 보이지 않습니다.</p>
      {setShare.isError && <p role="alert" className={ui.alert}>{errorMessage(setShare.error)}</p>}
    </div>
  )
}

export function LeaveGroup({ groupId, name }: { groupId: number; name: string }) {
  const { leave } = useGroupMutations()
  return (
    <div className={ui.stack}>
      <ConfirmDialog triggerLabel="그룹 나가기" title="그룹 나가기"
        description={`${name}에서 나가면 다시 초대받아야 합류할 수 있습니다. 나갈까요?`}
        confirmLabel="나가기 확인" isPending={leave.isPending} error={leave.isError ? errorMessage(leave.error) : null}
        onOpen={() => leave.reset()} onConfirm={(close) => leave.mutate(groupId, { onSuccess: close })} />
    </div>
  )
}
