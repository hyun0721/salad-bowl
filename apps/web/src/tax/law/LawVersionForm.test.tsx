import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockViewport } from '../../test/mockViewport'
import { server } from '../../test/server'
import { lawDraft, lawVersion, renderTaxLaw, serveLaw } from '../../test/taxLawFixtures'

const v1 = lawVersion()
// v2는 v1을 복사해 만든 초안이다. 기본한도(경계 초과 · 자녀등 1명)와 메모만 비어 있다.
const v2 = lawDraft({ id: 2, versionNo: 2, rowVersion: 21, basicLimitHigh: [2_500_000, null, 3_000_000], memo: null, createdByNickname: '관리자다' })
const v3 = lawDraft({ id: 3, versionNo: 3, rowVersion: 31, createdByNickname: '관리자라' })

const conflict = (status: number) => HttpResponse.json({ code: status === 404 ? 'NOT_FOUND' : 'CONFLICT', message: 'x' }, { status })

async function openDraft(no: number) {
  const view = renderTaxLaw()
  const list = await screen.findByRole('region', { name: '2026년 버전' })
  await view.user.click(within(list).getByRole('button', { name: new RegExp(`^v${no} · `) }))
  const form = screen.getByRole('region', { name: new RegExp(`2026년 귀속 v${no} · 초안`) })
  return { ...view, list, form }
}

const field = (form: HTMLElement, group: string, label: string) => within(within(form).getByRole('group', { name: group })).getByLabelText(label)

describe('LawVersionForm — 초안 편집', () => {
  it('saves the whole draft with the rowVersion it opened with and only then allows validate and apply', async () => {
    serveLaw([v3, v2, v1])
    let body: unknown
    server.use(http.put('*/api/tax/admin/law-versions/2', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(lawDraft({ ...v2, rowVersion: 22, rateCreditPct: 20, basicLimitHigh: [2_500_000, 2_750_000, 3_000_000], memo: '자녀등 한도 반영' }))
    }))
    const { user, form } = await openDraft(2)

    expect(form).toHaveTextContent('계산 알고리즘 버전 1 (고정)')
    expect(within(form).getByRole('button', { name: '검증' })).toBeEnabled()
    await user.clear(field(form, '비율 (%)', '신용카드 공제율'))
    await user.type(field(form, '비율 (%)', '신용카드 공제율'), '20')
    await user.type(field(form, '기본한도 · 경계 초과 (원)', '자녀등 1명'), '2750000')
    await user.type(within(form).getByLabelText('메모 (선택)'), '  자녀등 한도 반영  ')
    await user.tab()

    expect(form).toHaveTextContent('저장하지 않은 변경이 있습니다. 초안을 저장한 뒤 검증·적용할 수 있습니다.')
    expect(within(form).getByRole('button', { name: '검증' })).toBeDisabled()
    expect(within(form).getByRole('button', { name: '적용' })).toBeDisabled()
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toEqual({
      rowVersion: 21, minSpendRatePct: 25, bracketBoundary: 70_000_000,
      rateCreditPct: 20, rateDebitCashPct: 30, rateCulturePct: 30, rateMarketPct: 40, rateTransitPct: 40,
      basicLimitLow: [3_000_000, 3_500_000, 4_000_000], basicLimitHigh: [2_500_000, 2_750_000, 3_000_000],
      extraLimitLow: 3_000_000, extraLimitHigh: 2_000_000,
      basisLawName: '조세특례제한법', basisArticle: '제126조의2', basisUrl: 'https://www.law.go.kr/',
      periodStart: '2026-01-01', periodEnd: '2026-12-31', memo: '자녀등 한도 반영',
    })
    expect(await screen.findByText('2026년 귀속 v2 초안을 저장했습니다.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: '검증' })).toBeEnabled()
    expect(field(form, '비율 (%)', '신용카드 공제율')).toHaveValue('20')
  })

  it('sends the next save with the rowVersion the server returned', async () => {
    serveLaw([v2, v1])
    const sent: unknown[] = []
    server.use(http.put('*/api/tax/admin/law-versions/2', async ({ request }) => {
      const body = await request.json() as { rowVersion: number }
      sent.push(body.rowVersion)
      return HttpResponse.json(lawDraft({ ...v2, rowVersion: body.rowVersion === 21 ? 900 : 901, memo: 'a' }))
    }))
    const { user, form } = await openDraft(2)

    await user.type(within(form).getByLabelText('메모 (선택)'), 'a')
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(sent).toEqual([21]))
    await user.type(within(form).getByLabelText('메모 (선택)'), 'b')
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))

    await waitFor(() => expect(sent).toEqual([21, 900]))
  })

  it('validates the saved draft and lists failures with field names, then a pass', async () => {
    serveLaw([v2, v1])
    let errors = [
      { field: 'rateCulturePct', message: '0~100 사이여야 합니다' },
      { field: 'basicLimitHigh[1]', message: '값을 입력해야 합니다' },
    ]
    server.use(http.post('*/api/tax/admin/law-versions/2/validate', () => HttpResponse.json({ errors })))
    const { user, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '검증' }))

    const failed = await within(form).findByRole('alert')
    expect(failed).toHaveTextContent('검증 실패 — 적용할 수 없습니다.')
    expect(within(failed).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '문화체육 공제율: 0~100 사이여야 합니다',
      '기본한도 · 경계 초과 · 자녀등 1명: 값을 입력해야 합니다',
    ])
    errors = []
    await user.click(within(form).getByRole('button', { name: '검증' }))

    expect(await within(form).findByRole('status')).toHaveTextContent('검증 통과 — 적용할 수 있습니다.')
  })

  it('keeps the input after a stale save and reloads the draft on request', async () => {
    const calls = serveLaw([v2, v1])
    server.use(http.put('*/api/tax/admin/law-versions/2', () => conflict(409)))
    const { user, form } = await openDraft(2)

    await user.clear(field(form, '비율 (%)', '신용카드 공제율'))
    await user.type(field(form, '비율 (%)', '신용카드 공제율'), '20')
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('다른 곳에서 수정·적용되거나 삭제됐습니다. 저장하지 않았습니다.')
    expect(field(form, '비율 (%)', '신용카드 공제율')).toHaveValue('20')
    await user.click(within(form).getByRole('button', { name: '다시 불러오기' }))

    await waitFor(() => expect(calls.list).toBe(2))
    const reloaded = screen.getByRole('region', { name: /2026년 귀속 v2 · 초안/ })
    await waitFor(() => expect(field(reloaded, '비율 (%)', '신용카드 공제율')).toHaveValue('15'))
    expect(within(reloaded).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the input and says so when the server cannot be reached', async () => {
    serveLaw([v2, v1])
    server.use(http.put('*/api/tax/admin/law-versions/2', () => HttpResponse.error()))
    const { user, form } = await openDraft(2)

    await user.type(within(form).getByLabelText('메모 (선택)'), '합성')
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. 입력한 값은 그대로 있습니다.')
    expect(within(form).getByLabelText('메모 (선택)')).toHaveValue('합성')
  })
})

describe('LawVersionForm — 적용', () => {
  it('applies a draft after one centered confirmation that says other drafts stay drafts', async () => {
    mockViewport(true)
    const calls = serveLaw([v3, v2, v1])
    let body: unknown
    server.use(http.post('*/api/tax/admin/law-versions/2/apply', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(lawVersion({ ...v2, status: 'APPLIED', rowVersion: 22, appliedByNickname: '관리자나', appliedAt: '2026-11-21T01:00:00Z' }))
    }))
    const { user, list, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '적용' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 v2 적용' })
    expect(dialog.parentElement).toHaveClass('pinned')
    expect(dialog.parentElement).toHaveClass('modal')
    expect(dialog).toHaveTextContent('적용하면 이 버전은 고치거나 삭제할 수 없습니다.')
    expect(dialog).toHaveTextContent('다른 초안은 초안으로 남습니다.')
    await user.click(within(dialog).getByRole('button', { name: '적용' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({ rowVersion: 21 })
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('v2 · 적용')
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('v3 · 초안')
    const detail = screen.getByRole('region', { name: /2026년 귀속 v2 · 적용/ })
    await waitFor(() => expect(document.activeElement).toBe(within(detail).getByRole('heading', { name: /2026년 귀속 v2/ })))
    expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: 'v2 초안 삭제' })).not.toBeInTheDocument()
    // 회원 화면의 현재 적용 세법을 다시 읽는다.
    await waitFor(() => expect(calls.current).toBe(2))
  })

  it('keeps the dialog open when the draft fails validation on apply', async () => {
    serveLaw([v2, v1])
    server.use(http.post('*/api/tax/admin/law-versions/2/apply', () =>
      HttpResponse.json({ code: 'VALIDATION_FAILED', message: 'basicLimitHigh[1]: 값을 입력해야 합니다' }, { status: 400 })))
    const { user, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '적용' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 v2 적용' })
    await user.click(within(dialog).getByRole('button', { name: '적용' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('검증을 통과하지 못해 적용하지 않았습니다. [검증]으로 이유를 확인해 주세요.')
  })

  it.each([409, 404])('reloads the list after a %i apply', async (status) => {
    const calls = serveLaw([v2, v1])
    server.use(http.post('*/api/tax/admin/law-versions/2/apply', () => conflict(status)))
    const { user, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '적용' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 v2 적용' })
    await user.click(within(dialog).getByRole('button', { name: '적용' }))

    await waitFor(() => expect(calls.list).toBe(2))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('다른 곳에서 바뀌어 새로 불러왔습니다.')
  })

  it('reopens a changed draft with its new rowVersion after an apply conflict', async () => {
    serveLaw([v2, v1])
    const appliedBodies: unknown[] = []
    server.use(http.post('*/api/tax/admin/law-versions/2/apply', async ({ request }) => {
      const body = await request.json()
      appliedBodies.push(body)
      if (appliedBodies.length === 1) {
        serveLaw([lawDraft({ ...v2, rowVersion: 22, rateCreditPct: 20 }), v1])
        return conflict(409)
      }
      return HttpResponse.json(lawVersion({ ...v2, status: 'APPLIED', rowVersion: 23 }))
    }))
    const { user, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '적용' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '적용' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const reloaded = screen.getByRole('region', { name: /2026년 귀속 v2 · 초안/ })
    expect(screen.getByRole('alert')).toHaveTextContent('다른 곳에서 바뀌어 새로 불러왔습니다.')
    expect(field(reloaded, '비율 (%)', '신용카드 공제율')).toHaveValue('20')
    await user.click(within(reloaded).getByRole('button', { name: '적용' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '적용' }))

    await waitFor(() => expect(appliedBodies).toEqual([{ rowVersion: 21 }, { rowVersion: 22 }]))
    await waitFor(() => expect(screen.queryByText('다른 곳에서 바뀌어 새로 불러왔습니다.')).not.toBeInTheDocument())
  })
})

describe('LawVersionForm — 검증 충돌', () => {
  it.each([409, 404])('reloads and announces a %i validation conflict', async (status) => {
    const calls = serveLaw([v2, v1])
    server.use(http.post('*/api/tax/admin/law-versions/2/validate', () => {
      serveLaw(status === 404 ? [v1] : [lawDraft({ ...v2, rowVersion: 22, rateCreditPct: 20 }), v1])
      return conflict(status)
    }))
    const { user, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '검증' }))

    await waitFor(() => expect(calls.list).toBe(1))
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 곳에서 바뀌어 새로 불러왔습니다.')
    if (status === 404) {
      expect(screen.getByRole('region', { name: /2026년 귀속 v1 · 적용/ })).toBeInTheDocument()
    } else {
      const reloaded = screen.getByRole('region', { name: /2026년 귀속 v2 · 초안/ })
      expect(field(reloaded, '비율 (%)', '신용카드 공제율')).toHaveValue('20')
    }
  })
})

describe('LawVersionList — 초안 삭제', () => {
  it('deletes a draft after one centered confirmation with its rowVersion and has no delete for applied versions', async () => {
    mockViewport(true)
    serveLaw([v3, v2, v1])
    let url = ''
    server.use(http.delete('*/api/tax/admin/law-versions/3', ({ request }) => {
      url = request.url
      serveLaw([v2, v1])
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    expect(within(list).queryByRole('button', { name: 'v1 초안 삭제' })).not.toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'v3 초안 삭제' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 v3 초안을 삭제할까요?' })
    expect(dialog.parentElement).toHaveClass('modal')
    expect(dialog).toHaveTextContent('이 초안에 입력한 값이 지워집니다. 적용된 버전과 다른 초안은 남습니다. 복구할 수 없습니다.')
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2))
    await waitFor(() => expect(document.activeElement).toBe(within(list).getByRole('heading', { name: '2026년 버전' })))
    expect(new URL(url).search).toBe('?rowVersion=31')
    expect(screen.getByRole('region', { name: /2026년 귀속 v2 · 초안/ })).toBeInTheDocument()
  })

  it.each([409, 404])('reloads and explains a %i draft delete', async (status) => {
    const calls = serveLaw([v3, v1])
    server.use(http.delete('*/api/tax/admin/law-versions/3', () => {
      if (status === 404) serveLaw([v1])
      return conflict(status)
    }))
    const { user } = renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    await user.click(within(list).getByRole('button', { name: 'v3 초안 삭제' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    if (status === 409) await waitFor(() => expect(calls.list).toBe(2))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('다른 곳에서 바뀌어 새로 불러왔습니다.')
    if (status === 404) await waitFor(() => expect(within(list).queryByRole('button', { name: /^v3 · / })).not.toBeInTheDocument())
  })
})
