import { useMemo } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { useTranslation } from 'react-i18next'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { formatCurrency, localeFromLanguage } from '@/lib/utils'
import { proStatusLabelKey } from '@/lib/constants'
import type { CategoryBreakdownItem, ProStatus } from '@/types/api'

interface CategoryProStatusBreakdownProps {
  data: CategoryBreakdownItem[]
  onSliceClick?: (item: { categoryId: number | null; proStatus: ProStatus }) => void
}

const chartConfig = {
  total: { label: 'Total' },
} satisfies ChartConfig

/** Donut + compact ranked list, one slice/row per non-zero (category, pro_status) pair --
 * e.g. "Restauration perso" and "Restauration pro_absorbe" render separately. Cell color
 * comes straight from the category's own stored hex, same as Account.color feeding
 * DistributionPie: there are only 5 --chart-N tokens, not enough for an open-ended list. */
export function CategoryProStatusBreakdown({ data, onSliceClick }: CategoryProStatusBreakdownProps) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  const items = useMemo(
    () =>
      data
        .filter((d) => d.total > 0)
        .map((d) => ({
          id: `${d.categoryId ?? 'none'}-${d.proStatus}`,
          categoryId: d.categoryId,
          proStatus: d.proStatus,
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

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[140px] w-[140px] shrink-0">
        <PieChart>
          <ChartTooltip
            isAnimationActive={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, _name, item) => (
                  <div className="flex w-full items-center gap-1.5">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.payload.color }} />
                    <span className="min-w-0 truncate">{item.payload.name}</span>
                    <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
                      {formatCurrency(value as number, 'EUR', locale)}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Pie
            data={items}
            dataKey="total"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={38}
            outerRadius={65}
            paddingAngle={2}
            strokeWidth={0}
            isAnimationActive={false}
            className={onSliceClick ? 'cursor-pointer' : undefined}
            onClick={onSliceClick ? (entry) => {
              const item = (entry as unknown as { payload: typeof items[number] }).payload
              onSliceClick({ categoryId: item.categoryId, proStatus: item.proStatus })
            } : undefined}
          >
            {items.map((item) => (
              <Cell key={item.id} fill={item.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="w-full min-w-0 space-y-1 overflow-y-auto sm:max-h-[140px]">
        {items.map((item) => (
          <div
            key={item.id}
            role={onSliceClick ? 'button' : undefined}
            tabIndex={onSliceClick ? 0 : undefined}
            onClick={onSliceClick ? () => onSliceClick({ categoryId: item.categoryId, proStatus: item.proStatus }) : undefined}
            className={`flex items-center gap-2 rounded-lg text-sm ${onSliceClick ? '-mx-1.5 cursor-pointer px-1.5 py-0.5 transition-colors hover:bg-muted' : ''}`}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="min-w-0 truncate">{item.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{item.statusLabel}</span>
            <CurrencyDisplay value={item.total} className="ml-auto shrink-0 tabular-nums text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  )
}
