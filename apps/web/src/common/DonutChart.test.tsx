import { fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DonutChart, { sliceStyle, type DonutSlice } from './DonutChart'

const slices: DonutSlice[] = [
  { id: '식비', label: '식비', value: 120000 },
  { id: '교통/차량', label: '교통/차량', value: 80000 },
  { id: '쇼핑', label: '쇼핑', value: 50000 },
]

type Overrides = Partial<Pick<Parameters<typeof DonutChart>[0], 'slices' | 'activeId'>>

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
    expect(texts).toEqual(['총지출', '₩ 250,000'])
  })

  it('marks the active slice', () => {
    const { paths } = renderChart({ activeId: '교통/차량' })
    expect(paths()[1]).toHaveClass('active')
    expect(paths()[0]).not.toHaveClass('active')
    expect(paths()[2]).not.toHaveClass('active')
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
    expect(sliceStyle(30)).toEqual({ slot: (30 % 8) + 1, pattern: 'diag135' })
  })
})
