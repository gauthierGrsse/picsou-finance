package com.picsou.service;

import com.picsou.dto.ExpenseDashboardResponse;
import com.picsou.dto.ExpensePaceResponse;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.Budget;
import com.picsou.model.Category;
import com.picsou.model.CategoryKind;
import com.picsou.model.ProStatus;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.BudgetRepository;
import com.picsou.repository.CategoryRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpenseDashboardServiceTest {

    @Mock TransactionRepository transactionRepository;
    @Mock CategoryRepository categoryRepository;
    @Mock BudgetRepository budgetRepository;
    @Mock Clock clock;

    @InjectMocks ExpenseDashboardService expenseDashboardService;

    /** getDashboard() never reads the clock, so the shared @InjectMocks instance (with an
     * unstubbed Clock mock) covers it. getPace() reads "today" from it, so its tests build
     * their own instance pinned to a fixed date instead of stubbing the mock's Instant/ZoneId. */
    private ExpenseDashboardService serviceAsOf(LocalDate today) {
        Clock fixed = Clock.fixed(today.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);
        return new ExpenseDashboardService(transactionRepository, categoryRepository, budgetRepository, fixed);
    }

    private Account account() {
        return Account.builder().id(1L).name("Revolut").type(AccountType.CHECKING)
            .currency("EUR").currentBalance(BigDecimal.ZERO).isManual(false).build();
    }

    private Transaction expense(LocalDate date, BigDecimal amount, ProStatus proStatus, Long categoryId) {
        return expense(date, amount, proStatus, categoryId, null);
    }

    private Transaction expense(LocalDate date, BigDecimal amount, ProStatus proStatus, Long categoryId, ReimbursementStatus reimbursementStatus) {
        Transaction tx = Transaction.builder().account(account()).date(date)
            .description("expense").amount(amount).isManual(false).nativeCurrency("EUR")
            .proStatus(proStatus).reimbursementStatus(reimbursementStatus).build();
        if (categoryId != null) {
            tx.setCategoryRef(Category.builder().id(categoryId).build());
        }
        return tx;
    }

    @Test
    void getDashboard_excludesInternalTransfersFromEvolutionAndBreakdown() {
        YearMonth period = YearMonth.of(2026, 1);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("-25"), ProStatus.PERSO, null),
            expense(LocalDate.of(2026, 1, 6), new BigDecimal("-100"), ProStatus.VIREMENT_INTERNE, null)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 8).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        var result = expenseDashboardService.getDashboard(10L, 6, period.atDay(1), period.atEndOfMonth(), false);

        var januaryTotal = result.monthlyEvolution().stream()
            .filter(m -> m.yearMonth().equals("2026-01")).findFirst().orElseThrow();
        assertThat(januaryTotal.total()).isEqualByComparingTo("25");
        assertThat(result.categoryBreakdown()).hasSize(1);
        assertThat(result.categoryBreakdown().get(0).proStatus()).isEqualTo(ProStatus.PERSO);
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
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 6, period.atDay(1), period.atEndOfMonth(), false);

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
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 3, period.atDay(1), period.atEndOfMonth(), false);

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
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 6, period.atDay(1), period.atEndOfMonth(), false);

        assertThat(result.categoryBreakdown()).hasSize(1);
        assertThat(result.categoryBreakdown().get(0).categoryId()).isNull();
        assertThat(result.categoryBreakdown().get(0).categoryName()).isNull();
    }

    @Test
    void getDashboard_excludesReimbursedProExpensesButKeepsPendingOnes() {
        YearMonth period = YearMonth.of(2026, 1);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("-40"), ProStatus.PRO_A_REMBOURSER, null, ReimbursementStatus.REMBOURSE),
            expense(LocalDate.of(2026, 1, 6), new BigDecimal("-15"), ProStatus.PRO_A_REMBOURSER, null, ReimbursementStatus.EN_ATTENTE),
            expense(LocalDate.of(2026, 1, 7), new BigDecimal("-15"), ProStatus.PRO_A_REMBOURSER, null, null)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 8).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        var result = expenseDashboardService.getDashboard(10L, 6, period.atDay(1), period.atEndOfMonth(), false);

        var januaryTotal = result.monthlyEvolution().stream()
            .filter(m -> m.yearMonth().equals("2026-01")).findFirst().orElseThrow();
        assertThat(januaryTotal.total()).isEqualByComparingTo("30");
        assertThat(result.categoryBreakdown()).hasSize(1);
        assertThat(result.categoryBreakdown().get(0).total()).isEqualByComparingTo("30");
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
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 6, period.atDay(1), period.atEndOfMonth(), false);

        assertThat(result.totalProAbsorbe()).isEqualByComparingTo("30");
    }

    @Test
    void getDashboard_yearRangeAggregatesBreakdownAcrossAllTwelveMonths() {
        LocalDate periodStart = LocalDate.of(2026, 1, 1);
        LocalDate periodEnd = LocalDate.of(2026, 12, 31);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("-25"), ProStatus.PERSO, null),
            expense(LocalDate.of(2026, 7, 15), new BigDecimal("-40"), ProStatus.PERSO, null),
            expense(LocalDate.of(2025, 12, 20), new BigDecimal("-999"), ProStatus.PERSO, null) // just before the year, excluded
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, periodStart, periodEnd))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 12, periodStart, periodEnd, false);

        assertThat(result.monthlyEvolution()).hasSize(12);
        assertThat(result.categoryBreakdown()).hasSize(1);
        assertThat(result.categoryBreakdown().get(0).total()).isEqualByComparingTo("65");
    }

    @Test
    void getDashboard_queriesTheWiderOfEvolutionWindowAndPeriodRange() {
        // months=1 makes the trailing evolution window narrower than the requested year
        // range -- the repository call must still cover the full period, not just the window.
        LocalDate periodStart = LocalDate.of(2026, 1, 1);
        LocalDate periodEnd = LocalDate.of(2026, 12, 31);
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, periodStart, periodEnd))
            .thenReturn(List.of());
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        expenseDashboardService.getDashboard(10L, 1, periodStart, periodEnd, false);

        verify(transactionRepository).findByAccount_Member_IdAndDateBetween(10L, periodStart, periodEnd);
    }

    @Test
    void getDashboard_resolvesCategoryNameAndColorFromMap() {
        YearMonth period = YearMonth.of(2026, 1);
        Category restauration = Category.builder().id(1L).name("Restauration").kind(CategoryKind.EXPENSE).color("#f97316").build();
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("-15"), ProStatus.PERSO, 1L)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 8).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of(restauration));

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 6, period.atDay(1), period.atEndOfMonth(), false);

        assertThat(result.categoryBreakdown().get(0).categoryName()).isEqualTo("Restauration");
        assertThat(result.categoryBreakdown().get(0).categoryColor()).isEqualTo("#f97316");
    }

    @Test
    void getDashboard_excludesTransactionsFiledUnderATransferCategory() {
        YearMonth period = YearMonth.of(2026, 1);
        Category epargne = Category.builder().id(5L).name("Épargne").kind(CategoryKind.TRANSFER).build();
        Category courses = Category.builder().id(6L).name("Courses").kind(CategoryKind.EXPENSE).color("#22c55e").build();
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("-200"), ProStatus.PERSO, 5L),
            expense(LocalDate.of(2026, 1, 6), new BigDecimal("-30"), ProStatus.PERSO, 6L)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 8).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of(epargne, courses));

        ExpenseDashboardResponse result = expenseDashboardService.getDashboard(10L, 6, period.atDay(1), period.atEndOfMonth(), false);

        assertThat(result.categoryBreakdown()).hasSize(1);
        assertThat(result.categoryBreakdown().get(0).categoryName()).isEqualTo("Courses");
        assertThat(result.monthlyEvolution().get(result.monthlyEvolution().size() - 1).total()).isEqualByComparingTo("30");
    }

    @Test
    void getPace_excludesTransactionsFiledUnderATransferCategory() {
        LocalDate today = LocalDate.of(2026, 8, 10);
        Category invest = Category.builder().id(5L).name("Investissement").kind(CategoryKind.TRANSFER).build();
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 8, 3), new BigDecimal("-500"), ProStatus.PERSO, 5L),
            expense(LocalDate.of(2026, 8, 4), new BigDecimal("-20"), ProStatus.PERSO, null)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 7, 1), today)).thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of(invest));

        ExpensePaceResponse result = serviceAsOf(today).getPace(10L, 1);

        assertThat(result.currentMonthCumulative()).isEqualByComparingTo("20");
    }

    // ─── income=true ────────────────────────────────────────────────────────

    @Test
    void getDashboard_income_includesOnlyPositiveAmountsAndExcludesExpenses() {
        YearMonth period = YearMonth.of(2026, 1);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("2500"), ProStatus.NON_CLASSE, null), // salary
            expense(LocalDate.of(2026, 1, 6), new BigDecimal("-25"), ProStatus.PERSO, null) // expense, excluded
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 8).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        var result = expenseDashboardService.getDashboard(10L, 6, period.atDay(1), period.atEndOfMonth(), true);

        var januaryTotal = result.monthlyEvolution().stream()
            .filter(m -> m.yearMonth().equals("2026-01")).findFirst().orElseThrow();
        assertThat(januaryTotal.total()).isEqualByComparingTo("2500");
        assertThat(result.categoryBreakdown()).hasSize(1);
        assertThat(result.categoryBreakdown().get(0).total()).isEqualByComparingTo("2500");
    }

    // ─── getPace() ──────────────────────────────────────────────────────────

    @Test
    void getPace_comparesTodaysCumulativeToHistoricalAverageAtTheSameDayOfMonth() {
        LocalDate today = LocalDate.of(2026, 8, 10);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 6, 3), new BigDecimal("-100"), ProStatus.PERSO, null),  // within June's day-10 cutoff
            expense(LocalDate.of(2026, 6, 15), new BigDecimal("-50"), ProStatus.PERSO, null),  // after cutoff, excluded
            expense(LocalDate.of(2026, 7, 5), new BigDecimal("-80"), ProStatus.PERSO, null),   // within July's day-10 cutoff
            expense(LocalDate.of(2026, 7, 20), new BigDecimal("-30"), ProStatus.PERSO, null),  // after cutoff, excluded
            expense(LocalDate.of(2026, 8, 1), new BigDecimal("-60"), ProStatus.PERSO, null),
            expense(LocalDate.of(2026, 8, 8), new BigDecimal("-20"), ProStatus.PERSO, null)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 6, 1), today))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        ExpensePaceResponse result = serviceAsOf(today).getPace(10L, 2);

        assertThat(result.dayOfMonth()).isEqualTo(10);
        assertThat(result.currentMonthCumulative()).isEqualByComparingTo("80");
        assertThat(result.historicalCumulativeAverage()).isEqualByComparingTo("90"); // avg(100, 80)
        assertThat(result.percentDifference()).isEqualByComparingTo("-11.1"); // (80-90)/90
    }

    @Test
    void getPace_excludesInternalTransfersReimbursedProExpensesAndCredits() {
        LocalDate today = LocalDate.of(2026, 8, 10);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 8, 1), new BigDecimal("-60"), ProStatus.PERSO, null),
            expense(LocalDate.of(2026, 8, 2), new BigDecimal("-500"), ProStatus.VIREMENT_INTERNE, null),
            expense(LocalDate.of(2026, 8, 3), new BigDecimal("-40"), ProStatus.PRO_A_REMBOURSER, null, ReimbursementStatus.REMBOURSE),
            expense(LocalDate.of(2026, 8, 4), new BigDecimal("-15"), ProStatus.PRO_A_REMBOURSER, null, ReimbursementStatus.EN_ATTENTE),
            expense(LocalDate.of(2026, 8, 5), new BigDecimal("2500"), ProStatus.NON_CLASSE, null) // salary credit
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 6, 1), today))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        ExpensePaceResponse result = serviceAsOf(today).getPace(10L, 2);

        assertThat(result.currentMonthCumulative()).isEqualByComparingTo("75"); // 60 + 15 pending
    }

    @Test
    void getPace_nullPercentDifferenceWhenThereIsNoComparableHistory() {
        LocalDate today = LocalDate.of(2026, 8, 10);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 8, 1), new BigDecimal("-60"), ProStatus.PERSO, null)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 8, 1), today))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        ExpensePaceResponse result = serviceAsOf(today).getPace(10L, 0);

        assertThat(result.historicalCumulativeAverage()).isEqualByComparingTo("0");
        assertThat(result.percentDifference()).isNull();
    }

    @Test
    void getPace_categorySeriesEndValuesAreZeroFilledForMonthsWithNoSpendingAndSortedByCurrentAmount() {
        LocalDate today = LocalDate.of(2026, 8, 10);
        Category resto = Category.builder().id(1L).name("Restauration").kind(CategoryKind.EXPENSE).color("#f97316").build();
        Category loisirs = Category.builder().id(2L).name("Loisirs").kind(CategoryKind.EXPENSE).color("#22c55e").build();
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 6, 5), new BigDecimal("-60"), ProStatus.PERSO, 1L),
            expense(LocalDate.of(2026, 7, 5), new BigDecimal("-40"), ProStatus.PERSO, 1L),
            expense(LocalDate.of(2026, 7, 12), new BigDecimal("-30"), ProStatus.PERSO, 2L), // no June entry for this category
            expense(LocalDate.of(2026, 8, 3), new BigDecimal("-20"), ProStatus.PERSO, 1L),
            expense(LocalDate.of(2026, 8, 4), new BigDecimal("-5"), ProStatus.PERSO, null)  // uncategorized bucket
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 6, 1), today))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of(resto, loisirs));
        when(budgetRepository.findAllByMemberIdOrderByIdAsc(10L))
            .thenReturn(List.of(Budget.builder().category(resto).monthlyLimit(new BigDecimal("150.00")).build()));

        ExpensePaceResponse result = serviceAsOf(today).getPace(10L, 2);

        assertThat(result.categorySeries()).hasSize(3);
        var resultResto = result.categorySeries().get(0); // current=20, highest current amount
        assertThat(resultResto.categoryName()).isEqualTo("Restauration");
        assertThat(resultResto.monthlyBudget()).isEqualByComparingTo("150.00");
        assertThat(resultResto.currentCumulativeByDay()).hasSize(10); // dayOfMonth
        assertThat(lastOf(resultResto.currentCumulativeByDay())).isEqualByComparingTo("20");
        assertThat(resultResto.historicalCumulativeByDay()).hasSize(31); // August's length
        assertThat(lastOf(resultResto.historicalCumulativeByDay())).isEqualByComparingTo("50"); // avg(60, 40)

        var resultUncategorized = result.categorySeries().stream().filter(c -> c.categoryId() == null).findFirst().orElseThrow();
        assertThat(resultUncategorized.categoryName()).isNull();
        assertThat(resultUncategorized.monthlyBudget()).isNull();
        assertThat(lastOf(resultUncategorized.currentCumulativeByDay())).isEqualByComparingTo("5");

        var resultLoisirs = result.categorySeries().stream().filter(c -> c.categoryId() != null && c.categoryId() == 2L).findFirst().orElseThrow();
        assertThat(lastOf(resultLoisirs.currentCumulativeByDay())).isEqualByComparingTo("0");
        assertThat(lastOf(resultLoisirs.historicalCumulativeByDay())).isEqualByComparingTo("15"); // avg(0, 30) -- zero-filled June
    }

    @Test
    void getPace_seriesAreLengthDayOfMonthAndDaysInMonthAndAShorterHistoricalMonthPlateausAfterItEnds() {
        LocalDate today = LocalDate.of(2026, 3, 5); // March has 31 days; day5 -> current series length 5
        List<Transaction> window = List.of(
            // February 2026 (28 days, not a leap year): jumps to 50 on day 20, nothing after.
            expense(LocalDate.of(2026, 2, 20), new BigDecimal("-50"), ProStatus.PERSO, null),
            expense(LocalDate.of(2026, 3, 5), new BigDecimal("-10"), ProStatus.PERSO, null)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 2, 1), today))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        ExpensePaceResponse result = serviceAsOf(today).getPace(10L, 1);

        assertThat(result.daysInMonth()).isEqualTo(31);
        assertThat(result.currentCumulativeByDay()).hasSize(5);
        assertThat(lastOf(result.currentCumulativeByDay())).isEqualByComparingTo("10");

        assertThat(result.historicalCumulativeByDay()).hasSize(31);
        assertThat(result.historicalCumulativeByDay().get(18)).isEqualByComparingTo("0");  // day 19, before Feb's jump
        assertThat(result.historicalCumulativeByDay().get(19)).isEqualByComparingTo("50"); // day 20, the jump
        assertThat(result.historicalCumulativeByDay().get(27)).isEqualByComparingTo("50"); // day 28, Feb's last day
        assertThat(result.historicalCumulativeByDay().get(28)).isEqualByComparingTo("50"); // day 29 -- Feb doesn't have one, plateaus
        assertThat(result.historicalCumulativeByDay().get(30)).isEqualByComparingTo("50"); // day 31 -- still plateaued
    }

    private static BigDecimal lastOf(List<BigDecimal> series) {
        return series.get(series.size() - 1);
    }

    @Test
    void getDashboard_income_excludesInternalTransfersAndZeroAmounts() {
        YearMonth period = YearMonth.of(2026, 1);
        List<Transaction> window = List.of(
            expense(LocalDate.of(2026, 1, 5), new BigDecimal("500"), ProStatus.VIREMENT_INTERNE, null),
            expense(LocalDate.of(2026, 1, 6), BigDecimal.ZERO, ProStatus.NON_CLASSE, null)
        );
        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, YearMonth.of(2025, 8).atDay(1), period.atEndOfMonth()))
            .thenReturn(window);
        when(categoryRepository.findAllByMemberIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of());

        var result = expenseDashboardService.getDashboard(10L, 6, period.atDay(1), period.atEndOfMonth(), true);

        assertThat(result.categoryBreakdown()).isEmpty();
    }
}
