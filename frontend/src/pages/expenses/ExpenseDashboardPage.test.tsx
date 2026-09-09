import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExpenseDashboardPage } from './ExpenseDashboardPage'
import type { ExpenseDashboardResponse, ExpensePaceResponse, PendingReimbursements } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

const expenseDashboard: ExpenseDashboardResponse = {
  monthlyEvolution: [
    { yearMonth: '2025-12', total: 850 },
    { yearMonth: '2026-01', total: 920.5 },
  ],
  categoryBreakdown: [
    { categoryId: 1, categoryName: 'Restauration', categoryColor: '#f97316', proStatus: 'PERSO', total: 620.5 },
    { categoryId: null, categoryName: null, categoryColor: null, proStatus: 'PERSO', total: 300 },
  ],
  totalProAbsorbe: 95,
}

const incomeDashboard: ExpenseDashboardResponse = {
  monthlyEvolution: [
    { yearMonth: '2025-12', total: 3000 },
    { yearMonth: '2026-01', total: 3200 },
  ],
  categoryBreakdown: [
    { categoryId: 2, categoryName: 'Salaire', categoryColor: '#22c55e', proStatus: 'NON_CLASSE', total: 3200 },
  ],
  totalProAbsorbe: 0,
}

const defaultDashboardImpl = (_months: number, _periodStart: string, _periodEnd: string, income: boolean) =>
  ({ data: income ? incomeDashboard : expenseDashboard, isLoading: false })

const useExpenseDashboard = vi.fn<(months: number, periodStart: string, periodEnd: string, income: boolean) => { data: ExpenseDashboardResponse; isLoading: boolean }>(
  defaultDashboardImpl,
)

const pace: ExpensePaceResponse = {
  dayOfMonth: 10, daysInMonth: 31, historyMonths: 3, currentMonthCumulative: 100,
  historicalCumulativeAverage: 100, percentDifference: 0,
  currentCumulativeByDay: [], historicalCumulativeByDay: [], categorySeries: [],
}

vi.mock('@/features/expenseDashboard/hooks', () => ({
  useExpenseDashboard: (months: number, periodStart: string, periodEnd: string, income: boolean) => useExpenseDashboard(months, periodStart, periodEnd, income),
  useExpensePace: () => ({ data: pace, isLoading: false }),
}))

vi.mock('@/features/goals/hooks', () => ({
  useGoals: () => ({ data: [] }),
}))

const pending: PendingReimbursements = { expenses: [], totalOwed: 0 }

vi.mock('@/features/reimbursements/hooks', () => ({
  usePendingReimbursements: () => ({ data: pending, isLoading: false }),
  useCandidateCredits: () => ({ data: [] }),
  useCreateReimbursement: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/features/internalTransfers/hooks', () => ({
  useSuggestedTransfers: () => ({ data: [], isLoading: false }),
  useConfirmTransferLink: () => ({ mutate: vi.fn(), isPending: false }),
}))

describe('ExpenseDashboardPage', () => {
  it('renders the total-this-period stat as the sum of the category breakdown', () => {
    render(<ExpenseDashboardPage />)

    expect(screen.getByText('expenseDashboard.totalPeriodLabel')).toBeInTheDocument()
    expect(screen.getByText('€920.50')).toBeInTheDocument()
  })

  it('renders the totalProAbsorbe stat', () => {
    render(<ExpenseDashboardPage />)

    expect(screen.getByText('€95.00')).toBeInTheDocument()
  })

  it('defaults to the current month with a 6-month evolution window, fetching both expense and income sides', () => {
    render(<ExpenseDashboardPage />)

    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(useExpenseDashboard).toHaveBeenCalledWith(6, `${month}-01`, expect.stringContaining(month), false)
    expect(useExpenseDashboard).toHaveBeenCalledWith(6, `${month}-01`, expect.stringContaining(month), true)
  })

  it('switches to a full calendar year when Year is selected', () => {
    render(<ExpenseDashboardPage />)

    fireEvent.click(screen.getByText('expenseDashboard.period.year'))

    const year = new Date().getFullYear()
    expect(useExpenseDashboard).toHaveBeenCalledWith(12, `${year}-01-01`, `${year}-12-31`, false)
    expect(useExpenseDashboard).toHaveBeenCalledWith(12, `${year}-01-01`, `${year}-12-31`, true)
    expect(screen.getByText('expenseDashboard.totalPeriodYearLabel')).toBeInTheDocument()
  })

  it('switches the top total to the income side when Income is selected, and back when Expenses is clicked again', () => {
    render(<ExpenseDashboardPage />)

    fireEvent.click(screen.getByText('expenseDashboard.view.income'))

    expect(screen.getByText('expenseDashboard.totalPeriodIncomeLabel')).toBeInTheDocument()
    expect(screen.getByText('€3,200.00', { selector: '.text-3xl' })).toBeInTheDocument()

    fireEvent.click(screen.getByText('expenseDashboard.view.expense'))

    expect(screen.getByText('expenseDashboard.totalPeriodLabel')).toBeInTheDocument()
    expect(screen.getByText('€920.50', { selector: '.text-3xl' })).toBeInTheDocument()
  })

  it('shows the expense and income category breakdowns side by side without needing to toggle', () => {
    render(<ExpenseDashboardPage />)

    expect(screen.getByText('expenseDashboard.categoryBreakdownTitle')).toBeInTheDocument()
    expect(screen.getByText('expenseDashboard.categoryBreakdownIncomeTitle')).toBeInTheDocument()
    expect(screen.getByText('Restauration')).toBeInTheDocument()
    expect(screen.getByText('Salaire')).toBeInTheDocument()

    fireEvent.click(screen.getByText('expenseDashboard.view.income'))
    expect(screen.getByText('Restauration')).toBeInTheDocument()
    expect(screen.getByText('Salaire')).toBeInTheDocument()
  })

  it('shows the pace card for the current month regardless of the expense/income toggle, hides it for the year view', () => {
    render(<ExpenseDashboardPage />)
    expect(screen.getByText('expenseDashboard.paceTitle')).toBeInTheDocument()

    fireEvent.click(screen.getByText('expenseDashboard.view.income'))
    expect(screen.getByText('expenseDashboard.paceTitle')).toBeInTheDocument()

    fireEvent.click(screen.getByText('expenseDashboard.period.year'))
    expect(screen.queryByText('expenseDashboard.paceTitle')).not.toBeInTheDocument()
  })

  it('shows a best-month ranking badge when the most recent completed month ranks in the top half', () => {
    const rankingDashboard: ExpenseDashboardResponse = {
      monthlyEvolution: [
        { yearMonth: '2026-01', total: 900 },
        { yearMonth: '2026-02', total: 800 },
        { yearMonth: '2026-03', total: 700 },
        { yearMonth: '2026-04', total: 600 },
        { yearMonth: '2026-05', total: 500 },
        { yearMonth: '2026-06', total: 100 }, // most recent completed month, lowest of all 6 -> rank 1
      ],
      categoryBreakdown: [],
      totalProAbsorbe: 0,
    }
    useExpenseDashboard.mockImplementation((_m, _s, _e, income) => ({ data: income ? incomeDashboard : rankingDashboard, isLoading: false }))

    render(<ExpenseDashboardPage />)

    expect(screen.getByText(/expenseDashboard\.monthRanking/)).toBeInTheDocument()

    useExpenseDashboard.mockImplementation(defaultDashboardImpl)
  })

  it('hides the ranking badge when the most recent completed month ranks in the bottom half', () => {
    const rankingDashboard: ExpenseDashboardResponse = {
      monthlyEvolution: [
        { yearMonth: '2026-01', total: 100 },
        { yearMonth: '2026-02', total: 200 },
        { yearMonth: '2026-03', total: 300 },
        { yearMonth: '2026-04', total: 400 },
        { yearMonth: '2026-05', total: 500 },
        { yearMonth: '2026-06', total: 900 }, // most recent completed month, highest of all 6 -> worst rank
      ],
      categoryBreakdown: [],
      totalProAbsorbe: 0,
    }
    useExpenseDashboard.mockImplementation((_m, _s, _e, income) => ({ data: income ? incomeDashboard : rankingDashboard, isLoading: false }))

    render(<ExpenseDashboardPage />)

    expect(screen.queryByText(/expenseDashboard\.monthRanking/)).not.toBeInTheDocument()

    useExpenseDashboard.mockImplementation(defaultDashboardImpl)
  })

  it('navigates to the filtered transactions page when a breakdown row is clicked', () => {
    render(<ExpenseDashboardPage />)

    fireEvent.click(screen.getByText('Restauration'))

    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(navigate).toHaveBeenCalledWith(`/transactions?status=PERSO&category=1&mode=month&month=${month}`)
  })
})
