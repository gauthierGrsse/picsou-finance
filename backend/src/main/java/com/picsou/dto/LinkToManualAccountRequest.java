package com.picsou.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record LinkToManualAccountRequest(
    @NotNull Long targetAccountId,
    @NotBlank String description,
    @NotNull LocalDate date
) {
}
