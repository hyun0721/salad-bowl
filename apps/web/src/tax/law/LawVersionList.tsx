import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ConfirmDialog from '../../common/ConfirmDialog'
import { errorMessage } from '../../common/errorMessage'
import Icon from '../../common/Icon'
import ui from '../../common/ui.module.css'
import inputs from '../inputs/inputs.module.css'
import { actionError, isStale, taxApi, taxKeys } from '../taxApi'
import { lawTime, taxLawApi, taxLawKeys, type LawVersion } from './taxLawApi'
import styles from './law.module.css'

type Props = { year: number; versions: LawVersion[]; selectedId: number | undefined; onSelect: (id: number) => void; onReload: (showNotice?: boolean) => void; onDeleted: () => void }

/** 한 귀속연도의 버전 목록(번호 내림차순, 서버 순서 그대로). 초안이 있어도 새 초안을 만들 수 있다(TAX-72). */
export default function LawVersionList({ year, versions, selectedId, onSelect, onReload, onDeleted }: Props) {
  const client = useQueryClient()
  // 현재 적용 버전은 서버 규칙(가장 늦게 적용한 것)을 따른다. 화면에서 다시 판단하지 않는다.
  const current = useQuery({ queryKey: taxKeys.currentLaw(year), queryFn: () => taxApi.currentLaw(year) })
  const create = useMutation({
    mutationFn: () => taxLawApi.create(year),
    onSuccess: (created) => {
      client.setQueryData<LawVersion[]>(taxLawKeys.list(year), (old) => [created, ...(old ?? [])])
      onSelect(created.id)
    },
  })
  const drafts = versions.filter((v) => v.status === 'DRAFT').length
  const applied = current.isSuccess ? (current.data ? `현재 적용 v${current.data.versionNo}` : '적용 버전 없음(회원 화면은 "세법 준비 중")') : null
  return (
    <section aria-labelledby="law-versions-title" className={ui.card}>
      <div className={inputs.split}>
        <div className={inputs.rowInfo}>
          <h2 id="law-versions-title" tabIndex={-1}>{year}년 버전</h2>
          <p className={ui.muted}>{[applied, `초안 ${drafts}개`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className={inputs.actions}>
          <button type="button" className={ui.button} disabled={create.isPending} onClick={() => create.mutate()}>
            <Icon name="plus" size={18} />새 초안 만들기
          </button>
        </div>
      </div>
      {create.error && <p role="alert" className={ui.alert}>{errorMessage(create.error)}</p>}
      {versions.length === 0 ? (
        <p className={ui.status}>{year}년 귀속 세법 버전이 없습니다. [새 초안 만들기]로 시작합니다.</p>
      ) : (
        <ul className={`${inputs.list} ${styles.versions}`}>
          {versions.map((v) => (
            <li key={v.id} className={inputs.split}>
              <button type="button" className={styles.version} aria-current={v.id === selectedId ? 'true' : undefined} onClick={() => onSelect(v.id)}>
                <span className={inputs.name}>v{v.versionNo} · {v.status === 'DRAFT' ? '초안' : v.id === current.data?.id ? '현재 적용' : '적용'}</span>
                <span className={ui.muted}>
                  {v.appliedAt ? `적용 ${v.appliedByNickname ?? '—'} · ${lawTime(v.appliedAt)}` : `작성 ${v.createdByNickname ?? '—'} · ${lawTime(v.createdAt)}`}
                </span>
              </button>
              {v.status === 'DRAFT' && <div className={inputs.actions}><DeleteDraft version={v} onReload={onReload} onDeleted={onDeleted} /></div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 초안 삭제는 확인 한 번(TAX-72). 적용본에는 이 버튼이 없다. 삭제는 204라 목록을 다시 읽는다. */
function DeleteDraft({ version, onReload, onDeleted }: { version: LawVersion; onReload: (showNotice?: boolean) => void; onDeleted: () => void }) {
  const client = useQueryClient()
  const reload = () => client.invalidateQueries({ queryKey: taxLawKeys.list(version.taxYear) })
  const remove = useMutation({
    mutationFn: () => taxLawApi.remove(version.id, version.rowVersion),
    onSuccess: () => reload(),
  })
  const name = `${version.taxYear}년 귀속 v${version.versionNo}`
  return (
    <ConfirmDialog centered triggerLabel="삭제" triggerAriaLabel={`v${version.versionNo} 초안 삭제`}
      title={`${name} 초안을 삭제할까요?`} description="이 초안에 입력한 값이 지워집니다. 적용된 버전과 다른 초안은 남습니다. 복구할 수 없습니다."
      confirmLabel="삭제" isPending={remove.isPending} error={remove.error ? actionError(remove.error) : null}
      onOpen={() => remove.reset()} onConfirm={(close) => remove.mutate(undefined, {
        onSuccess: () => { close(); onDeleted() },
        onError: (error) => { if (isStale(error)) { close(); onReload(true) } },
      })} />
  )
}
