import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Dialog from '../../common/Dialog'
import TextField from '../../common/TextField'
import { toast } from '../../common/Toast'
import ui from '../../common/ui.module.css'
import { actionError, isStale, taxApi, taxKeys, type TaxYearView } from '../taxApi'

/** 연도 기록 삭제 확인(D22). 귀속연도 4자리를 똑같이 입력해야 [삭제]가 켜진다. 닫으면 입력이 사라진다(창을 조건부로 그린다). */
export default function DeleteYearDialog({ view, onClose }: { view: TaxYearView; onClose: () => void }) {
  const year = view.taxYear
  const client = useQueryClient()
  const [typed, setTyped] = useState('')
  const remove = useMutation({
    mutationFn: () => taxApi.deleteYear(year, view.rowVersion),
    onSuccess: () => {
      client.setQueryData(taxKeys.year(year), null)
      toast(`${year}년 기록을 삭제했습니다.`)
      onClose()
    },
    // 다른 곳에서 바뀌었으면 새로 불러온다. 지울 범위 문장도 새 값으로 바뀐다.
    onError: (error) => { if (isStale(error)) void client.invalidateQueries({ queryKey: taxKeys.year(year) }) },
  })

  return (
    <Dialog title={`${year}년 기록을 삭제할까요?`} onClose={onClose} closeDisabled={remove.isPending} centered footer={
        <div className={ui.confirmActions}>
          <button type="button" className={ui.button} disabled={remove.isPending} onClick={onClose}>취소</button>
          <button type="button" className={`${ui.button} ${ui.dangerFill} ${ui.cta}`}
            disabled={typed !== String(year) || remove.isPending} onClick={() => remove.mutate()}>삭제</button>
        </div>
      }>
      <p>{year}년 귀속의 기본정보, 신용·체크 자료 {view.cards.length}건, 현금영수증 자료, 지출계획이 모두 지워집니다. 다른 연도의 기록은 남습니다. 복구할 수 없습니다.</p>
      {remove.error && <p role="alert" className={ui.alert}>{actionError(remove.error)}</p>}
      <TextField label={`확인을 위해 귀속연도(${year})를 입력하세요`} value={typed} onChange={setTyped} autoComplete="off" inputMode="numeric" />
    </Dialog>
  )
}
