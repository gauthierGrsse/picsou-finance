package com.picsou.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record HoldingRequest(
    @NotNull BigDecimal quantity,
    BigDecimal averageBuyIn,
    LocalDate acquiredAt
) {}
