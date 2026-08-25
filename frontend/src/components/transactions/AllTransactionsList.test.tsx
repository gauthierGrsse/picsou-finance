import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AllTransactionsList } from './AllTransactionsList'
import type { Transaction } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
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
})
