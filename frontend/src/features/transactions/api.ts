import { api } from '@/lib/api-client'
import type { Transaction } from '@/types/api'

export const transactionsApi = {
  list: (periodStart: string, periodEnd: string) =>
    api.get<Transaction[]>('/transactions', { params: { periodStart, periodEnd } }).then(r => r.data),
}
