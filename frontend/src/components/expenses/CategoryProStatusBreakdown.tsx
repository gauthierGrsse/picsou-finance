import { useMemo } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { useTranslation } from 'react-i18next'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { formatCurrency, localeFromLanguage } from '@/lib/utils'
import { proStatusLabelKey } from '@/lib/constants'
import type { CategoryBreakdownItem } from '@/types/api'

interface CategoryProStatusBreakdownProps {
  data: CategoryBreakdownItem[]
}

const chartConfig = {
  total: { label: 'Total' },
} satisfies ChartConfig

/** One slice per non-zero (category, pro_status) pair -- e.g. "Restauration perso" and
 * "Restauration pro_absorbe" render as separate slices. Cell color comes straight from the
 * category's own stored hex, same as Account.color feeding DistributionPie: there are only
 * 5 --chart-N tokens, not enough for an open-ended category list. */
export function CategoryProStatusBreakdown({ data }: CategoryProStatusBreakdownProps) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  const items = useMemo(
    () =>
      data
        .filter((d) => d.total > 0)
        .map((d) => ({
          id: `${d.categoryId ?? 'none'}-${d.proStatus}`,
          name: `${d.categoryName ?? t('expenseDashboard.uncategorized')} · ${t(proStatusLabelKey(d.proStatus))}`,
          color: d.categoryColor ?? 'var(--chart-5)',
          total: d.total,
        })),
    [data, t],
  )

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('expenseDashboard.noExpenses')}</p>
  }

  return (
    <div>
      <ChartContainer config={chartConfig} className="mx-auto h-[240px] w-full">
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent hideLabel formatter={(value) => formatCurrency(value as number, 'EUR', locale)} />}
          />
          <Pie data={items} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
            {items.map((item) => (
              <Cell key={item.id} fill={item.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate">{item.name}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">{formatCurrency(item.total, 'EUR', locale)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
