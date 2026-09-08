package com.picsou.service;

import com.picsou.dto.CategoryBreakdownItem;
import com.picsou.dto.CategoryPaceItem;
import com.picsou.dto.ExpenseDashboardResponse;
import com.picsou.dto.ExpensePaceResponse;
import com.picsou.dto.MonthlyExpenseTotal;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.ProStatus;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ExpenseDashboardService {

    private final TransactionRepository transactionRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final Clock clock;

    public ExpenseDashboardService(
        TransactionRepository transactionRepository,
        ExpenseCategoryRepository expenseCategoryRepository,
        Clock clock
    ) {
        this.transactionRepository = transactionRepository;
        this.expenseCategoryRepository = expenseCategoryRepository;
        this.clock = clock;
    }

    /**
     * {@code periodStart}/{@code periodEnd} scope the breakdown and PRO_ABSORBE total --
     * a single month, or a full calendar year (Jan 1 to Dec 31), or any other range the
     * caller wants to drill into. The trailing evolution chart is independent of that
     * range's width: it always shows {@code months} months ending in the month containing
     * {@code periodEnd}, so a year view naturally requests {@code months=12} to show every
     * bar in the selected year.
     */
    public ExpenseDashboardResponse getDashboard(Long memberId, int months, LocalDate periodStart, LocalDate periodEnd, boolean income) {
        YearMonth periodEndMonth = YearMonth.from(periodEnd);
        YearMonth evolutionStart = periodEndMonth.minusMonths(months - 1L);
        LocalDate evolutionStartDate = evolutionStart.atDay(1);
        LocalDate windowStart = evolutionStartDate.isBefore(periodStart) ? evolutionStartDate : periodStart;

        // One query spanning the whole evolution window plus the (possibly wider) period
        // range; the period-only views below (breakdown, PRO_ABSORBE total) filter this
        // same result set in memory rather than issuing a second query.
        List<Transaction> window = transactionRepository.findByAccount_Member_IdAndDateBetween(
            memberId, windowStart, periodEndMonth.atEndOfMonth());

        List<MonthlyExpenseTotal> monthlyEvolution = buildMonthlyEvolution(window, evolutionStart, periodEndMonth, income);

        List<Transaction> periodTransactions = window.stream()
            .filter(t -> !t.getDate().isBefore(periodStart) && !t.getDate().isAfter(periodEnd))
            .toList();

        Map<Long, ExpenseCategory> categoriesById = expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(memberId).stream()
            .collect(Collectors.toMap(ExpenseCategory::getId, c -> c));

        List<CategoryBreakdownItem> categoryBreakdown = buildCategoryBreakdown(periodTransactions, categoriesById, income);

        BigDecimal totalProAbsorbe = periodTransactions.stream()
            .filter(t -> t.getProStatus() == ProStatus.PRO_ABSORBE)
            .map(t -> t.getAmount().abs())
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new ExpenseDashboardResponse(monthlyEvolution, categoryBreakdown, totalProAbsorbe);
    }

    /**
     * How the current (in-progress) month's spending compares to the member's usual pace, as of
     * today. Deliberately not a forward projection to month-end -- see {@link ExpensePaceResponse}.
     * {@code historyMonths} is how many full prior months to average over (e.g. 3).
     */
    public ExpensePaceResponse getPace(Long memberId, int historyMonths) {
        historyMonths = Math.max(historyMonths, 0);
        LocalDate today = LocalDate.now(clock);
        YearMonth currentMonth = YearMonth.from(today);
        int dayOfMonth = today.getDayOfMonth();
        YearMonth firstHistoricalMonth = currentMonth.minusMonths(historyMonths);

        List<Transaction> window = transactionRepository.findByAccount_Member_IdAndDateBetween(
                memberId, firstHistoricalMonth.atDay(1), today).stream()
            .filter(t -> !isExcluded(t, false))
            .toList();

        BigDecimal currentMonthCumulative = sumThrough(window, currentMonth, dayOfMonth);

        List<BigDecimal> historicalCumulatives = new ArrayList<>();
        for (YearMonth ym = firstHistoricalMonth; ym.isBefore(currentMonth); ym = ym.plusMonths(1)) {
            int cutoffDay = Math.min(dayOfMonth, ym.lengthOfMonth());
            historicalCumulatives.add(sumThrough(window, ym, cutoffDay));
        }
        BigDecimal historicalCumulativeAverage = average(historicalCumulatives, historyMonths);
        BigDecimal percentDifference = percentDifference(currentMonthCumulative, historicalCumulativeAverage);

        Map<Long, ExpenseCategory> categoriesById = expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(memberId).stream()
            .collect(Collectors.toMap(ExpenseCategory::getId, c -> c));
        List<CategoryPaceItem> categoryPace = buildCategoryPace(window, currentMonth, firstHistoricalMonth, historyMonths, categoriesById);

        return new ExpensePaceResponse(dayOfMonth, historyMonths, currentMonthCumulative, historicalCumulativeAverage, percentDifference, categoryPace);
    }

    /** Sum of amounts within {@code month}, on or before {@code throughDay}. */
    private BigDecimal sumThrough(List<Transaction> window, YearMonth month, int throughDay) {
        return window.stream()
            .filter(t -> YearMonth.from(t.getDate()).equals(month) && t.getDate().getDayOfMonth() <= throughDay)
            .map(t -> t.getAmount().abs())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Full-month total (no day cutoff) within one category -- {@code categoryId} may itself be
     * null, meaning the uncategorized bucket. */
    private BigDecimal categoryTotal(List<Transaction> window, YearMonth month, Long categoryId) {
        return window.stream()
            .filter(t -> YearMonth.from(t.getDate()).equals(month) && Objects.equals(t.getExpenseCategoryId(), categoryId))
            .map(t -> t.getAmount().abs())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Per category: this month's total so far, and the average of full prior months' totals
     * (zero-filled for months with no spending in that category) -- "normally about X/month",
     * not day-adjusted. Only categories with a nonzero current or historical amount are included. */
    private List<CategoryPaceItem> buildCategoryPace(
        List<Transaction> window, YearMonth currentMonth, YearMonth firstHistoricalMonth, int historyMonths,
        Map<Long, ExpenseCategory> categoriesById
    ) {
        Set<Long> categoryIds = window.stream().map(Transaction::getExpenseCategoryId)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        return categoryIds.stream()
            .map(categoryId -> {
                BigDecimal currentAmount = categoryTotal(window, currentMonth, categoryId);
                List<BigDecimal> historicalTotals = new ArrayList<>();
                for (YearMonth ym = firstHistoricalMonth; ym.isBefore(currentMonth); ym = ym.plusMonths(1)) {
                    historicalTotals.add(categoryTotal(window, ym, categoryId));
                }
                BigDecimal historicalAverage = average(historicalTotals, historyMonths);
                ExpenseCategory category = categoryId != null ? categoriesById.get(categoryId) : null;
                return new CategoryPaceItem(
                    category != null ? category.getId() : null,
                    category != null ? category.getName() : null,
                    category != null ? category.getColor() : null,
                    currentAmount,
                    historicalAverage
                );
            })
            .filter(item -> item.currentMonthAmount().signum() != 0 || item.historicalMonthlyAverage().signum() != 0)
            .sorted((a, b) -> b.currentMonthAmount().compareTo(a.currentMonthAmount()))
            .toList();
    }

    private BigDecimal average(List<BigDecimal> values, int count) {
        if (count <= 0) return BigDecimal.ZERO;
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    /** Null when there's no comparable history to divide by, rather than a misleading 0% or
     * an infinite jump from zero. */
    private BigDecimal percentDifference(BigDecimal current, BigDecimal historicalAverage) {
        if (historicalAverage.signum() == 0) return null;
        return current.subtract(historicalAverage)
            .divide(historicalAverage, 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100))
            .setScale(1, RoundingMode.HALF_UP);
    }

    /** Transactions on the requested side (expenses = negative, income = positive), summed per
     * month over the window -- every month in range is present even at zero, so the chart never
     * silently skips a month with no data. */
    private List<MonthlyExpenseTotal> buildMonthlyEvolution(List<Transaction> window, YearMonth start, YearMonth end, boolean income) {
        Map<YearMonth, BigDecimal> totals = new LinkedHashMap<>();
        for (YearMonth ym = start; !ym.isAfter(end); ym = ym.plusMonths(1)) {
            totals.put(ym, BigDecimal.ZERO);
        }
        for (Transaction t : window) {
            if (isExcluded(t, income)) continue;
            totals.computeIfPresent(YearMonth.from(t.getDate()), (ym, sum) -> sum.add(t.getAmount().abs()));
        }
        return totals.entrySet().stream()
            .map(e -> new MonthlyExpenseTotal(e.getKey().toString(), e.getValue()))
            .toList();
    }

    /** Transactions on the requested side grouped by (category, pro_status) for the given
     * period; uncategorized ones are grouped under a null categoryId rather than dropped. */
    private List<CategoryBreakdownItem> buildCategoryBreakdown(
        List<Transaction> periodTransactions, Map<Long, ExpenseCategory> categoriesById, boolean income
    ) {
        record Key(Long categoryId, ProStatus proStatus) {
        }
        Map<Key, BigDecimal> totals = new LinkedHashMap<>();
        for (Transaction t : periodTransactions) {
            if (isExcluded(t, income)) continue;
            Key key = new Key(t.getExpenseCategoryId(), t.getProStatus());
            totals.merge(key, t.getAmount().abs(), BigDecimal::add);
        }
        return totals.entrySet().stream()
            .map(e -> {
                ExpenseCategory category = e.getKey().categoryId() != null
                    ? categoriesById.get(e.getKey().categoryId())
                    : null;
                return new CategoryBreakdownItem(
                    category != null ? category.getId() : null,
                    category != null ? category.getName() : null,
                    category != null ? category.getColor() : null,
                    e.getKey().proStatus(),
                    e.getValue()
                );
            })
            .toList();
    }

    /** True when {@code t} should not count toward totals: it's on the other side of the
     * ledger than requested (a zero amount belongs to neither), it's an internal transfer,
     * or it's a professional expense that has since been reimbursed -- the reimbursement
     * makes it a net-zero round-trip, not real personal spending, even though proStatus
     * itself stays PRO_A_REMBOURSER (see {@link ProStatus#PRO_A_REMBOURSER}). Not-yet-reimbursed
     * PRO_A_REMBOURSER expenses still count: the cash has genuinely left the account and
     * reimbursement isn't guaranteed or timely. */
    private boolean isExcluded(Transaction t, boolean income) {
        if (t.getProStatus() == ProStatus.VIREMENT_INTERNE) return true;
        if (t.getProStatus() == ProStatus.PRO_A_REMBOURSER && t.getReimbursementStatus() == ReimbursementStatus.REMBOURSE) return true;
        int sign = t.getAmount().signum();
        return income ? sign <= 0 : sign >= 0;
    }
}
