import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation, useNavigate } from 'react-router'
import { expect, it, vi } from 'vitest'
import Dialog from './Dialog'
import { DialogHistoryProvider } from './DialogHistory'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function Harness() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  return <>
    <output>{location.pathname}</output>
    <button onClick={() => setOpen(true)}>열기</button>
    {open && <Dialog title="상세" onClose={() => setOpen(false)}>
      <button onClick={() => { setOpen(false); void navigate('/dashboard/minor') }}>소분류 보기</button>
    </Dialog>}
  </>
}

it('keeps a close-and-push navigation before its transition commits, then returns with one back', async () => {
  const previousUrl = window.location.href
  const previousState: unknown = window.history.state
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', false)
  window.history.replaceState(null, '', '/dashboard/major')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const click = (label: string) => {
    const button = [...document.querySelectorAll('button')].find((node) => node.textContent === label)
    expect(button).toBeDefined()
    button!.click()
  }
  try {
    // act는 sync 닫힘과 transition 이동을 함께 flush하므로 실제 클릭/이벤트 루프로 재현한다.
    root.render(<BrowserRouter><DialogHistoryProvider><Harness /></DialogHistoryProvider></BrowserRouter>)
    await pause(100)
    click('열기')
    await pause(100)
    expect(window.history.state.usr.dialogStack).toHaveLength(1)

    click('소분류 보기')
    await pause(400)
    expect(window.location.pathname).toBe('/dashboard/minor')
    expect(container.querySelector('output')).toHaveTextContent('/dashboard/minor')
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    window.history.back()
    await pause(200)
    expect(window.location.pathname).toBe('/dashboard/major')
    expect(container.querySelector('output')).toHaveTextContent('/dashboard/major')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(window.history.state.usr.dialogStack).toEqual([])
  } finally {
    root.unmount()
    container.remove()
    window.history.replaceState(previousState, '', previousUrl)
    vi.unstubAllGlobals()
  }
})
