package com.picsou.dto;

import java.math.BigDecimal;
import java.util.List;

public record ExpenseDashboardResponse(
    List<MonthlyExpenseTotal> monthlyEvolution,
    List<CategoryBreakdownItem> categoryBreakdown,
    BigDecimal totalProAbsorbe
) {
}
