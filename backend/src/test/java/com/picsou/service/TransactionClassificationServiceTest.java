package com.picsou.service;

import com.picsou.dto.TransactionClassificationRequest;
import com.picsou.dto.TransactionResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.ProStatus;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.AccountRepository;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionClassificationServiceTest {

    @Mock AccountRepository accountRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock ExpenseCategoryRepository expenseCategoryRepository;

    @InjectMocks TransactionClassificationService transactionClassificationService;

    private Account syncedAccount() {
        // The primary real-world case: a synced (non-manual) Revolut-style checking account.
        return Account.builder().id(1L).name("Revolut").type(AccountType.CHECKING)
            .currency("EUR").currentBalance(BigDecimal.ZERO).isManual(false).build();
    }

    private Transaction syncedTransaction(Account account) {
        return Transaction.builder()
            .id(7L).account(account).date(LocalDate.of(2026, 1, 5))
            .description("Restaurant").amount(new BigDecimal("-25"))
            .isManual(false).nativeCurrency("EUR").proStatus(ProStatus.NON_CLASSE)
            .build();
    }

    @Test
    void updateClassification_syncedTransaction_setsCategoryAndStatus() {
        Account account = syncedAccount();
        Transaction tx = syncedTransaction(account);
        ExpenseCategory category = ExpenseCategory.builder().id(3L).name("Restauration").color("#f97316").build();

        when(accountRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.of(account));
        when(transactionRepository.findByIdAndAccountId(7L, 1L)).thenReturn(Optional.of(tx));
        when(expenseCategoryRepository.findByIdAndMemberId(3L, 10L)).thenReturn(Optional.of(category));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));

        TransactionResponse result = transactionClassificationService.updateClassification(
            1L, 7L, 10L, new TransactionClassificationRequest(ProStatus.PERSO, 3L));

        // Classification succeeds on a synced transaction -- unlike ManualTransactionService's
        // core-field edit, which is blocked for non-manual rows.
        assertThat(result.proStatus()).isEqualTo(ProStatus.PERSO);
        assertThat(result.expenseCategoryId()).isEqualTo(3L);
    }

    @Test
    void updateClassification_toProARembourser_defaultsReimbursementStatusToEnAttente() {
        Account account = syncedAccount();
        Transaction tx = syncedTransaction(account);

        when(accountRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.of(account));
        when(transactionRepository.findByIdAndAccountId(7L, 1L)).thenReturn(Optional.of(tx));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));

        TransactionResponse result = transactionClassificationService.updateClassification(
            1L, 7L, 10L, new TransactionClassificationRequest(ProStatus.PRO_A_REMBOURSER, null));

        assertThat(result.proStatus()).isEqualTo(ProStatus.PRO_A_REMBOURSER);
        assertThat(result.reimbursementStatus()).isEqualTo(ReimbursementStatus.EN_ATTENTE);
    }

    @Test
    void updateClassification_leavingProARembourser_autoUnlinksReimbursement() {
        Account account = syncedAccount();
        Transaction tx = syncedTransaction(account);
        tx.setProStatus(ProStatus.PRO_A_REMBOURSER);
        tx.setReimbursementStatus(ReimbursementStatus.REMBOURSE);
        tx.setReimbursementId(99L);

        when(accountRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.of(account));
        when(transactionRepository.findByIdAndAccountId(7L, 1L)).thenReturn(Optional.of(tx));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));

        TransactionResponse result = transactionClassificationService.updateClassification(
            1L, 7L, 10L, new TransactionClassificationRequest(ProStatus.PERSO, null));

        assertThat(result.reimbursementId()).isNull();
        assertThat(result.reimbursementStatus()).isNull();
    }

    @Test
    void updateClassification_unknownCategory_throwsNotFound() {
        Account account = syncedAccount();
        Transaction tx = syncedTransaction(account);

        when(accountRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.of(account));
        when(transactionRepository.findByIdAndAccountId(7L, 1L)).thenReturn(Optional.of(tx));
        when(expenseCategoryRepository.findByIdAndMemberId(999L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> transactionClassificationService.updateClassification(
            1L, 7L, 10L, new TransactionClassificationRequest(ProStatus.PERSO, 999L)))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void updateClassification_wrongAccount_throwsNotFound() {
        when(accountRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> transactionClassificationService.updateClassification(
            1L, 7L, 10L, new TransactionClassificationRequest(ProStatus.PERSO, null)))
            .isInstanceOf(ResourceNotFoundException.class);
    }
}
