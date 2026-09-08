package com.picsou.dto;

import java.math.BigDecimal;

/** {@code categoryId}/{@code categoryName} are null for uncategorized expenses, same convention
 * as {@link CategoryBreakdownItem}. {@code historicalMonthlyAverage} is the average of this
 * category's total over full prior months (zero-filled for months with no spending in it), so
 * it reads as "normally about X per month" -- it is not day-adjusted, unlike the overall pace. */
public record CategoryPaceItem(
    Long categoryId,
    String categoryName,
    String categoryColor,
    BigDecimal currentMonthAmount,
    BigDecimal historicalMonthlyAverage
) {
}
