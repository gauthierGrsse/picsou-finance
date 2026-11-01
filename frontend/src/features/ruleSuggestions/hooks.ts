import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ruleSuggestionsApi } from './api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

export const RULE_SUGGESTIONS_KEY = ['ruleSuggestions'] as const

/** Rules the member's own categorization history makes worth adopting. Adopting one is an
 * ordinary categorization rule (budget hooks); callers refresh this list afterwards, since a
 * pattern that just became a rule drops out of it. */
export function useRuleSuggestions() {
  return useQuery({
    queryKey: RULE_SUGGESTIONS_KEY,
    queryFn: () => ruleSuggestionsApi.list(),
    staleTime: QUERY_STALE_TIMES.categoryRules,
  })
}

export function useDismissRuleSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (pattern: string) => ruleSuggestionsApi.dismiss(pattern),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULE_SUGGESTIONS_KEY }),
  })
}
