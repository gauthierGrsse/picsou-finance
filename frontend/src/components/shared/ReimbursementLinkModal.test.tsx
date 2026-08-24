import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReimbursementLinkModal } from './ReimbursementLinkModal'
import type { PendingReimbursements, Transaction } from '@/types/api'

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

const candidates: Transaction[] = [
  tx({ id: 50, description: 'Note de frais janvier', amount: 75 }),
]
const pending: PendingReimbursements = {
  expenses: [
    tx({ id: 1, description: 'Repas client A', amount: -25, proStatus: 'PRO_A_REMBOURSER', reimbursementStatus: 'EN_ATTENTE' }),
    tx({ id: 2, description: 'Repas client B', amount: -40, proStatus: 'PRO_A_REMBOURSER', reimbursementStatus: 'EN_ATTENTE' }),
  ],
  totalOwed: 65,
}

const createMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('@/features/reimbursements/hooks', () => ({
  useCandidateCredits: () => ({ data: candidates }),
  usePendingReimbursements: () => ({ data: pending }),
  useCreateReimbursement: () => ({ mutateAsync: createMutateAsync, isPending: false }),
}))

describe('ReimbursementLinkModal', () => {
  it('links a credit to the selected pending expenses', async () => {
    render(<ReimbursementLinkModal open onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByDisplayValue('reimbursements.creditPlaceholder'), { target: { value: '50' } })
    fireEvent.click(screen.getByText('Repas client A'))
    fireEvent.click(screen.getByRole('button', { name: 'reimbursements.link' }))

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledOnce())
    expect(createMutateAsync).toHaveBeenCalledWith({ creditTransactionId: 50, expenseTransactionIds: [1] })
  })

  it('shows the running total of selected expenses', () => {
    render(<ReimbursementLinkModal open onOpenChange={vi.fn()} />)

    fireEvent.click(screen.getByText('Repas client A'))
    fireEvent.click(screen.getByText('Repas client B'))

    expect(screen.getByText(/reimbursements\.selectedTotal/)).toBeInTheDocument()
  })
})
