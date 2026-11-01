import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category, ProStatus, Transaction, TransactionClassificationRequest } from '@/types/api'
import { TransactionRow } from '@/components/shared/TransactionRow'
import { TransactionDetailSheet } from '@/components/shared/TransactionDetailSheet'
import { CategoryBadge } from '@/components/shared/CategoryBadge'
import { ProStatusBadge } from '@/components/shared/ProStatusBadge'
import { TransactionContextMenu } from '@/components/shared/TransactionContextMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tags, Unlink, ArrowLeftRight } from 'lucide-react'
import { localeFromLanguage } from '@/lib/utils'
import { proStatusLabelKey } from '@/lib/constants'
import { transactionDescription } from '@/lib/transactions'

const selectClassName = "flex h-10 items-center rounded-xl border border-input bg-background text-foreground px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"

const FILTERABLE_STATUSES: ProStatus[] = ['NON_CLASSE', 'PERSO', 'PRO_A_REMBOURSER', 'PRO_ABSORBE', 'VIREMENT_INTERNE']

interface TransactionsListProps {
  transactions: Transaction[]
  onDelete?: (txId: number) => void
  onEdit?: (tx: Transaction) => void
  logoUrlFor?: (brandId: number | null | undefined) => string | null
  /** The member's categories: filter options, badges, the right-click menu and the detail sheet. */
  categories?: Category[]
  onCategorize?: (txId: number, categoryId: number) => void
  /** Buttons rendered in the card header (add, import). The card stays visible when empty if set. */
  actions?: ReactNode
  onClassify?: (tx: Transaction) => void
  onQuickClassify?: (tx: Transaction, data: TransactionClassificationRequest) => void
  onUnlinkTransfer?: (txId: number) => void
  onLinkTransfer?: (tx: Transaction) => void
}

export function TransactionsList({
  transactions,
  onDelete,
  onEdit,
  logoUrlFor,
  categories = [],
  onCategorize,
  actions,
  onClassify,
  onQuickClassify,
  onUnlinkTransfer,
  onLinkTransfer,
}: TransactionsListProps) {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const [hideInternal, setHideInternal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | ProStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'uncategorized' | number>('all')
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  const normalizedSearch = search.toLocaleLowerCase(locale)
  const filtered = transactions.filter(tr => {
    if (search) {
      const displayedDescription = transactionDescription(tr, t).toLocaleLowerCase(locale)
      const matches =
        displayedDescription.includes(normalizedSearch) ||
        tr.description.toLocaleLowerCase(locale).includes(normalizedSearch) ||
        (tr.merchantLabel ?? '').toLocaleLowerCase(locale).includes(normalizedSearch)
      if (!matches) return false
    }
    if (hideInternal && tr.proStatus === 'VIREMENT_INTERNE') return false
    if (statusFilter !== 'all' && tr.proStatus !== statusFilter) return false
    // The API omits null fields rather than sending null, so an uncategorized row arrives
    // with categoryId undefined -- hence the loose != / == comparisons here.
    if (categoryFilter === 'uncategorized' && tr.categoryId != null) return false
    if (typeof categoryFilter === 'number' && tr.categoryId !== categoryFilter) return false
    return true
  })
  const showYear = new Set(filtered.map(tr => tr.date.slice(0, 4))).size > 1

  const grouped = filtered.reduce<Record<string, Transaction[]>>((acc, tr) => {
    if (!acc[tr.date]) acc[tr.date] = []
    acc[tr.date].push(tr)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  if (transactions.length === 0 && !actions) return null

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">{t('accounts.transactions')}</CardTitle>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
        <CardContent className="space-y-0">
          {transactions.length > 0 && <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />}
          {transactions.length > 0 && (
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
                  {categories.filter(cat => !cat.archived).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          {transactions.length > 0 && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
          )}
          {sortedDates.map((date, dateIdx) => (
            <div key={date}>
              {dateIdx > 0 && <Separator className="my-3" />}
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {formatTransactionDate(date, locale, showYear)}
              </p>
              <div className="space-y-0.5">
                {grouped[date].map((tr, rowIdx) => {
                  const row = (
                    <TransactionRow
                      transaction={tr}
                      logoUrlFor={logoUrlFor}
                      index={rowIdx}
                      onClick={setSelectedTx}
                      badges={
                        <>
                          {tr.proStatus !== 'NON_CLASSE' && <ProStatusBadge status={tr.proStatus} />}
                          <CategoryBadge categoryId={tr.categoryId} categories={categories} />
                        </>
                      }
                      trailing={(onClassify || onLinkTransfer || onUnlinkTransfer) ? (
                        <>
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
                        </>
                      ) : undefined}
                    />
                  )
                  return onQuickClassify ? (
                    <TransactionContextMenu
                      key={tr.id}
                      transaction={tr}
                      categories={categories}
                      onQuickClassify={(change) => onQuickClassify(tr, {
                        proStatus: change.field === 'status' ? change.proStatus : tr.proStatus,
                        categoryId: change.field === 'category' ? change.categoryId : (tr.categoryId ?? null),
                      })}
                      onUnlinkTransfer={onUnlinkTransfer}
                      onLinkTransfer={onLinkTransfer}
                    >
                      <div>{row}</div>
                    </TransactionContextMenu>
                  ) : (
                    <div key={tr.id}>{row}</div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <TransactionDetailSheet
        transaction={selectedTx}
        open={selectedTx != null}
        onClose={() => setSelectedTx(null)}
        logoUrlFor={logoUrlFor}
        categories={categories}
        onCategorize={onCategorize}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  )
}

function formatTransactionDate(date: string, locale: string, showYear: boolean): string {
  const transactionDate = new Date(`${date}T00:00:00`)
  const label = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(showYear ? { year: 'numeric' } : {}),
  }).format(transactionDate)
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1)
}
