import type { ReactNode } from 'react'
import { SelectionIndicator, SharedElementTransition } from 'react-aria-components'

/** 이 안의 Indicator들 중 선택된 것으로 표시선이 미끄러져 옮겨 간다. */
export function IndicatorGroup({ children }: { children: ReactNode }) {
  return <SharedElementTransition>{children}</SharedElementTransition>
}

// data-indicator는 테스트가 표시선 위치를 찾는 표식이다.
export function Indicator({ isSelected, className }: { isSelected: boolean; className?: string }) {
  return <SelectionIndicator isSelected={isSelected} className={className} data-indicator="" />
}
