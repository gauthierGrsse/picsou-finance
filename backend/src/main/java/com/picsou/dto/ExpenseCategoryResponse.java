package com.picsou.dto;

import com.picsou.model.CategoryType;
import com.picsou.model.ExpenseCategory;

public record ExpenseCategoryResponse(
    Long id,
    String name,
    String color,
    CategoryType type,
    Long parentId
) {
    public static ExpenseCategoryResponse from(ExpenseCategory c) {
        return new ExpenseCategoryResponse(c.getId(), c.getName(), c.getColor(), c.getType(), c.getParentId());
    }
}
