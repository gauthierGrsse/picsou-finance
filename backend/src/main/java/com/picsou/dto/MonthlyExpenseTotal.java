package com.picsou.dto;

import java.math.BigDecimal;

public record MonthlyExpenseTotal(
    String yearMonth,
    BigDecimal total
) {
}
