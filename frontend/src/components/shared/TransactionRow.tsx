import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Transaction } from '@/types/api'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { MerchantAvatar } from '@/components/shared/MerchantAvatar'
import { cn } from '@/lib/utils'
import { transactionDescription } from '@/lib/transactions'

interface TransactionRowProps {
  transaction: Transaction
  logoUrlFor?: (brandId: number | null | undefined) => string | null
  onClick?: (tx: Transaction) => void
  /** Alternating background index — pass the row index from the parent list. */
  index?: number
  /** Extra chips shown beside the label (status, category). */
  badges?: ReactNode
  /** Row actions shown after the amount; clicks on them do not open the row's detail. */
  trailing?: ReactNode
}

export function TransactionRow({ transaction: tx, logoUrlFor, onClick, index = 0, badges, trailing }: TransactionRowProps) {
  const { t } = useTranslation()
  const label = tx.merchantLabel || transactionDescription(tx, t)
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={() => onClick?.(tx)}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick(tx) }}
      className={cn(
        'flex items-center justify-between rounded-xl px-4 py-3 transition-colors',
        onClick ? 'cursor-pointer hover:bg-muted/60' : 'hover:bg-muted/60',
        index % 2 === 0 ? 'bg-muted/20' : 'bg-transparent',
      )}
    >
      <div className="min-w-0 flex-1 flex items-center gap-3">
        <MerchantAvatar
          label={label}
          logoUrl={logoUrlFor?.(tx.merchantBrandId)}
          size="sm"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">
              {label}
            </p>
            {tx.isManual && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">
                Manuel
              </span>
            )}
            {badges}
          </div>
          {(tx.accountName || tx.category) && (
            <p className="text-xs text-muted-foreground px-1.5 py-0.5">
              {[tx.accountName, tx.category].filter(Boolean).join(' — ')}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <CurrencyDisplay
          value={tx.amount}
          currency={tx.nativeCurrency}
          className={cn(
            'ml-4 text-base font-semibold tabular-nums shrink-0',
            tx.amount >= 0 ? 'text-emerald-500' : 'text-foreground',
          )}
        />
        {trailing && (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {trailing}
          </div>
        )}
      </div>
    </div>
  )
}
