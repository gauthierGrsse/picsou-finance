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

const useGoalsMock = vi.fn<() => { data: { id: number; name: string }[] }>(() => ({ data: [] }))
vi.mock('@/features/goals/hooks', () => ({
  useGoals: () => useGoalsMock(),
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
    useGoalsMock.mockReset()
    useGoalsMock.mockReturnValue({ data: [] })
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
          { categoryId: 1, categoryName: 'Restauration', categoryColor: '#f97316', monthlyBudget: null, currentCumulativeByDay: [20], historicalCumulativeByDay: Array(31).fill(50) },
          { categoryId: null, categoryName: null, categoryColor: null, monthlyBudget: null, currentCumulativeByDay: [5], historicalCumulativeByDay: Array(31).fill(15) },
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

  it('shows a budget percentage badge on a chip when the category has a budget, none otherwise', () => {
    useExpensePaceMock.mockReturnValue({
      data: pace({
        categorySeries: [
          { categoryId: 1, categoryName: 'Restauration', categoryColor: '#f97316', monthlyBudget: 100, currentCumulativeByDay: [90], historicalCumulativeByDay: Array(31).fill(50) },
          { categoryId: 2, categoryName: 'Loisirs', categoryColor: '#ec4899', monthlyBudget: null, currentCumulativeByDay: [30], historicalCumulativeByDay: Array(31).fill(20) },
        ],
      }),
      isLoading: false,
    })
    render(<ExpensePaceCard />)

    expect(screen.getByText('90%')).toBeInTheDocument()
    const loisirsChip = screen.getByText('Loisirs').closest('button')
    expect(loisirsChip?.textContent).not.toMatch(/%/)
  })

  it('colors the budget badge destructive once spending exceeds the budget', () => {
    useExpensePaceMock.mockReturnValue({
      data: pace({
        categorySeries: [
          { categoryId: 1, categoryName: 'Restauration', categoryColor: '#f97316', monthlyBudget: 100, currentCumulativeByDay: [150], historicalCumulativeByDay: Array(31).fill(50) },
        ],
      }),
      isLoading: false,
    })
    render(<ExpensePaceCard />)

    expect(screen.getByText('150%')).toHaveClass('text-destructive')
  })

  it('does not render a category legend when there are no category series', () => {
    useExpensePaceMock.mockReturnValue({ data: pace({ categorySeries: [] }), isLoading: false })
    render(<ExpensePaceCard />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows a daily allowance when still under the usual full-month total', () => {
    // historicalCumulativeByDay's last point (day 31) is the usual full-month total;
    // currentMonthCumulative is what's been spent so far -- comfortably under it here.
    useExpensePaceMock.mockReturnValue({
      data: pace({ currentMonthCumulative: 100, historicalCumulativeByDay: Array(31).fill(300), percentDifference: -50 }),
      isLoading: false,
    })
    render(<ExpensePaceCard />)

    expect(screen.getByText(/expenseDashboard\.paceAllowanceSuffix/)).toBeInTheDocument()
    expect(screen.queryByText(/expenseDashboard\.paceOverSuffix/)).not.toBeInTheDocument()
  })

  it('shows an over-pace message instead once the usual full-month total is exceeded', () => {
    useExpensePaceMock.mockReturnValue({
      data: pace({ currentMonthCumulative: 400, historicalCumulativeByDay: Array(31).fill(300), percentDifference: 100 }),
      isLoading: false,
    })
    render(<ExpensePaceCard />)

    expect(screen.getByText(/expenseDashboard\.paceOverSuffix/)).toBeInTheDocument()
    expect(screen.queryByText(/expenseDashboard\.paceAllowanceSuffix/)).not.toBeInTheDocument()
  })

  it('ties the current surplus to the first goal when spending less than usual so far', () => {
    useGoalsMock.mockReturnValue({ data: [{ id: 1, name: 'Vacances' }] })
    useExpensePaceMock.mockReturnValue({
      data: pace({ currentMonthCumulative: 60, historicalCumulativeAverage: 100, percentDifference: -40 }),
      isLoading: false,
    })
    render(<ExpensePaceCard />)

    expect(screen.getByText(/expenseDashboard\.paceGoalSuffix/)).toBeInTheDocument()
  })

  it('does not show a goal tie-in when there is no goal', () => {
    useGoalsMock.mockReturnValue({ data: [] })
    useExpensePaceMock.mockReturnValue({
      data: pace({ currentMonthCumulative: 60, historicalCumulativeAverage: 100, percentDifference: -40 }),
      isLoading: false,
    })
    render(<ExpensePaceCard />)

    expect(screen.queryByText(/expenseDashboard\.paceGoalSuffix/)).not.toBeInTheDocument()
  })

  it('does not show a goal tie-in when currently spending more than usual', () => {
    useGoalsMock.mockReturnValue({ data: [{ id: 1, name: 'Vacances' }] })
    useExpensePaceMock.mockReturnValue({
      data: pace({ currentMonthCumulative: 150, historicalCumulativeAverage: 100, percentDifference: 50 }),
      isLoading: false,
    })
    render(<ExpensePaceCard />)

    expect(screen.queryByText(/expenseDashboard\.paceGoalSuffix/)).not.toBeInTheDocument()
  })
})
