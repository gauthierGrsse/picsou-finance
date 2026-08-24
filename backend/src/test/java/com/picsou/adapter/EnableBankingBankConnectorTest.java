package com.picsou.adapter;

import com.picsou.config.EnableBankingConfigProvider;
import com.picsou.exception.SyncException;
import com.picsou.port.BankConnectorPort.TransactionData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnableBankingBankConnectorTest {

    @Mock EnableBankingConfigProvider configProvider;

    private EnableBankingBankConnector connector() {
        return new EnableBankingBankConnector(configProvider, "https://api.enablebanking.test");
    }

    @Test
    void searchInstitutions_missingPrivateKey_namesTheKey_notGenericNotConfigured() {
        // The reported bug: app-id/key-id present (in DB) but the key file is absent.
        lenient().when(configProvider.applicationId()).thenReturn(Optional.of("app-id"));
        lenient().when(configProvider.keyId()).thenReturn(Optional.of("key-id"));
        when(configProvider.privateKey()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> connector().searchInstitutions("ci", "FR"))
            .isInstanceOf(SyncException.class)
            .hasMessageContaining("private key");
    }

    @Test
    void searchInstitutions_missingApplicationId_namesApplicationId() {
        lenient().when(configProvider.keyId()).thenReturn(Optional.of("key-id"));
        when(configProvider.applicationId()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> connector().searchInstitutions("ci", "FR"))
            .isInstanceOf(SyncException.class)
            .hasMessageContaining("Application ID");
    }

    // ─── PSU type resolution ──────────────────────────────────────────────────

    /**
     * The reported bug: Swan is published under "business" only, so asking Enable
     * Banking for psu_type=personal made it invisible in the bank picker even though
     * the account existed and the credentials were valid.
     */
    @Test
    void resolvePsuType_businessWhenTheBankOffersNothingElse() {
        assertThat(EnableBankingBankConnector.resolvePsuType(List.of("business"))).isEqualTo("business");
    }

    @Test
    void resolvePsuType_prefersPersonalWheneverTheBankOffersIt() {
        assertThat(EnableBankingBankConnector.resolvePsuType(List.of("business", "personal"))).isEqualTo("personal");
    }

    /** An ASPSP that declares nothing is treated as retail — the pre-existing behaviour. */
    @Test
    void resolvePsuType_defaultsToPersonalWhenUnknown() {
        assertThat(EnableBankingBankConnector.resolvePsuType(null)).isEqualTo("personal");
        assertThat(EnableBankingBankConnector.resolvePsuType(List.of())).isEqualTo("personal");
    }

    /** An unrecognised type is passed through, not mistranslated into "business". */
    @Test
    void resolvePsuType_passesThroughAnUnknownProviderValue() {
        assertThat(EnableBankingBankConnector.resolvePsuType(List.of("corporate"))).isEqualTo("corporate");
    }

    // ─── Catalog mapping ──────────────────────────────────────────────────────

    @Test
    void toInstitutions_filtersByNameAndEncodesPsuTypeInTheId() {
        var swan = new EnableBankingBankConnector.AspspResponse(
            "Swan", "SWNBFR22", "https://logos.example/swan.png", "FR", List.of("business"));
        var bnp = new EnableBankingBankConnector.AspspResponse(
            "BNP Paribas", "BNPAFRPP", "https://logos.example/bnp.png", "FR", List.of("personal"));

        var results = EnableBankingBankConnector.toInstitutions(List.of(swan, bnp), "swan", "FR");

        assertThat(results).singleElement().satisfies(i -> {
            assertThat(i.id()).isEqualTo("Swan::FR::business");
            assertThat(i.name()).isEqualTo("Swan");
            assertThat(i.psuType()).isEqualTo("business");
            assertThat(i.country()).isEqualTo("FR");
        });
    }

    /** Enable Banking can list the same bank twice (different auth methods) -- one row, one React key. */
    @Test
    void toInstitutions_deduplicatesIdenticalCompositeIds() {
        var first = new EnableBankingBankConnector.AspspResponse(
            "Swan", "SWNBFR22", "https://logos.example/swan.png", "FR", List.of("business"));
        var duplicate = new EnableBankingBankConnector.AspspResponse(
            "Swan", "SWNBFR22", null, "FR", List.of("business"));

        var results = EnableBankingBankConnector.toInstitutions(List.of(first, duplicate), "swan", "FR");

        assertThat(results).hasSize(1);
        assertThat(results.get(0).logoUrl()).isEqualTo("https://logos.example/swan.png");
    }

    /**
     * The reverse order of the test above: keeping the first entry unconditionally would
     * publish a null logo for a bank whose second listing carries one, and the picker has
     * no second chance -- it renders whatever this returns.
     */
    @Test
    void toInstitutions_keepsTheLogoWhenOnlyTheLaterDuplicateCarriesOne() {
        var logoless = new EnableBankingBankConnector.AspspResponse(
            "Swan", "SWNBFR22", null, "FR", List.of("business"));
        var withLogo = new EnableBankingBankConnector.AspspResponse(
            "Swan", "SWNBFR22", "https://logos.example/swan.png", "FR", List.of("business"));

        var results = EnableBankingBankConnector.toInstitutions(List.of(logoless, withLogo), "swan", "FR");

        assertThat(results).hasSize(1);
        assertThat(results.get(0).logoUrl()).isEqualTo("https://logos.example/swan.png");
    }

    @Test
    void toInstitutions_fallsBackToTheRequestedCountryWhenTheAspspOmitsIt() {
        var noCountry = new EnableBankingBankConnector.AspspResponse(
            "Swan", null, null, null, List.of("business"));

        var results = EnableBankingBankConnector.toInstitutions(List.of(noCountry), "", "FR");

        assertThat(results).singleElement().satisfies(i -> {
            assertThat(i.country()).isEqualTo("FR");
            assertThat(i.id()).isEqualTo("Swan::FR::business");
        });
    }

    // ─── Institution id parsing ───────────────────────────────────────────────

    @Test
    void parseInstitutionId_readsTheThirdSegment() {
        var ref = EnableBankingBankConnector.parseInstitutionId("Swan::FR::business");

        assertThat(ref.bankName()).isEqualTo("Swan");
        assertThat(ref.country()).isEqualTo("FR");
        assertThat(ref.psuType()).isEqualTo("business");
    }

    /** Requisitions linked before PSU types existed store two segments only. */
    @Test
    void parseInstitutionId_defaultsLegacyTwoSegmentIdsToPersonal() {
        var ref = EnableBankingBankConnector.parseInstitutionId("BoursoBank::FR");

        assertThat(ref.bankName()).isEqualTo("BoursoBank");
        assertThat(ref.country()).isEqualTo("FR");
        assertThat(ref.psuType()).isEqualTo("personal");
    }

    /** The id comes off the wire and its PSU segment lands in an outbound provider request. */
    @Test
    void parseInstitutionId_coercesAnUnexpectedPsuSegmentToPersonal() {
        assertThat(EnableBankingBankConnector.parseInstitutionId("Swan::FR::../../etc").psuType())
            .isEqualTo("personal");
    }

    // ─── Transaction mapping ──────────────────────────────────────────────────

    private EnableBankingBankConnector.TransactionAmount amount(String value) {
        return new EnableBankingBankConnector.TransactionAmount(value, "EUR");
    }

    @Test
    void toTransactionData_debitIsNegated() {
        var item = new EnableBankingBankConnector.TransactionItem(
            "ref-1", null, LocalDate.of(2026, 1, 5), LocalDate.of(2026, 1, 5),
            amount("42.50"), "DBIT", List.of("Carrefour Market"), null, null);

        TransactionData result = EnableBankingBankConnector.toTransactionData(item);

        assertThat(result.amount()).isEqualByComparingTo("-42.50");
        assertThat(result.externalId()).isEqualTo("ref-1");
        assertThat(result.description()).isEqualTo("Carrefour Market");
    }

    @Test
    void toTransactionData_creditStaysPositive() {
        var item = new EnableBankingBankConnector.TransactionItem(
            "ref-2", null, LocalDate.of(2026, 1, 5), LocalDate.of(2026, 1, 5),
            amount("1500.00"), "CRDT", List.of("Salary"), null, null);

        TransactionData result = EnableBankingBankConnector.toTransactionData(item);

        assertThat(result.amount()).isEqualByComparingTo("1500.00");
    }

    @Test
    void toTransactionData_prefersBookingDateOverTransactionDate() {
        var item = new EnableBankingBankConnector.TransactionItem(
            "ref-3", null, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 3),
            amount("10"), "DBIT", List.of("Shop"), null, null);

        TransactionData result = EnableBankingBankConnector.toTransactionData(item);

        assertThat(result.date()).isEqualTo(LocalDate.of(2026, 1, 3));
    }

    @Test
    void toTransactionData_fallsBackToTransactionDateWhenBookingDateMissing() {
        var item = new EnableBankingBankConnector.TransactionItem(
            "ref-4", null, LocalDate.of(2026, 1, 1), null,
            amount("10"), "DBIT", List.of("Shop"), null, null);

        TransactionData result = EnableBankingBankConnector.toTransactionData(item);

        assertThat(result.date()).isEqualTo(LocalDate.of(2026, 1, 1));
    }

    @Test
    void toTransactionData_fallsBackToTransactionIdWhenEntryReferenceMissing() {
        var item = new EnableBankingBankConnector.TransactionItem(
            null, "txn-abc", LocalDate.of(2026, 1, 5), null,
            amount("10"), "DBIT", List.of("Shop"), null, null);

        TransactionData result = EnableBankingBankConnector.toTransactionData(item);

        assertThat(result.externalId()).isEqualTo("txn-abc");
    }

    @Test
    void toTransactionData_synthesizesIdWhenProviderGivesNeither() {
        var item = new EnableBankingBankConnector.TransactionItem(
            null, null, LocalDate.of(2026, 1, 5), null,
            amount("10"), "DBIT", List.of("Shop"), null, null);

        TransactionData result = EnableBankingBankConnector.toTransactionData(item);

        assertThat(result.externalId()).startsWith("synth:2026-01-05:-10:");
    }

    @Test
    void toTransactionData_emptyRemittanceFallsBackToCounterpartyName() {
        var debtor = new EnableBankingBankConnector.Party("Jean Dupont");
        var item = new EnableBankingBankConnector.TransactionItem(
            "ref-5", null, LocalDate.of(2026, 1, 5), null,
            amount("50"), "CRDT", List.of(), debtor, null);

        TransactionData result = EnableBankingBankConnector.toTransactionData(item);

        assertThat(result.description()).isEqualTo("Jean Dupont");
    }

    @Test
    void toTransactionData_noDescriptionAtAllFallsBackToGenericLabel() {
        var item = new EnableBankingBankConnector.TransactionItem(
            "ref-6", null, LocalDate.of(2026, 1, 5), null,
            amount("50"), "CRDT", null, null, null);

        TransactionData result = EnableBankingBankConnector.toTransactionData(item);

        assertThat(result.description()).isEqualTo("Transaction");
    }

    @Test
    void toTransactionData_missingDateReturnsNull() {
        var item = new EnableBankingBankConnector.TransactionItem(
            "ref-7", null, null, null, amount("10"), "DBIT", List.of("Shop"), null, null);

        assertThat(EnableBankingBankConnector.toTransactionData(item)).isNull();
    }

    @Test
    void toTransactionData_missingAmountReturnsNull() {
        var item = new EnableBankingBankConnector.TransactionItem(
            "ref-8", null, LocalDate.of(2026, 1, 5), null, null, "DBIT", List.of("Shop"), null, null);

        assertThat(EnableBankingBankConnector.toTransactionData(item)).isNull();
    }
}
