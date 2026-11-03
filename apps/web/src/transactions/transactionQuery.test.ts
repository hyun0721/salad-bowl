import { expect, it } from 'vitest'
import { DEFAULT_FILTER, queryParams, readStoredFilter, storeFilter } from './transactionQuery'

it('omits the default filter and keeps sorting', () => {
  expect(queryParams(new URLSearchParams(), DEFAULT_FILTER, 'DATE_DESC').toString()).toBe('')
  expect(queryParams(new URLSearchParams(), DEFAULT_FILTER, 'AMOUNT_ASC').get('sort')).toBe('AMOUNT_ASC')
})
it('serializes repeated types and typed picks, including empty minor, ignoring disabled types', () => {
  const params = queryParams(new URLSearchParams({ month: '2026-10' }), {
    types: ['EXPENSE', 'INCOME'], picks: { EXPENSE: ['식비', '교통\t'], TRANSFER: ['이체'] },
  }, 'DATE_DESC')
  expect(params.getAll('type')).toEqual(['EXPENSE', 'INCOME'])
  expect(params.getAll('pick')).toEqual(['EXPENSE\t식비', 'EXPENSE\t교통\t'])
  expect(params.has('major')).toBe(false)
  expect(params.has('minor')).toBe(false)
})

it('stores applied filters, clears the default and rejects malformed values', () => {
  const filter = { types: ['EXPENSE' as const], picks: { EXPENSE: ['식비\t외식'] } }
  storeFilter(filter)
  expect(readStoredFilter()).toEqual(filter)
  storeFilter(DEFAULT_FILTER)
  expect(window.localStorage.getItem('saladbowl.transactionFilter')).toBeNull()
  expect(readStoredFilter()).toEqual(DEFAULT_FILTER)
  for (const bad of ['{', '[]', '{"types":["X"],"picks":{}}', '{"types":["EXPENSE"],"picks":{"EXPENSE":[1]}}']) {
    window.localStorage.setItem('saladbowl.transactionFilter', bad)
    expect(readStoredFilter()).toEqual(DEFAULT_FILTER)
  }
})
