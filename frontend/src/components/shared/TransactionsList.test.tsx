import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionsList } from './TransactionsList'
import type { ExpenseCategory, Transaction } from '@/types/api'

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

const restauration: ExpenseCategory = { id: 1, name: 'Restauration', color: '#f97316' }

const transactions: Transaction[] = [
  tx({ id: 1, description: 'Vers Compte Titre', amount: -50, proStatus: 'VIREMENT_INTERNE' }),
  tx({ id: 2, description: 'Boulangerie', amount: -8, proStatus: 'PERSO', expenseCategoryId: 1 }),
  tx({ id: 3, description: 'Facture non triée', amount: -20, proStatus: 'NON_CLASSE' }),
]

describe('TransactionsList filters', () => {
  it('hides internal transfers when the toggle is on', () => {
    render(<TransactionsList transactions={transactions} categories={[restauration]} />)

    expect(screen.getByText('Vers Compte Titre')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('accounts.filterHideInternal'))

    expect(screen.queryByText('Vers Compte Titre')).not.toBeInTheDocument()
    expect(screen.getByText('Boulangerie')).toBeInTheDocument()
  })

  it('filters to a single pro status', () => {
    render(<TransactionsList transactions={transactions} categories={[restauration]} />)

    fireEvent.change(screen.getByDisplayValue('accounts.filterAllStatuses'), { target: { value: 'NON_CLASSE' } })

    expect(screen.getByText('Facture non triée')).toBeInTheDocument()
    expect(screen.queryByText('Boulangerie')).not.toBeInTheDocument()
    expect(screen.queryByText('Vers Compte Titre')).not.toBeInTheDocument()
  })

  it('filters to uncategorized transactions', () => {
    render(<TransactionsList transactions={transactions} categories={[restauration]} />)

    fireEvent.change(screen.getByDisplayValue('accounts.filterAllCategories'), { target: { value: 'uncategorized' } })

    expect(screen.getByText('Facture non triée')).toBeInTheDocument()
    expect(screen.getByText('Vers Compte Titre')).toBeInTheDocument()
    expect(screen.queryByText('Boulangerie')).not.toBeInTheDocument()
  })

  it('shows a no-results message when filters exclude everything', () => {
    render(<TransactionsList transactions={transactions} categories={[restauration]} />)

    fireEvent.change(screen.getByDisplayValue('accounts.filterAllCategories'), { target: { value: '1' } })
    fireEvent.change(screen.getByDisplayValue('accounts.filterAllStatuses'), { target: { value: 'PRO_ABSORBE' } })

    expect(screen.getByText('common.noResults')).toBeInTheDocument()
  })
})
