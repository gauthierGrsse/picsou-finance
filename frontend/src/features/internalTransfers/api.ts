import { api } from '@/lib/api-client'
import type { SuggestedTransferPair, Transaction, TransferLinkRequest } from '@/types/api'

export const internalTransfersApi = {
  suggested: () => api.get<SuggestedTransferPair[]>('/transfers/suggested').then(r => r.data),
  candidates: () => api.get<Transaction[]>('/transfers/candidates').then(r => r.data),
  link: (data: TransferLinkRequest) => api.post('/transfers/link', data),
  markWithoutMatch: (transactionId: number) => api.post(`/transfers/${transactionId}/mark-internal`),
  linkToManualAccount: (transactionId: number, data: { targetAccountId: number; description: string; date: string }) =>
    api.post<Transaction>(`/transfers/${transactionId}/link-to-manual-account`, data).then(r => r.data),
  unlink: (transactionId: number) => api.delete(`/transfers/${transactionId}/link`),
}
