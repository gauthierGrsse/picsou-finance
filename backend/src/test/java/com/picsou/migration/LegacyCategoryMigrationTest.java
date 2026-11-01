package com.picsou.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V208 moves the fork's expense categories, rules, budgets and classifications onto upstream's
 * budget module. Each test builds a database at V207 (the last schema before the move), seeds the
 * kind of data the fork's production database holds, then migrates and inspects the result.
 */
@Testcontainers
@EnabledIf("dockerAvailable")
class LegacyCategoryMigrationTest {

    static {
        System.setProperty("api.version", "1.44");
    }

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    static boolean dockerAvailable() {
        boolean available = DockerClientFactory.instance().isDockerAvailable();
        if (!available && System.getenv("PICSOU_REQUIRE_DOCKER_TESTS") != null) {
            throw new IllegalStateException("Docker is required but unavailable");
        }
        return available;
    }

    private long member;
    private long account;

    @BeforeEach
    void freshDatabaseAtV207() throws SQLException {
        try (Connection c = connection(); Statement s = c.createStatement()) {
            s.execute("DROP SCHEMA public CASCADE");
            s.execute("CREATE SCHEMA public");
        }
        flyway("207").migrate();
        member = insertId("INSERT INTO family_member (display_name) VALUES ('Test') RETURNING id");
        account = insertId("INSERT INTO account (name, member_id) VALUES ('Courant', " + member + ") RETURNING id");
    }

    @Test
    void movesCategoriesTransactionsRulesAndBudgetsOntoTheBudgetModule() throws SQLException {
        long courses = legacy("Courses", "EXPENSE", null, "300.00");
        long autre = legacy("Autre", "BOTH", null, null);
        long voiture = legacy("Voiture", "BOTH", null, null);
        long assurance = legacy("Assurance", "BOTH", null, null);
        long salaire = legacy("Salaire", "INCOME", null, null);
        long loisir = legacy("Loisir", "EXPENSE", null, "20.00");
        long loisirs = legacy("Loisirs", "EXPENSE", null, "30.00");
        long cinema = legacy("Cinéma", "EXPENSE", loisirs, null);       // unmapped child of a mapped parent

        tx(-40, courses, null);
        long autreOut = tx(-10, autre, null);
        long autreIn = tx(25, autre, null);
        tx(-60, assurance, null);
        tx(2000, salaire, null);
        tx(-5, loisir, null);
        tx(-9, cinema, null);
        long transfer = tx(-100, null, "VIREMENT_INTERNE");
        long untouched = tx(-12, null, null);
        // upstream's own pipeline already filed this one under "divers": it must not be overridden
        exec("INSERT INTO category (member_id, slug, name, kind, is_default, sort_order) VALUES (" + member + ", 'divers', 'Divers', 'EXPENSE', TRUE, 0)");
        long alreadyFiled = tx(-20, courses, null);
        exec("UPDATE transaction SET category_id = (SELECT id FROM category WHERE slug = 'divers') WHERE id = " + alreadyFiled);
        exec("INSERT INTO category_rule (member_id, pattern, expense_category_id) VALUES (" + member + ", 'carrefour', " + courses + ")");
        exec("INSERT INTO category_rule (member_id, pattern, expense_category_id, pro_status) VALUES (" + member + ", 'uber', " + voiture + ", 'PERSO')");

        flyway(null).migrate();

        // defaults seeded for a member that only had legacy categories
        assertThat(one("SELECT COUNT(*) FROM category WHERE member_id = " + member + " AND is_default")).isEqualTo("20");

        // merged, custom and child categories
        assertThat(catOf(autreOut)).isEqualTo("Divers");
        assertThat(catOf(autreIn)).as("an inflow filed under Autre is income").isEqualTo("Autres revenus");
        assertThat(one("SELECT COUNT(*) FROM transaction WHERE category_id = (SELECT id FROM category WHERE slug = 'loisirs')"))
            .as("Loisir and Loisirs merge").isEqualTo("1");
        assertThat(one("SELECT name || '<' || COALESCE((SELECT p.name FROM category p WHERE p.id = c.parent_id), '-') FROM category c WHERE name = 'Voiture'"))
            .isEqualTo("Voiture<Transport");
        assertThat(one("SELECT kind || ':' || COALESCE(slug, 'custom') FROM category WHERE name = 'Assurance'"))
            .as("a legacy Both becomes an expense").isEqualTo("EXPENSE:custom");
        assertThat(one("SELECT name || '<' || (SELECT p.name FROM category p WHERE p.id = c.parent_id) FROM category c WHERE name = 'Cinéma'"))
            .isEqualTo("Cinéma<Loisirs");

        // transactions: migrated rows are manual; internal transfers go to the TRANSFER category;
        // nothing else is touched and upstream's own choice survives
        assertThat(one("SELECT COUNT(*) FROM transaction WHERE category_id IS NOT NULL AND category_manual")).isEqualTo("8");
        assertThat(catOf(transfer)).isEqualTo("Virement interne");
        assertThat(one("SELECT COALESCE(category_id::text, 'none') FROM transaction WHERE id = " + untouched)).isEqualTo("none");
        assertThat(catOf(alreadyFiled)).isEqualTo("Divers");
        assertThat(one("SELECT COUNT(*) FROM transaction WHERE expense_category_id IS NOT NULL")).as("legacy column kept").isEqualTo("8");

        // rules become KEYWORD rules, once; a rule's status has no upstream home and is dropped
        assertThat(rows("SELECT match_type || ' ' || pattern || ' -> ' || (SELECT name FROM category c WHERE c.id = r.category_id) FROM categorization_rule r ORDER BY pattern"))
            .containsExactly("KEYWORD carrefour -> Courses", "KEYWORD uber -> Voiture");

        // budgets: merged categories add up
        assertThat(rows("SELECT (SELECT name FROM category c WHERE c.id = b.category_id) || '=' || monthly_limit FROM budget b ORDER BY 1"))
            .containsExactly("Courses=300.00", "Loisirs=50.00");

        // legacy tables are left in place for a later clean-up
        assertThat(one("SELECT COUNT(*) FROM expense_category")).isEqualTo("8");
    }

    @Test
    void reusesCategoriesUpstreamAlreadySeededAndNeverCreatesTheSameDefaultTwice() throws SQLException {
        long courses = legacy("Courses", "EXPENSE", null, null);
        tx(-40, courses, null);
        // the budget page was opened first, so upstream's lazy seed already ran
        exec("INSERT INTO category (member_id, slug, name, kind, is_default, sort_order) VALUES (" + member + ", 'courses', 'Courses', 'EXPENSE', TRUE, 0)");

        flyway(null).migrate();

        assertThat(one("SELECT COUNT(*) FROM category WHERE member_id = " + member + " AND slug = 'courses'")).isEqualTo("1");
        assertThat(one("SELECT COUNT(*) FROM category WHERE member_id = " + member + " AND is_default")).isEqualTo("20");
        assertThat(one("SELECT COUNT(*) FROM transaction WHERE category_id = (SELECT id FROM category WHERE slug = 'courses')")).isEqualTo("1");
    }

    @Test
    void doesNothingForADatabaseWithoutLegacyCategories() throws SQLException {
        flyway(null).migrate();

        assertThat(one("SELECT COUNT(*) FROM category")).isEqualTo("0");
        assertThat(one("SELECT COUNT(*) FROM categorization_rule")).isEqualTo("0");
    }

    // ── helpers ────────────────────────────────────────────────────────────────────────

    private static Flyway flyway(String target) {
        var configuration = Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("classpath:db/migration")
            .outOfOrder(true)
            .cleanDisabled(false);
        if (target != null) {
            configuration.target(target);
        }
        return configuration.load();
    }

    private long legacy(String name, String type, Long parent, String budget) throws SQLException {
        return insertId("INSERT INTO expense_category (member_id, name, type, parent_id, monthly_budget) VALUES ("
            + member + ", '" + name + "', '" + type + "', " + (parent == null ? "NULL" : parent) + ", "
            + (budget == null ? "NULL" : budget) + ") RETURNING id");
    }

    private long tx(int amount, Long legacyCategory, String proStatus) throws SQLException {
        return insertId("INSERT INTO transaction (account_id, date, amount, description, expense_category_id, pro_status) VALUES ("
            + account + ", DATE '2026-01-15', " + amount + ", 'tx', " + (legacyCategory == null ? "NULL" : legacyCategory)
            + ", '" + (proStatus == null ? "NON_CLASSE" : proStatus) + "') RETURNING id");
    }

    private String catOf(long txId) throws SQLException {
        return one("SELECT c.name FROM transaction t JOIN category c ON c.id = t.category_id WHERE t.id = " + txId);
    }

    private static Connection connection() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static void exec(String sql) throws SQLException {
        try (Connection c = connection(); Statement s = c.createStatement()) {
            s.execute(sql);
        }
    }

    private static long insertId(String sql) throws SQLException {
        return Long.parseLong(one(sql));
    }

    private static String one(String sql) throws SQLException {
        List<String> r = rows(sql);
        return r.isEmpty() ? null : r.get(0);
    }

    private static List<String> rows(String sql) throws SQLException {
        List<String> out = new ArrayList<>();
        try (Connection c = connection(); Statement s = c.createStatement()) {
            boolean hasResult = s.execute(sql);
            if (hasResult) {
                ResultSet rs = s.getResultSet();
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
            }
        }
        return out;
    }
}
