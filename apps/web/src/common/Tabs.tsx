import type { ReactNode } from 'react'
import { Tab, TabList, TabPanel, Tabs as AriaTabs } from 'react-aria-components'
import styles from './Tabs.module.css'

type Props = {
  label: string
  tabs: { id: string; label: string }[]
  selectedKey: string
  onSelectionChange: (id: string) => void
  children: (id: string) => ReactNode
  className?: string
}

/** 방향키·Home·End로 탭을 옮기는 탭 묶음. 선택된 탭의 패널만 그린다. */
export default function Tabs({ label, tabs, selectedKey, onSelectionChange, children, className }: Props) {
  return (
    <AriaTabs selectedKey={selectedKey} onSelectionChange={(key) => onSelectionChange(String(key))} className={className}>
      <TabList aria-label={label} className={styles.list}>
        {tabs.map((t) => <Tab key={t.id} id={t.id} className={styles.tab}>{t.label}</Tab>)}
      </TabList>
      {tabs.map((t) => (
        <TabPanel key={t.id} id={t.id} className={styles.panel}>{children(t.id)}</TabPanel>
      ))}
    </AriaTabs>
  )
}
