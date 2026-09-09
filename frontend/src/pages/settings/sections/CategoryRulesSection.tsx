import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatApiError } from '@/lib/errors'
import { PRO_STATUS_OPTIONS } from '@/lib/constants'
import {
  useCategoryRules,
  useCreateCategoryRule,
  useUpdateCategoryRule,
  useDeleteCategoryRule,
} from '@/features/categoryRules/hooks'
import { useExpenseCategories } from '@/features/expenseCategories/hooks'
import type { CategoryRule, ProStatus } from '@/types/api'

const selectClassName = "flex h-10 items-center rounded-xl border border-input bg-background text-foreground px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"

/**
 * "If the description contains X, classify it as category Y" (and optionally set a status).
 * Applied automatically to new synced transactions, and retroactively to existing
 * uncategorized ones the moment a rule is saved -- never to one that already has a category.
 */
export function CategoryRulesSection() {
  const { t } = useTranslation()
  const { data: rules, isLoading } = useCategoryRules()
  const { data: categories } = useExpenseCategories()
  const createRule = useCreateCategoryRule()
  const updateRule = useUpdateCategoryRule()
  const deleteRule = useDeleteCategoryRule()

  const [editing, setEditing] = useState<CategoryRule | 'new' | null>(null)
  const [pattern, setPattern] = useState('')
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(null)
  const [proStatus, setProStatus] = useState<ProStatus | ''>('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  function openCreate() {
    setPattern('')
    setExpenseCategoryId(categories?.[0]?.id ?? null)
    setProStatus('')
    createRule.reset()
    setEditing('new')
  }

  function openEdit(rule: CategoryRule) {
    setPattern(rule.pattern)
    setExpenseCategoryId(rule.expenseCategoryId)
    setProStatus(rule.proStatus ?? '')
    updateRule.reset()
    setEditing(rule)
  }

  const mutation = editing === 'new' ? createRule : updateRule
  const canSubmit = !!pattern.trim() && expenseCategoryId != null && !mutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = pattern.trim()
    if (!trimmed || expenseCategoryId == null) return
    const data = { pattern: trimmed, expenseCategoryId, proStatus: proStatus || null }
    if (editing === 'new') {
      createRule.mutate(data, { onSuccess: () => setEditing(null) })
    } else if (editing) {
      updateRule.mutate({ id: editing.id, data }, { onSuccess: () => setEditing(null) })
    }
  }

  function handleDelete() {
    if (deletingId == null) return
    deleteRule.mutate(deletingId, { onSuccess: () => setDeletingId(null) })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="w-full sm:w-auto" disabled={!categories || categories.length === 0}>
          <Plus className="size-4" />
          {t('categoryRules.newRule')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('categoryRules.loading')}</p>
      ) : !rules || rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('categoryRules.empty')}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rules.map(rule => (
            <li key={rule.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate rounded-md bg-muted px-1.5 py-0.5 font-mono">{rule.pattern}</span>
                <span className="shrink-0 text-muted-foreground">→</span>
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: rule.categoryColor ?? 'var(--chart-5)' }} />
                <span className="min-w-0 truncate font-medium">{rule.categoryName}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeletingId(rule.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? t('categoryRules.newRule') : t('categoryRules.editRule')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cr-pattern">{t('categoryRules.patternLabel')}</Label>
              <Input
                id="cr-pattern"
                value={pattern}
                onChange={e => setPattern(e.target.value)}
                placeholder={t('categoryRules.patternPlaceholder')}
                maxLength={200}
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">{t('categoryRules.patternHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-category">{t('categoryRules.categoryLabel')}</Label>
              <select
                id="cr-category"
                value={expenseCategoryId ?? ''}
                onChange={e => setExpenseCategoryId(e.target.value ? Number(e.target.value) : null)}
                className={selectClassName}
                required
              >
                {(categories ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-status">{t('categoryRules.statusLabel')}</Label>
              <select
                id="cr-status"
                value={proStatus}
                onChange={e => setProStatus(e.target.value as ProStatus | '')}
                className={selectClassName}
              >
                <option value="">{t('categoryRules.noStatusChange')}</option>
                {PRO_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>
            {mutation.isError && (
              <p role="alert" className="text-sm text-destructive">
                {formatApiError(mutation.error, t, 'categoryRules.error')}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {editing === 'new' ? t('common.create') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => { if (!o) { setDeletingId(null); deleteRule.reset() } }}
        title={t('categoryRules.deleteTitle')}
        description={t('categoryRules.deleteDescription')}
        onConfirm={handleDelete}
        loading={deleteRule.isPending}
        error={deleteRule.isError ? formatApiError(deleteRule.error, t) : undefined}
        variant="destructive"
      />
    </div>
  )
}
