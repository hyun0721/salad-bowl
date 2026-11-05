import { useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi, type BulkTransactionPatch, type ManualTransactionInput, type TransactionPatch } from './transactionsApi'

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
  const bulkUpdate = useMutation({
    mutationFn: ({ ids, patch }: { ids: number[]; patch: BulkTransactionPatch }) => transactionsApi.bulkUpdate(ids, patch),
    onSuccess: () => void refreshLists(),
  })
  const remove = useMutation({
    mutationFn: (id: number) => transactionsApi.remove(id),
    onSuccess: () => void refreshLists(),
  })
  const addManual = useMutation({
    mutationFn: (input: ManualTransactionInput) => transactionsApi.addManual(input),
    onSuccess: () => refreshLists(),
  })
  return { update, remove, addManual, bulkUpdate }
}
