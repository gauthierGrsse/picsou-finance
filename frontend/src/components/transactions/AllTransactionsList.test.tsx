import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AllTransactionsList } from './AllTransactionsList'
import type { ExpenseCategory, Transaction } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

const quickClassifyMutate = vi.fn()
vi.mock('@/features/transactions/hooks', () => ({
  useQuickClassifyTransaction: () => ({ mutate: quickClassifyMutate }),
}))

vi.mock('@/features/internalTransfers/hooks', () => ({
  useUnlinkTransfer: () => ({ mutate: vi.fn() }),
  useTransferCandidates: () => ({ data: [] }),
  useConfirmTransferLink: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkTransferWithoutMatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1, date: '2026-01-05', description: 'tx', amount: -10, type: null, category: null,
    nativeCurrency: 'EUR', isManual: false, txType: null, ticker: null, name: null, quantity: null,
    pricePerUnit: null, fees: null, proStatus: 'NON_CLASSE', expenseCategoryId: null,
    reimbursementStatus: null, reimbursementId: null,
    ...overrides,
  }
}

describe('AllTransactionsList', () => {
  beforeEach(() => {
    quickClassifyMutate.mockClear()
  })

  it('shows a no-results message when there are no transactions', () => {
    render(<AllTransactionsList transactions={[]} categories={[]} />)
    expect(screen.getByText('common.noResults')).toBeInTheDocument()
  })

  it('shows each transaction with its account name', () => {
    const transactions: Transaction[] = [
      tx({ id: 1, description: 'Loyer', accountId: 1, accountName: 'Compte Courant' }),
      tx({ id: 2, description: 'Livret A intérêts', accountId: 2, accountName: 'Livret A' }),
    ]

    render(<AllTransactionsList transactions={transactions} categories={[]} />)

    expect(screen.getByText('Loyer')).toBeInTheDocument()
    expect(screen.getByText('Compte Courant')).toBeInTheDocument()
    expect(screen.getByText('Livret A intérêts')).toBeInTheDocument()
    expect(screen.getByText('Livret A')).toBeInTheDocument()
  })

  it('groups transactions on the same date under one heading', () => {
    const transactions: Transaction[] = [
      tx({ id: 1, date: '2026-01-05', description: 'A', accountName: 'Compte' }),
      tx({ id: 2, date: '2026-01-05', description: 'B', accountName: 'Compte' }),
    ]

    render(<AllTransactionsList transactions={transactions} categories={[]} />)

    expect(screen.getAllByText('Compte')).toHaveLength(2)
  })

  it('right-clicking a row and picking a category quick-classifies it with the row\'s own account', () => {
    const categories: ExpenseCategory[] = [{ id: 1, name: 'Restauration', color: '#f97316' }]
    const transactions: Transaction[] = [
      tx({ id: 42, description: 'Loyer', accountId: 7, accountName: 'Compte Courant' }),
    ]

    render(<AllTransactionsList transactions={transactions} categories={categories} />)

    fireEvent.contextMenu(screen.getByText('Loyer'))
    fireEvent.click(screen.getByText('classification.categoryLabel'))
    fireEvent.click(screen.getByText('Restauration'))

    expect(quickClassifyMutate).toHaveBeenCalledWith({
      accountId: 7,
      txId: 42,
      data: { proStatus: 'NON_CLASSE', expenseCategoryId: 1 },
    })
  })

  it('shift-clicking a range then right-clicking bulk-classifies every selected row, keeping each one\'s own category', () => {
    const categories: ExpenseCategory[] = [{ id: 1, name: 'Restauration', color: '#f97316' }]
    const transactions: Transaction[] = [
      tx({ id: 1, date: '2026-01-05', description: 'A', accountId: 1, accountName: 'Compte', expenseCategoryId: 1 }),
      tx({ id: 2, date: '2026-01-04', description: 'B', accountId: 2, accountName: 'Livret', expenseCategoryId: null }),
      tx({ id: 3, date: '2026-01-03', description: 'C', accountId: 1, accountName: 'Compte', expenseCategoryId: 1 }),
    ]

    render(<AllTransactionsList transactions={transactions} categories={categories} />)

    fireEvent.click(screen.getByText('A'))
    fireEvent.click(screen.getByText('C'), { shiftKey: true })

    expect(screen.getByText('classification.selectedCount')).toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('B'))
    fireEvent.click(screen.getByText('classification.statusLabel'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'proStatus.perso' }))

    expect(quickClassifyMutate).toHaveBeenCalledWith({ accountId: 1, txId: 1, data: { proStatus: 'PERSO', expenseCategoryId: 1 } })
    expect(quickClassifyMutate).toHaveBeenCalledWith({ accountId: 2, txId: 2, data: { proStatus: 'PERSO', expenseCategoryId: null } })
    expect(quickClassifyMutate).toHaveBeenCalledWith({ accountId: 1, txId: 3, data: { proStatus: 'PERSO', expenseCategoryId: 1 } })
    expect(quickClassifyMutate).toHaveBeenCalledTimes(3)
  })

  it('ctrl/cmd-clicking toggles a single row in and out of the selection without clearing the rest', () => {
    const transactions: Transaction[] = [
      tx({ id: 1, description: 'A', accountId: 1, accountName: 'Compte' }),
      tx({ id: 2, description: 'B', accountId: 1, accountName: 'Compte' }),
    ]

    render(<AllTransactionsList transactions={transactions} categories={[]} />)

    fireEvent.click(screen.getByText('A'))
    fireEvent.click(screen.getByText('B'), { ctrlKey: true })

    expect(screen.getByText('classification.selectedCount')).toBeInTheDocument()

    fireEvent.click(screen.getByText('B'), { ctrlKey: true })

    expect(screen.queryByText('classification.selectedCount')).not.toBeInTheDocument()
  })

  it('never selects an internal-transfer row, even inside a shift-click range', () => {
    const transactions: Transaction[] = [
      tx({ id: 1, date: '2026-01-05', description: 'A', accountId: 1, accountName: 'Compte' }),
      tx({ id: 2, date: '2026-01-04', description: 'Virement', accountId: 1, accountName: 'Compte', proStatus: 'VIREMENT_INTERNE' }),
      tx({ id: 3, date: '2026-01-03', description: 'C', accountId: 1, accountName: 'Compte' }),
    ]

    render(<AllTransactionsList transactions={transactions} categories={[]} />)

    fireEvent.click(screen.getByText('A'))
    fireEvent.click(screen.getByText('C'), { shiftKey: true })

    fireEvent.contextMenu(screen.getByText('A'))
    expect(screen.getAllByText('classification.selectedCount').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('classification.statusLabel'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'proStatus.perso' }))

    expect(quickClassifyMutate).not.toHaveBeenCalledWith(expect.objectContaining({ txId: 2 }))
  })

  it('right-clicking a row and picking "link as internal transfer" opens the link modal for it', () => {
    const transactions: Transaction[] = [
      tx({ id: 42, description: 'Vers Compte Titre', accountId: 7, accountName: 'Compte Courant' }),
    ]

    render(<AllTransactionsList transactions={transactions} categories={[]} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('Vers Compte Titre'))
    fireEvent.click(screen.getByText('internalTransfers.linkTitle'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByText('Vers Compte Titre').length).toBeGreaterThan(0)
  })
})
