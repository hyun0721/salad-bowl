import { useState } from 'react'
import { errorMessage } from '../common/errorMessage'
import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

const MAX_MEMBERS = 6

export default function InviteSection({ groupId, memberCount }: { groupId: number; memberCount: number }) {
  const { createInvite } = useGroupMutations()
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null)
  const invite = createInvite.data
  const link = invite ? `${window.location.origin}/invite/${invite.token}` : null
  const full = memberCount >= MAX_MEMBERS

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <section aria-labelledby="invite-title" className={ui.stack}>
      <h3 id="invite-title" className={styles.subTitle}>초대 링크</h3>
      <p className={ui.muted}>링크는 7일 동안 쓸 수 있습니다. 받은 사람은 로그인하거나 가입한 뒤 합류합니다.</p>
      {full && <p className={ui.status}>그룹 정원(6명)이 찼습니다. 멤버를 내보내야 새로 초대할 수 있습니다.</p>}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={full || createInvite.isPending}
          onClick={() => { setCopied(null); createInvite.mutate(groupId) }}>
          {link ? '새 링크 만들기' : '초대 링크 만들기'}
        </button>
      </div>
      {invite && link && (
        <div className={ui.row}>
          <label className={`${ui.field} ${styles.linkField}`}>
            <span>초대 주소</span>
            <input className={`${ui.input} ${styles.linkInput}`} readOnly value={link}
              onFocus={(e) => e.currentTarget.select()} />
          </label>
          <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => void copy(link)}>링크 복사</button>
          <span className={ui.muted}>{formatInstant(invite.expiresAt)}까지</span>
        </div>
      )}
      {copied === 'done' && <p role="status" className={ui.status}>링크를 복사했습니다.</p>}
      {copied === 'failed' && <p role="alert" className={ui.alert}>복사하지 못했습니다. 주소 칸을 눌러 직접 복사해 주세요.</p>}
      {createInvite.isError && <p role="alert" className={ui.alert}>{errorMessage(createInvite.error)}</p>}
    </section>
  )
}
