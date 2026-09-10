package com.picsou.service;

import com.picsou.dto.RecurringTransactionResponse;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Detects recurring charges -- subscriptions, rent, insurance, memberships -- by grouping the
 * member's recent expenses on a digit-stripped description and keeping only groups that:
 * <ul>
 *   <li>landed in at least {@link #MIN_MONTHS} distinct months of the {@link #LOOKBACK_MONTHS}
 *   -month window (roughly monthly), and</li>
 *   <li>have a tightly-clustered amount (a majority within {@link #CORE_TOLERANCE} of the
 *   median) -- which naturally excludes variable spending like groceries.</li>
 * </ul>
 * Drives the expense dashboard's "your subscriptions" card and its "still to come this month"
 * preview.
 */
@Service
@Transactional(readOnly = true)
public class RecurringTransactionService {

    private static final int LOOKBACK_MONTHS = 5;   // current month + 4 completed
    private static final int MIN_MONTHS = 3;
    private static final BigDecimal CORE_TOLERANCE = new BigDecimal("0.10");
    // 1% -- catches a real rent indexation or subscription price bump while ignoring
    // sub-1% rounding/FX wobble on the odd foreign-billed charge.
    private static final BigDecimal PRICE_CHANGE_THRESHOLD = new BigDecimal("0.01");
    private static final BigDecimal MAX_LATEST_DRIFT = new BigDecimal("0.40");

    private final TransactionRepository transactionRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final Clock clock;

    public RecurringTransactionService(
        TransactionRepository transactionRepository,
        ExpenseCategoryRepository expenseCategoryRepository,
        Clock clock
    ) {
        this.transactionRepository = transactionRepository;
        this.expenseCategoryRepository = expenseCategoryRepository;
        this.clock = clock;
    }

    public List<RecurringTransactionResponse> getRecurring(Long memberId) {
        LocalDate today = LocalDate.now(clock);
        YearMonth currentMonth = YearMonth.from(today);
        LocalDate from = currentMonth.minusMonths(LOOKBACK_MONTHS - 1L).atDay(1);

        List<Transaction> window = transactionRepository.findByAccount_Member_IdAndDateBetween(memberId, from, today).stream()
            .filter(this::isRealExpense)
            .toList();

        Map<String, List<Transaction>> byKey = window.stream()
            .collect(Collectors.groupingBy(t -> normalize(t.getDescription()), LinkedHashMap::new, Collectors.toList()));

        Map<Long, ExpenseCategory> categoriesById = expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(memberId).stream()
            .collect(Collectors.toMap(ExpenseCategory::getId, c -> c));

        return byKey.values().stream()
            .map(group -> toRecurring(group, currentMonth, categoriesById))
            .filter(Objects::nonNull)
            .sorted(Comparator.comparing(RecurringTransactionResponse::typicalAmount).reversed())
            .toList();
    }

    private RecurringTransactionResponse toRecurring(
        List<Transaction> group, YearMonth currentMonth, Map<Long, ExpenseCategory> categoriesById
    ) {
        Set<YearMonth> months = group.stream().map(t -> YearMonth.from(t.getDate())).collect(Collectors.toSet());
        if (months.size() < MIN_MONTHS) return null;

        List<BigDecimal> amounts = group.stream().map(t -> t.getAmount().abs()).sorted().toList();
        BigDecimal median = amounts.get(amounts.size() / 2);
        if (median.signum() == 0) return null;

        long clustered = amounts.stream().filter(a -> withinTolerance(a, median, CORE_TOLERANCE)).count();
        if (clustered < Math.ceil(amounts.size() * 0.6)) return null; // too variable -- not a fixed charge

        Transaction latest = group.stream().max(Comparator.comparing(Transaction::getDate)).orElseThrow();
        BigDecimal latestAmount = latest.getAmount().abs();

        List<BigDecimal> earlier = group.stream()
            .filter(t -> !t.getId().equals(latest.getId()))
            .map(t -> t.getAmount().abs()).sorted().toList();
        BigDecimal previousAmount = null;
        if (!earlier.isEmpty()) {
            BigDecimal earlierMedian = earlier.get(earlier.size() / 2);
            if (earlierMedian.signum() != 0 && !withinTolerance(latestAmount, earlierMedian, MAX_LATEST_DRIFT)) {
                return null; // latest is too far off -- probably not the same charge
            }
            if (earlierMedian.signum() != 0 && !withinTolerance(latestAmount, earlierMedian, PRICE_CHANGE_THRESHOLD)) {
                previousAmount = earlierMedian;
            }
        }

        int typicalDay = medianDayOfMonth(group);
        boolean dueThisMonth = months.contains(currentMonth);
        LocalDate expectedDate = currentMonth.atDay(Math.min(typicalDay, currentMonth.lengthOfMonth()));

        ExpenseCategory category = latest.getExpenseCategoryId() != null
            ? categoriesById.get(latest.getExpenseCategoryId()) : null;

        return new RecurringTransactionResponse(
            latest.getDescription(),
            latestAmount,
            typicalDay,
            category != null ? category.getId() : null,
            category != null ? category.getName() : null,
            category != null ? category.getColor() : null,
            latest.getDate(),
            months.size(),
            previousAmount,
            dueThisMonth,
            expectedDate
        );
    }

    private boolean isRealExpense(Transaction t) {
        if (t.getAmount().signum() >= 0) return false;
        if (t.getProStatus() == ProStatus.VIREMENT_INTERNE) return false;
        return !(t.getProStatus() == ProStatus.PRO_A_REMBOURSER && t.getReimbursementStatus() == ReimbursementStatus.REMBOURSE);
    }

    /** {@code |a - ref| / ref <= tolerance}. */
    private boolean withinTolerance(BigDecimal a, BigDecimal ref, BigDecimal tolerance) {
        return a.subtract(ref).abs().divide(ref, 4, RoundingMode.HALF_UP).compareTo(tolerance) <= 0;
    }

    private int medianDayOfMonth(List<Transaction> group) {
        List<Integer> days = group.stream().map(t -> t.getDate().getDayOfMonth()).sorted().toList();
        return days.get(days.size() / 2);
    }

    /** Lowercase, strip digits and punctuation, collapse whitespace -- so a monthly SEPA
     * mandate whose reference number changes ("PRELEVEMENT EFI PL60121 ...", "...PL60965...")
     * still groups together. */
    static String normalize(String description) {
        if (description == null) return "";
        return description.toLowerCase(Locale.ROOT)
            .replaceAll("[0-9]", "")
            .replaceAll("[^a-z\\u00e0-\\u00ff ]", " ")
            .replaceAll("\\s+", " ")
            .trim();
    }
}
