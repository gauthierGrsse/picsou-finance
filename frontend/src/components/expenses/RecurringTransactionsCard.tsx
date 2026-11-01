import { useTranslation } from 'react-i18next'
import { ArrowUp, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useRecurring } from '@/features/budget/hooks'
import { formatDate, getLocale } from '@/lib/utils'
import type { RecurringCadence } from '@/types/api'

/** How many times a series of each cadence fires in one month, on average. */
const PER_MONTH: Record<RecurringCadence, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  YEARLY: 1 / 12,
}

/**
 * The member's confirmed recurring charges -- what they cost per month, which ones have quietly
 * gone up, and when the next one lands. Reads the budget module's recurring series (confirmed
 * ones only; suggestions are triaged over there). Self-contained: renders nothing when there are
 * none, rather than leaving an empty card.
 */
export function RecurringTransactionsCard() {
  const { t } = useTranslation()
  const { data: series, isLoading } = useRecurring('CONFIRMED')

  if (isLoading) {
    return (
      <Card size="sm">
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    )
  }

  const charges = (series ?? [])
    .filter(s => s.expectedAmount < 0)
    .map(s => ({ ...s, monthly: Math.abs(s.expectedAmount) * PER_MONTH[s.cadence] }))
    .sort((a, b) => b.monthly - a.monthly)
  if (charges.length === 0) return null

  const monthlyTotal = charges.reduce((sum, c) => sum + c.monthly, 0)

  return (
    <Card size="sm">
      <CardHeader className="pb-1">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4" />
            {t('recurring.title')}
          </CardTitle>
          <span className="ml-auto shrink-0 text-sm font-medium">
            {t('recurring.perMonthPrefix')}<CurrencyDisplay value={monthlyTotal} />{t('recurring.perMonthSuffix')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {charges.map((c) => {
          const wentUp = c.previousAmount != null && Math.abs(c.expectedAmount) > Math.abs(c.previousAmount)
          return (
            <div key={c.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: c.categoryColor ?? 'var(--chart-5)' }}
              />
              <span className="min-w-0 flex-1 truncate" title={c.label}>{c.label}</span>

              {wentUp && c.previousAmount != null && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <ArrowUp className="size-3" />
                  <CurrencyDisplay value={Math.abs(c.previousAmount)} />
                </span>
              )}
              {c.nextDueDate && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t('recurring.nextDue', { date: formatDate(c.nextDueDate, getLocale()) })}
                </span>
              )}

              <CurrencyDisplay value={Math.abs(c.expectedAmount)} className="shrink-0 tabular-nums font-medium" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
