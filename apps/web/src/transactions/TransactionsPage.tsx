import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import ui from '../common/ui.module.css'
import { currentYearMonth } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { useGroups } from '../groups/GroupProvider'
import { groupsApi } from '../groups/groupsApi'
import TransactionList from './TransactionList'
import styles from './TransactionsPage.module.css'
import { transactionsApi } from './transactionsApi'

type Scope = 'mine' | 'group'
type Props = { today?: Date }

export default function TransactionsPage({ today }: Props) {
  usePageTitle('거래 목록')
  const { selectedGroupId } = useGroups()
  const [scope, setScope] = useState<Scope>('mine')
  const [month, setMonth] = useState(() => currentYearMonth(today ?? new Date()))
  // 멤버 선택은 그룹별로 기억한다. 헤더에서 그룹을 바꾸면 이전 그룹의 멤버 id가 남지 않는다.
  const [member, setMember] = useState<{ groupId: number; userId: number } | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const groupId = scope === 'group' ? selectedGroupId : null
  const inGroup = groupId !== null
  const memberId = member !== null && member.groupId === groupId ? member.userId : null
  const list = useQuery({
    queryKey: groupId === null
      ? ['transactions', 'mine', month]
      : ['transactions', 'group', groupId, month, memberId],
    queryFn: () => (groupId === null
      ? transactionsApi.mine(month)
      : transactionsApi.group(groupId, month, memberId)),
    enabled: /^\d{4}-\d{2}$/.test(month),
  })
  const detail = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.detail(groupId!),
    enabled: groupId !== null,
  })

  const items = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const all = list.data ?? []
    if (!keyword) return all
    return all.filter((tx) => [tx.description, tx.categoryMajor, tx.categoryMinor]
      .some((text) => text.toLowerCase().includes(keyword)))
  }, [list.data, search])

  function changeScope(next: Scope) {
    setScope(next)
    setMember(null)
    setSelectedId(null)
  }

  return (
    <>
      <div className={ui.pageHeader}>
        <h1>거래 목록</h1>
      </div>
      <div className={ui.row}>
        <div role="group" aria-label="범위" className={styles.scope}>
          <button type="button" aria-pressed={scope === 'mine'} className={styles.scopeButton}
            onClick={() => changeScope('mine')}>내 거래</button>
          <button type="button" aria-pressed={scope === 'group'} className={styles.scopeButton}
            disabled={selectedGroupId === null} onClick={() => changeScope('group')}>그룹 거래</button>
        </div>
        <label className={styles.inlineField}>
          <span>월</span>
          <input type="month" className={ui.input} value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        {inGroup && detail.data && (
          <label className={styles.inlineField}>
            <span>멤버</span>
            <select className={ui.input} value={memberId ?? ''}
              onChange={(e) => setMember(e.target.value ? { groupId, userId: Number(e.target.value) } : null)}>
              <option value="">전체</option>
              {detail.data.members.map((m) => <option key={m.userId} value={m.userId}>{m.nickname}</option>)}
            </select>
          </label>
        )}
        {inGroup && detail.isError && (
          <>
            <p role="alert" className={ui.alert}>멤버 목록을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void detail.refetch()}>멤버 목록 다시 시도</button>
          </>
        )}
        <label className={`${styles.inlineField} ${styles.search}`}>
          <span>검색</span>
          <input type="search" className={ui.input} placeholder="내용·카테고리" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      {selectedGroupId === null && <p className={ui.muted}>그룹에 속하면 그룹 거래를 볼 수 있습니다.</p>}

      <div className={styles.layout}>
        <section aria-labelledby="list-title" className={`${ui.card} ${styles.listCard}`}>
          <h2 id="list-title" className={styles.visuallyHidden}>거래 목록</h2>
          {list.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {list.isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>거래를 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} onClick={() => void list.refetch()}>다시 시도</button>
            </div>
          )}
          {list.data && items.length === 0 && <p className={ui.status}>이 달에 거래가 없습니다.</p>}
          {items.length > 0 && (
            <TransactionList items={items} showOwner={inGroup} selectedId={selectedId}
              onSelect={setSelectedId} />
          )}
        </section>
      </div>
    </>
  )
}
