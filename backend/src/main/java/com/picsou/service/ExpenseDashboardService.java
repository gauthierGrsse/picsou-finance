package com.picsou.service;

import com.picsou.dto.CategoryBreakdownItem;
import com.picsou.dto.CategoryPaceSeries;
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
import java.util.Arrays;
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
        int daysInMonth = currentMonth.lengthOfMonth();
        YearMonth firstHistoricalMonth = currentMonth.minusMonths(historyMonths);

        List<Transaction> window = transactionRepository.findByAccount_Member_IdAndDateBetween(
                memberId, firstHistoricalMonth.atDay(1), today).stream()
            .filter(t -> !isExcluded(t, false))
            .toList();

        List<BigDecimal> currentCumulativeByDay = cumulativeByDay(window, currentMonth, dayOfMonth, null, false);
        List<BigDecimal> historicalCumulativeByDay = averagedHistoricalCumulativeByDay(
            window, firstHistoricalMonth, currentMonth, daysInMonth, historyMonths, null, false);

        BigDecimal currentMonthCumulative = lastOrZero(currentCumulativeByDay);
        BigDecimal historicalCumulativeAverage = historicalCumulativeByDay.get(dayOfMonth - 1);
        BigDecimal percentDifference = percentDifference(currentMonthCumulative, historicalCumulativeAverage);

        Map<Long, ExpenseCategory> categoriesById = expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(memberId).stream()
            .collect(Collectors.toMap(ExpenseCategory::getId, c -> c));
        List<CategoryPaceSeries> categorySeries = buildCategoryPaceSeries(
            window, currentMonth, firstHistoricalMonth, dayOfMonth, daysInMonth, historyMonths, categoriesById);

        return new ExpensePaceResponse(
            dayOfMonth, daysInMonth, historyMonths, currentMonthCumulative, historicalCumulativeAverage,
            percentDifference, currentCumulativeByDay, historicalCumulativeByDay, categorySeries);
    }

    /** Cumulative amount for each of the first {@code days} days of {@code month} -- index 0 is
     * day 1. Optionally restricted to one category ({@code categoryId} may itself be null,
     * meaning the uncategorized bucket, when {@code filterByCategory} is true). */
    private List<BigDecimal> cumulativeByDay(List<Transaction> window, YearMonth month, int days, Long categoryId, boolean filterByCategory) {
        BigDecimal[] daily = new BigDecimal[days];
        Arrays.fill(daily, BigDecimal.ZERO);
        for (Transaction t : window) {
            if (!YearMonth.from(t.getDate()).equals(month)) continue;
            if (filterByCategory && !Objects.equals(t.getExpenseCategoryId(), categoryId)) continue;
            int day = t.getDate().getDayOfMonth();
            if (day > days) continue;
            daily[day - 1] = daily[day - 1].add(t.getAmount().abs());
        }
        List<BigDecimal> cumulative = new ArrayList<>(days);
        BigDecimal running = BigDecimal.ZERO;
        for (BigDecimal amount : daily) {
            running = running.add(amount);
            cumulative.add(running);
        }
        return cumulative;
    }

    /** Average, day by day, of {@code historyMonths} prior full months' cumulative series,
     * stretched to {@code days} long -- a historical month shorter than that (e.g. February)
     * plateaus at its own final total for the remaining days rather than ending early. Zero
     * everywhere when there's no history to average (rather than dividing by zero). */
    private List<BigDecimal> averagedHistoricalCumulativeByDay(
        List<Transaction> window, YearMonth firstHistoricalMonth, YearMonth currentMonth, int days,
        int historyMonths, Long categoryId, boolean filterByCategory
    ) {
        BigDecimal[] sums = new BigDecimal[days];
        Arrays.fill(sums, BigDecimal.ZERO);
        if (historyMonths > 0) {
            for (YearMonth ym = firstHistoricalMonth; ym.isBefore(currentMonth); ym = ym.plusMonths(1)) {
                List<BigDecimal> monthCumulative = cumulativeByDay(window, ym, ym.lengthOfMonth(), categoryId, filterByCategory);
                for (int day = 1; day <= days; day++) {
                    BigDecimal value = day <= monthCumulative.size()
                        ? monthCumulative.get(day - 1)
                        : monthCumulative.get(monthCumulative.size() - 1);
                    sums[day - 1] = sums[day - 1].add(value);
                }
            }
        }
        List<BigDecimal> averaged = new ArrayList<>(days);
        for (BigDecimal sum : sums) {
            averaged.add(historyMonths > 0 ? sum.divide(BigDecimal.valueOf(historyMonths), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        }
        return averaged;
    }

    private BigDecimal lastOrZero(List<BigDecimal> series) {
        return series.isEmpty() ? BigDecimal.ZERO : series.get(series.size() - 1);
    }

    /** One series per category with a nonzero current-so-far or historical-average total --
     * uncategorized (null categoryId) included. Sorted by current total descending. */
    private List<CategoryPaceSeries> buildCategoryPaceSeries(
        List<Transaction> window, YearMonth currentMonth, YearMonth firstHistoricalMonth,
        int dayOfMonth, int daysInMonth, int historyMonths, Map<Long, ExpenseCategory> categoriesById
    ) {
        Set<Long> categoryIds = window.stream().map(Transaction::getExpenseCategoryId)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        return categoryIds.stream()
            .map(categoryId -> {
                List<BigDecimal> current = cumulativeByDay(window, currentMonth, dayOfMonth, categoryId, true);
                List<BigDecimal> historical = averagedHistoricalCumulativeByDay(
                    window, firstHistoricalMonth, currentMonth, daysInMonth, historyMonths, categoryId, true);
                ExpenseCategory category = categoryId != null ? categoriesById.get(categoryId) : null;
                return new CategoryPaceSeries(
                    category != null ? category.getId() : null,
                    category != null ? category.getName() : null,
                    category != null ? category.getColor() : null,
                    current,
                    historical
                );
            })
            .filter(series -> lastOrZero(series.currentCumulativeByDay()).signum() != 0 || lastOrZero(series.historicalCumulativeByDay()).signum() != 0)
            .sorted((a, b) -> lastOrZero(b.currentCumulativeByDay()).compareTo(lastOrZero(a.currentCumulativeByDay())))
            .toList();
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
