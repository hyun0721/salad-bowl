import { menuLabel } from '../app/menu'
import PageHeader from '../common/PageHeader'
import Icon from '../common/Icon'
import stepper from '../common/Stepper.module.css'
import ui from '../common/ui.module.css'
import { useTaxYear } from './TaxYearProvider'

type Props = { title?: string; note?: string }

export default function TaxHeader({ title = menuLabel('/tax'), note = '개인 자료 · 그룹과 무관' }: Props) {
  const { year, setYear, choices } = useTaxYear()
  return (
    <>
      <PageHeader title={title} />
      <div className={stepper.stepper} role="group" aria-label="귀속연도">
        <button type="button" className={`${ui.button} ${stepper.step}`} aria-label="이전 연도"
          aria-disabled={year === choices[0]} onClick={() => { if (year !== choices[0]) setYear(choices[choices.indexOf(year) - 1]) }}><Icon name="chevron-left" size={18} /></button>
        <span aria-live="polite" className={`${stepper.value} ${stepper.text} ${stepper.year}`}>{year}년</span>
        <button type="button" className={`${ui.button} ${stepper.step}`} aria-label="다음 연도"
          aria-disabled={year === choices[choices.length - 1]} onClick={() => { if (year !== choices[choices.length - 1]) setYear(choices[choices.indexOf(year) + 1]) }}><Icon name="chevron-right" size={18} /></button>
      </div>
      <p className={ui.muted}>{note}</p>
    </>
  )
}
