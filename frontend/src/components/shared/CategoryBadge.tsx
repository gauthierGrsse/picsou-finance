import type { Category } from '@/types/api'

interface CategoryBadgeProps {
  categoryId?: number | null
  categories: Category[]
  className?: string
}

/** Renders nothing when uncategorized, or when the referenced category isn't in the list
 * (a stale cached transaction can still carry the id of a category archived since). */
export function CategoryBadge({ categoryId, categories, className }: CategoryBadgeProps) {
  const category = categoryId != null ? categories.find(c => c.id === categoryId) : undefined
  if (!category) return null

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0 ${className ?? ''}`}>
      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: category.color ?? 'var(--chart-5)' }} />
      {category.name}
    </span>
  )
}
