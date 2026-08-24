package com.picsou.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record LinkExpensesRequest(
    @NotEmpty List<Long> expenseTransactionIds
) {
}
