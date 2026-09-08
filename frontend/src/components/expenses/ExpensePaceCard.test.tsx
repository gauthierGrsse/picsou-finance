import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExpensePaceCard } from './ExpensePaceCard'
import type { ExpensePaceResponse } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

const useExpensePaceMock = vi.fn()
vi.mock('@/features/expenseDashboard/hooks', () => ({
  useExpensePace: () => useExpensePaceMock(),
}))

function pace(overrides: Partial<ExpensePaceResponse>): ExpensePaceResponse {
  return {
    dayOfMonth: 10, historyMonths: 3, currentMonthCumulative: 100,
    historicalCumulativeAverage: 100, percentDifference: 0, categoryPace: [],
    ...overrides,
  }
}

describe('ExpensePaceCard', () => {
  beforeEach(() => {
    useExpensePaceMock.mockReset()
  })

  it('renders nothing while there is no data and not loading', () => {
    useExpensePaceMock.mockReturnValue({ data: undefined, isLoading: false })
    const { container } = render(<ExpensePaceCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a skeleton while loading', () => {
    useExpensePaceMock.mockReturnValue({ data: undefined, isLoading: true })
    render(<ExpensePaceCard />)
    expect(screen.queryByText('expenseDashboard.paceTitle')).not.toBeInTheDocument()
  })

  it('shows spending more than usual in the destructive direction', () => {
    useExpensePaceMock.mockReturnValue({ data: pace({ currentMonthCumulative: 111, historicalCumulativeAverage: 100, percentDifference: 11.1 }), isLoading: false })
    render(<ExpensePaceCard />)

    expect(screen.getByText(/expenseDashboard.paceMoreThanUsual/)).toBeInTheDocument()
    expect(screen.queryByText(/expenseDashboard.paceLessThanUsual/)).not.toBeInTheDocument()
  })

  it('shows spending less than usual', () => {
    useExpensePaceMock.mockReturnValue({ data: pace({ percentDifference: -11.1 }), isLoading: false })
    render(<ExpensePaceCard />)

    expect(screen.getByText(/expenseDashboard.paceLessThanUsual/)).toBeInTheDocument()
  })

  it('shows the no-history message instead of a percentage when there is nothing to compare to', () => {
    useExpensePaceMock.mockReturnValue({ data: pace({ percentDifference: null }), isLoading: false })
    render(<ExpensePaceCard />)

    expect(screen.getByText('expenseDashboard.paceNoHistory')).toBeInTheDocument()
    expect(screen.queryByText(/expenseDashboard.paceMoreThanUsual/)).not.toBeInTheDocument()
    expect(screen.queryByText(/expenseDashboard.paceLessThanUsual/)).not.toBeInTheDocument()
  })

  it('lists per-category pace, uncategorized included', () => {
    useExpensePaceMock.mockReturnValue({
      data: pace({
        categoryPace: [
          { categoryId: 1, categoryName: 'Restauration', categoryColor: '#f97316', currentMonthAmount: 20, historicalMonthlyAverage: 50 },
          { categoryId: null, categoryName: null, categoryColor: null, currentMonthAmount: 5, historicalMonthlyAverage: 15 },
        ],
      }),
      isLoading: false,
    })
    render(<ExpensePaceCard />)

    expect(screen.getByText('Restauration')).toBeInTheDocument()
    expect(screen.getByText('expenseDashboard.uncategorized')).toBeInTheDocument()
  })
})
