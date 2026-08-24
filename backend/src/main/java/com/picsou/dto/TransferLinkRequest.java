package com.picsou.dto;

import jakarta.validation.constraints.NotNull;

public record TransferLinkRequest(
    @NotNull Long transactionIdA,
    @NotNull Long transactionIdB
) {
}
