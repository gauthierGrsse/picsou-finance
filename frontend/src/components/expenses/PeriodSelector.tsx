import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type PeriodMode = 'month' | 'year'

const inputClassName = "flex h-10 items-center rounded-xl border border-input bg-background text-foreground px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"

interface PeriodSelectorProps {
  mode: PeriodMode
  onModeChange: (mode: PeriodMode) => void
  month: string
  onMonthChange: (month: string) => void
  year: number
  onYearChange: (year: number) => void
  years: number[]
}

/** Lets the expenses dashboard be scoped to one calendar month or one full calendar year. */
export function PeriodSelector({ mode, onModeChange, month, onMonthChange, year, onYearChange, years }: PeriodSelectorProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border p-1">
        {(['month', 'year'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(`expenseDashboard.period.${m}`)}
          </button>
        ))}
      </div>

      {mode === 'month' ? (
        <input
          type="month"
          value={month}
          onChange={e => onMonthChange(e.target.value)}
          className={inputClassName}
        />
      ) : (
        <select value={year} onChange={e => onYearChange(Number(e.target.value))} className={inputClassName}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      )}
    </div>
  )
}
