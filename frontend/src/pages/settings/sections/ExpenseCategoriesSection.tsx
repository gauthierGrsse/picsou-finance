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
import { ACCOUNT_COLORS } from '@/lib/constants'
import {
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from '@/features/expenseCategories/hooks'
import type { ExpenseCategory } from '@/types/api'

export function ExpenseCategoriesSection() {
  const { t } = useTranslation()
  const { data: categories, isLoading } = useExpenseCategories()
  const createCategory = useCreateExpenseCategory()
  const updateCategory = useUpdateExpenseCategory()
  const deleteCategory = useDeleteExpenseCategory()

  const [editing, setEditing] = useState<ExpenseCategory | 'new' | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(ACCOUNT_COLORS[0])
  const [deletingId, setDeletingId] = useState<number | null>(null)

  function openCreate() {
    setName('')
    setColor(ACCOUNT_COLORS[0])
    createCategory.reset()
    setEditing('new')
  }

  function openEdit(category: ExpenseCategory) {
    setName(category.name)
    setColor(category.color)
    updateCategory.reset()
    setEditing(category)
  }

  const mutation = editing === 'new' ? createCategory : updateCategory
  const canSubmit = !!name.trim() && !mutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (editing === 'new') {
      createCategory.mutate({ name: trimmed, color }, { onSuccess: () => setEditing(null) })
    } else if (editing) {
      updateCategory.mutate({ id: editing.id, data: { name: trimmed, color } }, { onSuccess: () => setEditing(null) })
    }
  }

  function handleDelete() {
    if (deletingId == null) return
    deleteCategory.mutate(deletingId, { onSuccess: () => setDeletingId(null) })
  }

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
          {categories.map(category => (
            <li key={category.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="truncate font-medium">{category.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeletingId(category.id)}
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
