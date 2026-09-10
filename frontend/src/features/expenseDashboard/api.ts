import { api } from '@/lib/api-client'
import type { ExpenseDashboardResponse, ExpensePaceResponse, RecurringTransaction } from '@/types/api'

export const expenseDashboardApi = {
  get: (months: number, periodStart: string, periodEnd: string, income: boolean) =>
    api.get<ExpenseDashboardResponse>('/expense-dashboard', { params: { months, periodStart, periodEnd, income } }).then(r => r.data),
  getPace: (historyMonths: number) =>
    api.get<ExpensePaceResponse>('/expense-dashboard/pace', { params: { historyMonths } }).then(r => r.data),
  getRecurring: () =>
    api.get<RecurringTransaction[]>('/expense-dashboard/recurring').then(r => r.data),
}
