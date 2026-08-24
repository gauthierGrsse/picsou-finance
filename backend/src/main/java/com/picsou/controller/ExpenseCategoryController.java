package com.picsou.controller;

import com.picsou.dto.ExpenseCategoryRequest;
import com.picsou.dto.ExpenseCategoryResponse;
import com.picsou.service.ExpenseCategoryService;
import com.picsou.service.UserContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/expense-categories")
public class ExpenseCategoryController {

    private final ExpenseCategoryService expenseCategoryService;
    private final UserContext userContext;

    public ExpenseCategoryController(ExpenseCategoryService expenseCategoryService, UserContext userContext) {
        this.expenseCategoryService = expenseCategoryService;
        this.userContext = userContext;
    }

    @GetMapping
    public List<ExpenseCategoryResponse> findAll() {
        return expenseCategoryService.findAll(userContext.currentMemberId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseCategoryResponse create(@Valid @RequestBody ExpenseCategoryRequest req) {
        return expenseCategoryService.create(req, userContext.currentMemberId());
    }

    @PutMapping("/{id}")
    public ExpenseCategoryResponse update(@PathVariable Long id, @Valid @RequestBody ExpenseCategoryRequest req) {
        return expenseCategoryService.update(id, req, userContext.currentMemberId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        expenseCategoryService.delete(id, userContext.currentMemberId());
    }
}
