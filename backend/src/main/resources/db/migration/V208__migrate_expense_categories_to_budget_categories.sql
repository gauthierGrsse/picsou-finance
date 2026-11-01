-- Moves the fork's expense categories, rules, budgets and transaction classifications onto
-- upstream's budget module (category / categorization_rule / budget / transaction.category_id),
-- which becomes the single category system. The fork-only classification (pro_status,
-- reimbursements, internal-transfer links) is untouched; it stays on the transaction.
--
-- Nothing legacy is dropped here: expense_category, category_rule and
-- transaction.expense_category_id stay in place, unused, so the result can be checked against the
-- source before a later migration removes them.
--
-- Mapping, by exact legacy name (anything not listed becomes a custom category of the same name):
--   onto a default   Courses, Restauration->Restaurants, Transport, Logement, Loisirs + Loisir,
--                    Abonnements, Santé, Impots / taxes, Hotel->Voyages, Salaire,
--                    Remboursement frais->Remboursements, Autre->Divers
--   sub-category     Voiture<Transport, Loyer<Logement, Sortie<Loisirs,
--                    Vêtement<Shopping, Matériel/Équipement<Shopping
--   custom           e.g. Assurance, Frais bancaire, Cadeau, Amende, Cash
-- A legacy "Both" type has no upstream kind: it becomes an expense (the transactions in such
-- categories are almost all outflows). "Autre", the one such category that holds inflows too, sends
-- its positive amounts to "Autres revenus". Every internal transfer lands in "Virement interne",
-- the TRANSFER category the budget pages leave out of cash flow.
--
-- Migrated rows are marked category_manual: they were chosen (or ruled) by the member, and
-- upstream's categorizer never overwrites a manual choice.
--
-- A no-op on a database that has no expense_category rows.

DO $$
DECLARE
    lc          RECORD;
    v_target    BIGINT;
    v_parent    BIGINT;
    v_kind      category_kind;
    v_rows      BIGINT;
    v_moved     BIGINT := 0;
    v_categories BIGINT := 0;
BEGIN
    -- 1. Upstream's lazy seeding only runs for a member with no category at all, so a member that
    --    gets custom categories here must get the defaults here too (same list as CategoryService,
    --    same approach as V92). Skips any slug the member already has.
    INSERT INTO category (member_id, slug, name, kind, color, icon, is_default, sort_order)
    SELECT m.member_id, d.slug, d.name, d.kind::category_kind, d.color, d.icon, TRUE,
           COALESCE((SELECT MAX(c.sort_order) FROM category c WHERE c.member_id = m.member_id), -1) + 1 + d.ord
    FROM (SELECT DISTINCT member_id FROM expense_category) m
    CROSS JOIN (VALUES
        ('courses',          'Courses',            'EXPENSE',  '#22c55e', 'shopping-cart',  0),
        ('restaurants',      'Restaurants',        'EXPENSE',  '#f97316', 'utensils',       1),
        ('transport',        'Transport',          'EXPENSE',  '#3b82f6', 'car',            2),
        ('logement',         'Logement',           'EXPENSE',  '#8b5cf6', 'house',          3),
        ('factures',         'Factures & énergie', 'EXPENSE',  '#eab308', 'zap',            4),
        ('sante',            'Santé',              'EXPENSE',  '#ef4444', 'heart-pulse',    5),
        ('loisirs',          'Loisirs',            'EXPENSE',  '#ec4899', 'gamepad-2',      6),
        ('shopping',         'Shopping',           'EXPENSE',  '#14b8a6', 'shopping-bag',   7),
        ('abonnements',      'Abonnements',        'EXPENSE',  '#6366f1', 'repeat',         8),
        ('voyages',          'Voyages',            'EXPENSE',  '#06b6d4', 'plane',          9),
        ('impots',           'Impôts & taxes',     'EXPENSE',  '#a16207', 'landmark',      10),
        ('credit',           'Crédit',             'EXPENSE',  '#be123c', 'hand-coins',    11),
        ('divers',           'Divers',             'EXPENSE',  '#94a3b8', 'ellipsis',      12),
        ('salaire',          'Salaire',            'INCOME',   '#16a34a', 'wallet',        13),
        ('autres-revenus',   'Autres revenus',     'INCOME',   '#65a30d', 'hand-coins',    14),
        ('revenus-capital',  'Revenus du capital', 'INCOME',   '#ca8a04', 'coins',         15),
        ('remboursements',   'Remboursements',     'INCOME',   '#0ea5e9', 'undo-2',        16),
        ('epargne',          'Épargne',            'TRANSFER', '#0891b2', 'piggy-bank',    17),
        ('investissement',   'Investissement',     'TRANSFER', '#7c3aed', 'trending-up',   18),
        ('virement-interne', 'Virement interne',   'TRANSFER', '#64748b', 'arrow-left-right', 19)
    ) AS d(slug, name, kind, color, icon, ord)
    WHERE NOT EXISTS (SELECT 1 FROM category c WHERE c.member_id = m.member_id AND c.slug = d.slug);

    -- 2. Legacy category -> upstream category. Parents before children.
    CREATE TEMP TABLE tmp_category_map (
        legacy_id BIGINT PRIMARY KEY,
        target_id BIGINT NOT NULL
    ) ON COMMIT DROP;

    FOR lc IN
        SELECT ec.id, ec.member_id, ec.name, ec.color, ec.type, ec.parent_id,
               nm.target_slug, nm.parent_slug
        FROM expense_category ec
        LEFT JOIN (VALUES
            ('Courses',             'courses',        NULL::text),
            ('Restauration',        'restaurants',    NULL),
            ('Transport',           'transport',      NULL),
            ('Logement',            'logement',       NULL),
            ('Loisirs',             'loisirs',        NULL),
            ('Loisir',              'loisirs',        NULL),
            ('Abonnements',         'abonnements',    NULL),
            ('Santé',               'sante',          NULL),
            ('Impots / taxes',      'impots',         NULL),
            ('Hotel',               'voyages',        NULL),
            ('Salaire',             'salaire',        NULL),
            ('Remboursement frais', 'remboursements', NULL),
            ('Autre',               'divers',         NULL),
            ('Voiture',             NULL,             'transport'),
            ('Loyer',               NULL,             'logement'),
            ('Sortie',              NULL,             'loisirs'),
            ('Vêtement',            NULL,             'shopping'),
            ('Matériel/Équipement', NULL,             'shopping')
        ) AS nm(name, target_slug, parent_slug) ON nm.name = ec.name
        ORDER BY ec.parent_id NULLS FIRST, ec.id
    LOOP
        IF lc.target_slug IS NOT NULL THEN
            SELECT id INTO v_target FROM category WHERE member_id = lc.member_id AND slug = lc.target_slug;
            IF v_target IS NULL THEN
                RAISE EXCEPTION 'Default category % missing for member %', lc.target_slug, lc.member_id;
            END IF;
        ELSE
            v_parent := NULL;
            IF lc.parent_slug IS NOT NULL THEN
                SELECT id INTO v_parent FROM category WHERE member_id = lc.member_id AND slug = lc.parent_slug;
            ELSIF lc.parent_id IS NOT NULL THEN
                -- Keep the tree one level deep, as upstream enforces: hang it under the mapped
                -- parent's own parent when that parent is itself a sub-category.
                SELECT COALESCE(c.parent_id, c.id) INTO v_parent
                FROM tmp_category_map mp JOIN category c ON c.id = mp.target_id
                WHERE mp.legacy_id = lc.parent_id;
            END IF;

            IF v_parent IS NOT NULL THEN
                SELECT kind INTO v_kind FROM category WHERE id = v_parent;
            ELSE
                v_kind := CASE lc.type WHEN 'INCOME' THEN 'INCOME'::category_kind ELSE 'EXPENSE'::category_kind END;
            END IF;

            INSERT INTO category (member_id, name, kind, color, is_default, parent_id, sort_order)
            VALUES (lc.member_id, lc.name, v_kind, lc.color, FALSE, v_parent,
                    COALESCE((SELECT MAX(c.sort_order) FROM category c WHERE c.member_id = lc.member_id), -1) + 1)
            RETURNING id INTO v_target;
            v_categories := v_categories + 1;
        END IF;

        INSERT INTO tmp_category_map (legacy_id, target_id) VALUES (lc.id, v_target);
    END LOOP;

    -- 3. Transactions. Never overrides a category upstream's pipeline already set.
    UPDATE transaction t
    SET category_id = mp.target_id, category_manual = TRUE
    FROM tmp_category_map mp
    WHERE t.expense_category_id = mp.legacy_id AND t.category_id IS NULL;
    GET DIAGNOSTICS v_moved = ROW_COUNT;

    -- "Autre" held inflows as well as outflows; the inflows are income, not "Divers".
    UPDATE transaction t
    SET category_id = ar.id
    FROM expense_category ec, account a, category dv, category ar
    WHERE ec.id = t.expense_category_id AND ec.name = 'Autre'
      AND a.id = t.account_id
      AND dv.member_id = a.member_id AND dv.slug = 'divers'
      AND ar.member_id = a.member_id AND ar.slug = 'autres-revenus'
      AND t.amount > 0
      AND t.category_id = dv.id;

    -- Internal transfers belong to the TRANSFER category the budget pages exclude from cash flow.
    UPDATE transaction t
    SET category_id = vi.id, category_manual = TRUE
    FROM account a, category vi
    WHERE t.pro_status = 'VIREMENT_INTERNE' AND t.category_id IS NULL
      AND a.id = t.account_id
      AND vi.member_id = a.member_id AND vi.slug = 'virement-interne';

    -- 4. Rules: "description contains X" is upstream's KEYWORD (which also looks at the
    --    counterparty and the cleaned merchant name, so it catches at least what ours did).
    --    A status carried by a rule has no upstream equivalent and is dropped.
    INSERT INTO categorization_rule (member_id, match_type, pattern, category_id, priority, source)
    SELECT r.member_id, 'KEYWORD', r.pattern, mp.target_id, 0, 'USER'
    FROM category_rule r
    JOIN tmp_category_map mp ON mp.legacy_id = r.expense_category_id
    WHERE NOT EXISTS (
        SELECT 1 FROM categorization_rule x
        WHERE x.member_id = r.member_id AND x.match_type = 'KEYWORD' AND lower(x.pattern) = lower(r.pattern));
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'V208: % rule(s) migrated (% carried a status that is dropped)',
        v_rows, (SELECT COUNT(*) FROM category_rule WHERE pro_status IS NOT NULL);

    -- 5. Monthly budgets (merged categories add up). An existing upstream budget wins.
    INSERT INTO budget (member_id, category_id, monthly_limit)
    SELECT ec.member_id, mp.target_id, SUM(ec.monthly_budget)
    FROM expense_category ec JOIN tmp_category_map mp ON mp.legacy_id = ec.id
    WHERE ec.monthly_budget IS NOT NULL
    GROUP BY ec.member_id, mp.target_id
    ON CONFLICT (category_id) DO NOTHING;

    RAISE NOTICE 'V208: % custom categor(ies) created, % transaction(s) moved', v_categories, v_moved;
END
$$;
