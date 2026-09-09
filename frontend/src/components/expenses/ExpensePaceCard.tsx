import { useTranslation } from 'react-i18next'
import { Gauge } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useExpensePace } from '@/features/expenseDashboard/hooks'
import { cn, formatPercent } from '@/lib/utils'
import type { CategoryPaceItem } from '@/types/api'

const HISTORY_MONTHS = 3
// Headroom above the larger of the two values so a bar pinned at its own max doesn't
// touch the track's edge -- there's still room to read it as "close to" rather than "at".
const BULLET_HEADROOM = 1.15

/**
 * How this month's spending compares to the member's usual pace, as of today -- both sides
 * cut off at the same day-of-month rather than projected to month-end (see the backend's
 * ExpensePaceResponse doc for the reasoning). One bullet bar for the overall pace, one thin
 * bar per category against its own historical monthly average. Self-contained: renders a
 * skeleton while loading, nothing once loaded if the backend returned no data.
 */
export function ExpensePaceCard() {
  const { t } = useTranslation()
  const { data: pace, isLoading } = useExpensePace(HISTORY_MONTHS)

  if (isLoading) {
    return (
      <Card size="sm">
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }
  if (!pace) return null

  const percent = pace.percentDifference
  const spendingMore = percent != null && percent > 0
  const barMax = Math.max(pace.currentMonthCumulative, pace.historicalCumulativeAverage, 1) * BULLET_HEADROOM
  const fillPct = Math.min((pace.currentMonthCumulative / barMax) * 100, 100)
  const markerPct = Math.min((pace.historicalCumulativeAverage / barMax) * 100, 100)

  return (
    <Card size="sm">
      <CardHeader className="pb-1">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gauge className="size-4" />
            {t('expenseDashboard.paceTitle')}
          </CardTitle>
          {percent != null && (
            <span
              className={cn(
                'ml-auto shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                spendingMore ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              )}
            >
              {spendingMore ? '+' : '-'}{formatPercent(Math.abs(percent) / 100)} {t('expenseDashboard.paceVsUsual')}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="relative h-2 rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', spendingMore ? 'bg-destructive' : 'bg-emerald-500')}
              style={{ width: `${fillPct}%` }}
            />
            {pace.historicalCumulativeAverage > 0 && (
              <div className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-foreground" style={{ left: `${markerPct}%` }} />
            )}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>
              <CurrencyDisplay value={pace.currentMonthCumulative} className="tabular-nums" /> {t('expenseDashboard.paceSpentSoFar')}
            </span>
            {percent == null ? (
              <span>{t('expenseDashboard.paceNoHistory')}</span>
            ) : (
              <span>
                <CurrencyDisplay value={pace.historicalCumulativeAverage} className="tabular-nums" /> {t('expenseDashboard.paceUsualByNow', { day: pace.dayOfMonth })}
              </span>
            )}
          </div>
        </div>

        {pace.categoryPace.length > 0 && (
          <div className="space-y-1.5 border-t pt-2">
            {pace.categoryPace.map((item) => (
              <CategoryPaceRow key={item.categoryId ?? 'none'} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CategoryPaceRow({ item }: { item: CategoryPaceItem }) {
  const { t } = useTranslation()
  const ratioPct = item.historicalMonthlyAverage > 0
    ? Math.min((item.currentMonthAmount / item.historicalMonthlyAverage) * 100, 100)
    : (item.currentMonthAmount > 0 ? 100 : 0)

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 truncate text-muted-foreground sm:w-28">
        {item.categoryName ?? t('expenseDashboard.uncategorized')}
      </span>
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${ratioPct}%`, backgroundColor: item.categoryColor ?? 'var(--chart-5)' }}
        />
      </div>
      <span className="shrink-0 text-right tabular-nums text-muted-foreground">
        <CurrencyDisplay value={item.currentMonthAmount} /> / <CurrencyDisplay value={item.historicalMonthlyAverage} />
      </span>
    </div>
  )
}
