package com.picsou.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * How the current month's spending compares to the same member's usual pace, as a day-by-day
 * cumulative series rather than a single end-of-range number.
 * <p>
 * {@code currentCumulativeByDay} covers day 1 through {@code dayOfMonth} (today) -- it doesn't
 * project forward, since guessing the rest of the month is exactly what makes a naive linear
 * projection unreliable (a single early large bill like rent can 4x it). {@code
 * historicalCumulativeByDay} covers the full {@code daysInMonth}, averaged across the
 * {@code historyMonths} prior full months, so it reads as a reference trajectory the current
 * line is tracking against -- a historical month shorter than {@code daysInMonth} (e.g.
 * February) plateaus at its final total for the remaining days rather than ending early.
 * <p>
 * {@code currentMonthCumulative} and {@code historicalCumulativeAverage} are just the last
 * point of the first series and the {@code dayOfMonth}-th point of the second, included so
 * the frontend doesn't need to re-derive them for the headline badge.
 * {@code percentDifference} is {@code (current - historicalAverage) / historicalAverage * 100},
 * positive meaning "spending more than usual so far"; null when there's no comparable history.
 */
public record ExpensePaceResponse(
    int dayOfMonth,
    int daysInMonth,
    int historyMonths,
    BigDecimal currentMonthCumulative,
    BigDecimal historicalCumulativeAverage,
    BigDecimal percentDifference,
    List<BigDecimal> currentCumulativeByDay,
    List<BigDecimal> historicalCumulativeByDay,
    List<CategoryPaceSeries> categorySeries
) {
}
