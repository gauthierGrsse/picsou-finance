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

const transactions: Transaction[] = [
  {
    id: 1, date: '2026-08-05', description: 'Loyer', amount: -850, type: null, category: null,
    nativeCurrency: 'EUR', isManual: false, txType: null, ticker: null, name: null, quantity: null,
    pricePerUnit: null, fees: null, proStatus: 'PERSO', expenseCategoryId: 1,
    reimbursementStatus: null, reimbursementId: null, accountId: 1, accountName: 'Compte Courant',
  },
  {
    id: 2, date: '2026-08-06', description: 'Virement interne', amount: -50, type: null, category: null,
    nativeCurrency: 'EUR', isManual: false, txType: null, ticker: null, name: null, quantity: null,
    pricePerUnit: null, fees: null, proStatus: 'VIREMENT_INTERNE', expenseCategoryId: null,
    reimbursementStatus: null, reimbursementId: null, accountId: 1, accountName: 'Compte Courant',
  },
]

const categories: ExpenseCategory[] = [{ id: 1, name: 'Logement', color: '#3b82f6' }]

const useAllTransactions = vi.fn<(periodStart: string, periodEnd: string) => { data: Transaction[]; isLoading: boolean }>(
  () => ({ data: transactions, isLoading: false }),
)
vi.mock('@/features/transactions/hooks', () => ({
  useAllTransactions: (periodStart: string, periodEnd: string) => useAllTransactions(periodStart, periodEnd),
}))

vi.mock('@/features/expenseCategories/hooks', () => ({
  useExpenseCategories: () => ({ data: categories }),
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
  })

  it('preselects filters from URL search params, as a slice-click deep link would', () => {
    searchParams = new URLSearchParams({ status: 'PERSO', category: '1', mode: 'month', month: '2026-08' })
    render(<TransactionsPage />)

    expect(screen.getByText('Loyer')).toBeInTheDocument()
    expect(screen.queryByText('Virement interne')).not.toBeInTheDocument()
  })

  it('preselects a year period from URL search params', () => {
    searchParams = new URLSearchParams({ mode: 'year', year: '2025' })
    render(<TransactionsPage />)

    expect(useAllTransactions).toHaveBeenLastCalledWith('2025-01-01', '2025-12-31')
  })
})
