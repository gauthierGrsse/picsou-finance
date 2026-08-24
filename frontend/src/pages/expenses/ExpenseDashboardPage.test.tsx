import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExpenseDashboardPage } from './ExpenseDashboardPage'
import type { ExpenseDashboardResponse, PendingReimbursements, Reimbursement } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

const dashboard: ExpenseDashboardResponse = {
  monthlyEvolution: [
    { yearMonth: '2025-12', total: 850 },
    { yearMonth: '2026-01', total: 920.5 },
  ],
  categoryBreakdown: [
    { categoryId: 1, categoryName: 'Restauration', categoryColor: '#f97316', proStatus: 'PERSO', total: 180 },
  ],
  totalProAbsorbe: 95,
}

vi.mock('@/features/expenseDashboard/hooks', () => ({
  useExpenseDashboard: () => ({ data: dashboard, isLoading: false }),
}))

const pending: PendingReimbursements = { expenses: [], totalOwed: 0 }
const reimbursements: Reimbursement[] = []

vi.mock('@/features/reimbursements/hooks', () => ({
  usePendingReimbursements: () => ({ data: pending, isLoading: false }),
  useCandidateCredits: () => ({ data: [] }),
  useCreateReimbursement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReimbursements: () => ({ data: reimbursements, isLoading: false }),
  useUnlinkReimbursementExpense: () => ({ mutate: vi.fn() }),
  useDeleteReimbursement: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
}))

describe('ExpenseDashboardPage', () => {
  it('renders the total-this-period stat from the latest evolution entry', () => {
    render(<ExpenseDashboardPage />)

    expect(screen.getByText('expenseDashboard.totalPeriodLabel')).toBeInTheDocument()
    expect(screen.getByText('€920.50')).toBeInTheDocument()
  })

  it('renders the totalProAbsorbe stat', () => {
    render(<ExpenseDashboardPage />)

    expect(screen.getByText('€95.00')).toBeInTheDocument()
  })
})
