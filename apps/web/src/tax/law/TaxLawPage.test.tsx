import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/server'
import { lawDraft, lawVersion, renderTaxLaw, serveLaw } from '../../test/taxLawFixtures'

const v1 = lawVersion()
const v2 = lawDraft({ id: 2, versionNo: 2, rowVersion: 21, createdByNickname: '관리자다', createdAt: '2026-11-05T05:00:00Z' })
const v3 = lawDraft({ id: 3, versionNo: 3, rowVersion: 31, createdByNickname: '관리자라', createdAt: '2026-11-10T00:30:00Z' })

const rows = (list: HTMLElement) => within(list).getAllByRole('listitem')
const versionButton = (list: HTMLElement, no: number) => within(list).getByRole('button', { name: new RegExp(`^v${no} · `) })

describe('TaxLawPage — 권한', () => {
  it('shows the no-permission screen to a member without asking the admin API', async () => {
    const calls = serveLaw([v1])
    renderTaxLaw({ admin: false })

    expect(await screen.findByRole('heading', { name: '권한 없음' })).toBeInTheDocument()
    expect(screen.getByText('이 화면은 서비스 관리자만 볼 수 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '입력자료로 가기' })).toHaveAttribute('href', '/tax/inputs')
    expect(screen.queryByRole('button', { name: '다음 연도' })).not.toBeInTheDocument()
    expect(calls.list).toBe(0)
  })

  it('shows the same screen when the server answers 403 (권한을 회수한 뒤)', async () => {
    server.use(http.get('*/api/tax/admin/law-versions', () => HttpResponse.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 })))
    renderTaxLaw()

    expect(await screen.findByRole('heading', { name: '권한 없음' })).toBeInTheDocument()
  })
})

describe('TaxLawPage — 버전 목록', () => {
  it('lists drafts and applied versions newest first with who and when, and marks the current one', async () => {
    serveLaw([v3, v2, v1])
    renderTaxLaw()

    expect(await screen.findByRole('heading', { level: 1, name: '연도별 세법 관리' })).toBeInTheDocument()
    expect(screen.queryByText('개인 자료 · 그룹과 무관')).not.toBeInTheDocument()
    const list = await screen.findByRole('region', { name: '2026년 버전' })
    expect(await within(list).findByText('현재 적용 v1 · 초안 2개')).toBeInTheDocument()
    const [first, second, third] = rows(list)
    expect(first).toHaveTextContent('v3 · 초안')
    expect(first).toHaveTextContent('작성 관리자라 · 2026-11-10 09:30')
    expect(second).toHaveTextContent('v2 · 초안')
    expect(second).toHaveTextContent('작성 관리자다 · 2026-11-05 14:00')
    expect(third).toHaveTextContent('v1 · 현재 적용')
    expect(third).toHaveTextContent('적용 관리자나 · 2026-01-15 10:00')
    // 초안이 있어도 새 초안을 만들 수 있다(TAX-72).
    expect(within(list).getByRole('button', { name: '새 초안 만들기' })).toBeEnabled()
  })

  it('opens the newest version first and shows an applied version as read-only text', async () => {
    serveLaw([v3, v2, v1])
    const { user } = renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    expect(versionButton(list, 3)).toHaveAttribute('aria-current', 'true')
    await user.click(versionButton(list, 1))

    expect(versionButton(list, 1)).toHaveAttribute('aria-current', 'true')
    const detail = screen.getByRole('region', { name: /2026년 귀속 v1/ })
    expect(detail).toHaveTextContent('적용된 버전은 고칠 수 없어요. 바꾸려면 새 초안을 만드세요.')
    await user.click(within(detail).getByRole('button', { name: '세법 수치 도움말' }))
    expect(await screen.findByRole('dialog', { name: '세법 수치 도움말' })).toHaveTextContent('자녀등 조건이 없는 연도는 세 단계에 같은 값을 넣으세요.')
    expect(detail).toHaveTextContent('계산 알고리즘 버전 1 (고정)')
    expect(detail).toHaveTextContent('작성 관리자가 · 2026-01-10 09:00 · 적용 관리자나 · 2026-01-15 10:00')
    const term = (label: string) => within(detail).getByText(label, { selector: 'dt' }).nextElementSibling
    expect(term('신용카드 공제율')).toHaveTextContent('15%')
    expect(term('급여구간 경계 금액')).toHaveTextContent('₩ 70,000,000')
    expect(term('기본한도 · 경계 초과 · 자녀등 1명')).toHaveTextContent('₩ 2,750,000')
    expect(term('추가한도 상한 · 경계 이하')).toHaveTextContent('₩ 3,000,000')
    expect(within(detail).getByRole('link', { name: 'https://www.law.go.kr/' })).toHaveAttribute('href', 'https://www.law.go.kr/')
    expect(term('메모')).toHaveTextContent('합성 메모')
    expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: 'v1 초안 삭제' })).not.toBeInTheDocument()
  })

  it('never turns a non-http basis address into a link', async () => {
    serveLaw([lawVersion({ basisUrl: 'javascript:alert(1)', memo: null })])
    renderTaxLaw()

    const detail = await screen.findByRole('region', { name: /2026년 귀속 v1/ })
    expect(within(detail).queryByRole('link')).not.toBeInTheDocument()
    expect(detail).toHaveTextContent('javascript:alert(1)')
    expect(within(detail).getByText('메모', { selector: 'dt' }).nextElementSibling).toHaveTextContent('—')
  })

  it('creates a new draft even when drafts exist and selects it', async () => {
    serveLaw([v3, v2, v1])
    let body: unknown
    server.use(http.post('*/api/tax/admin/law-versions', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(lawDraft({ id: 4, versionNo: 4, rowVersion: 41, createdByNickname: '관리자마' }), { status: 201 })
    }))
    const { user } = renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    await user.click(within(list).getByRole('button', { name: '새 초안 만들기' }))

    await waitFor(() => expect(rows(list)).toHaveLength(4))
    expect(body).toEqual({ taxYear: 2026 })
    expect(rows(list)[0]).toHaveTextContent('v4 · 초안')
    expect(versionButton(list, 4)).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('region', { name: /2026년 귀속 v4/ })).toBeInTheDocument()
    expect(within(list).getByText('현재 적용 v1 · 초안 3개')).toBeInTheDocument()
  })

  it('shows an empty year that has no applied law yet', async () => {
    serveLaw([], null)
    renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    expect(within(list).getByText('2026년 귀속 세법 버전이 없어요. [새 초안 만들기]로 시작하세요.')).toBeInTheDocument()
    expect(await within(list).findByText('적용 버전 없음(회원 화면은 "세법 준비 중") · 초안 0개')).toBeInTheDocument()
  })

  it('reads the versions of the year picked in the header', async () => {
    const calls = serveLaw([v1, lawDraft({ id: 9, taxYear: 2027, versionNo: 1 })])
    const { user } = renderTaxLaw()

    await screen.findByRole('region', { name: '2026년 버전' })
    await user.click(screen.getByRole('button', { name: '다음 연도' }))

    const list = await screen.findByRole('region', { name: '2027년 버전' })
    expect(within(list).getByText(/^v1 · 초안/)).toBeInTheDocument()
    expect(calls.years).toEqual([2026, 2027])
  })

  it('shows a load error with retry', async () => {
    let fail = true
    serveLaw([v1])
    server.use(http.get('*/api/tax/admin/law-versions', () => (fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json([v1]))))
    const { user } = renderTaxLaw()

    expect(await screen.findByRole('alert')).toHaveTextContent('세법 버전을 불러오지 못했어요.')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('region', { name: '2026년 버전' })).toBeInTheDocument()
  })
})
