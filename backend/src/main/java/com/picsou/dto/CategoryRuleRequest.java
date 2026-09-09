package com.picsou.dto;

import com.picsou.model.ProStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CategoryRuleRequest(
    @NotBlank @Size(max = 200) String pattern,
    @NotNull Long expenseCategoryId,
    ProStatus proStatus
) {
}
