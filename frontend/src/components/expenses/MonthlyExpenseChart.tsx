import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { formatCurrency, localeFromLanguage } from '@/lib/utils'
import type { MonthlyExpenseTotal } from '@/types/api'

interface MonthlyExpenseChartProps {
  data: MonthlyExpenseTotal[]
  highlightMonth?: string
}

const chartConfig = {
  total: {
    label: 'Total',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

function compactAxisValue(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** Bar chart: discrete monthly totals read more clearly as bars than an interpolated line
 * for month-over-month comparison. The selected period's bar is highlighted in the full
 * accent color; the rest sit at a quarter opacity so the eye lands on "where you are"
 * first, the trend around it second. */
export function MonthlyExpenseChart({ data, highlightMonth }: MonthlyExpenseChartProps) {
  const { i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  if (data.length === 0) return null

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="yearMonth"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => new Date(`${value}-01`).toLocaleDateString(locale, { month: 'short' })}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={40}
          tickFormatter={(value) => compactAxisValue(value as number, locale)}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number, 'EUR', locale)} />}
        />
        <Bar dataKey="total" radius={5} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell
              key={entry.yearMonth}
              fill="var(--color-total)"
              fillOpacity={highlightMonth && entry.yearMonth !== highlightMonth ? 0.3 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
