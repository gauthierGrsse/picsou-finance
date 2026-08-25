import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useExpenseDashboard } from '@/features/expenseDashboard/hooks'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { MonthlyExpenseChart } from '@/components/expenses/MonthlyExpenseChart'
import { CategoryProStatusBreakdown } from '@/components/expenses/CategoryProStatusBreakdown'
import { PendingReimbursementsCard } from '@/components/expenses/PendingReimbursementsCard'
import { SuggestedTransfersCard } from '@/components/expenses/SuggestedTransfersCard'
import { PeriodSelector, type PeriodMode } from '@/components/expenses/PeriodSelector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ProStatus } from '@/types/api'

const MONTH_MODE_EVOLUTION_MONTHS = 6
const YEAR_OPTIONS_BACK = 5
type DashboardView = 'expense' | 'income'

function currentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function lastDayOfMonth(monthValue: string) {
  const [y, m] = monthValue.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function ExpenseDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()

  const [mode, setMode] = useState<PeriodMode>('month')
  const [month, setMonth] = useState(currentMonthValue)
  const [year, setYear] = useState(currentYear)
  const [view, setView] = useState<DashboardView>('expense')

  const { periodStart, periodEnd, months } = useMemo(() => {
    if (mode === 'year') {
      return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, months: 12 }
    }
    return { periodStart: `${month}-01`, periodEnd: `${month}-${String(lastDayOfMonth(month)).padStart(2, '0')}`, months: MONTH_MODE_EVOLUTION_MONTHS }
  }, [mode, month, year])

  const { data, isLoading } = useExpenseDashboard(months, periodStart, periodEnd, view === 'income')

  const totalThisPeriod = useMemo(
    () => (data?.categoryBreakdown ?? []).reduce((sum, item) => sum + item.total, 0),
    [data],
  )

  function goToFilteredTransactions(slice: { categoryId: number | null; proStatus: ProStatus }) {
    const params = new URLSearchParams({ status: slice.proStatus })
    params.set('category', slice.categoryId != null ? String(slice.categoryId) : 'uncategorized')
    if (mode === 'year') {
      params.set('mode', 'year')
      params.set('year', String(year))
    } else {
      params.set('mode', 'month')
      params.set('month', month)
    }
    navigate(`/transactions?${params.toString()}`)
  }

  if (isLoading || !data) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('nav.expenses')}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border p-1">
              {(['expense', 'income'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {t(`expenseDashboard.view.${v}`)}
                </button>
              ))}
            </div>
            <PeriodSelector
              mode={mode}
              onModeChange={setMode}
              month={month}
              onMonthChange={setMonth}
              year={year}
              onYearChange={setYear}
              minYear={currentYear - YEAR_OPTIONS_BACK}
              maxYear={currentYear}
            />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t(mode === 'year'
                ? (view === 'income' ? 'expenseDashboard.totalPeriodYearIncomeLabel' : 'expenseDashboard.totalPeriodYearLabel')
                : (view === 'income' ? 'expenseDashboard.totalPeriodIncomeLabel' : 'expenseDashboard.totalPeriodLabel'))}
            </p>
            <CurrencyDisplay value={totalThisPeriod} className="text-3xl font-bold" />
            {data.totalProAbsorbe > 0 && (
              <div className="mt-1.5 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('expenseDashboard.totalProAbsorbeLabel')}:</span>
                <CurrencyDisplay value={data.totalProAbsorbe} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">{t('expenseDashboard.monthlyEvolutionTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyExpenseChart
              data={data.monthlyEvolution}
              highlightMonth={mode === 'month' ? month : undefined}
            />
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm text-muted-foreground">{t('expenseDashboard.categoryBreakdownTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryProStatusBreakdown
            data={data.categoryBreakdown}
            onSliceClick={goToFilteredTransactions}
            emptyLabel={t(view === 'income' ? 'expenseDashboard.noIncome' : 'expenseDashboard.noExpenses')}
          />
        </CardContent>
      </Card>

      {/* Self-contained cards below: each renders nothing when it has nothing to show,
          so the page doesn't carry permanently-empty sections as filler. Already-linked
          reimbursements live in Settings -- that's an occasional audit/undo tool, not a
          daily-glance item, so it doesn't need to sit on this dashboard. */}
      <SuggestedTransfersCard />
      <PendingReimbursementsCard />
    </div>
  )
}
