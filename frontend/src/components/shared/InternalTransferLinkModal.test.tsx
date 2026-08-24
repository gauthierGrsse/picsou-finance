import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InternalTransferLinkModal } from './InternalTransferLinkModal'
import type { Transaction } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => (typeof opts === 'string' ? opts : key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1, date: '2026-01-05', description: 'tx', amount: 0, type: null, category: null,
    nativeCurrency: 'EUR', isManual: false, txType: null, ticker: null, name: null, quantity: null,
    pricePerUnit: null, fees: null, proStatus: 'NON_CLASSE', expenseCategoryId: null,
    reimbursementStatus: null, reimbursementId: null,
    ...overrides,
  }
}

const source = tx({ id: 1, description: 'Vers Compte Titre', amount: -500 })

const candidates: Transaction[] = [
  tx({ id: 2, description: 'Depuis Compte Courant', amount: 500 }),
  tx({ id: 3, description: 'Sans rapport', amount: -12 }),
  tx({ id: 4, description: 'Mauvais montant', amount: 300 }),
]

const confirmMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('@/features/internalTransfers/hooks', () => ({
  useTransferCandidates: () => ({ data: candidates }),
  useConfirmTransferLink: () => ({ mutateAsync: confirmMutateAsync, isPending: false }),
}))

describe('InternalTransferLinkModal', () => {
  it('only offers candidates with the exact opposite amount', () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    expect(screen.getByText(/Depuis Compte Courant/)).toBeInTheDocument()
    expect(screen.queryByText(/Sans rapport/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mauvais montant/)).not.toBeInTheDocument()
  })

  it('links the source transaction to the selected counterpart', async () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByDisplayValue('internalTransfers.counterpartPlaceholder'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'internalTransfers.confirm' }))

    await waitFor(() => expect(confirmMutateAsync).toHaveBeenCalledOnce())
    expect(confirmMutateAsync).toHaveBeenCalledWith({ transactionIdA: 1, transactionIdB: 2 })
  })
})
