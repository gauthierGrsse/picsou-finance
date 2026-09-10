package com.picsou.controller;

import com.picsou.dto.CategoryRuleRequest;
import com.picsou.dto.CategoryRuleResponse;
import com.picsou.dto.CategoryRuleSuggestionResponse;
import com.picsou.dto.DismissSuggestionRequest;
import com.picsou.service.CategoryRuleService;
import com.picsou.service.CategoryRuleSuggestionService;
import com.picsou.service.UserContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/category-rules")
public class CategoryRuleController {

    private final CategoryRuleService categoryRuleService;
    private final CategoryRuleSuggestionService categoryRuleSuggestionService;
    private final UserContext userContext;

    public CategoryRuleController(
        CategoryRuleService categoryRuleService,
        CategoryRuleSuggestionService categoryRuleSuggestionService,
        UserContext userContext
    ) {
        this.categoryRuleService = categoryRuleService;
        this.categoryRuleSuggestionService = categoryRuleSuggestionService;
        this.userContext = userContext;
    }

    @GetMapping
    public List<CategoryRuleResponse> findAll() {
        return categoryRuleService.findAll(userContext.currentMemberId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryRuleResponse create(@Valid @RequestBody CategoryRuleRequest req) {
        return categoryRuleService.create(req, userContext.currentMemberId());
    }

    @PutMapping("/{id}")
    public CategoryRuleResponse update(@PathVariable Long id, @Valid @RequestBody CategoryRuleRequest req) {
        return categoryRuleService.update(id, req, userContext.currentMemberId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        categoryRuleService.delete(id, userContext.currentMemberId());
    }

    @GetMapping("/suggestions")
    public List<CategoryRuleSuggestionResponse> getSuggestions() {
        return categoryRuleSuggestionService.getSuggestions(userContext.currentMemberId());
    }

    @PostMapping("/suggestions/dismiss")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismissSuggestion(@Valid @RequestBody DismissSuggestionRequest req) {
        categoryRuleSuggestionService.dismiss(userContext.currentMemberId(), req.pattern());
    }
}
