package com.picsou.service;

import com.picsou.dto.TransactionResponse;
import com.picsou.model.Transaction;
import com.picsou.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/**
 * Cross-account transaction listing for the "every transaction" page -- unlike
 * AccountService.getTransactions (one account), this spans every account the member owns,
 * which is why each row carries its own accountId/accountName rather than relying on
 * page-level context for it.
 */
@Service
@Transactional(readOnly = true)
public class TransactionQueryService {

    private final TransactionRepository transactionRepository;

    public TransactionQueryService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    public List<TransactionResponse> findAll(Long memberId, LocalDate periodStart, LocalDate periodEnd) {
        return transactionRepository.findByAccount_Member_IdAndDateBetween(memberId, periodStart, periodEnd).stream()
            .sorted(Comparator.comparing(Transaction::getDate).reversed().thenComparing(Transaction::getId, Comparator.reverseOrder()))
            .map(TransactionResponse::from)
            .toList();
    }
}
