import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { cn, formatCurrency, formatLocalDate, getLocale } from '@/lib/utils'
import { extractErrorMessage } from '@/lib/errors'
import { useTransferCandidates, useConfirmTransferLink } from '@/features/internalTransfers/hooks'
import type { Transaction } from '@/types/api'

const selectClassName = "flex h-10 items-center rounded-xl border border-input bg-background text-foreground px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"

interface InternalTransferLinkModalProps {
  transaction: Transaction | null
  onOpenChange: (open: boolean) => void
}

/**
 * Manually links `transaction` to a matching transaction on another account. Searchable by
 * description and account rather than a single narrow dropdown -- a wire to a brokerage
 * account, for instance, can land there for a different figure than it left as (fees, FX),
 * so exact-amount candidates are only the default sort order, not the only ones offered.
 * Picking a non-matching amount requires an explicit warning confirmation, since the server
 * only skips its own amount check when the request says the mismatch was intentional.
 */
export function InternalTransferLinkModal({ transaction, onOpenChange }: InternalTransferLinkModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={transaction !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('internalTransfers.linkTitle')}</DialogTitle>
        </DialogHeader>
        {transaction && <InternalTransferLinkForm key={transaction.id} transaction={transaction} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  )
}

function InternalTransferLinkForm({ transaction, onOpenChange }: { transaction: Transaction; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const locale = getLocale()
  const { data: candidates } = useTransferCandidates()
  const confirmLink = useConfirmTransferLink()

  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState<'all' | number>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingMismatch, setConfirmingMismatch] = useState(false)

  const pool = useMemo(
    () => (candidates ?? []).filter(c => c.id !== transaction.id && c.accountId !== transaction.accountId),
    [candidates, transaction],
  )

  const accounts = useMemo(() => {
    const byId = new Map<number, string>()
    for (const c of pool) {
      if (c.accountId != null && c.accountName) byId.set(c.accountId, c.accountName)
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [pool])

  const filtered = useMemo(() => {
    const bySearch = search
      ? pool.filter(c => c.description.toLowerCase().includes(search.toLowerCase()))
      : pool
    const byAccount = accountFilter === 'all' ? bySearch : bySearch.filter(c => c.accountId === accountFilter)

    const sourceDate = new Date(transaction.date).getTime()
    return [...byAccount].sort((a, b) => {
      const aExact = a.amount === -transaction.amount
      const bExact = b.amount === -transaction.amount
      if (aExact !== bExact) return aExact ? -1 : 1
      return Math.abs(new Date(a.date).getTime() - sourceDate) - Math.abs(new Date(b.date).getTime() - sourceDate)
    })
  }, [pool, search, accountFilter, transaction])

  const selected = filtered.find(c => c.id === selectedId) ?? null
  const isExactMatch = selected ? selected.amount === -transaction.amount : true

  async function doLink(allowAmountMismatch: boolean) {
    if (!selectedId) return
    setError(null)
    try {
      await confirmLink.mutateAsync({ transactionIdA: transaction.id, transactionIdB: selectedId, allowAmountMismatch })
      onOpenChange(false)
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    if (!isExactMatch) {
      setConfirmingMismatch(true)
      return
    }
    doLink(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-xl border p-2.5 text-sm">
          <span className="min-w-0 truncate text-muted-foreground">{transaction.description}</span>
          <CurrencyDisplay value={transaction.amount} currency={transaction.nativeCurrency} className="shrink-0 tabular-nums" />
        </div>

        <div className="flex gap-2">
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          {accounts.length > 1 && (
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className={cn(selectClassName, 'w-auto shrink-0')}
            >
              <option value="all">{t('internalTransfers.allAccounts')}</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>

        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('internalTransfers.noCandidates')}</p>
          ) : (
            filtered.map(c => {
              const exact = c.amount === -transaction.amount
              const checked = c.id === selectedId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm transition-colors',
                    checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded border',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.description}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.accountName} · {formatLocalDate(c.date, locale)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <CurrencyDisplay value={c.amount} currency={c.nativeCurrency} className="tabular-nums" />
                    {!exact && (
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        {t('internalTransfers.amountMismatch')}
                      </span>
                    )}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={!selectedId || confirmLink.isPending}>
            {confirmLink.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('internalTransfers.confirm')}
          </Button>
        </DialogFooter>
      </form>

      <ConfirmDialog
        open={confirmingMismatch}
        onOpenChange={setConfirmingMismatch}
        title={t('internalTransfers.mismatchWarningTitle')}
        description={selected ? t('internalTransfers.mismatchWarningDescription', {
          amountA: formatCurrency(transaction.amount, transaction.nativeCurrency, locale),
          amountB: formatCurrency(selected.amount, selected.nativeCurrency, locale),
        }) : ''}
        confirmLabel={t('internalTransfers.confirm')}
        variant="default"
        loading={confirmLink.isPending}
        onConfirm={() => { setConfirmingMismatch(false); doLink(true) }}
      />
    </>
  )
}
