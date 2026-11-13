import { useQuery } from '@tanstack/react-query'
import Dialog from '../common/Dialog'
import Icon from '../common/Icon'
import Skeleton, { SkeletonRegion } from '../common/Skeleton'
import ui from '../common/ui.module.css'
import { formatInstant } from '../common/format'
import { importsApi } from './importsApi'

/** 지금까지 올린 파일 목록. 월별 등록 현황 머리의 아이콘 버튼으로 연다. */
export default function UploadHistoryDialog({ onClose }: { onClose: () => void }) {
  const history = useQuery({ queryKey: ['imports'], queryFn: importsApi.history })

  return (
    <Dialog title="업로드 이력" onClose={onClose}>
      {history.isPending && <SkeletonRegion><ul className={ui.stack}>
        {[0, 1, 2].map((i) => <li key={i} className={ui.row}><Skeleton width="35%" height="1lh" /><Skeleton width="20%" height="1lh" /><Skeleton width="40%" height="1lh" /></li>)}
      </ul></SkeletonRegion>}
      {history.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>업로드 이력을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void history.refetch()}><Icon name="refresh-cw" size={18} />다시 시도</button>
        </div>
      )}
      {history.data && history.data.length === 0 && <p className={ui.status}>아직 올린 파일이 없습니다.</p>}
      {history.data && history.data.length > 0 && (
        <ul className={ui.stack}>
          {history.data.map((batch) => (
            <li key={batch.batchId} className={ui.row}>
              <strong>{batch.fileName}</strong>
              <span className={ui.muted}>{formatInstant(batch.importedAt)}</span>
              <span className={ui.muted}>신규 {batch.createdRows} · 갱신 {batch.updatedRows} · 변경 없음 {batch.unchangedRows}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
