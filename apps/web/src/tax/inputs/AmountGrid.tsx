import HelpButton from '../../common/HelpButton'
import MoneyField from '../../common/MoneyField'
import ui from '../../common/ui.module.css'
import { countBlanks, fillBlanks, type AmountGroup } from './amounts'
import styles from './inputs.module.css'

type Props<K extends string> = {
  groups: AmountGroup<K>[]
  values: Record<K, number | null>
  onChange: (values: Record<K, number | null>) => void
}

/**
 * 공제대상액 입력표. 묶음(fieldset)마다 2열로 놓아 375px에서도 가로 스크롤이 없다.
 * 빈 칸은 null(모름)로 두고 0(없음)과 구별한다(TAX-24).
 */
export default function AmountGrid<K extends string>({ groups, values, onChange }: Props<K>) {
  const blanks = countBlanks(values)
  return (
    <div className={ui.stack}>
      <div className={styles.titleWithHelp}>
        <p className={styles.gridTitle}>공제대상액 (원)</p>
        <HelpButton title="공제대상액">
          카드사 명세서나 국세청 자료의 1월 1일부터 기준일까지 누계를 적습니다. 전체 사용액에서 전통시장·대중교통·문화체육 사용액을 뺀 나머지를 일반에 적고, 취소·환불이 반영된 금액을 그대로 씁니다. 이전 값에 더하지 않고 새 누계로 덮어씁니다.
        </HelpButton>
      </div>
      <p className={ui.muted}>"일반"은 전통시장·대중교통·문화체육을 뺀 금액입니다. 빈 칸은 "모름", 0은 "없음"입니다.</p>
      {groups.map((group) => (
        <fieldset key={group.legend} className={styles.amountGroup}>
          <legend>{group.legend}</legend>
          {group.fields.map((field) => (
            <MoneyField key={field.key} label={field.label} value={values[field.key]} minValue={0}
              onChange={(value) => onChange({ ...values, [field.key]: value })} />
          ))}
        </fieldset>
      ))}
      <div className={styles.split}>
        <p className={ui.muted}>{blanks > 0 ? `빈 칸 ${blanks}개 · 빈 칸이 있으면 미완료로 저장됩니다.` : '빈 칸 없음'}</p>
        <button type="button" className={ui.button} disabled={blanks === 0} onClick={() => onChange(fillBlanks(values))}>
          빈 칸 0원으로 채우기
        </button>
      </div>
    </div>
  )
}
