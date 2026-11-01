import '@testing-library/jest-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TransactionsList } from './TransactionsList'
import type { Category, Transaction } from '@/types/api'

// jsdom lacks matchMedia, which useIsMobile (TransactionDetailSheet) probes.
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
    t: (key: string) =>
      ({
        'accounts.buy': 'Achat',
        'accounts.sell': 'Vente',
        'accounts.dividend': 'Dividende',
        'accounts.fee': 'Frais',
      })[key] ?? key,
    i18n: { language: 'fr', resolvedLanguage: 'fr' },
  }),
}))

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    date: '2026-03-04',
    description: 'Transaction',
    amount: 10,
    type: null,
    category: null,
    nativeCurrency: 'EUR',
    isManual: false,
    txType: null,
    ticker: null,
    name: null,
    quantity: null,
    pricePerUnit: null,
    fees: null,
    proStatus: 'NON_CLASSE',
    categoryId: null,
    reimbursementStatus: null,
    reimbursementId: null,
    ...overrides,
  }
}

describe('TransactionsList', () => {
  it('keeps the header actions reachable on an empty account, and renders nothing without them', () => {
    const { container, rerender } = render(<TransactionsList transactions={[]} />)
    expect(container).toBeEmptyDOMElement()

    rerender(<TransactionsList transactions={[]} actions={<button>Add</button>} />)
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.getByText('accounts.transactions')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('common.search')).not.toBeInTheDocument()
  })

  it('keeps single-year date headings compact', () => {
    render(<TransactionsList transactions={[transaction({ description: 'Single year' })]} />)

    expect(screen.getByText('Single year')).toBeInTheDocument()
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument()
  })

  it('includes the year in every heading when the list spans multiple years', () => {
    render(
      <TransactionsList
        transactions={[
          transaction({ description: 'Recent transaction' }),
          transaction({ id: 2, date: '2025-03-04', description: 'Older transaction' }),
        ]}
      />,
    )

    expect(screen.getByText(/2026/)).toBeInTheDocument()
    expect(screen.getByText(/2025/)).toBeInTheDocument()
  })

  it.each([
    ['BUY', 'Achat'],
    ['SELL', 'Vente'],
    ['DIVIDEND', 'Dividende'],
    ['FEE', 'Frais'],
  ] satisfies [NonNullable<Transaction['txType']>, string][])(
    'renders the %s fallback through frontend i18n',
    (txType, label) => {
      render(
        <TransactionsList
          transactions={[
            transaction({
              isManual: true,
              txType,
              ticker: 'AAPL',
              description: 'AAPL',
            }),
          ]}
        />,
      )

      expect(screen.getByText(`${label} AAPL`)).toBeInTheDocument()
    },
  )

  it('keeps a provider description on synced transactions', () => {
    render(
      <TransactionsList
        transactions={[
          transaction({
            txType: 'DIVIDEND',
            ticker: 'AAPL',
            description: 'Provider dividend payment',
          }),
        ]}
      />,
    )

    expect(screen.getByText('Provider dividend payment')).toBeInTheDocument()
    expect(screen.queryByText('Dividende AAPL')).not.toBeInTheDocument()
  })

  it('searches the localized fallback description', () => {
    render(
      <TransactionsList
        transactions={[
          transaction({
            isManual: true,
            txType: 'DIVIDEND',
            ticker: 'AAPL',
            description: 'AAPL',
          }),
        ]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('common.search'), {
      target: { value: 'Dividende' },
    })

    expect(screen.getByText('Dividende AAPL')).toBeInTheDocument()
  })
})


const restauration: Category = { id: 1, name: 'Restauration', color: '#f97316', kind: 'EXPENSE', icon: null, isDefault: false, archived: false, sortOrder: 0, parentId: null }

function tx(overrides: Partial<Transaction>): Transaction {
  return transaction({ date: '2026-01-05', description: 'tx', amount: -10, ...overrides })
}

const transactions: Transaction[] = [
  tx({ id: 1, description: 'Vers Compte Titre', amount: -50, proStatus: 'VIREMENT_INTERNE' }),
  tx({ id: 2, description: 'Boulangerie', amount: -8, proStatus: 'PERSO', categoryId: 1 }),
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

  it('treats a transaction with no categoryId key as uncategorized -- the API omits null fields rather than sending null, so it arrives as undefined, not null', () => {
    const fromApi = JSON.parse(JSON.stringify(tx({ id: 4, description: 'Depuis API', categoryId: undefined }))) as Transaction
    render(<TransactionsList transactions={[...transactions, fromApi]} categories={[restauration]} />)

    fireEvent.change(screen.getByDisplayValue('accounts.filterAllCategories'), { target: { value: 'uncategorized' } })

    expect(screen.getByText('Depuis API')).toBeInTheDocument()
  })

  it('shows a no-results message when filters exclude everything', () => {
    render(<TransactionsList transactions={transactions} categories={[restauration]} />)

    fireEvent.change(screen.getByDisplayValue('accounts.filterAllCategories'), { target: { value: '1' } })
    fireEvent.change(screen.getByDisplayValue('accounts.filterAllStatuses'), { target: { value: 'PRO_ABSORBE' } })

    expect(screen.getByText('common.noResults')).toBeInTheDocument()
  })
})

describe('TransactionsList quick classify', () => {
  it('right-clicking a row and picking a status calls onQuickClassify for that transaction', () => {
    const onQuickClassify = vi.fn()
    render(
      <TransactionsList
        transactions={transactions}
        categories={[restauration]}
        onQuickClassify={onQuickClassify}
      />,
    )

    fireEvent.contextMenu(screen.getByText('Facture non triée'))
    fireEvent.click(screen.getByText('classification.statusLabel'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'proStatus.perso' }))

    expect(onQuickClassify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, description: 'Facture non triée' }),
      { proStatus: 'PERSO', categoryId: null },
    )
  })

  it('does not offer a context menu when onQuickClassify is not provided', () => {
    render(<TransactionsList transactions={transactions} categories={[restauration]} />)

    fireEvent.contextMenu(screen.getByText('Facture non triée'))

    expect(screen.queryByText('classification.statusLabel')).not.toBeInTheDocument()
  })
})
