package com.picsou.service;

import com.picsou.dto.ExpenseDashboardResponse;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.ProStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpenseDashboardServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock ExpenseCategoryRepository expenseCategoryRepository;

    @InjectMocks ExpenseDashboardService expenseDashboardService;

    private Account account() {
        return Account.builder().id(1L).name("Revolut").type(AccountType.CHECKING)
            .currency("EUR").currentBalance(BigDecimal.ZERO).isManual(false).build();
    }

    private Transaction expense(LocalDate date, BigDecimal amount, ProStatus proStatus, Long categoryId) {
        Transaction tx = Transaction.builder().account(account()).date(date)
            .description("expense").amount(amount).isManual(false).nativeCurrency("EUR")
            .proStatus(proStatus).build();
        tx.setExpenseCategoryId(categoryId);
        return tx;
    }

    @Test
    void getDashboard_excludesCreditsFromEvolutionAndBreakdown() {
        YearMonth period = YearMonth.of(2026, 1);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("-25"), ProStatus.PERSO, null),
            expense(LocalDate.of(2026, 1, 10), new BigDecimal("500"), ProStatus.NON_CLASSE, null) // credit, must be excluded
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 8).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 6, period);

        var januaryTotal = result.monthlyEvolution().stream()
            .filter(m -> m.yearMonth().equals("2026-01")).findFirst().orElseThrow();
        assertThat(januaryTotal.total()).isEqualByComparingTo("25");
        assertThat(result.categoryBreakdown()).hasSize(1);
        assertThat(result.categoryBreakdown().get(0).total()).isEqualByComparingTo("25");
    }

    @Test
    void getDashboard_everyMonthInWindowPresentEvenAtZero() {
        YearMonth period = YearMonth.of(2026, 3);
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2026, 1).atDay(1), period.atEndOfMonth()))
            .thenReturn(List.of());
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 3, period);

        assertThat(result.monthlyEvolution()).extracting("yearMonth")
            .containsExactly("2026-01", "2026-02", "2026-03");
        assertThat(result.monthlyEvolution()).allSatisfy(m -> assertThat(m.total()).isEqualByComparingTo("0"));
    }

    @Test
    void getDashboard_uncategorizedExpensesBucketedUnderNullCategory() {
        YearMonth period = YearMonth.of(2026, 1);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("-10"), ProStatus.PERSO, null)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 8).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 6, period);

        assertThat(result.categoryBreakdown()).hasSize(1);
        assertThat(result.categoryBreakdown().get(0).categoryId()).isNull();
        assertThat(result.categoryBreakdown().get(0).categoryName()).isNull();
    }

    @Test
    void getDashboard_totalProAbsorbeScopedToPeriodOnly() {
        YearMonth period = YearMonth.of(2026, 2);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 2, 5), new BigDecimal("-30"), ProStatus.PRO_ABSORBE, null),
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("-999"), ProStatus.PRO_ABSORBE, null) // previous month, excluded
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 9).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 6, period);

        assertThat(result.totalProAbsorbe()).isEqualByComparingTo("30");
    }

    @Test
    void getDashboard_resolvesCategoryNameAndColorFromMap() {
        YearMonth period = YearMonth.of(2026, 1);
        ExpenseCategory restauration = ExpenseCategory.builder().id(1L).name("Restauration").color("#f97316").build();
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("-15"), ProStatus.PERSO, 1L)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 8).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of(restauration));

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 6, period);

        assertThat(result.categoryBreakdown().get(0).categoryName()).isEqualTo("Restauration");
        assertThat(result.categoryBreakdown().get(0).categoryColor()).isEqualTo("#f97316");
    }
}
