import { menuLabel } from '../app/menu'
import PageHeader from '../common/PageHeader'
import Select from '../common/Select'
import ui from '../common/ui.module.css'
import { useTaxYear } from './TaxYearProvider'

type Props = { title?: string; note?: string }

/** 소득공제 화면 머리: 제목(넓은 화면), 오른쪽 귀속연도 선택, 아래 한 줄 안내(기본은 개인 자료 표시, TAX-13). */
export default function TaxHeader({ title = menuLabel('/tax'), note = '개인 자료 · 그룹과 무관' }: Props) {
  const { year, setYear, choices } = useTaxYear()
  return (
    <>
      <PageHeader title={title} action={
        <Select label="귀속연도" items={choices.map((y) => ({ id: y, label: `${y}년` }))}
          selectedKey={year} onSelectionChange={(key) => { if (key != null) setYear(Number(key)) }} />
      } />
      <p className={ui.muted}>{note}</p>
    </>
  )
}
