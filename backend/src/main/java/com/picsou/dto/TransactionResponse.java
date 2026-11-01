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
    Long categoryId,
    String categoryName,
    String counterparty,
    String merchantLabel,
    Long merchantBrandId,
    Long aiSuggestedCategoryId,
    Integer aiConfidence,
    Long accountId,
    String accountName,
    BigDecimal fees,
    ProStatus proStatus,
    Long expenseCategoryId,
    ReimbursementStatus reimbursementStatus,
    Long reimbursementId
) {
    /** Shape without the fork-only classification fields, which upstream code and tests build. */
    public TransactionResponse(
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
        Long categoryId,
        String categoryName,
        String counterparty,
        String merchantLabel,
        Long merchantBrandId,
        Long aiSuggestedCategoryId,
        Integer aiConfidence,
        Long accountId,
        String accountName,
        BigDecimal fees) {
        this(id, date, description, amount, type, category, nativeCurrency, createdAt, isManual, txType, ticker, name, quantity, pricePerUnit, categoryId, categoryName, counterparty, merchantLabel, merchantBrandId, aiSuggestedCategoryId, aiConfidence, accountId, accountName, fees, ProStatus.NON_CLASSE, null, null, null);
    }

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
            t.getCategoryRef() != null ? t.getCategoryRef().getId() : null,
            t.getCategoryRef() != null ? t.getCategoryRef().getName() : null,
            t.getCounterparty(),
            t.getMerchantLabel(),
            t.getMerchantBrandId(),
            t.getAiSuggestedCategoryId(),
            t.getAiConfidence(),
            t.getAccount().getId(),
            t.getAccount().getName(),
            t.getFees(),
            t.getProStatus(),
            t.getExpenseCategoryId(),
            t.getReimbursementStatus(),
            t.getReimbursementId()
        );
    }
}
