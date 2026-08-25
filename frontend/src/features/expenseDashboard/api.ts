import { api } from '@/lib/api-client'
import type { ExpenseDashboardResponse } from '@/types/api'

export const expenseDashboardApi = {
  get: (months: number, periodStart: string, periodEnd: string, income: boolean) =>
    api.get<ExpenseDashboardResponse>('/expense-dashboard', { params: { months, periodStart, periodEnd, income } }).then(r => r.data),
}
