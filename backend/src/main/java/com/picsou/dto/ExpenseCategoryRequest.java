package com.picsou.dto;

import com.picsou.model.CategoryType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ExpenseCategoryRequest(
    @NotBlank @Size(max = 100) String name,
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Color must be a valid hex color") String color,
    @NotNull CategoryType type,
    Long parentId,
    @Positive BigDecimal monthlyBudget
) {
}
