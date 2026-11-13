import { useState } from 'react'
import { errorMessage } from '../common/errorMessage'
import { formatInstant } from '../common/format'
import Icon from '../common/Icon'
import { toast } from '../common/Toast'
import TextField from '../common/TextField'
import ui from '../common/ui.module.css'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'
import GroupHelp from './GroupHelp'

const MAX_MEMBERS = 6

export default function InviteSection({ groupId, memberCount }: { groupId: number; memberCount: number }) {
  const { createInvite } = useGroupMutations()
  const [copied, setCopied] = useState<'failed' | null>(null)
  const invite = createInvite.data
  const link = invite ? `${window.location.origin}/invite/${invite.token}` : null
  const full = memberCount >= MAX_MEMBERS

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(null)
      toast('링크를 복사했습니다.')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <section aria-labelledby="invite-title" className={ui.stack}>
      <div className={styles.actionRow}>
        <div className={styles.titleWithHelp}>
          <h3 id="invite-title" className={styles.subTitle}>초대 링크</h3>
          <GroupHelp title="초대 링크">링크는 7일간 유효합니다. 받은 사람은 로그인하거나 가입한 뒤 합류할 수 있습니다.</GroupHelp>
        </div>
        <button type="button" className={ui.button} disabled={full || createInvite.isPending}
          onClick={() => { setCopied(null); createInvite.mutate(groupId) }}>
          {link ? '새 링크 만들기' : '초대 링크 만들기'}
        </button>
      </div>
      {full && <p className={ui.status}>정원(6명)이 찼습니다. 멤버를 내보낸 뒤 초대하세요.</p>}
      {invite && link && (
        <div className={ui.stack}>
          <div className={styles.fieldAction}>
            <TextField label="초대 주소" value={link} onChange={() => {}} isReadOnly className={styles.linkField}
              onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => void copy(link)}><Icon name="copy" size={18} />링크 복사</button>
          </div>
          <span className={ui.muted}>{formatInstant(invite.expiresAt)}까지</span>
        </div>
      )}
      {copied === 'failed' && <p role="alert" className={ui.alert}>복사하지 못했습니다. 주소 칸을 눌러 직접 복사해 주세요.</p>}
      {createInvite.isError && <p role="alert" className={ui.alert}>{errorMessage(createInvite.error)}</p>}
    </section>
  )
}
