import { describe, expect, it } from 'vitest'
import { queryParams, transactionFilterGroups } from './transactionQuery'

const categories = [
  { major: '식비', count: 3, minors: [{ minor: '외식', count: 2 }] },
  { major: '교통', count: 1, minors: [{ minor: '버스', count: 1 }] },
]

describe('transactionQuery', () => {
  it('appends repeated filter params and omits the default sort', () => {
    const p = queryParams(new URLSearchParams({ month: '2026-09' }), { major: ['식비', '교통'], minor: [''] }, 'DATE_DESC')
    expect(p.toString()).toBe('month=2026-09&major=%EC%8B%9D%EB%B9%84&major=%EA%B5%90%ED%86%B5&minor=')
    expect(queryParams(new URLSearchParams(), {}, 'AMOUNT_ASC').get('sort')).toBe('AMOUNT_ASC')
  })

  it('narrows minor options to the drafted majors and keeps 미분류', () => {
    const minor = transactionFilterGroups(categories, { major: ['교통'] }).find((g) => g.key === 'minor')!
    expect(minor.options).toEqual([{ value: '버스', label: '교통 · 버스' }, { value: '', label: '미분류' }])
    const all = transactionFilterGroups(categories, {}).find((g) => g.key === 'minor')!
    expect(all.options.map((o) => o.value)).toEqual(['외식', '버스', ''])
  })

  it('orders groups as 타입, 대분류, 소분류', () => {
    expect(transactionFilterGroups(categories, {}).map((g) => g.key)).toEqual(['type', 'major', 'minor'])
  })
})
