import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InternalTransferLinkModal } from './InternalTransferLinkModal'
import type { Transaction } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1, date: '2026-01-05', description: 'tx', amount: 0, type: null, category: null,
    nativeCurrency: 'EUR', isManual: false, txType: null, ticker: null, name: null, quantity: null,
    pricePerUnit: null, fees: null, proStatus: 'NON_CLASSE', expenseCategoryId: null,
    reimbursementStatus: null, reimbursementId: null, accountId: 1, accountName: 'Compte Courant',
    ...overrides,
  }
}

const source = tx({ id: 1, description: 'Vers Compte Titre', amount: -500, accountId: 1, accountName: 'Compte Courant' })

const candidates: Transaction[] = [
  tx({ id: 2, description: 'Depuis Compte Courant', amount: 500, accountId: 2, accountName: 'Compte Titre' }),
  tx({ id: 3, description: 'Sans rapport', amount: -12, accountId: 2, accountName: 'Compte Titre' }),
  tx({ id: 4, description: 'Frais de virement', amount: 480, accountId: 2, accountName: 'Compte Titre' }),
  tx({ id: 5, description: 'Meme compte', amount: 500, accountId: 1, accountName: 'Compte Courant' }),
  tx({ id: 6, description: 'Autre compte', amount: 500, accountId: 3, accountName: 'Livret A' }),
]

const confirmMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('@/features/internalTransfers/hooks', () => ({
  useTransferCandidates: () => ({ data: candidates }),
  useConfirmTransferLink: () => ({ mutateAsync: confirmMutateAsync, isPending: false }),
}))

describe('InternalTransferLinkModal', () => {
  beforeEach(() => {
    confirmMutateAsync.mockClear()
  })

  it('excludes the source transaction\'s own account and puts the exact match first', () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    expect(screen.queryByText('Meme compte')).not.toBeInTheDocument()
    expect(screen.getByText('Depuis Compte Courant')).toBeInTheDocument()
    expect(screen.getByText('Sans rapport')).toBeInTheDocument()
    expect(screen.getByText('Frais de virement')).toBeInTheDocument()
    expect(screen.getByText('Autre compte')).toBeInTheDocument()
  })

  it('flags non-exact-amount candidates with a mismatch indicator', () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    const exactRow = screen.getByText('Depuis Compte Courant').closest('button')
    const mismatchRow = screen.getByText('Frais de virement').closest('button')
    expect(exactRow?.textContent).not.toContain('internalTransfers.amountMismatch')
    expect(mismatchRow?.textContent).toContain('internalTransfers.amountMismatch')
  })

  it('filters candidates by search text', () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('common.search'), { target: { value: 'frais' } })

    expect(screen.getByText('Frais de virement')).toBeInTheDocument()
    expect(screen.queryByText('Depuis Compte Courant')).not.toBeInTheDocument()
  })

  it('filters candidates by account', () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByDisplayValue('internalTransfers.allAccounts'), { target: { value: '3' } })

    expect(screen.getByText('Autre compte')).toBeInTheDocument()
    expect(screen.queryByText('Depuis Compte Courant')).not.toBeInTheDocument()
  })

  it('links directly when the selected candidate has the exact opposite amount', async () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    fireEvent.click(screen.getByText('Depuis Compte Courant'))
    fireEvent.click(screen.getByRole('button', { name: 'internalTransfers.confirm' }))

    await waitFor(() => expect(confirmMutateAsync).toHaveBeenCalledOnce())
    expect(confirmMutateAsync).toHaveBeenCalledWith({ transactionIdA: 1, transactionIdB: 2, allowAmountMismatch: false })
  })

  it('warns before linking a mismatched-amount candidate, and only submits after confirming', async () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    fireEvent.click(screen.getByText('Frais de virement'))
    fireEvent.click(screen.getByRole('button', { name: 'internalTransfers.confirm' }))

    expect(confirmMutateAsync).not.toHaveBeenCalled()
    expect(screen.getByText('internalTransfers.mismatchWarningTitle')).toBeInTheDocument()

    // Both the form's own submit button and the warning dialog's confirm button share the
    // same label -- the warning dialog's is the one rendered last (mounted on top).
    const confirmButtons = screen.getAllByRole('button', { name: 'internalTransfers.confirm' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(confirmMutateAsync).toHaveBeenCalledOnce())
    expect(confirmMutateAsync).toHaveBeenCalledWith({ transactionIdA: 1, transactionIdB: 4, allowAmountMismatch: true })
  })
})
