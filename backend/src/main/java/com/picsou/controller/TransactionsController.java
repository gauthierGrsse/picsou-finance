package com.picsou.controller;

import com.picsou.dto.TransactionResponse;
import com.picsou.service.TransactionQueryService;
import com.picsou.service.UserContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/** Every transaction across every account the member owns, for the global transactions
 * page -- the per-account list under /api/accounts/{id}/transactions stays as-is for the
 * account detail page. */
@RestController
@RequestMapping("/api/transactions")
public class TransactionsController {

    private final TransactionQueryService transactionQueryService;
    private final UserContext userContext;

    public TransactionsController(TransactionQueryService transactionQueryService, UserContext userContext) {
        this.transactionQueryService = transactionQueryService;
        this.userContext = userContext;
    }

    @GetMapping
    public List<TransactionResponse> findAll(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodEnd
    ) {
        return transactionQueryService.findAll(userContext.currentMemberId(), periodStart, periodEnd);
    }
}
