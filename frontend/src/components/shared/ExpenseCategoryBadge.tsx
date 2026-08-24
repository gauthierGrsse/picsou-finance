import type { ExpenseCategory } from '@/types/api'

interface ExpenseCategoryBadgeProps {
  categoryId: number | null
  categories: ExpenseCategory[]
  className?: string
}

/** Renders nothing when uncategorized, or when the referenced category no longer
 * exists (deleted since the transaction was tagged -- expenseCategoryId is cleared
 * server-side too, but a stale cached transaction could still carry the old id). */
export function ExpenseCategoryBadge({ categoryId, categories, className }: ExpenseCategoryBadgeProps) {
  const category = categoryId != null ? categories.find(c => c.id === categoryId) : undefined
  if (!category) return null

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0 ${className ?? ''}`}>
      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
      {category.name}
    </span>
  )
}
