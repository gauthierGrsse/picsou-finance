package com.picsou.migration;

import com.picsou.config.ForkMigrationReconciliationCallback;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.ValidateResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The fork's production database was built on the 1.0.x migration numbering. This starts from its
 * real schema-history rows ({@code migration/fork-1.0.x-prod-history.txt}: version, description,
 * checksum, as recorded when the 1.1.0 merge was prepared) and checks that, with the reconciliation
 * callback, Flyway validates them against the current files -- and that without it, it would not.
 *
 * <p>Only the history is rebuilt, not the schema behind it: validation compares history to files,
 * which is exactly what the callback repairs. That the migrations then run on the real schema was
 * rehearsed separately against a restored dump with {@code ReleaseMigrationCli}.
 */
@Testcontainers
@EnabledIf("dockerAvailable")
class ForkMigrationReconciliationTest {

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

    @Test
    void theForksProductionHistoryFailsValidationOnItsOwn() throws Exception {
        seedHistory();

        ValidateResult result = flyway(false).validateWithResult();

        assertThat(result.validationSuccessful).isFalse();
    }

    @Test
    void theCallbackBringsTheProductionHistoryInLineWithTheCurrentFiles() throws Exception {
        seedHistory();

        ValidateResult result = flyway(true).validateWithResult();

        assertThat(result.validationSuccessful)
            .as("invalid migrations: %s", result.invalidMigrations.stream()
                .map(o -> "V" + o.version + " " + o.description).toList())
            .isTrue();
        assertThat(versions()).contains("88", "94", "96", "200", "201", "202", "203", "204", "205", "206")
            .doesNotContain("81", "82", "87");
    }

    @Test
    void runningItTwiceChangesNothing() throws Exception {
        seedHistory();
        flyway(true).validateWithResult();
        List<String> once = versions();

        flyway(true).validateWithResult();

        assertThat(versions()).isEqualTo(once);
    }

    @Test
    void aFreshDatabaseIsLeftAlone() throws Exception {
        try (Connection c = connection(); Statement s = c.createStatement()) {
            s.execute("DROP SCHEMA public CASCADE");
            s.execute("CREATE SCHEMA public");
        }

        // No history table yet: the callback must not create or touch anything.
        ValidateResult result = flyway(true).validateWithResult();

        assertThat(result.validationSuccessful).isTrue();
        assertThat(versions()).isEmpty();
    }

    private static Flyway flyway(boolean withCallback) {
        var configuration = Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("classpath:db/migration")
            .outOfOrder(true)
            .cleanDisabled(false)
            // The schema behind the history is not rebuilt here, so every migration the database
            // never ran is simply pending; only mismatches between applied rows and files matter.
            .ignoreMigrationPatterns("*:pending");
        if (withCallback) {
            configuration.callbacks(new ForkMigrationReconciliationCallback());
        }
        return configuration.load();
    }

    private static Connection connection() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static List<String> versions() throws SQLException {
        List<String> out = new ArrayList<>();
        try (Connection c = connection(); Statement s = c.createStatement()) {
            ResultSet tables = c.getMetaData().getTables(null, "public", "flyway_schema_history", null);
            if (!tables.next()) {
                return out;
            }
            ResultSet rs = s.executeQuery("SELECT version FROM flyway_schema_history ORDER BY installed_rank");
            while (rs.next()) {
                out.add(rs.getString(1));
            }
        }
        return out;
    }

    private static void seedHistory() throws Exception {
        try (Connection c = connection(); Statement s = c.createStatement()) {
            s.execute("DROP SCHEMA public CASCADE");
            s.execute("CREATE SCHEMA public");
            s.execute("""
                CREATE TABLE flyway_schema_history (
                    installed_rank INT NOT NULL PRIMARY KEY,
                    version VARCHAR(50),
                    description VARCHAR(200) NOT NULL,
                    type VARCHAR(20) NOT NULL,
                    script VARCHAR(1000) NOT NULL,
                    checksum INT,
                    installed_by VARCHAR(100) NOT NULL,
                    installed_on TIMESTAMP NOT NULL DEFAULT now(),
                    execution_time INT NOT NULL,
                    success BOOLEAN NOT NULL)
                """);
            try (InputStream in = ForkMigrationReconciliationTest.class
                     .getResourceAsStream("/migration/fork-1.0.x-prod-history.txt");
                 PreparedStatement insert = c.prepareStatement(
                     "INSERT INTO flyway_schema_history VALUES (?, ?, ?, 'SQL', ?, ?, 'test', now(), 1, true)")) {
                assertThat(in).isNotNull();
                int rank = 1;
                for (String line : new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\n")) {
                    if (line.isBlank()) continue;
                    String[] f = line.split("\\|");
                    insert.setInt(1, rank++);
                    insert.setString(2, f[0]);
                    insert.setString(3, f[1]);
                    insert.setString(4, "V" + f[0] + "__" + f[1].replace(' ', '_') + ".sql");
                    insert.setInt(5, Integer.parseInt(f[2]));
                    insert.executeUpdate();
                }
            }
        }
    }
}
