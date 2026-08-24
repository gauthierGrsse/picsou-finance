package com.picsou.dto;

import com.picsou.model.ExpenseCategory;

public record ExpenseCategoryResponse(
    Long id,
    String name,
    String color
) {
    public static ExpenseCategoryResponse from(ExpenseCategory c) {
        return new ExpenseCategoryResponse(c.getId(), c.getName(), c.getColor());
    }
}
