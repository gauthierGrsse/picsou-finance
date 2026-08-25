package com.picsou.dto;

import jakarta.validation.constraints.NotNull;

public record TransferLinkRequest(
    @NotNull Long transactionIdA,
    @NotNull Long transactionIdB,
    /** Skips the exact-opposite-amount check -- e.g. a wire that lands in a brokerage
     * account for a slightly different figure (fees, FX). Defaults to false so the normal
     * manual-link path keeps its safety net; the frontend only sets this after the user
     * explicitly confirms a mismatch warning. */
    boolean allowAmountMismatch
) {
}
