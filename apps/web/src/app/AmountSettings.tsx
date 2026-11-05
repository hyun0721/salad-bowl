import { Button, DialogTrigger } from 'react-aria-components'
import { useAmountMask } from '../common/AmountMask'
import BottomSheet from '../common/BottomSheet'
import Icon from '../common/Icon'
import { ResponsiveOverlay } from '../common/ResponsiveOverlay'
import Switch from '../common/Switch'
import styles from './AppLayout.module.css'

function SettingsContent() {
  const { hidden, setHidden } = useAmountMask()
  return <div className={styles.settingsContent}>
    <h3>금액 숨기기</h3>
    <Switch isSelected={hidden.INCOME} onChange={(value) => setHidden('INCOME', value)}>수입 금액 숨기기</Switch>
    <Switch isSelected={hidden.EXPENSE} onChange={(value) => setHidden('EXPENSE', value)}>지출 금액 숨기기</Switch>
    <Switch isSelected={hidden.TRANSFER} onChange={(value) => setHidden('TRANSFER', value)}>이체 금액 숨기기</Switch>
  </div>
}

export default function AmountSettings({ narrow }: { narrow: boolean }) {
  return narrow ? <BottomSheet title="설정" triggerLabel="설정" triggerIcon="settings">
    {() => <SettingsContent />}
  </BottomSheet> : <DialogTrigger>
    <Button className={`${styles.logout} ${styles.settingsTrigger}`} aria-label="설정"><Icon name="settings" size={18} />설정</Button>
    <ResponsiveOverlay mobile={false} title="설정"><SettingsContent /></ResponsiveOverlay>
  </DialogTrigger>
}
