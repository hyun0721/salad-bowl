import { useQuery } from '@tanstack/react-query'
import ui from '../common/ui.module.css'
import { formatDateTime } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { importsApi } from './importsApi'
import UploadForm from './UploadForm'

export default function UploadPage() {
  usePageTitle('업로드')
  const history = useQuery({ queryKey: ['imports'], queryFn: importsApi.history })

  return (
    <>
      <h1>뱅크샐러드 엑셀 업로드</h1>
      <section aria-labelledby="upload-title" className={ui.card}>
        <h2 id="upload-title">파일 올리기</h2>
        <ol className={ui.stack}>
          <li>뱅크샐러드 앱에서 가계부 엑셀을 내려받습니다.</li>
          <li>파일을 그대로 올립니다. 여러 달이 들어 있어도 됩니다.</li>
          <li>이미 있는 거래는 건너뛰고, 내가 고친 카테고리·메모는 유지됩니다.</li>
        </ol>
        <UploadForm />
      </section>
      <section aria-labelledby="history-title" className={ui.card}>
        <h2 id="history-title">업로드 이력</h2>
        {history.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
        {history.isError && (
          <div className={ui.row}>
            <p role="alert" className={ui.alert}>업로드 이력을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void history.refetch()}>다시 시도</button>
          </div>
        )}
        {history.data && history.data.length === 0 && <p className={ui.status}>아직 올린 파일이 없습니다.</p>}
        {history.data && history.data.length > 0 && (
          <ul className={ui.stack}>
            {history.data.map((batch) => (
              <li key={batch.batchId} className={ui.row}>
                <strong>{batch.fileName}</strong>
                <span className={ui.muted}>{formatDateTime(batch.importedAt)}</span>
                <span className={ui.muted}>신규 {batch.createdRows} · 갱신 {batch.updatedRows} · 변경 없음 {batch.unchangedRows}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
