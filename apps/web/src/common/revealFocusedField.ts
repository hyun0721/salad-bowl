/**
 * 시트의 크기가 바뀌면(화면 키보드) 시트 안에서 포커스된 입력란을 다시 보이게 하는 Modal용 callback ref.
 * visualViewport의 resize는 React가 새 높이를 반영하기 전에 발화해 아직 줄지 않은 시트 기준으로 스크롤하므로 쓰지 않는다.
 */
export function revealFocusedField(sheet: HTMLElement | null) {
  // 정리 함수를 돌려주지 않으면 React가 null로 다시 부른다.
  if (!sheet || typeof ResizeObserver === 'undefined') return undefined
  const focusedField = () => {
    const focused = document.activeElement
    return sheet.contains(focused) && focused?.matches('input, textarea, [contenteditable]') ? focused : null
  }
  const observer = new ResizeObserver(() => focusedField()?.scrollIntoView({ block: 'center' }))
  observer.observe(sheet)
  // RAC Popover는 시트 스크롤을 따라가지 않고 창 resize 때만 위치를 다시 잡아, 입력란이 움직이면 ComboBox 목록이 입력란을 덮는다.
  const repositionPopover = () => { if (focusedField()) window.dispatchEvent(new Event('resize')) }
  sheet.addEventListener('scroll', repositionPopover, { passive: true })
  return () => {
    observer.disconnect()
    sheet.removeEventListener('scroll', repositionPopover)
  }
}
