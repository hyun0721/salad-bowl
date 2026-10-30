import { useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi, type ManualTransactionInput, type TransactionPatch } from './transactionsApi'

export function useTransactionMutations() {
  const client = useQueryClient()
  const refreshLists = () => Promise.all([
    client.invalidateQueries({ queryKey: ['transactions'] }),
    client.invalidateQueries({ queryKey: ['categories'] }),
    client.invalidateQueries({ queryKey: ['summary'] }),
  ])

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
    onSuccess: () => refreshLists(),
  })
  return { update, remove, addManual }
}
