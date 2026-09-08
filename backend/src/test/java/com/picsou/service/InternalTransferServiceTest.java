package com.picsou.service;

import com.picsou.dto.SuggestedTransferPairResponse;
import com.picsou.dto.TransactionResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.ProStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.AccountRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InternalTransferServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock AccountRepository accountRepository;
    @Mock ManualTransactionService manualTransactionService;

    @InjectMocks InternalTransferService internalTransferService;

    private Account account(Long id) {
        return account(id, false);
    }

    private Account account(Long id, boolean isManual) {
        return Account.builder().id(id).name("Account " + id).type(AccountType.CHECKING)
            .currency("EUR").currentBalance(BigDecimal.ZERO).isManual(isManual).build();
    }

    private Transaction tx(Long id, Account account, LocalDate date, BigDecimal amount, String externalId) {
        return Transaction.builder().id(id).account(account).date(date)
            .description("tx").amount(amount).isManual(false).nativeCurrency("EUR")
            .proStatus(ProStatus.NON_CLASSE).externalTransactionId(externalId).build();
    }

    // ─── autoLinkByReference ────────────────────────────────────────────────

    @Test
    void autoLinkByReference_linksPairSharingReferenceWithOppositeAmounts() {
        Account petiteMonnaie = account(1L);
        Account courant = account(2L);
        Transaction a = tx(10L, petiteMonnaie, LocalDate.of(2026, 8, 24), new BigDecimal("0.26"), "shared-ref");
        Transaction b = tx(20L, courant, LocalDate.of(2026, 8, 24), new BigDecimal("-0.26"), "shared-ref");

        when(transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(10L, ProStatus.NON_CLASSE))
            .thenReturn(List.of(a, b));

        int linked = internalTransferService.autoLinkByReference(10L);

        assertThat(linked).isEqualTo(1);
        assertThat(a.getProStatus()).isEqualTo(ProStatus.VIREMENT_INTERNE);
        assertThat(a.getLinkedTransactionId()).isEqualTo(20L);
        assertThat(b.getProStatus()).isEqualTo(ProStatus.VIREMENT_INTERNE);
        assertThat(b.getLinkedTransactionId()).isEqualTo(10L);
        verify(transactionRepository).save(a);
        verify(transactionRepository).save(b);
    }

    @Test
    void autoLinkByReference_ignoresASoleTransactionWithNoPartner() {
        Account account = account(1L);
        Transaction a = tx(10L, account, LocalDate.of(2026, 8, 24), new BigDecimal("0.26"), "lonely-ref");

        when(transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(10L, ProStatus.NON_CLASSE))
            .thenReturn(List.of(a));

        int linked = internalTransferService.autoLinkByReference(10L);

        assertThat(linked).isZero();
        assertThat(a.getProStatus()).isEqualTo(ProStatus.NON_CLASSE);
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void autoLinkByReference_skipsSharedReferenceWhenAmountsDoNotMatch() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        // Same reference but NOT opposite amounts -- defensive, must not link on reference alone.
        Transaction a = tx(10L, accountA, LocalDate.of(2026, 8, 24), new BigDecimal("5.00"), "weird-ref");
        Transaction b = tx(20L, accountB, LocalDate.of(2026, 8, 24), new BigDecimal("3.00"), "weird-ref");

        when(transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(10L, ProStatus.NON_CLASSE))
            .thenReturn(List.of(a, b));

        int linked = internalTransferService.autoLinkByReference(10L);

        assertThat(linked).isZero();
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void autoLinkByReference_ignoresTransactionsWithNoExternalId() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        Transaction a = tx(10L, accountA, LocalDate.of(2026, 8, 24), new BigDecimal("5.00"), null);
        Transaction b = tx(20L, accountB, LocalDate.of(2026, 8, 24), new BigDecimal("-5.00"), null);

        when(transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(10L, ProStatus.NON_CLASSE))
            .thenReturn(List.of(a, b));

        int linked = internalTransferService.autoLinkByReference(10L);

        assertThat(linked).isZero();
    }

    // ─── findCandidates ─────────────────────────────────────────────────────

    @Test
    void findCandidates_returnsUnclassifiedUnlinkedPoolSortedByDateDescending() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        Transaction older = tx(10L, accountA, LocalDate.of(2026, 8, 1), new BigDecimal("-40.00"), null);
        Transaction newer = tx(20L, accountB, LocalDate.of(2026, 8, 20), new BigDecimal("40.00"), null);

        when(transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(10L, ProStatus.NON_CLASSE))
            .thenReturn(List.of(older, newer));

        List<com.picsou.dto.TransactionResponse> candidates = internalTransferService.findCandidates(10L);

        assertThat(candidates).extracting(com.picsou.dto.TransactionResponse::id).containsExactly(20L, 10L);
    }

    // ─── findSuggestions ────────────────────────────────────────────────────

    @Test
    void findSuggestions_matchesOppositeAmountsAcrossAccountsWithinWindow() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        Transaction a = tx(10L, accountA, LocalDate.of(2026, 8, 24), new BigDecimal("-40.00"), null);
        Transaction b = tx(20L, accountB, LocalDate.of(2026, 8, 25), new BigDecimal("40.00"), null);

        when(transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(10L, ProStatus.NON_CLASSE))
            .thenReturn(List.of(a, b));

        List<SuggestedTransferPairResponse> suggestions = internalTransferService.findSuggestions(10L);

        assertThat(suggestions).hasSize(1);
    }

    @Test
    void findSuggestions_excludesPairsFromTheSameAccount() {
        Account account = account(1L);
        Transaction a = tx(10L, account, LocalDate.of(2026, 8, 24), new BigDecimal("-40.00"), null);
        Transaction b = tx(20L, account, LocalDate.of(2026, 8, 24), new BigDecimal("40.00"), null);

        when(transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(10L, ProStatus.NON_CLASSE))
            .thenReturn(List.of(a, b));

        assertThat(internalTransferService.findSuggestions(10L)).isEmpty();
    }

    @Test
    void findSuggestions_excludesPairsOutsideTheDateWindow() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        Transaction a = tx(10L, accountA, LocalDate.of(2026, 8, 1), new BigDecimal("-40.00"), null);
        Transaction b = tx(20L, accountB, LocalDate.of(2026, 8, 20), new BigDecimal("40.00"), null);

        when(transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(10L, ProStatus.NON_CLASSE))
            .thenReturn(List.of(a, b));

        assertThat(internalTransferService.findSuggestions(10L)).isEmpty();
    }

    @Test
    void findSuggestions_eachTransactionClaimedByAtMostOnePair() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        Account accountC = account(3L);
        // Three -40/-40/+40/+40-shaped transactions where a naive approach could double-count.
        Transaction a = tx(10L, accountA, LocalDate.of(2026, 8, 24), new BigDecimal("-40.00"), null);
        Transaction b = tx(20L, accountB, LocalDate.of(2026, 8, 24), new BigDecimal("40.00"), null);
        Transaction c = tx(30L, accountC, LocalDate.of(2026, 8, 24), new BigDecimal("40.00"), null);

        when(transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(10L, ProStatus.NON_CLASSE))
            .thenReturn(List.of(a, b, c));

        List<SuggestedTransferPairResponse> suggestions = internalTransferService.findSuggestions(10L);

        // Exactly one pair -- the third (unmatched) transaction is never double-claimed.
        assertThat(suggestions).hasSize(1);
    }

    // ─── confirmLink ────────────────────────────────────────────────────────

    @Test
    void confirmLink_rejectsSameAccount() {
        Account account = account(1L);
        Transaction a = tx(10L, account, LocalDate.now(), new BigDecimal("-10"), null);
        Transaction b = tx(20L, account, LocalDate.now(), new BigDecimal("10"), null);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));
        when(transactionRepository.findByIdAndAccount_Member_Id(20L, 1L)).thenReturn(java.util.Optional.of(b));

        assertThatThrownBy(() -> internalTransferService.confirmLink(10L, 20L, 1L, false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("same account");
    }

    @Test
    void confirmLink_rejectsNonOppositeAmounts() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        Transaction a = tx(10L, accountA, LocalDate.now(), new BigDecimal("-10"), null);
        Transaction b = tx(20L, accountB, LocalDate.now(), new BigDecimal("15"), null);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));
        when(transactionRepository.findByIdAndAccount_Member_Id(20L, 1L)).thenReturn(java.util.Optional.of(b));

        assertThatThrownBy(() -> internalTransferService.confirmLink(10L, 20L, 1L, false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("opposite");
    }

    @Test
    void confirmLink_rejectsAlreadyLinkedTransaction() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        Transaction a = tx(10L, accountA, LocalDate.now(), new BigDecimal("-10"), null);
        a.setLinkedTransactionId(99L);
        Transaction b = tx(20L, accountB, LocalDate.now(), new BigDecimal("10"), null);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));
        when(transactionRepository.findByIdAndAccount_Member_Id(20L, 1L)).thenReturn(java.util.Optional.of(b));

        assertThatThrownBy(() -> internalTransferService.confirmLink(10L, 20L, 1L, false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already linked");
    }

    @Test
    void confirmLink_success() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        Transaction a = tx(10L, accountA, LocalDate.now(), new BigDecimal("-10"), null);
        Transaction b = tx(20L, accountB, LocalDate.now(), new BigDecimal("10"), null);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));
        when(transactionRepository.findByIdAndAccount_Member_Id(20L, 1L)).thenReturn(java.util.Optional.of(b));

        internalTransferService.confirmLink(10L, 20L, 1L, false);

        assertThat(a.getProStatus()).isEqualTo(ProStatus.VIREMENT_INTERNE);
        assertThat(a.getLinkedTransactionId()).isEqualTo(20L);
        assertThat(b.getProStatus()).isEqualTo(ProStatus.VIREMENT_INTERNE);
        assertThat(b.getLinkedTransactionId()).isEqualTo(10L);
    }

    @Test
    void confirmLink_allowAmountMismatch_linksDespiteDifferentAmounts() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        // A wire that settles for a different figure on the other side (brokerage fees, FX).
        Transaction a = tx(10L, accountA, LocalDate.now(), new BigDecimal("-1000.00"), null);
        Transaction b = tx(20L, accountB, LocalDate.now(), new BigDecimal("950.00"), null);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));
        when(transactionRepository.findByIdAndAccount_Member_Id(20L, 1L)).thenReturn(java.util.Optional.of(b));

        internalTransferService.confirmLink(10L, 20L, 1L, true);

        assertThat(a.getProStatus()).isEqualTo(ProStatus.VIREMENT_INTERNE);
        assertThat(a.getLinkedTransactionId()).isEqualTo(20L);
        assertThat(b.getProStatus()).isEqualTo(ProStatus.VIREMENT_INTERNE);
        assertThat(b.getLinkedTransactionId()).isEqualTo(10L);
    }

    @Test
    void confirmLink_allowAmountMismatch_stillRejectsSameAccount() {
        Account account = account(1L);
        Transaction a = tx(10L, account, LocalDate.now(), new BigDecimal("-10"), null);
        Transaction b = tx(20L, account, LocalDate.now(), new BigDecimal("999"), null);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));
        when(transactionRepository.findByIdAndAccount_Member_Id(20L, 1L)).thenReturn(java.util.Optional.of(b));

        assertThatThrownBy(() -> internalTransferService.confirmLink(10L, 20L, 1L, true))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("same account");
    }

    // ─── unlink ─────────────────────────────────────────────────────────────

    @Test
    void unlink_revertsBothLegsToNonClasse() {
        Account accountA = account(1L);
        Account accountB = account(2L);
        Transaction a = tx(10L, accountA, LocalDate.now(), new BigDecimal("-10"), null);
        a.setProStatus(ProStatus.VIREMENT_INTERNE);
        a.setLinkedTransactionId(20L);
        Transaction b = tx(20L, accountB, LocalDate.now(), new BigDecimal("10"), null);
        b.setProStatus(ProStatus.VIREMENT_INTERNE);
        b.setLinkedTransactionId(10L);

        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));
        when(transactionRepository.findByIdAndAccount_Member_Id(20L, 1L)).thenReturn(java.util.Optional.of(b));

        internalTransferService.unlink(10L, 1L);

        assertThat(a.getProStatus()).isEqualTo(ProStatus.NON_CLASSE);
        assertThat(a.getLinkedTransactionId()).isNull();
        assertThat(b.getProStatus()).isEqualTo(ProStatus.NON_CLASSE);
        assertThat(b.getLinkedTransactionId()).isNull();
    }

    @Test
    void unlink_throwsWhenTransactionNotMarkedAsTransfer() {
        Account account = account(1L);
        Transaction a = tx(10L, account, LocalDate.now(), new BigDecimal("-10"), null);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));

        assertThatThrownBy(() -> internalTransferService.unlink(10L, 1L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not marked as an internal transfer");
    }

    @Test
    void unlink_revertsASoloMarkWithNoCounterpartRow() {
        Account account = account(1L);
        Transaction a = tx(10L, account, LocalDate.now(), new BigDecimal("-10"), null);
        a.setProStatus(ProStatus.VIREMENT_INTERNE);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));

        internalTransferService.unlink(10L, 1L);

        assertThat(a.getProStatus()).isEqualTo(ProStatus.NON_CLASSE);
        assertThat(a.getLinkedTransactionId()).isNull();
        verify(transactionRepository, times(1)).save(any());
    }

    // ─── markWithoutMatch ───────────────────────────────────────────────────

    @Test
    void markWithoutMatch_setsVirementInterneWithNoLinkedTransaction() {
        Account account = account(1L);
        Transaction a = tx(10L, account, LocalDate.now(), new BigDecimal("-500"), null);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));

        internalTransferService.markWithoutMatch(10L, 1L);

        assertThat(a.getProStatus()).isEqualTo(ProStatus.VIREMENT_INTERNE);
        assertThat(a.getLinkedTransactionId()).isNull();
        verify(transactionRepository).save(a);
    }

    @Test
    void markWithoutMatch_rejectsAlreadyMarkedTransaction() {
        Account account = account(1L);
        Transaction a = tx(10L, account, LocalDate.now(), new BigDecimal("-500"), null);
        a.setProStatus(ProStatus.VIREMENT_INTERNE);
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.of(a));

        assertThatThrownBy(() -> internalTransferService.markWithoutMatch(10L, 1L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already marked");
    }

    @Test
    void confirmLink_unknownTransaction_throwsNotFound() {
        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> internalTransferService.confirmLink(10L, 20L, 1L, false))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    // ─── linkToNewManualTransaction ─────────────────────────────────────────

    @Test
    void linkToNewManualTransaction_createsOppositeAmountAndLinksBothSides() {
        Account sourceAccount = account(1L);
        Account targetAccount = account(2L, true);
        Transaction source = tx(10L, sourceAccount, LocalDate.of(2026, 3, 1), new BigDecimal("-400"), null);
        Transaction target = tx(20L, targetAccount, LocalDate.of(2026, 3, 1), new BigDecimal("400"), null);

        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(Optional.of(source));
        when(accountRepository.findByIdAndMemberId(2L, 1L)).thenReturn(Optional.of(targetAccount));
        when(manualTransactionService.addTransaction(eq(2L), eq(1L), any()))
            .thenReturn(TransactionResponse.from(target));
        when(transactionRepository.findByIdAndAccount_Member_Id(20L, 1L)).thenReturn(Optional.of(target));

        TransactionResponse result = internalTransferService.linkToNewManualTransaction(
            10L, 2L, 1L, "Vers compte manuel", LocalDate.of(2026, 3, 1));

        assertThat(result.id()).isEqualTo(20L);
        assertThat(source.getProStatus()).isEqualTo(ProStatus.VIREMENT_INTERNE);
        assertThat(source.getLinkedTransactionId()).isEqualTo(20L);
        assertThat(target.getProStatus()).isEqualTo(ProStatus.VIREMENT_INTERNE);
        assertThat(target.getLinkedTransactionId()).isEqualTo(10L);

        ArgumentCaptor<com.picsou.dto.TransactionRequest> reqCaptor =
            ArgumentCaptor.forClass(com.picsou.dto.TransactionRequest.class);
        verify(manualTransactionService).addTransaction(eq(2L), eq(1L), reqCaptor.capture());
        // Opposite of the source's -400: the two sides of one transfer are zero-sum.
        assertThat(reqCaptor.getValue().amount()).isEqualByComparingTo("400");
        assertThat(reqCaptor.getValue().description()).isEqualTo("Vers compte manuel");
    }

    @Test
    void linkToNewManualTransaction_rejectsNonManualTarget() {
        Account sourceAccount = account(1L);
        Account targetAccount = account(2L, false); // synced, not manual
        Transaction source = tx(10L, sourceAccount, LocalDate.now(), new BigDecimal("-400"), null);

        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(Optional.of(source));
        when(accountRepository.findByIdAndMemberId(2L, 1L)).thenReturn(Optional.of(targetAccount));

        assertThatThrownBy(() -> internalTransferService.linkToNewManualTransaction(
            10L, 2L, 1L, "desc", LocalDate.now()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("manual account");
        verify(manualTransactionService, never()).addTransaction(any(), any(), any());
    }

    @Test
    void linkToNewManualTransaction_rejectsSameAccount() {
        Account sharedAccount = account(1L, true);
        Transaction source = tx(10L, sharedAccount, LocalDate.now(), new BigDecimal("-400"), null);

        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(Optional.of(source));
        when(accountRepository.findByIdAndMemberId(1L, 1L)).thenReturn(Optional.of(sharedAccount));

        assertThatThrownBy(() -> internalTransferService.linkToNewManualTransaction(
            10L, 1L, 1L, "desc", LocalDate.now()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("same account");
    }

    @Test
    void linkToNewManualTransaction_rejectsAlreadyLinkedSource() {
        Account sourceAccount = account(1L);
        Account targetAccount = account(2L, true);
        Transaction source = tx(10L, sourceAccount, LocalDate.now(), new BigDecimal("-400"), null);
        source.setProStatus(ProStatus.VIREMENT_INTERNE);

        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(Optional.of(source));
        when(accountRepository.findByIdAndMemberId(2L, 1L)).thenReturn(Optional.of(targetAccount));

        assertThatThrownBy(() -> internalTransferService.linkToNewManualTransaction(
            10L, 2L, 1L, "desc", LocalDate.now()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already marked");
        verify(manualTransactionService, never()).addTransaction(any(), any(), any());
    }

    @Test
    void linkToNewManualTransaction_unknownTargetAccount_throwsNotFound() {
        Account sourceAccount = account(1L);
        Transaction source = tx(10L, sourceAccount, LocalDate.now(), new BigDecimal("-400"), null);

        when(transactionRepository.findByIdAndAccount_Member_Id(10L, 1L)).thenReturn(Optional.of(source));
        when(accountRepository.findByIdAndMemberId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> internalTransferService.linkToNewManualTransaction(
            10L, 99L, 1L, "desc", LocalDate.now()))
            .isInstanceOf(ResourceNotFoundException.class);
    }
}
