package com.picsou.dto;

import com.picsou.model.Reimbursement;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ReimbursementResponse(
    Long id,
    TransactionResponse creditTransaction,
    List<TransactionResponse> expenses,
    BigDecimal totalLinked,
    Instant createdAt
) {
    public static ReimbursementResponse from(Reimbursement r, List<TransactionResponse> expenses) {
        BigDecimal total = expenses.stream()
            .map(TransactionResponse::amount)
            .map(BigDecimal::abs)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ReimbursementResponse(
            r.getId(),
            TransactionResponse.from(r.getTransaction()),
            expenses,
            total,
            r.getCreatedAt()
        );
    }
}
