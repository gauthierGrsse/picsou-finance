package com.picsou.controller;

import com.picsou.dto.ExpenseDashboardResponse;
import com.picsou.dto.ExpensePaceResponse;
import com.picsou.dto.RecurringTransactionResponse;
import com.picsou.service.ExpenseDashboardService;
import com.picsou.service.RecurringTransactionService;
import com.picsou.service.UserContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@RestController
@RequestMapping("/api/expense-dashboard")
public class ExpenseDashboardController {

    private final ExpenseDashboardService expenseDashboardService;
    private final RecurringTransactionService recurringTransactionService;
    private final UserContext userContext;

    public ExpenseDashboardController(
        ExpenseDashboardService expenseDashboardService,
        RecurringTransactionService recurringTransactionService,
        UserContext userContext
    ) {
        this.expenseDashboardService = expenseDashboardService;
        this.recurringTransactionService = recurringTransactionService;
        this.userContext = userContext;
    }

    @GetMapping
    public ExpenseDashboardResponse getDashboard(
        @RequestParam(defaultValue = "6") int months,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodEnd,
        @RequestParam(defaultValue = "false") boolean income
    ) {
        YearMonth currentMonth = YearMonth.now();
        LocalDate resolvedStart = periodStart != null ? periodStart : currentMonth.atDay(1);
        LocalDate resolvedEnd = periodEnd != null ? periodEnd : currentMonth.atEndOfMonth();
        return expenseDashboardService.getDashboard(userContext.currentMemberId(), months, resolvedStart, resolvedEnd, income);
    }

    @GetMapping("/pace")
    public ExpensePaceResponse getPace(@RequestParam(defaultValue = "3") int historyMonths) {
        return expenseDashboardService.getPace(userContext.currentMemberId(), historyMonths);
    }

    @GetMapping("/recurring")
    public List<RecurringTransactionResponse> getRecurring() {
        return recurringTransactionService.getRecurring(userContext.currentMemberId());
    }
}
