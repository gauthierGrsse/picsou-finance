-- Patterns the member has explicitly waved away from the auto-categorization rule
-- suggestions, so a dismissed suggestion doesn't keep coming back. A suggestion that
-- becomes an actual rule needs no row here -- the suggestion service already skips any
-- pattern an existing rule covers.

CREATE TABLE category_rule_dismissed_suggestion (
    id         BIGSERIAL    PRIMARY KEY,
    member_id  BIGINT       NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
    pattern    VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_category_rule_dismissed_suggestion UNIQUE (member_id, pattern)
);

CREATE INDEX idx_category_rule_dismissed_suggestion_member ON category_rule_dismissed_suggestion(member_id);
