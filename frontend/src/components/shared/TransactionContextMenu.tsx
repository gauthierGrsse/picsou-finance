import { useTranslation } from 'react-i18next'
import { Check, Unlink } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { PRO_STATUS_OPTIONS } from '@/lib/constants'
import type { ExpenseCategory, ProStatus, Transaction } from '@/types/api'

/**
 * Only the field that changed, not a full TransactionClassificationRequest -- when this
 * applies to several transactions at once, each keeps its own value for the field that
 * *wasn't* touched (setting status for 3 rows must not blank out categories they already
 * had individually).
 */
export type QuickClassifyChange =
  | { field: 'status'; proStatus: ProStatus }
  | { field: 'category'; expenseCategoryId: number | null }

interface TransactionContextMenuProps {
  transaction: Transaction
  categories: ExpenseCategory[]
  onQuickClassify: (change: QuickClassifyChange) => void
  onUnlinkTransfer?: (txId: number) => void
  /** > 1 when this menu acts on a multi-row selection rather than just `transaction` --
   * drops the per-transaction checkmarks (no single "current" value across many rows). */
  selectionCount?: number
  children: React.ReactNode
}

/**
 * Right-click a transaction row to set its status or category in one click, instead of
 * opening the full classification modal for a single-field change. An internal-transfer
 * row gets Unlink instead -- its status is a pair, not something to reassign one-sided
 * through the classification endpoint (that would leave the two legs out of sync).
 */
export function TransactionContextMenu({ transaction, categories, onQuickClassify, onUnlinkTransfer, selectionCount = 1, children }: TransactionContextMenuProps) {
  const { t } = useTranslation()
  const isBulk = selectionCount > 1

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {!isBulk && transaction.proStatus === 'VIREMENT_INTERNE' ? (
          onUnlinkTransfer && (
            <ContextMenuItem onClick={() => onUnlinkTransfer(transaction.id)}>
              <Unlink className="size-4" />
              {t('internalTransfers.unlink')}
            </ContextMenuItem>
          )
        ) : (
          <>
            {isBulk && <ContextMenuLabel>{t('classification.selectedCount', { count: selectionCount })}</ContextMenuLabel>}
            <ContextMenuSub>
              <ContextMenuSubTrigger>{t('classification.statusLabel')}</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {PRO_STATUS_OPTIONS.map(opt => (
                  <ContextMenuItem key={opt.value} onClick={() => onQuickClassify({ field: 'status', proStatus: opt.value })}>
                    {t(opt.labelKey)}
                    {!isBulk && transaction.proStatus === opt.value && <Check className="ml-auto size-3.5" />}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger>{t('classification.categoryLabel')}</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={() => onQuickClassify({ field: 'category', expenseCategoryId: null })}>
                  {t('classification.noCategory')}
                  {!isBulk && transaction.expenseCategoryId == null && <Check className="ml-auto size-3.5" />}
                </ContextMenuItem>
                {categories.length > 0 && <ContextMenuSeparator />}
                {categories.map(c => (
                  <ContextMenuItem key={c.id} onClick={() => onQuickClassify({ field: 'category', expenseCategoryId: c.id })}>
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="min-w-0 truncate">{c.name}</span>
                    {!isBulk && transaction.expenseCategoryId === c.id && <Check className="ml-auto size-3.5 shrink-0" />}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
