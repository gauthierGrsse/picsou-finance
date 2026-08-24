import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
 * losing the underlying transactions.
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

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('reimbursements.loading')}</p>
  if (!reimbursements || reimbursements.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('reimbursements.emptyList')}</p>
  }

  return (
    <div className="space-y-3">
      {reimbursements.map(r => (
        <div key={r.id} className="space-y-2 rounded-xl border p-3">
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
          <div className="space-y-1 border-t pt-2">
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
    </div>
  )
}
