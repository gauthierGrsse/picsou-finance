import { useQuery } from '@tanstack/react-query'
import { expenseDashboardApi } from './api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

export function useExpenseDashboard(months: number, period?: string) {
  return useQuery({
    queryKey: ['expenseDashboard', months, period],
    queryFn: () => expenseDashboardApi.get(months, period),
    staleTime: QUERY_STALE_TIMES.expenseDashboard,
  })
}
