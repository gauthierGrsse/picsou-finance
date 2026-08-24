package com.picsou.controller;

import com.picsou.dto.TransactionClassificationRequest;
import com.picsou.dto.TransactionResponse;
import com.picsou.service.TransactionClassificationService;
import com.picsou.service.UserContext;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/accounts/{accountId}/transactions/{txId}")
public class TransactionClassificationController {

    private final TransactionClassificationService transactionClassificationService;
    private final UserContext userContext;

    public TransactionClassificationController(
        TransactionClassificationService transactionClassificationService, UserContext userContext
    ) {
        this.transactionClassificationService = transactionClassificationService;
        this.userContext = userContext;
    }

    @PutMapping("/classification")
    public TransactionResponse updateClassification(
        @PathVariable Long accountId,
        @PathVariable Long txId,
        @Valid @RequestBody TransactionClassificationRequest req
    ) {
        return transactionClassificationService.updateClassification(
            accountId, txId, userContext.currentMemberId(), req);
    }
}
