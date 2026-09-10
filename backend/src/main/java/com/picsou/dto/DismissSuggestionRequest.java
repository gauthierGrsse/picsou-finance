package com.picsou.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DismissSuggestionRequest(
    @NotBlank @Size(max = 200) String pattern
) {
}
