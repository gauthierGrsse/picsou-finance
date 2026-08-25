import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExpenseDashboardPage } from './ExpenseDashboardPage'
import type { ExpenseDashboardResponse, PendingReimbursements } from '@/types/api'

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

const dashboard: ExpenseDashboardResponse = {
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

const useExpenseDashboard = vi.fn<(months: number, periodStart: string, periodEnd: string) => { data: ExpenseDashboardResponse; isLoading: boolean }>(
  () => ({ data: dashboard, isLoading: false }),
)

vi.mock('@/features/expenseDashboard/hooks', () => ({
  useExpenseDashboard: (months: number, periodStart: string, periodEnd: string) => useExpenseDashboard(months, periodStart, periodEnd),
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

  it('defaults to the current month with a 6-month evolution window', () => {
    render(<ExpenseDashboardPage />)

    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(useExpenseDashboard).toHaveBeenLastCalledWith(6, `${month}-01`, expect.stringContaining(month))
  })

  it('switches to a full calendar year when Year is selected', () => {
    render(<ExpenseDashboardPage />)

    fireEvent.click(screen.getByText('expenseDashboard.period.year'))

    const year = new Date().getFullYear()
    expect(useExpenseDashboard).toHaveBeenLastCalledWith(12, `${year}-01-01`, `${year}-12-31`)
    expect(screen.getByText('expenseDashboard.totalPeriodYearLabel')).toBeInTheDocument()
  })

  it('navigates to the filtered transactions page when a breakdown row is clicked', () => {
    render(<ExpenseDashboardPage />)

    fireEvent.click(screen.getByText('Restauration'))

    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(navigate).toHaveBeenCalledWith(`/transactions?status=PERSO&category=1&mode=month&month=${month}`)
  })
})
