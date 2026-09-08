package com.picsou.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * How the current month's spending compares to the same member's usual pace, so far.
 * <p>
 * {@code currentMonthCumulative} and {@code historicalCumulativeAverage} are both cut off at
 * {@code dayOfMonth} -- today's spend-to-date against the average of what prior months had
 * spent by that same day-of-month -- rather than projecting either forward to month-end. That
 * sidesteps forecasting the rest of the month, which is noisy early on (a single early large
 * bill like rent can 4x a naive linear projection).
 * <p>
 * {@code percentDifference} is {@code (current - historicalAverage) / historicalAverage * 100},
 * positive meaning "spending more than usual so far"; it's null when there's no comparable
 * history yet (0 prior months, or a historical average of exactly zero).
 */
public record ExpensePaceResponse(
    int dayOfMonth,
    int historyMonths,
    BigDecimal currentMonthCumulative,
    BigDecimal historicalCumulativeAverage,
    BigDecimal percentDifference,
    List<CategoryPaceItem> categoryPace
) {
}
