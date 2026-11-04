import { donutHeight } from '../common/DonutChart'
import Skeleton from '../common/Skeleton'
import ui from '../common/ui.module.css'
import breakdown from './CategoryBreakdown.module.css'
import trendStyles from './CategoryTrend.module.css'
import styles from './ChartSkeletons.module.css'

const LEGEND_ROWS = 6
const CHIPS = [64, 52, 76, 58, 68, 72, 56, 80, 62, 74, 54, 70]

export function DonutLegendSkeleton({ compact }: { compact: boolean }) {
  const height = donutHeight(LEGEND_ROWS, compact)
  return (
    <div className={breakdown.content}>
      <div className={styles.donut} style={{ height }}>
        <Skeleton width={height * (compact ? 0.46 : 0.52)} height="auto" radius="50%" className={styles.ring} />
      </div>
      <div className={breakdown.legend}>
        {Array.from({ length: LEGEND_ROWS }, (_, i) => (
          <div key={i} className={styles.legendRow}>
            <Skeleton width={14} height={14} radius={2} />
            <Skeleton width={`${70 - i * 6}%`} height={12} />
            <Skeleton width={64} height={12} />
            <Skeleton width={40} height={12} />
          </div>
        ))}
        <div className={styles.legendAction}><Skeleton width={120} height="var(--control-height)" /></div>
      </div>
    </div>
  )
}

export function CategoryShareSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className={`${ui.card} ${breakdown.card}`}>
      <div className={trendStyles.header}>
        <Skeleton width={80} height={20} />
        <Skeleton width={82} height={42} />
      </div>
      <DonutLegendSkeleton compact={compact} />
    </div>
  )
}

export function TrendSkeleton({ compact }: { compact: boolean }) {
  return (
    <>
      <div className={trendStyles.chips}>
        {CHIPS.map((width, i) => <Skeleton key={i} width={width} height="var(--control-height)" />)}
      </div>
      <Skeleton height={compact ? 240 : 300} />
    </>
  )
}
