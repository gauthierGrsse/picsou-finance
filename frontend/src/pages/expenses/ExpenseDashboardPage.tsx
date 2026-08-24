import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useExpenseDashboard } from '@/features/expenseDashboard/hooks'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { MonthlyExpenseChart } from '@/components/expenses/MonthlyExpenseChart'
import { CategoryProStatusBreakdown } from '@/components/expenses/CategoryProStatusBreakdown'
import { PendingReimbursementsCard } from '@/components/expenses/PendingReimbursementsCard'
import { ReimbursementsList } from '@/components/shared/ReimbursementsList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const EVOLUTION_MONTHS = 6

export function ExpenseDashboardPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useExpenseDashboard(EVOLUTION_MONTHS)

  const totalThisPeriod = useMemo(
    () => data?.monthlyEvolution.at(-1)?.total ?? 0,
    [data],
  )

  if (isLoading || !data) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.expenses')} />

      {/* Hero stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t('expenseDashboard.totalPeriodLabel')}</p>
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
