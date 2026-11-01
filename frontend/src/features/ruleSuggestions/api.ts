import { api } from '@/lib/api-client'
import type { CategoryRuleSuggestion } from '@/types/api'

export const ruleSuggestionsApi = {
  list: () => api.get<CategoryRuleSuggestion[]>('/rule-suggestions').then(r => r.data),
  dismiss: (pattern: string) => api.post('/rule-suggestions/dismiss', { pattern }),
}
