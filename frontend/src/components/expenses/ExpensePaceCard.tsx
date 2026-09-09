import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { Gauge } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useExpensePace } from '@/features/expenseDashboard/hooks'
import { useGoals } from '@/features/goals/hooks'
import { cn, formatCurrency, formatPercent, localeFromLanguage } from '@/lib/utils'
import type { CategoryPaceSeries, ExpensePaceResponse } from '@/types/api'

const HISTORY_MONTHS = 3
const GLOBAL_COLOR = 'var(--chart-1)'

function categoryKey(series: CategoryPaceSeries) {
  return `cat_${series.categoryId ?? 'none'}`
}

function compactAxisValue(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** Under 80% of budget reads as on track, 80-100% as close, over 100% as over -- purely a
 * color cue on the chip, nothing is blocked or warned about beyond that. */
function budgetStatusClass(percentUsed: number) {
  if (percentUsed > 100) return 'bg-destructive/10 text-destructive'
  if (percentUsed >= 80) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
}

/** One row per day of the month; `undefined` for a day beyond dayOfMonth on a *_current key
 * (Recharts breaks the line there instead of drawing toward zero) or beyond a category's own
 * data. */
function buildChartData(pace: ExpensePaceResponse): Record<string, number | undefined>[] {
  return Array.from({ length: pace.daysInMonth }, (_, i) => {
    const day = i + 1
    const point: Record<string, number | undefined> = {
      day,
      globalCurrent: i < pace.currentCumulativeByDay.length ? pace.currentCumulativeByDay[i] : undefined,
      globalHistorical: pace.historicalCumulativeByDay[i],
    }
    for (const series of pace.categorySeries) {
      const key = categoryKey(series)
      point[`${key}_current`] = i < series.currentCumulativeByDay.length ? series.currentCumulativeByDay[i] : undefined
      point[`${key}_historical`] = series.historicalCumulativeByDay[i]
    }
    return point
  })
}

const chartConfig = {
  globalCurrent: { label: 'Global' },
} satisfies ChartConfig

/**
 * How this month's spending compares to the member's usual pace, as of today -- a solid line
 * (this month, stops at today) against a dashed one (the historical average, spans the full
 * month as a reference trajectory). Category lines are drawn but invisible by default so the
 * chart isn't cluttered; hovering a category chip below reveals just that one.
 */
export function ExpensePaceCard() {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const { data: pace, isLoading } = useExpensePace(HISTORY_MONTHS)
  const { data: goals } = useGoals()
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const chartData = useMemo(() => (pace ? buildChartData(pace) : []), [pace])

  if (isLoading) {
    return (
      <Card size="sm">
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }
  if (!pace) return null

  const percent = pace.percentDifference
  const spendingMore = percent != null && percent > 0

  // Remaining budget = the usual full month's total minus what's already gone out, spread
  // over what's left of the month -- simple division of a known remainder, not a forward
  // projection of spending itself (that's what the naive-linear approach got wrong).
  const historicalFullMonthTotal = pace.historicalCumulativeByDay.at(-1) ?? 0
  const remainingBudget = historicalFullMonthTotal - pace.currentMonthCumulative
  const daysRemaining = Math.max(pace.daysInMonth - pace.dayOfMonth, 1)
  const dailyAllowance = remainingBudget / daysRemaining

  // Same day-of-month comparison already driving the badge above, just read as an amount --
  // only surfaced when it's a surplus, to celebrate the win rather than pile onto the badge's
  // already-negative framing when over pace.
  const surplusSoFar = pace.historicalCumulativeAverage - pace.currentMonthCumulative
  const primaryGoal = goals?.[0]
  const showGoalTieIn = percent != null && primaryGoal != null && surplusSoFar > 0

  function setHovered(key: string, hovering: boolean) {
    setHoveredKey(prev => {
      if (hovering) return key
      return prev === key ? null : prev
    })
  }

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
      <CardContent className="space-y-2">
        {percent == null ? (
          <p className="text-xs text-muted-foreground">{t('expenseDashboard.paceNoHistory')}</p>
        ) : (
          <div className="space-y-0.5 text-xs">
            <p className={remainingBudget > 0 ? 'text-muted-foreground' : 'text-destructive'}>
              {remainingBudget > 0 ? (
                <>
                  {t('expenseDashboard.paceAllowancePrefix')}
                  {' '}
                  <CurrencyDisplay value={dailyAllowance} className="font-medium text-foreground" />
                  {t('expenseDashboard.paceAllowanceSuffix')}
                </>
              ) : (
                <>
                  {t('expenseDashboard.paceOverPrefix')}
                  {' '}
                  <CurrencyDisplay value={-remainingBudget} className="font-medium" />
                  {t('expenseDashboard.paceOverSuffix')}
                </>
              )}
            </p>
            {showGoalTieIn && primaryGoal && (
              <p className="text-muted-foreground">
                {t('expenseDashboard.paceGoalPrefix')}
                {' '}
                <CurrencyDisplay value={surplusSoFar} className="font-medium text-foreground" />
                {' '}
                {t('expenseDashboard.paceGoalSuffix', { goal: primaryGoal.name })}
              </p>
            )}
          </div>
        )}

        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={6} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              width={36}
              tickFormatter={(value) => compactAxisValue(value as number, locale)}
            />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: 'var(--border)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const current = payload.find(p => p.dataKey === 'globalCurrent')?.value as number | undefined
                const historical = payload.find(p => p.dataKey === 'globalHistorical')?.value as number | undefined
                return (
                  <div className="grid gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                    <p className="font-medium">{t('expenseDashboard.paceTooltipDay', { day: label })}</p>
                    {current != null && (
                      <p className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{t('expenseDashboard.paceTooltipCurrent')}</span>
                        <span className="font-mono font-medium tabular-nums">{formatCurrency(current, 'EUR', locale)}</span>
                      </p>
                    )}
                    {historical != null && (
                      <p className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{t('expenseDashboard.paceTooltipUsual')}</span>
                        <span className="font-mono font-medium tabular-nums">{formatCurrency(historical, 'EUR', locale)}</span>
                      </p>
                    )}
                  </div>
                )
              }}
            />

            <Line dataKey="globalHistorical" stroke={GLOBAL_COLOR} strokeOpacity={0.5} strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="globalCurrent" stroke={GLOBAL_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />

            {pace.categorySeries.map((series) => {
              const key = categoryKey(series)
              const color = series.categoryColor ?? 'var(--chart-5)'
              const opacity = hoveredKey === key ? 1 : 0
              return (
                <Fragment key={key}>
                  <Line
                    dataKey={`${key}_historical`}
                    stroke={color}
                    strokeOpacity={opacity * 0.6}
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                    style={{ transition: 'stroke-opacity 150ms' }}
                  />
                  <Line
                    dataKey={`${key}_current`}
                    stroke={color}
                    strokeOpacity={opacity}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    style={{ transition: 'stroke-opacity 150ms' }}
                  />
                </Fragment>
              )
            })}
          </LineChart>
        </ChartContainer>

        {pace.categorySeries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t pt-2">
            {pace.categorySeries.map((series) => {
              const key = categoryKey(series)
              const isHovered = hoveredKey === key
              const spentSoFar = series.currentCumulativeByDay.at(-1) ?? 0
              const percentOfBudget = series.monthlyBudget ? (spentSoFar / series.monthlyBudget) * 100 : null
              return (
                <button
                  key={key}
                  type="button"
                  onMouseEnter={() => setHovered(key, true)}
                  onMouseLeave={() => setHovered(key, false)}
                  onFocus={() => setHovered(key, true)}
                  onBlur={() => setHovered(key, false)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors',
                    isHovered ? 'border-foreground/30 bg-muted' : 'border-transparent bg-muted/50 text-muted-foreground',
                  )}
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: series.categoryColor ?? 'var(--chart-5)' }} />
                  {series.categoryName ?? t('expenseDashboard.uncategorized')}
                  {percentOfBudget != null && (
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums', budgetStatusClass(percentOfBudget))}>
                      {Math.round(percentOfBudget)}%
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
