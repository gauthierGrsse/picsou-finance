package com.picsou.dto;

import java.math.BigDecimal;
import java.util.List;

public record PendingReimbursementsResponse(
    List<TransactionResponse> expenses,
    BigDecimal totalOwed
) {
}
