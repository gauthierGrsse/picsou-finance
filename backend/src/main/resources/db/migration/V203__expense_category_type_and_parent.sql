-- Two independent, additive dimensions on expense_category:
--   type      -- which side of the ledger this category makes sense for, so the
--               transaction context menu can stop showing "Restauration" when
--               categorizing a salary credit. Defaults to BOTH so every existing
--               category keeps showing up everywhere until narrowed by hand.
--   parent_id -- one level of subcategory nesting (a parent may not itself have a
--               parent -- enforced in ExpenseCategoryService, not the DB, since a
--               CHECK constraint can't see other rows). ON DELETE SET NULL: deleting
--               a parent promotes its children to top-level rather than deleting them.

ALTER TABLE expense_category
  ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'BOTH'
    CONSTRAINT ck_expense_category_type CHECK (type IN ('EXPENSE', 'INCOME', 'BOTH')),
  ADD COLUMN parent_id BIGINT REFERENCES expense_category(id) ON DELETE SET NULL;

CREATE INDEX idx_expense_category_parent ON expense_category(parent_id)
  WHERE parent_id IS NOT NULL;
