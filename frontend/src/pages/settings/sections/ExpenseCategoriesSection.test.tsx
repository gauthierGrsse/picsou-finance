import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExpenseCategoriesSection } from './ExpenseCategoriesSection'
import type { ExpenseCategory } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => (typeof opts === 'string' ? opts : key),
  }),
}))

const categories: ExpenseCategory[] = [
  { id: 1, name: 'Restauration', color: '#f97316' },
  { id: 2, name: 'Courses', color: '#22c55e' },
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
  it('lists existing categories', () => {
    render(<ExpenseCategoriesSection />)

    expect(screen.getByText('Restauration')).toBeInTheDocument()
    expect(screen.getByText('Courses')).toBeInTheDocument()
  })

  it('creating a new category submits name and color', async () => {
    render(<ExpenseCategoriesSection />)

    fireEvent.click(screen.getByRole('button', { name: /expenseCategories.newCategory/ }))
    fireEvent.change(screen.getByLabelText('expenseCategories.nameLabel'), { target: { value: 'Vacances' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.create' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalledOnce())
    expect(createMutate.mock.calls[0][0]).toEqual({ name: 'Vacances', color: expect.any(String) })
  })

  it('editing an existing category prefills its name', () => {
    render(<ExpenseCategoriesSection />)

    // Each row has [edit, delete] icon buttons in that order.
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
