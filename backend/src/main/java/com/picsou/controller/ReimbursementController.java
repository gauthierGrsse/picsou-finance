package com.picsou.controller;

import com.picsou.dto.LinkExpensesRequest;
import com.picsou.dto.PendingReimbursementsResponse;
import com.picsou.dto.ReimbursementRequest;
import com.picsou.dto.ReimbursementResponse;
import com.picsou.dto.TransactionResponse;
import com.picsou.service.ReimbursementService;
import com.picsou.service.UserContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reimbursements")
public class ReimbursementController {

    private final ReimbursementService reimbursementService;
    private final UserContext userContext;

    public ReimbursementController(ReimbursementService reimbursementService, UserContext userContext) {
        this.reimbursementService = reimbursementService;
        this.userContext = userContext;
    }

    @GetMapping
    public List<ReimbursementResponse> findAll() {
        return reimbursementService.findAll(userContext.currentMemberId());
    }

    @GetMapping("/{id}")
    public ReimbursementResponse findById(@PathVariable Long id) {
        return reimbursementService.findById(id, userContext.currentMemberId());
    }

    @GetMapping("/pending")
    public PendingReimbursementsResponse findPending() {
        return reimbursementService.findPending(userContext.currentMemberId());
    }

    @GetMapping("/candidate-credits")
    public List<TransactionResponse> findCandidateCredits() {
        return reimbursementService.findCandidateCredits(userContext.currentMemberId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReimbursementResponse create(@Valid @RequestBody ReimbursementRequest req) {
        return reimbursementService.create(req, userContext.currentMemberId());
    }

    @PostMapping("/{id}/expenses")
    public ReimbursementResponse addExpenses(@PathVariable Long id, @Valid @RequestBody LinkExpensesRequest req) {
        return reimbursementService.addExpenses(id, req, userContext.currentMemberId());
    }

    @DeleteMapping("/{id}/expenses/{txId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlinkExpense(@PathVariable Long id, @PathVariable Long txId) {
        reimbursementService.unlinkExpense(id, txId, userContext.currentMemberId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        reimbursementService.delete(id, userContext.currentMemberId());
    }
}
