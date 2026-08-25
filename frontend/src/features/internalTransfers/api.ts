import { api } from '@/lib/api-client'
import type { SuggestedTransferPair, Transaction, TransferLinkRequest } from '@/types/api'

export const internalTransfersApi = {
  suggested: () => api.get<SuggestedTransferPair[]>('/transfers/suggested').then(r => r.data),
  candidates: () => api.get<Transaction[]>('/transfers/candidates').then(r => r.data),
  link: (data: TransferLinkRequest) => api.post('/transfers/link', data),
  markWithoutMatch: (transactionId: number) => api.post(`/transfers/${transactionId}/mark-internal`),
  unlink: (transactionId: number) => api.delete(`/transfers/${transactionId}/link`),
}
