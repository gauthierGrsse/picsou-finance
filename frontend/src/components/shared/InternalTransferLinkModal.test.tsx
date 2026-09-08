import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InternalTransferLinkModal } from './InternalTransferLinkModal'
import type { Account, Transaction } from '@/types/api'

// jsdom lacks matchMedia, which DateInput probes for the touch/native date picker.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  })
})

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

function account(overrides: Partial<Account>): Account {
  return {
    id: 1, name: 'Account', type: 'CHECKING', provider: null, currency: 'EUR',
    currentBalance: 0, currentBalanceEur: 0, cashBalance: null, lastSyncedAt: null,
    isManual: false, color: '#000000', ticker: null, logoUrl: null, logoKey: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const accounts: Account[] = [
  account({ id: 1, name: 'Compte Courant', isManual: false }), // source's own account, excluded either way
  account({ id: 7, name: 'Cash', isManual: true }),
  account({ id: 8, name: 'Autre synchro', isManual: false }), // manual=false, must not be offered
]

const confirmMutateAsync = vi.fn().mockResolvedValue(undefined)
const markWithoutMatchMutateAsync = vi.fn().mockResolvedValue(undefined)
const linkToManualAccountMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('@/features/internalTransfers/hooks', () => ({
  useTransferCandidates: () => ({ data: candidates }),
  useConfirmTransferLink: () => ({ mutateAsync: confirmMutateAsync, isPending: false }),
  useMarkTransferWithoutMatch: () => ({ mutateAsync: markWithoutMatchMutateAsync, isPending: false }),
  useLinkTransferToManualAccount: () => ({ mutateAsync: linkToManualAccountMutateAsync, isPending: false }),
}))

const useAccountsMock = vi.fn(() => ({ data: accounts }))

vi.mock('@/features/accounts/hooks', () => ({
  useAccounts: () => useAccountsMock(),
}))

describe('InternalTransferLinkModal', () => {
  beforeEach(() => {
    confirmMutateAsync.mockClear()
    markWithoutMatchMutateAsync.mockClear()
    linkToManualAccountMutateAsync.mockClear()
    useAccountsMock.mockReturnValue({ data: accounts })
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

  it('marks the transaction as an internal transfer without a match, without requiring a selection', async () => {
    const onOpenChange = vi.fn()
    render(<InternalTransferLinkModal transaction={source} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'internalTransfers.markWithoutMatch' }))

    await waitFor(() => expect(markWithoutMatchMutateAsync).toHaveBeenCalledOnce())
    expect(markWithoutMatchMutateAsync).toHaveBeenCalledWith(1)
    expect(confirmMutateAsync).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('offers to create the transaction on a manual account, excluding non-manual ones and the source\'s own account', () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    fireEvent.click(screen.getByText('internalTransfers.manualCreateOpen'))

    const accountSelect = screen.getByDisplayValue('Cash')
    expect(accountSelect).toBeInTheDocument()
    expect(screen.queryByText('Compte Courant', { selector: 'option' })).not.toBeInTheDocument()
    expect(screen.queryByText('Autre synchro', { selector: 'option' })).not.toBeInTheDocument()
  })

  it('pre-fills the manual-create form from the source transaction', () => {
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    fireEvent.click(screen.getByText('internalTransfers.manualCreateOpen'))

    expect(screen.getByDisplayValue('Vers Compte Titre')).toBeInTheDocument()
    // Amount is fixed (opposite of the source's -500), not user-editable, shown as a hint.
    expect(screen.getByText(/manualCreateAmountHint/)).toBeInTheDocument()
  })

  it('creates and links a transaction on the chosen manual account', async () => {
    const onOpenChange = vi.fn()
    render(<InternalTransferLinkModal transaction={source} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByText('internalTransfers.manualCreateOpen'))
    fireEvent.change(screen.getByDisplayValue('Vers Compte Titre'), { target: { value: 'Vers mon cash' } })
    fireEvent.click(screen.getByRole('button', { name: 'internalTransfers.manualCreateSubmit' }))

    await waitFor(() => expect(linkToManualAccountMutateAsync).toHaveBeenCalledOnce())
    expect(linkToManualAccountMutateAsync).toHaveBeenCalledWith({
      transactionId: 1,
      data: { targetAccountId: 7, description: 'Vers mon cash', date: '2026-01-05' },
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not offer to create on a manual account when the member has none', () => {
    useAccountsMock.mockReturnValue({ data: [account({ id: 1, name: 'Compte Courant', isManual: false })] })
    render(<InternalTransferLinkModal transaction={source} onOpenChange={vi.fn()} />)

    expect(screen.queryByText('internalTransfers.manualCreateOpen')).not.toBeInTheDocument()
  })
})
