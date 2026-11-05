import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { TransactionType } from '../transactions/transactionsApi'
import { formatSignedWon, formatWon } from './format'

const STORAGE_KEY = 'saladbowl.amountMask'
type HiddenAmounts = Record<TransactionType, boolean>
const visible: HiddenAmounts = { INCOME: false, EXPENSE: false, TRANSFER: false }
const AmountMaskContext = createContext({ hidden: visible, setHidden: (_type: TransactionType, _hidden: boolean) => {} })

function readStored(): HiddenAmounts {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return { INCOME: stored?.INCOME === true, EXPENSE: stored?.EXPENSE === true, TRANSFER: stored?.TRANSFER === true }
  } catch {
    return visible
  }
}

export function AmountMaskProvider({ children }: { children: ReactNode }) {
  const [hidden, setAmounts] = useState(readStored)
  function setHidden(type: TransactionType, value: boolean) {
    const next = { ...hidden, [type]: value }
    setAmounts(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 저장소를 못 쓰면 이번 세션 동안만 기억한다.
    }
  }
  return <AmountMaskContext.Provider value={{ hidden, setHidden }}>{children}</AmountMaskContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAmountMask() {
  return useContext(AmountMaskContext)
}

// oxlint-disable-next-line react/only-export-components
export function useAmountFormatter(kind: TransactionType | 'income' | 'expense', signed = false) {
  const { hidden } = useAmountMask()
  const masked = hidden[kind === 'income' ? 'INCOME' : kind === 'expense' ? 'EXPENSE' : kind]
  return useCallback((amount: number) => {
    if (!masked) return signed ? formatSignedWon(amount) : formatWon(amount)
    const sign = signed ? amount > 0 ? '+' : amount < 0 ? '-' : '' : ''
    return `${sign}₩ •••••`
  }, [masked, signed])
}

export function TransactionAmount({ type, amount }: { type: TransactionType; amount: number }) {
  const format = useAmountFormatter(type, true)
  return <>{format(amount)}</>
}
