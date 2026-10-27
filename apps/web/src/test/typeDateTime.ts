import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

export async function typeDateTime(user: UserEvent, text: string) {
  const group = await screen.findByRole('group', { name: '일시' })
  await user.click(within(group).getAllByRole('spinbutton')[0])
  await user.keyboard(text)
}
