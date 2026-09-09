import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TransactionClassificationModal } from './TransactionClassificationModal'
import type { ExpenseCategory, Transaction } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => (typeof opts === 'string' ? opts : key),
  }),
}))

const categories: ExpenseCategory[] = [
  { id: 1, name: 'Restauration', color: '#f97316', type: 'BOTH', parentId: null },
  { id: 2, name: 'Courses', color: '#22c55e', type: 'BOTH', parentId: null },
]

function syncedTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 7,
    date: '2026-01-05',
    description: 'Restaurant',
    amount: -25,
    type: null,
    category: null,
    nativeCurrency: 'EUR',
    isManual: false, // the primary case: a synced (e.g. Revolut) transaction
    txType: null,
    ticker: null,
    name: null,
    quantity: null,
    pricePerUnit: null,
    fees: null,
    proStatus: 'NON_CLASSE',
    expenseCategoryId: null,
    reimbursementStatus: null,
    reimbursementId: null,
    ...overrides,
  }
}

describe('TransactionClassificationModal', () => {
  it('submits the selected proStatus and category on a synced transaction', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <TransactionClassificationModal
        open
        onOpenChange={vi.fn()}
        transaction={syncedTransaction()}
        categories={categories}
        onSubmit={onSubmit}
      />
    )

    fireEvent.change(screen.getByDisplayValue('proStatus.nonClasse'), { target: { value: 'PERSO' } })
    fireEvent.change(screen.getByDisplayValue('classification.noCategory'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith({ proStatus: 'PERSO', expenseCategoryId: 1 })
  })

  it('preselects the transaction current classification', () => {
    render(
      <TransactionClassificationModal
        open
        onOpenChange={vi.fn()}
        transaction={syncedTransaction({ proStatus: 'PRO_ABSORBE', expenseCategoryId: 2 })}
        categories={categories}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('proStatus.proAbsorbe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Courses')).toBeInTheDocument()
  })

  it('clearing the category submits null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <TransactionClassificationModal
        open
        onOpenChange={vi.fn()}
        transaction={syncedTransaction({ proStatus: 'PERSO', expenseCategoryId: 1 })}
        categories={categories}
        onSubmit={onSubmit}
      />
    )

    fireEvent.change(screen.getByDisplayValue('Restauration'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith({ proStatus: 'PERSO', expenseCategoryId: null })
  })

  it('only offers categories matching the transaction\'s sign, BOTH always included', () => {
    const typedCategories: ExpenseCategory[] = [
      { id: 1, name: 'Restauration', color: '#f97316', type: 'EXPENSE', parentId: null },
      { id: 2, name: 'Salaire', color: '#22c55e', type: 'INCOME', parentId: null },
      { id: 3, name: 'Autre', color: '#a855f7', type: 'BOTH', parentId: null },
    ]

    render(
      <TransactionClassificationModal
        open
        onOpenChange={vi.fn()}
        transaction={syncedTransaction({ amount: -25 })}
        categories={typedCategories}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByText('Restauration')).toBeInTheDocument()
    expect(screen.getByText('Autre')).toBeInTheDocument()
    expect(screen.queryByText('Salaire')).not.toBeInTheDocument()
  })

  it('groups subcategories under their parent as an optgroup', () => {
    const nestedCategories: ExpenseCategory[] = [
      { id: 1, name: 'Alimentation', color: '#f97316', type: 'BOTH', parentId: null },
      { id: 2, name: 'Bio', color: '#22c55e', type: 'BOTH', parentId: 1 },
    ]

    render(
      <TransactionClassificationModal
        open
        onOpenChange={vi.fn()}
        transaction={syncedTransaction()}
        categories={nestedCategories}
        onSubmit={vi.fn()}
      />
    )

    const select = screen.getByDisplayValue('classification.noCategory') as HTMLSelectElement
    const group = select.querySelector('optgroup')
    expect(group).not.toBeNull()
    expect(group?.label).toBe('Alimentation')
    expect(group?.querySelectorAll('option')).toHaveLength(2) // parent itself + Bio
  })
})
