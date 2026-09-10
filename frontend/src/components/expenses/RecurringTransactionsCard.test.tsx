import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecurringTransactionsCard } from './RecurringTransactionsCard'
import type { RecurringTransaction } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

const useRecurringMock = vi.fn()
vi.mock('@/features/expenseDashboard/hooks', () => ({
  useRecurringTransactions: () => useRecurringMock(),
}))

function recurring(overrides: Partial<RecurringTransaction>): RecurringTransaction {
  return {
    label: 'Netflix', typicalAmount: 13.49, typicalDayOfMonth: 5,
    expenseCategoryId: 1, categoryName: 'Loisirs', categoryColor: '#ec4899',
    lastSeen: '2026-08-05', monthsSeen: 4, previousAmount: null,
    dueThisMonth: true, expectedDate: '2026-09-05',
    ...overrides,
  }
}

describe('RecurringTransactionsCard', () => {
  beforeEach(() => useRecurringMock.mockReset())

  it('renders nothing when there are no recurring charges', () => {
    useRecurringMock.mockReturnValue({ data: [], isLoading: false })
    const { container } = render(<RecurringTransactionsCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists each recurring charge with a monthly total', () => {
    useRecurringMock.mockReturnValue({
      data: [
        recurring({ label: 'Loyer EFI', typicalAmount: 865, dueThisMonth: true }),
        recurring({ label: 'Netflix', typicalAmount: 13.49, dueThisMonth: true }),
      ],
      isLoading: false,
    })
    render(<RecurringTransactionsCard />)

    expect(screen.getByText('Loyer EFI')).toBeInTheDocument()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    // total = 878.49 -> formatted somewhere in the header
    expect(screen.getByText('€878.49')).toBeInTheDocument()
  })

  it('shows a price-change badge when the latest amount differs from before', () => {
    useRecurringMock.mockReturnValue({
      data: [recurring({ label: 'Loyer EFI', typicalAmount: 865.01, previousAmount: 852.92 })],
      isLoading: false,
    })
    render(<RecurringTransactionsCard />)

    expect(screen.getByText('€852.92')).toBeInTheDocument()
  })

  it('shows an "upcoming" tag for a charge not yet seen this month', () => {
    useRecurringMock.mockReturnValue({
      data: [recurring({ label: 'Assurance', dueThisMonth: false, typicalDayOfMonth: 18 })],
      isLoading: false,
    })
    render(<RecurringTransactionsCard />)

    expect(screen.getByText(/recurring\.upcoming/)).toBeInTheDocument()
  })
})
