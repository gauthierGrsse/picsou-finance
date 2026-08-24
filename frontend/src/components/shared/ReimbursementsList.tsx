import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, X, Link2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatApiError } from '@/lib/errors'
import { formatLocalDate } from '@/lib/utils'
import {
  useReimbursements,
  useUnlinkReimbursementExpense,
  useDeleteReimbursement,
} from '@/features/reimbursements/hooks'

/**
 * Existing credit-to-expenses links, with the ability to unlink a single expense
 * or delete the whole reimbursement -- correcting a mistaken rapprochement without
 * losing the underlying transactions. Self-contained: renders nothing once there are no
 * linked reimbursements to audit, rather than a permanently empty card.
 */
export function ReimbursementsList() {
  const { t } = useTranslation()
  const { data: reimbursements, isLoading } = useReimbursements()
  const unlinkExpense = useUnlinkReimbursementExpense()
  const deleteReimbursement = useDeleteReimbursement()

  const [deletingId, setDeletingId] = useState<number | null>(null)

  function handleDelete() {
    if (deletingId == null) return
    deleteReimbursement.mutate(deletingId, { onSuccess: () => setDeletingId(null) })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    )
  }

  if (!reimbursements || reimbursements.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4" />
          {t('expenseDashboard.linkedReimbursementsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reimbursements.map(r => (
          <div key={r.id} className="space-y-2 rounded-xl bg-muted/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.creditTransaction.description}</p>
                <p className="text-xs text-muted-foreground">{formatLocalDate(r.creditTransaction.date)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CurrencyDisplay value={r.totalLinked} className="text-sm font-semibold tabular-nums" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeletingId(r.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1 border-t border-border/60 pt-2">
              {r.expenses.map(expense => (
                <div key={expense.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">{expense.description}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <CurrencyDisplay value={expense.amount} currency={expense.nativeCurrency} className="tabular-nums" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-destructive"
                      onClick={() => unlinkExpense.mutate({ id: r.id, txId: expense.id })}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => { if (!o) { setDeletingId(null); deleteReimbursement.reset() } }}
        title={t('reimbursements.deleteTitle')}
        description={t('reimbursements.deleteDescription')}
        onConfirm={handleDelete}
        loading={deleteReimbursement.isPending}
        error={deleteReimbursement.isError ? formatApiError(deleteReimbursement.error, t) : undefined}
        variant="destructive"
      />
    </Card>
  )
}
