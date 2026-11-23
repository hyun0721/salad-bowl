import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from 'react-aria-components'
import { describe, expect, it } from 'vitest'
import TaxHeader from './TaxHeader'
import { seoulYear, TaxYearProvider, useTaxYear } from './TaxYearProvider'

function Year() {
  return <p>선택: {useTaxYear().year}</p>
}

function renderHeader(today: Date) {
  render(
    <I18nProvider locale="ko-KR">
      <TaxYearProvider today={today}><TaxHeader /><Year /></TaxYearProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

describe('seoulYear', () => {
  it('reads the year in Korea, not in UTC', () => {
    expect(seoulYear(new Date('2026-12-31T14:59:00Z'))).toBe(2026)
    expect(seoulYear(new Date('2026-12-31T15:00:00Z'))).toBe(2027)
  })
})

describe('TaxHeader', () => {
  it('starts at this year, offers last, this and next year, and says the data is personal', async () => {
    const user = renderHeader(new Date('2026-11-20T00:00:00+09:00'))

    expect(screen.getByRole('heading', { level: 1, name: '소득공제' })).toBeInTheDocument()
    expect(screen.getByText('개인 자료 · 그룹과 무관')).toBeInTheDocument()
    expect(screen.getByText('선택: 2026')).toBeInTheDocument()
    const previous = screen.getByRole('button', { name: '이전 연도' })
    const next = screen.getByRole('button', { name: '다음 연도' })
    expect(screen.queryByText('귀속연도')).not.toBeInTheDocument()
    expect(screen.getByText('2026년')).toBeInTheDocument()
    expect(screen.getByRole('heading').parentElement?.nextElementSibling).toContainElement(previous)
    await user.click(previous)
    expect(screen.getByText('선택: 2025')).toBeInTheDocument()
    expect(screen.getByText('2025년')).toBeInTheDocument()
    expect(previous).toHaveAttribute('aria-disabled', 'true')
    await user.click(next)
    await user.click(next)
    expect(screen.getByText('선택: 2027')).toBeInTheDocument()
    expect(next).toHaveAttribute('aria-disabled', 'true')
  })
})
