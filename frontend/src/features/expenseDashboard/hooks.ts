import { useQuery } from '@tanstack/react-query'
import { expenseDashboardApi } from './api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

export function useExpenseDashboard(months: number, periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: ['expenseDashboard', months, periodStart, periodEnd],
    queryFn: () => expenseDashboardApi.get(months, periodStart, periodEnd),
    staleTime: QUERY_STALE_TIMES.expenseDashboard,
  })
}
