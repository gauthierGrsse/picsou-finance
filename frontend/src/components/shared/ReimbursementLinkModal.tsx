import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractErrorMessage } from '@/lib/errors'
import { useCandidateCredits, useCreateReimbursement, usePendingReimbursements } from '@/features/reimbursements/hooks'
import type { Transaction } from '@/types/api'

const selectControlClassName = "flex h-10 w-full rounded-xl border border-input bg-background text-foreground px-4 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"

interface ReimbursementLinkModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Links one credit transaction (an incoming transfer) to one or more pending
 * PRO_A_REMBOURSER expenses it settles -- e.g. a monthly expense report reimbursing
 * several meals at once. Many expenses -> one credit, not a strict 1-for-1.
 */
export function ReimbursementLinkModal({ open, onOpenChange }: ReimbursementLinkModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('reimbursements.linkTitle')}</DialogTitle>
        </DialogHeader>
        {open && <ReimbursementLinkForm onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  )
}

function ExpenseToggle({ expense, checked, onToggle }: { expense: Transaction; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors',
        checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded border',
            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
          )}
          aria-hidden
        >
          {checked && <Check className="size-3" />}
        </span>
        <span className="truncate">{expense.description}</span>
      </span>
      <CurrencyDisplay value={expense.amount} currency={expense.nativeCurrency} className="shrink-0 tabular-nums" />
    </button>
  )
}

function ReimbursementLinkForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { data: candidates } = useCandidateCredits()
  const { data: pending } = usePendingReimbursements()
  const createReimbursement = useCreateReimbursement()

  const [creditId, setCreditId] = useState('')
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const selectedTotal = useMemo(
    () => (pending?.expenses ?? [])
      .filter(e => selectedExpenseIds.includes(e.id))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0),
    [pending, selectedExpenseIds],
  )

  function toggleExpense(id: number) {
    setSelectedExpenseIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!creditId || selectedExpenseIds.length === 0) return
    try {
      await createReimbursement.mutateAsync({
        creditTransactionId: Number(creditId),
        expenseTransactionIds: selectedExpenseIds,
      })
      onOpenChange(false)
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')))
    }
  }

  const canSubmit = !!creditId && selectedExpenseIds.length > 0 && !createReimbursement.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label>{t('reimbursements.creditLabel')}</Label>
        <select value={creditId} onChange={e => setCreditId(e.target.value)} className={selectControlClassName} required>
          <option value="">{t('reimbursements.creditPlaceholder')}</option>
          {(candidates ?? []).map(tx => (
            <option key={tx.id} value={tx.id}>
              {tx.description} — {tx.amount.toFixed(2)} {tx.nativeCurrency}
            </option>
          ))}
        </select>
        {candidates && candidates.length === 0 && (
          <p className="text-xs text-muted-foreground">{t('reimbursements.noCandidateCredits')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>{t('reimbursements.expensesLabel')}</Label>
        {!pending || pending.expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('reimbursements.noPendingExpenses')}</p>
        ) : (
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {pending.expenses.map(expense => (
              <ExpenseToggle
                key={expense.id}
                expense={expense}
                checked={selectedExpenseIds.includes(expense.id)}
                onToggle={() => toggleExpense(expense.id)}
              />
            ))}
          </div>
        )}
        {selectedExpenseIds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('reimbursements.selectedTotal')}: <CurrencyDisplay value={selectedTotal} className="font-medium text-foreground" />
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={!canSubmit}>
          {createReimbursement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('reimbursements.link')}
        </Button>
      </DialogFooter>
    </form>
  )
}
