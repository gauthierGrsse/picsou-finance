package com.picsou.dto;

import java.math.BigDecimal;
import java.util.List;

/** One category's cumulative-by-day series, same shape and day ranges as the top-level series
 * in {@link ExpensePaceResponse}. {@code categoryId}/{@code categoryName} are null for the
 * uncategorized bucket, same convention as {@link CategoryBreakdownItem}. */
public record CategoryPaceSeries(
    Long categoryId,
    String categoryName,
    String categoryColor,
    List<BigDecimal> currentCumulativeByDay,
    List<BigDecimal> historicalCumulativeByDay
) {
}
