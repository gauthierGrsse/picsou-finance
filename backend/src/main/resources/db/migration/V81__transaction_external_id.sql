-- External transaction id from the sync provider (Enable Banking's entry_reference /
-- transaction_id), used to dedupe on repeated syncs instead of blind-inserting.
-- Null for manual/CSV/reimbursement-originated transactions, which never had a
-- provider id to begin with.
ALTER TABLE transaction
  ADD COLUMN external_transaction_id VARCHAR(100);

-- Partial + composite: only bank-synced rows populate this, and the id is only
-- unique within one account (two different accounts could coincidentally reuse
-- provider-assigned reference strings).
CREATE UNIQUE INDEX uk_transaction_account_external_id
  ON transaction(account_id, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;
