import { useState, type DragEvent, type FormEvent } from 'react'
import ui from '../common/ui.module.css'
import { uploadErrorMessage, validateUploadFile, type ImportResult } from './importsApi'
import styles from './UploadForm.module.css'
import { useUpload } from './useUpload'

type Props = { onDone?: (result: ImportResult) => void }

export default function UploadForm({ onDone }: Props) {
  const upload = useUpload()
  const [file, setFile] = useState<File | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function choose(next: File | null | undefined) {
    upload.reset()
    if (!next) return
    const problem = validateUploadFile(next)
    setClientError(problem)
    setFile(problem ? null : next)
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    upload.mutate(file, { onSuccess: (result) => onDone?.(result) })
  }

  const error = clientError ?? (upload.isError ? uploadErrorMessage(upload.error) : null)
  const result = upload.data

  return (
    <form className={ui.stack} onSubmit={onSubmit}>
      <label
        className={dragging ? `${styles.drop} ${styles.dragging}` : styles.drop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className={styles.dropTitle}>파일을 끌어다 놓거나 눌러서 선택</span>
        <span className={ui.muted}>.xlsx · 한 번에 최대 3개월치(512KB) · 원본 파일과 개인정보 시트는 저장하지 않습니다</span>
        <input type="file" accept=".xlsx" className={styles.input}
          onChange={(e) => choose(e.target.files?.[0])} />
        {file && <span className={styles.fileName}>{file.name}</span>}
      </label>
      <div className={styles.actions}>
        <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={!file || upload.isPending}>
          {upload.isPending ? '올리는 중' : '업로드'}
        </button>
      </div>
      {error && <p role="alert" className={ui.alert}>{error}</p>}
      {result && (
        <div role="status" className={styles.result}>
          <p className={styles.resultTitle}>업로드가 끝났습니다.</p>
          <dl className={styles.counts}>
            <div><dt>전체</dt><dd>{result.totalRows}건</dd></div>
            <div><dt>신규</dt><dd>{result.createdRows}건</dd></div>
            <div><dt>갱신</dt><dd>{result.updatedRows}건</dd></div>
            <div><dt>변경 없음</dt><dd>{result.unchangedRows}건</dd></div>
          </dl>
        </div>
      )}
    </form>
  )
}
