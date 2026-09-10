package com.picsou.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One detected recurring charge -- a similarly-described, similarly-valued expense that has
 * landed in at least 3 distinct months of the recent lookback window.
 * <p>
 * {@code previousAmount} is non-null only when the latest occurrence's amount differs
 * meaningfully from the earlier ones -- a silent price change worth surfacing.
 * {@code dueThisMonth} is true once an occurrence has already landed in the current month;
 * when false, {@code expectedDate} is this month's {@code typicalDayOfMonth}, for the
 * "still to come this month" view.
 */
public record RecurringTransactionResponse(
    String label,
    BigDecimal typicalAmount,
    int typicalDayOfMonth,
    Long expenseCategoryId,
    String categoryName,
    String categoryColor,
    LocalDate lastSeen,
    int monthsSeen,
    BigDecimal previousAmount,
    boolean dueThisMonth,
    LocalDate expectedDate
) {
}
