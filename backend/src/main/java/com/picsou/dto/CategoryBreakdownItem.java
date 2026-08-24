package com.picsou.dto;

import com.picsou.model.ProStatus;

import java.math.BigDecimal;

/** {@code categoryId}/{@code categoryName} are null for uncategorized expenses -- the frontend
 * renders its own translated "uncategorized" label rather than the backend hardcoding one. */
public record CategoryBreakdownItem(
    Long categoryId,
    String categoryName,
    String categoryColor,
    ProStatus proStatus,
    BigDecimal total
) {
}
