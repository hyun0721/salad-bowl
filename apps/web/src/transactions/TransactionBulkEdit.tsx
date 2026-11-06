import { useMemo, useState, type FormEvent } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import Dialog from '../common/Dialog'
import Select from '../common/Select'
import TextField from '../common/TextField'
import Checkbox from '../common/Checkbox'
import { addTags, extractTags, normalizeTag, removeTags } from './memoTags'
import { useTags } from './tagsApi'
import styles from './TransactionsPage.module.css'
import { errorMessage } from '../common/errorMessage'
import { toast } from '../common/Toast'
import ui from '../common/ui.module.css'
import { majorOptions, minorOptions, type CategoryOption } from './categoriesApi'
import { TYPE_LABELS } from './TransactionPanel'
import type { BulkTransactionPatch, TransactionType, TransactionView } from './transactionsApi'
import { useTransactionMutations } from './useTransactionMutations'

type Props = { groupId: number | null; items: TransactionView[]; categories: CategoryOption[]; onClose: () => void; onDone: () => void }

export default function TransactionBulkEdit({ items, categories, groupId, onClose, onDone }: Props) {
  const { me } = useAuth()
  const { bulkUpdate } = useTransactionMutations()
  const saving = useIsMutating() > 0
  const [type, setType] = useState<TransactionType | ''>('')
  const [major, setMajor] = useState('')
  const [minor, setMinor] = useState<string | null>(null)
  const [hidden, setHidden] = useState('unchanged')
  const [tagInput, setTagInput] = useState('')
  const [removedTags, setRemovedTags] = useState<string[]>([])
  const tags = useTags(groupId)
  const parsedTags = tagInput.trim() ? tagInput.trim().split(/\s+/u).map(normalizeTag) : []
  const addedTags = [...new Set(parsedTags.filter((tag): tag is string => tag !== null))]
  const invalidTags = parsedTags.includes(null)
  const tooManyTags = addedTags.length > 20 || removedTags.length > 20
  const suggestions = (tags.data ?? []).filter(({ tag }) => !addedTags.includes(tag)).slice(0, 8)
  const removableTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tx of items) for (const tag of extractTags(tx.memo)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
  }, [items])
  const overflowing = addedTags.length || removedTags.length
    ? items.filter((tx) => addTags(removeTags(tx.memo, removedTags), addedTags).length > 1000).length : 0
  const allMine = items.every((tx) => tx.ownerId === me?.userId)
  const allowIncome = items.every((tx) => tx.amount > 0 || tx.type === 'INCOME')
  const tooMany = items.length > 1000
  const patch: BulkTransactionPatch = {}
  if (type && (type !== 'INCOME' || allowIncome)) patch.type = type
  if (major && minor !== null) {
    patch.categoryMajor = major
    patch.categoryMinor = minor
  }
  if (addedTags.length) patch.addTags = addedTags
  if (removedTags.length) patch.removeTags = removedTags
  if (allMine && hidden !== 'unchanged') patch.hidden = hidden === 'hide'
  const disabled = invalidTags || tooManyTags || overflowing > 0 || (major !== '' && minor === null) || saving || tooMany || items.length === 0 || Object.keys(patch).length === 0

  function apply(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    bulkUpdate.mutate({ ids: items.map((tx) => tx.id), patch }, {
      onSuccess: ({ updated }) => { toast(`${updated}건을 수정했습니다.`); onDone() },
    })
  }

  return (
    <Dialog title="거래 일괄 편집" onClose={onClose} closeDisabled={saving}>
      <form className={ui.stack} onSubmit={apply}>
        <p>선택한 {items.length}건에 적용합니다. 비워 둔 항목은 바뀌지 않습니다.</p>
        {tooMany && <p role="alert" className={ui.alert}>한 번에 최대 1,000건까지 수정할 수 있습니다.</p>}
        <Select variant="field" label="타입" selectedKey={type || 'unchanged'}
          items={[{ id: 'unchanged', label: '변경 안 함' }, ...Object.entries(TYPE_LABELS)
            .filter(([id]) => id !== 'INCOME' || allowIncome).map(([id, label]) => ({ id, label }))]}
          onSelectionChange={(key) => setType(key === 'unchanged' || key == null ? '' : key as TransactionType)} />
        <div className={styles.categoryFields}>
          <Select variant="field" label="대분류" selectedKey={major ? 'major:' + major : 'unchanged'}
            items={[{ id: 'unchanged', label: '변경 안 함' }, ...majorOptions(categories).map((value) => ({ id: 'major:' + value, label: value }))]}
            onSelectionChange={(key) => { setMajor(key === 'unchanged' || key == null ? '' : String(key).slice(6)); setMinor(null) }} />
          <Select variant="field" label="소분류" placeholder="선택" isDisabled={!major}
            selectedKey={minor === null ? null : minor === '' ? 'none' : 'minor:' + minor}
            items={[{ id: 'none', label: '소분류 없음' }, ...minorOptions(categories, major).map((value) => ({ id: 'minor:' + value, label: value }))]}
            onSelectionChange={(key) => setMinor(key === null ? null : key === 'none' ? '' : String(key).slice(6))} />
        </div>
        {allMine && <Select variant="field" label="그룹에서 숨기기" selectedKey={hidden}
          items={[{ id: 'unchanged', label: '변경 안 함' }, { id: 'hide', label: '숨기기' }, { id: 'show', label: '숨기기 해제' }]}
          onSelectionChange={(key) => setHidden(String(key ?? 'unchanged'))} />}
        <TextField label="태그 추가" value={tagInput} onChange={setTagInput} placeholder="#결혼준비 #여행"
          description={invalidTags ? '태그는 글자·숫자·밑줄 1~50자로 입력하세요. 공백으로 구분합니다.' : undefined} />
        {suggestions.length > 0 && <div className={ui.row} aria-label="추천 태그">
          {suggestions.map(({ tag }) => <button key={tag} type="button" className={ui.button}
            onClick={() => setTagInput((value) => (value.trim() ? value.trim() + ' ' : '') + '#' + tag)}>#{tag}</button>)}
        </div>}
        <div role="group" aria-label="태그 제거" className={ui.stack}>
          <span>태그 제거</span>
          {removableTags.length === 0 && <p className={ui.muted}>선택한 거래에 태그가 없습니다.</p>}
          {removableTags.map(([tag, count]) => <Checkbox key={tag} isSelected={removedTags.includes(tag)}
            onChange={(checked) => setRemovedTags((current) => checked ? [...current, tag] : current.filter((value) => value !== tag))}>
            #{tag} · {count}건
          </Checkbox>)}
        </div>
        {tooManyTags && <p role="alert" className={ui.alert}>태그 추가·제거는 각각 최대 20개까지 가능합니다.</p>}
        {overflowing > 0 && <p role="alert" className={ui.alert}>{overflowing}건은 메모가 1,000자를 넘어 태그를 추가할 수 없습니다.</p>}
        {bulkUpdate.isError && <p role="alert" className={ui.alert}>{errorMessage(bulkUpdate.error)}</p>}
        <div className={styles.bulkActions}>
          <button type="submit" className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={disabled}>{saving ? '저장 중' : '적용'}</button>
        </div>
      </form>
    </Dialog>
  )
}
