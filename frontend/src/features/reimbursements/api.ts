import { api } from '@/lib/api-client'
import type { LinkExpensesRequest, PendingReimbursements, Reimbursement, ReimbursementRequest, Transaction } from '@/types/api'

export const reimbursementsApi = {
  list: () => api.get<Reimbursement[]>('/reimbursements').then(r => r.data),
  get: (id: number) => api.get<Reimbursement>(`/reimbursements/${id}`).then(r => r.data),
  pending: () => api.get<PendingReimbursements>('/reimbursements/pending').then(r => r.data),
  candidateCredits: () => api.get<Transaction[]>('/reimbursements/candidate-credits').then(r => r.data),
  create: (data: ReimbursementRequest) => api.post<Reimbursement>('/reimbursements', data).then(r => r.data),
  addExpenses: (id: number, data: LinkExpensesRequest) =>
    api.post<Reimbursement>(`/reimbursements/${id}/expenses`, data).then(r => r.data),
  unlinkExpense: (id: number, txId: number) => api.delete(`/reimbursements/${id}/expenses/${txId}`),
  delete: (id: number) => api.delete(`/reimbursements/${id}`),
}
