import { Navigate } from 'react-router'
import Skeleton, { SkeletonRegion } from '../common/Skeleton'
import { useTaxYear } from './TaxYearProvider'
import { useTaxYearView } from './taxApi'

/**
 * "소득공제" 메뉴의 진입(TAX-68). 선택 연도(기억한 값이 없으면 올해)의 연도 기록에 입력자료가 1건 이상 있으면(미완료 포함)
 * 분석·지출계획의 ① 현황, 연도 기록이 없거나 자료가 없으면 입력자료로 보낸다. 읽기에 실패하면 입력자료가 오류와 다시 시도를 보인다.
 */
export default function TaxIndexRedirect() {
  const { year } = useTaxYear()
  const record = useTaxYearView(year)
  if (record.isPending) {
    return <SkeletonRegion label="소득공제 불러오는 중"><Skeleton height={160} radius="var(--radius-md)" /></SkeletonRegion>
  }
  return <Navigate to={record.data?.hasInputs ? '/tax/analysis' : '/tax/inputs'} replace />
}
