import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditHoldingModal } from './EditHoldingModal'
import type { HoldingResponse } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

// DateInput's own parsing/format logic isn't what's under test here -- stand in with a
// plain controlled input so this file only exercises EditHoldingModal's own wiring.
vi.mock('@/components/shared/DateInput', () => ({
  DateInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="acquiredAt" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

function holding(overrides: Partial<HoldingResponse>): HoldingResponse {
  return {
    ticker: 'AAPL', name: 'Apple Inc.', quantity: 10, averageBuyIn: 150,
    currentPrice: 180, quoteCurrency: 'USD', currentValueEur: 1800, costBasisEur: 1500,
    pnlEur: 300, pnlPercent: 20, priceUpdatedAt: null, priceAsOf: null, priceStale: false,
    acquiredAt: null,
    ...overrides,
  }
}

describe('EditHoldingModal', () => {
  it('pre-fills quantity, average buy-in and acquired date from the holding', () => {
    render(
      <EditHoldingModal
        open
        onOpenChange={vi.fn()}
        holding={holding({ quantity: 15, averageBuyIn: 155, acquiredAt: '2026-03-01' })}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue('15')).toBeInTheDocument()
    expect(screen.getByDisplayValue('155')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-03-01')).toBeInTheDocument()
  })

  it('leaves the acquired-date field blank when the holding has none', () => {
    render(
      <EditHoldingModal
        open
        onOpenChange={vi.fn()}
        holding={holding({ acquiredAt: null })}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('acquiredAt')).toHaveValue('')
  })

  it('submits the edited acquired date as an ISO string', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <EditHoldingModal
        open
        onOpenChange={vi.fn()}
        holding={holding({ acquiredAt: null })}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('acquiredAt'), { target: { value: '2026-05-20' } })
    fireEvent.click(screen.getByText('common.save'))

    expect(onSubmit).toHaveBeenCalledWith('AAPL', 10, 150, '2026-05-20')
  })

  it('submits null when the acquired date is cleared', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <EditHoldingModal
        open
        onOpenChange={vi.fn()}
        holding={holding({ acquiredAt: '2026-03-01' })}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('acquiredAt'), { target: { value: '' } })
    fireEvent.click(screen.getByText('common.save'))

    expect(onSubmit).toHaveBeenCalledWith('AAPL', 10, 150, null)
  })
})
