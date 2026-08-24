import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReimbursementsList } from './ReimbursementsList'
import type { Reimbursement, Transaction } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => (typeof opts === 'string' ? opts : key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    date: '2026-01-05',
    description: 'tx',
    amount: 0,
    type: null,
    category: null,
    nativeCurrency: 'EUR',
    isManual: false,
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

const reimbursements: Reimbursement[] = [
  {
    id: 1,
    creditTransaction: tx({ id: 50, description: 'Note de frais janvier', amount: 75 }),
    expenses: [tx({ id: 1, description: 'Repas client A', amount: -25, reimbursementId: 1, reimbursementStatus: 'REMBOURSE' })],
    totalLinked: 25,
    createdAt: '2026-01-10T09:00:00Z',
  },
]

const unlinkMutate = vi.fn()
const deleteMutate = vi.fn()

vi.mock('@/features/reimbursements/hooks', () => ({
  useReimbursements: () => ({ data: reimbursements, isLoading: false }),
  useUnlinkReimbursementExpense: () => ({ mutate: unlinkMutate }),
  useDeleteReimbursement: () => ({ mutate: deleteMutate, reset: vi.fn(), isPending: false, isError: false }),
}))

describe('ReimbursementsList', () => {
  it('lists existing reimbursements with their linked expenses', () => {
    render(<ReimbursementsList />)

    expect(screen.getByText('Note de frais janvier')).toBeInTheDocument()
    expect(screen.getByText('Repas client A')).toBeInTheDocument()
  })

  it('unlinking an expense calls the unlink mutation', () => {
    render(<ReimbursementsList />)

    // The unlink (X) button sits next to the expense row.
    const unlinkButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-x'))
    fireEvent.click(unlinkButtons[0])

    expect(unlinkMutate).toHaveBeenCalledWith({ id: 1, txId: 1 })
  })

  it('deleting a reimbursement calls the delete mutation after confirming', async () => {
    render(<ReimbursementsList />)

    const deleteButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-trash2'))
    fireEvent.click(deleteButtons[0])
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }))

    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(1, expect.anything()))
  })
})
