import { render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import SaladBowlOverlay from './SaladBowlOverlay'

it('shows nothing while inactive', () => {
  render(<SaladBowlOverlay active={false} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('opens a blocking dialog with the loader and closes after finishing', async () => {
  const { rerender } = render(<SaladBowlOverlay active />)
  const dialog = screen.getByRole('dialog', { name: '서버 준비 중' })
  expect(dialog).toHaveAccessibleDescription(/신선한 재료 찾는 중이에요/)
  expect(dialog).toHaveTextContent('신선한 재료 찾는 중이에요')
  expect(dialog).toHaveTextContent('오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요')
  rerender(<SaladBowlOverlay active={false} />)
  // 남은 재료를 담는 동안은 열려 있다.
  expect(screen.getByRole('dialog', { name: '서버 준비 중' })).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 2000 })
})
