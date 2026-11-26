import { Fragment } from 'react'
import { formatWon } from '../../common/format'
import HelpButton from '../../common/HelpButton'
import ui from '../../common/ui.module.css'
import inputs from '../inputs/inputs.module.css'
import { LAW_FIELDS, lawHistory, type LawVersion } from './taxLawApi'

/** 상세 머리: 귀속연도·번호·상태, 고정된 계산 알고리즘 버전(TAX-62), 작성·적용 기록(TAX-67). section의 이름이 된다. */
export function LawDetailHeading({ version }: { version: LawVersion }) {
  return (
    <div className={inputs.rowInfo}>
      <div className={inputs.titleWithHelp}>
        <h2 id="law-detail-title" tabIndex={-1}>{version.taxYear}년 귀속 v{version.versionNo} · {version.status === 'DRAFT' ? '초안' : '적용 · 읽기 전용'}</h2>
        <HelpButton title="세법 수치">
          총급여가 급여구간 경계 금액 이하이면 "경계 이하", 넘으면 "경계 초과"의 기본한도와 추가한도 상한을 써요. 추가한도 상한은 기본한도를 넘은 전통시장·대중교통·문화체육 공제액을 더 인정하는 최대 금액이에요. 문화체육 공제율은 경계 이하에만 적용돼요(계산 알고리즘에 고정). 자녀등 조건이 없는 연도는 세 단계에 같은 값을 넣으세요.
        </HelpButton>
      </div>
      <p className={ui.muted}>계산 알고리즘 버전 {version.algorithmVersion} (고정)</p>
      <p className={ui.muted}>{lawHistory(version)}</p>
    </div>
  )
}

function show(kind: (typeof LAW_FIELDS)[number]['kind'], value: number | string | null) {
  if (value === null || value === '') return '—'
  if (kind === 'pct') return `${value}%`
  if (kind === 'won') return formatWon(Number(value))
  // http(s)만 링크로 그린다. 초안이나 손으로 고친 값에 javascript: 같은 주소가 있어도 링크가 되지 않는다.
  if (kind === 'url' && /^https?:\/\//i.test(String(value))) return <a href={String(value)} target="_blank" rel="noreferrer">{value}</a>
  return value
}

/** 버전을 글로만 보인다. 적용본은 고칠 수 없으므로 입력란 없이 읽기 전용 텍스트다(UI 표준: 고칠 수 없는 값은 읽기 전용 텍스트). */
export default function LawVersionFacts({ version }: { version: LawVersion }) {
  return (
    <section aria-labelledby="law-detail-title" className={ui.card}>
      <LawDetailHeading version={version} />
      {version.status === 'APPLIED' && <p className={ui.status}>적용된 버전은 고칠 수 없어요. 바꾸려면 새 초안을 만드세요.</p>}
      <dl className={inputs.facts}>
        {LAW_FIELDS.map((f) => (
          <Fragment key={f.field}>
            <dt>{f.label}</dt>
            <dd className={f.kind === 'won' ? inputs.amount : undefined}>{show(f.kind, f.get(version))}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  )
}
