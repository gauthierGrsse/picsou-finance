-- Internal transfers: a debit on one of the member's own accounts and a matching
-- credit on another (e.g. Revolut "Petite monnaie" <-> "Courant Revolut") are not
-- real expenses/income and must not inflate the expense dashboard.
--
-- linked_transaction_id is a symmetric self-reference: when a pair is linked, each
-- row points at the other. Nullable, no FK-level ON DELETE action needed beyond
-- SET NULL -- deleting one leg (a manual account's transaction can be deleted)
-- must not leave the surviving leg pointing at a dangling id.
ALTER TABLE transaction
  ADD COLUMN linked_transaction_id BIGINT REFERENCES transaction(id) ON DELETE SET NULL;

ALTER TABLE transaction
  DROP CONSTRAINT ck_transaction_pro_status,
  ADD CONSTRAINT ck_transaction_pro_status
    CHECK (pro_status IN ('PERSO', 'PRO_A_REMBOURSER', 'PRO_ABSORBE', 'NON_CLASSE', 'VIREMENT_INTERNE'));

CREATE INDEX idx_transaction_linked ON transaction(linked_transaction_id)
  WHERE linked_transaction_id IS NOT NULL;
