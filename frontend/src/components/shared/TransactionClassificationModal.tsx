import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { extractErrorMessage } from '@/lib/errors'
import { PRO_STATUS_OPTIONS } from '@/lib/constants'
import type { ExpenseCategory, ProStatus, Transaction, TransactionClassificationRequest } from '@/types/api'

const selectControlClassName = "flex h-10 w-full rounded-xl border border-input bg-background text-foreground px-4 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"

interface TransactionClassificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
  categories: ExpenseCategory[]
  onSubmit: (data: TransactionClassificationRequest) => Promise<void>
  isLoading?: boolean
}

/**
 * Sets a transaction's pro_status + expense category. Deliberately separate from
 * AddTransactionModal: that modal edits core fields (date/amount/...) through a path
 * blocked for synced transactions, but classification must work on every transaction --
 * synced ones (e.g. Revolut) are the main case this exists for.
 */
export function TransactionClassificationModal({
  open, onOpenChange, transaction, categories, onSubmit, isLoading,
}: TransactionClassificationModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('classification.title')}</DialogTitle>
        </DialogHeader>
        {/* Remount per transaction so state derives straight from props, no reset effect. */}
        {open && transaction && (
          <ClassificationForm
            key={transaction.id}
            transaction={transaction}
            categories={categories}
            onOpenChange={onOpenChange}
            onSubmit={onSubmit}
            isLoading={isLoading}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface ClassificationFormProps {
  transaction: Transaction
  categories: ExpenseCategory[]
  onOpenChange: (open: boolean) => void
  onSubmit: (data: TransactionClassificationRequest) => Promise<void>
  isLoading?: boolean
}

function ClassificationForm({ transaction, categories, onOpenChange, onSubmit, isLoading }: ClassificationFormProps) {
  const { t } = useTranslation()
  const [proStatus, setProStatus] = useState<ProStatus>(transaction.proStatus)
  const [categoryId, setCategoryId] = useState<string>(
    transaction.expenseCategoryId != null ? String(transaction.expenseCategoryId) : ''
  )
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit({
        proStatus,
        expenseCategoryId: categoryId ? Number(categoryId) : null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="truncate text-sm text-muted-foreground">{transaction.description}</p>

      <div className="space-y-1">
        <Label>{t('classification.statusLabel')}</Label>
        <select
          value={proStatus}
          onChange={e => setProStatus(e.target.value as ProStatus)}
          className={selectControlClassName}
        >
          {PRO_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label>{t('classification.categoryLabel')}</Label>
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className={selectControlClassName}
        >
          <option value="">{t('classification.noCategory')}</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
