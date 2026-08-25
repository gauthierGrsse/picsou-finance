import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, HandCoins } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ReimbursementLinkModal } from '@/components/shared/ReimbursementLinkModal'
import { usePendingReimbursements } from '@/features/reimbursements/hooks'

/** Pending PRO_A_REMBOURSER expenses not yet settled, with the total owed and the entry
 * point to link a new reimbursement. Always visible -- the "link" action is a primary
 * entry point regardless of whether anything is currently pending. */
export function PendingReimbursementsCard() {
  const { t } = useTranslation()
  const { data: pending, isLoading } = usePendingReimbursements()
  const [linkModalOpen, setLinkModalOpen] = useState(false)

  return (
    <Card size="sm">
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <HandCoins className="size-4" />
          {t('expenseDashboard.pendingReimbursementsTitle')}
        </CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => setLinkModalOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            {t('reimbursements.linkTitle')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <>
            <CurrencyDisplay value={pending?.totalOwed ?? 0} className="text-2xl font-bold" />
            {!pending || pending.expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('reimbursements.noPendingExpenses')}</p>
            ) : (
              <div className="space-y-1.5">
                {pending.expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">{expense.description}</span>
                    <CurrencyDisplay value={expense.amount} currency={expense.nativeCurrency} className="shrink-0 tabular-nums" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <ReimbursementLinkModal open={linkModalOpen} onOpenChange={setLinkModalOpen} />
    </Card>
  )
}
