-- Expense classification: two independent dimensions on transaction (pro_status,
-- expense_category), a user-editable expense_category lookup table, and
-- reimbursement tracking/linking for PRO_A_REMBOURSER expenses.
--
-- Purely additive: no existing column altered, no bank-sync table touched.
-- pro_status defaults to NON_CLASSE so every historical transaction starts
-- unclassified, matching "start from now, partial history is fine".
--
-- pro_status/reimbursement_status are plain VARCHAR + CHECK, not native
-- CREATE TYPE ... AS ENUM (the account_type pattern): Transaction rows are
-- persisted through H2 in TransactionRepositoryTest, and transaction.tx_type
-- (TransactionType) already avoids NAMED_ENUM for exactly that reason.

CREATE TABLE expense_category (
    id         BIGSERIAL    PRIMARY KEY,
    member_id  BIGINT       NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    color      VARCHAR(7)   NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_expense_category_member_name UNIQUE (member_id, name)
);

CREATE INDEX idx_expense_category_member ON expense_category(member_id);

CREATE TABLE reimbursement (
    id             BIGSERIAL   PRIMARY KEY,
    member_id      BIGINT      NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    -- The incoming credit transfer. No ON DELETE here on purpose: deleting a manual
    -- transaction that is a reimbursement's credit side must be rejected by the DB
    -- rather than silently orphaning reimbursement_status on the linked expenses.
    -- ReimbursementService.delete() is the only supported way to remove a
    -- reimbursement, and it un-links expenses first.
    transaction_id BIGINT      NOT NULL REFERENCES transaction(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A transaction may be the credit side of at most one reimbursement.
    CONSTRAINT uk_reimbursement_transaction UNIQUE (transaction_id)
);

CREATE INDEX idx_reimbursement_member ON reimbursement(member_id);

ALTER TABLE transaction
  ADD COLUMN pro_status           VARCHAR(20) NOT NULL DEFAULT 'NON_CLASSE'
    CONSTRAINT ck_transaction_pro_status
      CHECK (pro_status IN ('PERSO', 'PRO_A_REMBOURSER', 'PRO_ABSORBE', 'NON_CLASSE')),
  ADD COLUMN expense_category_id  BIGINT REFERENCES expense_category(id) ON DELETE SET NULL,
  ADD COLUMN reimbursement_status VARCHAR(20)
    CONSTRAINT ck_transaction_reimbursement_status
      CHECK (reimbursement_status IN ('EN_ATTENTE', 'REMBOURSE')),
  ADD COLUMN reimbursement_id     BIGINT REFERENCES reimbursement(id) ON DELETE SET NULL;

-- Defense in depth: reimbursement_id may only ever point at an expense currently
-- classified PRO_A_REMBOURSER. TransactionClassificationService and
-- ReimbursementService are the real gatekeepers; this stops any future write
-- path from silently violating the invariant.
ALTER TABLE transaction
  ADD CONSTRAINT ck_transaction_reimbursement_requires_pro_a_rembourser
    CHECK (reimbursement_id IS NULL OR pro_status = 'PRO_A_REMBOURSER');

CREATE INDEX idx_transaction_expense_category ON transaction(expense_category_id)
  WHERE expense_category_id IS NOT NULL;
CREATE INDEX idx_transaction_reimbursement ON transaction(reimbursement_id)
  WHERE reimbursement_id IS NOT NULL;
CREATE INDEX idx_transaction_pending_reimbursement ON transaction(pro_status, reimbursement_status)
  WHERE pro_status = 'PRO_A_REMBOURSER';
