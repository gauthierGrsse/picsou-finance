import { api } from '@/lib/api-client'
import type { CategoryRule, CategoryRuleRequest } from '@/types/api'

export const categoryRulesApi = {
  list: () => api.get<CategoryRule[]>('/category-rules').then(r => r.data),
  create: (data: CategoryRuleRequest) =>
    api.post<CategoryRule>('/category-rules', data).then(r => r.data),
  update: (id: number, data: CategoryRuleRequest) =>
    api.put<CategoryRule>(`/category-rules/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/category-rules/${id}`),
}
