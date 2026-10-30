import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import Icon from '../common/Icon'
import styles from './ChartViewToggle.module.css'

export default function ChartViewToggle({ title, table = false, value, onChange }: {
  title: string; table?: boolean; value: string; onChange: (value: string) => void
}) {
  return <ToggleButtonGroup aria-label={`${title} 보기 방식`} selectionMode="single" disallowEmptySelection
    selectedKeys={[value]} onSelectionChange={(keys) => {
      const [key] = [...keys]
      if (key != null) onChange(String(key))
    }} className={styles.group}>
    <ToggleButton id="chart" aria-label="차트로 보기" className={styles.button}><Icon name="chart" /></ToggleButton>
    <ToggleButton id="list" aria-label={table ? '표로 보기' : '목록으로 보기'} className={styles.button}><Icon name="list" /></ToggleButton>
  </ToggleButtonGroup>
}
