import { useId } from 'react'
import styles from './DonutChart.module.css'

export type DonutSlice = { id: string; label: string; value: number }

type Pattern = 'solid' | 'diag45' | 'diag135'

type Props = {
  slices: DonutSlice[]
  centerLabel: string
  centerValue: string
  activeId: string | null
  onActiveChange: (id: string | null) => void
  onSelect: (id: string) => void
  className?: string
}

const SLOTS = 8
const SIZE = 200
const C = SIZE / 2
const OUTER = 96
const INNER = 62

/** 9번째 색은 만들지 않고 같은 8색에 빗금을 얹어 구분한다. 25번째부터는 마지막 스타일을 되풀이한다. */
// oxlint-disable-next-line react/only-export-components
export function sliceStyle(index: number): { slot: number; pattern: Pattern } {
  const tier = Math.min(Math.floor(index / SLOTS), 2)
  return { slot: (index % SLOTS) + 1, pattern: (['solid', 'diag45', 'diag135'] as const)[tier] }
}

function point(r: number, angle: number) {
  // 12시 방향이 0, 시계 방향으로 커진다.
  const x = C + r * Math.sin(angle)
  const y = C - r * Math.cos(angle)
  return `${+x.toFixed(3)} ${+y.toFixed(3)}`
}

function arcPath(start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0
  return `M ${point(OUTER, start)} A ${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end)}`
    + ` L ${point(INNER, end)} A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)} Z`
}

// 시작과 끝이 같은 점이면 호가 그려지지 않으므로 바깥·안쪽 원을 각각 반원 두 개로 잇는다.
const RING = `M ${point(OUTER, 0)} A ${OUTER} ${OUTER} 0 0 1 ${point(OUTER, Math.PI)} A ${OUTER} ${OUTER} 0 0 1 ${point(OUTER, 0)} Z`
  + ` M ${point(INNER, 0)} A ${INNER} ${INNER} 0 0 0 ${point(INNER, Math.PI)} A ${INNER} ${INNER} 0 0 0 ${point(INNER, 0)} Z`

/** 순수 SVG 도넛. 접근 가능한 컨트롤은 옆의 목록 행이 맡으므로 차트 자체는 보조 기술에서 숨긴다. */
export default function DonutChart({ slices, centerLabel, centerValue, activeId, onActiveChange, onSelect, className }: Props) {
  // url(#…) 안에서 깨지지 않도록 useId의 특수 문자를 뺀다.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  const ends = slices.map((_, i) => slices.slice(0, i + 1).reduce((sum, s) => sum + s.value, 0))
  const toAngle = (v: number) => (total > 0 ? (v / total) * Math.PI * 2 : 0)
  const shapes = slices.map((slice, index) => {
    const start = toAngle(index === 0 ? 0 : ends[index - 1])
    const end = toAngle(ends[index])
    const style = sliceStyle(index)
    const color = `var(--chart-${style.slot})`
    const patternId = `${uid}-${style.pattern}-${style.slot}`
    return {
      slice, style, color, patternId,
      d: slices.length === 1 ? RING : arcPath(start, end),
      fill: style.pattern === 'solid' ? color : `url(#${patternId})`,
    }
  })
  const patterns = new Map(shapes.filter((s) => s.style.pattern !== 'solid').map((s) => [s.patternId, s]))
  const active = shapes.find((s) => s.slice.id === activeId)

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className={className ? `${styles.chart} ${className}` : styles.chart}>
      <defs>
        {[...patterns.values()].map(({ patternId, color, style }) => (
          <pattern key={patternId} id={patternId} width="6" height="6" patternUnits="userSpaceOnUse"
            patternTransform={style.pattern === 'diag45' ? 'rotate(45)' : 'rotate(135)'}>
            <rect width="6" height="6" style={{ fill: color }} />
            {/* 어두운 같은 색 대신 카드 배경색으로 그어 두 모드 모두에서 보이게 한다. */}
            <line x1="3" y1="0" x2="3" y2="6" className={styles.hatch} />
          </pattern>
        ))}
      </defs>
      {shapes.map(({ slice, d, fill }) => (
        <path key={slice.id} d={d} fillRule="evenodd" style={{ fill }}
          className={slice.id === activeId ? `${styles.slice} ${styles.active}` : styles.slice}
          onClick={() => onSelect(slice.id)}
          onPointerEnter={() => onActiveChange(slice.id)}
          onPointerLeave={() => onActiveChange(null)} />
      ))}
      {/* 이웃 조각의 간격 선에 가리지 않도록 윤곽선은 맨 위에 따로 그린다. */}
      {active && <path d={active.d} fillRule="evenodd" className={styles.outline} />}
      <text x={C} y={C - 6} className={styles.centerLabel}>{centerLabel}</text>
      <text x={C} y={C + 16} className={styles.centerValue}>{centerValue}</text>
    </svg>
  )
}
