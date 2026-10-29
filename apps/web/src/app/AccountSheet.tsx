import { useRef, useState } from 'react'
import HelpDialog from './HelpDialog'
import BottomSheet from '../common/BottomSheet'
import Icon from '../common/Icon'
import ui from '../common/ui.module.css'

type Props = { nickname: string; onLogout: () => void; logoutFailed: boolean; onOpen: () => void }

/** 좁은 화면에서 닉네임과 로그아웃을 담는다. 실패 문구도 시트 안에 보여야 시트에 가려지지 않는다. */
export default function AccountSheet({ nickname, onLogout, logoutFailed, onOpen }: Props) {
  const [helpOpen, setHelpOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <BottomSheet title="계정" triggerLabel="계정" triggerIcon="user" onOpen={onOpen} buttonRef={triggerRef}>
        {({ close }) => (
          <>
            <p>{nickname}</p>
            <button type="button" className={ui.button} onClick={onLogout}>
              <Icon name="log-out" size={18} />로그아웃
            </button>
            <button type="button" className={ui.button} onClick={() => {
              close()
              // 계정 시트가 닫히고 포커스가 돌아온 다음 도움말을 연다.
              requestAnimationFrame(() => {
                triggerRef.current?.focus()
                setHelpOpen(true)
              })
            }}>도움말</button>
            {logoutFailed && <p role="alert" className={ui.alert}>로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
          </>
        )}
      </BottomSheet>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </>
  )
}
