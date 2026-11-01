import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecurringTransactionsCard } from './RecurringTransactionsCard'
import type { RecurringSeries } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

const useRecurringMock = vi.fn()
vi.mock('@/features/budget/hooks', () => ({
  useRecurring: (status?: string) => useRecurringMock(status),
}))

function series(overrides: Partial<RecurringSeries>): RecurringSeries {
  return {
    id: 1, label: 'Netflix', counterparty: null, expectedAmount: -15, cadence: 'MONTHLY', status: 'CONFIRMED',
    nextDueDate: '2026-11-20', lastSeenDate: '2026-10-20', categoryId: null, categoryName: null,
    categoryColor: null, categoryIcon: null, confidence: 0.9, amountMin: null, amountMax: null,
    variable: false, previousAmount: null, priceChangedAt: null, autoConfirmed: false,
    runtimeStatus: 'ON_TRACK', ...overrides,
  } as RecurringSeries
}

describe('RecurringTransactionsCard', () => {
  beforeEach(() => useRecurringMock.mockReset())

  it('asks for confirmed series only -- suggestions are triaged in the budget module', () => {
    useRecurringMock.mockReturnValue({ data: [], isLoading: false })
    render(<RecurringTransactionsCard />)

    expect(useRecurringMock).toHaveBeenCalledWith('CONFIRMED')
  })

  it('renders nothing when there are no recurring charges', () => {
    useRecurringMock.mockReturnValue({ data: [], isLoading: false })
    const { container } = render(<RecurringTransactionsCard />)

    expect(container).toBeEmptyDOMElement()
  })

  it('ignores recurring income -- this is about what leaves the account', () => {
    useRecurringMock.mockReturnValue({ data: [series({ id: 2, label: 'Salaire', expectedAmount: 2000 })], isLoading: false })
    const { container } = render(<RecurringTransactionsCard />)

    expect(container).toBeEmptyDOMElement()
  })

  it('totals the monthly cost, converting each cadence to a month', () => {
    useRecurringMock.mockReturnValue({
      data: [
        series({ id: 1, label: 'Netflix', expectedAmount: -15 }),                                  // 15 / month
        series({ id: 2, label: 'Assurance auto', expectedAmount: -120, cadence: 'YEARLY' }),       // 10 / month
        series({ id: 3, label: 'Impôt', expectedAmount: -90, cadence: 'QUARTERLY' }),              // 30 / month
      ],
      isLoading: false,
    })
    render(<RecurringTransactionsCard />)

    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Assurance auto')).toBeInTheDocument()
    // header total: 15 + 10 + 30 = 55.00 (amount rendered without the currency symbol in the matcher)
    expect(screen.getAllByText(/55\.00/).length).toBeGreaterThan(0)
  })

  it('lists the dearest charge first', () => {
    useRecurringMock.mockReturnValue({
      data: [series({ id: 1, label: 'Petit', expectedAmount: -5 }), series({ id: 2, label: 'Gros', expectedAmount: -50 })],
      isLoading: false,
    })
    render(<RecurringTransactionsCard />)

    const labels = screen.getAllByText(/^(Petit|Gros)$/).map(el => el.textContent)
    expect(labels).toEqual(['Gros', 'Petit'])
  })

  it('flags a charge that went up, showing what it used to cost, and not one that went down', () => {
    useRecurringMock.mockReturnValue({
      data: [
        series({ id: 1, label: 'Hausse', expectedAmount: -20, previousAmount: -15 }),
        series({ id: 2, label: 'Baisse', expectedAmount: -10, previousAmount: -12 }),
      ],
      isLoading: false,
    })
    const { container } = render(<RecurringTransactionsCard />)

    expect(container.querySelectorAll('svg.lucide-arrow-up')).toHaveLength(1)
    expect(screen.getByText(/^.15\.00$/)).toBeInTheDocument()
  })
})
