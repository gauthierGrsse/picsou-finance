import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ReimbursementLinkModal } from '@/components/shared/ReimbursementLinkModal'
import { usePendingReimbursements } from '@/features/reimbursements/hooks'

/** Pending PRO_A_REMBOURSER expenses not yet settled, with the total owed and the entry
 * point to link a new reimbursement. */
export function PendingReimbursementsCard() {
  const { t } = useTranslation()
  const { data: pending, isLoading } = usePendingReimbursements()
  const [linkModalOpen, setLinkModalOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{t('expenseDashboard.totalOwedLabel')}</p>
          <CurrencyDisplay value={pending?.totalOwed ?? 0} className="text-2xl font-bold" />
        </div>
        <Button size="sm" onClick={() => setLinkModalOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          {t('reimbursements.linkTitle')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('reimbursements.loading')}</p>
      ) : !pending || pending.expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('reimbursements.noPendingExpenses')}</p>
      ) : (
        <div className="space-y-1">
          {pending.expenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">{expense.description}</span>
              <CurrencyDisplay value={expense.amount} currency={expense.nativeCurrency} className="shrink-0 tabular-nums" />
            </div>
          ))}
        </div>
      )}

      <ReimbursementLinkModal open={linkModalOpen} onOpenChange={setLinkModalOpen} />
    </div>
  )
}
