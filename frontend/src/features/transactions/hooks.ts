import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { transactionsApi } from './api'
import { accountsApi } from '@/features/accounts/api'
import { QUERY_STALE_TIMES } from '@/lib/constants'
import type { TransactionClassificationRequest } from '@/types/api'

export function useAllTransactions(periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: ['transactions', periodStart, periodEnd],
    queryFn: () => transactionsApi.list(periodStart, periodEnd),
    staleTime: QUERY_STALE_TIMES.accountDetail,
  })
}

/**
 * Same classification endpoint as useUpdateTransactionClassification, but with accountId
 * supplied per call instead of fixed at hook creation -- the global transactions list spans
 * every account, so it can't know which one up front the way the per-account page can.
 */
export function useQuickClassifyTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, txId, data }: { accountId: number; txId: number; data: TransactionClassificationRequest }) =>
      accountsApi.updateClassification(accountId, txId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['expenseDashboard'] })
    },
  })
}
