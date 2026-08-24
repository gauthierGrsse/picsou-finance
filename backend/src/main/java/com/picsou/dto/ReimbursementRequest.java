package com.picsou.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ReimbursementRequest(
    @NotNull Long creditTransactionId,
    @NotEmpty List<Long> expenseTransactionIds
) {
}
