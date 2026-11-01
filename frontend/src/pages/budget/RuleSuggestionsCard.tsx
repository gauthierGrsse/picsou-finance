import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Sparkles, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCreateRule } from '@/features/budget/hooks'
import {
  RULE_SUGGESTIONS_KEY,
  useDismissRuleSuggestion,
  useRuleSuggestions,
} from '@/features/ruleSuggestions/hooks'
import type { CategoryRuleSuggestion } from '@/types/api'

/**
 * Rules worth adopting, mined from how the member has already filed their own transactions:
 * a word that keeps landing in one category. Adopting one creates an ordinary categorization
 * rule; dismissing it keeps it from coming back. Renders nothing until there is something to
 * suggest.
 */
export function RuleSuggestionsCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: suggestions } = useRuleSuggestions()
  const createRule = useCreateRule()
  const dismiss = useDismissRuleSuggestion()

  if (!suggestions || suggestions.length === 0) return null

  function accept(s: CategoryRuleSuggestion) {
    createRule.mutate(
      { matchType: 'KEYWORD', pattern: s.pattern, categoryId: s.categoryId },
      // A pattern that just became a rule drops out of the suggestions.
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: RULE_SUGGESTIONS_KEY }) },
    )
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Sparkles className="size-4 text-muted-foreground" />
          {t('ruleSuggestions.title')}
        </CardTitle>
        <CardDescription>{t('ruleSuggestions.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map(s => (
          <div key={s.pattern} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate rounded-md bg-muted px-1.5 py-0.5 font-mono">{s.pattern}</span>
              <span className="shrink-0 text-muted-foreground">→</span>
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.categoryColor }} />
              <span className="font-medium">{s.categoryName}</span>
              <span className="text-xs text-muted-foreground">
                {t('ruleSuggestions.basis', { count: s.matchingCategorized })}
                {s.matchingUncategorized > 0 && ` · ${t('ruleSuggestions.wouldCatch', { count: s.matchingUncategorized })}`}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="outline" disabled={createRule.isPending} onClick={() => accept(s)}>
                <Check className="mr-1 size-3.5" />
                {t('ruleSuggestions.accept')}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('ruleSuggestions.dismiss')}
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate(s.pattern)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
