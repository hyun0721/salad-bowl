import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import Skeleton, { SkeletonRegion } from './Skeleton'

it('announces one busy status with hidden loading text and hides the blocks', () => {
  const { container } = render(<SkeletonRegion label="거래를 불러오는 중입니다."><Skeleton height={12} /></SkeletonRegion>)
  const region = screen.getByRole('status')
  expect(region).toHaveAttribute('aria-busy', 'true')
  expect(region).toHaveTextContent('거래를 불러오는 중입니다.')
  expect(screen.getByText('거래를 불러오는 중입니다.')).toHaveClass('srOnly')
  expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
})
