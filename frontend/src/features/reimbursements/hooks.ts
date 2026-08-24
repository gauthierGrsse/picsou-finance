import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reimbursementsApi } from './api'
import type { LinkExpensesRequest, ReimbursementRequest } from '@/types/api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

// Every account's transaction list may include the transactions a reimbursement
// touches (a credit or an expense), so mutations invalidate broadly rather than
// tracking which specific accountIds were involved.
function invalidateReimbursementViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
  queryClient.invalidateQueries({ queryKey: ['accounts'] })
  queryClient.invalidateQueries({ queryKey: ['expenseDashboard'] })
}

export function useReimbursements() {
  return useQuery({
    queryKey: ['reimbursements'],
    queryFn: () => reimbursementsApi.list(),
    staleTime: QUERY_STALE_TIMES.reimbursements,
  })
}

export function usePendingReimbursements() {
  return useQuery({
    queryKey: ['reimbursements', 'pending'],
    queryFn: () => reimbursementsApi.pending(),
    staleTime: QUERY_STALE_TIMES.reimbursements,
  })
}

export function useCandidateCredits() {
  return useQuery({
    queryKey: ['reimbursements', 'candidate-credits'],
    queryFn: () => reimbursementsApi.candidateCredits(),
    staleTime: QUERY_STALE_TIMES.reimbursements,
  })
}

export function useCreateReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ReimbursementRequest) => reimbursementsApi.create(data),
    onSuccess: () => invalidateReimbursementViews(queryClient),
  })
}

export function useAddReimbursementExpenses() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: LinkExpensesRequest }) =>
      reimbursementsApi.addExpenses(id, data),
    onSuccess: () => invalidateReimbursementViews(queryClient),
  })
}

export function useUnlinkReimbursementExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, txId }: { id: number; txId: number }) => reimbursementsApi.unlinkExpense(id, txId),
    onSuccess: () => invalidateReimbursementViews(queryClient),
  })
}

export function useDeleteReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => reimbursementsApi.delete(id),
    onSuccess: () => invalidateReimbursementViews(queryClient),
  })
}
