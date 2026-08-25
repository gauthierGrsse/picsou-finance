import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionContextMenu } from './TransactionContextMenu'
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

const categories: ExpenseCategory[] = [
  { id: 1, name: 'Restauration', color: '#f97316' },
  { id: 2, name: 'Courses', color: '#22c55e' },
]

describe('TransactionContextMenu', () => {
  it('picking a status calls onQuickClassify with that status and the existing category', () => {
    const onQuickClassify = vi.fn()
    const transaction = tx({ expenseCategoryId: 2 })

    render(
      <TransactionContextMenu transaction={transaction} categories={categories} onQuickClassify={onQuickClassify}>
        <div>Row</div>
      </TransactionContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Row'))
    fireEvent.click(screen.getByText('classification.statusLabel'))
    fireEvent.click(screen.getByText('proStatus.perso'))

    expect(onQuickClassify).toHaveBeenCalledWith({ proStatus: 'PERSO', expenseCategoryId: 2 })
  })

  it('picking "no category" clears the category while keeping the current status', () => {
    const onQuickClassify = vi.fn()
    const transaction = tx({ proStatus: 'PERSO', expenseCategoryId: 1 })

    render(
      <TransactionContextMenu transaction={transaction} categories={categories} onQuickClassify={onQuickClassify}>
        <div>Row</div>
      </TransactionContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Row'))
    fireEvent.click(screen.getByText('classification.categoryLabel'))
    fireEvent.click(screen.getByText('classification.noCategory'))

    expect(onQuickClassify).toHaveBeenCalledWith({ proStatus: 'PERSO', expenseCategoryId: null })
  })

  it('shows unlink instead of status/category submenus for an internal transfer', () => {
    const onUnlinkTransfer = vi.fn()
    const transaction = tx({ id: 9, proStatus: 'VIREMENT_INTERNE' })

    render(
      <TransactionContextMenu
        transaction={transaction}
        categories={categories}
        onQuickClassify={vi.fn()}
        onUnlinkTransfer={onUnlinkTransfer}
      >
        <div>Row</div>
      </TransactionContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Row'))

    expect(screen.queryByText('classification.statusLabel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('internalTransfers.unlink'))
    expect(onUnlinkTransfer).toHaveBeenCalledWith(9)
  })
})
