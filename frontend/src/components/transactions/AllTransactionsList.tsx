import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { ExpenseCategory, Transaction } from '@/types/api'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ExpenseCategoryBadge } from '@/components/shared/ExpenseCategoryBadge'
import { ProStatusBadge } from '@/components/shared/ProStatusBadge'
import { TransactionContextMenu, type QuickClassifyChange } from '@/components/shared/TransactionContextMenu'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn, localeFromLanguage } from '@/lib/utils'
import { useQuickClassifyTransaction } from '@/features/transactions/hooks'
import { useUnlinkTransfer } from '@/features/internalTransfers/hooks'

interface AllTransactionsListProps {
  transactions: Transaction[]
  categories: ExpenseCategory[]
}

/** Cross-account transaction list for the global transactions page -- each row carries its
 * own account name since, unlike the per-account list, that isn't implied by page context.
 *
 * Click selects a row, shift-click extends a range, ctrl/cmd-click toggles one in or out --
 * then right-click any selected row to classify all of them at once. Internal-transfer rows
 * are never selectable: bulk-setting a status across a pair would desync it from its match,
 * the same reasoning TransactionContextMenu already applies to a single such row. */
export function AllTransactionsList({ transactions, categories }: AllTransactionsListProps) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const quickClassify = useQuickClassifyTransaction()
  const unlinkTransfer = useUnlinkTransfer()

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [anchorId, setAnchorId] = useState<number | null>(null)

  // Flat, on-screen order (date descending, matches the grouped render below) -- the
  // sequence shift-range-select walks.
  const ordered = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [transactions],
  )

  // Derived, not stored: drop selected ids that fell out of the current filter/period so a
  // stale selection can't silently apply to rows the user can no longer see. `selectedIds`
  // itself stays untouched -- re-filtering it back into view (e.g. clearing a filter) just
  // works without needing to have remembered anything.
  const visibleSelectedIds = useMemo(() => {
    if (selectedIds.size === 0) return selectedIds
    const visible = new Set(ordered.map(t => t.id))
    const filtered = [...selectedIds].filter(id => visible.has(id))
    return filtered.length === selectedIds.size ? selectedIds : new Set(filtered)
  }, [selectedIds, ordered])

  function handleRowClick(e: React.MouseEvent, tr: Transaction) {
    if (tr.proStatus === 'VIREMENT_INTERNE') return
    if (e.shiftKey && anchorId != null) {
      const ids = ordered.map(t => t.id)
      const from = ids.indexOf(anchorId)
      const to = ids.indexOf(tr.id)
      if (from === -1 || to === -1) return
      const [lo, hi] = from < to ? [from, to] : [to, from]
      const rangeIds = ordered.slice(lo, hi + 1)
        .filter(t => t.proStatus !== 'VIREMENT_INTERNE')
        .map(t => t.id)
      setSelectedIds(new Set(rangeIds))
    } else if (e.metaKey || e.ctrlKey) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(tr.id)) next.delete(tr.id)
        else next.add(tr.id)
        return next
      })
      setAnchorId(tr.id)
    } else {
      setSelectedIds(new Set([tr.id]))
      setAnchorId(tr.id)
    }
  }

  // Right-clicking a row outside the current selection replaces it, mirroring how a
  // desktop file manager treats a right-click on an unselected item.
  function handleRowContextMenu(tr: Transaction) {
    if (!visibleSelectedIds.has(tr.id)) {
      setSelectedIds(new Set([tr.id]))
      setAnchorId(tr.id)
    }
  }

  function applyQuickClassify(targets: Transaction[], change: QuickClassifyChange) {
    for (const target of targets) {
      if (target.accountId == null) continue
      quickClassify.mutate({
        accountId: target.accountId,
        txId: target.id,
        data: {
          proStatus: change.field === 'status' ? change.proStatus : target.proStatus,
          expenseCategoryId: change.field === 'category' ? change.expenseCategoryId : target.expenseCategoryId,
        },
      })
    }
    setSelectedIds(new Set())
  }

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
    <div className="space-y-3">
      {visibleSelectedIds.size > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-2 text-sm">
          <span className="font-medium">{t('classification.selectedCount', { count: visibleSelectedIds.size })}</span>
          <button
            type="button"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <Card size="sm">
        <CardContent className="space-y-0">
          {sortedDates.map((date, dateIdx) => (
            <div key={date}>
              {dateIdx > 0 && <Separator className="my-3" />}
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                {formatTransactionDate(date, locale)}
              </p>
              <div className="space-y-0.5">
                {grouped[date].map((tr, rowIdx) => {
                  const isSelected = visibleSelectedIds.has(tr.id)
                  const row = (
                    <div
                      onClick={(e) => handleRowClick(e, tr)}
                      onContextMenu={() => handleRowContextMenu(tr)}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-4 py-3 transition-colors select-none',
                        isSelected
                          ? 'bg-primary/15 hover:bg-primary/20'
                          : cn('hover:bg-muted/60', rowIdx % 2 === 0 ? 'bg-muted/20' : 'bg-transparent'),
                        tr.proStatus !== 'VIREMENT_INTERNE' && 'cursor-pointer',
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
                  )
                  if (tr.accountId == null) return <Fragment key={tr.id}>{row}</Fragment>

                  const bulk = isSelected && visibleSelectedIds.size > 1
                  const targets = bulk ? ordered.filter(t => visibleSelectedIds.has(t.id)) : [tr]

                  return (
                    <TransactionContextMenu
                      key={tr.id}
                      transaction={tr}
                      categories={categories}
                      selectionCount={bulk ? visibleSelectedIds.size : 1}
                      onQuickClassify={(change) => applyQuickClassify(targets, change)}
                      onUnlinkTransfer={(txId) => unlinkTransfer.mutate(txId)}
                    >
                      {row}
                    </TransactionContextMenu>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
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
