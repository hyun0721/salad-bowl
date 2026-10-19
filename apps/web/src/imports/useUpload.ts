import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importsApi } from './importsApi'

/** 업로드 후 커버리지·이력·거래 목록을 새로 가져오게 한다. */
export function useUpload() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: importsApi.upload,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['coverage'] })
      void client.invalidateQueries({ queryKey: ['imports'] })
      void client.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
