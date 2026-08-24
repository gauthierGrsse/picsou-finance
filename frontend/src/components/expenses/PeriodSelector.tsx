import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, localeFromLanguage } from '@/lib/utils'

export type PeriodMode = 'month' | 'year'

interface PeriodSelectorProps {
  mode: PeriodMode
  onModeChange: (mode: PeriodMode) => void
  month: string
  onMonthChange: (month: string) => void
  year: number
  onYearChange: (year: number) => void
  minYear: number
  maxYear: number
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Chevron-driven month/year navigator, clicking the label opens a grid to jump further.
 * Deliberately not a native <input type="month"> -- those are unreliable to interact with
 * (inconsistent across browsers, awkward click targets) and don't match the app's own look.
 */
export function PeriodSelector({ mode, onModeChange, month, onMonthChange, year, onYearChange, minYear, maxYear }: PeriodSelectorProps) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => Number(month.split('-')[0]))

  const monthLabel = useMemo(
    () => new Date(`${month}-01`).toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    [month, locale],
  )

  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale, { month: 'short' })),
    [locale],
  )

  function openPicker(isOpen: boolean) {
    if (isOpen) setPickerYear(mode === 'month' ? Number(month.split('-')[0]) : year)
    setOpen(isOpen)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
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

      <div className="flex items-center gap-0.5 rounded-xl border pr-1 pl-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => mode === 'month' ? onMonthChange(shiftMonth(month, -1)) : onYearChange(year - 1)}
          disabled={mode === 'year' && year <= minYear}
          aria-label={t('common.previous')}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <Popover open={open} onOpenChange={openPicker}>
          <PopoverTrigger asChild>
            <button type="button" className="min-w-28 rounded-lg px-2 py-1.5 text-center text-sm font-medium capitalize hover:bg-muted">
              {mode === 'month' ? monthLabel : year}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            {mode === 'month' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setPickerYear(y => y - 1)}>
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <span className="text-sm font-medium">{pickerYear}</span>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setPickerYear(y => y + 1)}>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {monthNames.map((label, i) => {
                    const value = `${pickerYear}-${String(i + 1).padStart(2, '0')}`
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { onMonthChange(value); setOpen(false) }}
                        className={cn(
                          'rounded-lg py-1.5 text-sm capitalize transition-colors',
                          value === month ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).reverse().map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => { onYearChange(y); setOpen(false) }}
                    className={cn(
                      'rounded-lg py-1.5 text-sm transition-colors',
                      y === year ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => mode === 'month' ? onMonthChange(shiftMonth(month, 1)) : onYearChange(year + 1)}
          disabled={mode === 'year' && year >= maxYear}
          aria-label={t('common.next')}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
