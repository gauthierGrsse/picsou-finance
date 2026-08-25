import { useQuery } from '@tanstack/react-query'
import { transactionsApi } from './api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

export function useAllTransactions(periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: ['transactions', periodStart, periodEnd],
    queryFn: () => transactionsApi.list(periodStart, periodEnd),
    staleTime: QUERY_STALE_TIMES.accountDetail,
  })
}
