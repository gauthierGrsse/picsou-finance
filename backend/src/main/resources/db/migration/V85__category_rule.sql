-- Auto-categorization rules: "if the description contains X, classify it as category Y"
-- (and optionally also set a pro_status). Applied to newly-synced transactions and, on
-- create/update, retroactively to the member's existing uncategorized ones -- see
-- CategoryRuleService for the actual matching, which never touches a transaction that
-- already has a category or a non-default status, so a rule can only fill in blanks,
-- never override a manual choice.
--
-- pro_status is nullable and unconstrained by which value makes sense (VIREMENT_INTERNE
-- included) at the DB level -- the service layer is the gatekeeper, same split as
-- transaction.pro_status itself.

CREATE TABLE category_rule (
    id                  BIGSERIAL    PRIMARY KEY,
    member_id           BIGINT       NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    pattern             VARCHAR(200) NOT NULL,
    expense_category_id BIGINT       NOT NULL REFERENCES expense_category(id) ON DELETE CASCADE,
    pro_status          VARCHAR(20)
      CONSTRAINT ck_category_rule_pro_status
        CHECK (pro_status IN ('PERSO', 'PRO_A_REMBOURSER', 'PRO_ABSORBE', 'NON_CLASSE', 'VIREMENT_INTERNE')),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_category_rule_member ON category_rule(member_id);
