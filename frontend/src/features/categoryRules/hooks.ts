import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoryRulesApi } from './api'
import type { CategoryRuleRequest } from '@/types/api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

export function useCategoryRules() {
  return useQuery({
    queryKey: ['categoryRules'],
    queryFn: () => categoryRulesApi.list(),
    staleTime: QUERY_STALE_TIMES.categoryRules,
  })
}

export function useCategoryRuleSuggestions() {
  return useQuery({
    queryKey: ['categoryRuleSuggestions'],
    queryFn: () => categoryRulesApi.listSuggestions(),
    staleTime: QUERY_STALE_TIMES.categoryRules,
  })
}

/** Invalidates transactions and the expense dashboard too -- creating or editing a rule
 * retroactively classifies matching uncategorized transactions server-side, so any list or
 * breakdown currently on screen is stale. The suggestion list also shifts: a pattern that
 * just became a rule (or was dismissed) drops out of it. */
function invalidateAfterMutation(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['categoryRules'] })
  queryClient.invalidateQueries({ queryKey: ['categoryRuleSuggestions'] })
  queryClient.invalidateQueries({ queryKey: ['transactions'] })
  queryClient.invalidateQueries({ queryKey: ['expenseDashboard'] })
}

export function useDismissCategoryRuleSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (pattern: string) => categoryRulesApi.dismissSuggestion(pattern),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categoryRuleSuggestions'] }),
  })
}

export function useCreateCategoryRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CategoryRuleRequest) => categoryRulesApi.create(data),
    onSuccess: () => invalidateAfterMutation(queryClient),
  })
}

export function useUpdateCategoryRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryRuleRequest }) =>
      categoryRulesApi.update(id, data),
    onSuccess: () => invalidateAfterMutation(queryClient),
  })
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => categoryRulesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categoryRules'] }),
  })
}
