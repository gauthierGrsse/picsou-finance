import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExpenseCategory, ProStatus, Transaction, TransactionClassificationRequest } from '@/types/api'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ExpenseCategoryBadge } from '@/components/shared/ExpenseCategoryBadge'
import { ProStatusBadge } from '@/components/shared/ProStatusBadge'
import { TransactionContextMenu } from '@/components/shared/TransactionContextMenu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Trash2, Pencil, Tags, Unlink, ArrowLeftRight } from 'lucide-react'
import { cn, localeFromLanguage } from '@/lib/utils'
import { proStatusLabelKey } from '@/lib/constants'

const selectClassName = "flex h-10 items-center rounded-xl border border-input bg-background text-foreground px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"

const FILTERABLE_STATUSES: ProStatus[] = ['NON_CLASSE', 'PERSO', 'PRO_A_REMBOURSER', 'PRO_ABSORBE', 'VIREMENT_INTERNE']

interface TransactionsListProps {
  transactions: Transaction[]
  onDelete?: (txId: number) => void
  onEdit?: (tx: Transaction) => void
  onClassify?: (tx: Transaction) => void
  onQuickClassify?: (tx: Transaction, data: TransactionClassificationRequest) => void
  onUnlinkTransfer?: (txId: number) => void
  onLinkTransfer?: (tx: Transaction) => void
  categories?: ExpenseCategory[]
}

export function TransactionsList({ transactions, onDelete, onEdit, onClassify, onQuickClassify, onUnlinkTransfer, onLinkTransfer, categories = [] }: TransactionsListProps) {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const [hideInternal, setHideInternal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | ProStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'uncategorized' | number>('all')
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  const filtered = transactions.filter(tr => {
    if (search && !tr.description.toLowerCase().includes(search.toLowerCase())) return false
    if (hideInternal && tr.proStatus === 'VIREMENT_INTERNE') return false
    if (statusFilter !== 'all' && tr.proStatus !== statusFilter) return false
    if (categoryFilter === 'uncategorized' && tr.expenseCategoryId !== null) return false
    if (typeof categoryFilter === 'number' && tr.expenseCategoryId !== categoryFilter) return false
    return true
  })

  // Group by date
  const grouped = filtered.reduce<Record<string, Transaction[]>>((acc, tr) => {
    const date = tr.date
    if (!acc[date]) acc[date] = []
    acc[date].push(tr)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  if (transactions.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('accounts.transactions')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        <Input
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        <div className="mb-4 flex flex-wrap items-center gap-3">
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
          {categories.length > 0 && (
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
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
        ) : sortedDates.map((date, dateIdx) => (
          <div key={date}>
            {dateIdx > 0 && <Separator className="my-3" />}
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              {formatTransactionDate(date, locale)}
            </p>
            <div className="space-y-0.5">
              {grouped[date].map((tr, rowIdx) => {
                const row = (
                  <div
                    className={cn(
                      'flex items-center justify-between rounded-xl px-4 py-3 transition-colors',
                      'hover:bg-muted/60',
                      rowIdx % 2 === 0 ? 'bg-muted/20' : 'bg-transparent',
                    )}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{tr.description}</p>
                      {tr.isManual && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">
                          {t('accounts.manual')}
                        </span>
                      )}
                      {tr.proStatus !== 'NON_CLASSE' && <ProStatusBadge status={tr.proStatus} />}
                      <ExpenseCategoryBadge categoryId={tr.expenseCategoryId} categories={categories} />
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <CurrencyDisplay
                        value={tr.amount}
                        currency={tr.nativeCurrency}
                        className={cn(
                          'text-base font-semibold tabular-nums',
                          tr.amount >= 0 ? 'text-emerald-500' : 'text-foreground',
                        )}
                      />
                      {onClassify && tr.proStatus !== 'VIREMENT_INTERNE' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => onClassify(tr)}
                        >
                          <Tags className="size-4" />
                        </Button>
                      )}
                      {onLinkTransfer && tr.proStatus === 'NON_CLASSE' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => onLinkTransfer(tr)}
                        >
                          <ArrowLeftRight className="size-4" />
                        </Button>
                      )}
                      {onUnlinkTransfer && tr.proStatus === 'VIREMENT_INTERNE' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => onUnlinkTransfer(tr.id)}
                        >
                          <Unlink className="size-4" />
                        </Button>
                      )}
                      {tr.isManual && onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => onEdit(tr)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {onDelete && tr.isManual && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete(tr.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
                return onQuickClassify ? (
                  <TransactionContextMenu
                    key={tr.id}
                    transaction={tr}
                    categories={categories}
                    onQuickClassify={(data) => onQuickClassify(tr, data)}
                    onUnlinkTransfer={onUnlinkTransfer}
                  >
                    {row}
                  </TransactionContextMenu>
                ) : (
                  <Fragment key={tr.id}>{row}</Fragment>
                )
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function formatTransactionDate(date: string, locale: string): string {
  const label = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(date))
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1)
}
