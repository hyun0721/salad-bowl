import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import type { GroupDetail } from './groupsApi'
import styles from './GroupsPage.module.css'

export default function MemberList({ group }: { group: GroupDetail }) {
  return (
    <section aria-labelledby="members-title" className={ui.stack}>
      <h3 id="members-title" className={styles.subTitle}>멤버 ({group.members.length}/6)</h3>
      <ul className={styles.memberList}>
        {group.members.map((m) => (
          <li key={m.userId} className={styles.member}>
            <span className={styles.memberName}>{m.nickname}</span>
            <span className={ui.muted}>
              {m.role === 'ADMIN' ? '관리자' : '멤버'} · {m.shareEnabled ? '공개' : '비공개'} · {formatInstant(m.joinedAt)} 합류
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
