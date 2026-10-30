import { formatWon } from '../common/format'
import type { MemberTotal } from './dashboardApi'
import styles from './DistributionBars.module.css'

type Row = {
  id: string; label: string; value: number
  memberExpenses?: { userId: number; expense: number }[]
}
type Props = {
  rows: Row[]; positiveTotal: number; members: Pick<MemberTotal, 'userId' | 'nickname'>[]
  onSelect?: (id: string) => void
}
const amount = (value: number) => `${value < 0 ? '-' : ''}${formatWon(value)}${value < 0 ? ' · 환불 초과' : ''}`
const color = (index: number) => `var(--chart-${index % 8 + 1})`

export default function DistributionBars({ rows, positiveTotal, members, onSelect }: Props) {
  const hasMembers = members.length > 0 && rows.some((row) => row.memberExpenses !== undefined)
  return <>
    {hasMembers && <div className={styles.legend} role="group" aria-label="멤버 범례">
      {members.map((member, index) => <span key={member.userId} className={styles.member}>
        <span aria-hidden="true" className={styles.dot} style={{ background: color(index) }} />{member.nickname}
      </span>)}
    </div>}
    <ul className={styles.bars}>{rows.map((row) => {
      const ratio = positiveTotal > 0 ? Math.max(0, row.value) / positiveTotal * 100 : 0
      const contributions = hasMembers ? members.map((member, index) => ({
        ...member, index, expense: row.memberExpenses?.find((entry) => entry.userId === member.userId)?.expense ?? 0,
      })).filter((member) => member.expense !== 0) : []
      const memberTotal = contributions.reduce((sum, member) => sum + Math.max(0, member.expense), 0)
      const detail = contributions.map((member) => `${member.nickname} ${amount(member.expense)}`)
      const content = <>
        <span className={styles.barLabel} title={row.label}>{row.label}</span>
        <span role="img" aria-label={[`${row.label} ${ratio.toFixed(1)}%`, ...detail].join(', ')} className={styles.meter}>
          <span className={styles.fill} style={{ width: `${ratio}%`, background: memberTotal > 0 ? undefined : 'var(--brand)' }}>
            {contributions.filter((member) => member.expense > 0).map((member) => <span key={member.userId}
              style={{ width: `${member.expense / memberTotal * 100}%`, background: color(member.index) }} />)}
          </span>
        </span>
        <span className={styles.amount}>{amount(row.value)}{row.value < 0 ? '' : ` · ${ratio.toFixed(1)}%`}</span>
        {hasMembers && <span className={styles.members}>{contributions.map((member) => <span key={member.userId} className={styles.member}>
          <span aria-hidden="true" className={styles.dot} style={{ background: color(member.index) }} />
          {member.nickname} {amount(member.expense)}
        </span>)}</span>}
      </>
      return onSelect ? <li key={row.id}><button type="button" className={`${styles.distributionBar} ${styles.button}`}
        aria-label={[`${row.label} ${ratio.toFixed(1)}% ${amount(row.value)}`, ...detail].join(', ')} onClick={() => onSelect(row.id)}>{content}</button></li>
        : <li key={row.id} className={styles.distributionBar}>{content}</li>
    })}</ul>
  </>
}
