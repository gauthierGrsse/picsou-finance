import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { formatCurrency, localeFromLanguage } from '@/lib/utils'
import type { MonthlyExpenseTotal } from '@/types/api'

interface MonthlyExpenseChartProps {
  data: MonthlyExpenseTotal[]
}

const chartConfig = {
  total: {
    label: 'Total',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

/** Bar chart: discrete monthly totals read more clearly as bars than an
 * interpolated line for month-over-month comparison. */
export function MonthlyExpenseChart({ data }: MonthlyExpenseChartProps) {
  const { i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  if (data.length === 0) return null

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          width={45}
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number, 'EUR', locale)} />}
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
