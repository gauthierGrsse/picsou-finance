import { useQuery } from '@tanstack/react-query'
import { expenseDashboardApi } from './api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

export function useExpenseDashboard(months: number, periodStart: string, periodEnd: string, income: boolean) {
  return useQuery({
    queryKey: ['expenseDashboard', months, periodStart, periodEnd, income],
    queryFn: () => expenseDashboardApi.get(months, periodStart, periodEnd, income),
    staleTime: QUERY_STALE_TIMES.expenseDashboard,
  })
}
