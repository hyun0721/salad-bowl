import { afterEach, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderPage } from '../test/renderPage'
import { mockViewport } from '../test/mockViewport'
import { AmountMaskProvider } from '../common/AmountMask'
import AppLayout from './AppLayout'
import { http, HttpResponse, delay } from 'msw'
import { server } from '../test/server'

afterEach(() => localStorage.clear())
it.each([true, false])('opens settings and persists all three switches (narrow=%s)', async (narrow) => {
  mockViewport(narrow)
  const { user } = renderPage(<AmountMaskProvider><AppLayout /></AmountMaskProvider>, {
    groups: [{ groupId: 1, name: '아주 긴 가상 그룹 이름으로 말줄임 확인', role: 'ADMIN', sharing: true }],
  })
  await user.click(await screen.findByRole('button', { name: '설정' }))
  const dialog = screen.getByRole('dialog', { name: '설정' })
  expect(within(dialog).getByRole('heading', { name: '금액 숨기기' })).toBeInTheDocument()
  for (const name of ['수입 금액 숨기기', '지출 금액 숨기기', '이체 금액 숨기기']) {
    const toggle = within(dialog).getByRole('switch', { name })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(toggle).toBeChecked()
  }
  expect(JSON.parse(localStorage.getItem('saladbowl.amountMask')!)).toEqual({ INCOME: true, EXPENSE: true, TRANSFER: true })
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: '설정' }))
  expect(screen.getByRole('switch', { name: '지출 금액 숨기기' })).toBeChecked()
})

it.each([['/', '홈'], ['/dashboard/major/share', '대시보드'], ['/transactions', '거래 목록']])('shows the narrow header title at %s', async (path, title) => {
  mockViewport(true)
  renderPage(<AppLayout />, { path })
  const heading = await screen.findByRole('heading', { level: 1, name: title })
  expect(within(screen.getByRole('banner')).getByRole('heading', { level: 1 })).toBe(heading)
  if (path === '/') expect(within(heading).getByRole('img', { name: '홈' })).toHaveAttribute('width', '28')
})

it('selects a group in the sheet and closes it', async () => {
  mockViewport(true)
  const { user } = renderPage(<AppLayout />, { groups: [
    { groupId: 1, name: '가상 그룹 하나' }, { groupId: 2, name: '가상 그룹 둘' },
  ] })
  await user.click(await screen.findByRole('button', { name: '그룹 선택, 현재: 가상 그룹 하나' }))
  expect(screen.getByRole('radio', { name: '가상 그룹 하나' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: '가상 그룹 둘' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '그룹 선택, 현재: 가상 그룹 둘' })).toBeInTheDocument()
  expect(localStorage.getItem('saladbowl.selectedGroupId')).toBe('2')
})

it('opens an empty group sheet and closes it on the groups link', async () => {
  mockViewport(true)
  const { user } = renderPage(<AppLayout />)
  await user.click(await screen.findByRole('button', { name: '그룹 선택' }))
  await user.click(screen.getByRole('link', { name: '그룹 없음 · 만들기 또는 초대받기' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: '그룹 관리' })).toHaveFocus()
})

it('retries failed groups inside the sheet', async () => {
  mockViewport(true)
  const { user } = renderPage(<AppLayout />)
  server.use(http.get('*/api/groups', () => new HttpResponse(null, { status: 500 })))
  const trigger = await screen.findByRole('button', { name: '그룹 선택' })
  await user.click(trigger)
  expect(await screen.findByText('그룹을 불러오지 못했습니다')).toBeInTheDocument()
  server.use(http.get('*/api/groups', () => HttpResponse.json([{ groupId: 3, name: '재시도 그룹' }])))
  await user.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('radio', { name: '재시도 그룹' })).toBeChecked()
})

it('disables the group trigger while loading', async () => {
  mockViewport(true)
  renderPage(<AppLayout />)
  server.use(http.get('*/api/groups', async () => { await delay('infinite'); return HttpResponse.json([]) }))
  expect(await screen.findByRole('button', { name: '그룹 선택' })).toBeDisabled()
})
