import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useExpenseDashboard } from '@/features/expenseDashboard/hooks'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { MonthlyExpenseChart } from '@/components/expenses/MonthlyExpenseChart'
import { CategoryProStatusBreakdown } from '@/components/expenses/CategoryProStatusBreakdown'
import { PendingReimbursementsCard } from '@/components/expenses/PendingReimbursementsCard'
import { ReimbursementsList } from '@/components/shared/ReimbursementsList'
import { SuggestedTransfersCard } from '@/components/expenses/SuggestedTransfersCard'
import { PeriodSelector, type PeriodMode } from '@/components/expenses/PeriodSelector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const MONTH_MODE_EVOLUTION_MONTHS = 6
const YEAR_OPTIONS_BACK = 5

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
  const currentYear = new Date().getFullYear()

  const [mode, setMode] = useState<PeriodMode>('month')
  const [month, setMonth] = useState(currentMonthValue)
  const [year, setYear] = useState(currentYear)

  const years = useMemo(
    () => Array.from({ length: YEAR_OPTIONS_BACK + 1 }, (_, i) => currentYear - i),
    [currentYear],
  )

  const { periodStart, periodEnd, months } = useMemo(() => {
    if (mode === 'year') {
      return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, months: 12 }
    }
    return { periodStart: `${month}-01`, periodEnd: `${month}-${String(lastDayOfMonth(month)).padStart(2, '0')}`, months: MONTH_MODE_EVOLUTION_MONTHS }
  }, [mode, month, year])

  const { data, isLoading } = useExpenseDashboard(months, periodStart, periodEnd)

  const totalThisPeriod = useMemo(
    () => (data?.categoryBreakdown ?? []).reduce((sum, item) => sum + item.total, 0),
    [data],
  )

  if (isLoading || !data) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.expenses')} />

      <PeriodSelector
        mode={mode}
        onModeChange={setMode}
        month={month}
        onMonthChange={setMonth}
        year={year}
        onYearChange={setYear}
        years={years}
      />

      {/* Hero stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t(mode === 'year' ? 'expenseDashboard.totalPeriodYearLabel' : 'expenseDashboard.totalPeriodLabel')}
            </p>
            <CurrencyDisplay value={totalThisPeriod} className="text-3xl font-bold" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t('expenseDashboard.totalProAbsorbeLabel')}</p>
            <CurrencyDisplay value={data.totalProAbsorbe} className="text-3xl font-bold" />
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('expenseDashboard.monthlyEvolutionTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyExpenseChart data={data.monthlyEvolution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('expenseDashboard.categoryBreakdownTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryProStatusBreakdown data={data.categoryBreakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Suggested internal transfers awaiting confirmation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('internalTransfers.suggestedTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SuggestedTransfersCard />
        </CardContent>
      </Card>

      {/* Pending reimbursements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('expenseDashboard.pendingReimbursementsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PendingReimbursementsCard />
        </CardContent>
      </Card>

      {/* Linked reimbursements, with unlink/delete to correct a mistaken rapprochement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('expenseDashboard.linkedReimbursementsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReimbursementsList />
        </CardContent>
      </Card>
    </div>
  )
}
