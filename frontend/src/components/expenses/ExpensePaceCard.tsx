import { useTranslation } from 'react-i18next'
import { Gauge, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useExpensePace } from '@/features/expenseDashboard/hooks'
import { cn, formatPercent } from '@/lib/utils'

const HISTORY_MONTHS = 3

/**
 * How this month's spending compares to the member's usual pace, as of today -- both sides
 * cut off at the same day-of-month rather than projected to month-end (see the backend's
 * ExpensePaceResponse doc for the reasoning). Self-contained: renders a skeleton while
 * loading, nothing once loaded if the backend returned no data.
 */
export function ExpensePaceCard() {
  const { t } = useTranslation()
  const { data: pace, isLoading } = useExpensePace(HISTORY_MONTHS)

  if (isLoading) {
    return (
      <Card size="sm">
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }
  if (!pace) return null

  const percent = pace.percentDifference
  const spendingMore = percent != null && percent > 0

  return (
    <Card size="sm">
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Gauge className="size-4" />
          {t('expenseDashboard.paceTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t('expenseDashboard.paceSpentSoFar')}</p>
            <CurrencyDisplay value={pace.currentMonthCumulative} className="text-xl font-bold" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('expenseDashboard.paceUsualByNow', { day: pace.dayOfMonth })}</p>
            <CurrencyDisplay value={pace.historicalCumulativeAverage} className="text-xl font-bold text-muted-foreground" />
          </div>
        </div>

        {percent == null ? (
          <p className="text-sm text-muted-foreground">{t('expenseDashboard.paceNoHistory')}</p>
        ) : (
          <div
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              spendingMore ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            {spendingMore ? <TrendingUp className="size-4 shrink-0" /> : <TrendingDown className="size-4 shrink-0" />}
            <span>
              {formatPercent(Math.abs(percent) / 100)} {t(spendingMore ? 'expenseDashboard.paceMoreThanUsual' : 'expenseDashboard.paceLessThanUsual')}
            </span>
          </div>
        )}

        {pace.categoryPace.length > 0 && (
          <div className="space-y-1.5 border-t pt-2">
            {pace.categoryPace.map((item) => (
              <div key={item.categoryId ?? 'none'} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.categoryColor ?? 'var(--chart-5)' }} />
                  <span className="min-w-0 truncate">{item.categoryName ?? t('expenseDashboard.uncategorized')}</span>
                </div>
                <div className="shrink-0 text-right">
                  <CurrencyDisplay value={item.currentMonthAmount} className="tabular-nums" />
                  <p className="text-xs text-muted-foreground">
                    {t('expenseDashboard.paceCategoryUsualPrefix')}
                    {' '}
                    <CurrencyDisplay value={item.historicalMonthlyAverage} className="tabular-nums" />
                    {t('expenseDashboard.paceCategoryUsualSuffix')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
