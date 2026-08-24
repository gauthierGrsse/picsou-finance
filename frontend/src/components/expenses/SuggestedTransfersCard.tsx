import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { formatLocalDate } from '@/lib/utils'
import { useSuggestedTransfers, useConfirmTransferLink } from '@/features/internalTransfers/hooks'

/**
 * Transaction pairs that look like transfers between the user's own accounts (opposite
 * amounts, close dates) but weren't certain enough for InternalTransferService to
 * auto-link by shared reference. The user confirms each pair explicitly.
 */
export function SuggestedTransfersCard() {
  const { t } = useTranslation()
  const { data: suggestions, isLoading } = useSuggestedTransfers()
  const confirmLink = useConfirmTransferLink()

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('internalTransfers.loading')}</p>
  if (!suggestions || suggestions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('internalTransfers.empty')}</p>
  }

  return (
    <div className="space-y-3">
      {suggestions.map(({ a, b }) => (
        <div key={`${a.id}-${b.id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">{a.description}</span>
              <CurrencyDisplay value={a.amount} currency={a.nativeCurrency} className="shrink-0 tabular-nums" />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">{b.description}</span>
              <CurrencyDisplay value={b.amount} currency={b.nativeCurrency} className="shrink-0 tabular-nums" />
            </div>
            <p className="text-xs text-muted-foreground">{formatLocalDate(a.date)}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={confirmLink.isPending}
            onClick={() => confirmLink.mutate({ transactionIdA: a.id, transactionIdB: b.id })}
          >
            <Check className="mr-1.5 size-4" />
            {t('internalTransfers.confirm')}
          </Button>
        </div>
      ))}
    </div>
  )
}
