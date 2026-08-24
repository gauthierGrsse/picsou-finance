package com.picsou.controller;

import com.picsou.dto.SuggestedTransferPairResponse;
import com.picsou.dto.TransactionResponse;
import com.picsou.dto.TransferLinkRequest;
import com.picsou.service.InternalTransferService;
import com.picsou.service.UserContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/transfers")
public class InternalTransferController {

    private final InternalTransferService internalTransferService;
    private final UserContext userContext;

    public InternalTransferController(InternalTransferService internalTransferService, UserContext userContext) {
        this.internalTransferService = internalTransferService;
        this.userContext = userContext;
    }

    /** Same-amount, opposite-sign pairs across different accounts with no shared provider
     * reference -- everything with one has already been auto-linked at sync time. */
    @GetMapping("/suggested")
    public List<SuggestedTransferPairResponse> findSuggestions() {
        return internalTransferService.findSuggestions(userContext.currentMemberId());
    }

    /** Full unclassified/unlinked pool, for manually picking a counterpart to link. */
    @GetMapping("/candidates")
    public List<TransactionResponse> findCandidates() {
        return internalTransferService.findCandidates(userContext.currentMemberId());
    }

    @PostMapping("/link")
    public void confirmLink(@Valid @RequestBody TransferLinkRequest req) {
        internalTransferService.confirmLink(req.transactionIdA(), req.transactionIdB(), userContext.currentMemberId());
    }

    @DeleteMapping("/{transactionId}/link")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlink(@PathVariable Long transactionId) {
        internalTransferService.unlink(transactionId, userContext.currentMemberId());
    }
}
