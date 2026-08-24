package com.picsou.controller;

import com.picsou.dto.ExpenseDashboardResponse;
import com.picsou.service.ExpenseDashboardService;
import com.picsou.service.UserContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;

@RestController
@RequestMapping("/api/expense-dashboard")
public class ExpenseDashboardController {

    private final ExpenseDashboardService expenseDashboardService;
    private final UserContext userContext;

    public ExpenseDashboardController(ExpenseDashboardService expenseDashboardService, UserContext userContext) {
        this.expenseDashboardService = expenseDashboardService;
        this.userContext = userContext;
    }

    @GetMapping
    public ExpenseDashboardResponse getDashboard(
        @RequestParam(defaultValue = "6") int months,
        @RequestParam(required = false) String period
    ) {
        YearMonth resolvedPeriod = period != null ? YearMonth.parse(period) : YearMonth.now();
        return expenseDashboardService.getDashboard(userContext.currentMemberId(), months, resolvedPeriod);
    }
}
