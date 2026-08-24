package com.picsou.service;

import com.picsou.dto.CategoryBreakdownItem;
import com.picsou.dto.ExpenseDashboardResponse;
import com.picsou.dto.MonthlyExpenseTotal;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.ProStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ExpenseDashboardService {

    private final TransactionRepository transactionRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;

    public ExpenseDashboardService(
        TransactionRepository transactionRepository,
        ExpenseCategoryRepository expenseCategoryRepository
    ) {
        this.transactionRepository = transactionRepository;
        this.expenseCategoryRepository = expenseCategoryRepository;
    }

    /**
     * {@code periodStart}/{@code periodEnd} scope the breakdown and PRO_ABSORBE total --
     * a single month, or a full calendar year (Jan 1 to Dec 31), or any other range the
     * caller wants to drill into. The trailing evolution chart is independent of that
     * range's width: it always shows {@code months} months ending in the month containing
     * {@code periodEnd}, so a year view naturally requests {@code months=12} to show every
     * bar in the selected year.
     */
    public ExpenseDashboardResponse getDashboard(Long memberId, int months, LocalDate periodStart, LocalDate periodEnd) {
        YearMonth periodEndMonth = YearMonth.from(periodEnd);
        YearMonth evolutionStart = periodEndMonth.minusMonths(months - 1L);
        LocalDate evolutionStartDate = evolutionStart.atDay(1);
        LocalDate windowStart = evolutionStartDate.isBefore(periodStart) ? evolutionStartDate : periodStart;

        // One query spanning the whole evolution window plus the (possibly wider) period
        // range; the period-only views below (breakdown, PRO_ABSORBE total) filter this
        // same result set in memory rather than issuing a second query.
        List<Transaction> window = transactionRepository.findByAccount_Member_IdAndDateBetween(
            memberId, windowStart, periodEndMonth.atEndOfMonth());

        List<MonthlyExpenseTotal> monthlyEvolution = buildMonthlyEvolution(window, evolutionStart, periodEndMonth);

        List<Transaction> periodTransactions = window.stream()
            .filter(t -> !t.getDate().isBefore(periodStart) && !t.getDate().isAfter(periodEnd))
            .toList();

        Map<Long, ExpenseCategory> categoriesById = expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(memberId).stream()
            .collect(Collectors.toMap(ExpenseCategory::getId, c -> c));

        List<CategoryBreakdownItem> categoryBreakdown = buildCategoryBreakdown(periodTransactions, categoriesById);

        BigDecimal totalProAbsorbe = periodTransactions.stream()
            .filter(t -> t.getProStatus() == ProStatus.PRO_ABSORBE)
            .map(t -> t.getAmount().abs())
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new ExpenseDashboardResponse(monthlyEvolution, categoryBreakdown, totalProAbsorbe);
    }

    /** Negative-amount (expense) transactions, summed per month over the window -- every month
     * in range is present even at zero, so the chart never silently skips a month with no data. */
    private List<MonthlyExpenseTotal> buildMonthlyEvolution(List<Transaction> window, YearMonth start, YearMonth end) {
        Map<YearMonth, BigDecimal> totals = new LinkedHashMap<>();
        for (YearMonth ym = start; !ym.isAfter(end); ym = ym.plusMonths(1)) {
            totals.put(ym, BigDecimal.ZERO);
        }
        for (Transaction t : window) {
            if (t.getAmount().signum() >= 0 || t.getProStatus() == ProStatus.VIREMENT_INTERNE) continue;
            totals.computeIfPresent(YearMonth.from(t.getDate()), (ym, sum) -> sum.add(t.getAmount().abs()));
        }
        return totals.entrySet().stream()
            .map(e -> new MonthlyExpenseTotal(e.getKey().toString(), e.getValue()))
            .toList();
    }

    /** Expenses grouped by (category, pro_status) for the given period; uncategorized expenses
     * are grouped under a null categoryId rather than dropped. */
    private List<CategoryBreakdownItem> buildCategoryBreakdown(
        List<Transaction> periodTransactions, Map<Long, ExpenseCategory> categoriesById
    ) {
        record Key(Long categoryId, ProStatus proStatus) {
        }
        Map<Key, BigDecimal> totals = new LinkedHashMap<>();
        for (Transaction t : periodTransactions) {
            if (t.getAmount().signum() >= 0 || t.getProStatus() == ProStatus.VIREMENT_INTERNE) continue;
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
}
