import { describe, expect, it } from 'vitest'
import { ACCOUNT_TYPES, accountTypeLabelKey, buildCategoryTree, categoryTypeMatchesAmount } from './constants'
import type { AccountType, ExpenseCategory } from '@/types/api'
import fr from '@/i18n/locales/fr.json'
import en from '@/i18n/locales/en.json'
import de from '@/i18n/locales/de.json'
import es from '@/i18n/locales/es.json'

/**
 * Every value of the `AccountType` union, restated so the compiler checks each literal and the
 * assertion below catches a type added to the union without an entry in ACCOUNT_TYPES — which is
 * what makes ACCOUNT_TYPES the single list every label lookup can rely on.
 */
const EVERY_TYPE: AccountType[] = [
  'CHECKING', 'SAVINGS', 'LEP', 'LIVRET_A', 'LDDS', 'LIVRET_JEUNE', 'PEL', 'CEL',
  'PEA', 'COMPTE_TITRES', 'CRYPTO', 'REAL_ESTATE', 'EMPLOYEE_SAVINGS', 'LOAN', 'OTHER',
]

const LOCALES = { fr, en, de, es } as Record<string, { accountTypes: Record<string, string> }>

describe('account type labels', () => {
  it('covers every account type exactly once', () => {
    expect(ACCOUNT_TYPES.map((t) => t.value).sort()).toEqual([...EVERY_TYPE].sort())
  })

  it.each(Object.keys(LOCALES))('resolves every label in %s', (locale) => {
    // The bug this pins: a component deriving its own key (`accountTypes.${type.toLowerCase()}`
    // → "accountTypes.livret_a") rendered the raw key next to the account name. Every call site
    // now goes through accountTypeLabelKey, so the keys it returns must all exist.
    const missing = EVERY_TYPE.filter(
      (type) => !(accountTypeLabelKey(type).replace('accountTypes.', '') in LOCALES[locale].accountTypes),
    )
    expect(missing).toEqual([])
  })

  it('falls back to Other for a value outside the list', () => {
    expect(accountTypeLabelKey('NOT_A_TYPE' as AccountType)).toBe('accountTypes.other')
  })
})

describe('categoryTypeMatchesAmount', () => {
  it('BOTH always matches, regardless of sign', () => {
    expect(categoryTypeMatchesAmount('BOTH', -10)).toBe(true)
    expect(categoryTypeMatchesAmount('BOTH', 10)).toBe(true)
  })

  it('EXPENSE only matches negative amounts', () => {
    expect(categoryTypeMatchesAmount('EXPENSE', -10)).toBe(true)
    expect(categoryTypeMatchesAmount('EXPENSE', 10)).toBe(false)
  })

  it('INCOME only matches non-negative amounts', () => {
    expect(categoryTypeMatchesAmount('INCOME', 10)).toBe(true)
    expect(categoryTypeMatchesAmount('INCOME', 0)).toBe(true)
    expect(categoryTypeMatchesAmount('INCOME', -10)).toBe(false)
  })
})

describe('buildCategoryTree', () => {
  function cat(overrides: Partial<ExpenseCategory>): ExpenseCategory {
    return { id: 1, name: 'cat', color: '#000000', type: 'BOTH', parentId: null, monthlyBudget: null, ...overrides }
  }

  it('groups subcategories under their top-level parent', () => {
    const categories = [
      cat({ id: 1, name: 'Alimentation' }),
      cat({ id: 2, name: 'Courses', parentId: 1 }),
      cat({ id: 3, name: 'Restaurant', parentId: 1 }),
      cat({ id: 4, name: 'Transport' }),
    ]

    const tree = buildCategoryTree(categories)

    expect(tree.map(n => n.category.name)).toEqual(['Alimentation', 'Transport'])
    expect(tree[0].children.map(c => c.name)).toEqual(['Courses', 'Restaurant'])
    expect(tree[1].children).toEqual([])
  })

  it('promotes a category to top-level when its declared parent is missing from the list', () => {
    const categories = [cat({ id: 2, name: 'Orphan', parentId: 999 })]

    const tree = buildCategoryTree(categories)

    expect(tree.map(n => n.category.name)).toEqual(['Orphan'])
  })
})
