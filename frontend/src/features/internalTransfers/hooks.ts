import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { internalTransfersApi } from './api'
import type { TransferLinkRequest } from '@/types/api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

// Linking/unlinking a transfer flips proStatus on both legs, which shows up in every
// account's transaction list and in the expense dashboard's totals -- invalidate broadly.
function invalidateTransferViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['transfers'] })
  queryClient.invalidateQueries({ queryKey: ['accounts'] })
  queryClient.invalidateQueries({ queryKey: ['expenseDashboard'] })
}

export function useSuggestedTransfers() {
  return useQuery({
    queryKey: ['transfers', 'suggested'],
    queryFn: () => internalTransfersApi.suggested(),
    staleTime: QUERY_STALE_TIMES.internalTransfers,
  })
}

export function useConfirmTransferLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: TransferLinkRequest) => internalTransfersApi.link(data),
    onSuccess: () => invalidateTransferViews(queryClient),
  })
}

export function useUnlinkTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (transactionId: number) => internalTransfersApi.unlink(transactionId),
    onSuccess: () => invalidateTransferViews(queryClient),
  })
}
