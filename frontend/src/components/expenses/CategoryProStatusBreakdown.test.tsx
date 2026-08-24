import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryProStatusBreakdown } from './CategoryProStatusBreakdown'
import type { CategoryBreakdownItem } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

describe('CategoryProStatusBreakdown', () => {
  it('shows the empty state when there are no expenses', () => {
    render(<CategoryProStatusBreakdown data={[]} />)
    expect(screen.getByText('expenseDashboard.noExpenses')).toBeInTheDocument()
  })

  it('renders one legend entry per non-zero category/status pair, uncategorized included', () => {
    const data: CategoryBreakdownItem[] = [
      { categoryId: 1, categoryName: 'Restauration', categoryColor: '#f97316', proStatus: 'PERSO', total: 180 },
      { categoryId: 1, categoryName: 'Restauration', categoryColor: '#f97316', proStatus: 'PRO_ABSORBE', total: 60 },
      { categoryId: null, categoryName: null, categoryColor: null, proStatus: 'NON_CLASSE', total: 42 },
      { categoryId: 2, categoryName: 'Courses', categoryColor: '#22c55e', proStatus: 'PERSO', total: 0 }, // zero, excluded
    ]

    render(<CategoryProStatusBreakdown data={data} />)

    expect(screen.getAllByText('Restauration')).toHaveLength(2)
    expect(screen.getByText('proStatus.perso')).toBeInTheDocument()
    expect(screen.getByText('proStatus.proAbsorbe')).toBeInTheDocument()
    expect(screen.getByText('expenseDashboard.uncategorized')).toBeInTheDocument()
    expect(screen.queryByText('Courses')).not.toBeInTheDocument()
  })

  it('sorts rows by total descending', () => {
    const data: CategoryBreakdownItem[] = [
      { categoryId: 1, categoryName: 'Small', categoryColor: '#f97316', proStatus: 'PERSO', total: 10 },
      { categoryId: 2, categoryName: 'Big', categoryColor: '#22c55e', proStatus: 'PERSO', total: 500 },
    ]

    render(<CategoryProStatusBreakdown data={data} />)

    const names = screen.getAllByText(/Small|Big/).map(el => el.textContent)
    expect(names).toEqual(['Big', 'Small'])
  })
})
