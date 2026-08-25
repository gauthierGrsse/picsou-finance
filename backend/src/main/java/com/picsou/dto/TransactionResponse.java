package com.picsou.dto;

import com.picsou.model.ProStatus;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.model.TransactionType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record TransactionResponse(
    Long id,
    LocalDate date,
    String description,
    BigDecimal amount,
    String type,
    String category,
    String nativeCurrency,
    Instant createdAt,
    boolean isManual,
    TransactionType txType,
    String ticker,
    String name,
    BigDecimal quantity,
    BigDecimal pricePerUnit,
    BigDecimal fees,
    ProStatus proStatus,
    Long expenseCategoryId,
    ReimbursementStatus reimbursementStatus,
    Long reimbursementId,
    Long accountId,
    String accountName
) {
    public static TransactionResponse from(Transaction t) {
        return new TransactionResponse(
            t.getId(),
            t.getDate(),
            t.getDescription(),
            t.getAmount(),
            t.getType(),
            t.getCategory(),
            t.getNativeCurrency(),
            t.getCreatedAt(),
            t.isManual(),
            t.getTxType(),
            t.getTicker(),
            t.getName(),
            t.getQuantity(),
            t.getPricePerUnit(),
            t.getFees(),
            t.getProStatus(),
            t.getExpenseCategoryId(),
            t.getReimbursementStatus(),
            t.getReimbursementId(),
            t.getAccount().getId(),
            t.getAccount().getName()
        );
    }
}
