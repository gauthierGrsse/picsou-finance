-- Optional, purely informational soft budget per category -- shown as progress on the
-- expense-dashboard pace card, nothing enforces or blocks spending past it. Null (the
-- default) means no budget set, same "opt-in, nothing changes for existing data" pattern
-- as V84's type/parent_id columns.

ALTER TABLE expense_category
  ADD COLUMN monthly_budget NUMERIC(12, 2)
    CONSTRAINT ck_expense_category_monthly_budget CHECK (monthly_budget IS NULL OR monthly_budget > 0);
