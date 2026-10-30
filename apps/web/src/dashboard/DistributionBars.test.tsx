import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import DistributionBars from './DistributionBars'

const members = [{ userId: 2, nickname: '둘' }, { userId: 1, nickname: '하나' }, { userId: 3, nickname: '셋' }]
it('scales the whole bar by net expense and splits positive contributions in member order', () => {
  render(<DistributionBars rows={[{ id: 'food', label: '식비', value: 60, memberExpenses: [{ userId: 1, expense: 30 }, { userId: 2, expense: 90 }, { userId: 3, expense: -60 }] }]} positiveTotal={120} members={members} />)
  const bar = screen.getByRole('img', { name: '식비 50.0%, 둘 ₩ 90, 하나 ₩ 30, 셋 -₩ 60 · 환불 초과' })
  expect(bar.firstElementChild).toHaveStyle({ width: '50%' })
  expect(bar.firstElementChild?.children[0]).toHaveStyle({ width: '75%', background: 'var(--chart-1)' })
  expect(bar.firstElementChild?.children[1]).toHaveStyle({ width: '25%', background: 'var(--chart-2)' })
  expect(bar.firstElementChild?.children).toHaveLength(2)
  expect(screen.getByText('셋 -₩ 60 · 환불 초과')).toBeVisible()
})
it('falls back to brand without member data', () => {
  render(<DistributionBars rows={[{ id: 'food', label: '식비', value: 60 }]} positiveTotal={120} members={members} />)
  expect(screen.getByRole('img', { name: '식비 50.0%' }).firstElementChild).toHaveStyle({ width: '50%', background: 'var(--brand)' })
  expect(screen.queryByText('둘')).not.toBeInTheDocument()
})
it('keeps negative rows and zero totals finite, and omits zero members', () => {
  render(<DistributionBars rows={[{ id: 'refund', label: '환불', value: -10, memberExpenses: [{ userId: 1, expense: -10 }, { userId: 2, expense: 0 }] }]} positiveTotal={0} members={members} />)
  expect(screen.getByText('-₩ 10 · 환불 초과')).toBeVisible()
  expect(screen.getByRole('img').firstElementChild).toHaveStyle({ width: '0%' })
  expect(screen.queryByText('둘 ₩ 0')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('includes every nonzero member amount in a selectable row name', () => {
  render(<DistributionBars rows={[{ id: 'food', label: '식비', value: 60, memberExpenses: [{ userId: 2, expense: 90 }, { userId: 1, expense: -30 }] }]} positiveTotal={120} members={members} onSelect={() => {}} />)
  expect(screen.getByRole('button')).toHaveAccessibleName('식비 50.0% ₩ 60, 둘 ₩ 90, 하나 -₩ 30 · 환불 초과')
})
it.each([{ memberExpenses: [] }, { memberExpenses: [{ userId: 1, expense: -10 }] }])('uses brand when member data has no positive segments: $memberExpenses', ({ memberExpenses }) => {
  render(<DistributionBars rows={[{ id: 'food', label: '식비', value: 60, memberExpenses }]} positiveTotal={120} members={members} />)
  expect(screen.getByRole('img').firstElementChild).toHaveStyle({ width: '50%', background: 'var(--brand)' })
  expect(screen.getByRole('group', { name: '멤버 범례' })).toBeVisible()
})
it('cycles the eight colors in the legend, segments and member amounts', () => {
  const manyMembers = Array.from({ length: 9 }, (_, index) => ({ userId: index, nickname: `멤버${index + 1}` }))
  render(<DistributionBars rows={[{ id: 'food', label: '식비', value: 90, memberExpenses: manyMembers.map(({ userId }) => ({ userId, expense: 10 })) }]} positiveTotal={90} members={manyMembers} />)
  const legend = screen.getByRole('group', { name: '멤버 범례' })
  expect(within(legend).getByText('멤버8').firstElementChild).toHaveStyle({ background: 'var(--chart-8)' })
  expect(within(legend).getByText('멤버9').firstElementChild).toHaveStyle({ background: 'var(--chart-1)' })
  expect(screen.getByRole('img').firstElementChild?.children[8]).toHaveStyle({ background: 'var(--chart-1)' })
  expect(screen.getByText('멤버9 ₩ 10').firstElementChild).toHaveStyle({ background: 'var(--chart-1)' })
})
