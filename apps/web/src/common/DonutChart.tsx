import { useId, type CSSProperties } from 'react'
import styles from './DonutChart.module.css'

export type DonutSlice = { id: string; label: string; value: number; detail?: string }

type Pattern = 'solid' | 'diag45' | 'diag135'

type Props = {
  slices: DonutSlice[]
  centerLabel: string
  centerValue: string
  activeId: string | null
  onActiveChange: (id: string | null) => void
  onSelect: (id: string) => void
  compact?: boolean
  className?: string
}

const SLOTS = 8
// 글자 크기를 유지하면서 작은 화면에서는 원과 이름 길이만 줄인다.
// oxlint-disable-next-line react/only-export-components
export const GEOMETRY = {
  regular: { center: 100, outer: 96, inner: 62, labelRadius: 112, labelSize: 13, nameLimit: 6,
    padding: 8, boxPadding: 4, labelGap: 4, ringStep: 19, angleStep: Math.PI / 180, maxShift: 25 * Math.PI / 180,
    centerLabelSize: 13, centerValueSize: 18, valueY: 16, stacked: false, widthLimit: undefined },
  compact: { center: 100, outer: 52, inner: 34, labelRadius: 62, labelSize: 12, nameLimit: 4,
    padding: 8, boxPadding: 4, labelGap: 4, ringStep: 18, angleStep: Math.PI / 180, maxShift: 25 * Math.PI / 180,
    centerLabelSize: 10, centerValueSize: 11, valueY: 11, stacked: true, widthLimit: 300 },
} as const

type Geometry = typeof GEOMETRY[keyof typeof GEOMETRY]
type LabelInput = Pick<DonutSlice, 'id' | 'label' | 'detail'> & { angle: number }
type Box = { x: number; y: number; width: number; height: number }

function boxesOverlap(a: Box, b: Box, gap: number) {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap
    && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap
}

function textWidth(text: string, size: number) {
  return Array.from(text).reduce((width, char) => width + (/[가-힣ㄱ-ㅎㅏ-ㅣ一-鿿…]/u.test(char) ? 1 : 0.6) * size, 0)
}

function placeLabel(input: LabelInput, angle: number, radius: number, geometry: Geometry) {
  const name = shortenLabel(input.label, geometry.nameLimit)
  const stacked = geometry.stacked && !!input.detail
  const width = (stacked ? Math.max(textWidth(name, geometry.labelSize), textWidth(input.detail!, geometry.labelSize))
    : textWidth(`${name}${input.detail ? ` ${input.detail}` : ''}`, geometry.labelSize)) + geometry.boxPadding * 2
  const height = geometry.labelSize * (stacked ? 2 : 1) + geometry.boxPadding * 2
  const lineHeight = stacked ? geometry.labelSize : 0
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  const anchor: 'start' | 'end' | 'middle' = sin > 0.3 ? 'start' : sin < -0.3 ? 'end' : 'middle'
  const x = geometry.center + radius * sin
  const y = geometry.center - radius * cos
  const box = { x: x - (anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0),
    y: y - (cos > 0.3 ? height : cos < -0.3 ? 0 : height / 2), width, height }
  return { id: input.id, name, detail: input.detail, angle, radius, anchor, x, y, box,
    textX: x + (anchor === 'start' ? geometry.boxPadding : anchor === 'end' ? -geometry.boxPadding : 0),
    textY: box.y + (height - lineHeight) / 2, lineHeight }
}

function touchesDonut(box: Box, geometry: Geometry) {
  const x = Math.max(box.x, Math.min(geometry.center, box.x + box.width))
  const y = Math.max(box.y, Math.min(geometry.center, box.y + box.height))
  return Math.hypot(x - geometry.center, y - geometry.center) <= geometry.outer + geometry.labelGap
}

// 원래 조각에서 너무 멀어지지 않게 각도 조정을 제한하고, 남은 충돌만 바깥 원으로 분산한다.
// oxlint-disable-next-line react/only-export-components
export function layoutLabels(inputs: LabelInput[], geometry: Geometry = GEOMETRY.regular) {
  const angles = inputs.map((input) => input.angle)
  let labels = inputs.map((input, index) => placeLabel(input, angles[index], geometry.labelRadius, geometry))
  const order = inputs.map((_, index) => index).sort((a, b) => inputs[a].angle - inputs[b].angle)
  for (let pass = 0; pass < 100; pass++) {
    const shifts = inputs.map(() => 0)
    let collision = false
    for (let a = 0; a < order.length; a++) {
      for (let b = a + 1; b < order.length; b++) {
        const i = order[a]
        const j = order[b]
        if (!boxesOverlap(labels[i].box, labels[j].box, geometry.labelGap)) continue
        collision = true
        // 12시 경계의 이웃도 원의 짧은 방향으로 밀어 지시선이 한 바퀴 돌아가지 않게 한다.
        const distance = Math.atan2(Math.sin(angles[j] - angles[i]), Math.cos(angles[j] - angles[i]))
        const direction = distance >= 0 ? 1 : -1
        shifts[i] -= direction * geometry.angleStep
        shifts[j] += direction * geometry.angleStep
      }
    }
    if (!collision) break
    inputs.forEach((input, index) => {
      angles[index] = Math.max(input.angle - geometry.maxShift,
        Math.min(input.angle + geometry.maxShift, angles[index] + shifts[index]))
    })
    labels = inputs.map((input, index) => placeLabel(input, angles[index], geometry.labelRadius, geometry))
  }

  // 이웃을 번갈아 확정하면 빽빽한 조각에서도 모든 라벨이 같은 바깥 원으로 밀리지 않는다.
  const staggered = geometry.widthLimit
    ? [...order].sort((a, b) => Math.abs(Math.sin(inputs[b].angle)) - Math.abs(Math.sin(inputs[a].angle)))
    : [...order.filter((_, i) => i % 2 === 0), ...order.filter((_, i) => i % 2 !== 0)]
  const placed: typeof labels = []
  for (const index of staggered) {
    let label = labels[index]
    if (geometry.widthLimit) {
      // 좌우 끝 라벨부터 자리를 잡아 좁은 화면에서는 남은 라벨이 위아래 공간을 쓰게 한다.
      const left = geometry.center - geometry.widthLimit / 2 + geometry.padding
      const right = geometry.center + geometry.widthLimit / 2 - geometry.padding
      const steps = Math.floor(geometry.maxShift / geometry.angleStep)
      const offsets = [0, ...Array.from({ length: steps }, (_, i) => [i + 1, -i - 1]).flat()]
      let candidate: typeof label | undefined
      for (let ring = 0; ring <= inputs.length * 3 && !candidate; ring++) {
        for (const offset of offsets) {
          const next = placeLabel(inputs[index], inputs[index].angle + offset * geometry.angleStep,
            geometry.labelRadius + ring * geometry.ringStep, geometry)
          if (next.box.x < left || next.box.x + next.box.width > right || touchesDonut(next.box, geometry)) continue
          if (placed.some((other) => boxesOverlap(next.box, other.box, geometry.labelGap))) continue
          candidate = next
          break
        }
      }
      if (candidate) label = candidate
    }
    while (touchesDonut(label.box, geometry) || placed.some((other) => boxesOverlap(label.box, other.box, geometry.labelGap))) {
      label = placeLabel(inputs[index], angles[index], label.radius + geometry.ringStep, geometry)
    }
    labels[index] = label
    placed.push(label)
  }
  const left = Math.floor(Math.min(geometry.center - geometry.outer, ...labels.map(({ box }) => box.x))) - geometry.padding
  const top = Math.floor(Math.min(geometry.center - geometry.outer, ...labels.map(({ box }) => box.y))) - geometry.padding
  const right = Math.ceil(Math.max(geometry.center + geometry.outer, ...labels.map(({ box }) => box.x + box.width))) + geometry.padding
  const bottom = Math.ceil(Math.max(geometry.center + geometry.outer, ...labels.map(({ box }) => box.y + box.height))) + geometry.padding
  return { labels, viewBox: { x: left, y: top, width: right - left, height: bottom - top } }
}

function shortenLabel(label: string, limit: number) {
  const letters = Array.from(label)
  return letters.length > limit ? `${letters.slice(0, limit).join('')}…` : label
}

/** 9번째 색은 만들지 않고 같은 8색에 빗금을 얹어 구분한다. 25번째부터는 마지막 스타일을 되풀이한다. */
// oxlint-disable-next-line react/only-export-components
export function sliceStyle(index: number): { slot: number; pattern: Pattern } {
  const tier = Math.min(Math.floor(index / SLOTS), 2)
  return { slot: (index % SLOTS) + 1, pattern: (['solid', 'diag45', 'diag135'] as const)[tier] }
}

function point(r: number, angle: number, C: number) {
  // 12시 방향이 0, 시계 방향으로 커진다.
  const x = C + r * Math.sin(angle)
  const y = C - r * Math.cos(angle)
  return `${+x.toFixed(3)} ${+y.toFixed(3)}`
}

function arcPath(start: number, end: number, geometry: Geometry) {
  const { outer: OUTER, inner: INNER, center: C } = geometry
  const large = end - start > Math.PI ? 1 : 0
  return `M ${point(OUTER, start, C)} A ${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end, C)}`
    + ` L ${point(INNER, end, C)} A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start, C)} Z`
}

// 시작과 끝이 같은 점이면 호가 그려지지 않으므로 바깥·안쪽 원을 각각 반원 두 개로 잇는다.
function ringPath(geometry: Geometry) {
  const { outer: OUTER, inner: INNER, center: C } = geometry
  return `M ${point(OUTER, 0, C)} A ${OUTER} ${OUTER} 0 0 1 ${point(OUTER, Math.PI, C)} A ${OUTER} ${OUTER} 0 0 1 ${point(OUTER, 0, C)} Z`
  + ` M ${point(INNER, 0, C)} A ${INNER} ${INNER} 0 0 0 ${point(INNER, Math.PI, C)} A ${INNER} ${INNER} 0 0 0 ${point(INNER, 0, C)} Z`
}

/** 순수 SVG 도넛. 접근 가능한 컨트롤은 옆의 목록 행이 맡으므로 차트 자체는 보조 기술에서 숨긴다. */
export default function DonutChart({ slices, centerLabel, centerValue, activeId, onActiveChange, onSelect, compact = false, className }: Props) {
  // url(#…) 안에서 깨지지 않도록 useId의 특수 문자를 뺀다.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const geometry = compact ? GEOMETRY.compact : GEOMETRY.regular
  const { center: C, outer: OUTER } = geometry
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
      angle: slices.length === 1 ? 0 : (start + end) / 2,
      d: slices.length === 1 ? ringPath(geometry) : arcPath(start, end, geometry),
      fill: style.pattern === 'solid' ? color : `url(#${patternId})`,
    }
  })
  const { labels, viewBox } = layoutLabels(shapes.map(({ slice, angle }) => ({ ...slice, angle })), geometry)
  const patterns = new Map(shapes.filter((s) => s.style.pattern !== 'solid').map((s) => [s.patternId, s]))
  const active = shapes.find((s) => s.slice.id === activeId)

  return (
    <div className={className ? `${styles.viewport} ${className}` : styles.viewport} style={{ width: viewBox.width }}>
      <svg viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`} aria-hidden="true"
        style={{ minWidth: compact ? undefined : viewBox.width, maxWidth: viewBox.width, '--label-size': `${geometry.labelSize}px`,
          '--center-label-size': `${geometry.centerLabelSize}px`, '--center-value-size': `${geometry.centerValueSize}px` } as CSSProperties} className={styles.chart}>
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
            className={styles.slice} data-active={slice.id === activeId || undefined}
            onClick={() => onSelect(slice.id)}
            onPointerEnter={() => onActiveChange(slice.id)}
            onPointerLeave={() => onActiveChange(null)} />
        ))}
        {/* 이웃 조각의 간격 선에 가리지 않도록 윤곽선은 맨 위에 따로 그린다. */}
        {active && <path d={active.d} fillRule="evenodd" className={styles.outline} />}
        {labels.map(({ id, name, detail, anchor, x, y, textX, textY, lineHeight }, index) => (
          <g key={id} className={styles.annotation} data-active={id === activeId || undefined}
            onClick={() => onSelect(id)} onPointerEnter={() => onActiveChange(id)}
            onPointerLeave={() => onActiveChange(null)}>
            <polyline points={`${point(OUTER, shapes[index].angle, C)} ${x} ${y}`} className={styles.leader} />
            <text x={textX} y={textY} dominantBaseline="middle" textAnchor={anchor} className={styles.label}>
              {name}{detail && <tspan x={lineHeight ? textX : undefined} dy={lineHeight || undefined} className={styles.detail}> {detail}</tspan>}
            </text>
          </g>
        ))}
        <text x={C} y={C - 6} className={styles.centerLabel}>{centerLabel}</text>
        <text x={C} y={C + geometry.valueY} className={styles.centerValue}
          textLength={compact && centerValue.length * 7 > 60 ? 60 : undefined} lengthAdjust="spacingAndGlyphs">{centerValue}</text>
      </svg>
    </div>
  )
}
