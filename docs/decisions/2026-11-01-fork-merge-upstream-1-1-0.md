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

## Deploy runbook (homelab) -- run only on an explicit go

The merge changes the database history, so **rolling back the image alone does not work**: the old
image would fail Flyway validation against the reconciled history. A rollback is: stop the app,
restore the pre-deploy `pg_dump`, `git reset --hard c738ea3`, set the app image back to
`picsou-finance:c738ea3`, start the app. Keep that backup until the new version has run for a while.

1. Fast-forward `main` to `merge/upstream-1.1.0` and push (the server syncs from `origin/main`).
2. `pg_dump` the production database to a local file; check it is not empty.
3. Ship the app image: `docker buildx build --platform linux/amd64 ... -t picsou-finance:<sha> --load .`
   then `docker save picsou-finance:<sha> | ssh picsou-prod docker load`.
4. On the server, in this order: `git fetch && git reset --hard origin/main`; append
   `APP_SIDECAR_API_KEY` to `docker/.env` if absent (`openssl rand -base64 32`; the app and every
   sidecar refuse to start without it -- and since the compose interpolates it with `:?`, *every*
   `docker compose` command fails until it is set); set the `app` image line (still line 6) to the
   local tag; pin the sidecar images from `:latest` to `:1.1.0` (`:latest` follows upstream's
   `main`, not the release); pull the four sidecar images.
5. `cd docker && docker compose up -d --no-deps --no-build app tr-auth bourso-auth bourse-direct-auth amundi-auth`.
   - `--no-deps`: `app` depends on all 11 sidecars; without it Compose would start the seven the
     homelab does not use (Revolut, Fortuneo, Amex, ...).
   - `--no-build`: the sidecars declare `additional_contexts: service:sidecar-chromium`, which makes
     Compose build that base image from source instead of using the published ones.
6. Verify: `/actuator/health` UP; logs show `Reconciled 21 fork schema-history row(s)` then
   `Successfully applied 52 migrations ... now at version v207`; `GET /mcp` without a key is 401;
   the four sidecars are up (`/health` is open, every other path needs `X-Picsou-Sidecar-Key`).

## Rehearsal results (2026-11-01, restored production dump)

`ReleaseMigrationCli migrate` then `verify`: 21 history rows reconciled, 52 migrations applied
(history 70 → 122 rows, all successful, highest V207), Hibernate schema validation passed, and the
data was untouched (1042 transactions, 23 categories, 14 rules, 19 reimbursements, identical
pro-status distribution).

Full-image smoke test (the real `picsou-finance` image + tr-auth 1.1.0 + a restored dump, isolated
Compose project): the app boots in ~21 s, reconciles the history and applies 52 migrations; `/` is
200, `/mcp` without a key is 401; the sidecar answers 401 without or with a wrong key and passes
authentication with the right one; an existing `psk_` access key still opens an MCP session, which
now advertises 86 tools (the fork's 30 plus upstream's) and `list_accounts` returns every account.

## Follow-up: one category system (branch `feat/unify-categories`)

The fork's own categories, rules, budgets and subscription detector are gone; upstream's budget
module (`category`, `categorization_rule`, `budget`, `recurring_series`) is the only system.

- **Data (V208):** expense categories -> `category` (onto upstream defaults by name, one-level
  sub-categories, custom otherwise; a legacy "Both" becomes an expense, "Autre" sends its inflows to
  income), classifications -> `transaction.category_id` (marked manual so the categorizer never
  overwrites them), rules -> KEYWORD rules, monthly budgets -> `budget`, every internal transfer ->
  the TRANSFER category "Virement interne". The legacy tables/columns are **kept, unused**, for a
  later V209 clean-up once production has proven the result.
- **Kept, re-pointed to `category_id`:** pro/perso status and reimbursements, internal-transfer
  linking, the expense dashboard (breakdown, pace card with budgets from `budget`, daily allowance,
  unusual-amount flag, best-month badge) and the rule suggestions (now on `/api/rule-suggestions`,
  adopted as ordinary KEYWORD rules from the Budget -> Manage tab).
- **Replaced by upstream's:** category and rule management (Budget -> Manage), the subscription
  detector (the dashboard card now lists confirmed `recurring_series`), the right-click category menu
  now offers upstream categories by kind (expense for outflows, income for inflows, transfer either).
- **New behaviour:** a transaction marked as an internal transfer is filed under "Virement interne"
  (and released when unlinked), so the budget pages -- which only know categories -- leave it out of
  cash flow like the expense dashboard does. The dashboard also leaves out anything in a TRANSFER
  category (savings, investment).
- **The two pages still differ by design:** Dashboard nets out reimbursed professional expenses,
  Budget reads raw cash flow.
- **Regression found and fixed on the way:** taking upstream's `SyncService` for the Enable Banking
  import dropped the fork's post-sync internal-transfer auto-link (the merge commit message wrongly
  said it was re-attached). It is back, with tests.
