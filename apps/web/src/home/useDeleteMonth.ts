import { useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi } from '../transactions/transactionsApi'

type Input = { month: string; includeManual: boolean }

/** 한 달 거래를 영구 삭제하고, 그 달을 보여주는 화면들을 새로 가져오게 한다. */
export function useDeleteMonth() {
  const client = useQueryClient()
  return useMutation({
    mutationKey: ['delete-month'],
    mutationFn: ({ month, includeManual }: Input) => transactionsApi.deleteMonth(month, includeManual),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['coverage'] })
      void client.invalidateQueries({ queryKey: ['transactions'] })
      void client.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}
