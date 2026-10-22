import { useState, type FormEvent } from 'react'
import { Button, DropZone, FileTrigger } from 'react-aria-components'
import { useMediaQuery } from '../common/useMediaQuery'
import Icon from '../common/Icon'
import ui from '../common/ui.module.css'
import { ACCEPTED_UPLOAD_FILE_TYPES, uploadErrorMessage, validateUploadFile, type ImportResult } from './importsApi'
import styles from './UploadForm.module.css'
import { useUpload } from './useUpload'

type Props = { onDone?: (result: ImportResult) => void }

export default function UploadForm({ onDone }: Props) {
  const upload = useUpload()
  const [file, setFile] = useState<File | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const mobile = useMediaQuery('(max-width: 820px)')

  function choose(next: File | null | undefined) {
    upload.reset()
    if (!next) return
    const problem = validateUploadFile(next)
    setClientError(problem)
    setFile(problem ? null : next)
  }

  function clearFile() {
    setFile(null)
    setClientError(null)
    upload.reset()
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
      <DropZone className={styles.drop} aria-label="엑셀 파일 업로드"
        onDrop={async (event) => {
          const item = event.items.find((item) => item.kind === 'file')
          if (item?.kind === 'file') choose(await item.getFile())
        }}>
        <span className={styles.dropIcon}><Icon name="sheet-upload" size={32} /></span>
        <span className={styles.dropTitle}>{mobile
          ? '파일 선택 버튼을 눌러 엑셀 파일을 고르세요'
          : '파일을 끌어다 놓거나 파일 선택 버튼을 누르세요'}</span>
        <span className={ui.muted}>.xlsx · 한 번에 최대 3개월치 · 512KB 이하 · 원본 파일과 개인정보 시트는 저장하지 않습니다</span>
        <FileTrigger acceptedFileTypes={ACCEPTED_UPLOAD_FILE_TYPES} onSelect={(files) => choose(files?.[0])}>
          <Button className={`${ui.button} ${styles.choose}`}>파일 선택</Button>
        </FileTrigger>
        {file && (
          <span className={styles.fileChip}>
            <Icon name="sheet-upload" size={18} />
            <span className={styles.fileName}>{file.name}</span>
            <span>{Math.ceil(file.size / 1024)} KB</span>
            <Button className={styles.clear} onPress={clearFile} isDisabled={upload.isPending}>
              <Icon name="x" size={18} /><span>선택 취소</span>
            </Button>
          </span>
        )}
      </DropZone>
      <div className={styles.actions}>
        <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={!file || upload.isPending}>
          <Icon name="upload" size={18} />{upload.isPending ? '올리는 중' : '업로드'}
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
