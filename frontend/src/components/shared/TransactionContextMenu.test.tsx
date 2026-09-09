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
  { id: 1, name: 'Restauration', color: '#f97316', type: 'BOTH', parentId: null },
  { id: 2, name: 'Courses', color: '#22c55e', type: 'BOTH', parentId: null },
]

describe('TransactionContextMenu', () => {
  it('picking a status calls onQuickClassify with only the status field', () => {
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

    expect(onQuickClassify).toHaveBeenCalledWith({ field: 'status', proStatus: 'PERSO' })
  })

  it('picking "no category" calls onQuickClassify with only the category field cleared', () => {
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

    expect(onQuickClassify).toHaveBeenCalledWith({ field: 'category', expenseCategoryId: null })
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

  it('shows a count label and no checkmarks when acting on a multi-row selection', () => {
    const onQuickClassify = vi.fn()
    const transaction = tx({ proStatus: 'PERSO', expenseCategoryId: 1 })

    render(
      <TransactionContextMenu transaction={transaction} categories={categories} onQuickClassify={onQuickClassify} selectionCount={3}>
        <div>Row</div>
      </TransactionContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Row'))

    expect(screen.getByText('classification.selectedCount')).toBeInTheDocument()

    fireEvent.click(screen.getByText('classification.statusLabel'))
    const persoItem = screen.getByText('proStatus.perso').closest('[role="menuitem"]')
    expect(persoItem?.querySelector('svg')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('proStatus.perso'))
    expect(onQuickClassify).toHaveBeenCalledWith({ field: 'status', proStatus: 'PERSO' })
  })

  it('offers "link as internal transfer" for a single non-transfer row and calls onLinkTransfer with it', () => {
    const onLinkTransfer = vi.fn()
    const transaction = tx({ id: 7 })

    render(
      <TransactionContextMenu transaction={transaction} categories={categories} onQuickClassify={vi.fn()} onLinkTransfer={onLinkTransfer}>
        <div>Row</div>
      </TransactionContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Row'))
    fireEvent.click(screen.getByText('internalTransfers.linkTitle'))

    expect(onLinkTransfer).toHaveBeenCalledWith(transaction)
  })

  it('filters the category list by the transaction\'s sign, BOTH always included', () => {
    const typedCategories: ExpenseCategory[] = [
      { id: 1, name: 'Restauration', color: '#f97316', type: 'EXPENSE', parentId: null },
      { id: 2, name: 'Salaire', color: '#22c55e', type: 'INCOME', parentId: null },
      { id: 3, name: 'Autre', color: '#a855f7', type: 'BOTH', parentId: null },
    ]

    const { unmount } = render(
      <TransactionContextMenu transaction={tx({ amount: -25 })} categories={typedCategories} onQuickClassify={vi.fn()}>
        <div>Row</div>
      </TransactionContextMenu>,
    )
    fireEvent.contextMenu(screen.getByText('Row'))
    fireEvent.click(screen.getByText('classification.categoryLabel'))
    expect(screen.getByText('Restauration')).toBeInTheDocument()
    expect(screen.getByText('Autre')).toBeInTheDocument()
    expect(screen.queryByText('Salaire')).not.toBeInTheDocument()
    unmount()

    render(
      <TransactionContextMenu transaction={tx({ amount: 2500 })} categories={typedCategories} onQuickClassify={vi.fn()}>
        <div>Row</div>
      </TransactionContextMenu>,
    )
    fireEvent.contextMenu(screen.getByText('Row'))
    fireEvent.click(screen.getByText('classification.categoryLabel'))
    expect(screen.getByText('Salaire')).toBeInTheDocument()
    expect(screen.getByText('Autre')).toBeInTheDocument()
    expect(screen.queryByText('Restauration')).not.toBeInTheDocument()
  })

  it('groups subcategories under their parent as a nested submenu, with the parent itself still selectable', () => {
    const onQuickClassify = vi.fn()
    const nestedCategories: ExpenseCategory[] = [
      { id: 1, name: 'Alimentation', color: '#f97316', type: 'BOTH', parentId: null },
      { id: 2, name: 'Bio', color: '#22c55e', type: 'BOTH', parentId: 1 },
    ]

    render(
      <TransactionContextMenu transaction={tx({})} categories={nestedCategories} onQuickClassify={onQuickClassify}>
        <div>Row</div>
      </TransactionContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Row'))
    fireEvent.click(screen.getByText('classification.categoryLabel'))
    expect(screen.queryByText('Bio')).not.toBeInTheDocument() // nested, not shown until its submenu opens

    fireEvent.click(screen.getByText('Alimentation'))
    expect(screen.getAllByText('Alimentation').length).toBeGreaterThan(0) // parent selectable inside its own submenu too
    fireEvent.click(screen.getByText('Bio'))

    expect(onQuickClassify).toHaveBeenCalledWith({ field: 'category', expenseCategoryId: 2 })
  })

  it('does not offer "link as internal transfer" when acting on a multi-row selection', () => {
    const onLinkTransfer = vi.fn()
    const transaction = tx({ id: 7 })

    render(
      <TransactionContextMenu
        transaction={transaction}
        categories={categories}
        onQuickClassify={vi.fn()}
        onLinkTransfer={onLinkTransfer}
        selectionCount={3}
      >
        <div>Row</div>
      </TransactionContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Row'))

    expect(screen.queryByText('internalTransfers.linkTitle')).not.toBeInTheDocument()
  })
})
