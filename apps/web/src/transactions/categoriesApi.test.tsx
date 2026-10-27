import { describe, expect, it } from 'vitest'
import { majorOptions, minorOptions, type CategoryOption } from './categoriesApi'

const list: CategoryOption[] = [
  { major: '식비', count: 4, minors: [{ minor: '카페', count: 2 }, { minor: '점심', count: 1 }] },
  { major: '교통', count: 3, minors: [{ minor: '버스', count: 2 }] },
]

describe('category options', () => {
  it('keeps the server order for majors', () => {
    expect(majorOptions(list)).toEqual(['식비', '교통'])
  })

  it('returns minors only for an exact major', () => {
    expect(minorOptions(list, '식비')).toEqual(['카페', '점심'])
    expect(minorOptions(list, '식')).toEqual([])
    expect(minorOptions(list, '')).toEqual([])
  })
})
