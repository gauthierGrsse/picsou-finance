import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PendingReimbursementsCard } from './PendingReimbursementsCard'
import type { PendingReimbursements } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

const pending: PendingReimbursements = {
  expenses: [
    {
      id: 1, date: '2026-01-05', description: 'Repas client A', amount: -25, type: null, category: null,
      nativeCurrency: 'EUR', isManual: false, txType: null, ticker: null, name: null, quantity: null,
      pricePerUnit: null, fees: null, proStatus: 'PRO_A_REMBOURSER', expenseCategoryId: null,
      reimbursementStatus: 'EN_ATTENTE', reimbursementId: null,
    },
  ],
  totalOwed: 25,
}

vi.mock('@/features/reimbursements/hooks', () => ({
  usePendingReimbursements: () => ({ data: pending, isLoading: false }),
  useCandidateCredits: () => ({ data: [] }),
  useCreateReimbursement: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('PendingReimbursementsCard', () => {
  it('shows the total owed and the pending expenses', () => {
    render(<PendingReimbursementsCard />)

    expect(screen.getByText('Repas client A')).toBeInTheDocument()
  })

  it('opens the link modal when clicking the link button', () => {
    render(<PendingReimbursementsCard />)

    fireEvent.click(screen.getByRole('button', { name: /reimbursements\.linkTitle/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
