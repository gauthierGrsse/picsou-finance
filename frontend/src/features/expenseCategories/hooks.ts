import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expenseCategoriesApi } from './api'
import type { ExpenseCategoryRequest } from '@/types/api'
import { QUERY_STALE_TIMES } from '@/lib/constants'

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expenseCategories'],
    queryFn: () => expenseCategoriesApi.list(),
    staleTime: QUERY_STALE_TIMES.expenseCategories,
  })
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ExpenseCategoryRequest) => expenseCategoriesApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenseCategories'] }),
  })
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExpenseCategoryRequest }) =>
      expenseCategoriesApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenseCategories'] }),
  })
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => expenseCategoriesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenseCategories'] }),
  })
}
