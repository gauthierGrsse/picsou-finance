import { api } from '@/lib/api-client'
import type { ExpenseCategory, ExpenseCategoryRequest } from '@/types/api'

export const expenseCategoriesApi = {
  list: () => api.get<ExpenseCategory[]>('/expense-categories').then(r => r.data),
  create: (data: ExpenseCategoryRequest) =>
    api.post<ExpenseCategory>('/expense-categories', data).then(r => r.data),
  update: (id: number, data: ExpenseCategoryRequest) =>
    api.put<ExpenseCategory>(`/expense-categories/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/expense-categories/${id}`),
}
