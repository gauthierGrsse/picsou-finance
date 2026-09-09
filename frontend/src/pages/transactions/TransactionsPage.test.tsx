import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransactionsPage } from './TransactionsPage'
import type { Transaction, ExpenseCategory } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

let searchParams = new URLSearchParams()
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [searchParams],
}))

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1, date: '2026-08-05', description: 'tx', amount: -10, type: null, category: null,
    nativeCurrency: 'EUR', isManual: false, txType: null, ticker: null, name: null, quantity: null,
    pricePerUnit: null, fees: null, proStatus: 'NON_CLASSE', expenseCategoryId: null,
    reimbursementStatus: null, reimbursementId: null, accountId: 1, accountName: 'Compte Courant',
    ...overrides,
  }
}

const transactions: Transaction[] = [
  tx({ id: 1, date: '2026-08-05', description: 'Loyer', amount: -850, proStatus: 'PERSO', expenseCategoryId: 1 }),
  tx({ id: 2, date: '2026-08-06', description: 'Virement interne', amount: -50, proStatus: 'VIREMENT_INTERNE', expenseCategoryId: null }),
  // Simulates what the API actually sends: null fields are omitted from the JSON entirely
  // (default-property-inclusion: non_null), so this key is genuinely absent, not null.
  JSON.parse(JSON.stringify(tx({ id: 3, date: '2026-08-07', description: 'Depuis API', amount: -20, expenseCategoryId: undefined }))) as Transaction,
]

const categories: ExpenseCategory[] = [{ id: 1, name: 'Logement', color: '#3b82f6', type: 'BOTH', parentId: null, monthlyBudget: null }]

const useAllTransactions = vi.fn<(periodStart: string, periodEnd: string) => { data: Transaction[]; isLoading: boolean }>(
  () => ({ data: transactions, isLoading: false }),
)
vi.mock('@/features/transactions/hooks', () => ({
  useAllTransactions: (periodStart: string, periodEnd: string) => useAllTransactions(periodStart, periodEnd),
  useQuickClassifyTransaction: () => ({ mutate: vi.fn() }),
}))

vi.mock('@/features/internalTransfers/hooks', () => ({
  useUnlinkTransfer: () => ({ mutate: vi.fn() }),
}))

vi.mock('@/features/expenseCategories/hooks', () => ({
  useExpenseCategories: () => ({ data: categories }),
}))

vi.mock('@/features/expenseDashboard/hooks', () => ({
  useExpensePace: () => ({ data: undefined, isLoading: false }),
}))

describe('TransactionsPage', () => {
  it('defaults to the current month and shows every transaction', () => {
    searchParams = new URLSearchParams()
    render(<TransactionsPage />)

    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(useAllTransactions).toHaveBeenLastCalledWith(`${month}-01`, expect.stringContaining(month))
    expect(screen.getByText('Loyer')).toBeInTheDocument()
    expect(screen.getByText('Virement interne')).toBeInTheDocument()
    expect(screen.getByText('Depuis API')).toBeInTheDocument()
  })

  it('preselects filters from URL search params, as a slice-click deep link would', () => {
    searchParams = new URLSearchParams({ status: 'PERSO', category: '1', mode: 'month', month: '2026-08' })
    render(<TransactionsPage />)

    expect(screen.getByText('Loyer')).toBeInTheDocument()
    expect(screen.queryByText('Virement interne')).not.toBeInTheDocument()
  })

  it('deep-links to the uncategorized filter and includes transactions the API sent with no expenseCategoryId key at all', () => {
    searchParams = new URLSearchParams({ category: 'uncategorized', mode: 'month', month: '2026-08' })
    render(<TransactionsPage />)

    expect(screen.getByText('Virement interne')).toBeInTheDocument()
    expect(screen.getByText('Depuis API')).toBeInTheDocument()
    expect(screen.queryByText('Loyer')).not.toBeInTheDocument()
  })

  it('preselects a year period from URL search params', () => {
    searchParams = new URLSearchParams({ mode: 'year', year: '2025' })
    render(<TransactionsPage />)

    expect(useAllTransactions).toHaveBeenLastCalledWith('2025-01-01', '2025-12-31')
  })
})
