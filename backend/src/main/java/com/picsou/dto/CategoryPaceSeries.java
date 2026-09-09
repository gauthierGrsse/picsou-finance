package com.picsou.dto;

import java.math.BigDecimal;
import java.util.List;

/** One category's cumulative-by-day series, same shape and day ranges as the top-level series
 * in {@link ExpensePaceResponse}. {@code categoryId}/{@code categoryName} are null for the
 * uncategorized bucket, same convention as {@link CategoryBreakdownItem}. {@code monthlyBudget}
 * is the category's own optional soft budget, carried here so the pace card doesn't need a
 * second lookup to show progress against it -- null when the category has none set (always
 * null for the uncategorized bucket, which has no category to carry one). */
public record CategoryPaceSeries(
    Long categoryId,
    String categoryName,
    String categoryColor,
    BigDecimal monthlyBudget,
    List<BigDecimal> currentCumulativeByDay,
    List<BigDecimal> historicalCumulativeByDay
) {
}
