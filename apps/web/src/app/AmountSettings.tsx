import { useState } from 'react'
import { Button, DialogTrigger } from 'react-aria-components'
import { useAmountMask } from '../common/AmountMask'
import BottomSheet from '../common/BottomSheet'
import Icon from '../common/Icon'
import { ResponsiveOverlay } from '../common/ResponsiveOverlay'
import Select from '../common/Select'
import Switch from '../common/Switch'
import { applyTheme, readTheme, type ThemeChoice } from '../common/theme'
import styles from './AppLayout.module.css'

function SettingsContent() {
  const { hidden, setHidden } = useAmountMask()
  const [theme, setTheme] = useState(readTheme)
  return <div className={styles.settingsContent}>
    <Select label="화면 모드" variant="field" selectedKey={theme} onSelectionChange={(key) => { setTheme(key as ThemeChoice); applyTheme(key as ThemeChoice) }}
      items={[{ id: 'system', label: '시스템', icon: 'monitor' }, { id: 'light', label: '라이트', icon: 'sun' }, { id: 'dark', label: '다크', icon: 'moon' }]} />
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
