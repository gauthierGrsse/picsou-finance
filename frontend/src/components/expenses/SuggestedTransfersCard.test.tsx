import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuggestedTransfersCard } from './SuggestedTransfersCard'
import type { SuggestedTransferPair, Transaction } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1, date: '2026-01-05', description: '', amount: 0, type: null, category: null,
    nativeCurrency: 'EUR', isManual: false, txType: null, ticker: null, name: null, quantity: null,
    pricePerUnit: null, fees: null, proStatus: 'NON_CLASSE', expenseCategoryId: null,
    reimbursementStatus: null, reimbursementId: null,
    ...overrides,
  }
}

const pair: SuggestedTransferPair = {
  a: tx({ id: 10, description: 'Vers Petite Monnaie', amount: -50 }),
  b: tx({ id: 11, description: 'Depuis Compte Courant', amount: 50 }),
}

const mutate = vi.fn()

vi.mock('@/features/internalTransfers/hooks', () => ({
  useSuggestedTransfers: () => ({ data: [pair], isLoading: false }),
  useConfirmTransferLink: () => ({ mutate, isPending: false }),
}))

describe('SuggestedTransfersCard', () => {
  it('shows both legs of a suggested pair', () => {
    render(<SuggestedTransfersCard />)

    expect(screen.getByText('Vers Petite Monnaie')).toBeInTheDocument()
    expect(screen.getByText('Depuis Compte Courant')).toBeInTheDocument()
  })

  it('confirms the link with both transaction ids', () => {
    render(<SuggestedTransfersCard />)

    fireEvent.click(screen.getByRole('button', { name: /internalTransfers\.confirm/ }))

    expect(mutate).toHaveBeenCalledWith({ transactionIdA: 10, transactionIdB: 11, allowAmountMismatch: false })
  })
})
