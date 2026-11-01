-- Reconciles the transaction external-id column across the two histories that produced it.
--
-- The fork shipped this column first (its old V81): VARCHAR(100) behind a UNIQUE index. Upstream
-- shipped the same column as V88: VARCHAR(128) behind a plain index, on purpose -- some banks reuse
-- an entry reference, and a unique index would abort the whole sync transaction on such a row and
-- flip the connection to FAILED. A database that took the fork's V81 has its history row re-pointed
-- at V88 (ForkMigrationReconciliationCallback), so V88 never runs there and the column keeps the
-- fork's narrower type and unique index. This brings it to upstream's shape.
--
-- A no-op on a fresh database, where V88 already created exactly this.
ALTER TABLE transaction ALTER COLUMN external_transaction_id TYPE VARCHAR(128);

DROP INDEX IF EXISTS uk_transaction_account_external_id;

CREATE INDEX IF NOT EXISTS idx_transaction_account_external_id
    ON transaction(account_id, external_transaction_id);
