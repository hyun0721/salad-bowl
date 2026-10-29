import SegmentedControl from '../common/SegmentedControl'
import SearchField from '../common/SearchField'
import Select from '../common/Select'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import Icon from '../common/Icon'
import { DialogFrame } from '../common/Dialog'
import { useNarrowWhileOpen } from '../common/useMediaQuery'
import MonthPicker from '../common/MonthPicker'
import ui from '../common/ui.module.css'
import { defaultYearMonth } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { useGroups } from '../groups/GroupProvider'
import { groupsApi } from '../groups/groupsApi'
import ManualTransactionForm, { type AddDraft } from './ManualTransactionForm'
import TransactionList from './TransactionList'
import TransactionPanel, { type EditDraft } from './TransactionPanel'
import panelStyles from './TransactionPanel.module.css'
import styles from './TransactionsPage.module.css'
import { transactionsApi } from './transactionsApi'

type Scope = 'mine' | 'group'
type Props = { today?: Date }
/** 넓은 화면에서 거래 상세·추가를 띄우는 자리. 좁은 화면은 늘 하단 시트다. */
type DetailView = 'modal' | 'sidebar'

/** 열린 폼의 저장하지 않은 입력. 어떤 폼의 것인지 key로 구분한다. */
type Draft = { key: 'add'; values: AddDraft } | { key: number; values: EditDraft }

const VIEW_STORAGE_KEY = 'saladbowl.transactionDetailView'

function readDetailView(): DetailView {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'sidebar' ? 'sidebar' : 'modal'
  } catch {
    return 'modal'
  }
}

function rememberDetailView(view: DetailView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view)
  } catch {
    // 저장소를 못 쓰면 이번 화면 동안만 기억한다.
  }
}

function PanelHeader({ title, actions }: { title: string; actions: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null)
  // 오른쪽 패널은 모달과 달리 포커스를 가져가지 않으므로 처음 열릴 때 제목으로 포커스를 옮긴다.
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className={panelStyles.header}>
      <h2 ref={ref} tabIndex={-1}>{title}</h2>
      {actions}
    </div>
  )
}

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
  const [view, setView] = useState(readDetailView)

  // 그룹이 없어지면 화면은 '내 거래'로 보이는데, 이미 선택된 것을 눌러도 변경이 없으므로 scope를 맞춰 둔다.
  if (selectedGroupId === null && scope === 'group') {
    setScope('mine')
    // 그룹 목록에서 연 내 거래가 내 목록에도 있으면 선택을 해제해야 패널이 닫힌다.
    setSelectedId(null)
  }

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
  // 닫힘 애니메이션 동안 마지막 내용을 유지한다.
  const current = adding ? 'add' : selected
  const [shown, setShown] = useState<'add' | typeof selected>(current)
  if (current !== null && current !== shown) setShown(current)
  // 추가한 거래의 달을 다시 불러오는 동안에도 시트를 유지한다.
  const open = adding || selected !== null || (shown === 'add' && selectedId !== null && list.isFetching)
  const narrow = useNarrowWhileOpen(open)
  const inSidebar = !narrow && view === 'sidebar'
  // 저장 요청 중에 자리를 바꾸면 폼이 다시 그려져 진행 상태와 오류를 잃으므로 전환을 막는다.
  const saving = useIsMutating() > 0
  const shownId = shown === 'add' ? 'add' : shown?.id ?? null

  // 모달↔사이드바 전환으로 폼이 다시 그려져도 입력을 이어 쓰도록 페이지가 보관한다.
  const draft = useRef<Draft | null>(null)
  const saveAddDraft = useCallback((values: AddDraft) => { draft.current = { key: 'add', values } }, [])
  const saveEditDraft = useCallback((values: EditDraft) => {
    if (typeof shownId === 'number') draft.current = { key: shownId, values }
  }, [shownId])

  const listRef = useRef<HTMLElement>(null)
  const listHeadingRef = useRef<HTMLHeadingElement>(null)
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current === open) return
    wasOpen.current = open
    if (open) return
    draft.current = null
    // 전환 버튼처럼 연 요소가 사라졌으면 RAC가 포커스를 되돌리지 못한다. 그 거래 행, 없으면 목록 제목으로 옮긴다.
    const id = shownId
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (active && active !== document.body && active.isConnected) return
      const row = typeof id === 'number' ? listRef.current?.querySelector<HTMLElement>(`[data-key="${id}"]`) : null
      ;(row ?? listHeadingRef.current)?.focus()
    })
  }, [open, shownId])
  // 모달이 열린 동안 같은 주소에 히스토리 항목을 하나 쌓아, 뒤로가기가 이전 화면 대신 모달만 닫게 한다.
  const location = useLocation()
  const navigate = useNavigate()
  const modalOpen = open && !inSidebar
  const atModalEntry = (location.state as { txModal?: boolean } | null)?.txModal === true
  const pushedModalEntry = useRef(false)
  useEffect(() => {
    if (modalOpen && !atModalEntry) {
      // 쌓은 항목에서 벗어났다면 뒤로가기다.
      if (pushedModalEntry.current) {
        pushedModalEntry.current = false
        closePanel()
        return
      }
      pushedModalEntry.current = true
      void navigate(location, { state: { ...(location.state as object | null), txModal: true } })
    } else if (!modalOpen && atModalEntry) {
      // 닫기·저장·삭제·월 변경 등으로 닫혔으면 쌓은 항목을 걷어 다음 뒤로가기가 이전 화면으로 가게 한다.
      pushedModalEntry.current = false
      void navigate(-1)
    }
  }, [modalOpen, atModalEntry, location, navigate])
  const focusListAfterDelete = useRef(false)
  useEffect(() => {
    // 삭제한 행이 사라진 뒤 목록 제목으로 포커스를 옮긴다.
    if (!focusListAfterDelete.current) return
    focusListAfterDelete.current = false
    listHeadingRef.current?.focus()
  })

  function closePanel() {
    setAdding(false)
    setSelectedId(null)
  }

  const title = shown === 'add' ? '거래 추가 (수동)' : shown?.description ?? ''
  const body = shown === 'add' ? (
    <ManualTransactionForm loadDraft={() => (draft.current?.key === 'add' ? draft.current.values : undefined)}
      onDraftChange={saveAddDraft} onCancel={closePanel} onDone={(created) => {
      // 다른 달에 추가한 거래도 목록과 상세 패널에 보이도록 그 달로 옮긴다.
      setAdding(false)
      setScope('mine')
      setMonth(created.occurredAt.slice(0, 7))
      setSelectedId(created.id)
    }} />
  ) : shown && (
    <TransactionPanel key={shown.id} tx={shown} onDraftChange={saveEditDraft}
      loadDraft={() => (draft.current?.key === shown.id ? draft.current.values : undefined)}
      onDeleted={() => { focusListAfterDelete.current = true; setSelectedId(null) }} />
  )

  function changeView(next: DetailView) {
    setView(next)
    rememberDetailView(next)
  }

  const headerActions = (
    <div className={panelStyles.headerActions}>
      {!narrow && (
        <button type="button" className={`${ui.button} ${panelStyles.iconButton}`}
          aria-label={inSidebar ? '가운데 창으로 보기' : '오른쪽 패널로 보기'} title={inSidebar ? '가운데 창으로 보기' : '오른쪽 패널로 보기'}
          disabled={saving} onClick={() => changeView(inSidebar ? 'modal' : 'sidebar')}>
          <Icon name={inSidebar ? 'panel-center' : 'panel-right'} size={18} />
        </button>
      )}
      <button type="button" className={ui.button} onClick={closePanel}><Icon name="x" size={18} />닫기</button>
    </div>
  )

  function changeScope(next: Scope) {
    setScope(next)
    setMember(null)
    setSelectedId(null)
  }

  function changeMonth(next: string) {
    setMonth(next)
    // 다른 달로 이동하면 돌아왔을 때 이전 거래가 다시 열리지 않게 한다.
    setSelectedId(null)
  }

  return (
    <div className={styles.page}>
      <div className={ui.pageHeader}>
        <h1>거래 목록</h1>
        <button type="button" className={`${ui.button} ${ui.primary}`}
          onClick={() => { setAdding(true); setSelectedId(null) }}><Icon name="plus" />거래 추가</button>
      </div>
      <div className={ui.row}>
        <SegmentedControl label="범위" items={[{ id: 'mine', label: '내 거래' }, { id: 'group', label: '그룹 거래', isDisabled: selectedGroupId === null }]}
          selectedKey={inGroup ? 'group' : 'mine'} onSelectionChange={(id) => changeScope(id as Scope)} />
        <MonthPicker month={month} onChange={changeMonth} />
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
        <SearchField label="검색" value={search} onChange={setSearch} placeholder="내용·카테고리 검색" className={styles.search} />
      </div>
      {selectedGroupId === null && <p className={ui.muted}>그룹에 속하면 그룹 거래를 볼 수 있습니다.</p>}

      <div className={styles.layout}>
        <section ref={listRef} aria-labelledby="list-title" className={`${ui.card} ${styles.listCard}`}>
          <h2 id="list-title" ref={listHeadingRef} tabIndex={-1} className={styles.visuallyHidden}>거래 목록</h2>
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
            <TransactionList key={JSON.stringify([groupId, month, memberId, search])} items={items} showOwner={inGroup} selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setAdding(false) }} />
          )}
        </section>
        {inSidebar && open && (
          <aside aria-label={shown === 'add' ? '거래 추가' : '거래 상세'} className={`${ui.card} ${styles.panel}`}>
            <PanelHeader key={`header-${shown === 'add' ? 'add' : shown?.id}`} title={title} actions={headerActions} />
            {body}
          </aside>
        )}
      </div>
      {!inSidebar && shown && (
        <DialogFrame isOpen={open} onOpenChange={(next) => { if (!next) closePanel() }} title={title} fullHeight
          headerAction={headerActions}>
          {() => body}
        </DialogFrame>
      )}
    </div>
  )
}
