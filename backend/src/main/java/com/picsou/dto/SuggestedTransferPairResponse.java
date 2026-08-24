package com.picsou.dto;

public record SuggestedTransferPairResponse(
    TransactionResponse a,
    TransactionResponse b
) {
}
