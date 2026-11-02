import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EnvelopeBar } from './EnvelopeBar'
import type { Budget, BudgetProBreakdown } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

function budget(spent: number, breakdown: Partial<BudgetProBreakdown>, overrides: Partial<Budget> = {}): Budget {
  const limit = overrides.monthlyLimit ?? 300
  return {
    id: 1, categoryId: 5, categoryName: 'Restauration', categoryKind: 'EXPENSE', categoryColor: '#f97316',
    categoryIcon: null, monthlyLimit: limit, spent, remaining: limit - spent,
    percent: Math.round((spent / limit) * 100), overBudget: spent > limit, rollup: false,
    cycleStart: '2026-11-01', cycleEnd: '2026-11-30',
    proBreakdown: { perso: spent, proAbsorbe: 0, proPending: 0, unclassified: 0, reimbursed: 0, ...breakdown },
    ...overrides,
  }
}

describe('EnvelopeBar', () => {
  it('draws a single plain fill, and no legend, when nothing is professional', () => {
    render(<EnvelopeBar budget={budget(150, {})} showLegend />)

    expect(screen.getByTestId('envelope-segment-all')).toHaveStyle({ width: '50%' })
    expect(screen.queryByText('proStatus.perso')).not.toBeInTheDocument()
  })

  it('stacks personal and professional spend as shares of the cap, professional fainter', () => {
    render(<EnvelopeBar budget={budget(180, { perso: 90, proAbsorbe: 60, proPending: 30 })} />)

    expect(screen.getByTestId('envelope-segment-perso')).toHaveStyle({ width: '30%', opacity: '1' })
    expect(screen.getByTestId('envelope-segment-proAbsorbe')).toHaveStyle({ width: '20%', opacity: '0.6' })
    expect(screen.getByTestId('envelope-segment-proPending')).toHaveStyle({ width: '10%', opacity: '0.35' })
  })

  it('cuts the segments off at the end of the bar when the envelope is overspent', () => {
    render(<EnvelopeBar budget={budget(450, { perso: 250, proAbsorbe: 200 })} />)

    expect(screen.getByTestId('envelope-segment-perso')).toHaveStyle({ width: '83.33333333333334%' })
    const absorbed = parseFloat(screen.getByTestId('envelope-segment-proAbsorbe').style.width)
    const personal = parseFloat(screen.getByTestId('envelope-segment-perso').style.width)
    expect(personal + absorbed).toBeCloseTo(100)
  })

  it('names each non-zero bucket in the legend, with its amount', () => {
    render(<EnvelopeBar showLegend budget={budget(180, { perso: 90, proAbsorbe: 60, proPending: 30 })} />)

    expect(screen.getByText('proStatus.perso')).toBeInTheDocument()
    expect(screen.getByText('proStatus.proAbsorbe')).toBeInTheDocument()
    expect(screen.getByText('proStatus.proARembourser')).toBeInTheDocument()
    expect(screen.queryByText('proStatus.nonClasse')).not.toBeInTheDocument()
    expect(screen.getByText(/^.60\.00$/)).toBeInTheDocument()
  })

  it('says how much reimbursed spend was left out, even when nothing else is professional', () => {
    render(<EnvelopeBar showLegend budget={budget(80, { reimbursed: 120 })} />)

    expect(screen.getByText(/budget\.envelope\.reimbursedNotCounted/)).toBeInTheDocument()
    expect(screen.getByText(/^.120\.00$/)).toBeInTheDocument()
    expect(screen.getByTestId('envelope-segment-all')).toBeInTheDocument()
  })

  it('keeps the accessible progress value on the whole bar', () => {
    render(<EnvelopeBar budget={budget(180, { perso: 90, proAbsorbe: 90 })} />)

    expect(screen.getByRole('progressbar', { name: 'Restauration' })).toHaveAttribute('aria-valuenow', '60')
  })

  it('draws no legend unless asked for, so the overview preview stays compact', () => {
    render(<EnvelopeBar budget={budget(180, { perso: 90, proAbsorbe: 90 })} />)

    expect(screen.queryByText('proStatus.proAbsorbe')).not.toBeInTheDocument()
  })
})
