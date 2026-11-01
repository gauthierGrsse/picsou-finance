package com.picsou.controller;

import com.picsou.dto.CategoryRuleSuggestionResponse;
import com.picsou.dto.DismissSuggestionRequest;
import com.picsou.service.CategoryRuleSuggestionService;
import com.picsou.service.UserContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Rule suggestions mined from the member's own categorization history. Adopting one is an
 * ordinary {@code POST /api/categorization-rules}; only the suggestion list and its dismissals
 * live here.
 */
@RestController
@RequestMapping("/api/rule-suggestions")
public class RuleSuggestionController {

    private final CategoryRuleSuggestionService suggestionService;
    private final UserContext userContext;

    public RuleSuggestionController(CategoryRuleSuggestionService suggestionService, UserContext userContext) {
        this.suggestionService = suggestionService;
        this.userContext = userContext;
    }

    @GetMapping
    public List<CategoryRuleSuggestionResponse> getSuggestions() {
        return suggestionService.getSuggestions(userContext.currentMemberId());
    }

    @PostMapping("/dismiss")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismiss(@Valid @RequestBody DismissSuggestionRequest req) {
        suggestionService.dismiss(userContext.currentMemberId(), req.pattern());
    }
}
