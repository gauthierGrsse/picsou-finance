import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { proStatusLabelKey } from '@/lib/constants'
import type { CategoryBreakdownItem } from '@/types/api'

interface CategoryProStatusBreakdownProps {
  data: CategoryBreakdownItem[]
}

/** Ranked list with proportional bars, one row per non-zero (category, pro_status) pair --
 * e.g. "Restauration · Personnel" and "Restauration · Pro absorbé" sit as separate rows.
 * A bar-list reads its own ranking directly, without the reader triangulating angles and a
 * separate legend the way a pie/donut forces them to. */
export function CategoryProStatusBreakdown({ data }: CategoryProStatusBreakdownProps) {
  const { t } = useTranslation()

  const items = useMemo(
    () =>
      data
        .filter((d) => d.total > 0)
        .map((d) => ({
          id: `${d.categoryId ?? 'none'}-${d.proStatus}`,
          name: d.categoryName ?? t('expenseDashboard.uncategorized'),
          statusLabel: t(proStatusLabelKey(d.proStatus)),
          color: d.categoryColor ?? 'var(--chart-5)',
          total: d.total,
        }))
        .sort((a, b) => b.total - a.total),
    [data, t],
  )

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('expenseDashboard.noExpenses')}</p>
  }

  const max = Math.max(...items.map((i) => i.total))

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate font-medium">{item.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{item.statusLabel}</span>
            </span>
            <CurrencyDisplay value={item.total} className="shrink-0 tabular-nums" />
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.total / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
