import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useSuggestedTransfers, useConfirmTransferLink } from '@/features/internalTransfers/hooks'

/**
 * Transaction pairs that look like transfers between the user's own accounts (opposite
 * amounts, close dates) but weren't certain enough for InternalTransferService to
 * auto-link by shared reference. The user confirms each pair explicitly.
 *
 * Self-contained like RealEstateSummaryCard: renders nothing when there's nothing to
 * confirm, rather than leaving a permanently empty card as dashboard filler.
 */
export function SuggestedTransfersCard() {
  const { t } = useTranslation()
  const { data: suggestions, isLoading } = useSuggestedTransfers()
  const confirmLink = useConfirmTransferLink()

  if (isLoading) {
    return (
      <Card size="sm">
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    )
  }

  if (!suggestions || suggestions.length === 0) return null

  return (
    <Card size="sm">
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeftRight className="size-4" />
          {t('internalTransfers.suggestedTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map(({ a, b }) => (
          <div key={`${a.id}-${b.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">{a.description}</span>
                <CurrencyDisplay value={a.amount} currency={a.nativeCurrency} className="shrink-0 tabular-nums" />
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">{b.description}</span>
                <CurrencyDisplay value={b.amount} currency={b.nativeCurrency} className="shrink-0 tabular-nums" />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={confirmLink.isPending}
              onClick={() => confirmLink.mutate({ transactionIdA: a.id, transactionIdB: b.id, allowAmountMismatch: false })}
            >
              <Check className="mr-1.5 size-4" />
              {t('internalTransfers.confirm')}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
