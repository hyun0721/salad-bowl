import { useState } from 'react'
import { Button } from 'react-aria-components'
import { DialogFrame } from './Dialog'
import Icon, { type IconName } from './Icon'
import ui from './ui.module.css'

type Props = {
  triggerLabel: string
  triggerAriaLabel?: string
  triggerIcon?: IconName
  title: string
  description: string
  confirmLabel: string
  confirmAriaLabel?: string
  isPending: boolean
  error: string | null
  onConfirm: (close: () => void) => void
  onOpen?: () => void
}

/**
 * 되돌릴 수 없는 작업(나가기, 내보내기, 삭제)을 한 번 더 묻는다.
 * 트리거는 RAC Button이라 Safari처럼 누를 때 포커스를 주지 않는 브라우저에서도 닫힌 뒤 트리거로 돌아온다.
 */
export default function ConfirmDialog(props: Props) {
  const { triggerLabel, triggerAriaLabel, triggerIcon, title, description, confirmLabel, confirmAriaLabel, isPending, error, onConfirm, onOpen } = props
  const [open, setOpen] = useState(false)
  // 실행 중 닫기 막기는 closeDisabled와 버튼 비활성이 맡는다. 여기서 isPending을 보면
  // mutate의 onSuccess(리렌더 전, isPending이 아직 true)에서 부른 close가 막힌다.
  const close = () => setOpen(false)
  return (
    <>
      <Button aria-label={triggerAriaLabel} className={`${ui.button} ${ui.danger}`}
        onPress={() => { onOpen?.(); setOpen(true) }}>
        {triggerIcon && <Icon name={triggerIcon} size={18} />}{triggerLabel}
      </Button>
      <DialogFrame isOpen={open} onOpenChange={setOpen} title={title} closeDisabled={isPending} closeOnOutsideClick>
        {() => (
          <>
            <p>{description}</p>
            {error && <p role="alert" className={ui.alert}>{error}</p>}
            <div className={ui.row}>
              <Button autoFocus className={ui.button} isDisabled={isPending} onPress={close}>취소</Button>
              <Button aria-label={confirmAriaLabel} className={`${ui.button} ${ui.danger}`} isDisabled={isPending}
                onPress={() => onConfirm(close)}>{confirmLabel}</Button>
            </div>
          </>
        )}
      </DialogFrame>
    </>
  )
}
