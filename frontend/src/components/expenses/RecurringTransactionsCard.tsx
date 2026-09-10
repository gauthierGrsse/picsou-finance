import { useTranslation } from 'react-i18next'
import { ArrowUp, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useRecurringTransactions } from '@/features/expenseDashboard/hooks'

/**
 * Detected subscriptions / recurring charges -- total per month, plus which ones have a
 * silent price bump and which are still to come this month. Self-contained: renders nothing
 * when the detector found no recurring charges, rather than leaving an empty card.
 */
export function RecurringTransactionsCard() {
  const { t } = useTranslation()
  const { data: recurring, isLoading } = useRecurringTransactions()

  if (isLoading) {
    return (
      <Card size="sm">
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    )
  }
  if (!recurring || recurring.length === 0) return null

  const monthlyTotal = recurring.reduce((sum, r) => sum + r.typicalAmount, 0)

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
        {recurring.map((r) => (
          <div key={r.label} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: r.categoryColor ?? 'var(--chart-5)' }}
            />
            <span className="min-w-0 flex-1 truncate" title={r.label}>{r.label}</span>

            {r.previousAmount != null && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <ArrowUp className="size-3" />
                <CurrencyDisplay value={r.previousAmount} />
              </span>
            )}
            {!r.dueThisMonth && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t('recurring.upcoming', { day: r.typicalDayOfMonth })}
              </span>
            )}

            <CurrencyDisplay value={r.typicalAmount} className="shrink-0 tabular-nums font-medium" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
