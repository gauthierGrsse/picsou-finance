import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CategoryRulesSection } from './CategoryRulesSection'
import type { CategoryRule, ExpenseCategory } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => (typeof opts === 'string' ? opts : key),
  }),
}))

const categories: ExpenseCategory[] = [
  { id: 1, name: 'Courses', color: '#22c55e', type: 'EXPENSE', parentId: null },
  { id: 2, name: 'Salaire', color: '#6366f1', type: 'INCOME', parentId: null },
]

const rules: CategoryRule[] = [
  { id: 10, pattern: 'carrefour', expenseCategoryId: 1, categoryName: 'Courses', categoryColor: '#22c55e', proStatus: null },
]

const createMutate = vi.fn()
const updateMutate = vi.fn()
const deleteMutate = vi.fn()

vi.mock('@/features/categoryRules/hooks', () => ({
  useCategoryRules: () => ({ data: rules, isLoading: false }),
  useCreateCategoryRule: () => ({ mutate: createMutate, reset: vi.fn(), isPending: false, isError: false }),
  useUpdateCategoryRule: () => ({ mutate: updateMutate, reset: vi.fn(), isPending: false, isError: false }),
  useDeleteCategoryRule: () => ({ mutate: deleteMutate, reset: vi.fn(), isPending: false, isError: false }),
}))

vi.mock('@/features/expenseCategories/hooks', () => ({
  useExpenseCategories: () => ({ data: categories }),
}))

describe('CategoryRulesSection', () => {
  beforeEach(() => {
    createMutate.mockClear()
    updateMutate.mockClear()
    deleteMutate.mockClear()
  })

  it('lists existing rules with their pattern and target category', () => {
    render(<CategoryRulesSection />)

    expect(screen.getByText('carrefour')).toBeInTheDocument()
    expect(screen.getByText('Courses')).toBeInTheDocument()
  })

  it('creating a rule with no status change sends proStatus null', async () => {
    render(<CategoryRulesSection />)

    fireEvent.click(screen.getByRole('button', { name: /categoryRules.newRule/ }))
    fireEvent.change(screen.getByLabelText('categoryRules.patternLabel'), { target: { value: 'sncf' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.create' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalledOnce())
    expect(createMutate.mock.calls[0][0]).toEqual({ pattern: 'sncf', expenseCategoryId: 1, proStatus: null })
  })

  it('creating a rule that also sets a status includes it', async () => {
    render(<CategoryRulesSection />)

    fireEvent.click(screen.getByRole('button', { name: /categoryRules.newRule/ }))
    fireEvent.change(screen.getByLabelText('categoryRules.patternLabel'), { target: { value: 'virement salaire' } })
    fireEvent.change(screen.getByLabelText('categoryRules.categoryLabel'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('categoryRules.statusLabel'), { target: { value: 'PERSO' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.create' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalledOnce())
    expect(createMutate.mock.calls[0][0]).toEqual({ pattern: 'virement salaire', expenseCategoryId: 2, proStatus: 'PERSO' })
  })

  it('editing an existing rule prefills its pattern', () => {
    render(<CategoryRulesSection />)

    const editButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-pencil'))
    fireEvent.click(editButtons[0])

    expect(screen.getByDisplayValue('carrefour')).toBeInTheDocument()
  })

  it('deleting a rule calls the delete mutation', async () => {
    render(<CategoryRulesSection />)

    const deleteButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-trash2'))
    fireEvent.click(deleteButtons[0])
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }))

    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(10, expect.anything()))
  })
})
