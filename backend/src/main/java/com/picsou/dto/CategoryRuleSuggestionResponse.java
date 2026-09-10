package com.picsou.dto;

/**
 * A high-confidence auto-categorization rule the member could adopt in one click: the
 * description substring {@code pattern} shows up on transactions that are already, over and
 * over, filed under one category.
 *
 * {@code matchingCategorized} is how many already-categorized transactions back the guess
 * (all of them under {@code expenseCategoryId}); {@code matchingUncategorized} is how many
 * currently-uncategorized transactions the rule would tag right away.
 * {@code dominantSharePercent} is the share of categorized matches that sit under the
 * suggested category -- only patterns at 80%+ are suggested at all.
 */
public record CategoryRuleSuggestionResponse(
    String pattern,
    Long expenseCategoryId,
    String categoryName,
    String categoryColor,
    int matchingCategorized,
    int matchingUncategorized,
    int dominantSharePercent
) {
}
