import { createContext, useContext, useState, type ReactNode } from 'react'

const yearFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' })

/** 한국 시각 기준 올해. 서버가 연도 기록을 만들 수 있는 범위(올해·전년도·다음 해)와 같은 기준이다. */
// oxlint-disable-next-line react/only-export-components
export function seoulYear(now: Date): number {
  return Number(yearFormat.format(now))
}

type TaxYear = { year: number; setYear: (year: number) => void; choices: number[] }
const TaxYearContext = createContext<TaxYear | null>(null)

/**
 * 소득공제 화면이 기억하는 귀속연도. React 상태(메모리)에만 둔다(TAX-07).
 * 로그인 레이아웃 안에 있어 로그아웃하면 사라지고, 새로 고치면 올해로 돌아간다.
 */
export function TaxYearProvider({ children, today }: { children: ReactNode; today?: Date }) {
  // 선택지는 로그인 동안 고정한다. 자정을 넘겨 연도가 바뀌어도 새로 고칠 때까지 같은 3개다.
  const [thisYear] = useState(() => seoulYear(today ?? new Date()))
  const [year, setYear] = useState(thisYear)
  return (
    <TaxYearContext.Provider value={{ year, setYear, choices: [thisYear - 1, thisYear, thisYear + 1] }}>
      {children}
    </TaxYearContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useTaxYear(): TaxYear {
  const value = useContext(TaxYearContext)
  if (!value) throw new Error('useTaxYear는 TaxYearProvider 안에서만 쓴다')
  return value
}
