import { api } from '@/lib/api-client'
import type { ExpenseDashboardResponse } from '@/types/api'

export const expenseDashboardApi = {
  get: (months: number, period?: string) =>
    api.get<ExpenseDashboardResponse>('/expense-dashboard', { params: { months, period } }).then(r => r.data),
}
