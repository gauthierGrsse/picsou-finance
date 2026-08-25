import { useTranslation } from 'react-i18next'
import { Check, Unlink } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { PRO_STATUS_OPTIONS } from '@/lib/constants'
import type { ExpenseCategory, ProStatus, Transaction, TransactionClassificationRequest } from '@/types/api'

interface TransactionContextMenuProps {
  transaction: Transaction
  categories: ExpenseCategory[]
  onQuickClassify: (data: TransactionClassificationRequest) => void
  onUnlinkTransfer?: (txId: number) => void
  children: React.ReactNode
}

/**
 * Right-click a transaction row to set its status or category in one click, instead of
 * opening the full classification modal for a single-field change. An internal-transfer
 * row gets Unlink instead -- its status is a pair, not something to reassign one-sided
 * through the classification endpoint (that would leave the two legs out of sync).
 */
export function TransactionContextMenu({ transaction, categories, onQuickClassify, onUnlinkTransfer, children }: TransactionContextMenuProps) {
  const { t } = useTranslation()

  function setStatus(proStatus: ProStatus) {
    onQuickClassify({ proStatus, expenseCategoryId: transaction.expenseCategoryId })
  }

  function setCategory(expenseCategoryId: number | null) {
    onQuickClassify({ proStatus: transaction.proStatus, expenseCategoryId })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {transaction.proStatus === 'VIREMENT_INTERNE' ? (
          onUnlinkTransfer && (
            <ContextMenuItem onClick={() => onUnlinkTransfer(transaction.id)}>
              <Unlink className="size-4" />
              {t('internalTransfers.unlink')}
            </ContextMenuItem>
          )
        ) : (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>{t('classification.statusLabel')}</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {PRO_STATUS_OPTIONS.map(opt => (
                  <ContextMenuItem key={opt.value} onClick={() => setStatus(opt.value)}>
                    {t(opt.labelKey)}
                    {transaction.proStatus === opt.value && <Check className="ml-auto size-3.5" />}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger>{t('classification.categoryLabel')}</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={() => setCategory(null)}>
                  {t('classification.noCategory')}
                  {transaction.expenseCategoryId == null && <Check className="ml-auto size-3.5" />}
                </ContextMenuItem>
                {categories.length > 0 && <ContextMenuSeparator />}
                {categories.map(c => (
                  <ContextMenuItem key={c.id} onClick={() => setCategory(c.id)}>
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="min-w-0 truncate">{c.name}</span>
                    {transaction.expenseCategoryId === c.id && <Check className="ml-auto size-3.5 shrink-0" />}
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
