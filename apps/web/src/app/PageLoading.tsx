import { useMediaQuery } from '../common/useMediaQuery'
import ui from '../common/ui.module.css'
import Skeleton, { SkeletonRegion } from '../common/Skeleton'
import header from '../common/PageHeader.module.css'

export default function PageLoading() {
  return <p className={ui.status}>불러오는 중입니다.</p>
}

export function AppPageLoading() {
  const narrow = useMediaQuery('(max-width: 820px)')
  return <SkeletonRegion><div className={ui.stack}>
    {!narrow && <div className={header.header}><Skeleton width={120} height="1lh" /></div>}
    <div className={ui.card}><Skeleton width="40%" height="1lh" /><Skeleton height={160} /></div>
  </div></SkeletonRegion>
}
