import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Loader2 } from 'lucide-react'
import { extractErrorMessage } from '@/lib/errors'
import { useTransferCandidates, useConfirmTransferLink } from '@/features/internalTransfers/hooks'
import type { Transaction } from '@/types/api'

const selectControlClassName = "flex h-10 w-full rounded-xl border border-input bg-background text-foreground px-4 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"

interface InternalTransferLinkModalProps {
  transaction: Transaction | null
  onOpenChange: (open: boolean) => void
}

/**
 * Manually links `transaction` to a matching transaction on another account -- e.g. a
 * wire to a brokerage account that settles too late for the automatic suggestions'
 * date window to catch. Only transactions with the exact opposite amount are offered,
 * since InternalTransferService rejects anything else server-side anyway.
 */
export function InternalTransferLinkModal({ transaction, onOpenChange }: InternalTransferLinkModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={transaction !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('internalTransfers.linkTitle')}</DialogTitle>
        </DialogHeader>
        {transaction && <InternalTransferLinkForm transaction={transaction} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  )
}

function InternalTransferLinkForm({ transaction, onOpenChange }: { transaction: Transaction; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { data: candidates } = useTransferCandidates()
  const confirmLink = useConfirmTransferLink()

  const [counterpartId, setCounterpartId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const matches = useMemo(
    () => (candidates ?? []).filter(c => c.id !== transaction.id && c.amount === -transaction.amount),
    [candidates, transaction],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!counterpartId) return
    try {
      await confirmLink.mutateAsync({ transactionIdA: transaction.id, transactionIdB: Number(counterpartId) })
      onOpenChange(false)
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-xl border p-2.5 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">{transaction.description}</span>
        <CurrencyDisplay value={transaction.amount} currency={transaction.nativeCurrency} className="shrink-0 tabular-nums" />
      </div>

      <div className="space-y-1">
        <Label>{t('internalTransfers.counterpartLabel')}</Label>
        <select value={counterpartId} onChange={e => setCounterpartId(e.target.value)} className={selectControlClassName} required>
          <option value="">{t('internalTransfers.counterpartPlaceholder')}</option>
          {matches.map(tx => (
            <option key={tx.id} value={tx.id}>
              {tx.description} — {tx.amount.toFixed(2)} {tx.nativeCurrency}
            </option>
          ))}
        </select>
        {matches.length === 0 && (
          <p className="text-xs text-muted-foreground">{t('internalTransfers.noCandidates')}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={!counterpartId || confirmLink.isPending}>
          {confirmLink.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('internalTransfers.confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
