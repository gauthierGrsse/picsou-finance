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
import { ColorPicker } from '@/components/shared/ColorPicker'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatApiError } from '@/lib/errors'
import { ACCOUNT_COLORS, buildCategoryTree, CATEGORY_TYPE_OPTIONS } from '@/lib/constants'
import {
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from '@/features/expenseCategories/hooks'
import type { CategoryType, ExpenseCategory } from '@/types/api'

const selectClassName = "flex h-10 items-center rounded-xl border border-input bg-background text-foreground px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"

export function ExpenseCategoriesSection() {
  const { t } = useTranslation()
  const { data: categories, isLoading } = useExpenseCategories()
  const createCategory = useCreateExpenseCategory()
  const updateCategory = useUpdateExpenseCategory()
  const deleteCategory = useDeleteExpenseCategory()

  const [editing, setEditing] = useState<ExpenseCategory | 'new' | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(ACCOUNT_COLORS[0])
  const [type, setType] = useState<CategoryType>('BOTH')
  const [parentId, setParentId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // A parent must itself be top-level (one level of nesting only), and a category can't
  // become its own parent -- same rule the backend enforces, applied here so the dropdown
  // never even offers an invalid choice.
  const availableParents = (categories ?? []).filter(c => c.parentId == null && (editing === 'new' || c.id !== editing?.id))

  function openCreate() {
    setName('')
    setColor(ACCOUNT_COLORS[0])
    setType('BOTH')
    setParentId(null)
    createCategory.reset()
    setEditing('new')
  }

  function openEdit(category: ExpenseCategory) {
    setName(category.name)
    setColor(category.color)
    setType(category.type)
    setParentId(category.parentId)
    updateCategory.reset()
    setEditing(category)
  }

  const mutation = editing === 'new' ? createCategory : updateCategory
  const canSubmit = !!name.trim() && !mutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const data = { name: trimmed, color, type, parentId }
    if (editing === 'new') {
      createCategory.mutate(data, { onSuccess: () => setEditing(null) })
    } else if (editing) {
      updateCategory.mutate({ id: editing.id, data }, { onSuccess: () => setEditing(null) })
    }
  }

  function handleDelete() {
    if (deletingId == null) return
    deleteCategory.mutate(deletingId, { onSuccess: () => setDeletingId(null) })
  }

  const tree = buildCategoryTree(categories ?? [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="size-4" />
          {t('expenseCategories.newCategory')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('expenseCategories.loading')}</p>
      ) : !categories || categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('expenseCategories.empty')}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tree.map(({ category, children }) => (
            <li key={category.id}>
              <CategoryRow category={category} onEdit={openEdit} onDelete={setDeletingId} />
              {children.length > 0 && (
                <ul className="divide-y border-t bg-muted/30">
                  {children.map(child => (
                    <li key={child.id} className="pl-6">
                      <CategoryRow category={child} onEdit={openEdit} onDelete={setDeletingId} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? t('expenseCategories.newCategory') : t('expenseCategories.editCategory')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ec-name">{t('expenseCategories.nameLabel')}</Label>
              <Input
                id="ec-name"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('expenseCategories.colorLabel')}</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ec-type">{t('expenseCategories.typeLabel')}</Label>
                <select
                  id="ec-type"
                  value={type}
                  onChange={e => setType(e.target.value as CategoryType)}
                  className={selectClassName}
                >
                  {CATEGORY_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ec-parent">{t('expenseCategories.parentLabel')}</Label>
                <select
                  id="ec-parent"
                  value={parentId ?? ''}
                  onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)}
                  className={selectClassName}
                >
                  <option value="">{t('expenseCategories.noParent')}</option>
                  {availableParents.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {mutation.isError && (
              <p role="alert" className="text-sm text-destructive">
                {formatApiError(mutation.error, t, 'expenseCategories.error')}
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
        onOpenChange={(o) => { if (!o) { setDeletingId(null); deleteCategory.reset() } }}
        title={t('expenseCategories.deleteTitle')}
        description={t('expenseCategories.deleteDescription')}
        onConfirm={handleDelete}
        loading={deleteCategory.isPending}
        error={deleteCategory.isError ? formatApiError(deleteCategory.error, t) : undefined}
        variant="destructive"
      />
    </div>
  )
}

function CategoryRow({ category, onEdit, onDelete }: { category: ExpenseCategory; onEdit: (c: ExpenseCategory) => void; onDelete: (id: number) => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
        <span className="truncate font-medium">{category.name}</span>
        {category.type !== 'BOTH' && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {t(category.type === 'EXPENSE' ? 'expenseCategories.type.expense' : 'expenseCategories.type.income')}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onEdit(category)}>
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(category.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
