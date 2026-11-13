import { useId, useState } from 'react'
import { SwitchButton, SwitchField, Text } from 'react-aria-components'
import ConfirmDialog from '../common/ConfirmDialog'
import { errorMessage } from '../common/errorMessage'
import ui from '../common/ui.module.css'
import TextField from '../common/TextField'
import field from '../common/Field.module.css'
import GroupHelp from './GroupHelp'
import styles from './GroupsPage.module.css'
import { toast } from '../common/Toast'
import { useGroupMutations } from './useGroupMutations'

export function RenameForm({ groupId, name }: { groupId: number; name: string }) {
  const { rename } = useGroupMutations()
  const [value, setValue] = useState(name)
  const trimmed = value.trim()

  return (
    <form className={styles.fieldAction} onSubmit={(e) => { e.preventDefault(); rename.mutate({ groupId, name: trimmed }, { onSuccess: () => toast('이름을 바꿨습니다.') }) }}>
      <TextField label="그룹 이름" value={value}
        onChange={(v) => { setValue(v); rename.reset() }} isRequired maxLength={50} />
      <button type="submit" className={ui.button}
        disabled={rename.isPending || trimmed === '' || trimmed === name}>이름 바꾸기</button>
      {rename.isError && <p role="alert" className={ui.alert}>{errorMessage(rename.error)}</p>}
    </form>
  )
}

export function ShareToggle({ groupId, enabled }: { groupId: number; enabled: boolean }) {
  const { setShare } = useGroupMutations()
  const shareId = useId()
  return (
    <div className={ui.stack}>
      <SwitchField id={shareId} aria-labelledby={`${shareId}-label`} className={styles.shareSetting} isSelected={enabled} isDisabled={setShare.isPending}
        onChange={(v) => setShare.mutate({ groupId, enabled: v })}>
        <div className={styles.settingCopy}>
          <div className={styles.titleWithHelp}>
            <label id={`${shareId}-label`} htmlFor={shareId}>내 거래 그룹 공개</label>
            <GroupHelp title="내 거래 그룹 공개">끄면 그룹 대시보드와 그룹 거래에서 내 거래가 제외됩니다. 숨긴 거래는 공개해도 보이지 않습니다.</GroupHelp>
          </div>
          <Text slot="description" className={ui.muted}>이 그룹에 내 거래를 공유해요.</Text>
        </div>
        <SwitchButton className={`${field.check} ${styles.shareButton}`}>
          <span className={field.track} aria-hidden="true"><span className={field.thumb} /></span>
        </SwitchButton>
      </SwitchField>
      {setShare.isError && <p role="alert" className={ui.alert}>{errorMessage(setShare.error)}</p>}
    </div>
  )
}

export function LeaveGroup({ groupId, name }: { groupId: number; name: string }) {
  const { leave } = useGroupMutations()
  return (
    <div className={styles.actions}>
      <ConfirmDialog triggerLabel="그룹 나가기" title="그룹 나가기"
        description={`${name}에서 나가면 다시 초대받아야 합류할 수 있습니다. 나갈까요?`}
        confirmLabel="나가기 확인" isPending={leave.isPending} error={leave.isError ? errorMessage(leave.error) : null}
        onOpen={() => leave.reset()} onConfirm={(close) => leave.mutate(groupId, { onSuccess: close })} />
    </div>
  )
}
