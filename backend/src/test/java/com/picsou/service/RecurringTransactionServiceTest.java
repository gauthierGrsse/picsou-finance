package com.picsou.service;

import com.picsou.dto.RecurringTransactionResponse;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.ProStatus;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecurringTransactionServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock ExpenseCategoryRepository expenseCategoryRepository;

    private RecurringTransactionService serviceAsOf(LocalDate today) {
        Clock fixed = Clock.fixed(today.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);
        return new RecurringTransactionService(transactionRepository, expenseCategoryRepository, fixed);
    }

    private Account account() {
        return Account.builder().id(1L).name("Compte").type(AccountType.CHECKING)
            .currency("EUR").currentBalance(BigDecimal.ZERO).isManual(false).build();
    }

    private Transaction expense(long id, LocalDate date, String description, String amount, ProStatus proStatus) {
        Transaction t = Transaction.builder().account(account()).date(date).description(description)
            .amount(new BigDecimal(amount)).isManual(false).nativeCurrency("EUR").proStatus(proStatus).build();
        t.setId(id);
        return t;
    }

    @Test
    void detectsARentLikeChargeAcrossMonthsEvenWhenTheReferenceNumberChanges() {
        LocalDate today = LocalDate.of(2026, 8, 20);
        List<Transaction> window = List.of(
            expense(1, LocalDate.of(2026, 5, 5), "PRELEVEMENT EFI PL60121 Prelt FR86ZZZ465129", "-852.92", ProStatus.PERSO),
            expense(2, LocalDate.of(2026, 6, 6), "PRELEVEMENT EFI PL60965 Prelt FR86ZZZ465129", "-852.92", ProStatus.PERSO),
            expense(3, LocalDate.of(2026, 7, 5), "PRELEVEMENT EFI PL61525 Prelt FR86ZZZ465129", "-852.92", ProStatus.PERSO)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 4, 1), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        List<RecurringTransactionResponse> result = serviceAsOf(today).getRecurring(10L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).typicalAmount()).isEqualByComparingTo("852.92");
        assertThat(result.get(0).monthsSeen()).isEqualTo(3);
        assertThat(result.get(0).typicalDayOfMonth()).isEqualTo(5);
        assertThat(result.get(0).dueThisMonth()).isFalse(); // nothing in August yet
        assertThat(result.get(0).expectedDate()).isEqualTo(LocalDate.of(2026, 8, 5));
        assertThat(result.get(0).previousAmount()).isNull();
    }

    @Test
    void ignoresAChargeSeenInFewerThanThreeMonths() {
        LocalDate today = LocalDate.of(2026, 8, 20);
        List<Transaction> window = List.of(
            expense(1, LocalDate.of(2026, 6, 5), "Netflix", "-13.49", ProStatus.PERSO),
            expense(2, LocalDate.of(2026, 7, 5), "Netflix", "-13.49", ProStatus.PERSO)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 4, 1), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        assertThat(serviceAsOf(today).getRecurring(10L)).isEmpty();
    }

    @Test
    void ignoresAGroupWhoseAmountsVaryTooMuch() {
        LocalDate today = LocalDate.of(2026, 8, 20);
        List<Transaction> window = List.of(
            expense(1, LocalDate.of(2026, 5, 4), "CB CARREFOUR MARKET", "-42.10", ProStatus.PERSO),
            expense(2, LocalDate.of(2026, 6, 11), "CB CARREFOUR MARKET", "-118.00", ProStatus.PERSO),
            expense(3, LocalDate.of(2026, 7, 19), "CB CARREFOUR MARKET", "-7.30", ProStatus.PERSO),
            expense(4, LocalDate.of(2026, 8, 2), "CB CARREFOUR MARKET", "-64.55", ProStatus.PERSO)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 4, 1), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        assertThat(serviceAsOf(today).getRecurring(10L)).isEmpty();
    }

    @Test
    void flagsASilentPriceChangeOnTheLatestOccurrence() {
        LocalDate today = LocalDate.of(2026, 8, 20);
        List<Transaction> window = List.of(
            expense(1, LocalDate.of(2026, 5, 5), "PRELEVEMENT EFI Prelt", "-852.92", ProStatus.PERSO),
            expense(2, LocalDate.of(2026, 6, 5), "PRELEVEMENT EFI Prelt", "-852.92", ProStatus.PERSO),
            expense(3, LocalDate.of(2026, 7, 5), "PRELEVEMENT EFI Prelt", "-852.92", ProStatus.PERSO),
            expense(4, LocalDate.of(2026, 8, 5), "PRELEVEMENT EFI Prelt", "-865.01", ProStatus.PERSO)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 4, 1), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        List<RecurringTransactionResponse> result = serviceAsOf(today).getRecurring(10L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).typicalAmount()).isEqualByComparingTo("865.01");
        assertThat(result.get(0).previousAmount()).isEqualByComparingTo("852.92");
        assertThat(result.get(0).dueThisMonth()).isTrue();
    }

    @Test
    void sortsBiggestRecurringChargeFirstAndSkipsExcludedTransactions() {
        LocalDate today = LocalDate.of(2026, 8, 20);
        List<Transaction> window = new ArrayList<>();
        for (int m = 5; m <= 7; m++) {
            window.add(expense(m, LocalDate.of(2026, m, 5), "PRELEVEMENT EFI Prelt", "-850.00", ProStatus.PERSO));
            window.add(expense(10 + m, LocalDate.of(2026, m, 12), "Netflix", "-13.49", ProStatus.PERSO));
            window.add(expense(20 + m, LocalDate.of(2026, m, 15), "VIREMENT vers Gauthier", "-600.00", ProStatus.VIREMENT_INTERNE));
        }
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 4, 1), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        List<RecurringTransactionResponse> result = serviceAsOf(today).getRecurring(10L);

        assertThat(result).extracting(RecurringTransactionResponse::typicalAmount)
            .containsExactly(new BigDecimal("850.00"), new BigDecimal("13.49"));
        assertThat(result).noneMatch(r -> r.label().contains("VIREMENT")); // internal transfers excluded
    }

    @Test
    void excludesReimbursedProExpenses() {
        LocalDate today = LocalDate.of(2026, 8, 20);
        List<Transaction> window = new ArrayList<>();
        for (int m = 5; m <= 7; m++) {
            Transaction t = expense(m, LocalDate.of(2026, m, 5), "Abonnement pro", "-40.00", ProStatus.PRO_A_REMBOURSER);
            t.setReimbursementStatus(ReimbursementStatus.REMBOURSE);
            window.add(t);
        }
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 4, 1), today)).thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        assertThat(serviceAsOf(today).getRecurring(10L)).isEmpty();
    }
}
