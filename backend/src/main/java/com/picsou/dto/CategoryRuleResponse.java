package com.picsou.dto;

import com.picsou.model.CategoryRule;
import com.picsou.model.ProStatus;

/** categoryName/categoryColor are resolved server-side so the frontend doesn't need its own
 * category lookup just to render a rule row -- same convention as CategoryBreakdownItem. */
public record CategoryRuleResponse(
    Long id,
    String pattern,
    Long expenseCategoryId,
    String categoryName,
    String categoryColor,
    ProStatus proStatus
) {
    public static CategoryRuleResponse from(CategoryRule rule, String categoryName, String categoryColor) {
        return new CategoryRuleResponse(rule.getId(), rule.getPattern(), rule.getExpenseCategoryId(), categoryName, categoryColor, rule.getProStatus());
    }
}
