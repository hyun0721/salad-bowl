import SegmentedControl from '../common/SegmentedControl'
import SearchField from '../common/SearchField'
import Select from '../common/Select'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import Icon from '../common/Icon'
import MonthPicker from '../common/MonthPicker'
import ui from '../common/ui.module.css'
import { defaultYearMonth } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { useGroups } from '../groups/GroupProvider'
import { groupsApi } from '../groups/groupsApi'
import ManualTransactionForm from './ManualTransactionForm'
import TransactionList from './TransactionList'
import TransactionPanel from './TransactionPanel'
import styles from './TransactionsPage.module.css'
import { transactionsApi } from './transactionsApi'

type Scope = 'mine' | 'group'
type Props = { today?: Date }

export default function TransactionsPage({ today }: Props) {
  usePageTitle('거래 목록')
  const { selectedGroupId } = useGroups()
  const [scope, setScope] = useState<Scope>('mine')
  const [month, setMonth] = useState(() => defaultYearMonth(today ?? new Date()))
  // 멤버 선택은 그룹별로 기억한다. 헤더에서 그룹을 바꾸면 이전 그룹의 멤버 id가 남지 않는다.
  const [member, setMember] = useState<{ groupId: number; userId: number } | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  // 그룹이 없어지면 화면은 '내 거래'로 보이는데, 이미 선택된 것을 눌러도 변경이 없으므로 scope를 맞춰 둔다.
  if (selectedGroupId === null && scope === 'group') setScope('mine')

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

  // 선택한 거래는 현재 목록에서 찾는다. 월·멤버·그룹이 바뀌어 목록에 없으면 패널을 보이지 않는다.
  const selected = list.data?.find((tx) => tx.id === selectedId) ?? null

  function changeScope(next: Scope) {
    setScope(next)
    setMember(null)
    setSelectedId(null)
  }

  return (
    <>
      <div className={ui.pageHeader}>
        <h1>거래 목록</h1>
        <button type="button" className={`${ui.button} ${ui.primary}`}
          onClick={() => { setAdding(true); setSelectedId(null) }}><Icon name="plus" />거래 추가</button>
      </div>
      <div className={ui.row}>
        <SegmentedControl label="범위" items={[{ id: 'mine', label: '내 거래' }, { id: 'group', label: '그룹 거래', isDisabled: selectedGroupId === null }]}
          selectedKey={inGroup ? 'group' : 'mine'} onSelectionChange={(id) => changeScope(id as Scope)} />
        <MonthPicker month={month} onChange={setMonth} />
        {inGroup && detail.data && (
          <Select label="멤버"
            items={[{ id: 'all', label: '전체' }, ...detail.data.members.map((m) => ({ id: m.userId, label: m.nickname }))]}
            selectedKey={memberId ?? 'all'}
            onSelectionChange={(key) => setMember(key == null || key === 'all' ? null : { groupId, userId: Number(key) })} />
        )}
        {inGroup && detail.isError && (
          <>
            <p role="alert" className={ui.alert}>멤버 목록을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void detail.refetch()}>멤버 목록 다시 시도</button>
          </>
        )}
        <SearchField label="검색" value={search} onChange={setSearch} placeholder="내용·카테고리" className={styles.search} />
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
          {list.data && items.length === 0 && (
            <p className={ui.status}>{list.data.length > 0 ? '검색 결과가 없습니다.' : '이 달에 거래가 없습니다.'}</p>
          )}
          {items.length > 0 && (
            <TransactionList items={items} showOwner={inGroup} selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setAdding(false) }} />
          )}
        </section>
        {(adding || selected) && (
          <aside aria-label={adding ? '거래 추가' : '거래 상세'} className={`${ui.card} ${styles.panel}`}>
            {adding ? (
              <ManualTransactionForm
                onCancel={() => setAdding(false)}
                onDone={(created) => {
                  // 다른 달에 추가한 거래도 목록과 상세 패널에 보이도록 그 달로 옮긴다.
                  setAdding(false)
                  setScope('mine')
                  setMonth(created.occurredAt.slice(0, 7))
                  setSelectedId(created.id)
                }} />
            ) : selected && (
              <TransactionPanel key={selected.id} tx={selected} onClose={() => setSelectedId(null)} />
            )}
          </aside>
        )}
      </div>
    </>
  )
}
