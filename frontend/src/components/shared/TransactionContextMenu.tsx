import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, Check, Unlink } from 'lucide-react'
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
import { buildCategoryTree, categoryTypeMatchesAmount, PRO_STATUS_OPTIONS } from '@/lib/constants'
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
  onLinkTransfer?: (tx: Transaction) => void
  /** > 1 when this menu acts on a multi-row selection rather than just `transaction` --
   * drops the per-transaction checkmarks (no single "current" value across many rows). */
  selectionCount?: number
  children: React.ReactNode
}

/**
 * Right-click a transaction row to set its status or category in one click, instead of
 * opening the full classification modal for a single-field change. An internal-transfer
 * row gets Unlink instead -- its status is a pair, not something to reassign one-sided
 * through the classification endpoint (that would leave the two legs out of sync). Link
 * (the reverse direction) only makes sense for a single row, not a bulk selection.
 */
export function TransactionContextMenu({ transaction, categories, onQuickClassify, onUnlinkTransfer, onLinkTransfer, selectionCount = 1, children }: TransactionContextMenuProps) {
  const { t } = useTranslation()
  const isBulk = selectionCount > 1
  // Filtered by the right-clicked row's own sign, even in bulk mode -- consistent with
  // status/category checkmarks above, which already treat `transaction` as the reference
  // row rather than trying to reconcile a mixed-sign selection.
  const applicableCategories = categories.filter(c => categoryTypeMatchesAmount(c.type, transaction.amount))
  const categoryTree = buildCategoryTree(applicableCategories)

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
            {!isBulk && onLinkTransfer && (
              <>
                <ContextMenuItem onClick={() => onLinkTransfer(transaction)}>
                  <ArrowLeftRight className="size-4" />
                  {t('internalTransfers.linkTitle')}
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
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
                {categoryTree.length > 0 && <ContextMenuSeparator />}
                {categoryTree.map(({ category, children: subcategories }) =>
                  subcategories.length === 0 ? (
                    <CategoryMenuItem
                      key={category.id}
                      category={category}
                      selected={!isBulk && transaction.expenseCategoryId === category.id}
                      onSelect={() => onQuickClassify({ field: 'category', expenseCategoryId: category.id })}
                    />
                  ) : (
                    <ContextMenuSub key={category.id}>
                      <ContextMenuSubTrigger>
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                        <span className="min-w-0 truncate">{category.name}</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        <CategoryMenuItem
                          category={category}
                          selected={!isBulk && transaction.expenseCategoryId === category.id}
                          onSelect={() => onQuickClassify({ field: 'category', expenseCategoryId: category.id })}
                        />
                        <ContextMenuSeparator />
                        {subcategories.map(sub => (
                          <CategoryMenuItem
                            key={sub.id}
                            category={sub}
                            selected={!isBulk && transaction.expenseCategoryId === sub.id}
                            onSelect={() => onQuickClassify({ field: 'category', expenseCategoryId: sub.id })}
                          />
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  ),
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function CategoryMenuItem({ category, selected, onSelect }: { category: ExpenseCategory; selected: boolean; onSelect: () => void }) {
  return (
    <ContextMenuItem onClick={onSelect}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
      <span className="min-w-0 truncate">{category.name}</span>
      {selected && <Check className="ml-auto size-3.5 shrink-0" />}
    </ContextMenuItem>
  )
}
