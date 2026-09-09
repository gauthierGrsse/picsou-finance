import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    dayOfMonth: 10, daysInMonth: 31, historyMonths: 3, currentMonthCumulative: 100,
    historicalCumulativeAverage: 100, percentDifference: 0,
    currentCumulativeByDay: Array.from({ length: 10 }, (_, i) => i * 10),
    historicalCumulativeByDay: Array.from({ length: 31 }, (_, i) => i * 10),
    categorySeries: [],
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

  it('renders the chart once data is available', () => {
    useExpensePaceMock.mockReturnValue({ data: pace({}), isLoading: false })
    const { container } = render(<ExpensePaceCard />)

    expect(screen.getByText('expenseDashboard.paceTitle')).toBeInTheDocument()
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('shows a plus-prefixed badge when spending more than usual', () => {
    useExpensePaceMock.mockReturnValue({ data: pace({ percentDifference: 11.1 }), isLoading: false })
    render(<ExpensePaceCard />)

    const badge = screen.getByText(/expenseDashboard\.paceVsUsual/)
    expect(badge.textContent).toContain('+')
    expect(badge.textContent).toContain('11')
  })

  it('shows a minus-prefixed badge when spending less than usual', () => {
    useExpensePaceMock.mockReturnValue({ data: pace({ percentDifference: -11.1 }), isLoading: false })
    render(<ExpensePaceCard />)

    const badge = screen.getByText(/expenseDashboard\.paceVsUsual/)
    expect(badge.textContent).toContain('-')
    expect(badge.textContent).toContain('11')
  })

  it('shows the no-history message instead of a badge when there is nothing to compare to', () => {
    useExpensePaceMock.mockReturnValue({ data: pace({ percentDifference: null }), isLoading: false })
    render(<ExpensePaceCard />)

    expect(screen.getByText('expenseDashboard.paceNoHistory')).toBeInTheDocument()
    expect(screen.queryByText(/expenseDashboard.paceVsUsual/)).not.toBeInTheDocument()
  })

  it('lists a category chip per series, uncategorized included, and highlights the hovered one', () => {
    useExpensePaceMock.mockReturnValue({
      data: pace({
        categorySeries: [
          { categoryId: 1, categoryName: 'Restauration', categoryColor: '#f97316', currentCumulativeByDay: [20], historicalCumulativeByDay: Array(31).fill(50) },
          { categoryId: null, categoryName: null, categoryColor: null, currentCumulativeByDay: [5], historicalCumulativeByDay: Array(31).fill(15) },
        ],
      }),
      isLoading: false,
    })
    render(<ExpensePaceCard />)

    const restoChip = screen.getByText('Restauration').closest('button')
    expect(restoChip).not.toBeNull()
    expect(screen.getByText('expenseDashboard.uncategorized')).toBeInTheDocument()

    expect(restoChip).toHaveClass('border-transparent')
    fireEvent.mouseEnter(restoChip!)
    expect(restoChip).toHaveClass('border-foreground/30')
    fireEvent.mouseLeave(restoChip!)
    expect(restoChip).toHaveClass('border-transparent')
  })

  it('does not render a category legend when there are no category series', () => {
    useExpensePaceMock.mockReturnValue({ data: pace({ categorySeries: [] }), isLoading: false })
    render(<ExpensePaceCard />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
