import { fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DonutChart, { GEOMETRY, layoutLabels, sliceStyle, type DonutSlice } from './DonutChart'

const slices: DonutSlice[] = [
  { id: '식비', label: '식비', value: 120000 },
  { id: '교통/차량', label: '교통/차량', value: 80000 },
  { id: '쇼핑', label: '쇼핑', value: 50000 },
]

type Overrides = Partial<Pick<Parameters<typeof DonutChart>[0], 'slices' | 'activeId' | 'compact' | 'centerValue'>>

function renderChart(overrides: Overrides = {}) {
  const props = {
    slices, centerLabel: '총지출', centerValue: '₩ 250,000', activeId: null as string | null,
    onActiveChange: vi.fn(), onSelect: vi.fn(), ...overrides,
  }
  const utils = render(<DonutChart {...props} />)
  const paths = () => Array.from(utils.container.querySelectorAll<SVGPathElement>('path.slice'))
  return { ...utils, props, paths }
}

describe('DonutChart', () => {
  it('draws one path per slice, and a single slice as one ring path', () => {
    const { paths, unmount } = renderChart()
    expect(paths()).toHaveLength(3)
    unmount()

    const single = renderChart({ slices: [slices[0]] })
    expect(single.paths()).toHaveLength(1)
    // 두 반원(바깥) + 두 반원(안쪽)으로 그린다.
    expect(single.paths()[0].getAttribute('d')!.match(/A/g)).toHaveLength(4)
  })

  it('is hidden from assistive tech and slices take no focus', () => {
    const { container, paths } = renderChart()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    for (const p of paths()) expect(p).not.toHaveAttribute('tabindex')
  })

  it('selects on click and reports hover in and out', async () => {
    const user = userEvent.setup()
    const { props, paths } = renderChart()
    await user.click(paths()[1])
    expect(props.onSelect).toHaveBeenCalledWith('교통/차량')

    props.onActiveChange.mockClear()
    fireEvent.pointerEnter(paths()[2])
    expect(props.onActiveChange).toHaveBeenLastCalledWith('쇼핑')
    fireEvent.pointerLeave(paths()[2])
    expect(props.onActiveChange).toHaveBeenLastCalledWith(null)
  })

  it('shows the center label and value', () => {
    const { container } = renderChart()
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toEqual(expect.arrayContaining(['총지출', '₩ 250,000']))
  })

  it('marks the active slice', () => {
    const { paths } = renderChart({ activeId: '교통/차량' })
    expect(paths()[1]).toHaveAttribute('data-active')
    expect(paths()[0]).not.toHaveAttribute('data-active')
    expect(paths()[2]).not.toHaveAttribute('data-active')
  })

  it('fills slices past the eighth with a hatch pattern of the same slot', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, label: `c${i}`, value: 10 }))
    const { container, paths } = renderChart({ slices: many })
    const fill = paths()[8].style.fill
    const id = fill.match(/url\("?#([^")]+)"?\)/)?.[1]
    expect(id).toBeTruthy()
    const pattern = container.querySelector(`pattern[id="${id}"]`)
    expect(pattern).not.toBeNull()
    expect(pattern!.getAttribute('patternTransform')).toBe('rotate(45)')
    expect(paths()[0].style.fill).toBe('var(--chart-1)')
  })
})

describe('sliceStyle', () => {
  it('cycles 8 slots, then adds 45° and 135° hatches, then repeats the last style', () => {
    expect(sliceStyle(0)).toEqual({ slot: 1, pattern: 'solid' })
    expect(sliceStyle(7)).toEqual({ slot: 8, pattern: 'solid' })
    expect(sliceStyle(8)).toEqual({ slot: 1, pattern: 'diag45' })
    expect(sliceStyle(15)).toEqual({ slot: 8, pattern: 'diag45' })
    expect(sliceStyle(16)).toEqual({ slot: 1, pattern: 'diag135' })
    expect(sliceStyle(30)).toEqual({ slot: 7, pattern: 'diag135' })
  })
})


describe('outside labels', () => {
  it('shows each name and detail, truncating only long names', () => {
    const { container } = renderChart({ slices: [
      { id: 'long', label: '아주긴카테고리이름', value: 99, detail: '99%' },
      { id: 'small', label: '기타', value: 1, detail: '1% 미만' },
    ] })
    const labels = Array.from(container.querySelectorAll('text.label'))
    expect(labels.map((label) => label.textContent)).toEqual(['아주긴카테고… 99%', '기타 1% 미만'])
    expect(labels[0]).toHaveAttribute('text-anchor', 'middle')
    expect(labels[1]).toHaveAttribute('text-anchor', 'middle')
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0)
  })

  it('selects and highlights from both labels and leader lines', () => {
    const { container, props } = renderChart({ activeId: '식비' })
    expect(container.querySelector('.annotation')).toHaveAttribute('data-active', 'true')
    for (const selector of ['text.label', 'polyline.leader']) {
      const target = container.querySelector(selector)!
      expect(target).not.toBeNull()
      fireEvent.click(target)
      expect(props.onSelect).toHaveBeenLastCalledWith('식비')
      fireEvent.pointerOver(target)
      expect(props.onActiveChange).toHaveBeenLastCalledWith('식비')
      fireEvent.pointerOut(target)
      expect(props.onActiveChange).toHaveBeenLastCalledWith(null)
    }
  })

  it('renders a single label and leader for a single slice', () => {
    const { container } = renderChart({ slices: [slices[0]] })
    expect(container.querySelectorAll('text.label')).toHaveLength(1)
    expect(container.querySelectorAll('polyline.leader')).toHaveLength(1)
  })
})

describe('responsive geometry', () => {
  it('uses four-character names and allows the compact viewport to shrink', () => {
    const data = [{ id: 'long', label: '아주긴카테고리이름', value: 1, detail: '1% 미만' }]
    const regular = renderChart({ slices: data })
    const regularWidth = Number(regular.container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[2])
    expect(regular.container.querySelector('svg')).toHaveStyle({ minWidth: `${regularWidth}px`, maxWidth: `${regularWidth}px` })
    expect(regular.container.querySelector('svg')!.style.getPropertyValue('--label-size')).toBe('13px')
    regular.unmount()
    const compact = renderChart({ slices: data, compact: true })
    const svg = compact.container.querySelector('svg')!
    const width = Number(svg.getAttribute('viewBox')!.split(' ')[2])
    expect(compact.container.querySelector('text.label')).toHaveTextContent('아주긴카… 1% 미만')
    expect(width).toBeLessThan(regularWidth)
    expect(width).toBeLessThanOrEqual(320)
    expect(svg).toHaveStyle({ maxWidth: `${width}px` })
    expect(svg.style.minWidth).toBe('')
    expect(svg.style.getPropertyValue('--center-value-size')).toBe('11px')
    expect(svg.style.getPropertyValue('--center-label-size')).toBe('10px')
    expect(svg.style.getPropertyValue('--label-size')).toBe('12px')
    expect(compact.container.querySelector('text.label tspan')).toHaveAttribute('dy', '12')
    expect(compact.paths()[0].getAttribute('d')!.match(/A/g)).toHaveLength(4)
  })

})

function labelInputs(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0)
  let start = 0
  return values.map((value, index) => {
    const angle = (start + value / 2) / total * Math.PI * 2
    start += value
    return { id: String(index), label: `긴카테고리이름${index}`, detail: index === 11 ? '1% 미만' : `${Math.round(value / total * 100)}%`, angle }
  })
}

describe('radial label layout', () => {
  it.each(['regular', 'compact'] as const)('keeps boxes outside the donut, disjoint and inside the viewBox in %s', (mode) => {
    const geometry = GEOMETRY[mode]
    for (const values of [Array.from({ length: 12 }, () => 1), [30, 20, 10, 8, 6, 5, 4, 4, 3, 3, 3, 2]]) {
      const inputs = labelInputs(values)
      const original = structuredClone(inputs)
      const result = layoutLabels(inputs, geometry)
      expect(result.labels).toHaveLength(12)
      expect(inputs).toEqual(original)
      expect(layoutLabels(inputs, geometry)).toEqual(result)
      const { x, y, width, height } = result.viewBox
      for (const [i, label] of result.labels.entries()) {
        const box = label.box
        expect(box.x).toBeGreaterThanOrEqual(x)
        expect(box.y).toBeGreaterThanOrEqual(y)
        expect(box.x + box.width).toBeLessThanOrEqual(x + width)
        expect(box.y + box.height).toBeLessThanOrEqual(y + height)
        const nearX = Math.max(box.x, Math.min(geometry.center, box.x + box.width))
        const nearY = Math.max(box.y, Math.min(geometry.center, box.y + box.height))
        expect(Math.hypot(nearX - geometry.center, nearY - geometry.center)).toBeGreaterThan(geometry.outer)
        expect(Math.abs(label.angle - inputs[i].angle)).toBeLessThanOrEqual(25 * Math.PI / 180 + 1e-10)
        for (const other of result.labels.slice(i + 1)) {
          const b = other.box
          expect(box.x + box.width <= b.x || b.x + b.width <= box.x || box.y + box.height <= b.y || b.y + b.height <= box.y).toBe(true)
        }
      }
    }
  })

  it('uses radial positions and angle-dependent anchors with straight leaders', () => {
    const { container } = renderChart({ slices: Array.from({ length: 4 }, (_, i) => ({ id: String(i), label: '식비', value: 1 })) })
    const labels = Array.from(container.querySelectorAll('text.label'))
    expect(labels.map((label) => label.getAttribute('text-anchor'))).toEqual(['start', 'start', 'end', 'end'])
    for (const leader of container.querySelectorAll('polyline.leader')) {
      expect(leader.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(4)
    }
    const result = layoutLabels(labelInputs([30, 20, 10, 8, 6, 5, 4, 4, 3, 3, 3, 2]), GEOMETRY.regular)
    expect(new Set(result.labels.map((label) => Math.round(label.x))).size).toBeGreaterThan(4)
  })

  it('handles empty input and expands outward for labels clustered across twelve o’clock', () => {
    expect(layoutLabels([], GEOMETRY.compact).labels).toEqual([])
    const inputs = Array.from({ length: 20 }, (_, i) => ({ id: String(i), label: '카테고리', detail: '1% 미만', angle: (i < 10 ? 0 : Math.PI * 2 - 0.01) + i * 0.0001 }))
    const { labels, viewBox } = layoutLabels(inputs, GEOMETRY.compact)
    expect(viewBox.height).toBeGreaterThan(GEOMETRY.compact.outer * 2)
    for (const [i, { box }] of labels.entries()) {
      for (const { box: b } of labels.slice(i + 1)) {
        expect(box.x + box.width <= b.x || b.x + b.width <= box.x || box.y + box.height <= b.y || b.y + b.height <= box.y).toBe(true)
      }
    }
  })
})


it('fits twelve long compact labels within 300 viewBox units', () => {
  const amounts = [30, 20, 10, 8, 6, 5, 4, 4, 3, 3, 3, 2]
  const rotations = amounts.map((_, i) => [...amounts.slice(i), ...amounts.slice(0, i)])
  for (const values of [Array.from({ length: 12 }, () => 1), ...rotations]) {
    const { viewBox } = layoutLabels(labelInputs(values), GEOMETRY.compact)
    expect(viewBox.width).toBeLessThanOrEqual(300)
  }
})


it('fits the compact center amount inside the inner diameter', () => {
  const { container } = renderChart({ compact: true, centerValue: '₩ 2,148,000' })
  const value = container.querySelector('text.centerValue')!
  expect(value).toHaveTextContent('₩ 2,148,000')
  expect(Number(value.getAttribute('textLength'))).toBeLessThan(GEOMETRY.compact.inner * 2)
  expect(container.querySelector('svg')!.style.getPropertyValue('--center-value-size')).toBe('11px')
})
