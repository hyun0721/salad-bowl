import { useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi, type ManualTransactionInput, type TransactionPatch } from './transactionsApi'

export function useTransactionMutations() {
  const client = useQueryClient()
  const refreshLists = () => client.invalidateQueries({ queryKey: ['transactions'] })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: TransactionPatch }) => transactionsApi.update(id, patch),
    onSuccess: (_data, { id }) => {
      void refreshLists()
      void client.invalidateQueries({ queryKey: ['audits', id] })
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => transactionsApi.remove(id),
    onSuccess: () => void refreshLists(),
  })
  const addManual = useMutation({
    mutationFn: (input: ManualTransactionInput) => transactionsApi.addManual(input),
    onSuccess: () => void refreshLists(),
  })
  return { update, remove, addManual }
}
