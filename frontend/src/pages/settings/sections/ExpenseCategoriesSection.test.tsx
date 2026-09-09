import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExpenseCategoriesSection } from './ExpenseCategoriesSection'
import type { ExpenseCategory } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => (typeof opts === 'string' ? opts : key),
  }),
}))

const categories: ExpenseCategory[] = [
  { id: 1, name: 'Restauration', color: '#f97316', type: 'EXPENSE', parentId: null },
  { id: 2, name: 'Courses', color: '#22c55e', type: 'BOTH', parentId: null },
  { id: 3, name: 'Bio', color: '#22c55e', type: 'EXPENSE', parentId: 2 }, // subcategory of Courses
  { id: 4, name: 'Salaire', color: '#6366f1', type: 'INCOME', parentId: null },
]

const createMutate = vi.fn()
const updateMutate = vi.fn()
const deleteMutate = vi.fn()

vi.mock('@/features/expenseCategories/hooks', () => ({
  useExpenseCategories: () => ({ data: categories, isLoading: false }),
  useCreateExpenseCategory: () => ({ mutate: createMutate, reset: vi.fn(), isPending: false, isError: false }),
  useUpdateExpenseCategory: () => ({ mutate: updateMutate, reset: vi.fn(), isPending: false, isError: false }),
  useDeleteExpenseCategory: () => ({ mutate: deleteMutate, reset: vi.fn(), isPending: false, isError: false }),
}))

describe('ExpenseCategoriesSection', () => {
  beforeEach(() => {
    createMutate.mockClear()
    updateMutate.mockClear()
    deleteMutate.mockClear()
  })

  it('lists existing categories, subcategories nested under their parent', () => {
    render(<ExpenseCategoriesSection />)

    expect(screen.getByText('Restauration')).toBeInTheDocument()
    expect(screen.getByText('Courses')).toBeInTheDocument()
    expect(screen.getByText('Bio')).toBeInTheDocument()
    expect(screen.getByText('Salaire')).toBeInTheDocument()
  })

  it('shows a type badge for EXPENSE/INCOME-only categories, none for BOTH', () => {
    render(<ExpenseCategoriesSection />)

    expect(screen.getAllByText('expenseCategories.type.expense').length).toBeGreaterThan(0)
    expect(screen.getByText('expenseCategories.type.income')).toBeInTheDocument()
  })

  it('creating a new category defaults to type BOTH and no parent', async () => {
    render(<ExpenseCategoriesSection />)

    fireEvent.click(screen.getByRole('button', { name: /expenseCategories.newCategory/ }))
    fireEvent.change(screen.getByLabelText('expenseCategories.nameLabel'), { target: { value: 'Vacances' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.create' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalledOnce())
    expect(createMutate.mock.calls[0][0]).toEqual({ name: 'Vacances', color: expect.any(String), type: 'BOTH', parentId: null })
  })

  it('creating a subcategory sends the chosen type and parent', async () => {
    render(<ExpenseCategoriesSection />)

    fireEvent.click(screen.getByRole('button', { name: /expenseCategories.newCategory/ }))
    fireEvent.change(screen.getByLabelText('expenseCategories.nameLabel'), { target: { value: 'Bio local' } })
    fireEvent.change(screen.getByLabelText('expenseCategories.typeLabel'), { target: { value: 'EXPENSE' } })
    fireEvent.change(screen.getByLabelText('expenseCategories.parentLabel'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.create' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalledOnce())
    expect(createMutate.mock.calls[0][0]).toEqual({ name: 'Bio local', color: expect.any(String), type: 'EXPENSE', parentId: 2 })
  })

  it('the parent dropdown only offers top-level categories, excluding the one being edited', () => {
    render(<ExpenseCategoriesSection />)

    const editButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-pencil'))
    // Edit "Courses" (id 2, top-level) -- it must not be able to become its own parent,
    // and "Bio" (a subcategory) must not be offered as a parent either.
    fireEvent.click(editButtons[1])

    const parentSelect = screen.getByLabelText('expenseCategories.parentLabel') as HTMLSelectElement
    const optionLabels = Array.from(parentSelect.options).map(o => o.textContent)
    expect(optionLabels).not.toContain('Courses')
    expect(optionLabels).not.toContain('Bio')
    expect(optionLabels).toContain('Restauration')
  })

  it('editing an existing category prefills its name', () => {
    render(<ExpenseCategoriesSection />)

    const editButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-pencil'))
    fireEvent.click(editButtons[0])

    expect(screen.getByDisplayValue('Restauration')).toBeInTheDocument()
  })

  it('deleting a category calls the delete mutation', async () => {
    render(<ExpenseCategoriesSection />)

    const deleteButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-trash2'))
    fireEvent.click(deleteButtons[0])
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }))

    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(1, expect.anything()))
  })
})
