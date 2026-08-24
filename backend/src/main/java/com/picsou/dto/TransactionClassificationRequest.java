package com.picsou.dto;

import com.picsou.model.ProStatus;
import jakarta.validation.constraints.NotNull;

public record TransactionClassificationRequest(
    @NotNull ProStatus proStatus,
    Long expenseCategoryId
) {
}
