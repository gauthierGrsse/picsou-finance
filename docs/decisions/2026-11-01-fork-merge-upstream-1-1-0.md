# Merging upstream 1.1.0 into the fork

**Date:** 2026-11-01 · **Status:** merged on `merge/upstream-1.1.0`, not yet deployed

## Context

The fork (`origin`) was cut from upstream's 1.0.x line and carries its own features: pro/perso
status and reimbursements, internal transfers, category rules and suggestions, the expense
dashboard. Upstream 1.1.0 (`upstream`, tag `1.1.0`) is 735 commits ahead and ships a competing
budget/category/recurring module, new connectors, CSRF, a shared sidecar key and an amount-masking
formatter. None of the fork-only features exist upstream.

## Decisions

- **Fork migrations live in V200+.** The fork's V80/V82-V87 collided with unrelated upstream files
  and upstream keeps numbering upward from V116, so a fork-owned range means a later merge can never
  collide again. Flyway runs with `out-of-order: true`, so lower-numbered upstream additions still
  apply to a database that already holds V200+. The fork's old V81 (transaction external id) was
  dropped: upstream's V88 is the same column, and V207 brings an existing database to upstream's
  shape (VARCHAR(128), plain index instead of the fork's unique one -- banks reuse entry references).
- **`ForkMigrationReconciliationCallback` rewrites the production history.** Upstream also renumbered
  V38 and V54-V64 relative to the 1.0.x line, so the fork's database fails validation on the first
  description mismatch. The callback moves each row by (old version, description, checksum), runs
  before validation, and is a no-op on a fresh or already-reconciled database. It is a one-time
  bridge: delete it, its test and `fork-1.0.x-prod-history.txt` once production has booted on 1.1.0.
  `ReleaseMigrationCli` registers it too, so a rehearsal exercises the same repair.
- **Take upstream where the feature is the same, keep the fork where it is not.** Enable Banking
  transaction import: upstream's. `TransactionsList`: upstream's row and detail sheet with the fork's
  filters, context menu, badges and action buttons added back (`TransactionRow` gained optional
  `badges` / `trailing` slots). Fork records keep upstream's constructor shape as a secondary
  constructor (`HoldingResponse`, `TransactionResponse`) so upstream tests and callers still compile.
- **Fork's `GET /api/transactions` moved to `/api/transactions/by-period`;** upstream's search
  endpoint owns the original path.
- **Amounts go through `useMoney()`.** Upstream made `formatCurrency` private so hidden amounts
  cannot leak; the fork's dashboard components now use the same formatter. A guard test forbids a
  literal currency symbol in any `.tsx`, tests included.

## Still to do before deploying

1. Add `APP_SIDECAR_API_KEY` to the server's `docker/.env`; the app and every `*-auth` sidecar
   refuse to start without it, so the sidecar images must move to 1.1.0 too.
2. Back up the database, then smoke-test the built image against a restored copy.
3. Unify the two category systems (fork `expense_category` / `category_rule` vs upstream `category` /
   `categorization_rule` / `budget` / `recurring_series`). Both run side by side for now.

## Rehearsal result (2026-11-01, restored production dump)

`ReleaseMigrationCli migrate` then `verify`: 21 history rows reconciled, 52 migrations applied
(history 70 → 122 rows, all successful, highest V207), Hibernate schema validation passed, and the
data was untouched (1042 transactions, 23 categories, 14 rules, 19 reimbursements, identical
pro-status distribution).
