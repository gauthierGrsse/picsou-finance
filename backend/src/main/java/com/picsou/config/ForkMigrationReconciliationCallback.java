package com.picsou.config;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.callback.Callback;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;
import org.flywaydb.core.api.configuration.Configuration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Brings the schema history of a database that ran the fork's pre-1.1.0 numbering in line with the
 * 1.1.0 file set, before Flyway validates it.
 *
 * <p>The fork was cut from the 1.0.x line. Upstream 1.1.0 renumbered several migrations that line
 * had already shipped (V38, V54-V64 moved up, one of them by two places) and the fork's own V80-V87
 * collide with unrelated upstream files, which now live at V200-V206 so a later upstream merge can
 * never collide with them again. Left alone, validation fails on the first description mismatch,
 * and moving past it would re-run migrations on objects that already exist.
 *
 * <p>Each row is matched on old version, description <i>and</i> checksum, so a version alone is never
 * trusted, and it is moved only when its new version is free in the history. Both make this a no-op
 * on a fresh database and on one that was already reconciled. Targets are always freed before a
 * lower row moves into them, hence the descending order of {@link #REMAPS}.
 *
 * <p>Most files kept their content; the few whose checksum changed differ only in header comments
 * (they mention their own version number), so the recorded checksum is updated with the version.
 * The one real content difference is the transaction external id column (V81, now upstream V88):
 * the fork made it VARCHAR(100) behind a unique index, upstream VARCHAR(128) behind a plain one.
 * V207 closes that gap.
 *
 * <p>Spring Boot registers every {@link Callback} bean with the auto-configured Flyway, and
 * {@code ReleaseMigrationCli} adds this one explicitly so a rehearsal exercises the same repair.
 * It is a one-time bridge for the existing database and can be deleted once that database has
 * started once on the new image.
 */
@Component
public class ForkMigrationReconciliationCallback implements Callback {

    private static final Logger log = LoggerFactory.getLogger(ForkMigrationReconciliationCallback.class);

    private record Remap(String oldVersion, String newVersion, String description, int oldChecksum, int newChecksum) {
        String script() {
            return "V" + newVersion + "__" + description.replace(' ', '_') + ".sql";
        }

        boolean sameVersion() {
            return oldVersion.equals(newVersion);
        }
    }

    // Highest old version first (see class comment).
    private static final List<Remap> REMAPS = List.of(
        // The fork's own migrations, moved to the fork-owned range.
        new Remap("87", "206", "category rule dismissed suggestion", 1814055548, 1814055548),
        new Remap("86", "205", "expense category monthly budget", -1608852660, -1608852660),
        new Remap("85", "204", "category rule", 1072617666, 1072617666),
        new Remap("84", "203", "expense category type and parent", 343527704, 343527704),
        new Remap("83", "202", "holding acquired date", 1335899592, 1335899592),
        new Remap("82", "201", "internal transfer", -1271767593, -1271767593),
        // The fork's V81 is superseded by upstream's V88 for the same column (see V207).
        new Remap("81", "88", "transaction external id", 1692858315, 2119042670),
        new Remap("80", "200", "expense classification", -906387287, -906387287),
        // 1.0.x numbering -> 1.1.0 numbering.
        new Remap("64", "96", "backfill trade republic valuations", 664629777, 664629777),
        new Remap("63", "65", "constrain bourse direct sync errors", -1764174252, -1764174252),
        new Remap("62", "64", "backfill bourse direct valuations", 88940041, 88940041),
        new Remap("61", "63", "harden bourse direct sync", -840345283, -840345283),
        new Remap("60", "62", "bourse direct integration", 236247500, 236247500),
        new Remap("59", "61", "bourse direct session", 2053764575, 2053764575),
        new Remap("58", "60", "account cash balance", -694849918, -1212750843),
        new Remap("57", "59", "ibkr connection", 1520765453, -1382846890),
        new Remap("56", "58", "persistent session previous token", 720404896, 1251005780),
        new Remap("55", "57", "wallet evm account name", -1244807568, -1770899403),
        new Remap("54", "56", "wallet ethereum to evm", 903440536, 903440536),
        // Same migration, same number, header comment edited upstream.
        new Remap("51", "51", "requisition oauth state", 1952390840, 960451194),
        new Remap("38", "94", "backfill tr crypto transaction tickers", 2050086936, 2050086936)
    );

    @Override
    public boolean supports(Event event, Context context) {
        return event == Event.BEFORE_VALIDATE || event == Event.BEFORE_MIGRATE;
    }

    @Override
    public boolean canHandleInTransaction(Event event, Context context) {
        return true;
    }

    @Override
    public void handle(Event event, Context context) {
        try {
            reconcile(context.getConnection(), context.getConfiguration());
        } catch (SQLException e) {
            throw new FlywayException("Could not reconcile the fork's schema-history rows", e);
        }
    }

    @Override
    public String getCallbackName() {
        return "fork-migration-reconciliation";
    }

    private static void reconcile(Connection connection, Configuration configuration) throws SQLException {
        String schema = historySchema(connection, configuration);
        if (!historyTableExists(connection, schema, configuration.getTable())) {
            return;
        }
        String table = quote(schema) + "." + quote(configuration.getTable());
        String move = "UPDATE " + table + " SET \"version\" = ?, \"script\" = ?, \"checksum\" = ?"
            + " WHERE \"version\" = ? AND \"description\" = ? AND \"checksum\" = ?"
            + " AND NOT EXISTS (SELECT 1 FROM " + table + " WHERE \"version\" = ?)";
        String retag = "UPDATE " + table + " SET \"checksum\" = ?"
            + " WHERE \"version\" = ? AND \"description\" = ? AND \"checksum\" = ?";

        List<String> done = new ArrayList<>();
        for (Remap r : REMAPS) {
            int updated;
            if (r.sameVersion()) {
                try (PreparedStatement update = connection.prepareStatement(retag)) {
                    update.setInt(1, r.newChecksum());
                    update.setString(2, r.oldVersion());
                    update.setString(3, r.description());
                    update.setInt(4, r.oldChecksum());
                    updated = update.executeUpdate();
                }
            } else {
                try (PreparedStatement update = connection.prepareStatement(move)) {
                    update.setString(1, r.newVersion());
                    update.setString(2, r.script());
                    update.setInt(3, r.newChecksum());
                    update.setString(4, r.oldVersion());
                    update.setString(5, r.description());
                    update.setInt(6, r.oldChecksum());
                    update.setString(7, r.newVersion());
                    updated = update.executeUpdate();
                }
            }
            if (updated > 0) {
                done.add("V" + r.oldVersion() + " '" + r.description() + "' -> V" + r.newVersion());
            }
        }
        if (!done.isEmpty()) {
            log.info("Reconciled {} fork schema-history row(s): {}", done.size(), String.join(", ", done));
        }
    }

    private static String historySchema(Connection connection, Configuration configuration) throws SQLException {
        if (configuration.getDefaultSchema() != null) {
            return configuration.getDefaultSchema();
        }
        if (configuration.getSchemas().length > 0) {
            return configuration.getSchemas()[0];
        }
        return connection.getSchema();
    }

    private static boolean historyTableExists(Connection connection, String schema, String table) throws SQLException {
        try (ResultSet tables = connection.getMetaData().getTables(null, schema, table, null)) {
            return tables.next();
        }
    }

    private static String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }
}
