import { useIsMutating } from '@tanstack/react-query'
import { useState } from 'react'
import Modal from '../common/Modal'
import { errorMessage } from '../common/errorMessage'
import { formatMonthLabel } from '../common/format'
import ui from '../common/ui.module.css'
import UploadForm from '../imports/UploadForm'
import type { CoverageMonth } from './coverageApi'
import styles from './HomePage.module.css'
import { useDeleteMonth } from './useDeleteMonth'

type Props = { coverage: CoverageMonth; onClose: () => void; onDeleted: (message: string) => void }
type Step = 'summary' | 'upload' | 'confirm'

/** 등록된 달의 건수, 다시 업로드, 영구 삭제. 삭제는 월(YYYY-MM)을 똑같이 입력해야 켜진다. */
export default function MonthDataDialog({ coverage, onClose, onDeleted }: Props) {
  const { month, importedCount, manualCount } = coverage
  const label = formatMonthLabel(month)
  const [step, setStep] = useState<Step>('summary')
  const [includeManual, setIncludeManual] = useState(false)
  const [typed, setTyped] = useState('')
  const remove = useDeleteMonth()
  const uploading = useIsMutating({ mutationKey: ['upload'] }) > 0
  const target = includeManual ? `거래 ${importedCount + manualCount}건` : `업로드한 거래 ${importedCount}건`

  function cancelConfirm() {
    setTyped('')
    setIncludeManual(false)
    remove.reset()
    setStep('summary')
  }

  function confirmDelete() {
    remove.mutate({ month, includeManual }, {
      onSuccess: (result) => onDeleted(`${label} 거래 ${result.deletedImported + result.deletedManual}건을 삭제했습니다.`),
    })
  }

  return (
    <Modal title={`${label} 데이터`} onClose={onClose} closeDisabled={uploading || remove.isPending}>
      {step === 'summary' && (
        <div className={ui.stack}>
          <dl className={styles.totals}>
            <div><dt>업로드한 거래</dt><dd>{importedCount}건</dd></div>
            {manualCount > 0 && <div><dt>직접 추가한 거래</dt><dd>{manualCount}건</dd></div>}
          </dl>
          {uploading && <p className={ui.status}>업로드가 끝난 뒤 삭제할 수 있습니다.</p>}
          <div className={ui.row}>
            <button type="button" className={ui.button} onClick={() => setStep('upload')}>다시 업로드</button>
            <button type="button" className={`${ui.button} ${ui.danger}`} disabled={uploading}
              onClick={() => setStep('confirm')}>이 달 데이터 삭제</button>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <>
          <p className={ui.status}>뱅크샐러드에서 내려받은 엑셀(.xlsx)을 올려주세요. 여러 달이 들어 있어도 거래 일자에 맞게 반영됩니다.</p>
          <UploadForm />
        </>
      )}

      {step === 'confirm' && (
        <div className={ui.stack}>
          <p>
            {target}을 영구 삭제합니다. 바꾼 카테고리·메모·숨김과 수정 이력도 함께 사라집니다.
            같은 엑셀을 다시 올리면 거래는 돌아오지만 수정한 내용은 돌아오지 않습니다.
          </p>
          {manualCount > 0 && (
            <label className={styles.check}>
              <input type="checkbox" checked={includeManual} disabled={remove.isPending}
                onChange={(e) => setIncludeManual(e.target.checked)} />
              <span>직접 추가한 거래 {manualCount}건도 함께 삭제</span>
            </label>
          )}
          <label className={ui.field}>
            <span>삭제하려면 {month}를 입력하세요</span>
            <input className={ui.input} value={typed} autoComplete="off" disabled={remove.isPending}
              onChange={(e) => setTyped(e.target.value)} />
          </label>
          {uploading && <p className={ui.status}>업로드가 끝난 뒤 삭제할 수 있습니다.</p>}
          {remove.isError && <p role="alert" className={ui.alert}>{errorMessage(remove.error)}</p>}
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={remove.isPending}
              onClick={cancelConfirm}>취소</button>
            <button type="button" className={`${ui.button} ${ui.danger}`}
              disabled={typed !== month || uploading || remove.isPending}
              onClick={confirmDelete}>삭제</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
