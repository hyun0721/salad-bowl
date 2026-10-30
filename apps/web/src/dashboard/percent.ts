export function percent(expense: number, total: number) {
  const rounded = Math.round((expense / total) * 100)
  return rounded === 0 ? '1% 미만' : `${rounded}%`
}
