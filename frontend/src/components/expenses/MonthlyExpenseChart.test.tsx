import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MonthlyExpenseChart } from './MonthlyExpenseChart'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

describe('MonthlyExpenseChart', () => {
  it('renders nothing for an empty window', () => {
    const { container } = render(<MonthlyExpenseChart data={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a chart container for a non-empty window', () => {
    const { container } = render(
      <MonthlyExpenseChart data={[
        { yearMonth: '2025-12', total: 850 },
        { yearMonth: '2026-01', total: 920.5 },
      ]} />
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })
})
