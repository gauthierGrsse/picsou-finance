import { useTranslation } from 'react-i18next'
import type { ExpenseCategory, Transaction } from '@/types/api'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ExpenseCategoryBadge } from '@/components/shared/ExpenseCategoryBadge'
import { ProStatusBadge } from '@/components/shared/ProStatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn, localeFromLanguage } from '@/lib/utils'

interface AllTransactionsListProps {
  transactions: Transaction[]
  categories: ExpenseCategory[]
}

/** Read-only, cross-account transaction list for the global transactions page -- each row
 * carries its own account name since, unlike the per-account list, that isn't implied by
 * page context. Classifying or editing a transaction still happens from its own account
 * page for now. */
export function AllTransactionsList({ transactions, categories }: AllTransactionsListProps) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  if (transactions.length === 0) {
    return (
      <Card size="sm">
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
        </CardContent>
      </Card>
    )
  }

  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, tr) => {
    const date = tr.date
    if (!acc[date]) acc[date] = []
    acc[date].push(tr)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <Card size="sm">
      <CardContent className="space-y-0">
        {sortedDates.map((date, dateIdx) => (
          <div key={date}>
            {dateIdx > 0 && <Separator className="my-3" />}
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              {formatTransactionDate(date, locale)}
            </p>
            <div className="space-y-0.5">
              {grouped[date].map((tr, rowIdx) => (
                <div
                  key={tr.id}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-4 py-3 transition-colors',
                    'hover:bg-muted/60',
                    rowIdx % 2 === 0 ? 'bg-muted/20' : 'bg-transparent',
                  )}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{tr.description}</p>
                    {tr.accountName && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">
                        {tr.accountName}
                      </span>
                    )}
                    {tr.proStatus !== 'NON_CLASSE' && <ProStatusBadge status={tr.proStatus} />}
                    <ExpenseCategoryBadge categoryId={tr.expenseCategoryId} categories={categories} />
                  </div>
                  <CurrencyDisplay
                    value={tr.amount}
                    currency={tr.nativeCurrency}
                    className={cn(
                      'ml-4 shrink-0 text-base font-semibold tabular-nums',
                      tr.amount >= 0 ? 'text-emerald-500' : 'text-foreground',
                    )}
                  />
                </div>
              ))}
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
