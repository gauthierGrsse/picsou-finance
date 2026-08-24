import { api } from '@/lib/api-client'
import type { SuggestedTransferPair, TransferLinkRequest } from '@/types/api'

export const internalTransfersApi = {
  suggested: () => api.get<SuggestedTransferPair[]>('/transfers/suggested').then(r => r.data),
  link: (data: TransferLinkRequest) => api.post('/transfers/link', data),
  unlink: (transactionId: number) => api.delete(`/transfers/${transactionId}/link`),
}
