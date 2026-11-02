import { useTranslation } from 'react-i18next'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { proStatusLabelKey } from '@/lib/constants'
import type { Budget, ProStatus } from '@/types/api'

/** How strongly a bucket is drawn: personal spend is the envelope's own colour, professional spend
 * the same colour faded, the faintest being the part still waiting to be paid back. */
const OPACITY = { solid: 1, absorbed: 0.6, pending: 0.35 } as const

interface Bucket {
  key: 'perso' | 'unclassified' | 'proAbsorbe' | 'proPending'
  status: ProStatus
  amount: number
  opacity: number
}

/**
 * An envelope's progress bar, drawn in segments so you can see how much of what is spent is
 * personal and how much professional. `spent` already follows the expenses page's rule (settled
 * reimbursements are left out); this only shows what it is made of. An envelope with no
 * professional spend draws exactly as a plain bar.
 */
export function EnvelopeBar({ budget, size = 'md', showLegend = false }: {
  budget: Budget
  size?: 'md' | 'sm'
  showLegend?: boolean
}) {
  const { t } = useTranslation()
  const pct = Math.min(budget.percent, 100)
  const tone = budget.overBudget
    ? 'bg-destructive'
    : budget.percent >= 80 ? 'bg-amber-500' : 'bg-primary'

  const b = budget.proBreakdown
  const buckets: Bucket[] = [
    { key: 'perso', status: 'PERSO', amount: b.perso, opacity: OPACITY.solid },
    { key: 'unclassified', status: 'NON_CLASSE', amount: b.unclassified, opacity: OPACITY.solid },
    { key: 'proAbsorbe', status: 'PRO_ABSORBE', amount: b.proAbsorbe, opacity: OPACITY.absorbed },
    { key: 'proPending', status: 'PRO_A_REMBOURSER', amount: b.proPending, opacity: OPACITY.pending },
  ]
  const shown = buckets.filter((x) => x.amount > 0)
  const hasPro = b.proAbsorbe > 0 || b.proPending > 0
  const limit = budget.monthlyLimit

  // Each bucket's share of the cap, stacked left to right and cut off at the end of the bar.
  // Without a cap (or without a breakdown worth showing) the bar is one plain fill.
  let used = 0
  const segments = hasPro && limit > 0
    ? shown.map((x) => {
        const width = Math.min((x.amount / limit) * 100, 100 - used)
        used += width
        return { ...x, width: Math.max(width, 0) }
      })
    : [{ key: 'all', opacity: OPACITY.solid, width: pct }]

  return (
    <div>
      <div
        className={`${size === 'sm' ? 'h-1.5' : 'h-2'} flex w-full overflow-hidden rounded-md bg-muted`}
        role="progressbar" aria-label={budget.categoryName}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
        aria-valuetext={`${budget.percent}%`}>
        {segments.map((s) => (
          <div key={s.key} data-testid={`envelope-segment-${s.key}`}
            className={`h-full transition-all ${tone}`}
            style={{ width: `${s.width}%`, opacity: s.opacity }} />
        ))}
      </div>
      {showLegend && (hasPro || b.reimbursed > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {hasPro && shown.map((x) => (
            <span key={x.key} className="flex items-center gap-1">
              <span className={`size-2 rounded-full ${x.key === 'unclassified' ? 'border border-current' : tone}`}
                style={x.key === 'unclassified' ? undefined : { opacity: x.opacity }} />
              {t(proStatusLabelKey(x.status))}
              <CurrencyDisplay value={x.amount} className="tabular-nums" />
            </span>
          ))}
          {b.reimbursed > 0 && (
            <span>
              <CurrencyDisplay value={b.reimbursed} className="tabular-nums" /> {t('budget.envelope.reimbursedNotCounted')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
