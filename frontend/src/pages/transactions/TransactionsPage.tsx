import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAllTransactions } from '@/features/transactions/hooks'
import { useExpenseCategories } from '@/features/expenseCategories/hooks'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { PeriodSelector, type PeriodMode } from '@/components/expenses/PeriodSelector'
import { AllTransactionsList } from '@/components/transactions/AllTransactionsList'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { proStatusLabelKey } from '@/lib/constants'
import type { ProStatus } from '@/types/api'

const YEAR_OPTIONS_BACK = 5
const selectClassName = "flex h-10 items-center rounded-xl border border-input bg-background text-foreground px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
const FILTERABLE_STATUSES: ProStatus[] = ['NON_CLASSE', 'PERSO', 'PRO_A_REMBOURSER', 'PRO_ABSORBE', 'VIREMENT_INTERNE']

function currentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function lastDayOfMonth(monthValue: string) {
  const [y, m] = monthValue.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/**
 * Every transaction across every account in one place -- so finding one doesn't mean
 * remembering which account it's on and opening that account's page. Filters can be
 * preset via URL search params (mode/month/year/status/category), which is how the
 * expenses page's category chart deep-links here from a clicked slice.
 */
export function TransactionsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const currentYear = new Date().getFullYear()

  const [mode, setMode] = useState<PeriodMode>(() => searchParams.get('mode') === 'year' ? 'year' : 'month')
  const [month, setMonth] = useState(() => searchParams.get('month') ?? currentMonthValue())
  const [year, setYear] = useState(() => Number(searchParams.get('year')) || currentYear)

  const [search, setSearch] = useState('')
  const [hideInternal, setHideInternal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | ProStatus>(() => {
    const s = searchParams.get('status')
    return s && (FILTERABLE_STATUSES as string[]).includes(s) ? (s as ProStatus) : 'all'
  })
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'uncategorized' | number>(() => {
    const c = searchParams.get('category')
    if (c === 'uncategorized') return 'uncategorized'
    if (c) return Number(c)
    return 'all'
  })

  const { periodStart, periodEnd } = useMemo(() => {
    if (mode === 'year') {
      return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` }
    }
    return { periodStart: `${month}-01`, periodEnd: `${month}-${String(lastDayOfMonth(month)).padStart(2, '0')}` }
  }, [mode, month, year])

  const { data: transactions, isLoading } = useAllTransactions(periodStart, periodEnd)
  const { data: categories } = useExpenseCategories()

  const filtered = useMemo(() => (transactions ?? []).filter(tr => {
    if (search && !tr.description.toLowerCase().includes(search.toLowerCase())) return false
    if (hideInternal && tr.proStatus === 'VIREMENT_INTERNE') return false
    if (statusFilter !== 'all' && tr.proStatus !== statusFilter) return false
    if (categoryFilter === 'uncategorized' && tr.expenseCategoryId !== null) return false
    if (typeof categoryFilter === 'number' && tr.expenseCategoryId !== categoryFilter) return false
    return true
  }), [transactions, search, hideInternal, statusFilter, categoryFilter])

  if (isLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('nav.transactions')}
        actions={
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
        }
      />

      <Card size="sm">
        <CardContent className="space-y-3">
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={hideInternal} onCheckedChange={setHideInternal} aria-label={t('accounts.filterHideInternal')} />
              {t('accounts.filterHideInternal')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ProStatus)}
              className={selectClassName}
            >
              <option value="all">{t('accounts.filterAllStatuses')}</option>
              {FILTERABLE_STATUSES.map(status => (
                <option key={status} value={status}>{t(proStatusLabelKey(status))}</option>
              ))}
            </select>
            {categories && categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value === 'all' || e.target.value === 'uncategorized' ? e.target.value : Number(e.target.value))}
                className={selectClassName}
              >
                <option value="all">{t('accounts.filterAllCategories')}</option>
                <option value="uncategorized">{t('accounts.filterUncategorized')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      <AllTransactionsList transactions={filtered} categories={categories ?? []} />
    </div>
  )
}
