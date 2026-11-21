import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/errors'
import { menuLabel } from '../../app/menu'
import { useAuth } from '../../auth/AuthProvider'
import Icon from '../../common/Icon'
import PageHeader from '../../common/PageHeader'
import Skeleton, { SkeletonRegion } from '../../common/Skeleton'
import ui from '../../common/ui.module.css'
import { usePageTitle } from '../../common/usePageTitle'
import inputs from '../inputs/inputs.module.css'
import TaxHeader from '../TaxHeader'
import TaxTabs from '../TaxTabs'
import { useTaxYear } from '../TaxYearProvider'
import LawVersionFacts from './LawVersionFacts'
import LawVersionList from './LawVersionList'
import { taxLawApi, taxLawKeys } from './taxLawApi'
import styles from './law.module.css'

/**
 * 소득공제 › 연도별 세법 관리(서비스 관리자 전용, TAX-04·11). 메뉴를 숨기는 것은 편의이고 권한은 서버가 요청마다 판단한다.
 * 관리자가 아니면(`/me`의 serviceAdmin, 또는 서버 403) 요청 없이 권한 없음 화면을 보인다(TAX-06).
 */
export default function TaxLawPage() {
  const title = menuLabel('/tax/law')
  usePageTitle(`${title} · 소득공제`)
  const { me } = useAuth()
  const admin = me?.serviceAdmin === true
  const { year } = useTaxYear()
  const list = useQuery({ queryKey: taxLawKeys.list(year), queryFn: () => taxLawApi.list(year), enabled: admin })
  const [selectedId, setSelectedId] = useState<number | null>(null)

  if (!admin || (list.error instanceof ApiError && list.error.status === 403)) return <NoPermission title={title} />
  const versions = list.data ?? []
  // 고른 버전이 목록에 없으면(연도를 바꿨거나 지워짐) 가장 최근 번호를 연다.
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0]
  return (
    <div className={inputs.page}>
      <TaxHeader title={title} note="모든 회원의 계산에 쓰는 기준 · 서비스 관리자 전용" />
      <TaxTabs />
      {list.isPending && <SkeletonRegion label="세법 버전 불러오는 중"><Skeleton height={160} radius="var(--radius-md)" /></SkeletonRegion>}
      {list.isError && (
        <div className={inputs.split}>
          <p role="alert" className={ui.alert}>세법 버전을 불러오지 못했습니다.</p>
          <div className={inputs.actions}>
            <button type="button" className={ui.button} onClick={() => void list.refetch()}><Icon name="refresh-cw" size={18} />다시 시도</button>
          </div>
        </div>
      )}
      {list.isSuccess && (
        <div className={styles.columns}>
          <LawVersionList year={year} versions={versions} selectedId={selected?.id} onSelect={setSelectedId} />
          {selected && <LawVersionFacts version={selected} />}
        </div>
      )}
    </div>
  )
}

function NoPermission({ title }: { title: string }) {
  return (
    <div className={inputs.page}>
      <PageHeader title={title} />
      <section aria-labelledby="law-forbidden-title" className={`${ui.card} ${inputs.empty}`}>
        <h2 id="law-forbidden-title">권한 없음</h2>
        <p>이 화면은 서비스 관리자만 볼 수 있습니다.</p>
        <Link to="/tax/inputs" className={`${ui.button} ${ui.linkButton}`}>입력자료로 가기</Link>
      </section>
    </div>
  )
}
